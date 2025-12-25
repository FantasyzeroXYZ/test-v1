import React from 'react';
import { UILanguage, MediaType, VideoLibraryItem, CapturedClip, AnkiConfig } from '../types';
import { getTranslation } from '../i18n';
import { ChevronLeft, ScanText, Zap, Settings as SettingsIcon, FileVideo, FileAudio } from 'lucide-react';
import ClipsDropdown from './ClipsDropdown';

interface Props {
  viewMode: 'library' | 'player';
  onBackToLibrary: () => void;
  activeVideoItem: VideoLibraryItem | null;
  ankiConfig: AnkiConfig;
  ocrMode: 'standard' | 'dictionary';
  onToggleOcrMode: () => void;
  capturedClips: CapturedClip[];
  showClipsList: boolean;
  onToggleClipsList: () => void;
  onCloseClipsList: () => void;
  onPlayClip: (clip: CapturedClip) => void;
  onDeleteClip: (id: string) => void;
  mediaType: MediaType;
  setMediaType: (t: MediaType) => void;
  onOpenSettings: () => void;
  isFullscreen: boolean;
  lang: UILanguage;
}

const Header: React.FC<Props> = ({
  viewMode, onBackToLibrary, activeVideoItem, ankiConfig, ocrMode, onToggleOcrMode,
  capturedClips, showClipsList, onToggleClipsList, onCloseClipsList, onPlayClip, onDeleteClip,
  mediaType, setMediaType, onOpenSettings, isFullscreen, lang
}) => {
  const t = getTranslation(lang);

  return (
    <header className={`w-full flex justify-between items-center px-4 md:px-6 py-2 bg-[#0f172a]/80 backdrop-blur-md border-b border-white/10 z-50 h-[60px] ${isFullscreen ? 'hidden' : ''}`}>
       <div className="flex items-center gap-4">
          {viewMode === 'player' ? (
              <>
                  <button onClick={onBackToLibrary} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-full">
                      <ChevronLeft size={18} />
                  </button>
                  <span className="text-white font-bold truncate max-w-[200px] md:max-w-md">{activeVideoItem?.title}</span>
              </>
          ) : (
              <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">VAMplayer</h1>
          )}
       </div>
       <div className="flex items-center gap-2 md:gap-4">
           
           {/* Global Top Controls */}
           {ankiConfig.ocrEnabled && (
              <button 
                  onClick={onToggleOcrMode} 
                  className={`p-2.5 rounded-full transition-all flex items-center justify-center ${ocrMode === 'dictionary' ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'}`}
                  title={ocrMode === 'standard' ? t.ocrModeStandard : t.ocrModeDictionary}
              >
                  {ocrMode === 'dictionary' ? <Zap size={20} className="fill-current"/> : <ScanText size={20} />}
              </button>
           )}

           {viewMode === 'player' && (
               <>
                   <ClipsDropdown 
                      show={showClipsList} 
                      onClose={onCloseClipsList} 
                      onToggle={onToggleClipsList}
                      clips={capturedClips}
                      onPlay={onPlayClip}
                      onDelete={onDeleteClip}
                      lang={lang}
                   />
               
                   {/* Media Type Toggle (Icon Only) */}
                   <button onClick={() => setMediaType(mediaType === 'video' ? 'audio' : 'video')} className="flex items-center gap-2 text-xs font-medium bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors text-slate-300" title={mediaType === 'video' ? t.videoMode : t.audioMode}>
                      {mediaType === 'video' ? <FileVideo size={16}/> : <FileAudio size={16}/>}
                   </button>
               </>
           )}
           <button onClick={onOpenSettings} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full text-slate-300 hover:text-white transition-colors" title={t.settings}><SettingsIcon size={20} /></button>
       </div>
    </header>
  );
};

export default Header;