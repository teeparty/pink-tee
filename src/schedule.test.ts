import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatDay, formatDayAndDate, keepIds, parseDay, parseTimeRange, resolveDay, scheduleFromLegacy, withNewIds, withoutIds as bookmarkSchedule } from './schedule.ts';
import type { Period, Schedule, ScheduledPeriod } from './types.ts';

// Monday, Oct 12 2026
const today = new Date(2026, 9, 12);

const monday = `Win, 8:00 - 8:45
- Getting Started, 5 min, yellow
- Work Time: Reading/RACE, 25 min, green
- Cool Down, 10 min
- Finishing Up, 5 min, red
Reading, 8:50 - 9:50
Math, 9:55 - 10:40
- Warm Up, 10
- Lesson, 25
- Exit Ticket, 10
Lunch, 11:00 - 11:30
`;

function parse(text: string): ScheduledPeriod[] {
  const result = parseDay(text);
  if ('errors' in result) assert.fail(result.errors.map(e => `Line ${e.line}: ${e.message}`).join('\n'));
  return result.periods;
}

function errors(text: string): string[] {
  const result = parseDay(text);
  assert.ok('errors' in result, 'expected the text to have errors');
  return result.errors.map(e => `Line ${e.line}: ${e.message}`);
}

// Ids are random, so leave them out when comparing
function withoutIds(value: unknown) {
  return JSON.parse(JSON.stringify(value, (key, v) => (key === 'id' ? undefined : v)));
}

const summary = (periods: { name: string; start: number; end: number; segments: { name: string; durationMinutes: number }[] }[] = []) =>
  periods.map(p => `${p.name} ${p.start}-${p.end}: ${p.segments.map(s => `${s.name} ${s.durationMinutes}`).join(', ')}`);

test('reads periods with their timers', () => {
  const periods = parse(monday);
  assert.deepEqual(summary(periods), [
    'Win 480-525: Getting Started 5, Work Time: Reading/RACE 25, Cool Down 10, Finishing Up 5',
    'Reading 530-590: ',
    'Math 595-640: Warm Up 10, Lesson 25, Exit Ticket 10',
    'Lunch 660-690: ',
  ]);
  assert.deepEqual(periods[0].segments.map(s => s.color), ['#eab308', '#22c55e', undefined, '#ef4444']);
});

test('accepts the times and durations from the original idea', () => {
  const [win] = parse(`Win, 8:00 AM - 8:45 AM, pink
*Getting Started, 5 min, yellow
*Work Time: Reading/RACE, 25 minutes, green
*Cool Down, 10 min
*Finishing Up, 5 min, red
`);
  assert.deepEqual(summary([win]), ['Win 480-525: Getting Started 5, Work Time: Reading/RACE 25, Cool Down 10, Finishing Up 5']);
  assert.equal(win.color, '#ff8da1');
});

test('names can have commas, colons and slashes in them', () => {
  const [period] = parse(`Reading/Writing: Block A, 8:00 - 8:30, #123ABC
- Read, Write, Discuss, 10 min, green
- Share Out, #abc
`);
  assert.equal(period.name, 'Reading/Writing: Block A');
  assert.equal(period.color, '#123abc');
  assert.deepEqual(period.segments.map(s => [s.name, s.durationMinutes, s.color]), [
    ['Read, Write, Discuss', 10, '#22c55e'],
    ['Share Out', 20, '#aabbcc'],
  ]);
});

test('a timer without a time fills the rest of its period', () => {
  assert.deepEqual(summary(parse(`Win, 8:00 - 8:45
- Getting Started, 5
- Work Time
- Finishing Up, 10
`)), ['Win 480-525: Getting Started 5, Work Time 30, Finishing Up 10']);
});

test('reads AM and PM the way a school day runs', () => {
  const cases: [string, number, number][] = [
    ['8:00 - 8:45', 480, 525],
    ['8-8:45', 480, 525],
    ['8:00 AM - 8:45 AM', 480, 525],
    ['8:00 a.m. to 8:45 a.m.', 480, 525],
    ['11:30 - 12:15', 690, 735],
    ['11:30 - 12:15 PM', 690, 735],
    ['12:30 - 1:15', 750, 795],
    ['1:15pm - 2', 795, 840],
    ['6:30 AM - 7:15', 390, 435],
    ['7:00 - 8:00 PM', 1140, 1200],
    ['13:00 - 14:30', 780, 870],
  ];
  for (const [text, start, end] of cases) assert.deepEqual(parseTimeRange(text), { start, end }, text);
  assert.deepEqual(parseTimeRange('8:75 - 9'), { problem: '"8:75 - 9" isn\'t a real time.' });
  assert.equal(parseTimeRange('45 min'), null);
});

test('puts periods in time order, allows repeated names, and reads empty text as nothing scheduled', () => {
  assert.deepEqual(summary(parse('Math, 12:00 - 12:45\nWin, 8:00 - 8:45\nMath, 9:00 - 9:45\n')), [
    'Win 480-525: ',
    'Math 540-585: ',
    'Math 720-765: ',
  ]);
  assert.deepEqual(parse(''), []);
  assert.deepEqual(parse('\n  \n'), []);
});

test('reports timers that do not fill their period', () => {
  assert.deepEqual(errors(`Win, 8:00 - 8:45
- Getting Started, 5 min
- Work Time, 25 min
- Finishing Up, 5 min
Math, 9:00 - 9:45
- Work Time, 50
`), [
    'Line 1: "Win" runs 8:00 - 8:45 (45 min) but its timers add up to 35 min. Add 10 min.',
    'Line 5: "Math" runs 9:00 - 9:45 (45 min) but its timers add up to 50 min. Remove 5 min.',
  ]);
});

test('reports problems with timers that leave out their time', () => {
  assert.deepEqual(errors(`Win, 8:00 - 8:45
- Getting Started
- Work Time
Math, 9:00 - 9:30
- Lesson, 30
- Exit Ticket
`), [
    'Line 3: Only one timer in "Win" can leave out its time. Give "Work Time" a time.',
    'Line 4: "Math" runs 9:00 - 9:30 (30 min) and its other timers already use 30 min, so "Exit Ticket" gets no time.',
  ]);
});

test('reports unknown colors', () => {
  const notAColor = '"chartreuse" isn\'t a color. Use red, orange, yellow, green, teal, blue, purple, pink, gray, brown, black, or a code like #ff8da1.';
  assert.deepEqual(errors(`Math, 9:00 - 9:45, chartreuse
Reading, 10:00 - 10:30
- Warm Up, 10, chartreuse
- Lesson, 20
`), [`Line 1: ${notAColor}`, `Line 3: ${notAColor}`]);
});

test('reports lines that are missing something or out of place', () => {
  assert.deepEqual(errors(`[Monday]
- Getting Started, 5
Win, 8:00
Math
Reading, 9:00 - 9:45
- Warm Up, 0
`), [
    'Line 1: Leave out "[Monday]". Each day has its own tab above.',
    'Line 2: This timer needs a period above it.',
    'Line 3: "8:00" needs an end time too, like: 8:00 - 8:45',
    'Line 4: Add a time to "Math", like: Math, 8:00 - 8:45',
    'Line 6: "Warm Up" needs more than 0 minutes.',
  ]);
});

test('reports overlapping periods and times that run backwards', () => {
  assert.deepEqual(errors(`Win, 8:00 - 8:45
Reading, 8:30 - 9:30
Math, 11:00 - 10:00
`), [
    'Line 2: "Reading" (8:30 - 9:30) overlaps "Win" (8:00 - 8:45).',
    'Line 3: "Math" has to end after it starts.',
  ]);
});

test('writes a day back as text', () => {
  const text = formatDay(parse(monday));
  assert.equal(text, `Win, 8:00 - 8:45
- Getting Started, 5 min, yellow
- Work Time: Reading/RACE, 25 min, green
- Cool Down, 10 min
- Finishing Up, 5 min, red

Reading, 8:50 - 9:50

Math, 9:55 - 10:40
- Warm Up, 10 min
- Lesson, 25 min
- Exit Ticket, 10 min

Lunch, 11:00 - 11:30
`);
  assert.deepEqual(withoutIds(parse(text)), withoutIds(parse(monday)));
  assert.equal(formatDay([]), '');
});

test('writes AM/PM only where it is needed', () => {
  const text = 'Breakfast, 6:30 AM - 7:15\nMovie, 7:00 PM - 9:00 PM\n';
  assert.equal(formatDay(parse(text)), text);
});

test('writes dates with the year only when it is needed', () => {
  assert.equal(formatDayAndDate('2026-10-14', today), 'Wednesday, Oct 14');
  assert.equal(formatDate('2027-01-05', new Date(2026, 11, 20)), 'Jan 5');
  // From June, the closest Jan 5 is the one that already passed
  assert.equal(formatDate('2027-01-05', new Date(2026, 5, 1)), 'Jan 5, 2027');
});

test('works out the day, with gaps as passing time', () => {
  const schedule: Schedule = {
    weekdays: {
      monday: parse(monday),
      wednesday: parse('Win, 8:30 - 9:05\nReading, 9:10 - 10:00\nMath, 10:05 - 10:45\nLunch, 11:00 - 11:30\n'),
    },
    specials: {
      '2026-10-14': parse('Win, 8:30 - 9:00\n- Getting Started, 5\n- Work Time, 25\nAssembly, 9:05 - 9:45\nReading, 9:50 - 10:35\nMath, 10:40 - 11:15\nLunch, 11:20 - 11:50\n'),
    },
  };
  const blocks = (periods: Period[]) => periods.map(p => `${p.type === 'transition' ? '~' : ''}${p.name} ${p.durationMinutes}`);

  const day = resolveDay(schedule, today);
  assert.equal(day.startMinutes, 480);
  assert.deepEqual(blocks(day.periods), ['Win 45', '~Passing 5', 'Reading 60', '~Passing 5', 'Math 45', '~Passing 20', 'Lunch 30']);
  // Passing ids have to stay the same from tick to tick, or the bell rings every tick
  assert.equal(day.periods[1].id, resolveDay(schedule, today).periods[1].id);

  const special = resolveDay(schedule, new Date(2026, 9, 14));
  assert.equal(special.startMinutes, 510);
  assert.deepEqual(blocks(special.periods), ['Win 30', '~Passing 5', 'Assembly 40', '~Passing 5', 'Reading 45', '~Passing 5', 'Math 35', '~Passing 5', 'Lunch 30']);

  assert.deepEqual(blocks(resolveDay(schedule, new Date(2026, 9, 21)).periods), ['Win 35', '~Passing 5', 'Reading 50', '~Passing 5', 'Math 40', '~Passing 15', 'Lunch 30']);
  assert.deepEqual(resolveDay(schedule, new Date(2026, 9, 17)).periods, []);
});

test('keeps ids for periods and timers whose names did not change', () => {
  const before = parse(monday);
  const [win] = keepIds(parse(monday.replace('- Cool Down, 10 min', '- Wrap Up, 10 min')), before);
  assert.equal(win.id, before[0].id);
  assert.deepEqual(win.segments.map((s, i) => s.id === before[0].segments[i].id), [true, true, false, true]);

  // Periods with the same name each keep their own id
  const twice = parse('Math, 8:00 - 8:45\nMath, 9:00 - 9:45\n');
  assert.deepEqual(keepIds(parse('Math, 8:00 - 8:45\nMath, 9:00 - 9:50\n'), twice).map(p => p.id), twice.map(p => p.id));
});

test('bookmarks leave out ids and get new ones when loaded', () => {
  const schedule: Schedule = { weekdays: { monday: parse(monday) }, specials: { '2026-10-16': parse('Assembly, 9:00 - 10:00\n') } };
  const saved = bookmarkSchedule(schedule);
  assert.ok(!JSON.stringify(saved).includes('"id"'));

  const loaded = withNewIds(JSON.parse(JSON.stringify(saved)));
  assert.equal(formatDay(loaded.weekdays.monday!), formatDay(schedule.weekdays.monday!));
  assert.equal(formatDay(loaded.specials['2026-10-16']), 'Assembly, 9:00 - 10:00\n');
  const ids = (s: Schedule) => [...Object.values(s.weekdays), ...Object.values(s.specials)].flat().flatMap(p => [p!.id, ...p!.segments.map(t => t.id)]);
  assert.equal(new Set([...ids(schedule), ...ids(loaded)]).size, ids(schedule).length * 2);
});

test('turns the old single schedule into the same day every weekday', () => {
  const schedule = scheduleFromLegacy([
    { id: '1', name: 'Period 1', durationMinutes: 45, type: 'period', segments: [{ id: 's1', name: 'Intro', durationMinutes: 10 }, { id: 's2', name: 'Activity', durationMinutes: 35 }] },
    { id: '2', name: 'Passing', durationMinutes: 5, type: 'transition', segments: [] },
    { id: '3', name: 'Period 2', durationMinutes: 45, type: 'period', color: '#3b82f6', segments: [] },
  ], '08:00');
  assert.deepEqual(Object.keys(schedule.weekdays), ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  assert.equal(formatDay(schedule.weekdays.friday!), 'Period 1, 8:00 - 8:45\n- Intro, 10 min\n- Activity, 35 min\n\nPeriod 2, 8:50 - 9:35, blue\n');
});
