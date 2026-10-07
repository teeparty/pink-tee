import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, Save, Volume2, Mic, VolumeX, Clock, LayoutGrid, X, Play, Pause, RotateCcw, SkipForward, SkipBack, Plus, Circle, Minus, Maximize, Heart } from 'lucide-react';
import { AppState, WindowState, Period, Segment, AudioMode, TimingMode } from './types';
import { saveStateToUrl, loadStateFromUrl, cn, getPeriodDuration } from './utils';
import { Window } from './components/Window';
import { Spreadsheet } from './components/Spreadsheet';
import { VisualTimer } from './components/VisualTimer';
import { Summary } from './components/Summary';
import { SegmentSummary } from './components/SegmentSummary';
import { SettingsPanel } from './components/SettingsPanel';
import { playChime, playVoice } from './audio';
import { format, differenceInMilliseconds, addMinutes, isAfter, isBefore } from 'date-fns';

const defaultTheme = '#FF8DA1'; // That 90s pink
const defaultState: AppState = {
  themeColor: defaultTheme,
  panelsThemeColor: defaultTheme,
  uiTitle: 'TEE BB SYSTEM',
  brandLogo: '',
  timingMode: 'wall',
  startTime: '08:00',
  sequentialStartMs: null,
  sequentialElapsedMs: 0,
  isSequentialPlaying: false,
  audioMode: 'chime',
  pronunciations: [],
  periods: [
    { 
      id: '1', name: 'Period 1', durationMinutes: 45, type: 'period',
      segments: [
        { id: 's1', name: 'Intro', durationMinutes: 10 },
        { id: 's2', name: 'Activity', durationMinutes: 35 }
      ]
    },
    { id: '2', name: 'Passing', durationMinutes: 5, type: 'transition', segments: [] },
    { id: '3', name: 'Period 2', durationMinutes: 45, type: 'period', segments: [] },
  ],
  clock: { style: 'ring', ringThickness: 150, labelScale: 1 },
  windows: {
    timer: { id: 'timer', x: 200, y: 50, width: 600, height: 600, isOpen: true, zIndex: 10 },
    summary: { id: 'summary', x: 20, y: 50, width: 350, height: 250, isOpen: true, zIndex: 30 },
    segments: { id: 'segments', x: 850, y: 50, width: 350, height: 250, isOpen: true, zIndex: 31 },
    config: { id: 'config', x: 100, y: 100, width: 450, height: 400, isOpen: false, zIndex: 40 },
    clock: { id: 'clock', x: 200, y: 10, width: 200, height: 75, isOpen: true, zIndex: 35, zoom: 1 },
  }
};

export default function App() {
  const [state, setState] = useState<AppState>(defaultState);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Layout states
  const [spreadsheetOpen, setSpreadsheetOpen] = useState(false);

  // Real-time calculation state
  const [activePeriodId, setActivePeriodId] = useState<string | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  
  const [timeRemainingMs, setTimeRemainingMs] = useState(0);
  const [currentTotalDurationMs, setCurrentTotalDurationMs] = useState(0);
  
  const [periodRemainingMs, setPeriodRemainingMs] = useState(0);
  const [periodTotalMs, setPeriodTotalMs] = useState(0);

  const [nextPeriod, setNextPeriod] = useState<Period | null>(null);
  
  const prevStateRef = useRef(state);
  const audioContextStarted = useRef(false);

  useEffect(() => {
    let resolvedState: AppState | null = null;
    
    // 1. Try URL parameters
    const urlState = loadStateFromUrl();
    if (urlState && urlState.periods) {
      resolvedState = urlState;
    } else {
      // 2. Try localStorage persistence
      try {
        const local = localStorage.getItem('tee-bb-state');
        if (local) {
           resolvedState = JSON.parse(local);
        }
      } catch (e) {
        console.error("Local storage decode failed", e);
      }
    }

    if (resolvedState && resolvedState.periods) {
      setState({
        ...defaultState,
        ...resolvedState,
        isSequentialPlaying: false,
        sequentialStartMs: null,
        clock: {
           ...defaultState.clock,
           ...(resolvedState.clock || {})
        },
        windows: { 
           ...defaultState.windows, 
           ...(resolvedState.windows || {})
        }
      });
    }
    
    const clickHandler = () => { audioContextStarted.current = true; };
    document.addEventListener('click', clickHandler);
    return () => document.removeEventListener('click', clickHandler);
  }, []);

  useEffect(() => {
    prevStateRef.current = state;
    // Auto-save to local storage on changes
    localStorage.setItem('tee-bb-state', JSON.stringify(state));
  }, [state]);

  const updateState = (updater: (prev: AppState) => AppState) => {
    setState(prev => updater(prev));
  };

  const handleSaveToUrl = () => {
    saveStateToUrl(state);
  };

  const currentActiveSegmentRef = useRef<string | null>(null);
  const currentActivePeriodRef = useRef<string | null>(null);

  // Main Clock Tick
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      
      const { periods } = state;
      if (periods.length === 0) return;
      
      let simulatedNowTimeMs = now.getTime();
      let scheduleStartMs = now.getTime();

      if (state.timingMode === 'wall') {
        if (!state.startTime) return;
        const [h, m] = state.startTime.split(':').map(Number);
        let periodStart = new Date(now);
        periodStart.setHours(h, m, 0, 0);
        scheduleStartMs = periodStart.getTime();
      } else {
        if (state.isSequentialPlaying && state.sequentialStartMs) {
          simulatedNowTimeMs = (now.getTime() - state.sequentialStartMs) + state.sequentialElapsedMs;
        } else {
          simulatedNowTimeMs = state.sequentialElapsedMs;
        }
        scheduleStartMs = 0;
      }
      
      let foundActivePeriod = null;
      let foundActiveSegment = null;

      let remainingMs = 0;
      let totalMs = 0;
      let pRemainingMs = 0;
      let pTotalMs = 0;
      let foundNext = null;
      
      let periodStartMs = scheduleStartMs;

      for (let i = 0; i < periods.length; i++) {
        const p = periods[i];
        const pDurMs = getPeriodDuration(p) * 60 * 1000;
        const periodEndMs = periodStartMs + pDurMs;
        
        if (simulatedNowTimeMs >= periodStartMs && simulatedNowTimeMs < periodEndMs) {
          foundActivePeriod = p.id;
          pRemainingMs = periodEndMs - simulatedNowTimeMs;
          pTotalMs = pDurMs;
          foundNext = periods[i + 1] || null;

          // Check segments
          if (p.segments && p.segments.length > 0) {
            let segStartMs = periodStartMs;
            for (const seg of p.segments) {
              const segDurMs = seg.durationMinutes * 60 * 1000;
              const segEndMs = segStartMs + segDurMs;
              if (simulatedNowTimeMs >= segStartMs && simulatedNowTimeMs < segEndMs) {
                foundActiveSegment = seg.id;
                remainingMs = segEndMs - simulatedNowTimeMs;
                totalMs = segDurMs;
                break;
              }
              segStartMs = segEndMs;
            }
          // fallback to period
          } else {
             remainingMs = pRemainingMs;
             totalMs = pTotalMs;
          }
          break;
        }
        periodStartMs = periodEndMs;
      }
      
      // Sound trigger
      const currentTickState = foundActiveSegment || foundActivePeriod;
      const lastTickState = currentActiveSegmentRef.current || currentActivePeriodRef.current;
      
      if (currentTickState !== lastTickState) {
        if (lastTickState !== null && audioContextStarted.current) {
          if (state.audioMode === 'chime') {
            playChime();
          } else if (state.audioMode === 'voice') {
             // Find name of what's starting
             let nameToSay = 'Next session starting';
             const p = periods.find(p => p.id === foundActivePeriod);
             if (p) {
                if (foundActiveSegment) {
                   const s = p.segments?.find(s => s.id === foundActiveSegment);
                   if (s) nameToSay = s.name;
                } else {
                   nameToSay = p.name;
                }
             }
             playVoice(`${nameToSay}`, state.pronunciations);
          }
        }
        currentActivePeriodRef.current = foundActivePeriod;
        currentActiveSegmentRef.current = foundActiveSegment;
      }

      setActivePeriodId(foundActivePeriod);
      setActiveSegmentId(foundActiveSegment);
      setTimeRemainingMs(remainingMs);
      setCurrentTotalDurationMs(totalMs);
      setPeriodRemainingMs(pRemainingMs);
      setPeriodTotalMs(pTotalMs);
      setNextPeriod(foundNext);

    }, 250); 

    return () => clearInterval(interval);
  }, [state]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const updateWindow = (id: string, partial: Partial<WindowState>) => {
    updateState(s => ({
      ...s,
      windows: {
        ...s.windows,
        [id]: { ...s.windows[id], ...partial }
      }
    }));
  };

  const handlePeriodUpdate = (newPeriods: Period[]) => {
    updateState(s => ({ ...s, periods: newPeriods }));
  };

  const skipTo = (direction: 'next' | 'prev') => {
    const timeline: {start: number, end: number}[] = [];
    let t = 0;
    state.periods.forEach(p => {
       if (p.segments && p.segments.length > 0) {
          p.segments.forEach(s => {
             timeline.push({ start: t, end: t + s.durationMinutes * 60000 });
             t += s.durationMinutes * 60000;
          });
       } else {
          timeline.push({ start: t, end: t + p.durationMinutes * 60000 });
          t += p.durationMinutes * 60000;
       }
    });

    const nowMs = state.isSequentialPlaying && state.sequentialStartMs 
       ? (Date.now() - state.sequentialStartMs) + state.sequentialElapsedMs
       : state.sequentialElapsedMs;

    if (direction === 'next') {
       const current = timeline.find(ev => nowMs >= ev.start && nowMs < ev.end);
       if (current) {
          updateState(s => ({
             ...s, 
             sequentialElapsedMs: current.end,
             sequentialStartMs: s.isSequentialPlaying ? Date.now() : null
          }));
       }
    } else {
       const currentIdx = timeline.findIndex(ev => nowMs >= ev.start && nowMs < ev.end);
       if (currentIdx > 0) {
          updateState(s => ({
             ...s, 
             sequentialElapsedMs: timeline[currentIdx - 1].start,
             sequentialStartMs: s.isSequentialPlaying ? Date.now() : null
          }));
       } else {
          updateState(s => ({
             ...s, 
             sequentialElapsedMs: 0,
             sequentialStartMs: s.isSequentialPlaying ? Date.now() : null
          }));
       }
    }
  };

  const themeColor = state.themeColor;
  
  const currentPeriod = state.periods.find(p => p.id === activePeriodId) || null;
  const currentSegment = currentPeriod?.segments?.find(s => s.id === activeSegmentId) || null;

  return (
    <div className="w-full h-screen flex flex-col font-mono text-gray-900 bg-retro-bg overflow-hidden relative">
      {/* Top Bar Settings */}
      <div 
        className="flex-none h-14 bg-white border-b-4 flex items-center px-4 justify-between"
        style={{ borderColor: themeColor, zIndex: 100 }}
      >
        <div className="flex items-center gap-4 text-sm font-bold uppercase tracking-wider">
          {state.brandLogo ? (
            <img src={state.brandLogo} alt="Logo" className="h-6 w-auto object-contain" />
          ) : (
            <Clock size={20} style={{ color: themeColor }} />
          )}
          <span className="hidden md:inline">{state.uiTitle || 'SYSTEM VISUALIZER'}</span>
          <button 
            onClick={() => updateState(s => ({ ...s, mainFocusMode: !s.mainFocusMode }))}
            className="p-1 hover:bg-black/5 rounded"
            title="Toggle Focus Mode"
          >
            <Heart 
              size={16} 
              fill={state.mainFocusMode ? themeColor : 'transparent'} 
              color={state.mainFocusMode ? themeColor : '#ccc'} 
            />
          </button>
        </div>
        
        {!state.mainFocusMode && (
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2">
            <select
               value={state.timingMode}
               onChange={e => updateState(s => ({ ...s, timingMode: e.target.value as TimingMode }))}
               className="bg-transparent border-2 outline-none px-2 py-1 text-xs font-bold shadow-[2px_2px_0_rgba(0,0,0,0.1)] uppercase hover:bg-black/5 cursor-pointer"
               style={{ borderColor: themeColor, color: themeColor }}
            >
               <option value="wall">WALL CLOCK ENGINE</option>
               <option value="sequential">SEQUENTIAL ENGINE</option>
            </select>
          </div>
          
          {state.timingMode === 'wall' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase opacity-70 hidden md:inline">Start</span>
              <input 
                type="time" 
                value={state.startTime}
                onChange={e => updateState(s => ({ ...s, startTime: e.target.value }))}
                className="bg-transparent border-2 outline-none px-2 py-1 text-xs md:text-sm font-bold shadow-[2px_2px_0_rgba(0,0,0,0.1)]"
                style={{ borderColor: themeColor, color: themeColor }}
              />
              <button
                 onClick={() => updateState(s => ({ ...s, windows: { ...s.windows, summary: { ...s.windows.summary, isOpen: true } } }))}
                 className="p-1.5 border-2 shadow-[2px_2px_0_rgba(0,0,0,0.1)] hover:bg-black/5 ml-1 bg-black text-white"
                 style={{ borderColor: 'black' }}
                 title="Open Summary"
              >
                <Plus size={16} />
              </button>
              <button
                 onClick={() => updateState(s => ({ ...s, windows: { ...s.windows, segments: { ...s.windows.segments, isOpen: true } } }))}
                 className="p-1.5 border-2 shadow-[2px_2px_0_rgba(0,0,0,0.1)] hover:bg-black/5 ml-1 bg-black text-white"
                 style={{ borderColor: 'black' }}
                 title="Open Segments"
              >
                <Circle size={16} />
              </button>
              <button
                 onClick={() => updateState(s => ({ ...s, windows: { ...s.windows, clock: { ...s.windows.clock, isOpen: true } } }))}
                 className="p-1.5 border-2 shadow-[2px_2px_0_rgba(0,0,0,0.1)] hover:bg-black/5 ml-1 bg-black text-white"
                 style={{ borderColor: 'black' }}
                 title="Open Clock"
              >
                <Clock size={16} />
              </button>
              <div className="flex items-center gap-1 ml-2 mr-2">
                <Clock size={14} style={{ color: themeColor }} />
                <input 
                  type="range" 
                  min="0.5" max="5" step="0.1" 
                  value={state.windows.clock?.zoom || 1}
                  onChange={(e) => updateWindow('clock', { zoom: parseFloat(e.target.value) })}
                  className="w-16 sm:w-20 cursor-pointer accent-black" 
                />
                <Circle size={14} style={{ color: themeColor }} className="ml-2" />
                <input 
                  type="range" 
                  min={350} max={typeof window !== 'undefined' ? Math.min(window.innerWidth, window.innerHeight - 150) : 1000} step={10} 
                  value={parseFloat(String(state.windows.timer?.width)) || 500}
                  onChange={(e) => {
                    const newSize = parseFloat(e.target.value);
                    const oldSize = parseFloat(String(state.windows.timer?.width)) || 500;
                    const diff = newSize - oldSize;
                    updateWindow('timer', { 
                        width: newSize, height: newSize,
                        x: (state.windows.timer?.x || 0) - diff / 2,
                        y: (state.windows.timer?.y || 0) - diff / 2
                    });
                  }}
                  className="w-16 sm:w-20 cursor-pointer accent-black" 
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                 onClick={() => skipTo('prev')}
                 className="p-1.5 border-2 shadow-[2px_2px_0_rgba(0,0,0,0.1)] hover:bg-black/5 hidden md:block"
                 style={{ borderColor: themeColor, color: themeColor }}
                 title="Previous Segment"
              >
                <SkipBack size={16} />
              </button>
              <button
                 onClick={() => {
                   if (state.isSequentialPlaying) {
                      updateState(s => ({ ...s, isSequentialPlaying: false, sequentialElapsedMs: s.sequentialElapsedMs + (Date.now() - (s.sequentialStartMs || Date.now())) }));
                   } else {
                      updateState(s => ({ ...s, isSequentialPlaying: true, sequentialStartMs: Date.now() }));
                   }
                 }}
                 className={cn("p-1.5 border-2 shadow-[2px_2px_0_rgba(0,0,0,0.1)] hover:bg-black/5")}
                 style={{ borderColor: themeColor, color: themeColor, backgroundColor: state.isSequentialPlaying ? `${themeColor}20` : 'transparent' }}
                 title={state.isSequentialPlaying ? "Pause Timer" : "Start Timer"}
              >
                {state.isSequentialPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button
                 onClick={() => skipTo('next')}
                 className="p-1.5 border-2 shadow-[2px_2px_0_rgba(0,0,0,0.1)] hover:bg-black/5 hidden md:block"
                 style={{ borderColor: themeColor, color: themeColor }}
                 title="Next Segment"
              >
                <SkipForward size={16} />
              </button>
              <button
                 onClick={() => updateState(s => ({ ...s, isSequentialPlaying: false, sequentialElapsedMs: 0, sequentialStartMs: null }))}
                 className="p-1.5 border-2 shadow-[2px_2px_0_rgba(0,0,0,0.1)] hover:bg-black/5 ml-1"
                 style={{ borderColor: themeColor, color: themeColor }}
                 title="Reset Timeline"
              >
                <RotateCcw size={16} />
              </button>
              <button
                 onClick={() => updateState(s => ({ ...s, windows: { ...s.windows, summary: { ...s.windows.summary, isOpen: true } } }))}
                 className="p-1.5 border-2 shadow-[2px_2px_0_rgba(0,0,0,0.1)] hover:bg-black/5 ml-1 bg-black text-white"
                 style={{ borderColor: 'black' }}
                 title="Open Summary"
              >
                <Plus size={16} />
              </button>
              <button
                 onClick={() => updateState(s => ({ ...s, windows: { ...s.windows, segments: { ...s.windows.segments, isOpen: true } } }))}
                 className="p-1.5 border-2 shadow-[2px_2px_0_rgba(0,0,0,0.1)] hover:bg-black/5 ml-1 bg-black text-white"
                 style={{ borderColor: 'black' }}
                 title="Open Segments"
              >
                <Circle size={16} />
              </button>
              <button
                 onClick={() => updateState(s => ({ ...s, windows: { ...s.windows, clock: { ...s.windows.clock, isOpen: true } } }))}
                 className="p-1.5 border-2 shadow-[2px_2px_0_rgba(0,0,0,0.1)] hover:bg-black/5 ml-1 bg-black text-white"
                 style={{ borderColor: 'black' }}
                 title="Open Clock"
              >
                <Clock size={16} />
              </button>
              <div className="flex items-center gap-1 ml-2 mr-2">
                <Clock size={14} style={{ color: themeColor }} />
                <input 
                  type="range" 
                  min="0.5" max="5" step="0.1" 
                  value={state.windows.clock?.zoom || 1}
                  onChange={(e) => updateWindow('clock', { zoom: parseFloat(e.target.value) })}
                  className="w-16 sm:w-20 cursor-pointer accent-black" 
                />
                <Circle size={14} style={{ color: themeColor }} className="ml-2" />
                <input 
                  type="range" 
                  min={350} max={typeof window !== 'undefined' ? Math.min(window.innerWidth, window.innerHeight - 150) : 1000} step={10} 
                  value={parseFloat(String(state.windows.timer?.width)) || 500}
                  onChange={(e) => {
                    const newSize = parseFloat(e.target.value);
                    const oldSize = parseFloat(String(state.windows.timer?.width)) || 500;
                    const diff = newSize - oldSize;
                    updateWindow('timer', { 
                        width: newSize, height: newSize,
                        x: (state.windows.timer?.x || 0) - diff / 2,
                        y: (state.windows.timer?.y || 0) - diff / 2
                    });
                  }}
                  className="w-16 sm:w-20 cursor-pointer accent-black" 
                />
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-1">
             <button 
               onClick={() => updateState(s => ({ ...s, audioMode: 'none' }))}
               className={cn("p-1.5 border-2 hover:bg-black/5", state.audioMode === 'none' ? "bg-black/10 shadow-inner" : "shadow-[2px_2px_0_rgba(0,0,0,0.1)]")}
               style={{ borderColor: themeColor, color: themeColor }}
               title="Mute Bell"
             >
               <VolumeX size={16} />
             </button>
             <button 
               onClick={() => updateState(s => ({ ...s, audioMode: 'chime' }))}
               className={cn("p-1.5 border-2 hover:bg-black/5", state.audioMode === 'chime' ? "bg-black/10 shadow-inner" : "shadow-[2px_2px_0_rgba(0,0,0,0.1)]")}
               style={{ borderColor: themeColor, color: themeColor }}
               title="Chime Bell"
             >
               <Volume2 size={16} />
             </button>
             <button 
               onClick={() => updateState(s => ({ ...s, audioMode: 'voice' }))}
               className={cn("p-1.5 border-2 hover:bg-black/5", state.audioMode === 'voice' ? "bg-black/10 shadow-inner" : "shadow-[2px_2px_0_rgba(0,0,0,0.1)]")}
               style={{ borderColor: themeColor, color: themeColor }}
               title="AI Voice Announcer"
             >
               <Mic size={16} />
             </button>
          </div>

          <div className="flex items-center gap-1">
            <input 
              type="color" 
              value={state.themeColor}
              onChange={e => updateState(s => ({ ...s, themeColor: e.target.value }))}
              className="w-8 h-8 p-0 border-2 rounded-none outline-none cursor-pointer shadow-[2px_2px_0_rgba(0,0,0,0.1)]"
              style={{ borderColor: themeColor }}
              title="Main Theme Color"
            />
            <input 
              type="text"
              value={state.themeColor}
              onChange={e => updateState(s => ({ ...s, themeColor: e.target.value }))}
              className="w-20 bg-transparent border-2 outline-none px-2 py-1 text-xs text-center font-bold shadow-[2px_2px_0_rgba(0,0,0,0.1)] hidden lg:block"
              style={{ borderColor: themeColor, color: themeColor }}
              title="Main Theme Hex"
            />
          </div>

          <button 
            onClick={() => setSpreadsheetOpen(!spreadsheetOpen)}
            className="flex items-center gap-2 border-2 px-3 py-1.5 font-bold uppercase text-xs cursor-pointer hover:opacity-90 shadow-[2px_2px_0_rgba(0,0,0,0.1)] transition-colors"
            style={spreadsheetOpen ? {
               borderColor: themeColor, backgroundColor: '#f1f5f9', color: themeColor
            } : {
               borderColor: themeColor, backgroundColor: themeColor, color: 'white'
            }}
          >
            <LayoutGrid size={16} /> 
            <span className="hidden sm:inline">Spreadsheet</span>
          </button>
          
          <button 
            onClick={toggleFullScreen}
            className="p-1.5 border-2 hover:bg-black/5 shadow-[2px_2px_0_rgba(0,0,0,0.1)] transition-colors"
            style={{
               borderColor: themeColor, color: themeColor
            }}
            title="Toggle Fullscreen"
          >
            <Maximize size={16} />
          </button>
          
          <button 
            onClick={() => updateWindow('config', { isOpen: !state.windows.config.isOpen })}
            className="p-1.5 border-2 hover:bg-black/5 shadow-[2px_2px_0_rgba(0,0,0,0.1)] transition-colors"
            style={state.windows.config.isOpen ? {
               borderColor: themeColor, backgroundColor: '#f1f5f9', color: themeColor
            } : {
               borderColor: themeColor, color: themeColor
            }}
            title="Settings"
          >
            <Settings size={16} />
          </button>

          <button 
            onClick={handleSaveToUrl}
            className="flex items-center gap-2 border-2 px-3 py-1.5 font-bold uppercase text-xs cursor-pointer hover:bg-black/5 shadow-[2px_2px_0_rgba(0,0,0,0.1)]"
            style={{ borderColor: themeColor, color: themeColor, backgroundColor: 'white' }}
            title="Copy Config URL"
          >
            <Save size={16} /> <span className="hidden xl:inline">Bookmark State</span>
          </button>
        </div>
        )}
      </div>

      {/* Main Content Area - Split Layout */}
      <div className="flex-1 flex flex-col min-h-0 relative">
         
         {/* Top: Timer / Floating Canvas */}
         <div id="desktop-area" className="flex-1 relative overflow-hidden bg-retro-bg p-4 flex flex-col">


            {/* We maintain react-rnd for the user to still drag sub-views if they want, 
                but we center the timer logic prominently if we can. Actually placing it 
                fully inside works wonders. */}
            <Window
              id="timer"
              title="MAIN COUNTDOWN NODE"
              state={state.windows.timer}
              onUpdate={updateWindow}
              themeColor={themeColor}
              chromeless={true}
            >
              <div 
                className="w-full h-full flex flex-col items-center justify-center transform-gpu origin-center" 
              >
                <VisualTimer 
                  currentPeriod={currentPeriod}
                  activeSegment={currentSegment}
                  nextPeriod={nextPeriod}
                  now={currentTime}
                  timeRemainingMs={timeRemainingMs}
                  totalDurationMs={currentTotalDurationMs}
                  periodRemainingMs={periodRemainingMs}
                  periodTotalMs={periodTotalMs}
                  themeColor={themeColor}
                  clock={state.clock}
                  onClockChange={partial => updateState(s => ({ ...s, clock: { ...s.clock, ...partial } }))}
                />
              </div>
            </Window>

            <Window
              id="summary"
              title="ALL PERIODS"
              state={state.windows.summary}
              onUpdate={updateWindow}
              themeColor={state.summaryThemeColor || themeColor}
              titleColor="black"
              headerActions={
                <>
                  <input 
                    type="color" 
                    value={state.summaryThemeColor || themeColor}
                    onChange={e => updateState(s => ({ ...s, summaryThemeColor: e.target.value }))}
                    className="w-4 h-4 p-0 border rounded-none outline-none cursor-pointer hidden md:block"
                    style={{ borderColor: state.summaryThemeColor || themeColor }}
                    title="Summary Theme Color"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                  <button className="p-1 hover:bg-black/5" onClick={() => updateWindow('summary', { zoom: Math.max(0.5, (state.windows.summary.zoom || 1) - 0.1) })}>
                    <Minus size={14} style={{ color: "black" }} />
                  </button>
                  <button className="p-1 hover:bg-black/5" onClick={() => updateWindow('summary', { zoom: Math.min(3, (state.windows.summary.zoom || 1) + 0.1) })}>
                    <Plus size={14} style={{ color: "black" }} />
                  </button>
                </>
              }
            >
              <Summary 
                periods={state.periods}
                activePeriodId={activePeriodId}
                themeColor={themeColor}
                periodRemainingMs={periodRemainingMs}
                zoom={state.windows.summary.zoom || 1}
              />
            </Window>

            <Window
              id="segments"
              title="Timers"
              state={state.windows.segments || { id: 'segments', x: 850, y: 50, width: 350, height: 250, isOpen: true, zIndex: 31, zoom: 1 }}
              onUpdate={updateWindow}
              themeColor={state.segmentsThemeColor || themeColor}
              titleColor="black"
              headerActions={
                <>
                  <input 
                    type="color" 
                    value={state.segmentsThemeColor || themeColor}
                    onChange={e => updateState(s => ({ ...s, segmentsThemeColor: e.target.value }))}
                    className="w-4 h-4 p-0 border rounded-none outline-none cursor-pointer hidden md:block"
                    style={{ borderColor: state.segmentsThemeColor || themeColor }}
                    title="Segments Theme Color"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                  <button className="p-1 hover:bg-black/5" onClick={() => updateWindow('segments', { zoom: Math.max(0.5, (state.windows.segments?.zoom || 1) - 0.1) })}>
                    <Minus size={14} style={{ color: "black" }} />
                  </button>
                  <button className="p-1 hover:bg-black/5" onClick={() => updateWindow('segments', { zoom: Math.min(3, (state.windows.segments?.zoom || 1) + 0.1) })}>
                    <Plus size={14} style={{ color: "black" }} />
                  </button>
                </>
              }
            >
              <SegmentSummary 
                period={currentPeriod}
                activeSegmentId={activeSegmentId}
                timeRemainingMs={timeRemainingMs}
                themeColor={themeColor}
                zoom={state.windows.segments?.zoom || 1}
              />
            </Window>
            
            <Window
              id="config"
              title="GLOBAL CONFIGURATION"
              state={state.windows.config}
              onUpdate={updateWindow}
              themeColor={themeColor}
            >
              <SettingsPanel 
                state={state}
                updateState={updateState}
                themeColor={themeColor}
              />
            </Window>
            
            <Window
              id="clock"
              state={state.windows.clock || { id: 'clock', x: 200, y: 10, width: 250, height: 100, isOpen: true, zIndex: 35, zoom: 1 }}
              onUpdate={updateWindow}
              themeColor={themeColor}
              chromeless={true}
            >
              <div className="w-full h-full flex items-center justify-center p-2 timer-drag-handle">
                <div 
                   className="bg-white/80 border-2 px-4 py-2 font-pixel tracking-widest shadow-[4px_4px_0_rgba(0,0,0,0.1)] cursor-move select-none whitespace-nowrap pointer-events-auto flex items-center justify-center" 
                   style={{ 
                     borderColor: themeColor, 
                     color: themeColor,
                     zoom: state.windows.clock?.zoom || 1,
                     fontSize: '1.25rem'
                   }}
                >
                  {format(currentTime, 'hh:mm:ss a')}
                </div>
              </div>
            </Window>
         </div>

         {/* Bottom: Spreadsheet Drawer */}
         {spreadsheetOpen && (
           <div className="flex-none h-1/2 min-h-[400px] border-t-8 flex flex-col relative bg-white shadow-[0_-10px_20px_rgba(0,0,0,0.05)]" style={{ borderColor: themeColor }}>
              <div className="absolute top-0 right-0 -mt-8 bg-white border-4 border-b-0 px-2 flex py-1 items-center gap-2" style={{ borderColor: themeColor }}>
                <button 
                  onClick={() => setSpreadsheetOpen(false)}
                  className="hover:opacity-70 text-xs font-bold uppercase flex items-center gap-1"
                  style={{ color: themeColor }}
                >
                   Close Spreadsheet <X size={14} />
                </button>
              </div>
              <Spreadsheet 
                periods={state.periods}
                onUpdatePeriods={handlePeriodUpdate}
                startTime={state.startTime}
                themeColor={themeColor}
                activePeriodId={activePeriodId}
              />
           </div>
         )}
      </div>

    </div>
  );
}
