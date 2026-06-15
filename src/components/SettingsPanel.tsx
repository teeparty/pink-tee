import React from 'react';
import { AppState, PronunciationOverride } from '../types';
import { Plus, Trash2 } from 'lucide-react';

interface SettingsPanelProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
  themeColor: string;
}

export function SettingsPanel({ state, updateState, themeColor }: SettingsPanelProps) {
  const handleAddPronunciation = () => {
    updateState(s => ({
      ...s,
      pronunciations: [
        ...s.pronunciations,
        { id: crypto.randomUUID(), original: '', replacement: '' }
      ]
    }));
  };

  const handleUpdatePronunciation = (id: string, updates: Partial<PronunciationOverride>) => {
    updateState(s => ({
      ...s,
      pronunciations: s.pronunciations.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  };

  const handleDeletePronunciation = (id: string) => {
    updateState(s => ({
      ...s,
      pronunciations: s.pronunciations.filter(p => p.id !== id)
    }));
  };

  return (
    <div className="flex flex-col gap-6 p-4 font-sans text-sm h-full overflow-auto">
      <div className="space-y-4 shadow-sm border p-4 bg-gray-50/50" style={{ borderColor: `${themeColor}40` }}>
        <h3 className="font-bold uppercase tracking-wider text-xs" style={{ color: themeColor }}>Display Settings</h3>
        
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase opacity-70">UI Title / Branding</label>
          <input 
            value={state.uiTitle}
            onChange={(e) => updateState(s => ({ ...s, uiTitle: e.target.value }))}
            placeholder="SYSTEM VISUALIZER"
            className="w-full bg-white border outline-none px-3 py-2"
            style={{ borderColor: `${themeColor}40` }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase opacity-70">Brand Logo URL (Optional)</label>
          <input 
            value={state.brandLogo}
            onChange={(e) => updateState(s => ({ ...s, brandLogo: e.target.value }))}
            placeholder="https://example.com/logo.png"
            className="w-full bg-white border outline-none px-3 py-2"
            style={{ borderColor: `${themeColor}40` }}
          />
        </div>
      </div>

      <div className="space-y-4 shadow-sm border p-4 bg-gray-50/50" style={{ borderColor: `${themeColor}40` }}>
        <h3 className="font-bold uppercase tracking-wider text-xs" style={{ color: themeColor }}>TTS Pronunciation Overrides</h3>
        <p className="text-xs opacity-70">Correct the AI voice by telling it how to pronounce specific words or acronyms in your schedule.</p>
        
        <div className="flex flex-col gap-2">
          {state.pronunciations.map(p => (
            <div key={p.id} className="flex items-center gap-2">
              <input 
                placeholder="Find word (e.g. CSR)"
                value={p.original}
                onChange={e => handleUpdatePronunciation(p.id, { original: e.target.value })}
                className="flex-1 bg-white border outline-none px-2 py-1 text-xs"
                style={{ borderColor: `${themeColor}40` }}
              />
              <span className="opacity-50">→</span>
              <input 
                placeholder="Say as (e.g. Caesar)"
                value={p.replacement}
                onChange={e => handleUpdatePronunciation(p.id, { replacement: e.target.value })}
                className="flex-1 bg-white border outline-none px-2 py-1 text-xs"
                style={{ borderColor: `${themeColor}40` }}
              />
              <button 
                onClick={() => handleDeletePronunciation(p.id)}
                className="p-1.5 opacity-70 hover:opacity-100 hover:bg-red-50 text-red-500 rounded transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          <button 
            onClick={handleAddPronunciation}
            className="flex items-center justify-center gap-1 mt-2 text-xs uppercase font-bold border py-1.5 hover:bg-black/5 transition-colors"
            style={{ borderColor: themeColor, color: themeColor }}
          >
            <Plus size={14} /> Add Override
          </button>
        </div>
      </div>
    </div>
  );
}
