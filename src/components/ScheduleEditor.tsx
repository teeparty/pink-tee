import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { Schedule, ScheduledPeriod, Weekday } from '../types';
import { WEEKDAYS, dateKey, dayName, formatDate, formatDayAndDate, weekdayOf } from '../schedule';
import { Spreadsheet } from './Spreadsheet';
import { ScheduleText } from './ScheduleText';

interface ScheduleEditorProps {
  view: 'table' | 'text';
  schedule: Schedule;
  onChange: (schedule: Schedule) => void;
  // Each day's text that hasn't been applied yet, by tab
  drafts: Record<string, string>;
  onDraftsChange: (drafts: Record<string, string>) => void;
  now: Date;
  themeColor: string;
  activePeriodId: string | null;
}

// Tabs are weekdays, or the YYYY-MM-DD dates of one-off days
const isDate = (tab: string) => /^\d{4}-\d{2}-\d{2}$/.test(tab);
const weekdayOfKey = (date: string) => weekdayOf(new Date(`${date}T00:00`));

// Picks a day, then edits it as a table or as text
export function ScheduleEditor({ view, schedule, onChange, drafts, onDraftsChange, now, themeColor, activePeriodId }: ScheduleEditorProps) {
  const todayKey = dateKey(now);
  const todaysTab = schedule.specials[todayKey] ? todayKey : weekdayOf(now);
  const [selectedTab, setSelectedTab] = useState<string>(todaysTab);
  const [newDate, setNewDate] = useState<string | null>(null);

  // A one-off day that was removed (or has passed) falls back to its weekday
  const tab = isDate(selectedTab) && !schedule.specials[selectedTab] ? weekdayOfKey(selectedTab) : selectedTab;
  const tabWeekday = isDate(tab) ? weekdayOfKey(tab) : tab as Weekday;
  const weekdayTabs = WEEKDAYS.filter((day, i) => i < 5 || (schedule.weekdays[day]?.length ?? 0) > 0 || day === tab);
  const specialTabs = Object.keys(schedule.specials).filter(date => date >= todayKey).sort();

  const periods = (isDate(tab) ? schedule.specials[tab] : schedule.weekdays[tab as Weekday]) ?? [];
  const setPeriods = (next: ScheduledPeriod[]) => {
    onChange(isDate(tab)
      ? { ...schedule, specials: { ...schedule.specials, [tab]: next } }
      : { ...schedule, weekdays: { ...schedule.weekdays, [tab]: next } });
  };

  const withoutDraft = (key: string) => {
    const { [key]: _removed, ...rest } = drafts;
    return rest;
  };
  const setDraft = (draft: string | null) => {
    onDraftsChange(draft === null ? withoutDraft(tab) : { ...drafts, [tab]: draft });
  };

  const handleAddSpecial = () => {
    if (!newDate || newDate < todayKey) return;
    if (!schedule.specials[newDate]) {
      // Start from the regular day, keeping its ids so today doesn't look like a new period starting
      const regular = schedule.weekdays[weekdayOfKey(newDate)] ?? [];
      onChange({ ...schedule, specials: { ...schedule.specials, [newDate]: regular.map(p => ({ ...p, segments: p.segments.map(seg => ({ ...seg })) })) } });
    }
    setSelectedTab(newDate);
    setNewDate(null);
  };

  const handleRemoveSpecial = () => {
    if (!window.confirm(`Remove the one-off schedule for ${formatDayAndDate(tab, now)}? That day will use the regular ${dayName(tabWeekday)} schedule again.`)) return;
    const { [tab]: _removed, ...specials } = schedule.specials;
    onChange({ ...schedule, specials });
    if (drafts[tab] !== undefined) onDraftsChange(withoutDraft(tab));
    setSelectedTab(tabWeekday);
  };

  const tabButton = (key: string, label: string) => (
    <button
      key={key}
      onClick={() => setSelectedTab(key)}
      className="flex items-center gap-1 px-3 py-1 text-xs font-bold uppercase border-2 hover:opacity-80"
      style={tab === key
        ? { borderColor: themeColor, backgroundColor: themeColor, color: 'white' }
        : { borderColor: `${themeColor}40`, color: themeColor }}
      title={[key === todaysTab && 'Today', drafts[key] !== undefined && 'Text not applied yet'].filter(Boolean).join('. ') || undefined}
    >
      {label}
      {drafts[key] !== undefined && '*'}
      {key === todaysTab && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tab === key ? 'white' : themeColor }} />}
    </button>
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-white font-sans text-sm">
      {/* Days */}
      <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b-2" style={{ borderColor: `${themeColor}40` }}>
        {weekdayTabs.map(day => tabButton(day, dayName(day).slice(0, 3)))}
        {specialTabs.length > 0 && <div className="w-0.5 h-5 mx-1" style={{ backgroundColor: `${themeColor}40` }} />}
        {specialTabs.map(date => tabButton(date, `${dayName(weekdayOfKey(date)).slice(0, 3)} ${formatDate(date, now)}`))}
        {newDate === null ? (
          <button
            onClick={() => setNewDate('')}
            className="flex items-center gap-1 px-3 py-1 text-xs font-bold uppercase border-2 border-dashed hover:bg-black/5 ml-1"
            style={{ borderColor: themeColor, color: themeColor }}
            title="Change the schedule for one date only"
          >
            <CalendarPlus size={12} /> One-off day
          </button>
        ) : (
          <div className="flex items-center gap-1 ml-1">
            <input
              type="date"
              min={todayKey}
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="px-2 py-0.5 text-xs border-2 outline-none"
              style={{ borderColor: themeColor, color: themeColor }}
              autoFocus
            />
            <button
              onClick={handleAddSpecial}
              disabled={!newDate || newDate < todayKey}
              className="px-3 py-1 text-xs font-bold uppercase border-2 disabled:opacity-40"
              style={{ borderColor: themeColor, backgroundColor: themeColor, color: 'white' }}
            >
              Add
            </button>
            <button
              onClick={() => setNewDate(null)}
              className="px-3 py-1 text-xs font-bold uppercase hover:opacity-70"
              style={{ color: themeColor }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 px-4 py-1.5 text-xs border-b-2 bg-gray-50/50" style={{ borderColor: `${themeColor}40`, color: themeColor }}>
        {isDate(tab) ? (
          <>
            <span>Only on {formatDayAndDate(tab, now)}, instead of the regular {dayName(tabWeekday)} schedule.</span>
            <button onClick={handleRemoveSpecial} className="font-bold uppercase underline hover:opacity-70">
              Back to regular {dayName(tabWeekday)}
            </button>
          </>
        ) : (
          <span>Every {dayName(tabWeekday)}. To change one date only, add a one-off day.</span>
        )}
      </div>

      {view === 'table' ? (
        <Spreadsheet
          periods={periods}
          onChange={setPeriods}
          themeColor={themeColor}
          activePeriodId={tab === todaysTab ? activePeriodId : null}
        />
      ) : (
        <ScheduleText
          key={tab}
          periods={periods}
          onChange={setPeriods}
          draft={drafts[tab] ?? null}
          onDraftChange={setDraft}
          themeColor={themeColor}
        />
      )}
    </div>
  );
}
