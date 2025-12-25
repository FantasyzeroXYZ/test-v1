import React from 'react';
import { CapturedClip, UILanguage } from '../types';
import { getTranslation } from '../i18n';
import { formatTime, downloadBlob } from '../utils';
import { Scissors, X, FileVideo, FileAudio, Play, Download, Trash2 } from 'lucide-react';

interface Props {
  show: boolean;
  onClose: () => void;
  onToggle: () => void;
  clips: CapturedClip[];
  onPlay: (clip: CapturedClip) => void;
  onDelete: (id: string) => void;
  lang: UILanguage;
}

const ClipsDropdown: React.FC<Props> = ({ show, onClose, onToggle, clips, onPlay, onDelete, lang }) => {
  const t = getTranslation(lang);

  return (
    <div className="relative">
        <button onClick={onToggle} className="flex items-center gap-2 text-xs font-medium bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors text-slate-300" title={t.clips}>
            <Scissors size={16}/>
            {clips.length > 0 && (
                <span className="bg-primary text-white text-[9px] px-1 rounded-full font-bold">{clips.length}</span>
            )}
        </button>
        {show && (
            <div className="absolute top-full right-0 mt-2 bg-[#1e293b] rounded-xl shadow-2xl border border-white/10 w-80 p-2 z-[60] animate-in fade-in zoom-in-95 max-h-[60vh] flex flex-col">
                <h4 className="text-xs font-bold text-white mb-2 px-2 uppercase sticky top-0 bg-[#1e293b] z-10 py-1 flex justify-between items-center">
                    <span>{t.clips}</span>
                    <button onClick={onClose}><X size={14} className="text-slate-400 hover:text-white"/></button>
                </h4>
                <div className="overflow-y-auto space-y-1 flex-1 pr-1 custom-scrollbar">
                    {clips.length === 0 ? (
                        <p className="text-xs text-slate-500 px-2 py-4 text-center">{t.noClips}</p>
                    ) : (
                        clips.map((clip) => (
                            <div key={clip.id} className="p-2 hover:bg-white/10 rounded group border border-transparent hover:border-white/5 transition-all flex items-center gap-3">
                                <div 
                                    onClick={() => onPlay(clip)}
                                    className="w-12 h-12 bg-black/50 rounded flex items-center justify-center cursor-pointer hover:bg-black/70 flex-shrink-0 relative overflow-hidden"
                                >
                                    {clip.type === 'video' ? <FileVideo size={20} className="text-slate-400"/> : <FileAudio size={20} className="text-slate-400"/>}
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40">
                                        <Play size={16} className="text-white fill-white"/>
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-white font-medium truncate">{clip.title}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">{formatTime(clip.duration)}</p>
                                </div>
                                <button 
                                    onClick={() => downloadBlob(clip.blob, clip.title + (clip.type === 'video' ? '.webm' : '.weba'))}
                                    className="p-1.5 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded"
                                    title="Download"
                                >
                                    <Download size={14} />
                                </button>
                                <button 
                                    onClick={() => onDelete(clip.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded"
                                    title={t.deleteClip}
                                >
                                    <Trash2 size={14}/>
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        )}
    </div>
  );
};

export default ClipsDropdown;