import React, { useEffect, useRef } from 'react';
import { Subtitle, UILanguage } from '../types';
import { formatTime } from '../utils';
import { getTranslation } from '../i18n';
import { X, List } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  subtitles: Subtitle[];
  currentSubtitleIndex: number;
  onSeek: (time: number) => void;
  subtitleOffset: number;
  variant: 'sidebar' | 'bottom-sheet';
  lang: UILanguage;
}

const TranscriptPanel: React.FC<Props> = ({
  isOpen,
  onClose,
  subtitles,
  currentSubtitleIndex,
  onSeek,
  subtitleOffset,
  variant,
  lang
}) => {
  const t = getTranslation(lang);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active subtitle
  useEffect(() => {
    if (isOpen && containerRef.current && currentSubtitleIndex !== -1) {
      const activeEl = containerRef.current.children[currentSubtitleIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [isOpen, currentSubtitleIndex]);

  const isSidebar = variant === 'sidebar';

  const containerClasses = isSidebar
    ? `fixed top-0 right-0 h-full w-full md:w-[400px] bg-[#0f172a]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-[90] transition-transform duration-300 transform flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`
    : `fixed bottom-0 left-0 right-0 h-[60vh] bg-[#0f172a]/95 backdrop-blur-xl border-t border-white/10 shadow-2xl z-[90] transition-transform duration-300 transform flex flex-col rounded-t-2xl ${isOpen ? 'translate-y-0' : 'translate-y-full'}`;

  return (
    <>
      {/* Overlay for bottom sheet (mobile/normal mode) */}
      {!isSidebar && isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[80] transition-opacity" onClick={onClose} />
      )}

      <div className={containerClasses}>
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <h3 className="font-semibold text-slate-200 flex items-center gap-2">
            <List size={18} className="text-primary" /> {t.transcript}
          </h3>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10" ref={containerRef}>
          {subtitles.length === 0 ? (
            <p className="text-slate-500 text-center mt-10 text-sm">{t.noSubsLoaded}</p>
          ) : (
            subtitles.map((sub, idx) => (
              <div 
                key={idx} 
                onClick={() => onSeek(sub.start + subtitleOffset)} 
                className={`p-3 rounded-lg text-sm transition-all cursor-pointer flex gap-3 mb-1 group ${
                  idx === currentSubtitleIndex 
                    ? 'bg-primary/20 border border-primary/30 text-white' 
                    : 'hover:bg-white/5 text-slate-400 border border-transparent'
                }`}
              >
                <span className={`font-mono text-xs opacity-50 pt-0.5 min-w-[40px] ${idx === currentSubtitleIndex ? 'text-primary-200' : 'group-hover:text-slate-300'}`}>
                  {formatTime(sub.start + subtitleOffset)}
                </span>
                <p className="line-clamp-2 leading-relaxed">{sub.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default TranscriptPanel;