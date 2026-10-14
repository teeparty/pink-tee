import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import LZString from 'lz-string';
import { AppState } from './types';
import { withNewIds, withoutIds } from './schedule';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${ms < 0 ? '-' : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function saveStateToUrl(state: AppState) {
  const jsonString = JSON.stringify({ ...state, schedule: withoutIds(state.schedule) });
  const compressed = LZString.compressToEncodedURIComponent(jsonString);
  // After the #, the state stays in the browser. In the query string it went to the server,
  // which turns long URLs away (414).
  window.history.replaceState(null, '', `${window.location.pathname}#state=${compressed}`);
}

export function loadStateFromUrl(): AppState | null {
  // Older bookmarks have the state in the query string
  const stateParam =
    new URLSearchParams(window.location.hash.slice(1)).get('state') ??
    new URLSearchParams(window.location.search).get('state');
  if (!stateParam) return null;

  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(stateParam);
    if (!decompressed) return null;
    const state = JSON.parse(decompressed) as AppState;
    if (state.schedule) state.schedule = withNewIds(state.schedule);
    return state;
  } catch (e) {
    console.error('Failed to parse state from URL', e);
    return null;
  }
}
