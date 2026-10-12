import React, { useMemo, useRef } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { ScheduledPeriod } from '../types';
import { COLOR_NAMES, NAMED_COLORS, formatDay, keepIds, parseDay } from '../schedule';

// One day's periods as text
interface ScheduleTextProps {
  periods: ScheduledPeriod[];
  onChange: (periods: ScheduledPeriod[]) => void;
  // Edited text that hasn't been applied, or null to show the day as it is
  draft: string | null;
  onDraftChange: (draft: string | null) => void;
  themeColor: string;
}

function HelpSection({ heading, children, example }: { heading: string; children: React.ReactNode; example?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-bold text-black">{heading}</div>
      <div className="text-xs opacity-70">{children}</div>
      {example && <pre className="font-mono text-xs bg-gray-50 px-2 py-1 overflow-x-auto">{example}</pre>}
    </div>
  );
}

export function ScheduleText({ periods, onChange, draft, onDraftChange, themeColor }: ScheduleTextProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const current = useMemo(() => formatDay(periods), [periods]);
  const text = draft ?? current;
  const result = useMemo(() => parseDay(text), [text]);

  const lines = text.split('\n');
  const problems = 'errors' in result ? result.errors : [];
  const errorLines = new Set(problems.map(error => error.line));

  const apply = () => {
    if (!('periods' in result) || draft === null) return;
    onChange(keepIds(result.periods, periods));
    onDraftChange(null);
  };

  const goToLine = (line: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = lines.slice(0, line - 1).reduce((sum, l) => sum + l.length + 1, 0);
    textarea.focus();
    textarea.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 24;
    textarea.scrollTop = Math.max(0, (line - 3) * lineHeight);
  };

  const ok = problems.length === 0;
  let status: string;
  if (draft === null) status = ok ? 'Up to date' : 'This day has problems';
  else status = ok ? 'Ready to apply' : `Fix ${errorLines.size === 1 ? 'this line' : 'these lines'} to apply`;

  return (
    <div className="flex flex-1 min-h-0 bg-white font-sans text-sm">
      {/* Editor, with line numbers to match the error list */}
      <div className="flex-1 flex min-w-0 min-h-0 border-r-2" style={{ borderColor: `${themeColor}40` }}>
        <div
          ref={gutterRef}
          className="shrink-0 overflow-hidden pt-3 pb-8 pl-3 pr-2 text-right font-mono text-xs leading-6 select-none bg-gray-50/50"
          aria-hidden
        >
          {lines.map((_, i) => (
            <div key={i} style={errorLines.has(i + 1) ? { color: '#ef4444', fontWeight: 700 } : { color: themeColor, opacity: 0.6 }}>
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => onDraftChange(e.target.value === current ? null : e.target.value)}
          onScroll={e => {
            if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
          }}
          spellCheck={false}
          wrap="off"
          className="flex-1 min-w-0 resize-none outline-none py-3 px-3 font-mono text-xs leading-6 whitespace-pre overflow-auto"
          placeholder={'Nothing scheduled. Add periods like:\n\nWin, 8:00 - 8:45\n- Getting Started, 5 min\n- Work Time'}
          aria-label="Schedule text"
        />
      </div>

      {/* Apply, problems and how to write it */}
      <div className="w-80 shrink-0 flex flex-col min-h-0 overflow-y-auto p-4 gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={apply}
            disabled={draft === null || !ok}
            className="flex items-center gap-2 uppercase font-bold text-xs px-4 py-2 border-2 shadow-[2px_2px_0_rgba(0,0,0,0.1)] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: themeColor, backgroundColor: themeColor, color: 'white' }}
          >
            <Check size={14} /> Apply
          </button>
          <button
            onClick={() => onDraftChange(null)}
            disabled={draft === null}
            className="flex items-center gap-2 uppercase font-bold text-xs px-4 py-2 border-2 hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: themeColor, color: themeColor }}
            title="Throw away the changes to the text"
          >
            <RotateCcw size={14} /> Revert
          </button>
        </div>

        <div className="text-xs font-bold uppercase tracking-wider" style={{ color: ok ? themeColor : '#ef4444' }}>
          {status}
        </div>

        {!ok && (
          <div className="flex flex-col gap-1">
            {problems.map((error, i) => (
              <button
                key={i}
                onClick={() => goToLine(error.line)}
                className="text-left text-xs p-2 border-l-4 bg-red-50 hover:bg-red-100"
                style={{ borderColor: '#ef4444' }}
              >
                <span className="font-bold">Line {error.line}:</span> {error.message}
              </button>
            ))}
          </div>
        )}

        <details className="flex flex-col gap-3 border-t-2 pt-3" style={{ borderColor: `${themeColor}40` }} open>
          <summary className="text-xs font-bold uppercase tracking-wider cursor-pointer mb-3" style={{ color: themeColor }}>
            How to write it
          </summary>
          <div className="flex flex-col gap-3">
            <HelpSection heading="Periods" example={'Win, 8:00 - 8:45, pink\nMath, 8:50 - 9:35'}>
              One per line, with its times and a color if you like. Leave the text empty for nothing scheduled this day.
            </HelpSection>
            <HelpSection heading="Timers" example={'Win, 8:00 - 8:45\n- Getting Started, 5 min, yellow\n- Work Time\n- Finishing Up, 5 min'}>
              Under their period, each starting with a dash. They have to add up to the period's length. One timer can leave out its time to fill the rest.
            </HelpSection>
            <HelpSection heading="Colors">
              <span className="flex flex-wrap gap-x-2 gap-y-1 mt-1">
                {COLOR_NAMES.map(name => (
                  <span key={name} className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 inline-block" style={{ backgroundColor: NAMED_COLORS.get(name) }} />
                    {name}
                  </span>
                ))}
                <span>or a code like #ff8da1</span>
              </span>
            </HelpSection>
          </div>
        </details>
      </div>
    </div>
  );
}
