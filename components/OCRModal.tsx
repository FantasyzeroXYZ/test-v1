
import React, { useRef } from 'react';
import { UILanguage } from '../types';
import { getTranslation, translations } from '../i18n';
import { getEventY } from '../utils';
import { ScanText, Camera, X, MoveVertical, MoveHorizontal, RotateCcw, Loader2, Copy } from 'lucide-react';

interface OCRResult {
    text: string | null;
    image: string;
    debug?: any;
}

interface Props {
  ocrResult: OCRResult;
  onClose: () => void;
  onRetake: () => void;
  isProcessing: boolean;
  onExecute: () => void;
  editMode: 'vertical' | 'horizontal';
  setEditMode: (m: 'vertical' | 'horizontal') => void;
  bounds: { top: number; bottom: number; left: number; right: number };
  setBounds: React.Dispatch<React.SetStateAction<{ top: number; bottom: number; left: number; right: number }>>;
  imageRef: React.RefObject<HTMLImageElement>;
  wrapperRef: React.RefObject<HTMLDivElement>;
  renderTextContent: (text: string, isInteractive: boolean, alignment: 'center' | 'left') => React.ReactNode;
  lang: UILanguage;
  ocrLang: string;
}

const OCRModal: React.FC<Props> = ({
  ocrResult, onClose, onRetake, isProcessing, onExecute,
  editMode, setEditMode, bounds, setBounds, imageRef, wrapperRef,
  renderTextContent, lang, ocrLang
}) => {
  const t = getTranslation(lang);

  const handleShutterDrag = (e: React.MouseEvent | React.TouchEvent, type: 'top' | 'bottom' | 'left' | 'right') => {
      e.preventDefault();
      e.stopPropagation();
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const isVertical = type === 'top' || type === 'bottom';
      const handleMove = (ev: MouseEvent | TouchEvent) => {
          const clientY = getEventY(ev);
          const clientX = 'touches' in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
          if (isVertical) {
              const percentY = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
              setBounds(prev => {
                  if (type === 'top') return { ...prev, top: Math.min(percentY, prev.bottom - 5) };
                  else return { ...prev, bottom: Math.max(percentY, prev.top + 5) };
              });
          } else {
              const percentX = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
              setBounds(prev => {
                  if (type === 'left') return { ...prev, left: Math.min(percentX, prev.right - 5) };
                  else return { ...prev, right: Math.max(percentX, prev.left + 5) };
              });
          }
      };
      const handleUp = () => {
          window.removeEventListener('mousemove', handleMove);
          window.removeEventListener('mouseup', handleUp);
          window.removeEventListener('touchmove', handleMove);
          window.removeEventListener('touchend', handleUp);
      };
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleUp);
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 md:p-4 animate-in fade-in duration-200">
        <div className="bg-[#1e293b] rounded-xl w-full max-w-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[92dvh] relative">
            <div className="flex items-center justify-between p-3 border-b border-white/10 bg-[#0f172a] shrink-0">
                <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                    <ScanText size={16} className="text-primary"/> {t.ocrTitle}
                </h3>
                <div className="flex items-center gap-2">
                    <button onClick={onRetake} className="text-[10px] md:text-xs flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded transition-colors text-slate-300">
                        <Camera size={14}/> {t.retakeScreenshot}
                    </button>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-black/20 p-2 md:p-4 space-y-4 min-h-0 custom-scrollbar">
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center overflow-x-auto pb-1 hide-scrollbar">
                        <div className="flex bg-black/40 rounded-lg p-1 border border-white/10 shrink-0">
                            <button onClick={() => setEditMode('vertical')} className={`px-2 py-1 text-[10px] rounded transition-all flex items-center gap-1 ${editMode === 'vertical' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white'}`}><MoveVertical size={12}/> H</button>
                            <button onClick={() => setEditMode('horizontal')} className={`px-2 py-1 text-[10px] rounded transition-all flex items-center gap-1 ${editMode === 'horizontal' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white'}`}><MoveHorizontal size={12}/> W</button>
                        </div>
                        <div className="flex gap-1 ml-2 shrink-0">
                            <button onClick={() => setBounds(prev => ({...prev, top: 0, bottom: 100}))} className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 transition-colors text-[10px]">Reset H</button>
                            <button onClick={() => setBounds(prev => ({...prev, left: 0, right: 100}))} className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 transition-colors text-[10px]">Reset W</button>
                        </div>
                    </div>
                    <div className="relative w-full bg-black rounded-lg overflow-hidden border border-white/10 shadow-lg select-none flex items-center justify-center min-h-[150px] p-2">
                        <div ref={wrapperRef} className="relative inline-block max-h-[35dvh]">
                            <img ref={imageRef} src={ocrResult.image} alt="Capture" className="max-w-full max-h-[35dvh] w-auto h-auto block select-none" />
                            <div className="absolute inset-0 pointer-events-none touch-none">
                                <div className="absolute top-0 left-0 right-0 bg-black/70 border-b border-white/30 backdrop-blur-[1px] transition-all duration-100" style={{ height: `${bounds.top}%` }}>
                                    {editMode === 'vertical' && ( <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-10 h-5 bg-white/20 hover:bg-primary/80 backdrop-blur rounded-full cursor-ns-resize pointer-events-auto flex items-center justify-center shadow-lg transition-colors z-20" onMouseDown={(e) => handleShutterDrag(e, 'top')} onTouchStart={(e) => handleShutterDrag(e, 'top')} ><div className="w-5 h-1 bg-white/80 rounded-full"></div></div> )}
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-black/70 border-t border-white/30 backdrop-blur-[1px] transition-all duration-100" style={{ height: `${100 - bounds.bottom}%` }}>
                                    {editMode === 'vertical' && ( <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-5 bg-white/20 hover:bg-primary/80 backdrop-blur rounded-full cursor-ns-resize pointer-events-auto flex items-center justify-center shadow-lg transition-colors z-20" onMouseDown={(e) => handleShutterDrag(e, 'bottom')} onTouchStart={(e) => handleShutterDrag(e, 'bottom')} ><div className="w-5 h-1 bg-white/80 rounded-full"></div></div> )}
                                </div>
                                {editMode === 'horizontal' && (
                                    <>
                                        <div className="absolute bg-black/70 border-r border-white/30 backdrop-blur-[1px] transition-all duration-100" style={{ top: `${bounds.top}%`, bottom: `${100 - bounds.bottom}%`, left: 0, width: `${bounds.left}%` }}>
                                            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-5 h-10 bg-white/20 hover:bg-primary/80 backdrop-blur rounded-full cursor-ew-resize pointer-events-auto flex items-center justify-center shadow-lg transition-colors z-20" onMouseDown={(e) => handleShutterDrag(e, 'left')} onTouchStart={(e) => handleShutterDrag(e, 'left')} ><div className="w-1 h-5 bg-white/80 rounded-full"></div></div>
                                        </div>
                                        <div className="absolute bg-black/70 border-l border-white/30 backdrop-blur-[1px] transition-all duration-100" style={{ top: `${bounds.top}%`, bottom: `${100 - bounds.bottom}%`, right: 0, width: `${100 - bounds.right}%` }}>
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-10 bg-white/20 hover:bg-primary/80 backdrop-blur rounded-full cursor-ew-resize pointer-events-auto flex items-center justify-center shadow-lg transition-colors z-20" onMouseDown={(e) => handleShutterDrag(e, 'right')} onTouchStart={(e) => handleShutterDrag(e, 'right')} ><div className="w-1 h-5 bg-white/80 rounded-full"></div></div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                {(ocrResult.text || isProcessing) && (
                    <div className="flex flex-col animate-in slide-in-from-top-2 fade-in duration-300">
                        <div className="bg-[#0f172a] rounded-lg border border-white/5 p-3 flex flex-col relative overflow-hidden group">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2"> {t.ocrResult} <span className="text-[9px] bg-black/20 px-1.5 py-0.5 rounded">{ocrLang || 'eng'}</span> </span>
                            </div>
                            {isProcessing ? ( <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 min-h-[3rem]"><Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="text-xs">{t.ocrProcessing}</span></div> ) 
                            : ( <div className="flex-1 overflow-y-auto font-serif text-sm md:text-base leading-relaxed text-slate-200 whitespace-pre-wrap min-h-[3rem] max-h-[18dvh] scrollbar-thin scrollbar-thumb-white/20 pr-1"> {renderTextContent(ocrResult.text || '', true, 'left')} </div> )}
                        </div>
                    </div>
                )}
            </div>
            <div className="p-3 border-t border-white/10 bg-[#0f172a] flex justify-end gap-2 shrink-0">
                {ocrResult.text && !isProcessing && ( <button onClick={() => { navigator.clipboard.writeText(ocrResult.text || ''); }} className="px-3 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 font-bold text-[10px] md:text-xs flex items-center gap-2 border border-green-600/20 transition-all"><Copy size={14}/> {t.copy}</button> )}
                <button onClick={onExecute} disabled={isProcessing} className="px-4 md:px-6 py-2 rounded-lg bg-primary hover:bg-primary/80 text-white font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50 transition-all active:scale-95">{isProcessing ? <Loader2 className="animate-spin" size={16}/> : <ScanText size={16}/>} {t.runOcr}</button>
            </div>
        </div>
    </div>
  );
};

export default OCRModal;
