import React from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverEvent, useDroppable } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ScheduledPeriod, Segment } from '../types';
import { GripVertical, Trash2, Plus, Copy } from 'lucide-react';
import { formatMinutes, fromTimeInput, newId, periodProblems, timerProblem, toTimeInput } from '../schedule';

// One day's periods as a table
interface SpreadsheetProps {
  periods: ScheduledPeriod[];
  onChange: (periods: ScheduledPeriod[]) => void;
  themeColor: string;
  activePeriodId: string | null;
}

function SortableSegment({ seg, periodColor, themeColor, onUpdate, onCopy, onDelete }: { seg: Segment, periodColor?: string, themeColor: string, onUpdate: (id: string, updates: Partial<Segment>) => void, onCopy: (seg: Segment) => void, onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: seg.id,
    data: {
      type: 'Segment',
      segment: seg,
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const segColor = seg.color || periodColor || themeColor;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderColor: segColor, color: segColor }}
      className="flex items-center text-xs uppercase border border-dashed bg-white"
    >
      <div 
        className="p-1 cursor-move opacity-50 px-2 border-r border-dashed" 
        style={{ borderColor: segColor }}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={12} />
      </div>
      <div className="px-1 border-r border-dashed" style={{ borderColor: segColor }}>
        <input 
          type="color" 
          value={segColor} 
          onChange={e => onUpdate(seg.id, { color: e.target.value })} 
          className="w-4 h-4 p-0 border-none cursor-pointer bg-transparent" 
          title="Segment Color"
        />
      </div>
      <input 
        className="bg-transparent border-none outline-none font-bold w-24 p-1 px-2"
        value={seg.name}
        onChange={e => onUpdate(seg.id, { name: e.target.value })}
      />
      <input 
        type="number"
        className="bg-transparent border-none outline-none text-right w-10 p-1 opacity-80"
        value={seg.durationMinutes}
        onChange={e => onUpdate(seg.id, { durationMinutes: Number(e.target.value) || 0 })}
      />
      <span className="opacity-80 py-1 pr-2">m</span>
      <button onClick={() => onCopy(seg)} className="p-1.5 border-l border-dashed hover:bg-black/5" style={{ borderColor: themeColor }}>
        <Copy size={12} />
      </button>
      <button onClick={() => onDelete(seg.id)} className="p-1.5 border-l border-dashed hover:bg-black/5" style={{ borderColor: themeColor }}>
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function PeriodRow({ 
  period, 
  themeColor, 
  onDelete, 
  onChange,
  onCopy,
  onTimeBlur,
  problems,
  isActive
}: { 
  period: ScheduledPeriod, 
  themeColor: string, 
  onDelete: (id: string) => void,
  onChange: (id: string, updates: Partial<ScheduledPeriod>) => void,
  onCopy: (p: ScheduledPeriod) => void,
  onTimeBlur: () => void,
  problems: string[],
  isActive: boolean
}) {
  // Rows are drop targets so segments can be dragged into a period with none
  const { setNodeRef } = useDroppable({ 
    id: period.id,
    data: {
      type: 'Period',
      period
    }
  });

  const handleSegmentUpdate = (segmentId: string, updates: Partial<Segment>) => {
    const updatedSegments = (period.segments || []).map(s => s.id === segmentId ? { ...s, ...updates } : s);
    onChange(period.id, { segments: updatedSegments });
  };

  const handleAddSegment = () => {
    const newSeg: Segment = {
      id: newId(),
      name: `Seg ${(period.segments || []).length + 1}`,
      durationMinutes: 5
    };
    onChange(period.id, { segments: [...(period.segments || []), newSeg] });
  };

  const handleCopySegment = (seg: Segment) => {
    const cloned = { ...seg, id: newId() };
    onChange(period.id, { segments: [...(period.segments || []), cloned] });
  };

  const handleDeleteSegment = (segmentId: string) => {
    const updatedSegments = (period.segments || []).filter(s => s.id !== segmentId);
    onChange(period.id, { segments: updatedSegments });
  };

  const handleTimeChange = (field: 'start' | 'end', value: string) => {
    const minutes = fromTimeInput(value);
    if (minutes !== null) onChange(period.id, { [field]: minutes });
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex items-stretch border-b-2 border-l-4 bg-white transition-colors ${isActive ? 'bg-black/5' : ''}`}
      style={{ borderColor: `${themeColor}40`, borderLeftColor: period.color || 'transparent' }}
    >

      {/* Label & Style */}
      <div className="w-64 p-3 border-r-2 flex flex-col justify-center gap-2" style={{ borderColor: `${themeColor}40` }}>
        <input 
          value={period.name}
          onChange={e => onChange(period.id, { name: e.target.value })}
          className="w-full bg-transparent border-none outline-none font-bold uppercase"
          style={{ color: period.color || themeColor }}
          placeholder="PERIOD NAME"
        />
        <div className="flex items-center gap-2 text-xs uppercase opacity-70">
          <input 
            type="color" 
            value={period.color || themeColor} 
            onChange={e => onChange(period.id, { color: e.target.value })} 
            className="w-5 h-5 p-0 border cursor-pointer border-dashed bg-transparent"
            style={{ borderColor: themeColor }} 
            title="Block Highlight Color"
          />
          <span>Block Color</span>
        </div>
      </div>
      
      {/* Slot Time */}
      <div className="w-60 p-3 border-r-2 flex flex-col justify-center gap-1" style={{ borderColor: `${themeColor}40` }}>
        <div className="flex items-center gap-1 text-sm font-bold" style={{ color: themeColor }}>
          {(['start', 'end'] as const).map((field, i) => (
            <React.Fragment key={field}>
              {i > 0 && <span>-</span>}
              <input 
                type="time"
                value={toTimeInput(period[field])}
                onChange={e => handleTimeChange(field, e.target.value)}
                onBlur={onTimeBlur}
                className="bg-transparent border-b outline-none w-[6.5rem]"
                style={{ borderColor: themeColor }}
                title={field === 'start' ? 'Start Time' : 'End Time'}
              />
            </React.Fragment>
          ))}
        </div>
        <div className="text-xs uppercase opacity-70">
          Total {formatMinutes(period.end - period.start)} mins
        </div>
        {problems.map(message => (
          <div key={message} className="text-xs text-red-500">{message}</div>
        ))}
      </div>

      {/* Segments */}
      <div className="flex-1 p-3 flex flex-wrap gap-2 content-start overflow-auto">
        <SortableContext items={(period.segments || []).map(s => s.id)} strategy={horizontalListSortingStrategy}>
          {(period.segments || []).map(seg => (
            <SortableSegment 
              key={seg.id}
              seg={seg}
              periodColor={period.color}
              themeColor={themeColor}
              onUpdate={handleSegmentUpdate}
              onCopy={handleCopySegment}
              onDelete={handleDeleteSegment}
            />
          ))}
        </SortableContext>
        
        <button 
          onClick={handleAddSegment}
          className="flex items-center gap-1 text-xs uppercase font-bold border px-2 py-1 hover:bg-black/5"
          style={{ borderColor: themeColor, color: themeColor }}
        >
          <Plus size={12} /> SEC
        </button>
      </div>

      {/* Actions */}
      <div className="w-32 p-3 flex items-center justify-center gap-3">
        <button onClick={() => onCopy(period)} className="opacity-70 hover:opacity-100" style={{ color: themeColor }}>
          <Copy size={16} />
        </button>
        <button onClick={() => onDelete(period.id)} className="opacity-70 hover:opacity-100" style={{ color: '#ef4444' }}>
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export function Spreadsheet({ periods, onChange: setPeriods, themeColor, activePeriodId }: SpreadsheetProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const problems = new Map<string, string[]>();
  const addProblem = (id: string, message: string) => problems.set(id, [...(problems.get(id) ?? []), message]);
  periodProblems(periods).forEach(({ id, message }) => addProblem(id, message));
  periods.forEach(p => {
    const message = timerProblem(p);
    if (message) addProblem(p.id, message);
  });

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    if (activeType !== 'Segment') return;

    const activeSegmentId = active.id;
    const overId = over.id;

    // Find the periods containing these segments
    const activePeriodIndex = periods.findIndex(p => p.segments.find(s => s.id === activeSegmentId));
    let overPeriodIndex = periods.findIndex(p => p.segments.find(s => s.id === overId));
    
    // If we're dragging over an empty period, over.id will be the period's id
    if (overPeriodIndex === -1 && overType === 'Period') {
       overPeriodIndex = periods.findIndex(p => p.id === overId);
    }

    if (activePeriodIndex === -1 || overPeriodIndex === -1) return;
    if (activePeriodIndex === overPeriodIndex) return; // handled in drag end for same period

    // moving from one period to another
    const newPeriods = [...periods];
    const activePeriod = { ...newPeriods[activePeriodIndex] };
    const overPeriod = { ...newPeriods[overPeriodIndex] };

    const activeSegmentIndex = activePeriod.segments.findIndex(s => s.id === activeSegmentId);
    let overSegmentIndex = overPeriod.segments.findIndex(s => s.id === overId);

    const segment = activePeriod.segments[activeSegmentIndex];

    activePeriod.segments = [...activePeriod.segments];
    activePeriod.segments.splice(activeSegmentIndex, 1);

    overPeriod.segments = [...overPeriod.segments];
    if (overSegmentIndex === -1) {
       overPeriod.segments.push(segment); // dropped onto empty period
    } else {
       // if we are dragging over an item, we usually push before or after based on pointer, but dnd-kit normally does before
       overPeriod.segments.splice(overSegmentIndex, 0, segment);
    }

    newPeriods[activePeriodIndex] = activePeriod;
    newPeriods[overPeriodIndex] = overPeriod;

    setPeriods(newPeriods);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    if (activeType !== 'Segment') return;

    // It might be reordering within the same period
    const activePeriodIndex = periods.findIndex(p => p.segments.find(s => s.id === active.id));
    
    let overPeriodIndex = periods.findIndex(p => p.segments.find(s => s.id === over.id));
    if (overPeriodIndex === -1 && overType === 'Period') {
       overPeriodIndex = periods.findIndex(p => p.id === over.id);
    }

    if (activePeriodIndex !== -1 && activePeriodIndex === overPeriodIndex) {
      const activePeriod = periods[activePeriodIndex];
      const oldIndex = activePeriod.segments.findIndex(s => s.id === active.id);
      const newIndex = overType === 'Period' 
          ? activePeriod.segments.length // dropping on the container appends to end
          : activePeriod.segments.findIndex(s => s.id === over.id);

      if (oldIndex !== newIndex && newIndex !== -1) {
        const newPeriods = [...periods];
        newPeriods[activePeriodIndex] = {
          ...activePeriod,
          segments: arrayMove(activePeriod.segments, oldIndex, newIndex)
        };
        setPeriods(newPeriods);
      }
    }
  };

  // New and copied periods go after the last one
  const lastEnd = periods.length ? Math.max(...periods.map(p => p.end)) : 8 * 60;

  const handleAdd = () => {
    const newPeriod: ScheduledPeriod = {
        id: newId(),
        name: `Block ${periods.length + 1}`,
        start: lastEnd,
        end: lastEnd + 45,
        segments: []
    };
    setPeriods([...periods, newPeriod]);
  };

  const handleDelete = (id: string) => {
    setPeriods(periods.filter(p => p.id !== id));
  };

  const handleCopy = (p: ScheduledPeriod) => {
    const cloned = { ...p, id: newId(), name: p.name + ' (Copy)', start: lastEnd, end: lastEnd + (p.end - p.start) };
    // deep clone segments
    cloned.segments = cloned.segments.map(s => ({ ...s, id: newId() }));
    setPeriods([...periods, cloned]);
  };

  const handleChange = (id: string, updates: Partial<ScheduledPeriod>) => {
    setPeriods(periods.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  // Rows follow their times, but only re-sort once a time is done being edited
  const handleTimeBlur = () => {
    if (periods.some((p, i) => i > 0 && p.start < periods[i - 1].start)) {
      setPeriods([...periods].sort((a, b) => a.start - b.start));
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white font-sans text-sm selection:bg-black/10">
      {/* Header */}
      <div className="flex items-center text-xs font-bold uppercase tracking-widest border-b-4 border-l-4 border-l-transparent bg-gray-50/50" style={{ borderBottomColor: themeColor, color: themeColor }}>
        <div className="w-64 p-3">Label</div>
        <div className="w-60 p-3">Slot Time</div>
        <div className="flex-1 p-3">Segment Sequence</div>
        <div className="w-32 p-3 text-center">Actions</div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto bg-[#fafafa]">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          {periods.map(period => (
            <PeriodRow 
              key={period.id} 
              period={period} 
              themeColor={themeColor}
              onDelete={handleDelete}
              onChange={handleChange}
              onCopy={handleCopy}
              onTimeBlur={handleTimeBlur}
              problems={problems.get(period.id) ?? []}
              isActive={period.id === activePeriodId}
            />
          ))}
        </DndContext>

        {periods.length === 0 && (
          <div className="p-6 text-center text-xs uppercase tracking-widest opacity-50">
            Nothing scheduled
          </div>
        )}
        
        <div className="p-4 flex justify-center">
          <button 
            onClick={handleAdd}
            className="flex items-center gap-2 uppercase font-bold text-xs px-6 py-3 border-2 hover:bg-black/5 bg-white shadow-[4px_4px_0_rgba(0,0,0,0.1)]"
            style={{ borderColor: themeColor, color: themeColor }}
          >
            <Plus size={16} /> Add Schedule Block
          </button>
        </div>
      </div>
    </div>
  );
}
