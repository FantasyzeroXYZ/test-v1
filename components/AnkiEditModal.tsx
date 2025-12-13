

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AnkiNoteData, UILanguage, Subtitle, LearningLanguage } from '../types';
import { getTranslation } from '../i18n';
import { Save, X, Clock, Image as ImageIcon, Scissors, Play, Check, ScanEye, Trash2, Eraser, Volume2, RotateCcw, Video } from 'lucide-react';
import { formatTime } from '../utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: AnkiNoteData) => void;
  initialData: AnkiNoteData;
  lang: UILanguage;
  learningLang?: LearningLanguage;
  currentPlayerTime: number;
  duration: number;
  subtitles: Subtitle[];
  onRetakeImage: () => string | null;
  onSeek: (time: number) => void;
  onPlayAudioRange: (start: number, end: number) => void;
  isOcclusionMode?: boolean; 
}

const AnkiEditModal: React.FC<Props> = ({ 
  isOpen, onClose, onConfirm, initialData, lang, learningLang, currentPlayerTime, duration, subtitles = [], onRetakeImage, onSeek, onPlayAudioRange, isOcclusionMode = false
}) => {
  const t = getTranslation(lang);
  const [data, setData] = useState<AnkiNoteData>(initialData);
  const [isCropping, setIsCropping] = useState(false);
  const [cropSelection, setCropSelection] = useState<{start: number | null, end: number | null}>({ start: null, end: null });
  const [isScrubbingImage, setIsScrubbingImage] = useState(false);
  const [includeAudio, setIncludeAudio] = useState(false);
  const [includeVideo, setIncludeVideo] = useState(false);

  // Occlusion State
  const [masks, setMasks] = useState<{x: number, y: number, w: number, h: number}[]>([]);
  const [drawingRect, setDrawingRect] = useState<{startX: number, startY: number, currX: number, currY: number} | null>(null);
  
  // Ref to track drawing state synchronously during drag events
  const drawingRectRef = useRef<{startX: number, startY: number, currX: number, currY: number} | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // Sync initial data
  useEffect(() => {
      setData({
          ...initialData,
          sentence: initialData.sentence || "",
          word: initialData.word || "",
          definition: initialData.definition || "",
          translation: initialData.translation || "",
          remarks: initialData.remarks || "",
          audioStart: initialData.audioStart || 0,
          audioEnd: initialData.audioEnd || 0
      });
      setCropSelection({ start: null, end: null });
      setIsCropping(false);
      // Initialize masks from props if available (e.g. from video mask)
      setMasks(initialData.occlusionMasks || []); 
      setIncludeAudio(false);
      setIncludeVideo(false);
  }, [initialData, isOpen]);

  // Clean up RAF on unmount
  useEffect(() => {
      return () => {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
  }, []);

  // --- Audio Logic ---
  const handleResetAudio = () => {
      setData(prev => ({
          ...prev,
          audioStart: initialData.audioStart || 0,
          audioEnd: initialData.audioEnd || 0
      }));
  };

  // --- Image Logic ---
  const handleImageScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      setIsScrubbingImage(true);
      onSeek(time);
  };
  
  const handleImageScrubberUp = () => {
     const newImage = onRetakeImage();
     if (newImage) {
       setData(prev => ({ ...prev, imageData: newImage }));
     }
     setIsScrubbingImage(false);
  };

  // --- Optimized Drawing Logic with RAF ---
  const updateDrawingVisuals = useCallback(() => {
      if (drawingRectRef.current) {
          setDrawingRect({ ...drawingRectRef.current });
      }
      rafRef.current = null;
  }, []);

  const requestVisualUpdate = useCallback(() => {
      if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(updateDrawingVisuals);
      }
  }, [updateDrawingVisuals]);

  // --- Occlusion Mask Logic (Mouse) ---
  const handleMaskMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      if (!imageContainerRef.current) return;
      
      const rect = imageContainerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * 100;
      const y = (e.clientY - rect.top) / rect.height * 100;
      
      const initialRect = { startX: x, startY: y, currX: x, currY: y };
      
      drawingRectRef.current = initialRect;
      setDrawingRect(initialRect);

      const handleWindowMouseMove = (ev: MouseEvent) => {
          if (!imageContainerRef.current || !drawingRectRef.current) return;
          const rect = imageContainerRef.current.getBoundingClientRect();
          
          const currX = Math.max(0, Math.min(100, (ev.clientX - rect.left) / rect.width * 100));
          const currY = Math.max(0, Math.min(100, (ev.clientY - rect.top) / rect.height * 100));
          
          drawingRectRef.current = { ...drawingRectRef.current, currX, currY };
          requestVisualUpdate();
      };

      const handleWindowMouseUp = () => {
          window.removeEventListener('mousemove', handleWindowMouseMove);
          window.removeEventListener('mouseup', handleWindowMouseUp);
          finishDrawing();
      };

      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
  };

  // --- Occlusion Mask Logic (Touch for Mobile) ---
  const handleMaskTouchStart = (e: React.TouchEvent) => {
      if (!imageContainerRef.current) return;
      const touch = e.touches[0];
      const rect = imageContainerRef.current.getBoundingClientRect();
      const x = (touch.clientX - rect.left) / rect.width * 100;
      const y = (touch.clientY - rect.top) / rect.height * 100;
      
      const initialRect = { startX: x, startY: y, currX: x, currY: y };
      drawingRectRef.current = initialRect;
      setDrawingRect(initialRect);

      const handleWindowTouchMove = (ev: TouchEvent) => {
          if (!imageContainerRef.current || !drawingRectRef.current) return;
          ev.preventDefault(); // Stop scrolling
          const t = ev.touches[0];
          const r = imageContainerRef.current.getBoundingClientRect();
          
          const currX = Math.max(0, Math.min(100, (t.clientX - r.left) / r.width * 100));
          const currY = Math.max(0, Math.min(100, (t.clientY - r.top) / r.height * 100));
          
          drawingRectRef.current = { ...drawingRectRef.current, currX, currY };
          requestVisualUpdate();
      };

      const handleWindowTouchEnd = () => {
          window.removeEventListener('touchmove', handleWindowTouchMove);
          window.removeEventListener('touchend', handleWindowTouchEnd);
          finishDrawing();
      };

      window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
      window.addEventListener('touchend', handleWindowTouchEnd);
  };

  const finishDrawing = () => {
      if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
      }

      const finalRect = drawingRectRef.current;
          
      if (finalRect) {
          const x = Math.min(finalRect.startX, finalRect.currX);
          const y = Math.min(finalRect.startY, finalRect.currY);
          const w = Math.abs(finalRect.currX - finalRect.startX);
          const h = Math.abs(finalRect.currY - finalRect.startY);
          
          if (w > 1 && h > 1) { // Min size check
              setMasks(prevMasks => [...prevMasks, { x, y, w, h }]);
          }
      }
      
      setDrawingRect(null);
      drawingRectRef.current = null;
  };

  const handleConfirm = () => {
      onConfirm({
          ...data,
          occlusionMasks: masks,
          includeAudio: includeAudio,
          includeVideo: includeVideo
      });
  };

  // --- Audio / Timeline Logic ---
  const getAdjacentSubtitles = () => {
      const currentStart = data.audioStart || 0;
      const currentEnd = data.audioEnd || 0;
      const safeSubs = Array.isArray(subtitles) ? subtitles : [];
      const prevSubs = [...safeSubs].reverse().filter(s => s.end < currentStart - 0.1).slice(0, 2).reverse();
      const nextSubs = safeSubs.filter(s => s.start > currentEnd + 0.1).slice(0, 2);
      return { prevSubs, nextSubs };
  };

  const { prevSubs, nextSubs } = getAdjacentSubtitles();

  const handleExtendToSub = (sub: Subtitle, type: 'start' | 'end') => {
      if (type === 'start') {
          setData(prev => ({ ...prev, audioStart: sub.start }));
          onSeek(sub.start);
      } else {
          setData(prev => ({ ...prev, audioEnd: sub.end }));
      }
  };

  // --- Text Cropping Logic ---
  const tokens = useMemo(() => {
    const text = data.sentence || "";
    const isCJK = ['zh', 'ja'].includes(learningLang || 'en');
    if (isCJK) {
        return text.split('').map((char, i) => ({ text: char, index: i, isSpacer: false }));
    } else {
        const parts = text.split(/(\s+)/);
        let currentIndex = 0;
        return parts.map((part, i) => {
            const token = { text: part, index: currentIndex, isSpacer: /^\s+$/.test(part) };
            currentIndex += part.length; 
            return token;
        });
    }
  }, [data.sentence, learningLang]);

  const handleTokenClick = (index: number) => {
      setCropSelection(prev => {
          if (prev.start === null) return { start: index, end: null };
          else if (prev.end === null) {
              const start = Math.min(prev.start, index);
              const end = Math.max(prev.start, index);
              return { start, end };
          } else return { start: index, end: null };
      });
  };

  const confirmCrop = () => {
      if (cropSelection.start !== null) {
          let startIdx = cropSelection.start;
          let endIdx = cropSelection.end !== null ? cropSelection.end : cropSelection.start;
          const slicedTokens = tokens.slice(startIdx, endIdx + 1);
          const newText = slicedTokens.map(t => t.text).join('');
          setData(prev => ({ ...prev, sentence: newText }));
          setIsCropping(false);
          setCropSelection({ start: null, end: null });
      }
  };

  const currentStart = data.audioStart || 0;
  const currentEnd = data.audioEnd || 0;
  
  // Audio slider range logic for IO mode: Initial +/- 5 seconds
  // Using initialData ensures that the scale doesn't change as we drag the current start/end values
  const initStart = initialData.audioStart || 0;
  const initEnd = initialData.audioEnd || 0;
  const extendedMin = Math.max(0, initStart - 5);
  const extendedMax = Math.min(duration || 100, initEnd + 5);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className={`bg-[#1e293b] border border-white/10 rounded-xl w-full ${isOcclusionMode ? 'max-w-6xl' : 'max-w-4xl'} max-h-[95vh] shadow-2xl flex flex-col overflow-hidden`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#0f172a]">
           <h3 className="font-bold text-white flex items-center gap-2">
             {isOcclusionMode ? <ScanEye size={18} className="text-secondary"/> : <Save size={18} className="text-primary"/>} 
             {isOcclusionMode ? t.editCard : t.editCard}
           </h3>
           <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
             <X size={20} />
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            
            <div className={`grid grid-cols-1 ${isOcclusionMode ? 'lg:grid-cols-1' : 'lg:grid-cols-2'} gap-6`}>
                
                {/* 1. Image Preview / Occlusion Editor */}
                <div className="space-y-3 relative flex flex-col h-full">
                   {/* Editor Toolbar */}
                   <div className="flex flex-col gap-2 mb-2">
                       <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                 {isOcclusionMode && <span className="text-xs font-bold text-secondary uppercase flex items-center gap-2"><ScanEye size={14}/> {t.drawMask}</span>}
                                 
                                 {/* Audio/Video Toggles */}
                                 <div className={`flex items-center gap-2 ${isOcclusionMode ? 'border-l border-white/10 pl-4' : ''}`}>
                                     {/* Audio Checkbox */}
                                     <label className="flex items-center gap-2 cursor-pointer group select-none">
                                         <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${includeAudio ? 'bg-primary border-primary' : 'border-slate-500 group-hover:border-white'}`}>
                                             {includeAudio && <Check size={10} className="text-white" />}
                                         </div>
                                         <input type="checkbox" className="hidden" checked={includeAudio} onChange={e => setIncludeAudio(e.target.checked)} />
                                         <span className={`text-xs font-bold uppercase ${includeAudio ? 'text-primary' : 'text-slate-400 group-hover:text-white'}`}>{t.includeAudio}</span>
                                     </label>

                                     {/* Video Checkbox */}
                                     <label className="flex items-center gap-2 cursor-pointer group select-none ml-2">
                                         <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${includeVideo ? 'bg-indigo-500 border-indigo-500' : 'border-slate-500 group-hover:border-white'}`}>
                                             {includeVideo && <Check size={10} className="text-white" />}
                                         </div>
                                         <input type="checkbox" className="hidden" checked={includeVideo} onChange={e => setIncludeVideo(e.target.checked)} />
                                         <span className={`text-xs font-bold uppercase ${includeVideo ? 'text-indigo-400' : 'text-slate-400 group-hover:text-white'}`}>{t.includeVideo}</span>
                                     </label>
                                 </div>
                            </div>
                            
                            {isOcclusionMode && (
                                <button 
                                     onClick={() => setMasks([])}
                                     className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1 transition-colors"
                                >
                                    <Eraser size={12}/> {t.clearMasks}
                                </button>
                            )}
                       </div>
                   </div>

                   {/* Container that uses flexible sizing to tight-wrap image */}
                   <div className={`relative w-full bg-black rounded-lg overflow-hidden border border-white/10 group shadow-lg select-none flex items-center justify-center min-h-[300px] ${isScrubbingImage ? 'bg-transparent border-primary/50' : ''}`}>
                      
                      {!isScrubbingImage && data.imageData ? (
                          /* Inner container: Ref here. Tightly wraps image. */
                          <div 
                                ref={imageContainerRef}
                                className={`relative max-w-full max-h-[60vh] ${isOcclusionMode ? 'cursor-crosshair touch-none' : ''}`}
                                onMouseDown={isOcclusionMode ? handleMaskMouseDown : undefined}
                                onTouchStart={isOcclusionMode ? handleMaskTouchStart : undefined}
                          >
                            <img 
                                src={`data:image/jpeg;base64,${data.imageData}`} 
                                className="max-w-full max-h-[60vh] w-auto h-auto object-contain pointer-events-none block" 
                                alt="Preview"
                            />
                            
                            {/* Render Masks (IO Mode) - Absolute to Inner Container */}
                            {isOcclusionMode && (
                                <div className="absolute inset-0 pointer-events-none">
                                    {masks.map((m, i) => (
                                        <div 
                                            key={i} 
                                            style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%`, height: `${m.h}%` }}
                                            className="absolute bg-[#FFEBA2] border border-red-500/50 opacity-80"
                                        ></div>
                                    ))}
                                    {drawingRect && (
                                        <div 
                                            style={{ 
                                                left: `${Math.min(drawingRect.startX, drawingRect.currX)}%`, 
                                                top: `${Math.min(drawingRect.startY, drawingRect.currY)}%`, 
                                                width: `${Math.abs(drawingRect.currX - drawingRect.startX)}%`, 
                                                height: `${Math.abs(drawingRect.currY - drawingRect.startY)}%` 
                                            }}
                                            className="absolute bg-red-500/30 border border-red-500"
                                        ></div>
                                    )}
                                </div>
                            )}
                          </div>
                      ) : !isScrubbingImage ? (
                          <div className="w-full h-64 flex items-center justify-center text-slate-500"><ImageIcon size={48} /></div>
                      ) : (
                          <div className="w-full h-64 flex items-center justify-center bg-transparent pointer-events-none">
                              <span className="bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur">Release to Capture</span>
                          </div>
                      )}
                   </div>
                   
                   {/* Constrained Scrubber */}
                   <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                       <label className="flex justify-between text-[10px] uppercase font-bold text-slate-400 mb-2">
                           <span>{t.scrubToFind}</span>
                           <span className="text-primary font-mono">{formatTime(currentPlayerTime)}</span>
                       </label>
                       <input 
                           type="range" 
                           min={currentStart} 
                           max={currentEnd} 
                           step="0.05" 
                           value={Math.max(currentStart, Math.min(currentPlayerTime, currentEnd))}
                           onChange={handleImageScrubberChange}
                           onMouseUp={handleImageScrubberUp}
                           onTouchEnd={handleImageScrubberUp}
                           className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
                       />
                   </div>
                   
                   {/* IO Mode Fields */}
                   {isOcclusionMode && (
                        <div className="grid grid-cols-3 gap-4 mt-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.headerField}</label>
                                <input 
                                    value={data.word} 
                                    onChange={e => setData(prev => ({...prev, word: e.target.value}))}
                                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-secondary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.backExtraField}</label>
                                <input 
                                    value={data.definition} 
                                    onChange={e => setData(prev => ({...prev, definition: e.target.value}))}
                                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-secondary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.remarksField}</label>
                                <input 
                                    value={data.remarks} 
                                    onChange={e => setData(prev => ({...prev, remarks: e.target.value}))}
                                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-secondary outline-none"
                                />
                            </div>
                        </div>
                   )}
                </div>

                {/* 2. Audio Timeline & Text (Hidden in IO Mode) */}
                {!isOcclusionMode && (
                    <div className="space-y-6">
                        {/* Audio Timeline Visualization */}
                        <div className="bg-black/20 rounded-lg p-4 border border-white/5 flex flex-col gap-4">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
                                <div className="flex items-center gap-2"><Clock size={14}/> {t.timeline}</div>
                                <div className="flex gap-2">
                                     <button 
                                         onClick={() => onPlayAudioRange(currentStart, currentEnd)}
                                         className="flex items-center gap-1 text-primary hover:text-white transition-colors"
                                     >
                                         <Play size={12} fill="currentColor"/> {t.previewAudio}
                                     </button>
                                     <button 
                                          onClick={handleResetAudio}
                                          className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors ml-2"
                                     >
                                          <RotateCcw size={12} /> {t.resetAudio}
                                     </button>
                                </div>
                            </div>

                            {/* Timeline Graphic */}
                            <div className="relative w-full h-12 bg-black/40 rounded flex items-center px-1 overflow-hidden select-none">
                                {/* Previous Ghosts */}
                                <div className="flex gap-1 mr-1">
                                    {prevSubs.map((s, i) => (
                                        <div 
                                            key={s.id} 
                                            onClick={() => handleExtendToSub(s, 'start')}
                                            className="h-8 bg-white/5 hover:bg-white/20 border border-white/10 rounded w-8 flex items-center justify-center cursor-pointer text-[9px] text-slate-500 hover:text-white transition-colors"
                                            title={`Extend start to: ${s.text}`}
                                        >
                                            -{(prevSubs.length - i)}
                                        </div>
                                    ))}
                                </div>

                                {/* Active Range */}
                                <div className="flex-1 h-8 bg-primary/20 border border-primary/50 rounded flex items-center justify-center relative group">
                                    <span className="text-[10px] text-primary font-mono font-bold">
                                        {formatTime(currentStart)} - {formatTime(currentEnd)}
                                    </span>
                                </div>

                                {/* Next Ghosts */}
                                <div className="flex gap-1 ml-1">
                                    {nextSubs.map((s, i) => (
                                        <div 
                                            key={s.id} 
                                            onClick={() => handleExtendToSub(s, 'end')}
                                            className="h-8 bg-white/5 hover:bg-white/20 border border-white/10 rounded w-8 flex items-center justify-center cursor-pointer text-[9px] text-slate-500 hover:text-white transition-colors"
                                            title={`Extend end to: ${s.text}`}
                                        >
                                            +{(i + 1)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500 text-center -mt-2">{t.clickToExtend}</p>

                            {/* Fine Tuning Sliders */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">{t.setStart}</label>
                                    <input 
                                        type="range" 
                                        min={Math.max(0, currentStart - 5)} 
                                        max={currentEnd - 0.5} 
                                        step="0.1" 
                                        value={currentStart}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            setData(prev => ({ ...prev, audioStart: val }));
                                            onSeek(val);
                                        }}
                                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-slate-400 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block text-right">{t.setEnd}</label>
                                    <input 
                                        type="range" 
                                        min={currentStart + 0.5} 
                                        max={Math.min(duration || 100, currentEnd + 5)} 
                                        step="0.1" 
                                        value={currentEnd}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            setData(prev => ({ ...prev, audioEnd: val }));
                                        }}
                                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-slate-400 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-white"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Text Editing Section */}
                        <div className="space-y-4">
                            {/* Sentence Field with Token Crop Tool */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">{t.sentence}</label>
                                    <button 
                                        onClick={() => { setIsCropping(!isCropping); setCropSelection({start: null, end: null}); }}
                                        className={`text-[10px] flex items-center gap-1 px-2 py-1 rounded transition-colors ${isCropping ? 'bg-primary text-white' : 'bg-white/10 text-slate-400 hover:text-white'}`}
                                    >
                                        {isCropping ? <X size={10} /> : <Scissors size={10} />}
                                        {isCropping ? t.exitCrop : t.cropMode}
                                    </button>
                                </div>
                                
                                {isCropping ? (
                                    <div className="w-full bg-black/40 border border-primary/50 rounded-lg p-4 min-h-[6rem] animate-in fade-in select-none">
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="text-xs text-primary">{t.clickToCrop}</p>
                                            {cropSelection.start !== null && (
                                                <button 
                                                    onClick={confirmCrop}
                                                    className="bg-primary hover:bg-primary/80 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1 font-bold shadow-lg"
                                                >
                                                    <Check size={10} /> {t.confirmCrop}
                                                </button>
                                            )}
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-y-1">
                                            {tokens.map((token, i) => {
                                                const isSelected = cropSelection.start !== null && 
                                                                (i === cropSelection.start || 
                                                                (cropSelection.end !== null && i >= Math.min(cropSelection.start, cropSelection.end) && i <= Math.max(cropSelection.start, cropSelection.end)));
                                                
                                                const isEndpoint = i === cropSelection.start || i === cropSelection.end;

                                                if (token.isSpacer) return <span key={i} className="whitespace-pre">{token.text}</span>;

                                                return (
                                                    <span 
                                                        key={i}
                                                        onClick={() => handleTokenClick(i)}
                                                        className={`cursor-pointer px-0.5 rounded transition-all ${
                                                            isSelected ? 'bg-primary/30 text-white' : 'hover:bg-white/10 text-slate-300'
                                                        } ${isEndpoint ? 'font-bold text-primary underline decoration-2' : ''}`}
                                                    >
                                                        {token.text}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <textarea 
                                        value={data.sentence} 
                                        onChange={e => setData(prev => ({...prev, sentence: e.target.value}))}
                                        className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-primary outline-none resize-none h-20 transition-all"
                                    />
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.word}</label>
                                    <input 
                                        value={data.word} 
                                        onChange={e => setData(prev => ({...prev, word: e.target.value}))}
                                        className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-primary outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.trans}</label>
                                    <input 
                                        value={data.translation} 
                                        onChange={e => setData(prev => ({...prev, translation: e.target.value}))}
                                        className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-primary outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.definition}</label>
                                <textarea 
                                    value={data.definition} 
                                    onChange={e => setData(prev => ({...prev, definition: e.target.value}))}
                                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-primary outline-none resize-none h-20"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-[#0f172a] flex justify-end gap-3 shrink-0">
             <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                {t.cancel}
             </button>
             <button 
                onClick={handleConfirm} 
                className={`px-6 py-2 rounded-lg text-sm font-bold text-white transition-colors flex items-center gap-2 shadow-lg ${isOcclusionMode ? 'bg-secondary hover:bg-secondary/80 shadow-secondary/20' : 'bg-primary hover:bg-primary/80 shadow-primary/20'}`}
             >
                <Save size={16} /> {t.confirmAdd}
             </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(AnkiEditModal);