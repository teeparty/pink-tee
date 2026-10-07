export type AudioMode = 'chime' | 'voice' | 'none';
export type TimingMode = 'wall' | 'sequential';

export interface Segment {
  id: string;
  name: string;
  durationMinutes: number;
  color?: string;
}

export interface Period {
  id: string;
  name: string;
  durationMinutes: number;
  type: 'period' | 'transition';
  color?: string; // Optional custom color per period
  segments?: Segment[];
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
  startTime: string; // HH:mm format
  sequentialStartMs: number | null;
  sequentialElapsedMs: number;
  isSequentialPlaying: boolean;
  audioMode: AudioMode;
  periods: Period[];
  clock: ClockSettings;
  windows: Record<string, WindowState>;
  pronunciations: PronunciationOverride[];
}

