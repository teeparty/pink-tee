import React from 'react';
import { ClockSettings, Period, Segment } from '../types';
import catVideo from '../assets/catlong.mp4';
import { formatCountdown } from '../utils';
import { ClockMenu } from './ClockMenu';

const HOUR_MS = 60 * 60 * 1000;
// Gap between adjacent segments, as a fraction of the dial
const SEGMENT_GAP = 0.005;
const HAND_COLOR = '#333333';
// Ring labels use Space Mono, which is monospaced with a 0.612em advance
const LABEL_CHAR_WIDTH_EM = 0.62;

// White or the hand color, whichever contrasts better against a #rrggbb background
function readableTextColor(background: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(background);
  if (!match) return HAND_COLOR;
  const rgb = parseInt(match[1], 16);
  const luminance = [rgb >> 16, (rgb >> 8) & 255, rgb & 255]
    .map(c => c / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const handLuminance = 0.0331;
  return 1.05 / (luminance + 0.05) > (luminance + 0.05) / (handLuminance + 0.05) ? '#ffffff' : HAND_COLOR;
}

interface VisualTimerProps {
  currentPeriod: Period | null;
  activeSegment: Segment | null;
  nextPeriod: Period | null;
  now: Date;
  timeRemainingMs: number;
  totalDurationMs: number;
  periodRemainingMs?: number;
  periodTotalMs?: number;
  themeColor: string;
  clock: ClockSettings;
  onClockChange: (partial: Partial<ClockSettings>) => void;
}

export function VisualTimer({ 
  currentPeriod, 
  activeSegment,
  nextPeriod,
  now,
  timeRemainingMs,
  totalDurationMs, 
  periodRemainingMs,
  periodTotalMs,
  themeColor,
  clock,
  onClockChange
}: VisualTimerProps) {
  if (!currentPeriod || totalDurationMs <= 0 || !periodTotalMs) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full w-full opacity-50 uppercase tracking-widest text-lg font-bold">
        WAITING FOR BASE START TIME
      </div>
    );
  }

  const formattedTime = formatCountdown(timeRemainingMs);

  const activeColor = activeSegment?.color || currentPeriod?.color || themeColor;
  const periodColor = currentPeriod?.color || themeColor;

  // Render variables for crisp concentric rings without overlaps
  const VIEWBOX_SIZE = 1000;
  const CENTER = VIEWBOX_SIZE / 2;

  if (currentPeriod.type === 'transition') {
    const globalRatio = periodTotalMs && periodTotalMs > 0 ? Math.max(0, Math.min(1, 1 - (periodRemainingMs / periodTotalMs))) : 0;
    
    return (
      <div className="flex-1 flex w-full h-full relative items-center justify-center p-8 timer-drag-handle cursor-move">
        <div className="flex flex-col items-center justify-center w-full max-w-4xl gap-8">
          <div 
             className="font-pixel tracking-widest drop-shadow-md text-6xl sm:text-8xl md:text-9xl mb-4" 
             style={{ color: activeColor }}
          >
            {formattedTime}
          </div>
          
          {/* We assume the user attached the generated animation to be play as cat.mp4 in the future, 
              or if the provided attachment is available it would be passed, here we 
              add an img or video tag placeholder since we don't know the exact file path. 
              We'll use a video tag assuming it's an mp4. */}
          <div className="flex items-center justify-center h-48 sm:h-64 mb-4">
             <video 
               src={catVideo}
               autoPlay 
               loop 
               muted 
               playsInline
               style={{
                 maxWidth: '100%',
                 maxHeight: '100%',
                 objectFit: 'contain'
               }}
               onError={(e) => {
                 // if video fails, try image just in case
                 (e.target as HTMLVideoElement).outerHTML = '<img src="/catlong.gif" style="max-width: 100%; max-height: 100%; object-fit: contain;" />';
               }}
             />
          </div>

          <div className="w-full bg-black/10 rounded-full h-8 overflow-hidden relative shadow-inner">
            <div 
              className="absolute top-0 left-0 bottom-0 transition-all duration-1000 ease-linear rounded-full shadow-md"
              style={{ 
                backgroundColor: activeColor,
                width: `${(1 - globalRatio) * 100}%` 
              }}
            />
          </div>
          
          <div className="flex justify-between w-full font-bold tracking-widest uppercase opacity-80 mt-2 font-mono text-xl" style={{ color: activeColor }}>
            <span>{currentPeriod.name}</span>
            {nextPeriod && (<span>UP NEXT: {nextPeriod.name}</span>)}
          </div>
        </div>
      </div>
    );
  }

  // Clock face: the ring is a 60-minute dial swept by the minute hand
  const ringRadius = 400;
  const ringStroke = clock.ringThickness;
  const innerRadius = ringRadius - (ringStroke / 2);
  // Segments are dashes along a stroked circle. In pie mode the stroke runs from the center to
  // the ring's outer edge, so the same dashes become wedges.
  const isPie = clock.style === 'pie';
  const fillRadius = isPie ? (ringRadius + ringStroke / 2) / 2 : ringRadius;
  const fillStroke = isPie ? ringRadius + ringStroke / 2 : ringStroke;
  const circumference = fillRadius * 2 * Math.PI;
  const tickOuterRadius = innerRadius - 12;
  const numeralFontSize = tickOuterRadius * 0.17;
  // Just inside the hour ticks, which are 40 long
  const numeralRadius = tickOuterRadius - 58 - numeralFontSize * 0.45;
  const labelFontSize = Math.min(ringStroke * 0.3 * clock.labelScale, ringStroke * 0.8);

  // Map a wall-clock time to a dial position (in turns from 12 o'clock), relative to the minute hand
  const nowMs = now.getTime();
  const nowDial = (now.getMinutes() * 60000 + now.getSeconds() * 1000 + now.getMilliseconds()) / HOUR_MS;
  const toDial = (t: number) => nowDial + (t - nowMs) / HOUR_MS;

  const hourAngle = ((now.getHours() % 12) + nowDial) * 30;
  const minuteAngle = nowDial * 360;
  const secondAngle = now.getSeconds() * 6;

  // Lay each segment out at its actual clock time. The dial holds one hour: time left
  // runs ahead of the minute hand, and elapsed time fills whatever dial is left behind it.
  const periodEndMs = nowMs + periodRemainingMs;
  const periodStartMs = periodEndMs - periodTotalMs;
  const aheadEndMs = Math.min(periodEndMs, nowMs + HOUR_MS);
  const behindStartMs = aheadEndMs - HOUR_MS;

  const segments = currentPeriod.segments && currentPeriod.segments.length > 0
    ? currentPeriod.segments
    : [{ id: currentPeriod.id, name: currentPeriod.name, durationMinutes: periodTotalMs / 60000, color: currentPeriod.color }];

  type Arc = { key: string; color: string; start: number; length: number; elapsed: boolean; label?: string };

  // Where a label runs along an arc, and how many characters fit with half an em of padding at each end
  const labelLayout = (arc: Arc) => {
    const mid = arc.start + arc.length / 2;
    const midTurn = mid - Math.floor(mid);
    // Run labels on the bottom half counterclockwise so they read left to right, not upside down
    const flip = midTurn > 0.25 && midTurn < 0.75;
    // Text sits on its baseline, so shift it by half the cap height to center it in the ring
    const r = ringRadius + (flip ? 0.35 : -0.35) * labelFontSize;
    const maxChars = Math.floor((r * arc.length * 2 * Math.PI - labelFontSize) / (labelFontSize * LABEL_CHAR_WIDTH_EM));
    return { flip, r, maxChars };
  };

  const arcs: Arc[] = [];
  let segStartMs = periodStartMs;
  for (const seg of segments) {
    const segEndMs = segStartMs + Math.max(0, seg.durationMinutes || 0) * 60000;
    const makeArc = (fromMs: number, toMs: number, elapsed: boolean): Arc | null => {
      // Gap at every boundary except the minute hand, plus where the hour wraps back to it
      const start = toDial(fromMs) + (fromMs !== nowMs ? SEGMENT_GAP : 0);
      const end = toDial(toMs) - (toMs === nowMs + HOUR_MS ? SEGMENT_GAP : 0);
      if (end <= start) return null;
      return { key: `${seg.id}-${elapsed ? 'elapsed' : 'left'}`, color: seg.color || periodColor, start, length: end - start, elapsed };
    };
    const elapsedArc = makeArc(Math.max(segStartMs, behindStartMs), Math.min(segEndMs, nowMs), true);
    const leftArc = makeArc(Math.max(segStartMs, nowMs), Math.min(segEndMs, aheadEndMs), false);
    // Label each segment once: on the time it has left, unless more of the name fits on its elapsed time
    const fit = (arc: Arc | null) => (arc ? Math.min(labelLayout(arc).maxChars, seg.name.length) : -1);
    const labeledArc = fit(elapsedArc) > fit(leftArc) ? elapsedArc : leftArc;
    if (labeledArc) labeledArc.label = seg.name;
    arcs.push(...[elapsedArc, leftArc].filter((arc): arc is Arc => arc !== null));
    segStartMs = segEndMs;
  }

  // Curved label along an arc, centered in the ring, cut short with an ellipsis if it doesn't fit
  const renderLabel = (arc: Arc) => {
    const { flip, r, maxChars } = labelLayout(arc);
    const name = (arc.label || '').toUpperCase();
    const text = name.length <= maxChars ? name : maxChars >= 4 ? `${name.slice(0, maxChars - 1).trimEnd()}…` : '';
    if (!text) return null;

    const point = (turn: number) => `${CENTER + r * Math.sin(turn * 2 * Math.PI)} ${CENTER - r * Math.cos(turn * 2 * Math.PI)}`;
    const end = arc.start + arc.length;
    const largeArc = arc.length > 0.5 ? 1 : 0;
    const d = flip
      ? `M ${point(end)} A ${r} ${r} 0 ${largeArc} 0 ${point(arc.start)}`
      : `M ${point(arc.start)} A ${r} ${r} 0 ${largeArc} 1 ${point(end)}`;
    const pathId = `clock-label-${arc.key}`;
    return (
      <g key={pathId}>
        <path id={pathId} d={d} fill="none" />
        <text
          className="font-mono font-bold"
          fontSize={labelFontSize}
          fill={arc.elapsed ? HAND_COLOR : readableTextColor(arc.color)}
          fillOpacity={arc.elapsed ? 0.5 : 1}
        >
          <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">{text}</textPath>
        </text>
      </g>
    );
  };

  // Ticks and numerals sit on top of the wedges in pie mode, so match them to the segment underneath
  const markColorAt = (turn: number) => {
    if (!isPie) return HAND_COLOR;
    const arc = arcs.find(a => !a.elapsed && ((turn - a.start) % 1 + 1) % 1 < a.length);
    return arc ? readableTextColor(arc.color) : HAND_COLOR;
  };

  return (
    <div className="flex-1 flex w-full h-full relative items-center justify-center p-4 timer-drag-handle cursor-move">
      <ClockMenu clock={clock} onChange={onClockChange} themeColor={themeColor} />
      <svg viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`} className="w-full h-full drop-shadow-md overflow-visible pointer-events-none">
            
         {/* Rings Group: Rotated -90deg so it starts at 12 o'clock */}
         <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
             <circle cx={CENTER} cy={CENTER} r={fillRadius} stroke={periodColor} strokeWidth={fillStroke} fill="none" strokeOpacity={0.08} />
             {arcs.map(arc => (
               <circle 
                 key={arc.key}
                 cx={CENTER} cy={CENTER} r={fillRadius} 
                 stroke={arc.color} strokeWidth={fillStroke} fill="none" strokeOpacity={arc.elapsed ? 0.25 : 1}
                 // Dash pattern repeats every circumference, so an arc can wrap past 12 o'clock
                 strokeDasharray={`${arc.length * circumference} ${(1 - arc.length) * circumference}`}
                 strokeDashoffset={-(arc.start * circumference)}
                 className={arc.elapsed ? undefined : 'drop-shadow-sm'}
                 strokeLinecap="butt"
               />
             ))}
         </g>

         {/* Segment names along the ring */}
         {arcs.filter(arc => arc.label).map(renderLabel)}

         {/* Minute ticks */}
         {Array.from({ length: 60 }, (_, i) => (
           <line
             key={i}
             x1={CENTER} y1={CENTER - tickOuterRadius}
             x2={CENTER} y2={CENTER - tickOuterRadius + (i % 5 === 0 ? 40 : 16)}
             stroke={markColorAt(i / 60)} strokeOpacity={i % 5 === 0 ? 0.5 : 0.2} strokeWidth={i % 5 === 0 ? 8 : 3} strokeLinecap="round"
             transform={`rotate(${i * 6} ${CENTER} ${CENTER})`}
           />
         ))}

         {/* Hour numerals */}
         {Array.from({ length: 12 }, (_, i) => {
           const hour = i + 1;
           const angle = (hour / 12) * 2 * Math.PI;
           return (
             <text
               key={hour}
               x={CENTER + numeralRadius * Math.sin(angle)}
               y={CENTER - numeralRadius * Math.cos(angle)}
               className="font-mono font-bold"
               fontSize={numeralFontSize}
               fill={markColorAt(hour / 12)}
               fillOpacity={0.8}
               textAnchor="middle"
               dominantBaseline="central"
             >
               {hour}
             </text>
           );
         })}

         {/* Clock hands, with a white outline pass first in pie mode so they stand out from the wedges */}
         {(isPie ? [true, false] : [false]).map(outline => (
           <g key={outline ? 'outline' : 'hands'} strokeLinecap="round">
             {[
               { angle: hourAngle, tail: 30, length: tickOuterRadius * 0.55, width: 24, color: HAND_COLOR },
               { angle: minuteAngle, tail: 30, length: tickOuterRadius - 8, width: 14, color: HAND_COLOR },
               { angle: secondAngle, tail: 60, length: tickOuterRadius - 4, width: 5, color: activeColor },
             ].map((hand, i) => (
               <line
                 key={i}
                 x1={CENTER} y1={CENTER + hand.tail} x2={CENTER} y2={CENTER - hand.length}
                 stroke={outline ? '#ffffff' : hand.color} strokeWidth={hand.width + (outline ? 8 : 0)}
                 transform={`rotate(${hand.angle} ${CENTER} ${CENTER})`}
               />
             ))}
           </g>
         ))}
         {isPie && <circle cx={CENTER} cy={CENTER} r={24} fill="#ffffff" />}
         <circle cx={CENTER} cy={CENTER} r={20} fill={HAND_COLOR} />
         <circle cx={CENTER} cy={CENTER} r={9} fill={activeColor} />

      </svg>
    </div>
  );
}
