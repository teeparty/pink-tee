import React from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Period, Segment } from '../types';
import { GripVertical, Trash2, Plus, Copy, EyeOff, Settings } from 'lucide-react';
import { format, addMinutes } from 'date-fns';
import { getPeriodDuration } from '../utils';

interface SpreadsheetProps {
  periods: Period[];
  onUpdatePeriods: (periods: Period[]) => void;
  startTime: string; // HH:mm
  themeColor: string;
  activePeriodId: string | null;
}

function SortableSegment({ seg, periodColor, themeColor, onUpdate, onDelete }: { seg: Segment, periodColor?: string, themeColor: string, onUpdate: (id: string, updates: Partial<Segment>) => void, onDelete: (id: string) => void }) {
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
      <button onClick={() => onDelete(seg.id)} className="p-1.5 border-l border-dashed hover:bg-black/5" style={{ borderColor: themeColor }}>
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function SortableRow({ 
  period, 
  themeColor, 
  onDelete, 
  onChange,
  onCopy,
  startStr,
  endStr,
  isActive
}: { 
  period: Period, 
  themeColor: string, 
  onDelete: (id: string) => void,
  onChange: (id: string, updates: Partial<Period>) => void,
  onCopy: (p: Period) => void,
  startStr: string,
  endStr: string,
  isActive: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: period.id,
    data: {
      type: 'Period',
      period
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handleSegmentUpdate = (segmentId: string, updates: Partial<Segment>) => {
    const updatedSegments = (period.segments || []).map(s => s.id === segmentId ? { ...s, ...updates } : s);
    onChange(period.id, { segments: updatedSegments });
  };

  const handleAddSegment = () => {
    const newSeg: Segment = {
      id: crypto.randomUUID(),
      name: `Seg ${(period.segments || []).length + 1}`,
      durationMinutes: 5
    };
    onChange(period.id, { segments: [...(period.segments || []), newSeg] });
  };

  const handleDeleteSegment = (segmentId: string) => {
    const updatedSegments = (period.segments || []).filter(s => s.id !== segmentId);
    onChange(period.id, { segments: updatedSegments });
  };

  const totalMins = getPeriodDuration(period);

  return (
    <div
      ref={setNodeRef}
      className={`flex items-stretch border-b-2 bg-white transition-colors ${isActive ? 'bg-black/5' : ''}`}
      style={{ borderColor: `${themeColor}40`, ...style }}
    >
      <div 
        className="w-10 flex items-center justify-center cursor-move hover:bg-black/5 border-l-4" 
        style={{ color: themeColor, borderLeftColor: period.color || 'transparent' }}
        {...attributes} 
        {...listeners}
      >
        <GripVertical size={16} />
      </div>
      
      {/* Type */}
      <div className="w-20 p-2 flex items-center justify-center border-r-2" style={{ borderColor: `${themeColor}40` }}>
        <button 
          onClick={() => onChange(period.id, { type: period.type === 'period' ? 'transition' : 'period' })}
          className="px-2 py-1 text-xs font-bold uppercase border hover:bg-black/5 w-full text-center"
          style={{ borderColor: themeColor, color: themeColor }}
          title="Toggle Type"
        >
          {period.type === 'period' ? 'PER' : 'PASS'}
        </button>
      </div>

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
      
      {/* Dynamic Slot Time */}
      <div className="w-48 p-3 border-r-2 flex flex-col justify-center gap-1" style={{ borderColor: `${themeColor}40` }}>
        <div className="text-sm font-bold uppercase" style={{ color: themeColor }}>
          {startStr} - {endStr}
        </div>
        <div className="text-xs uppercase opacity-70 flex items-center justify-between">
          <span>Total {totalMins} mins</span>
          {(!period.segments || period.segments.length === 0) && (
            <input 
              type="number" 
              value={period.durationMinutes}
              onChange={e => onChange(period.id, { durationMinutes: Number(e.target.value) || 0 })}
              className="w-12 text-center bg-transparent border-b outline-none ml-2"
              style={{ borderColor: themeColor }}
            />
          )}
        </div>
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

export function Spreadsheet({ periods, onUpdatePeriods, startTime, themeColor, activePeriodId }: SpreadsheetProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    if (activeType !== 'Segment') return;

    const activeSegmentId = active.id;
    const overId = over.id;

    // Find the periods containing these segments
    const activePeriodIndex = periods.findIndex(p => p.segments?.find(s => s.id === activeSegmentId));
    let overPeriodIndex = periods.findIndex(p => p.segments?.find(s => s.id === overId));
    
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

    const activeSegmentIndex = (activePeriod.segments || []).findIndex(s => s.id === activeSegmentId);
    let overSegmentIndex = (overPeriod.segments || []).findIndex(s => s.id === overId);

    const segment = (activePeriod.segments || [])[activeSegmentIndex];

    activePeriod.segments = [...(activePeriod.segments || [])];
    activePeriod.segments.splice(activeSegmentIndex, 1);

    overPeriod.segments = [...(overPeriod.segments || [])];
    if (overSegmentIndex === -1) {
       overPeriod.segments.push(segment); // dropped onto empty period
    } else {
       // if we are dragging over an item, we usually push before or after based on pointer, but dnd-kit normally does before
       overPeriod.segments.splice(overSegmentIndex, 0, segment);
    }

    newPeriods[activePeriodIndex] = activePeriod;
    newPeriods[overPeriodIndex] = overPeriod;

    onUpdatePeriods(newPeriods);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    if (activeType === 'Period' && overType === 'Period') {
      if (active.id !== over.id) {
        const oldIndex = periods.findIndex((p) => p.id === active.id);
        const newIndex = periods.findIndex((p) => p.id === over.id);
        onUpdatePeriods(arrayMove(periods, oldIndex, newIndex));
      }
    } else if (activeType === 'Segment') {
      // It might be reordering within the same period
      const activePeriodIndex = periods.findIndex(p => p.segments?.find(s => s.id === active.id));
      
      let overPeriodIndex = periods.findIndex(p => p.segments?.find(s => s.id === over.id));
      if (overPeriodIndex === -1 && overType === 'Period') {
         overPeriodIndex = periods.findIndex(p => p.id === over.id);
      }

      if (activePeriodIndex !== -1 && activePeriodIndex === overPeriodIndex) {
        const activePeriod = periods[activePeriodIndex];
        const oldIndex = (activePeriod.segments || []).findIndex(s => s.id === active.id);
        const newIndex = overType === 'Period' 
            ? (activePeriod.segments || []).length // dropping on the container appends to end
            : (activePeriod.segments || []).findIndex(s => s.id === over.id);

        if (oldIndex !== newIndex && newIndex !== -1) {
          const newPeriods = [...periods];
          newPeriods[activePeriodIndex] = {
            ...activePeriod,
            segments: arrayMove(activePeriod.segments || [], oldIndex, newIndex)
          };
          onUpdatePeriods(newPeriods);
        }
      }
    }
  };

  const handleAdd = () => {
    const newPeriod: Period = {
        id: crypto.randomUUID(),
        name: `Block ${periods.length + 1}`,
        durationMinutes: 45,
        type: 'period',
        segments: []
    };
    onUpdatePeriods([...periods, newPeriod]);
  };

  const handleDelete = (id: string) => {
    onUpdatePeriods(periods.filter(p => p.id !== id));
  };

  const handleCopy = (p: Period) => {
    const cloned = { ...p, id: crypto.randomUUID(), name: p.name + ' (Copy)' };
    // deep clone segments
    if (cloned.segments) {
      cloned.segments = cloned.segments.map(s => ({ ...s, id: crypto.randomUUID() }));
    }
    onUpdatePeriods([...periods, cloned]);
  };

  const handleChange = (id: string, updates: Partial<Period>) => {
    onUpdatePeriods(periods.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const timings: { start: string, end: string }[] = [];
  let currentMs = new Date();
  
  if (startTime) {
    const [h, m] = startTime.split(':').map(Number);
    currentMs.setHours(h, m, 0, 0);
  } else {
    currentMs.setHours(8, 0, 0, 0);
  }

  periods.forEach(p => {
    const startStr = format(currentMs, 'hh:mm a');
    const dur = getPeriodDuration(p);
    currentMs = addMinutes(currentMs, dur);
    const endStr = format(currentMs, 'hh:mm a');
    timings.push({ start: startStr, end: endStr });
  });

  return (
    <div className="flex flex-col h-full bg-white font-sans text-sm selection:bg-black/10">
      {/* Header */}
      <div className="flex items-center text-xs font-bold uppercase tracking-widest border-b-4 bg-gray-50/50" style={{ borderColor: themeColor, color: themeColor }}>
        <div className="w-10"></div>
        <div className="w-20 p-3">Type</div>
        <div className="w-64 p-3">Label</div>
        <div className="w-48 p-3">Slot Time</div>
        <div className="flex-1 p-3">Segment Sequence</div>
        <div className="w-32 p-3 text-center">Actions</div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto bg-[#fafafa]">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <SortableContext items={periods.map(p => p.id)} strategy={verticalListSortingStrategy}>
            {periods.map((period, index) => (
              <SortableRow 
                key={period.id} 
                period={period} 
                themeColor={themeColor}
                onDelete={handleDelete}
                onChange={handleChange}
                onCopy={handleCopy}
                startStr={timings[index].start}
                endStr={timings[index].end}
                isActive={period.id === activePeriodId}
              />
            ))}
          </SortableContext>
        </DndContext>
        
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
