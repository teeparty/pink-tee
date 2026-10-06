import React, { useState } from 'react';
import { Period, Segment } from '../types';
import { Star } from 'lucide-react';
import catVideo from '../assets/catlong.mp4';

interface VisualTimerProps {
  currentPeriod: Period | null;
  activeSegment: Segment | null;
  nextPeriod: Period | null;
  timeRemainingMs: number;
  totalDurationMs: number;
  periodRemainingMs?: number;
  periodTotalMs?: number;
  themeColor: string;
}

export function VisualTimer({ 
  currentPeriod, 
  activeSegment,
  nextPeriod, 
  timeRemainingMs, 
  totalDurationMs, 
  periodRemainingMs,
  periodTotalMs,
  themeColor 
}: VisualTimerProps) {
  const [ringThickness, setRingThickness] = useState(150);
  const [textScale, setTextScale] = useState(1.0);

  if (!currentPeriod || totalDurationMs <= 0 || !periodTotalMs) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full w-full opacity-50 uppercase tracking-widest text-lg font-bold">
        WAITING FOR BASE START TIME
      </div>
    );
  }

  // Format time remaining
  const totalSeconds = Math.floor(timeRemainingMs / 1000);
  const minutes = Math.floor(Math.abs(totalSeconds) / 60);
  const seconds = Math.abs(totalSeconds) % 60;
  const formattedTime = `${totalSeconds < 0 ? '-' : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  const isSegmentActive = activeSegment !== null;
  const mainTitle = isSegmentActive ? activeSegment.name : currentPeriod.name;
  const subTitle = isSegmentActive ? `PART OF ${currentPeriod.name.toUpperCase()}` : (currentPeriod.type === 'transition' ? 'PASSING' : 'CURRENT PERIOD');

  const activeColor = activeSegment?.color || currentPeriod?.color || themeColor;
  const periodColor = currentPeriod?.color || themeColor;

  const hasSegment = isSegmentActive;

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

  // Single Ring
  const ringRadius = 400;
  const ringStroke = ringThickness;
  const circumference = ringRadius * 2 * Math.PI;
  const gapRatio = currentPeriod.segments && currentPeriod.segments.length > 1 ? 0.005 : 0;

  // Calculate strict safe box size using Math.sqrt(2) to fit perfectly in inner circle
  const innerRadius = ringRadius - (ringThickness / 2);
  const maxBoxSize = Math.max(0, innerRadius * 1.414 - 10); // slightly smaller for safety

  // Star boundaries
  const outerLeftEdge = CENTER - ringRadius - (ringThickness / 2);
  const innerRightEdge = CENTER + ringRadius - (ringThickness / 2);

  return (
    <div className="flex-1 flex w-full h-full relative items-center justify-center p-4 timer-drag-handle cursor-move">
      <svg viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`} className="w-full h-full drop-shadow-md overflow-visible pointer-events-none">
            
         {/* Rings Group: Rotated -90deg so it starts at 12 o'clock */}
         <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
             {/* Ring Logic */}
             {(() => {
               if (currentPeriod.segments && currentPeriod.segments.length > 0) {
                 const numSegments = currentPeriod.segments.length;
                 // Size each arc by its share of the period's total duration
                 const segDurations = currentPeriod.segments.map(s => Math.max(0, s.durationMinutes || 0));
                 const totalSegMinutes = segDurations.reduce((sum, d) => sum + d, 0);
                 let elapsedSegMinutes = 0;

                 return currentPeriod.segments.map((seg, i) => {
                   let startRatio = i / numSegments;
                   let endRatio = (i + 1) / numSegments;
                   if (totalSegMinutes > 0) {
                     startRatio = elapsedSegMinutes / totalSegMinutes;
                     elapsedSegMinutes += segDurations[i];
                     endRatio = elapsedSegMinutes / totalSegMinutes;
                   }
                   const segColor = seg.color || periodColor;

                   const bgLengthRatio = Math.max(0, (endRatio - startRatio) - gapRatio);
                   
                   let isPast = false;
                   let isFuture = false;
                   let isActive = false;
                   let activeRatio = 0;

                   if (isSegmentActive && activeSegment?.id === seg.id) {
                     isActive = true;
                     activeRatio = totalDurationMs > 0 ? 1 - (timeRemainingMs / totalDurationMs) : 0;
                   } else {
                     const activeIdx = currentPeriod.segments.findIndex(s => s.id === activeSegment?.id);
                     if (activeIdx !== -1) {
                       if (i < activeIdx) isPast = true;
                       if (i > activeIdx) isFuture = true;
                     } else {
                       isFuture = true;
                     }
                   }

                   let fgStartRatio = startRatio;
                   let fgLengthRatio = 0;

                   if (isFuture) {
                     fgLengthRatio = bgLengthRatio;
                   } else if (isPast) {
                     fgLengthRatio = 0;
                   } else if (isActive) {
                     fgStartRatio = startRatio + (activeRatio * bgLengthRatio);
                     fgLengthRatio = bgLengthRatio * (1 - activeRatio);
                   }

                   return (
                     <g key={seg.id}>
                        {/* Background segment */}
                        {bgLengthRatio > 0 && (
                          <circle 
                            cx={CENTER} cy={CENTER} r={ringRadius} 
                            stroke={segColor} strokeWidth={ringStroke} fill="none" strokeOpacity={0.15}
                            strokeDasharray={`${Math.max(0, bgLengthRatio * circumference)} ${circumference}`}
                            strokeDashoffset={-(startRatio * circumference)}
                            className="transition-all duration-1000 ease-linear"
                            strokeLinecap="butt"
                          />
                        )}
                        {/* Foreground segment */}
                        {fgLengthRatio > 0 && (
                          <circle 
                            cx={CENTER} cy={CENTER} r={ringRadius} 
                            stroke={segColor} strokeWidth={ringStroke} fill="none"
                            strokeDasharray={`${Math.max(0, fgLengthRatio * circumference)} ${circumference}`}
                            strokeDashoffset={-(fgStartRatio * circumference)}
                            className="transition-all duration-1000 ease-linear drop-shadow-sm"
                            strokeLinecap="butt"
                          />
                        )}
                     </g>
                   );
                 });
               } else {
                 // Single solid ring
                 const globalRatio = periodTotalMs && periodTotalMs > 0 ? Math.max(0, Math.min(1, 1 - (periodRemainingMs / periodTotalMs))) : 0;
                 const fgLengthRatio = 1 - globalRatio;
                 
                 return (
                   <g>
                     <circle cx={CENTER} cy={CENTER} r={ringRadius} stroke={periodColor} strokeWidth={ringStroke} fill="none" strokeOpacity={0.15} />
                     {fgLengthRatio > 0 && (
                       <circle 
                         cx={CENTER} cy={CENTER} r={ringRadius} 
                         stroke={periodColor} strokeWidth={ringStroke} fill="none" 
                         strokeDasharray={`${Math.max(0, fgLengthRatio * circumference)} ${circumference}`} 
                         strokeDashoffset={-(globalRatio * circumference)}
                         className="transition-all duration-1000 ease-linear drop-shadow-sm" 
                         strokeLinecap="butt"
                       />
                     )}
                   </g>
                 );
               }
             })()}
         </g>

         {/* Embedded HTML Text perfectly centered within the ring. */}
         <foreignObject x={CENTER - maxBoxSize / 2} y={CENTER - maxBoxSize / 2} width={maxBoxSize} height={maxBoxSize}>
           <div className="flex flex-col items-center justify-center text-center w-full h-full p-0 pointer-events-none overflow-hidden">
              <div className="font-bold tracking-widest opacity-80 uppercase font-mono mb-4" style={{ color: activeColor, fontSize: `${maxBoxSize * 0.045 * textScale}px` }}>
                {subTitle}
              </div>
              <div className="leading-[1.1] font-bold max-w-full truncate px-4 font-mono drop-shadow-sm" style={{ color: activeColor, fontSize: `${maxBoxSize * 0.125 * textScale}px` }}>
                {mainTitle}
              </div>
              
              <div 
                className="font-pixel tracking-widest drop-shadow-md mt-6" 
                style={{ color: activeColor, fontSize: `${maxBoxSize * 0.23 * textScale}px` }}
              >
                {formattedTime}
              </div>
              
              {nextPeriod && (
                <div className="mt-12 text-center tracking-widest uppercase w-full font-bold opacity-80" style={{ color: activeColor, fontSize: `${maxBoxSize * 0.045 * textScale}px` }}>
                  UPNEXT: <span className="opacity-90">{nextPeriod.name}</span>
                </div>
              )}
           </div>
         </foreignObject>

         {/* Left Outer Star (Ring Thickness Control) */}
         <foreignObject x={outerLeftEdge - 50} y={CENTER - 80} width="100" height="160" className="pointer-events-auto overflow-visible cancel">
            <div className="flex flex-col items-center justify-start group w-full h-full pt-4">
              <Star
                className="text-black/10 group-hover:text-black/60 cursor-pointer drop-shadow-sm transition-all hover:scale-110 cancel"
                fill="currentColor"
                size={32}
              />
              <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 rounded border border-gray-200 p-2 shadow-lg pointer-events-auto cancel">
                <input
                  type="range" min={40} max={250} value={ringThickness}
                  onChange={(e) => setRingThickness(Number(e.target.value))}
                  className="w-24 cursor-pointer cancel"
                  onPointerDown={(e) => e.stopPropagation()} 
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
         </foreignObject>

         {/* Right Inner Star Mirror (Text Scale Control) */}
         <foreignObject x={innerRightEdge - 50} y={CENTER - 80} width="100" height="160" className="pointer-events-auto overflow-visible cancel">
            <div className="flex flex-col items-center justify-start group w-full h-full pt-4">
              <Star
                className="text-black/10 group-hover:text-black/60 cursor-pointer drop-shadow-sm transition-all hover:scale-110 cancel"
                fill="currentColor"
                size={32}
              />
              <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 rounded border border-gray-200 p-2 shadow-lg pointer-events-auto cancel">
                <input
                  type="range" min={0.5} max={3.0} step={0.1} value={textScale}
                  onChange={(e) => setTextScale(Number(e.target.value))}
                  className="w-24 cursor-pointer cancel"
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
         </foreignObject>

      </svg>
    </div>
  );
}
