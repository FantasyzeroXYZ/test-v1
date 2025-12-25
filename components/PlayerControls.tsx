import React from 'react';
import { UILanguage, ABLoopMode, ABButtonMode } from '../types';
import { getTranslation } from '../i18n';
import { formatTime } from '../utils';
import { Play, Pause, SkipBack, SkipForward, Repeat, Clock, MessageSquare, Languages, List, Minimize2, Maximize2 } from 'lucide-react';

interface Props {
  isControlsVisible: boolean;
  isLiveStream: boolean;
  playedSeconds: number;
  duration: number;
  onSeekMouseDown: () => void;
  onSeekChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSeekMouseUp: (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onJumpSubtitle: (offset: number) => void;
  abLoopState: 'none' | 'a-set' | 'looping';
  abButtonMode: ABButtonMode;
  onABLoopClick: () => void;
  showSubSettings: boolean;
  setShowSubSettings: (s: boolean) => void;
  subtitleOffset: number;
  setSubtitleOffset: (fn: (prev: number) => number) => void;
  subtitleMode: 'primary' | 'secondary' | 'both';
  onCycleSubtitleMode: () => void;
  subtitleVisible: boolean;
  setSubtitleVisible: (v: boolean) => void;
  activeFullscreenPanel: 'none' | 'dictionary' | 'transcript';
  showTranscript: boolean;
  onToggleTranscript: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  lang: UILanguage;
}

const PlayerControls: React.FC<Props> = ({
  isControlsVisible, isLiveStream, playedSeconds, duration,
  onSeekMouseDown, onSeekChange, onSeekMouseUp,
  isPlaying, onTogglePlay, onJumpSubtitle,
  abLoopState, abButtonMode, onABLoopClick,
  showSubSettings, setShowSubSettings, subtitleOffset, setSubtitleOffset,
  subtitleMode, onCycleSubtitleMode, subtitleVisible, setSubtitleVisible,
  activeFullscreenPanel, showTranscript, onToggleTranscript,
  isFullscreen, onToggleFullscreen, lang
}) => {
  const t = getTranslation(lang);

  return (
    <div className={`absolute bottom-0 left-0 right-0 px-4 pt-2 bg-gradient-to-t from-black/20 to-transparent transition-opacity duration-300 flex flex-col gap-2 z-30 ${isControlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        {!isLiveStream && (
            <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
                <span>{formatTime(playedSeconds)}</span>
                <div className="flex-1 min-w-0">
                    <input 
                        type="range" 
                        min={0} 
                        max={(duration || 100)} 
                        step="any" 
                        value={playedSeconds} 
                        onMouseDown={onSeekMouseDown} 
                        onChange={onSeekChange} 
                        onMouseUp={onSeekMouseUp} 
                        onTouchStart={onSeekMouseDown} 
                        onTouchEnd={onSeekMouseUp}
                        className={`w-full h-1.5 bg-white/20 rounded-lg appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full transition-all cursor-pointer hover:[&::-webkit-slider-thumb]:scale-150`}
                    />
                </div>
                <span>{formatTime(duration)}</span>
            </div>
        )}
        
        {isLiveStream && (
                <div className="flex items-center justify-end px-2">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        <span className="text-red-500 font-bold text-xs tracking-wider">LIVE</span>
                    </div>
                </div>
        )}

        <div className="flex justify-between items-center relative pb-3">
            <div className="flex items-center gap-4 md:gap-6">
                <button onClick={onTogglePlay} className="text-white hover:text-primary transition-colors">
                    {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                </button>
                <div className="w-px h-6 bg-white/20 mx-1" />
                <button onClick={() => onJumpSubtitle(-1)} className="text-slate-300 hover:text-white transition-colors"><SkipBack size={20} /></button>
                <button onClick={() => onJumpSubtitle(1)} className="text-slate-300 hover:text-white transition-colors"><SkipForward size={20} /></button>
                
                <div className="w-px h-6 bg-white/20 mx-1" />
                <div className="flex items-center bg-white/10 rounded-lg p-0.5">
                    <button 
                        onClick={onABLoopClick} 
                        className={`flex items-center gap-1 text-xs font-bold px-2 py-1.5 rounded transition-colors ${abLoopState !== 'none' ? 'bg-primary text-white shadow' : 'text-slate-300 hover:text-white'}`} 
                        title={t.abLoop}
                    >
                        <Repeat size={16} />
                        {abLoopState === 'a-set' && <span className="text-[10px]">A-</span>}
                        {abLoopState === 'looping' && <span className="text-[10px]">{abButtonMode === 'loop' ? 'A-B' : 'REC'}</span>}
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-4 md:gap-6">
                <div className="relative">
                    <button onClick={() => setShowSubSettings(!showSubSettings)} className={`text-slate-300 hover:text-white transition-colors ${subtitleOffset !== 0 ? 'text-primary' : ''}`} title={t.subtitleDelay}><Clock size={20} /></button>
                    {showSubSettings && (
                        <div className="absolute bottom-full right-0 mb-3 bg-[#1e293b] p-3 rounded-lg shadow-xl border border-white/10 w-48 animate-in fade-in zoom-in-95 duration-200">
                            <h4 className="text-xs font-semibold text-white mb-2">{t.subtitleDelay}</h4>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setSubtitleOffset(prev => Math.round((prev - 0.5) * 10) / 10)} className="bg-white/10 hover:bg-white/20 px-2 rounded text-white">-0.5s</button>
                                <span className="flex-1 text-center font-mono text-sm text-primary">{subtitleOffset > 0 ? '+' : ''}{subtitleOffset}s</span>
                                <button onClick={() => setSubtitleOffset(prev => Math.round((prev + 0.5) * 10) / 10)} className="bg-white/10 hover:bg-white/20 px-2 rounded text-white">+0.5s</button>
                            </div>
                        </div>
                    )}
                </div>
                <button onClick={onCycleSubtitleMode} className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors ${subtitleMode === 'both' ? 'bg-primary text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`} title={t.cycleMode}>
                    <MessageSquare size={20} />
                </button>
                <button onClick={() => setSubtitleVisible(!subtitleVisible)} className={`${subtitleVisible ? 'text-primary' : 'text-slate-400'} hover:text-white transition-colors`}><Languages size={20} /></button>
                <button onClick={onToggleTranscript} className={`${(activeFullscreenPanel === 'transcript' || showTranscript) ? 'text-primary' : 'text-slate-400'} hover:text-white transition-colors`}><List size={20} /></button>
                <button onClick={onToggleFullscreen} className="text-slate-300 hover:text-white transition-colors">{isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</button>
            </div>
        </div>
    </div>
  );
};

export default PlayerControls;