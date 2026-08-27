'use client';

import { useState, useTransition } from 'react';
import { saveNotificationPreferences } from '@/app/actions/notifications';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Select } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import type { ChannelName, NotificationPreferences } from '@/lib/domain/notifications';

/**
 * How a coach wants to be told.
 *
 * Two rules run through this screen. Every switch is real — nothing here
 * records a preference the product will not honour. And a channel this
 * deployment cannot actually send on is shown as unavailable rather than
 * offered and quietly ignored, because a coach who thinks email is on and is
 * not watching Iron Miles has been told nothing at all.
 */

const HOURS = Array.from({ length: 24 }, (_, h) => h);

const label = (h: number) =>
  h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;

/** The timezones this product actually has coaches in, plus a neutral one. */
const ZONES = [
  'Europe/Dublin', 'Europe/London', 'Europe/Madrid', 'Europe/Lisbon',
  'America/New_York', 'Australia/Sydney', 'UTC',
];

const CHANNEL_LABEL: Record<ChannelName, string> = {
  in_app: 'In Iron Miles',
  email: 'Email',
};

export function NotificationSettings({
  preferences,
  available,
}: {
  preferences: NotificationPreferences;
  available: ChannelName[];
}) {
  const [form, setForm] = useState({
    digestEnabled: preferences.digestEnabled,
    digestHour: preferences.digestHour,
    timezone: preferences.timezone,
    alertFlaggedCheckIn: preferences.alertFlaggedCheckIn,
    alertReportedPain: preferences.alertReportedPain,
    quietHours: preferences.quietFrom !== null && preferences.quietUntil !== null,
    quietFrom: preferences.quietFrom ?? 22,
    quietUntil: preferences.quietUntil ?? 7,
    channels: preferences.channels as string[],
  });
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(null);
  };

  const toggleChannel = (channel: ChannelName, on: boolean) =>
    set('channels', on
      ? [...new Set([...form.channels, channel])]
      : form.channels.filter((c) => c !== channel));

  const save = () =>
    startTransition(async () => {
      const result = await saveNotificationPreferences(form);
      setSaved(result.message);
    });

  const zones = ZONES.includes(form.timezone) ? ZONES : [form.timezone, ...ZONES];

  return (
    <div className="space-y-4">
      <Panel className="p-6">
        <h2 className="im-display text-[17px]">The morning digest</h2>
        <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-ink-secondary">
          One summary a day, at your hour, in your timezone. If nothing needs
          you, nothing is sent — a digest that arrives every morning saying
          &ldquo;all fine&rdquo; is one you stop opening before the week it matters.
        </p>

        <div className="mt-5 space-y-5">
          <Checkbox
            label="Send me a daily digest"
            checked={form.digestEnabled}
            onChange={(e) => set('digestEnabled', e.target.checked)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Send it at">
              {(props) => (
                <Select
                  {...props}
                  value={form.digestHour}
                  disabled={!form.digestEnabled}
                  onChange={(e) => set('digestHour', Number(e.target.value))}
                >
                  {HOURS.map((h) => <option key={h} value={h}>{label(h)}</option>)}
                </Select>
              )}
            </Field>

            <Field label="Your timezone" hint="Clocks changing will not move your digest.">
              {(props) => (
                <Select
                  {...props}
                  value={form.timezone}
                  onChange={(e) => set('timezone', e.target.value)}
                >
                  {zones.map((z) => <option key={z} value={z}>{z.replace('_', ' ')}</option>)}
                </Select>
              )}
            </Field>
          </div>
        </div>
      </Panel>

      <Panel className="p-6">
        <h2 className="im-display text-[17px]">Interrupt me for</h2>
        <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-ink-secondary">
          Two things only. Everything else — missed sessions, programmes ending,
          unread messages — waits for the digest. A coach who gets twenty urgent
          alerts a day stops reading them, and then the one that mattered is
          lost with the rest.
        </p>

        <div className="mt-5 space-y-4">
          <Checkbox
            label="A check-in flagged for review"
            description="The athlete's answers crossed the check-in's own thresholds."
            checked={form.alertFlaggedCheckIn}
            onChange={(e) => set('alertFlaggedCheckIn', e.target.checked)}
          />
          <Checkbox
            label="An athlete reporting pain or a niggle"
            description="Sent when they score their soreness high. Their words reach you exactly as written — Iron Miles does not interpret them."
            checked={form.alertReportedPain}
            onChange={(e) => set('alertReportedPain', e.target.checked)}
          />
        </div>
      </Panel>

      <Panel className="p-6">
        <h2 className="im-display text-[17px]">Quiet hours</h2>
        <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-ink-secondary">
          Nothing is dropped. An alert raised during quiet hours is written
          straight away — you will see it if you open Iron Miles — and delivered
          when quiet hours end.
        </p>

        <div className="mt-5 space-y-5">
          <Checkbox
            label="Hold notifications overnight"
            checked={form.quietHours}
            onChange={(e) => set('quietHours', e.target.checked)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From">
              {(props) => (
                <Select
                  {...props}
                  value={form.quietFrom}
                  disabled={!form.quietHours}
                  onChange={(e) => set('quietFrom', Number(e.target.value))}
                >
                  {HOURS.map((h) => <option key={h} value={h}>{label(h)}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Until">
              {(props) => (
                <Select
                  {...props}
                  value={form.quietUntil}
                  disabled={!form.quietHours}
                  onChange={(e) => set('quietUntil', Number(e.target.value))}
                >
                  {HOURS.map((h) => <option key={h} value={h}>{label(h)}</option>)}
                </Select>
              )}
            </Field>
          </div>
        </div>
      </Panel>

      <Panel className="p-6">
        <h2 className="im-display text-[17px]">Where</h2>
        <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-ink-secondary">
          Only channels this deployment can actually send on are offered. If a
          channel is not set up, it is shown here as unavailable rather than
          switched on and quietly ignored.
        </p>

        <div className="mt-5 space-y-4">
          {(['in_app', 'email'] as ChannelName[]).map((channel) => {
            const usable = available.includes(channel);
            return (
              <div key={channel} className="flex flex-wrap items-center gap-3">
                <Checkbox
                  label={CHANNEL_LABEL[channel]}
                  checked={usable && form.channels.includes(channel)}
                  disabled={!usable || channel === 'in_app'}
                  onChange={(e) => toggleChannel(channel, e.target.checked)}
                />
                {channel === 'in_app' && <Badge tone="green">Always on</Badge>}
                {!usable && <Badge tone="warn">Not set up on this deployment</Badge>}
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={save} disabled={pending}>
          {pending ? 'Saving…' : 'Save preferences'}
        </Button>
        {saved && (
          <p role="status" className="text-[13px] text-mint">{saved}</p>
        )}
      </div>
    </div>
  );
}
