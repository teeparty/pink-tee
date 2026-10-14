import type { Period, Schedule, ScheduledPeriod, Segment, Weekday } from './types';

// School-week order, Monday first
export const WEEKDAYS: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
// Indexed by Date.getDay()
const DAYS_FROM_SUNDAY: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Names the schedule text accepts for colors, picked to stay readable on white
export const NAMED_COLORS = new Map([
  ['red', '#ef4444'],
  ['orange', '#f97316'],
  ['yellow', '#eab308'],
  ['green', '#22c55e'],
  ['teal', '#14b8a6'],
  ['blue', '#3b82f6'],
  ['purple', '#a855f7'],
  ['pink', '#ff8da1'],
  ['gray', '#6b7280'],
  ['grey', '#6b7280'],
  ['brown', '#92400e'],
  ['black', '#1f2937'],
]);

// ---------------------------------------------------------------------------------------------
// Days and dates

export function weekdayOf(date: Date): Weekday {
  return DAYS_FROM_SUNDAY[date.getDay()];
}

export function dayName(day: Weekday): string {
  return day[0].toUpperCase() + day.slice(1);
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

// The local calendar date as YYYY-MM-DD
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// The date with this month and day that's closest to today, so "Jan 5" seen in December is next
// January and "Oct 7" seen on Oct 12 is five days ago
function closestDate(month: number, day: number, today: Date): Date | null {
  const candidates = [-1, 0, 1]
    .map(offset => new Date(today.getFullYear() + offset, month, day))
    .filter(date => date.getMonth() === month);
  if (candidates.length === 0) return null;
  const distance = (date: Date) => Math.abs(date.getTime() - today.getTime());
  return candidates.reduce((best, date) => (distance(date) < distance(best) ? date : best));
}

// "Oct 14", with the year added when leaving it off would mean a different date
export function formatDate(key: string, today: Date): string {
  const date = dateFromKey(key);
  const short = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  const closest = closestDate(date.getMonth(), date.getDate(), today);
  return closest && dateKey(closest) === key ? short : `${short}, ${date.getFullYear()}`;
}

// "Wednesday, Oct 14"
export function formatDayAndDate(key: string, today: Date): string {
  return `${dayName(weekdayOf(dateFromKey(key)))}, ${formatDate(key, today)}`;
}

// ---------------------------------------------------------------------------------------------
// Times, durations and colors

interface ClockTime {
  hour: number;
  minute: number;
  half?: 'a' | 'p';
}

const TIME = String.raw`(\d{1,2})(?::(\d{2}))?\s*(?:([ap])\.?m?\.?)?`;
const TIME_RANGE = new RegExp(String.raw`^${TIME}\s*(?:-|–|—|to)\s*${TIME}$`, 'i');
// A single time, which has to have a colon or AM/PM so that plain numbers aren't read as times
const LONE_TIME = /^\d{1,2}(?::\d{2}\s*(?:[ap]\.?m?\.?)?|\s*[ap]\.?m?\.?)$/i;
const MINUTES = /^(\d+(?:\.\d+)?)\s*(?:m|mins?|minutes?)?\.?$/i;

function clockTime(match: RegExpExecArray, at: number): ClockTime {
  const half = match[at + 2]?.toLowerCase() as ClockTime['half'];
  return { hour: Number(match[at]), minute: Number(match[at + 1] ?? 0), half };
}

function toMinutes(time: ClockTime, half = time.half): number | null {
  const { hour, minute } = time;
  if (minute > 59) return null;
  if (half) return hour >= 1 && hour <= 12 ? ((hour % 12) + (half === 'p' ? 12 : 0)) * 60 + minute : null;
  if (hour > 23) return null;
  if (hour === 0 || hour >= 13) return hour * 60 + minute;
  // Without AM/PM, read it as a school day: 7 to 11 in the morning, 12 to 6 in the afternoon
  return toMinutes(time, hour >= 7 && hour <= 11 ? 'a' : 'p');
}

// "8:00 - 8:45", "8-8:45", "8:00 AM to 8:45 AM", "1:15pm - 2"
export function parseTimeRange(text: string): { start: number; end: number } | { problem: string } | null {
  const match = TIME_RANGE.exec(text.trim());
  if (!match) return null;
  const from = clockTime(match, 1);
  const to = clockTime(match, 4);
  let start = toMinutes(from);
  let end = toMinutes(to);
  if (start === null || end === null) return { problem: `"${text}" isn't a real time.` };
  // One AM/PM can cover both times when that keeps them in order, as in "7:00 - 8:00 PM"
  if (from.half && !to.half) {
    const alternative = toMinutes(to, from.half);
    if (alternative !== null && alternative > start) end = alternative;
  }
  if (to.half && !from.half) {
    const alternative = toMinutes(from, to.half);
    if (alternative !== null && alternative < end) start = alternative;
  }
  return { start, end };
}

function formatTime(minutes: number, withHalf: boolean): string {
  const hour = Math.floor(minutes / 60);
  const text = `${hour % 12 || 12}:${pad(minutes % 60)}`;
  return withHalf ? `${text} ${hour < 12 ? 'AM' : 'PM'}` : text;
}

// "8:00 - 8:45", writing AM/PM only where a time would otherwise be read as the wrong half of the day
export function formatTimeRange(start: number, end: number): string {
  const needsHalf = (t: number) => toMinutes({ hour: Math.floor(t / 60) % 12 || 12, minute: t % 60 }) !== t;
  const short = `${formatTime(start, needsHalf(start))} - ${formatTime(end, needsHalf(end))}`;
  const read = parseTimeRange(short);
  return read && 'start' in read && read.start === start && read.end === end
    ? short
    : `${formatTime(start, true)} - ${formatTime(end, true)}`;
}

// For <input type="time">, which uses 24-hour HH:mm
export function toTimeInput(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function fromTimeInput(value: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function formatMinutes(minutes: number): string {
  return String(Math.round(minutes * 100) / 100);
}

export function parseColor(text: string): string | null {
  const word = text.trim().toLowerCase();
  const named = NAMED_COLORS.get(word);
  if (named) return named;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(word);
  if (!hex) return null;
  return hex[1].length === 3 ? `#${[...hex[1]].map(c => c + c).join('')}` : word;
}

export function colorName(color: string): string {
  const lower = color.toLowerCase();
  for (const [name, hex] of NAMED_COLORS) if (hex === lower) return name;
  return color;
}

// One name per color, leaving out aliases like grey
export const COLOR_NAMES = [...new Set(NAMED_COLORS.values())].map(colorName);
const COLOR_LIST = COLOR_NAMES.join(', ');

// ---------------------------------------------------------------------------------------------
// Checks shared by the text and the spreadsheet

const byStart = <T extends { start: number }>(a: T, b: T) => a.start - b.start;

// Times that run backwards and overlapping periods
export function periodProblems(periods: ScheduledPeriod[]): { id: string; message: string }[] {
  const problems: { id: string; message: string }[] = [];
  periods.forEach(period => {
    if (period.end <= period.start) {
      problems.push({ id: period.id, message: `"${period.name}" has to end after it starts.` });
    }
  });
  let latest: ScheduledPeriod | undefined;
  for (const period of periods.filter(p => p.end > p.start).sort(byStart)) {
    if (latest && period.start < latest.end) {
      problems.push({
        id: period.id,
        message: `"${period.name}" (${formatTimeRange(period.start, period.end)}) overlaps "${latest.name}" (${formatTimeRange(latest.start, latest.end)}).`,
      });
    }
    if (!latest || period.end > latest.end) latest = period;
  }
  return problems;
}

// Timers have to fill their period exactly
export function timerProblem(period: Pick<ScheduledPeriod, 'name' | 'start' | 'end' | 'segments'>): string | null {
  const length = period.end - period.start;
  if (period.segments.length === 0 || length <= 0) return null;
  const used = period.segments.reduce((sum, segment) => sum + (segment.durationMinutes || 0), 0);
  const missing = length - used;
  if (Math.abs(missing) < 1e-6) return null;
  return `"${period.name}" runs ${formatTimeRange(period.start, period.end)} (${formatMinutes(length)} min) but its timers add up to ${formatMinutes(used)} min. ${missing > 0 ? 'Add' : 'Remove'} ${formatMinutes(Math.abs(missing))} min.`;
}

// ---------------------------------------------------------------------------------------------
// Reading a day's text

export interface ScheduleError {
  line: number;
  message: string;
}

export type ParseResult = { periods: ScheduledPeriod[] } | { errors: ScheduleError[] };

interface TimerLine {
  line: number;
  name: string;
  minutes?: number;
  color?: string;
}

interface PeriodLine {
  line: number;
  name: string;
  time?: { start: number; end: number };
  color?: string;
  timers: TimerLine[];
  // The line itself couldn't be read, so it's skipped
  broken?: boolean;
  // One of its timers couldn't be read, so its timers aren't added up
  timersBroken?: boolean;
}

type Field =
  | { kind: 'color'; color: string }
  | { kind: 'time'; start: number; end: number }
  | { kind: 'minutes'; minutes: number }
  | { kind: 'problem'; message: string };

// Splits "name, time, color" from the right, so names can have commas in them:
// "Read, Write, Discuss, 10 min, green"
function readFields(content: string, readField: (part: string) => Field | null): { name: string; fields: Field[] } | { error: string } {
  const parts = content.split(',').map(part => part.trim()).filter(Boolean);
  const fields: Field[] = [];
  let nameEnd = parts.length;
  while (nameEnd > 1 && fields.length < 2) {
    const field = readField(parts[nameEnd - 1]);
    if (!field || fields.some(f => f.kind === field.kind)) break;
    if (field.kind === 'problem') return { error: field.message };
    fields.push(field);
    nameEnd--;
  }
  // A word after the time that isn't a color is most likely a misspelled one
  if (fields.length === 0 && nameEnd > 2) {
    const before = readField(parts[nameEnd - 2]);
    if (before && before.kind !== 'color') {
      return { error: `"${parts[nameEnd - 1]}" isn't a color. Use ${COLOR_LIST}, or a code like #ff8da1.` };
    }
  }
  const name = parts.slice(0, nameEnd).join(', ');
  return name ? { name, fields } : { error: 'This line needs a name.' };
}

function readPeriodLine(content: string): Omit<PeriodLine, 'line' | 'timers'> | { error: string } {
  const read = readFields(content, part => {
    const color = parseColor(part);
    if (color) return { kind: 'color', color };
    const range = parseTimeRange(part);
    if (range) return 'problem' in range ? { kind: 'problem', message: range.problem } : { kind: 'time', ...range };
    if (LONE_TIME.test(part)) return { kind: 'problem', message: `"${part}" needs an end time too, like: 8:00 - 8:45` };
    return null;
  });
  if ('error' in read) return read;
  const period: Omit<PeriodLine, 'line' | 'timers'> = { name: read.name };
  for (const field of read.fields) {
    if (field.kind === 'color') period.color = field.color;
    if (field.kind === 'time') period.time = { start: field.start, end: field.end };
  }
  return period;
}

function readTimerLine(content: string): Omit<TimerLine, 'line'> | { error: string } {
  const read = readFields(content, part => {
    const color = parseColor(part);
    if (color) return { kind: 'color', color };
    const minutes = MINUTES.exec(part);
    return minutes ? { kind: 'minutes', minutes: Number(minutes[1]) } : null;
  });
  if ('error' in read) return read;
  const timer: Omit<TimerLine, 'line'> = { name: read.name };
  for (const field of read.fields) {
    if (field.kind === 'color') timer.color = field.color;
    if (field.kind === 'minutes') timer.minutes = field.minutes;
  }
  if (timer.minutes === 0) return { error: `"${timer.name}" needs more than 0 minutes.` };
  return timer;
}

// Ids only need to be unique while the page is open. Not crypto.randomUUID, which browsers from
// before 2022 don't have.
export const newId = () => Math.random().toString(36).slice(2, 12);

function readLines(text: string, fail: (line: number, message: string) => void): PeriodLine[] {
  const periods: PeriodLine[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const content = raw.trim();
    if (!content) return;

    // Headings like [Monday] are for writing several days in one text
    if (content.startsWith('[')) {
      fail(line, `Leave out "${content}". Each day has its own tab above.`);
      return;
    }

    const bullet = /^[-*•]\s*/.exec(content);
    if (bullet) {
      const period = periods[periods.length - 1];
      if (!period) {
        fail(line, 'This timer needs a period above it.');
        return;
      }
      const timer = readTimerLine(content.slice(bullet[0].length));
      if ('error' in timer) {
        fail(line, timer.error);
        period.timersBroken = true;
      } else {
        period.timers.push({ line, ...timer });
      }
      return;
    }
    const period = readPeriodLine(content);
    if ('error' in period) {
      fail(line, period.error);
      periods.push({ line, name: '', timers: [], broken: true });
    } else {
      periods.push({ line, ...period, timers: [] });
    }
  });
  return periods;
}

// A period's timers, with the one that has no time filling whatever the others leave
function fitTimers(line: PeriodLine, period: ScheduledPeriod, fail: (line: number, message: string) => void): Segment[] {
  const segments = line.timers.map(timer => {
    const segment: Segment = { id: newId(), name: timer.name, durationMinutes: timer.minutes ?? 0 };
    if (timer.color) segment.color = timer.color;
    return segment;
  });
  if (line.timersBroken || segments.length === 0) return segments;
  const open = line.timers.filter(timer => timer.minutes === undefined);
  if (open.length > 1) {
    fail(open[1].line, `Only one timer in "${line.name}" can leave out its time. Give "${open[1].name}" a time.`);
    return segments;
  }
  if (open.length === 1) {
    const used = line.timers.reduce((sum, timer) => sum + (timer.minutes ?? 0), 0);
    const left = period.end - period.start - used;
    if (left > 0) {
      segments[line.timers.indexOf(open[0])].durationMinutes = left;
    } else {
      fail(line.line, `"${line.name}" runs ${formatTimeRange(period.start, period.end)} (${formatMinutes(period.end - period.start)} min) and its other timers already use ${formatMinutes(used)} min, so "${open[0].name}" gets no time.`);
    }
    return segments;
  }
  const problem = timerProblem({ ...period, name: line.name, segments });
  if (problem) fail(line.line, problem);
  return segments;
}

// One day: each period with its times, and its timers under it. Empty text means nothing is
// scheduled that day.
export function parseDay(text: string): ParseResult {
  const errors: ScheduleError[] = [];
  const fail = (line: number, message: string) => errors.push({ line, message });

  const pairs: [PeriodLine, ScheduledPeriod][] = [];
  for (const line of readLines(text, fail)) {
    if (line.broken) continue;
    if (!line.time) {
      fail(line.line, `Add a time to "${line.name}", like: ${line.name}, 8:00 - 8:45`);
      continue;
    }
    const period: ScheduledPeriod = { id: newId(), name: line.name, start: line.time.start, end: line.time.end, segments: [] };
    if (line.color) period.color = line.color;
    pairs.push([line, period]);
  }
  for (const problem of periodProblems(pairs.map(([, period]) => period))) {
    fail(pairs.find(([, period]) => period.id === problem.id)![0].line, problem.message);
  }
  const periods = pairs.map(([line, period]) => ({ ...period, segments: fitTimers(line, period, fail) }));

  if (errors.length) return { errors: errors.sort((a, b) => a.line - b.line) };
  return { periods: sortedPeriods(periods) };
}

// ---------------------------------------------------------------------------------------------
// Writing a day's text

const sortedPeriods = (periods: ScheduledPeriod[] = []) => [...periods].sort(byStart);

const nameOf = (item: { name: string }) => item.name.trim() || 'Untitled';

export function formatDay(periods: ScheduledPeriod[]): string {
  const sorted = sortedPeriods(periods);
  const lines: string[] = [];
  sorted.forEach((period, i) => {
    // Periods with timers get a blank line around them; ones without stay together
    if (i > 0 && (period.segments.length || sorted[i - 1].segments.length)) lines.push('');
    const color = period.color ? `, ${colorName(period.color)}` : '';
    lines.push(`${nameOf(period)}, ${formatTimeRange(period.start, period.end)}${color}`);
    for (const segment of period.segments) {
      const color = segment.color ? `, ${colorName(segment.color)}` : '';
      lines.push(`- ${nameOf(segment)}, ${formatMinutes(segment.durationMinutes)} min${color}`);
    }
  });
  return lines.length ? `${lines.join('\n')}\n` : '';
}

// ---------------------------------------------------------------------------------------------
// Using the schedule

export function periodsForDate(schedule: Schedule, date: Date): ScheduledPeriod[] {
  return schedule.specials[dateKey(date)] ?? schedule.weekdays[weekdayOf(date)] ?? [];
}

// The date's timeline for the timer, starting at its first period. Gaps between periods become
// passing time.
export function resolveDay(schedule: Schedule, date: Date): { startMinutes: number; periods: Period[] } {
  const scheduled = sortedPeriods(periodsForDate(schedule, date)).filter(p => p.end > p.start);
  const periods: Period[] = [];
  let clock = scheduled[0]?.start ?? 0;
  for (const period of scheduled) {
    // Overlaps can't be written in the text, but the spreadsheet can make them
    const start = Math.max(period.start, clock);
    if (period.end <= start) continue;
    if (start > clock) {
      periods.push({ id: `passing-${clock}`, name: 'Passing', durationMinutes: start - clock, type: 'transition', segments: [] });
    }
    periods.push({ id: period.id, name: period.name, durationMinutes: period.end - start, type: 'period', color: period.color, segments: period.segments });
    clock = period.end;
  }
  return { startMinutes: scheduled[0]?.start ?? 0, periods };
}

export function dropPastSpecials(schedule: Schedule, today: Date): Schedule {
  const todayKey = dateKey(today);
  return {
    ...schedule,
    specials: Object.fromEntries(Object.entries(schedule.specials).filter(([date]) => date >= todayKey)),
  };
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Takes the first item with this name out of the list
function takeByName<T extends { name: string }>(items: T[], name: string): T | undefined {
  const i = items.findIndex(item => sameName(item.name, name));
  return i === -1 ? undefined : items.splice(i, 1)[0];
}

// Keeps the ids of periods and timers whose names didn't change. Applying the text otherwise
// looks like a new period starting, which rings the bell partway through.
export function keepIds(next: ScheduledPeriod[], previous: ScheduledPeriod[]): ScheduledPeriod[] {
  const unused = [...previous];
  return next.map(period => {
    const old = takeByName(unused, period.name);
    if (!old) return period;
    const unusedSegments = [...old.segments];
    const segments = period.segments.map(segment => {
      const match = takeByName(unusedSegments, segment.name);
      return match ? { ...segment, id: match.id } : segment;
    });
    return { ...period, id: old.id, segments };
  });
}

// ---------------------------------------------------------------------------------------------
// Bookmarks

// Ids only matter while the page is open (see keepIds), and random ones would be most of a
// bookmark's length. So bookmarks save the schedule without them, and loading makes new ones.
export type SavedPeriod = Omit<ScheduledPeriod, 'id' | 'segments'> & { segments: Omit<Segment, 'id'>[] };
type Days<T> = { weekdays: Partial<Record<Weekday, T[]>>; specials: Record<string, T[]> };

function mapDays<A, B>(schedule: Days<A>, fn: (periods: A[]) => B[]): Days<B> {
  const map = (days: Partial<Record<string, A[]>>) =>
    Object.fromEntries(Object.entries(days).flatMap(([key, periods]) => (periods ? [[key, fn(periods)]] : [])));
  return { weekdays: map(schedule.weekdays), specials: map(schedule.specials) };
}

export function withoutIds(schedule: Schedule): Days<SavedPeriod> {
  return mapDays(schedule, periods =>
    periods.map(({ id, segments, ...period }) => ({ ...period, segments: segments.map(({ id, ...segment }) => segment) })),
  );
}

export function withNewIds(schedule: Days<SavedPeriod>): Schedule {
  return mapDays(schedule, periods =>
    periods.map(period => ({ ...period, id: newId(), segments: period.segments.map(segment => ({ ...segment, id: newId() })) })),
  );
}

// The old single schedule (periods back to back from one start time) becomes the same bell times
// and timers on every weekday
export function scheduleFromLegacy(periods: Period[], startTime = '08:00'): Schedule {
  const [hours, minutes] = startTime.split(':').map(Number);
  let clock = (hours || 0) * 60 + (minutes || 0);
  const day: ScheduledPeriod[] = [];
  for (const period of periods) {
    const segments = period.segments ?? [];
    const length = segments.length ? segments.reduce((sum, s) => sum + (s.durationMinutes || 0), 0) : period.durationMinutes || 0;
    const start = clock;
    clock += length;
    // Passing time is now just the gap between periods
    if ((period.type === 'transition' && segments.length === 0) || length <= 0) continue;
    const scheduled: ScheduledPeriod = { id: period.id, name: period.name, start: Math.round(start), end: Math.round(clock), segments };
    if (period.color) scheduled.color = period.color;
    day.push(scheduled);
  }
  return {
    weekdays: Object.fromEntries(WEEKDAYS.slice(0, 5).map(weekday => [weekday, day])),
    specials: {},
  };
}
