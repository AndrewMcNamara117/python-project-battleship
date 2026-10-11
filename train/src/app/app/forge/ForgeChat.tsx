'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { Dot } from '@/components/ui/Badge';
import { Field, Input } from '@/components/ui/Field';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { answerQuestion, FORGE_ANSWERS } from '@/lib/forge/answers';

interface Turn {
  id: number;
  from: 'you' | 'forge';
  body: string;
}

/**
 * Runs entirely in the browser against a fixed answer set — no request, no
 * model, no chance of an invented answer. Anything clinical is refused and
 * routed to the human coach.
 */
export function ForgeChat() {
  const [turns, setTurns] = useState<Turn[]>([
    {
      id: 0,
      from: 'forge',
      body: 'Ask me about your training, the platform, or how any of this works. Anything about pain or injury goes to your coach — I will not guess at it.',
    },
  ]);
  const [input, setInput] = useState('');
  const reduced = useReducedMotion();

  function ask(question: string) {
    const q = question.trim();
    if (!q) return;
    const { answer } = answerQuestion(q);
    setTurns((t) => [
      ...t,
      { id: t.length, from: 'you', body: q },
      { id: t.length + 1, from: 'forge', body: answer },
    ]);
    setInput('');
  }

  return (
    <Panel className="p-6 sm:p-8">
      <PanelHeader label="Ask FORGE" />

      <ol className="im-scroll mt-6 max-h-[380px] space-y-4 overflow-y-auto pr-1">
        {turns.map((t) => (
          <motion.li
            key={t.id}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={t.from === 'you' ? 'flex justify-end' : ''}
          >
            <div
              className={`max-w-[86%] rounded-xs border px-5 py-3.5 ${
                t.from === 'you' ? 'border-green/30 bg-green/8' : 'border-line-2 bg-iron-2'
              }`}
            >
              <p className="im-micro flex items-center gap-2">
                {t.from === 'forge' && <Dot />}
                {t.from === 'you' ? 'You' : 'FORGE'}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-white">{t.body}</p>
            </div>
          </motion.li>
        ))}
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="mt-6 flex flex-wrap items-end gap-3 border-t border-line pt-6"
      >
        <div className="min-w-[220px] flex-1">
          <Field label="Your question">
            {(p) => (
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="What does Zone 2 actually mean?"
                {...p}
              />
            )}
          </Field>
        </div>
        <Button type="submit">Ask</Button>
      </form>

      <div className="mt-6">
        <p className="im-micro">Things people ask</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {FORGE_ANSWERS.slice(0, 6).map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => ask(a.question)}
              className="rounded-xs border border-line-2 px-3.5 py-2 text-left text-[11px] text-muted transition-colors hover:border-green hover:text-green"
            >
              {a.question}
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}
