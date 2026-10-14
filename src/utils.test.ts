import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stateFromJson, stateToJson } from './utils.ts';
import type { AppState } from './types.ts';

const state = {
  themeColor: '#FF8DA1',
  uiTitle: 'ROOM 12',
  audioMode: 'voice',
  pronunciations: [{ id: 'p1', original: 'Mrs', replacement: 'Missus' }],
  clock: { style: 'pie', ringThickness: 120, labelScale: 1.5 },
  windows: { timer: { id: 'timer', x: 10, y: 20, width: 600, height: 600, isOpen: true, zIndex: 10 } },
  schedule: {
    weekdays: {
      monday: [{ id: 'a', name: 'Math', start: 480, end: 525, segments: [{ id: 'b', name: 'Warm Up', durationMinutes: 45 }] }],
    },
    specials: { '2026-10-16': [{ id: 'c', name: 'Assembly', start: 540, end: 600, segments: [] }] },
  },
} as unknown as AppState;

test('a setup file keeps every setting, with new schedule ids', () => {
  const json = stateToJson(state, 2);
  assert.ok(json.includes('\n  "uiTitle": "ROOM 12"'), 'expected readable JSON');
  assert.ok(!json.includes('"id": "a"'));

  const loaded = stateFromJson(json)!;
  const withoutScheduleIds = (s: AppState) => ({ ...s, schedule: JSON.parse(JSON.stringify(s.schedule, (k, v) => (k === 'id' ? undefined : v))) });
  assert.deepEqual(withoutScheduleIds(loaded), withoutScheduleIds(state));
  const monday = loaded.schedule.weekdays.monday!;
  assert.ok(monday[0].id && monday[0].segments[0].id && loaded.schedule.specials['2026-10-16'][0].id);
  assert.equal(loaded.pronunciations[0].id, 'p1');
});

test('files that are not a setup are turned away', () => {
  for (const json of ['', 'not json', 'null', '[]', '42', '{"themeColor":"#fff"}', '{"schedule":5}']) {
    assert.equal(stateFromJson(json), null, json);
  }
});

test('older setups with one list of periods still load', () => {
  const old = { uiTitle: 'OLD', startTime: '08:00', periods: [{ id: '1', name: 'Period 1', durationMinutes: 45, type: 'period', segments: [] }] };
  assert.deepEqual(stateFromJson(JSON.stringify(old)), old);
});
