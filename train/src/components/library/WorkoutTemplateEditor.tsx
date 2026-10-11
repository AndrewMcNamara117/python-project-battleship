"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";
import { saveWorkoutTemplate } from "@/app/actions/library";
import type { WorkoutTemplate } from "@/lib/domain/library";
import { WORKOUT_CATEGORY_LABELS } from "@/lib/domain/library";
import { INTENSITY_LABELS, WORKOUT_TYPE_LABELS } from "@/lib/domain/types";

const num = (v: string) => (v.trim() === "" ? null : Number(v));

/**
 * Write a session once, keep it.
 *
 * Nothing here is a prescription. It becomes one when a coach adds it to an
 * athlete, and that copy is independent from the moment it lands.
 */
export function WorkoutTemplateEditor({
  template,
  onDone,
}: {
  template?: WorkoutTemplate;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: template?.name ?? "",
    category: template?.category ?? "easy",
    type: template?.type ?? "easy_run",
    basis: template?.basis ?? "distance",
    intensity: template?.intensity ?? "easy",
    distanceKm: template?.distanceKm?.toString() ?? "",
    durationMinutes: template?.durationMinutes?.toString() ?? "",
    rpeTarget: template?.rpeTarget?.toString() ?? "",
    hrZone: template?.hrZone?.toString() ?? "",
    purpose: template?.purpose ?? "",
    warmUp: template?.warmUp ?? "",
    mainSet: template?.mainSet ?? "",
    coolDown: template?.coolDown ?? "",
    coachNotes: template?.coachNotes ?? "",
    visibility: (template?.visibility === "shared" ? "shared" : "private") as
      | "private"
      | "shared",
    tags: template?.tags.join(", ") ?? "",
  });

  const update =
    (key: keyof typeof form) => (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setError(null);
      const result = await saveWorkoutTemplate({
        id: template?.id,
        name: form.name,
        category: form.category,
        type: form.type,
        basis: form.basis,
        intensity: form.intensity,
        distanceKm: num(form.distanceKm),
        durationMinutes: num(form.durationMinutes),
        rpeTarget: num(form.rpeTarget),
        hrZone: num(form.hrZone),
        purpose: form.purpose.trim() || null,
        warmUp: form.warmUp.trim() || null,
        mainSet: form.mainSet.trim() || null,
        coolDown: form.coolDown.trim() || null,
        coachNotes: form.coachNotes.trim() || null,
        visibility: form.visibility,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
      onDone();
    });
  };

  return (
    <form onSubmit={submit}>
      <Panel className="p-6">
        <h2 className="im-display text-[1.25rem]">
          {template ? "Edit session" : "New session"}
        </h2>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label="Name" className="md:col-span-2">
            {(p) => (
              <Input
                {...p}
                value={form.name}
                onChange={update("name")}
                required
                maxLength={120}
                autoFocus
              />
            )}
          </Field>

          <Field label="Category" hint="How you file it.">
            {(p) => (
              <Select
                {...p}
                value={form.category}
                onChange={update("category")}
              >
                {Object.entries(WORKOUT_CATEGORY_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </Select>
            )}
          </Field>

          <Field label="Type" hint="What the athlete's app shows it as.">
            {(p) => (
              <Select {...p} value={form.type} onChange={update("type")}>
                {Object.entries(WORKOUT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Prescribed by">
            {(p) => (
              <Select {...p} value={form.basis} onChange={update("basis")}>
                <option value="distance">Distance</option>
                <option value="time">Time</option>
                <option value="pace">Pace</option>
                <option value="heart_rate">Heart rate</option>
                <option value="rpe">RPE</option>
              </Select>
            )}
          </Field>

          <Field label="Intensity">
            {(p) => (
              <Select
                {...p}
                value={form.intensity}
                onChange={update("intensity")}
              >
                {Object.entries(INTENSITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Distance (km)">
            {(p) => (
              <Input
                {...p}
                type="number"
                step="0.1"
                min="0"
                value={form.distanceKm}
                onChange={update("distanceKm")}
              />
            )}
          </Field>

          <Field label="Duration (min)">
            {(p) => (
              <Input
                {...p}
                type="number"
                min="0"
                value={form.durationMinutes}
                onChange={update("durationMinutes")}
              />
            )}
          </Field>

          <Field label="RPE target" hint="1–10.">
            {(p) => (
              <Input
                {...p}
                type="number"
                min="1"
                max="10"
                value={form.rpeTarget}
                onChange={update("rpeTarget")}
              />
            )}
          </Field>

          <Field label="HR zone" hint="1–5.">
            {(p) => (
              <Input
                {...p}
                type="number"
                min="1"
                max="5"
                value={form.hrZone}
                onChange={update("hrZone")}
              />
            )}
          </Field>

          <Field
            label="Purpose"
            hint="The athlete reads this. Say what the session is for."
            className="md:col-span-2"
          >
            {(p) => (
              <Textarea
                {...p}
                rows={2}
                value={form.purpose}
                onChange={update("purpose")}
                maxLength={400}
              />
            )}
          </Field>

          <Field label="Warm-up" className="md:col-span-2">
            {(p) => (
              <Textarea
                {...p}
                rows={2}
                value={form.warmUp}
                onChange={update("warmUp")}
                maxLength={600}
              />
            )}
          </Field>

          <Field label="Main set" className="md:col-span-2">
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                value={form.mainSet}
                onChange={update("mainSet")}
                maxLength={1200}
              />
            )}
          </Field>

          <Field label="Cool-down" className="md:col-span-2">
            {(p) => (
              <Textarea
                {...p}
                rows={2}
                value={form.coolDown}
                onChange={update("coolDown")}
                maxLength={600}
              />
            )}
          </Field>

          <Field
            label="Coach notes"
            hint="Private to you. Never shown to the athlete."
            className="md:col-span-2"
          >
            {(p) => (
              <Textarea
                {...p}
                rows={2}
                value={form.coachNotes}
                onChange={update("coachNotes")}
                maxLength={1000}
              />
            )}
          </Field>

          <Field label="Tags" hint="Comma separated.">
            {(p) => (
              <Input
                {...p}
                value={form.tags}
                onChange={update("tags")}
                placeholder="threshold, marathon"
              />
            )}
          </Field>

          <Field
            label="Visibility"
            hint="Shared means other coaches can use it. Only you can edit it."
          >
            {(p) => (
              <Select
                {...p}
                value={form.visibility}
                onChange={update("visibility")}
              >
                <option value="private">Private to me</option>
                <option value="shared">Shared with coaches</option>
              </Select>
            )}
          </Field>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-5 text-[13px] leading-relaxed text-status-missed"
          >
            {error}
          </p>
        )}

        <div className="mt-7 flex items-center gap-3 border-t border-hairline pt-5">
          <Button type="submit" disabled={pending}>
            {pending
              ? "Saving…"
              : template
                ? "Save changes"
                : "Save to library"}
          </Button>
          <Button
            type="button"
            variant="quiet"
            onClick={onDone}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </Panel>
    </form>
  );
}
