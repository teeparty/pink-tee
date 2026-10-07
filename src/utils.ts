import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import LZString from 'lz-string';
import { AppState, Period } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getPeriodDuration(period: Period): number {
  if (period.segments && period.segments.length > 0) {
    return period.segments.reduce((sum, seg) => sum + (seg.durationMinutes || 0), 0);
  }
  return period.durationMinutes || 0;
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${ms < 0 ? '-' : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function saveStateToUrl(state: AppState) {
  const jsonString = JSON.stringify(state);
  const compressed = LZString.compressToEncodedURIComponent(jsonString);
  window.history.replaceState(null, '', `?state=${compressed}`);
}

export function loadStateFromUrl(): AppState | null {
  const params = new URLSearchParams(window.location.search);
  const stateParam = params.get('state');
  if (!stateParam) return null;

  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(stateParam);
    if (!decompressed) return null;
    return JSON.parse(decompressed) as AppState;
  } catch (e) {
    console.error('Failed to parse state from URL', e);
    return null;
  }
}
