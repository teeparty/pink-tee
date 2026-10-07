import React, { useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { ClockSettings } from '../types';

interface ClockMenuProps {
  clock: ClockSettings;
  onChange: (partial: Partial<ClockSettings>) => void;
  themeColor: string;
}

export function ClockMenu({ clock, onChange, themeColor }: ClockMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on a click outside the menu or on Escape
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={menuRef}
      className="absolute top-2 right-2 z-10 cancel cursor-default"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        className="p-1.5 text-black/20 hover:text-black/70 transition-colors"
        onClick={() => setOpen(o => !o)}
        title="Clock options"
        aria-expanded={open}
      >
        <Menu size={24} />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1 w-56 bg-white border-2 p-3 shadow-[4px_4px_0_rgba(0,0,0,0.1)] flex flex-col gap-4 text-xs text-black"
          style={{ borderColor: themeColor }}
        >
          <div className="flex flex-col gap-2">
            <span className="font-bold uppercase opacity-70">Style</span>
            <div className="flex gap-4">
              {(['ring', 'pie'] as const).map(style => (
                <label key={style} className="flex items-center gap-1.5 cursor-pointer uppercase">
                  <input
                    type="radio"
                    name="clock-style"
                    checked={clock.style === style}
                    onChange={() => onChange({ style })}
                    style={{ accentColor: themeColor }}
                  />
                  {style}
                </label>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-2">
            <span className="font-bold uppercase opacity-70">Ring Thickness</span>
            <input
              type="range" min={40} max={250} value={clock.ringThickness}
              onChange={(e) => onChange({ ringThickness: Number(e.target.value) })}
              className="w-full cursor-pointer"
              style={{ accentColor: themeColor }}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-bold uppercase opacity-70">Label Size</span>
            <input
              type="range" min={0.5} max={3.0} step={0.1} value={clock.labelScale}
              onChange={(e) => onChange({ labelScale: Number(e.target.value) })}
              className="w-full cursor-pointer"
              style={{ accentColor: themeColor }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
