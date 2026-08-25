'use client';

import { useState, useTransition } from 'react';
import {
  deleteMyAccount,
  exportMyData,
  updatePreferences,
  updatePrivacy,
  type Result,
} from '@/app/actions/profile';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, Segmented, Select } from '@/components/ui/Field';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import type { Profile } from '@/lib/domain/types';

export function ProfileSettings({ profile }: { profile: Profile }) {
  const [units, setUnits] = useState(profile.units);
  const [saved, setSaved] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  return (
    <Panel className="p-6 sm:p-8">
      <PanelHeader label="Your details" />
      <form
        action={(fd) => {
          fd.set('units', units);
          start(async () => setSaved(await updatePreferences(fd)));
        }}
        className="mt-7 space-y-6"
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Full name">
            {(p) => <Input name="fullName" defaultValue={profile.fullName} {...p} />}
          </Field>
          <Field label="Location">
            {(p) => <Input name="location" defaultValue={profile.location ?? ''} {...p} />}
          </Field>
        </div>
        <Field label="Timezone">
          {(p) => (
            <Select name="timezone" defaultValue={profile.timezone} {...p}>
              {['Europe/Dublin', 'Europe/London', 'Europe/Madrid', 'America/New_York', 'Australia/Sydney'].map(
                (tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace('_', ' ')}
                  </option>
                ),
              )}
            </Select>
          )}
        </Field>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Units</p>
          <Segmented
            className="mt-2.5"
            ariaLabel="Units"
            value={units}
            onChange={setUnits}
            options={[
              { value: 'metric', label: 'Kilometres' },
              { value: 'imperial', label: 'Miles' },
            ]}
          />
        </div>

        {saved && (
          <p role="status" className={`text-[12px] font-bold ${saved.ok ? 'text-green' : 'text-alert'}`}>
            {saved.message}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save details'}
        </Button>
      </form>
    </Panel>
  );
}

export function PrivacyControls({ profile }: { profile: Profile }) {
  const [leaderboard, setLeaderboard] = useState(profile.leaderboardOptIn);
  const [forge, setForge] = useState(profile.forgeAssistantEnabled);
  const [, start] = useTransition();

  function push(nextLeaderboard: boolean, nextForge: boolean) {
    setLeaderboard(nextLeaderboard);
    setForge(nextForge);
    start(() => void updatePrivacy(nextLeaderboard, nextForge));
  }

  return (
    <Panel className="p-6 sm:p-8">
      <PanelHeader label="Privacy and visibility" />
      <div className="mt-7 space-y-6">
        <Checkbox
          label="Show me on the Iron Miles leaderboard"
          description="Off by default. Only your display name and Forge Score are ever visible to other athletes — never your sessions, paces, or check-ins."
          checked={leaderboard}
          onChange={(e) => push(e.target.checked, forge)}
        />
        <Checkbox
          label="Enable FORGE, the training assistant"
          description="Short contextual messages about today's session and your week. Your coach can also disable this for you."
          checked={forge}
          onChange={(e) => push(leaderboard, e.target.checked)}
        />
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <p className="im-micro">Who can see your data</p>
        <ul className="mt-4 space-y-2.5 text-[13px] leading-relaxed text-muted">
          <li>You — everything.</li>
          <li>Your coach — training and check-in data, so the coaching can work.</li>
          <li>Other athletes — nothing, unless you opt in above, and then only name and score.</li>
        </ul>
        <p className="mt-4 text-[11px] leading-relaxed text-muted-2">
          Enforced by row-level security in the database, not only in this application.
        </p>
      </div>
    </Panel>
  );
}

export function DataControls({ email }: { email: string }) {
  const [json, setJson] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const [danger, setDanger] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  return (
    <Panel className="p-6 sm:p-8">
      <PanelHeader label="Your data" />

      <div className="mt-7">
        <p className="text-[14px] leading-relaxed text-muted">
          Export everything Iron Miles holds about you — profile, programme, every logged session,
          every check-in, your Forge ledger and your messages — as a single JSON document.
        </p>
        <Button
          variant="ghost"
          className="mt-5"
          disabled={pending}
          onClick={() => start(async () => setJson((await exportMyData()).json))}
        >
          {pending && !danger ? 'Preparing…' : 'Export my data'}
        </Button>

        {json && (
          <div className="mt-5">
            <p className="im-micro">Your export</p>
            <textarea
              readOnly
              value={json}
              rows={10}
              aria-label="Exported data"
              className="im-scroll mt-2.5 w-full rounded-xs border border-line-2 bg-iron-2 p-4 font-mono text-[11px] leading-relaxed text-muted"
            />
            <p className="mt-2 text-[11px] text-muted-2">
              Select all and copy, or save it from here. Nothing leaves your browser.
            </p>
          </div>
        )}
      </div>

      <div className="mt-9 border-t border-line pt-7">
        <p className="im-micro text-alert">Delete account</p>
        <p className="mt-3 max-w-[58ch] text-[13px] leading-relaxed text-muted">
          Permanently erases your profile, programme, training history, check-ins and messages. This
          cannot be undone, and your coach cannot restore it.
        </p>

        {!danger ? (
          <Button variant="danger" className="mt-5" onClick={() => setDanger(true)}>
            Delete my account
          </Button>
        ) : (
          <div className="mt-5 space-y-4">
            <Field label={`Type ${email} to confirm`}>
              {(p) => (
                <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" {...p} />
              )}
            </Field>
            {result && (
              <p role="alert" className={`text-[12px] font-bold ${result.ok ? 'text-green' : 'text-alert'}`}>
                {result.message}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="danger"
                disabled={pending}
                onClick={() => start(async () => setResult(await deleteMyAccount(confirm)))}
              >
                {pending ? 'Deleting…' : 'Permanently delete'}
              </Button>
              <Button variant="quiet" onClick={() => setDanger(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
