import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import LZString from 'lz-string';
import { AppState } from './types';
import { dateKey, withNewIds, withoutIds } from './schedule';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${ms < 0 ? '-' : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Bookmarks and setup files hold the same JSON. The schedule is saved without its ids, and
// loading makes new ones.
export function stateToJson(state: AppState, space?: number): string {
  return JSON.stringify({ ...state, schedule: withoutIds(state.schedule) }, null, space);
}

// The state as saved, which can be an older format (see App), or null if this isn't a setup
export function stateFromJson(json: string): AppState | null {
  try {
    const state = JSON.parse(json);
    if (typeof state !== 'object' || !state || !(state.schedule || state.periods)) return null;
    if (state.schedule) state.schedule = withNewIds(state.schedule);
    return state as AppState;
  } catch {
    return null;
  }
}

export function saveStateToUrl(state: AppState) {
  const compressed = LZString.compressToEncodedURIComponent(stateToJson(state));
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

  let state: AppState | null = null;
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(stateParam);
    if (decompressed) state = stateFromJson(decompressed);
  } catch {}
  if (!state) console.error('Failed to read the state in the URL');
  return state;
}

export function clearStateFromUrl() {
  window.history.replaceState(null, '', window.location.pathname);
}

export function downloadStateFile(state: AppState) {
  const file = new Blob([stateToJson(state, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = `bell-schedule-${dateKey(new Date())}.json`;
  link.click();
  // Some browsers start the download after click() returns
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
