import { Panel } from '@/components/ui/Panel';
import { Dot } from '@/components/ui/Badge';
import type { ForgeMessage } from '@/lib/forge/assistant';

export function ForgeMessageCard({ message }: { message: ForgeMessage | null }) {
  if (!message) return null;

  const urgent = message.severity === 'urgent';

  return (
    <Panel
      className={`p-6 ${urgent ? 'border-alert/45 bg-alert/6' : ''}`}
      edge={!urgent}
    >
      <div className="flex items-center gap-2">
        <Dot tone={urgent ? 'alert' : 'green'} />
        <span className={`im-micro ${urgent ? 'text-alert' : 'text-green'}`}>
          {urgent ? 'Stop and read this' : 'FORGE'}
        </span>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed text-white">{message.body}</p>
      {!urgent && (
        <p className="mt-4 text-[11px] text-muted-2">
          FORGE reflects your logged training. It is an assistant, not your coach.
        </p>
      )}
    </Panel>
  );
}
