import React from 'react';
import { Period } from '../types';

interface SegmentSummaryProps {
  period: Period | null;
  activeSegmentId: string | null;
  themeColor: string;
  zoom?: number;
}

export function SegmentSummary({ period, activeSegmentId, themeColor, zoom = 1 }: SegmentSummaryProps) {
  if (!period) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full p-4 bg-white" style={{ color: 'black' }}>
        <div className="opacity-50 text-center uppercase tracking-widest text-sm" style={{ zoom: zoom }}>
          WAITING FOR ACTIVITY
        </div>
      </div>
    );
  }

  const segments = period.segments && period.segments.length > 0 ? period.segments : [];
  
  if (segments.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full p-4 bg-white" style={{ color: 'black' }}>
        <div className="opacity-50 text-center uppercase tracking-widest text-sm" style={{ zoom: zoom }}>
          NO SUB-TIMERS
        </div>
      </div>
    );
  }

  const activeIndex = segments.findIndex(s => s.id === activeSegmentId);

  return (
    <div className="!flex !flex-col !flex-1 min-h-0 bg-white">
      <div className="!flex-1 overflow-y-auto min-h-0 pb-2">
        <div style={{ zoom: zoom }}>
          {segments.map((segment, i) => {
        const isActive = activeIndex === i;
        const isPast = activeIndex !== -1 && i < activeIndex;
        const isUpcoming = activeIndex === -1 ? false : i > activeIndex;

        const color = segment.color || period.color || themeColor;
        const dotBg = isActive ? color : (isPast ? `${color}40` : `${color}80`);
        const textStyle = isActive ? { color: '#000000', opacity: 1 } : (isPast ? { color: '#000000', opacity: 0.3 } : { color: '#000000', opacity: 0.7 });

        return (
          <div 
            key={segment.id + i} 
            className="flex items-center justify-between p-3 border-b-2 last:border-b-0 gap-2"
            style={{ borderColor: `${themeColor}40` }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: dotBg }} 
              />
              <span className={`font-bold uppercase tracking-wider truncate ${isActive ? 'text-lg' : ''}`} style={textStyle}>
                {segment.name}
              </span>
            </div>
            
            <div className="flex items-center gap-4 flex-shrink-0">
              <span className="font-pixel tracking-widest text-lg hidden @xs:inline-block" style={textStyle}>
                {segment.durationMinutes} min
              </span>
              <div 
                className="px-2 py-1 text-[10px] @xs:text-xs font-bold uppercase min-w-[60px] @xs:min-w-[80px] text-center flex-shrink-0"
                style={isActive ? {
                  backgroundColor: '#1e293b',
                  color: 'white'
                } : {
                  backgroundColor: 'transparent',
                  color: isPast ? `${themeColor}60` : `${themeColor}80`,
                  borderColor: isPast ? `${themeColor}20` : `${themeColor}40`,
                  borderWidth: '1px'
                }}
              >
                {isActive ? 'ACTIVE' : (isPast ? 'DONE' : 'UPCOMING')}
              </div>
            </div>
          </div>
        );
      })}
        </div>
      </div>
    </div>
  );
}
