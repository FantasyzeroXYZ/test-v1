

import React, { useState, useEffect } from 'react';
import { getTranslation } from '../i18n';
import { UILanguage } from '../types';
import { Save, X, Bookmark, Video, Mic, Clock, Check } from 'lucide-react';
import { formatTime } from '../utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (title: string, note: string, start?: number, end?: number, color?: string) => void;
  onRecordVideo?: (start: number, end: number) => void;
  onRecordAudio?: (start: number, end: number) => void;
  initialTitle: string;
  initialNote: string;
  initialTime: number;
  initialEnd?: number; // If set, shows timeline
  initialColor?: string;
  lang: UILanguage;
  isEditing: boolean;
  duration?: number;
}

const COLORS = [
  { hex: '#6366f1', name: 'Indigo' }, // Primary
  { hex: '#ef4444', name: 'Red' },
  { hex: '#f97316', name: 'Orange' },
  { hex: '#eab308', name: 'Yellow' },
  { hex: '#22c55e', name: 'Green' },
  { hex: '#06b6d4', name: 'Cyan' },
  { hex: '#a855f7', name: 'Purple' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#64748b', name: 'Slate' },
];

const BookmarkModal: React.FC<Props> = ({ 
    isOpen, onClose, onConfirm, onRecordVideo, onRecordAudio,
    initialTitle, initialNote, initialTime, initialEnd, initialColor, lang, isEditing, duration 
}) => {
  const t = getTranslation(lang);
  const [title, setTitle] = useState(initialTitle);
  const [note, setNote] = useState(initialNote);
  const [color, setColor] = useState(initialColor || COLORS[0].hex);
  
  // Range state
  const [startTime, setStartTime] = useState(initialTime);
  const [endTime, setEndTime] = useState(initialEnd || initialTime);
  const hasRange = initialEnd !== undefined && initialEnd > initialTime;

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setNote(initialNote);
      setStartTime(initialTime);
      setEndTime(initialEnd || initialTime);
      setColor(initialColor || COLORS[0].hex);
    }
  }, [isOpen, initialTitle, initialNote, initialTime, initialEnd, initialColor]);

  if (!isOpen) return null;

  // Timeline Logic
  const minTime = Math.max(0, startTime - 5);
  const maxTime = Math.min(duration || (endTime + 30), endTime + 5);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#1e293b] border border-white/10 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#0f172a]">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Bookmark size={18} style={{ color: color }}/> {isEditing ? t.editBookmark : t.addBookmark}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Timeline UI for Ranged Bookmarks */}
          {hasRange && (
              <div className="bg-black/20 rounded-lg p-3 border border-white/5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                      <Clock size={14}/> {t.timeRange}
                      <span className="text-primary font-mono ml-auto">
                          {formatTime(startTime)} - {formatTime(endTime)}
                      </span>
                  </div>
                  
                  {/* Visual Bar */}
                  <div className="relative w-full h-8 bg-black/40 rounded flex items-center px-1 overflow-hidden select-none">
                       {/* Simplified bar just showing range relative to +/- 5s */}
                       <div className="absolute left-0 right-0 h-1 bg-white/10 top-1/2 -translate-y-1/2"></div>
                       {/* We just provide sliders below for now to keep it simple as requested */}
                  </div>

                  {/* Sliders */}
                  <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">{t.setStart}</label>
                            <input 
                                type="range" 
                                min={minTime} 
                                max={endTime - 0.5} 
                                step="0.1" 
                                value={startTime}
                                onChange={(e) => setStartTime(parseFloat(e.target.value))}
                                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-slate-400 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-white"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block text-right">{t.setEnd}</label>
                            <input 
                                type="range" 
                                min={startTime + 0.5} 
                                max={maxTime} 
                                step="0.1" 
                                value={endTime}
                                onChange={(e) => setEndTime(parseFloat(e.target.value))}
                                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-slate-400 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-white"
                            />
                        </div>
                  </div>

                  {/* Record Buttons */}
                  <div className="flex gap-2 pt-2 border-t border-white/5">
                      <button 
                        onClick={() => onRecordVideo && onRecordVideo(startTime, endTime)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-bold rounded transition-colors"
                      >
                          <Video size={14}/> {t.recordClip}
                      </button>
                      <button 
                        onClick={() => onRecordAudio && onRecordAudio(startTime, endTime)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 text-xs font-bold rounded transition-colors"
                      >
                          <Mic size={14}/> {t.recordAudioClip}
                      </button>
                  </div>
              </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Category Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${color === c.hex ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                >
                  {color === c.hex && <Check size={12} className="text-white drop-shadow-md" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.bookmarkTitle}</label>
            <input 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-primary outline-none"
              placeholder={t.bookmarkTitle}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.bookmarkNote}</label>
            <textarea 
              value={note} 
              onChange={e => setNote(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-primary outline-none resize-none h-32"
              placeholder={t.bookmarkPlaceholder}
            />
          </div>
        </div>

        <div className="p-4 border-t border-white/10 bg-[#0f172a] flex justify-end gap-3 shrink-0">
           <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
              {t.cancel}
           </button>
           <button onClick={() => onConfirm(title, note, startTime, hasRange ? endTime : undefined, color)} className="px-6 py-2 rounded-lg text-sm font-bold bg-primary hover:bg-primary/80 text-white transition-colors flex items-center gap-2 shadow-lg shadow-primary/20">
              <Save size={16} /> {t.save}
           </button>
        </div>
      </div>
    </div>
  );
};

export default BookmarkModal;