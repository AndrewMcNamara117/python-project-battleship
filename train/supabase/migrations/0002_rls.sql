-- ============================================================
-- IRON MILES TRAINING — row-level security
-- Default deny. Training and wellbeing data is treated as sensitive
-- health data: an athlete sees their own rows, their coach sees rows
-- for athletes actively linked to them, and nobody else sees anything.
-- ============================================================

-- ---------- helpers ----------
-- security definer so the policy can read links without recursing through RLS
create or replace function im_is_coach_of(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from coach_athlete_links l
    where l.athlete_id = target
      and l.coach_id = auth.uid()
      and l.status = 'active'
  );
$$;

create or replace function im_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

create or replace function im_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach','admin'));
$$;

-- true when the caller may read this athlete's training data
create or replace function im_can_read_athlete(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target = auth.uid() or im_is_coach_of(target) or im_is_admin();
$$;

-- ---------- enable RLS everywhere ----------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','coach_athlete_links','races','goals','workout_templates','program_templates',
    'program_template_slots','programs','strength_exercises','strength_templates',
    'strength_template_blocks','scheduled_workouts','completed_workouts','strength_sessions',
    'checkins','coach_notes','message_threads','messages','forge_score_events','achievements',
    'community_events','event_attendance','community_posts','subscriptions','payments',
    'integrations','activity_imports','notifications','coaching_applications','athlete_onboarding'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- ---------- profiles ----------
create policy profiles_self_read on profiles
  for select using (id = auth.uid() or im_is_coach_of(id) or im_is_admin());

-- an athlete on a leaderboard has consented to being seen there
create policy profiles_leaderboard_read on profiles
  for select using (leaderboard_opt_in and auth.uid() is not null);

create policy profiles_self_update on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- only an admin may change roles; enforced by a column-level trigger below
create policy profiles_admin_all on profiles
  for all using (im_is_admin()) with check (im_is_admin());

create or replace function im_guard_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not im_is_admin() then
    raise exception 'role changes require an administrator';
  end if;
  return new;
end $$;

create trigger t_profiles_guard_role before update on profiles
  for each row execute function im_guard_role_change();

-- ---------- coaching relationship ----------
create policy links_read on coach_athlete_links
  for select using (athlete_id = auth.uid() or coach_id = auth.uid() or im_is_admin());
create policy links_write on coach_athlete_links
  for all using (coach_id = auth.uid() or im_is_admin())
  with check (coach_id = auth.uid() or im_is_admin());

-- ---------- shared libraries ----------
-- races: the club calendar is readable by any signed-in athlete
create policy races_read on races
  for select using (auth.uid() is not null);
create policy races_staff_write on races
  for all using (im_is_staff()) with check (im_is_staff());

create policy workout_templates_read on workout_templates
  for select using (is_shared or owner_id = auth.uid() or im_is_admin());
create policy workout_templates_write on workout_templates
  for all using (owner_id = auth.uid() or im_is_admin())
  with check (owner_id = auth.uid() or im_is_admin());

create policy program_templates_read on program_templates
  for select using (is_shared or owner_id = auth.uid() or im_is_admin());
create policy program_templates_write on program_templates
  for all using (owner_id = auth.uid() or im_is_admin())
  with check (owner_id = auth.uid() or im_is_admin());

create policy pts_read on program_template_slots
  for select using (exists (
    select 1 from program_templates pt where pt.id = program_template_id
      and (pt.is_shared or pt.owner_id = auth.uid() or im_is_admin())));
create policy pts_write on program_template_slots
  for all using (exists (
    select 1 from program_templates pt where pt.id = program_template_id
      and (pt.owner_id = auth.uid() or im_is_admin())))
  with check (exists (
    select 1 from program_templates pt where pt.id = program_template_id
      and (pt.owner_id = auth.uid() or im_is_admin())));

create policy strength_ex_read on strength_exercises
  for select using (is_shared or owner_id = auth.uid() or im_is_admin());
create policy strength_ex_write on strength_exercises
  for all using (owner_id = auth.uid() or im_is_admin())
  with check (owner_id = auth.uid() or im_is_admin());

create policy strength_tpl_read on strength_templates
  for select using (is_shared or owner_id = auth.uid() or im_is_admin());
create policy strength_tpl_write on strength_templates
  for all using (owner_id = auth.uid() or im_is_admin())
  with check (owner_id = auth.uid() or im_is_admin());

create policy strength_blocks_read on strength_template_blocks
  for select using (exists (
    select 1 from strength_templates st where st.id = strength_template_id
      and (st.is_shared or st.owner_id = auth.uid() or im_is_admin())));
create policy strength_blocks_write on strength_template_blocks
  for all using (exists (
    select 1 from strength_templates st where st.id = strength_template_id
      and (st.owner_id = auth.uid() or im_is_admin())))
  with check (exists (
    select 1 from strength_templates st where st.id = strength_template_id
      and (st.owner_id = auth.uid() or im_is_admin())));

-- ---------- athlete-owned training data ----------
-- goals, programmes and the schedule: athlete reads, coach writes.
create policy goals_read on goals for select using (im_can_read_athlete(athlete_id));
create policy goals_write on goals for all
  using (athlete_id = auth.uid() or im_is_coach_of(athlete_id) or im_is_admin())
  with check (athlete_id = auth.uid() or im_is_coach_of(athlete_id) or im_is_admin());

create policy programs_read on programs for select using (im_can_read_athlete(athlete_id));
create policy programs_write on programs for all
  using (im_is_coach_of(athlete_id) or im_is_admin())
  with check (im_is_coach_of(athlete_id) or im_is_admin());

-- the athlete may read their schedule and mark sessions done; the coach prescribes it
create policy sched_read on scheduled_workouts for select using (im_can_read_athlete(athlete_id));
create policy sched_coach_write on scheduled_workouts for all
  using (im_is_coach_of(athlete_id) or im_is_admin())
  with check (im_is_coach_of(athlete_id) or im_is_admin());
create policy sched_athlete_status on scheduled_workouts for update
  using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());

-- an athlete's own log of what happened. the coach reads it, never writes it.
create policy completed_read on completed_workouts for select using (im_can_read_athlete(athlete_id));
create policy completed_own_write on completed_workouts for all
  using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());

create policy strength_sessions_read on strength_sessions for select using (im_can_read_athlete(athlete_id));
create policy strength_sessions_own_write on strength_sessions for all
  using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
create policy strength_sessions_coach_write on strength_sessions for insert
  with check (im_is_coach_of(athlete_id) or im_is_admin());

-- check-ins carry wellbeing text. athlete writes; linked coach reads and responds.
create policy checkins_read on checkins for select using (im_can_read_athlete(athlete_id));
create policy checkins_own_write on checkins for all
  using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
create policy checkins_coach_respond on checkins for update
  using (im_is_coach_of(athlete_id) or im_is_admin())
  with check (im_is_coach_of(athlete_id) or im_is_admin());

-- private coach notes are invisible to the athlete, by design
create policy coach_notes_read on coach_notes for select using (
  im_is_coach_of(athlete_id) or im_is_admin()
  or (athlete_id = auth.uid() and visibility = 'shared')
);
create policy coach_notes_write on coach_notes for all
  using (coach_id = auth.uid() or im_is_admin())
  with check (coach_id = auth.uid() or im_is_admin());

create policy onboarding_rw on athlete_onboarding for all
  using (athlete_id = auth.uid() or im_is_coach_of(athlete_id) or im_is_admin())
  with check (athlete_id = auth.uid() or im_is_admin());

-- ---------- messaging ----------
create policy threads_read on message_threads
  for select using (athlete_id = auth.uid() or coach_id = auth.uid() or im_is_admin());
create policy threads_write on message_threads
  for all using (athlete_id = auth.uid() or coach_id = auth.uid() or im_is_admin())
  with check (athlete_id = auth.uid() or coach_id = auth.uid() or im_is_admin());

create policy messages_read on messages for select using (exists (
  select 1 from message_threads t where t.id = thread_id
    and (t.athlete_id = auth.uid() or t.coach_id = auth.uid() or im_is_admin())));
-- you may only send as yourself; FORGE messages are inserted server-side
create policy messages_send on messages for insert
  with check (sender_id = auth.uid() and author_kind = 'human' and exists (
    select 1 from message_threads t where t.id = thread_id
      and (t.athlete_id = auth.uid() or t.coach_id = auth.uid())));
create policy messages_mark_read on messages for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- ---------- forge score, achievements ----------
-- the ledger is append-only from the server; clients read, never write
create policy forge_read on forge_score_events for select using (
  im_can_read_athlete(athlete_id)
  or exists (select 1 from profiles p where p.id = athlete_id and p.leaderboard_opt_in)
);
create policy forge_admin_write on forge_score_events for all
  using (im_is_admin()) with check (im_is_admin());

create policy achievements_read on achievements for select using (
  im_can_read_athlete(athlete_id)
  or exists (select 1 from profiles p where p.id = athlete_id and p.leaderboard_opt_in)
);
create policy achievements_admin_write on achievements for all
  using (im_is_admin()) with check (im_is_admin());

-- ---------- community ----------
create policy community_events_read on community_events
  for select using (auth.uid() is not null);
create policy community_events_write on community_events
  for all using (im_is_staff()) with check (im_is_staff());

create policy attendance_read on event_attendance
  for select using (athlete_id = auth.uid() or im_is_staff());
create policy attendance_own_write on event_attendance
  for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
create policy attendance_staff_write on event_attendance
  for all using (im_is_staff()) with check (im_is_staff());

create policy posts_read on community_posts for select using (auth.uid() is not null);
create policy posts_write on community_posts
  for all using (im_is_staff()) with check (im_is_staff());

-- ---------- billing (server-writable only) ----------
create policy subs_read on subscriptions
  for select using (athlete_id = auth.uid() or im_is_admin());
create policy subs_admin_write on subscriptions
  for all using (im_is_admin()) with check (im_is_admin());

create policy payments_read on payments
  for select using (athlete_id = auth.uid() or im_is_admin());
create policy payments_admin_write on payments
  for all using (im_is_admin()) with check (im_is_admin());

-- ---------- integrations ----------
create policy integrations_rw on integrations
  for all using (athlete_id = auth.uid() or im_is_admin())
  with check (athlete_id = auth.uid() or im_is_admin());

create policy imports_read on activity_imports
  for select using (im_can_read_athlete(athlete_id));
create policy imports_admin_write on activity_imports
  for all using (im_is_admin()) with check (im_is_admin());

-- ---------- notifications ----------
create policy notifications_rw on notifications
  for all using (user_id = auth.uid() or im_is_admin())
  with check (user_id = auth.uid() or im_is_admin());

-- ---------- applications ----------
-- the public apply form posts through a server route with the anon role;
-- nobody but staff can read what was submitted
create policy applications_insert on coaching_applications
  for insert with check (true);
create policy applications_staff_read on coaching_applications
  for select using (im_is_staff());
create policy applications_staff_write on coaching_applications
  for update using (im_is_staff()) with check (im_is_staff());

-- ---------- GDPR: hard delete of an athlete's own data ----------
-- every athlete-owned table cascades from profiles, which cascades from auth.users,
-- so account deletion is a single delete on auth.users performed by the service role.
create or replace function im_export_athlete_data(target uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (target = auth.uid() or im_is_admin()) then
    raise exception 'not permitted';
  end if;
  return jsonb_build_object(
    'profile',            (select to_jsonb(p) from profiles p where p.id = target),
    'goals',              (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) from goals g where g.athlete_id = target),
    'scheduled_workouts', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from scheduled_workouts s where s.athlete_id = target),
    'completed_workouts', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from completed_workouts c where c.athlete_id = target),
    'strength_sessions',  (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from strength_sessions s where s.athlete_id = target),
    'checkins',           (select coalesce(jsonb_agg(to_jsonb(k)), '[]'::jsonb) from checkins k where k.athlete_id = target),
    'forge_score_events', (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from forge_score_events f where f.athlete_id = target),
    'achievements',       (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from achievements a where a.athlete_id = target),
    'messages',           (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from messages m where m.recipient_id = target or m.sender_id = target),
    'exported_at',        to_jsonb(now())
  );
end $$;
