import React, { useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { WindowState } from '../types';
import { cn } from '../utils';
import { Settings, Lock, EyeOff, Edit2, ChevronUp, Copy, Move, SlidersHorizontal, X, Heart } from 'lucide-react';

interface WindowProps {
  id: string;
  title?: string;
  state: WindowState;
  onUpdate: (id: string, partial: Partial<WindowState>) => void;
  children: React.ReactNode;
  controls?: React.ReactNode;
  themeColor?: string;
  titleColor?: string;
  isLocked?: boolean;
  chromeless?: boolean;
  headerActions?: React.ReactNode;
}

export function Window({ id, title, state, onUpdate, children, controls, themeColor = '#FF8DA1', titleColor, isLocked = false, chromeless = false, headerActions }: WindowProps) {
  const [isEditingCoords, setIsEditingCoords] = React.useState(false);
  const [tempCoords, setTempCoords] = React.useState({ x: String(Math.round(state.x)), y: String(Math.round(state.y)) });

  React.useEffect(() => {
    if (!isEditingCoords) {
      setTempCoords({ x: String(Math.round(state.x)), y: String(Math.round(state.y)) });
    }
  }, [state.x, state.y, isEditingCoords]);

  const handleCoordsCommit = () => {
    setIsEditingCoords(false);
    const nx = parseInt(tempCoords.x, 10);
    const ny = parseInt(tempCoords.y, 10);
    if (!isNaN(nx) && !isNaN(ny)) {
      onUpdate(id, { x: nx, y: ny });
    } else {
      setTempCoords({ x: String(Math.round(state.x)), y: String(Math.round(state.y)) });
    }
  };

  const handleCoordsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCoordsCommit();
    } else if (e.key === 'Escape') {
      setIsEditingCoords(false);
      setTempCoords({ x: String(Math.round(state.x)), y: String(Math.round(state.y)) });
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const getSafeVal = (val: string | number | undefined, maxVal: number, defaultVal: number) => {
    if (val === undefined) return defaultVal;
    let num = typeof val === 'number' ? val : parseFloat(val as string);
    if (isNaN(num)) num = defaultVal;
    return Math.min(num, maxVal);
  };

  const safeWidth = mounted && typeof window !== 'undefined' ? getSafeVal(state.width, window.innerWidth - 20, 500) : state.width;
  const safeHeight = mounted && typeof window !== 'undefined' ? getSafeVal(state.height, window.innerHeight - 100, 500) : state.height;

  if (!state.isOpen) return null;

  return (
    <Rnd
      size={{ width: safeWidth, height: safeHeight }}
      position={{ x: state.x, y: state.y }}
      onDragStop={(e, d) => onUpdate(id, { x: d.x, y: d.y })}
      onResizeStop={(e, direction, ref, delta, position) => {
        onUpdate(id, {
          width: parseFloat(ref.style.width),
          height: parseFloat(ref.style.height),
          ...position,
        });
      }}
      disableDragging={isLocked}
      enableResizing={!isLocked}
      cancel="input, textarea, button, select, option, .cancel"
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
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-sm" style={{ color: titleColor || themeColor }}>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: themeColor }} />
            {title}
            <button 
              className="p-1 hover:bg-black/5 rounded"
              onClick={(e) => { e.stopPropagation(); onUpdate(id, { focusMode: !state.focusMode }); }}
              title="Toggle Focus Mode"
            >
              <Heart 
                size={14} 
                fill={state.focusMode ? themeColor : 'transparent'} 
                color={state.focusMode ? themeColor : '#ccc'} 
              />
            </button>
          </div>
          
          <div className="flex items-center gap-1" style={{ color: titleColor || themeColor }}>
            {!state.focusMode && (
              <>
                {headerActions}
                {isEditingCoords ? (
                  <div 
                    className="flex items-center gap-1 text-[10px] uppercase px-1 py-0.5 border" 
                    style={{ borderColor: themeColor }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        handleCoordsCommit();
                      }
                    }}
                  >
                    X:
                    <input 
                      type="text" 
                      value={tempCoords.x} 
                      autoFocus
                      onChange={(e) => setTempCoords(prev => ({ ...prev, x: e.target.value }))}
                      onKeyDown={handleCoordsKeyDown}
                      className="w-8 bg-transparent border-b outline-none text-center focus:bg-black/5" 
                      style={{ borderColor: themeColor, color: titleColor || themeColor }}
                    />
                    Y:
                    <input 
                      type="text" 
                      value={tempCoords.y} 
                      onChange={(e) => setTempCoords(prev => ({ ...prev, y: e.target.value }))}
                      onKeyDown={handleCoordsKeyDown}
                      className="w-8 bg-transparent border-b outline-none text-center focus:bg-black/5" 
                      style={{ borderColor: themeColor, color: titleColor || themeColor }}
                    />
                  </div>
                ) : (
                  <div 
                    className="text-[10px] uppercase px-2 py-0.5 border cursor-text" 
                    style={{ borderColor: themeColor }}
                    onMouseDown={(e) => { e.stopPropagation(); setIsEditingCoords(true); }}
                  >
                    X:{Math.round(state.x)} Y:{Math.round(state.y)}
                  </div>
                )}
                <button className="p-1 hover:bg-black/5" onClick={() => onUpdate(id, { isOpen: false })}>
                  <X size={14} style={{ color: titleColor || themeColor }} />
                </button>
              </>
            )}
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

