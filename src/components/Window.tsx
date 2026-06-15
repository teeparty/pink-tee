import React from 'react';
import { Rnd } from 'react-rnd';
import { WindowState } from '../types';
import { cn } from '../utils';
import { Settings, Lock, EyeOff, Edit2, ChevronUp, Copy, Move, SlidersHorizontal, X } from 'lucide-react';

interface WindowProps {
  id: string;
  title?: string;
  state: WindowState;
  onUpdate: (id: string, partial: Partial<WindowState>) => void;
  children: React.ReactNode;
  controls?: React.ReactNode;
  themeColor?: string;
  isLocked?: boolean;
  chromeless?: boolean;
  headerActions?: React.ReactNode;
}

export function Window({ id, title, state, onUpdate, children, controls, themeColor = '#FF8DA1', isLocked = false, chromeless = false, headerActions }: WindowProps) {
  if (!state.isOpen) return null;

  return (
    <Rnd
      size={{ width: state.width, height: state.height }}
      position={{ x: state.x, y: state.y }}
      onDragStop={(e, d) => onUpdate(id, { x: d.x, y: d.y })}
      onResizeStop={(e, direction, ref, delta, position) => {
        onUpdate(id, {
          width: ref.style.width,
          height: ref.style.height,
          ...position,
        });
      }}
      disableDragging={isLocked}
      enableResizing={!isLocked}
      minWidth={300}
      minHeight={150}
      bounds="parent"
      className={cn("!flex !flex-col", {
        "bg-white shadow-[8px_8px_0px_rgba(0,0,0,0.1)] overflow-hidden": !chromeless,
        "pointer-events-auto": chromeless, // Just allow clicks to passthrough
      })}
      onMouseDownCapture={() => onUpdate(id, { zIndex: Date.now() })}
      style={{
        border: chromeless ? undefined : `2px solid ${themeColor}`,
        color: themeColor,
        zIndex: state.zIndex
      }}
      dragHandleClassName={chromeless ? "timer-drag-handle" : "handle"}
    >
      {/* Title Bar */}
      {!chromeless && (
        <div 
          className={cn(
            "flex items-center justify-between px-3 py-2 border-b-2 bg-white handle select-none",
            isLocked ? "" : "cursor-move"
          )}
          style={{ borderColor: themeColor }}
        >
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: themeColor }} />
            {title}
          </div>
          
          <div className="flex items-center gap-1">
            {headerActions}
            <div className="text-[10px] uppercase px-2 py-0.5 border" style={{ borderColor: themeColor }}>
              X:{Math.round(state.x)} Y:{Math.round(state.y)}
            </div>
            <button className="p-1 hover:bg-black/5" onClick={() => onUpdate(id, { isOpen: false })}>
              <X size={14} style={{ color: themeColor }} />
            </button>
          </div>
        </div>
      )}

      {/* Controls Bar (Optional) */}
      {controls && !chromeless && (
        <div 
          className="flex items-center gap-4 px-3 py-2 border-b-2 bg-white text-xs"
          style={{ borderColor: themeColor }}
        >
          {controls}
        </div>
      )}

      {/* Content */}
      <div className={cn("!flex-1 !flex !flex-col min-h-0 @container", {"overflow-hidden bg-white": !chromeless, "overflow-visible": chromeless})}>
        {children}
      </div>
    </Rnd>
  );
}

