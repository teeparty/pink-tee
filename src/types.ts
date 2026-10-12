export type AudioMode = 'chime' | 'voice' | 'none';
export type TimingMode = 'wall' | 'sequential';

export interface Segment {
  id: string;
  name: string;
  durationMinutes: number;
  color?: string;
}

// A block in one day's timeline, worked out from the schedule. Gaps between periods become
// 'transition' blocks.
export interface Period {
  id: string;
  name: string;
  durationMinutes: number;
  type: 'period' | 'transition';
  color?: string; // Optional custom color per period
  segments?: Segment[];
}

export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// A period at set clock times, in minutes after midnight
export interface ScheduledPeriod {
  id: string;
  name: string;
  start: number;
  end: number;
  color?: string;
  segments: Segment[];
}

export interface Schedule {
  // The regular week: each weekday's periods, with that day's timers
  weekdays: Partial<Record<Weekday, ScheduledPeriod[]>>;
  // One-off days, keyed by date (YYYY-MM-DD), that replace the weekday's periods on that date
  specials: Record<string, ScheduledPeriod[]>;
}

export interface ClockSettings {
  style: 'ring' | 'pie';
  ringThickness: number;
  labelScale: number;
}

export interface WindowState {
  id: string;
  x: number;
  y: number;
  width: number | string;
  height: number | string;
  isOpen: boolean;
  zIndex: number;
  zoom?: number;
  focusMode?: boolean;
}

export interface PronunciationOverride {
  id: string;
  original: string;
  replacement: string;
}

export interface AppState {
  themeColor: string;
  panelsThemeColor: string;
  summaryThemeColor?: string;
  segmentsThemeColor?: string;
  uiTitle: string;
  brandLogo: string;
  timingMode: TimingMode;
  mainFocusMode?: boolean;
  sequentialStartMs: number | null;
  sequentialElapsedMs: number;
  isSequentialPlaying: boolean;
  audioMode: AudioMode;
  schedule: Schedule;
  clock: ClockSettings;
  windows: Record<string, WindowState>;
  pronunciations: PronunciationOverride[];
}

