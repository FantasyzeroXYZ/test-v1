

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactPlayer from 'react-player';
import Tesseract from 'tesseract.js';
import { Subtitle, MediaType, AnkiConfig, VideoLibraryItem, SubtitleMode, UILanguage, LearningLanguage, AnkiNoteData, Bookmark, ABLoopMode, CapturedClip, ABButtonMode } from './types';
import { formatTime, parseSRT, parseVTT, generateVideoThumbnail, captureVideoFrame, extractAudioClip, recordAudioFromPlayer, getEventY, getSupportedMimeType, downloadBlob } from './utils';
import { ankiService, setAnkiAddress } from './services/ankiService';
import { initDB, saveVideo, getLibrary, getVideoFile, deleteVideo, exportAllData, importAllData, clearAllData, saveClip, getClips, deleteClip } from './services/storageService';
import { getTranslation } from './i18n';
import AnkiWidget from './components/AnkiWidget';
import DictionaryPanel from './components/DictionaryPanel';
import AnkiEditModal from './components/AnkiEditModal';
import BookmarkModal from './components/BookmarkModal';
import VideoLibrary from './components/VideoLibrary';
import TranscriptPanel from './components/TranscriptPanel';
import { 
  Play, Pause, SkipBack, SkipForward, Type, FileVideo, 
  FileAudio, Maximize2, Minimize2, Languages, List, X, ChevronLeft, MessageSquare, Clock, Settings as SettingsIcon, Globe, ChevronDown, BookA,
  EyeOff, RefreshCw, PlusSquare, Repeat, Loader2, Lock, Unlock, BookmarkPlus, Book, Trash2, Edit2, Camera, CheckCircle, AlertCircle, Info, Bookmark as BookmarkIcon, MousePointerClick, TextCursor, Sliders, Database, Download, Upload, HardDrive, Film, Mic, Video, Scissors, ScanText, Copy, Languages as LanguagesIcon, Image as ImageIcon, Bug, Crop, Eraser, MoveVertical, MoveHorizontal, ChevronRight, RotateCcw, Zap
} from 'lucide-react';

const App: React.FC = () => {
  const [lang, setLang] = useState<UILanguage>('zh');
  const [learningLang, setLearningLang] = useState<LearningLanguage>('en'); 
  const t = getTranslation(lang);

  const [viewMode, setViewMode] = useState<'library' | 'player'>('library');
  const [libraryItems, setLibraryItems] = useState<VideoLibraryItem[]>([]);
  const [activeVideoItem, setActiveVideoItem] = useState<VideoLibraryItem | null>(null);

  const [mediaType, setMediaType] = useState<MediaType>('video');
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false); 
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [secondarySubtitles, setSecondarySubtitles] = useState<Subtitle[]>([]);
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>('primary');
  const [subtitleOffset, setSubtitleOffset] = useState<number>(0);
  const [showSubSettings, setShowSubSettings] = useState(false);
  const [currentSubtitleIndex, setCurrentSubtitleIndex] = useState<number>(-1);
  const [subtitleVisible, setSubtitleVisible] = useState(true);
  
  const [dictOpen, setDictOpen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false); 
  const [activeFullscreenPanel, setActiveFullscreenPanel] = useState<'none' | 'dictionary' | 'transcript'>('none');
  const [showSettings, setShowSettings] = useState(false);
  
  // Notification Toast State
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  // Bookmark State
  const [showBookmarkList, setShowBookmarkList] = useState(false);
  const [bookmarkModalState, setBookmarkModalState] = useState<{
      isOpen: boolean;
      mode: 'add' | 'edit';
      bookmarkId?: string;
      time?: number;
      end?: number;
      defaultTitle: string;
      defaultNote: string;
      color?: string;
  }>({ isOpen: false, mode: 'add', defaultTitle: '', defaultNote: '' });

  // Edit Modal State
  const [isAnkiModalOpen, setIsAnkiModalOpen] = useState(false);
  const [pendingNote, setPendingNote] = useState<AnkiNoteData>({
      word: '', definition: '', sentence: '', translation: '', audioStart: 0, audioEnd: 0, imageData: null
  });
  // New state to toggle IO mode in modal
  const [ankiModalMode, setAnkiModalMode] = useState<'standard' | 'occlusion'>('standard');
  
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  // Control Lock State: null = unlocked, 'visible' = locked shown
  const [controlsLock, setControlsLock] = useState<'visible' | null>(null);
  
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedWord, setSelectedWord] = useState('');
  const [selectedSentence, setSelectedSentence] = useState('');
  const [currentSegments, setCurrentSegments] = useState<string[]>([]);
  const [nextSegmentIndex, setNextSegmentIndex] = useState<number>(-1);

  const [ankiConnected, setAnkiConnected] = useState(false);
  const [isAddingToAnki, setIsAddingToAnki] = useState(false);
  
  // Mask State
  const [showMask, setShowMask] = useState(false);
  const [maskTop, setMaskTop] = useState(70); // In % of video height
  const [maskHeight, setMaskHeight] = useState(15); // In % of video height
  const [videoGeometry, setVideoGeometry] = useState({ width: 0, height: 0, top: 0, left: 0 });

  // AB Loop State
  const [abLoopState, setAbLoopState] = useState<'none' | 'a-set' | 'looping'>('none');
  const [loopA, setLoopA] = useState(0);
  const [loopB, setLoopB] = useState(0);
  const [capturedClips, setCapturedClips] = useState<CapturedClip[]>([]);
  const [showClipsList, setShowClipsList] = useState(false);
  const [playbackClip, setPlaybackClip] = useState<CapturedClip | null>(null); // For previewing clips
  
  // Recorder Mode State
  const [recorderMode, setRecorderMode] = useState<'video' | 'audio' | null>(null);
  const [recordingTarget, setRecordingTarget] = useState<{start: number, end: number, filename?: string} | null>(null);

  // OCR State
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<{ text: string | null; image: string; debug?: any } | null>(null);
  
  // OCR Mode State
  const [ocrMode, setOcrMode] = useState<'standard' | 'dictionary'>('standard');

  // Persistent OCR Bounds (Percentages: 0-100)
  // top/bottom define the horizontal strip. left/right define vertical cut within that strip.
  const [ocrBounds, setOcrBounds] = useState<{top: number, bottom: number, left: number, right: number}>({ top: 70, bottom: 90, left: 10, right: 90 });
  const [ocrEditMode, setOcrEditMode] = useState<'vertical' | 'horizontal'>('vertical');
  
  const ocrImageRef = useRef<HTMLImageElement>(null);
  const ocrWrapperRef = useRef<HTMLDivElement>(null); // Wrapper to tightly bound image
  
  const [ankiConfig, setAnkiConfig] = useState<AnkiConfig>({
    ip: '127.0.0.1', port: '8765',
    deck: '', model: '', tags: ['vamplayer'],
    fields: { word: '', sentence: '', definition: '', translation: '', audio: '', image: '', video: '' },
    imageOcclusion: { deck: '', model: '', tags: ['vamplayer_io'], fields: { image: '', mask: '', header: '', backExtra: '', remarks: '', audio: '' } },
    subtitleSize: 16, // Default 16
    subtitleBottomMargin: 5, // Default 5
    subtitleDisplayMode: 'interactive', // Default
    searchEngine: 'bing',
    abButtonMode: 'loop',
    ocrLang: 'eng',
    ocrEnabled: false // Default to false
  });

  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const seekLockRef = useRef(false);
  const onReadyRef = useRef(false);
  const isRecordingRef = useRef(false); 
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  
  const geometryRafRef = useRef<number | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const wasPlayingRef = useRef(false);

  const Player = ReactPlayer as any;
  const segmenterRef = useRef<any>(null);

  // Refs for saving mask config to avoid stale state in closures
  const maskTopRef = useRef(maskTop);
  const maskHeightRef = useRef(maskHeight);
  const activeVideoItemRef = useRef(activeVideoItem);
  const recordingTargetRef = useRef(recordingTarget);
  const recorderModeRef = useRef(recorderMode);

  const isLiveStream = activeVideoItem?.isLive === true || (Number.isFinite(duration) === false || duration === Infinity);

  useEffect(() => { maskTopRef.current = maskTop; }, [maskTop]);
  useEffect(() => { maskHeightRef.current = maskHeight; }, [maskHeight]);
  useEffect(() => { activeVideoItemRef.current = activeVideoItem; }, [activeVideoItem]);
  useEffect(() => { recordingTargetRef.current = recordingTarget; }, [recordingTarget]);
  useEffect(() => { recorderModeRef.current = recorderMode; }, [recorderMode]);
  
  // Saved OCR Mode
  useEffect(() => {
      const savedOcrMode = localStorage.getItem('vam_ocr_mode');
      if (savedOcrMode === 'standard' || savedOcrMode === 'dictionary') {
          setOcrMode(savedOcrMode);
      }
  }, []);

  const toggleOcrMode = () => {
      const newMode = ocrMode === 'standard' ? 'dictionary' : 'standard';
      setOcrMode(newMode);
      localStorage.setItem('vam_ocr_mode', newMode);
      showToast(newMode === 'standard' ? t.ocrModeStandard : t.ocrModeDictionary, 'info');
  };

  // Helper to clean OCR text based on language
  const cleanOcrText = useCallback((text: string, lang: string = 'eng') => {
      if (!text) return "";
      const target = lang.toLowerCase();
      // Chinese and Japanese: remove all whitespace to fix Tesseract spacing. 
      // Korean (kor) uses spaces, so it is excluded.
      if (target.startsWith('chi') || target.startsWith('jpn')) {
          return text.replace(/\s+/g, '');
      }
      return text.trim();
  }, []);

  // Effect to calculate and update video geometry for mask positioning
  const calculateGeometry = useCallback(() => {
    // Throttle geometry calculations with RAF
    if (geometryRafRef.current) return;

    geometryRafRef.current = requestAnimationFrame(() => {
        const rootContainer = playerContainerRef.current;
        const videoWrapper = videoWrapperRef.current;
        const videoEl = playerRef.current?.getInternalPlayer();

        if (!rootContainer || !videoWrapper || !videoEl || !videoEl.videoWidth || !videoEl.videoHeight) {
            geometryRafRef.current = null;
            return;
        }

        const videoWrapperRect = videoWrapper.getBoundingClientRect();
        const rootContainerRect = rootContainer.getBoundingClientRect();

        const videoWrapperTopOffset = videoWrapperRect.top - rootContainerRect.top;
        const videoWrapperLeftOffset = videoWrapperRect.left - rootContainerRect.left;

        const containerWidth = videoWrapper.clientWidth;
        const containerHeight = videoWrapper.clientHeight;
        const videoWidth = videoEl.videoWidth;
        const videoHeight = videoEl.videoHeight;

        const containerAR = containerWidth / containerHeight;
        const videoAR = videoWidth / videoHeight;

        let frameWidth, frameHeight, frameTop, frameLeft;

        if (containerAR > videoAR) { // Letterbox left/right
            frameHeight = containerHeight;
            frameWidth = containerHeight * videoAR;
            frameTop = 0;
            frameLeft = (containerWidth - frameWidth) / 2;
        } else { // Letterbox top/bottom
            frameWidth = containerWidth;
            frameHeight = containerWidth / videoAR;
            frameLeft = 0;
            frameTop = (containerHeight - frameHeight) / 2;
        }

        setVideoGeometry({
            width: frameWidth,
            height: frameHeight,
            top: videoWrapperTopOffset + frameTop,
            left: videoWrapperLeftOffset + frameLeft,
        });
        
        geometryRafRef.current = null;
    });
  }, []);

  useEffect(() => {
    const container = playerContainerRef.current;
    if (!container || viewMode !== 'player') return;

    const resizeObserver = new ResizeObserver(calculateGeometry);
    resizeObserver.observe(container);

    return () => {
        resizeObserver.disconnect();
        if (geometryRafRef.current) cancelAnimationFrame(geometryRafRef.current);
    };
  }, [viewMode, calculateGeometry]);

  // Explicitly recalculate geometry after fullscreen panel transition ends
  useEffect(() => {
    if (isFullscreen) {
        const timer = setTimeout(() => {
            calculateGeometry();
        }, 350);
        return () => clearTimeout(timer);
    }
  }, [activeFullscreenPanel, isFullscreen, calculateGeometry]);


  useEffect(() => {
      try {
        segmenterRef.current = new (Intl as any).Segmenter(learningLang, { granularity: 'word' });
      } catch (e) {
        console.warn("Intl.Segmenter not supported");
      }
  }, [learningLang]);

  // Initial Load from IndexedDB
  useEffect(() => {
      const init = async () => {
        try {
          await initDB();
          const items = await getLibrary();
          // Normalize items (ensure isLocal is correct)
          setLibraryItems(items.map((i) => ({...i, isLocal: i.isLocal ?? (!!i.file)})));
        } catch (e) {
          console.error("Failed to initialize DB or load library", e);
          showToast("Failed to load video library", 'error');
        }
      };
      init();

      const savedAnki = localStorage.getItem('vam_anki_config');
      if (savedAnki) {
          const config = JSON.parse(savedAnki);
          setAnkiAddress(config.ip || '127.0.0.1', config.port || '8765');
          if (!config.subtitleSize) config.subtitleSize = 16;
          if (!config.subtitleBottomMargin && config.subtitleBottomMargin !== 0) config.subtitleBottomMargin = 5;
          if (!config.searchEngine) config.searchEngine = 'bing';
          if (!config.subtitleDisplayMode) config.subtitleDisplayMode = 'interactive'; 
          if (!config.abButtonMode) config.abButtonMode = 'loop';

          // Initialize IO config if missing
          if (!config.imageOcclusion) {
              config.imageOcclusion = { deck: '', model: '', tags: ['vamplayer_io'], fields: { image: '', mask: '', header: '', backExtra: '', remarks: '', audio: '' } };
          } 
          
          if (!config.fields.video) config.fields.video = '';
          if (!config.ocrLang) config.ocrLang = 'eng';
          if (typeof config.ocrEnabled === 'undefined') config.ocrEnabled = false;

          setAnkiConfig(config);
      }
      const savedLang = localStorage.getItem('vam_ui_lang');
      if (savedLang) setLang(savedLang as UILanguage);
      
      const savedLearningLang = localStorage.getItem('vam_learning_lang');
      if (savedLearningLang) setLearningLang(savedLearningLang as LearningLanguage);
  }, []);

  useEffect(() => {
    onReadyRef.current = false;
    setAbLoopState('none');
    setLoopA(0);
    setLoopB(0);
    setShowBookmarkList(false);
    setRecordingTarget(null);
  }, [activeVideoItem?.id]);

  // Load Clips separately when active video changes
  useEffect(() => {
    const loadClips = async () => {
        if (!activeVideoItem?.id) {
            setCapturedClips([]);
            return;
        }
        try {
            const clips = await getClips(activeVideoItem.id);
            const clipsWithUrls = clips.map(clip => ({
                ...clip,
                src: URL.createObjectURL(clip.blob)
            }));
            setCapturedClips(clipsWithUrls);
        } catch (e) {
            console.error("Failed to load clips", e);
        }
    };
    loadClips();
    
    // Cleanup URLs when switching videos
    return () => {
        setCapturedClips(prev => {
            prev.forEach(c => URL.revokeObjectURL(c.src));
            return [];
        });
    };
  }, [activeVideoItem?.id]);

  useEffect(() => {
    localStorage.setItem('vam_anki_config', JSON.stringify(ankiConfig));
  }, [ankiConfig]);

  useEffect(() => {
    localStorage.setItem('vam_learning_lang', learningLang);
  }, [learningLang]);

  useEffect(() => {
    localStorage.setItem('vam_ui_lang', lang);
  }, [lang]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      if (!isFs) setActiveFullscreenPanel('none');
      if (!isFs) setControlsLock(null);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setNotification({ message, type });
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
      notificationTimeoutRef.current = setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleAnkiConnect = async () => {
    try {
      const status = await ankiService.checkConnection();
      setAnkiConnected(status);
      return status;
    } catch (error) {
      setAnkiConnected(false);
      return false;
    }
  };

  const handleDuration = useCallback(async (dur: number) => {
    setDuration(dur);
    
    const currentItem = activeVideoItemRef.current;
    if (currentItem && Number.isFinite(dur) && dur > 0) {
        // IMPORTANT: Do NOT overwrite duration/isLive if the user explicitly set it as live
        if (currentItem.isLive) return;

        if (['Stream', 'Live', 'Unknown'].includes(currentItem.duration)) {
             const formatted = formatTime(dur);
             const updatedItem = { ...currentItem, duration: formatted, isLive: false };
             
             await saveVideo(updatedItem);
             setLibraryItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
             setActiveVideoItem(updatedItem);
        }
    }
  }, []);

  const handleStartRecording = useCallback((modeOverride?: 'video' | 'audio') => {
      const videoEl = playerRef.current?.getInternalPlayer() as HTMLVideoElement;
      if (!videoEl) return;
      
      const currentMode = modeOverride || recorderModeRef.current || 'video';

      try {
          // Cast to any because captureStream is not in the default HTMLVideoElement definition in some TS environments
          const stream = (videoEl as any).captureStream() as MediaStream;
          // Filter tracks based on mode
          if (currentMode === 'audio') {
              stream.getVideoTracks().forEach(track => track.stop());
          }
          
          const mimeType = getSupportedMimeType(currentMode === 'video' ? 'video' : 'audio');
          if (!mimeType) {
              showToast("No supported recording MIME type found", 'error');
              return;
          }

          const recorder = new MediaRecorder(stream, { mimeType });
          mediaRecorderRef.current = recorder;
          recordedChunksRef.current = [];

          recorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                  recordedChunksRef.current.push(event.data);
              }
          };

          // Use onstop to safely handle the final blob logic
          recorder.onstop = async () => {
              const currentTarget = recordingTargetRef.current;
              const mode = recorderModeRef.current || 'video';
              const mimeType = getSupportedMimeType(mode === 'video' ? 'video' : 'audio');
              const blob = new Blob(recordedChunksRef.current, { type: mimeType });
              const url = URL.createObjectURL(blob);
              
              if (currentTarget?.filename) {
                  // If we have a target filename (from Anki card), download it directly
                  downloadBlob(blob, currentTarget.filename);
                  showToast("Recording downloaded", 'success');
              } else {
                  // Otherwise save to clips list and DB
                  const titleTime = formatTime(playerRef.current?.getCurrentTime() || 0);
                  let title = `${mode === 'video' ? 'Video' : 'Audio'} ${titleTime}`;

                  // Use loop points if available for title
                  if (currentTarget) {
                      title = `${mode === 'video' ? 'Video' : 'Audio'} Clip ${formatTime(currentTarget.start)} - ${formatTime(currentTarget.end)}`;
                  }

                  const newClip: CapturedClip = {
                      id: crypto.randomUUID(),
                      type: mode === 'video' ? 'video' : 'audio',
                      src: url, // Temporary blob URL for session
                      title: title,
                      timestamp: Date.now(),
                      duration: 0, // Metadata only
                      blob: blob,
                      videoId: activeVideoItemRef.current?.id // Associate with active video
                  };
                  
                  // Save to IndexedDB
                  try {
                      await saveClip(newClip);
                      setCapturedClips(prev => [newClip, ...prev]);
                      showToast("Clip captured and saved", 'success');
                  } catch (e) {
                      console.error("Failed to save clip", e);
                      showToast("Clip captured but failed to save to DB", 'error');
                  }
              }

              // Cleanup state
              isRecordingRef.current = false;
              setRecorderMode(null);
              setRecordingTarget(null);
              recordedChunksRef.current = [];
          };

          recorder.start(100); // 100ms slices
          isRecordingRef.current = true;
          showToast(t.recording, 'info');
      } catch (e) {
          console.error("Recording failed", e);
          showToast("Failed to start recording (CORS restriction?)", 'error');
      }
  }, [t, showToast]);

  const handleStopRecording = useCallback(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }
      // Note: We do NOT clear state here immediately because onstop needs it.
      // isRecordingRef is cleared in onstop.
  }, []);

  const handleDeleteClip = async (id: string) => {
      try {
          await deleteClip(id);
          setCapturedClips(prev => {
              const updated = prev.filter(c => c.id !== id);
              // Revoke URL of deleted clip
              const deleted = prev.find(c => c.id === id);
              if (deleted) URL.revokeObjectURL(deleted.src);
              return updated;
          });
          showToast("Clip deleted", 'success');
      } catch (e) {
          console.error("Failed to delete clip", e);
          showToast("Failed to delete clip", 'error');
      }
  };

  const handleProgress = useCallback((state: any) => {
      if (isSeeking || seekLockRef.current || !playerRef.current) return; 
      
      const time = state.playedSeconds;

      // 1. Handle Targeted Recording (High Priority: Check BEFORE loop logic)
      if (isRecordingRef.current && recordingTarget && time >= recordingTarget.end) {
           handleStopRecording();
           setIsPlaying(false);
           return;
      }

      // 2. Handle Loop Mode
      if (abLoopState === 'looping' && ankiConfig.abButtonMode === 'loop' && time >= loopB) {
          playerRef.current.seekTo(loopA, 'seconds');
          setPlayedSeconds(loopA);
          return;
      }

      if (isRecordingRef.current) {
          setPlayedSeconds(time); 
          return;
      }

      const timeDiff = Math.abs(time - playedSeconds);
      if (timeDiff < 0.2 && isPlaying) return; 
      
      setPlayedSeconds(time);
      
      const effectiveTime = time;
      let newIndex = currentSubtitleIndex;
      const currentSub = subtitles[currentSubtitleIndex];
      
      if (currentSub && effectiveTime >= (currentSub.start + subtitleOffset) && effectiveTime <= (currentSub.end + subtitleOffset)) {
      } else {
          newIndex = subtitles.findIndex(s => 
            effectiveTime >= (s.start + subtitleOffset) && 
            effectiveTime <= (s.end + subtitleOffset)
          );
      }
      
      if (newIndex !== currentSubtitleIndex) {
        setCurrentSubtitleIndex(newIndex);
      }
  }, [abLoopState, loopA, loopB, isPlaying, playedSeconds, activeVideoItem, subtitles, subtitleOffset, currentSubtitleIndex, isSeeking, ankiConfig.abButtonMode, recordingTarget, handleStopRecording]);

  const togglePlay = useCallback(() => {
      setIsPlaying(prev => !prev);
  }, []);

  const handlePlayerMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
      setIsControlsVisible(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      
      if (controlsLock === 'visible' || abLoopState !== 'none') return;

      if (isPlaying) {
          controlsTimeoutRef.current = setTimeout(() => {
              setIsControlsVisible(false);
          }, 3000);
      }
  };

  const toggleLock = (e: React.MouseEvent) => {
      e.stopPropagation();
      setControlsLock(prev => prev === 'visible' ? null : 'visible');
  };

  useEffect(() => {
      const shouldPinControls = controlsLock === 'visible' || abLoopState !== 'none';

      if (shouldPinControls) {
          setIsControlsVisible(true);
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
          return; 
      }

      if (!isPlaying) {
          setIsControlsVisible(true);
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      } else {
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
          controlsTimeoutRef.current = setTimeout(() => {
              setIsControlsVisible(false);
          }, 3000);
      }
      
      return () => {
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      };
  }, [isPlaying, controlsLock, abLoopState]); 

  const handleSeekMouseDown = () => {
    wasPlayingRef.current = isPlaying;
    setIsPlaying(false);
    setIsSeeking(true);
    seekLockRef.current = true;
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPlayedSeconds(val);
  };

  const handleSeekMouseUp = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    const time = parseFloat((e.currentTarget as HTMLInputElement).value);
    setPlayedSeconds(time);
    seekLockRef.current = true;
    setIsSeeking(false);
    
    if (playerRef.current) playerRef.current.seekTo(time, 'seconds');
    
    setTimeout(() => {
      if (wasPlayingRef.current) setIsPlaying(true);
      setTimeout(() => seekLockRef.current = false, 800);
    }, 100);
  };

  const handleImportLocalFile = async (file: File) => {
    try {
      const thumb = await generateVideoThumbnail(file);
      const newItem: VideoLibraryItem = {
        id: crypto.randomUUID(), title: file.name, thumbnail: thumb, duration: 'Unknown',
        src: URL.createObjectURL(file), type: file.type.startsWith('audio') ? 'audio' : 'video', file: file, isLocal: true,
        filename: file.name
      };
      
      await saveVideo(newItem, file); // Save to DB
      setLibraryItems(prev => [...prev, newItem]);
    } catch (e) {
      console.error(e);
      showToast("Error importing file", 'error');
    }
  };

  const handleAddNetworkVideo = async (url: string, title: string, source: string, id?: string, isLiveInput?: boolean) => {
    const isLive = !!isLiveInput;
    const durationLabel = isLive ? 'Live' : 'Stream';
    
    if (id) {
        const updatedItem = libraryItems.find(i => i.id === id);
        if (updatedItem) {
            const newItem = { ...updatedItem, src: url, title: title, duration: durationLabel, isLive: isLive, isLocal: false, source: source };
            await saveVideo(newItem); // Update DB
            setLibraryItems(prev => prev.map(item => item.id === id ? newItem : item));
            if (activeVideoItem?.id === id) {
                setActiveVideoItem(newItem);
            }
        }
    } else {
        const newItem: VideoLibraryItem = {
          id: crypto.randomUUID(), title: title, thumbnail: '', duration: durationLabel,
          src: url, type: 'video', isLive: isLive, isLocal: false, source: source
        };
        await saveVideo(newItem); // Save DB
        setLibraryItems(prev => [...prev, newItem]);
    }
  };

  const handleDeleteVideo = async (id: string) => {
      await deleteVideo(id); // Delete from DB
      setLibraryItems(prev => prev.filter(item => item.id !== id));
      localStorage.removeItem(`vam_progress_${id}`);
      localStorage.removeItem(`vam_sub_primary_${id}`);
      localStorage.removeItem(`vam_sub_secondary_${id}`);
  };

  const loadSubtitlesFromStorage = (item: VideoLibraryItem) => {
      const pStore = localStorage.getItem(`vam_sub_primary_${item.id}`);
      if (pStore && item.hasPrimarySubtitle) setSubtitles(JSON.parse(pStore));
      else setSubtitles([]);

      const sStore = localStorage.getItem(`vam_sub_secondary_${item.id}`);
      if (sStore && item.hasSecondarySubtitle) {
          setSecondarySubtitles(JSON.parse(sStore));
          setSubtitleMode('primary'); 
      } else {
          setSecondarySubtitles([]);
          setSubtitleMode('primary');
      }
  };

  const handleSampleSelect = async (item: VideoLibraryItem) => {
      if (item.isLocal) {
          try {
              const blob = await getVideoFile(item.id);
              if (blob) {
                  const file = new File([blob], item.filename || item.title, { type: blob.type || (item.type === 'video' ? 'video/mp4' : 'audio/mp3') });
                  const newUrl = URL.createObjectURL(file);
                  item = { ...item, src: newUrl, file: file };
              } else {
                  showToast("Local file not found in storage. Please re-import.", 'error');
              }
          } catch (e) {
              console.error("Failed to load local file", e);
              showToast("Error loading file from storage", 'error');
          }
      }

      setActiveVideoItem(item);
      setMediaType(item.type);
      setSubtitles([]);
      setSecondarySubtitles([]);
      setCurrentSubtitleIndex(-1);
      setIsPlaying(false);
      setSubtitleOffset(0); 
      loadSubtitlesFromStorage(item);
      
      const isLive = item.isLive;
      if (!isLive) {
          const savedTime = localStorage.getItem(`vam_progress_${item.id}`);
          if (savedTime) setPlayedSeconds(parseFloat(savedTime));
      } else {
          setPlayedSeconds(0); 
      }

      const savedMaskConfig = item.maskConfig;
      if (savedMaskConfig) {
          setMaskTop(savedMaskConfig.top);
          setMaskHeight(savedMaskConfig.height);
      } else {
          setMaskTop(70);
          setMaskHeight(15);
      }

      onReadyRef.current = false;
      setViewMode('player');
  };

  const saveSubtitle = async (item: VideoLibraryItem, parsed: Subtitle[], type: 'primary' | 'secondary') => {
      const key = `vam_sub_${type}_${item.id}`;
      localStorage.setItem(key, JSON.stringify(parsed));
      
      const updatedItem = { ...item, [type === 'primary' ? 'hasPrimarySubtitle' : 'hasSecondarySubtitle']: true };
      await saveVideo(updatedItem); // Update DB metadata
      setLibraryItems(prev => prev.map(i => i.id === item.id ? updatedItem : i));
  };

  const handleImportSubtitleAndPlay = (item: VideoLibraryItem, file: File, type: 'primary' | 'secondary', shouldPlay: boolean) => {
      if (shouldPlay) {
          if (activeVideoItem?.id !== item.id) handleSampleSelect(item);
          else setViewMode('player');
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
          const text = ev.target?.result as string;
          const parsed = file.name.endsWith('.vtt') ? parseVTT(text) : parseSRT(text);
          if (type === 'primary') {
              if (activeVideoItem?.id === item.id) {
                 setSubtitles(parsed);
                 setSubtitleMode('primary');
              }
              saveSubtitle(item, parsed, 'primary');
          } else {
              if (activeVideoItem?.id === item.id) {
                 setSecondarySubtitles(parsed);
              }
              saveSubtitle(item, parsed, 'secondary');
          }
      };
      reader.readAsText(file);
  };

  const handleUpdateLocalVideo = async (id: string, newTitle: string, source: string, file?: File) => {
      const item = libraryItems.find(i => i.id === id);
      if (!item) return;

      let updatedItem = { ...item, title: newTitle, source: source };

      if (file) {
          const thumb = await generateVideoThumbnail(file);
          const newUrl = URL.createObjectURL(file);
          updatedItem = { 
              ...updatedItem, 
              src: newUrl, 
              file: file, 
              thumbnail: thumb || updatedItem.thumbnail,
              type: file.type.startsWith('audio') ? 'audio' : 'video',
              filename: file.name
          };
          await saveVideo(updatedItem, file);
      } else {
          await saveVideo(updatedItem); // Metadata only update
      }

      setLibraryItems(prev => prev.map(i => i.id === id ? updatedItem : i));
      if (activeVideoItem?.id === id) {
          setActiveVideoItem(updatedItem);
      }
      showToast(t.updateVideo + ": Success", 'success');
  };

  const handleBackToLibrary = () => {
      setIsPlaying(false);
      if (activeVideoItem && !activeVideoItem.isLive) {
          localStorage.setItem(`vam_progress_${activeVideoItem.id}`, playedSeconds.toString());
      }
      setViewMode('library');
  };

  const cycleSubtitleMode = () => {
      setSubtitleMode(prev => prev === 'primary' ? 'secondary' : 'primary');
  };

  const getActiveSubtitleText = (subs: Subtitle[], time: number) => {
      return subs.find(s => time >= (s.start + subtitleOffset) && time <= (s.end + subtitleOffset))?.text;
  };

  const addToAnki = async (
      term: string, 
      definition: string, 
      sentence?: string, 
      translation?: string, 
      audio?: string,
      autoOpen: boolean = true,
      isScreenshot: boolean = false,
      initialMasks?: any[]
  ) => {
      setIsAddingToAnki(true);
      try {
          // Capture Image
          const videoEl = playerRef.current?.getInternalPlayer() as HTMLVideoElement;
          const imageData = captureVideoFrame(videoEl);
          
          // Determine Timings
          let start = Math.max(0, playedSeconds - 2);
          let end = Math.min(duration, playedSeconds + 2);
          
          // If we have a subtitle active, use that
          if (currentSubtitleIndex !== -1 && subtitles[currentSubtitleIndex]) {
              start = subtitles[currentSubtitleIndex].start + subtitleOffset;
              end = subtitles[currentSubtitleIndex].end + subtitleOffset;
          }

          // If manual sentence passed (e.g. from Dict), use it. Otherwise try to find subtitle text.
          const finalSentence = sentence || getActiveSubtitleText(subtitles, playedSeconds) || "";
          
          const noteData: AnkiNoteData = {
              word: term,
              definition: definition,
              sentence: finalSentence,
              translation: translation || getActiveSubtitleText(secondarySubtitles, playedSeconds) || "",
              imageData: imageData,
              audioStart: start,
              audioEnd: end,
              occlusionMasks: initialMasks
          };

          setPendingNote(noteData);
          setAnkiModalMode(isScreenshot || initialMasks ? 'occlusion' : 'standard'); // Decide mode
          
          if (autoOpen) {
              setIsAnkiModalOpen(true);
              if (isPlaying) setIsPlaying(false);
          }

      } catch (e) {
          console.error(e);
          showToast("Failed to prepare card", 'error');
      } finally {
          setIsAddingToAnki(false);
      }
  };

  const handleWordClick = (segment: string, fullText: string, segments: string[], nextIndex: number) => {
    if (isPlaying) setIsPlaying(false);
    const cleanWord = segment.trim(); 
    if (!cleanWord) return;
    setSelectedWord(cleanWord);
    setSelectedSentence(fullText);
    setCurrentSegments(segments);
    setNextSegmentIndex(nextIndex);
    isFullscreen ? setActiveFullscreenPanel('dictionary') : setDictOpen(true);
  };

  const handleAppendWord = () => {
      if (nextSegmentIndex < currentSegments.length) {
          const nextSegment = currentSegments[nextSegmentIndex];
          const isCJK = ['zh', 'ja'].includes(learningLang);
          const separator = isCJK ? '' : ' ';
          const newWord = selectedWord + separator + nextSegment;
          setSelectedWord(newWord);
          setNextSegmentIndex(prev => prev + 1);
      }
  };
  const handleSeekTo = useCallback((time: number) => {
      playerRef.current?.seekTo(time, 'seconds');
      setPlayedSeconds(time);
      const index = subtitles.findIndex(s => time >= (s.start + subtitleOffset) && time <= (s.end + subtitleOffset));
      if (index !== -1) setCurrentSubtitleIndex(index);
  }, [subtitles, subtitleOffset]);
  
  const handlePreviewAudio = useCallback((start: number, end: number) => {
      if (!playerRef.current) return;
      playerRef.current.seekTo(start, 'seconds');
      setIsPlaying(true);
      setTimeout(() => setIsPlaying(false), (end - start) * 1000);
  }, []);

  const jumpToSubtitle = (offset: number) => {
    if (subtitles.length === 0) {
        const skipAmount = 5;
        const targetTime = Math.max(0, Math.min(duration, playedSeconds + (offset > 0 ? skipAmount : -skipAmount)));
        handleSeekTo(targetTime);
        return;
    }

    let nextIndex = currentSubtitleIndex + offset;
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= subtitles.length) nextIndex = subtitles.length - 1;
    const sub = subtitles[nextIndex];
    const seekTime = sub.start + subtitleOffset;
    handleSeekTo(seekTime);
  };
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) playerContainerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };
  const toggleTranscript = () => {
      if (isFullscreen) setActiveFullscreenPanel(prev => prev === 'transcript' ? 'none' : 'transcript');
      else setShowTranscript(prev => !prev);
  };

  const handleQuickCard = async () => {
      await addToAnki("", "", undefined, undefined, undefined, true, false); 
  };

  const handleScreenshotClick = async () => {
      // Use existing video mask position as default IO mask if visible
      let initialMasks: { x: number; y: number; w: number; h: number }[] | undefined;
      
      if (showMask) {
          initialMasks = [{
              x: 0,
              y: maskTop,
              w: 100,
              h: maskHeight
          }];
      }
      
      await addToAnki("", "", undefined, undefined, undefined, true, true, initialMasks);
  };

  // --- OCR Direct Execution Logic ---
  const performDirectOcr = async () => {
      const videoEl = playerRef.current?.getInternalPlayer();
      if (!videoEl || !(videoEl instanceof HTMLVideoElement)) {
          showToast("OCR not supported for this video type.", 'error');
          return;
      }

      setIsPlaying(false);
      showToast(t.ocrProcessing, 'info');

      try {
          const dataUrl = captureVideoFrame(videoEl);
          if (!dataUrl) throw new Error("Capture failed");

          const img = new Image();
          img.src = dataUrl.startsWith('data:') ? dataUrl : `data:image/jpeg;base64,${dataUrl}`;
          
          await new Promise((resolve) => { img.onload = resolve; });

          const naturalW = img.naturalWidth;
          const naturalH = img.naturalHeight;

          // Crop based on ocrBounds percentages
          const canvas = document.createElement('canvas');
          const cropX = (ocrBounds.left / 100) * naturalW;
          const cropY = (ocrBounds.top / 100) * naturalH;
          const cropW = ((ocrBounds.right - ocrBounds.left) / 100) * naturalW;
          const cropH = ((ocrBounds.bottom - ocrBounds.top) / 100) * naturalH;

          if (cropW <= 0 || cropH <= 0) throw new Error("Invalid selection area");

          canvas.width = cropW;
          canvas.height = cropH;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) throw new Error("Canvas context failed");
          
          ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          const imageToScan = canvas.toDataURL('image/png');
          
          const res = await Tesseract.recognize(
              imageToScan,
              ankiConfig.ocrLang || 'eng'
          );
          
          const rawText = res.data.text;
          const cleanedText = cleanOcrText(rawText, ankiConfig.ocrLang || 'eng');
          
          if (cleanedText) {
              setSelectedSentence(cleanedText);
              setSelectedWord(''); // Clear word so it doesn't auto-search immediately unless desired
              if (isFullscreen) {
                  setActiveFullscreenPanel('dictionary');
              } else {
                  setDictOpen(true);
              }
          } else {
              showToast("No text recognized", 'error');
          }

      } catch (e) {
          console.error("Direct OCR Error", e);
          showToast("OCR Failed", 'error');
      }
  };

  // 1. Capture Frame & Open Modal (Refactored to support modes)
  const handleOcrClick = () => {
      if (ocrMode === 'dictionary') {
          performDirectOcr();
          return;
      }

      // Standard Mode
      const videoEl = playerRef.current?.getInternalPlayer();
      if (!videoEl || !(videoEl instanceof HTMLVideoElement)) {
          showToast("OCR not supported for this video type.", 'error');
          return;
      }
      
      setIsPlaying(false);
      // Capture full frame
      const dataUrl = captureVideoFrame(videoEl);
      if (dataUrl) {
          const src = dataUrl.startsWith('data:') ? dataUrl : `data:image/jpeg;base64,${dataUrl}`;
          setOcrResult({ text: null, image: src });
          // No longer forcing 'vertical' reset to respect persistence preference
      } else {
          showToast("Failed to capture video frame.", 'error');
      }
  };

  const handleOcrRetake = () => {
      const videoEl = playerRef.current?.getInternalPlayer();
      if (videoEl) {
          const dataUrl = captureVideoFrame(videoEl);
          if (dataUrl) {
              const src = dataUrl.startsWith('data:') ? dataUrl : `data:image/jpeg;base64,${dataUrl}`;
              setOcrResult(prev => prev ? { ...prev, image: src, text: null } : null);
          }
      }
  };

  // --- OCR Shutter Interaction Logic ---
  
  const handleShutterDrag = (e: React.MouseEvent | React.TouchEvent, type: 'top' | 'bottom' | 'left' | 'right') => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!ocrWrapperRef.current) return;
      
      // Use the wrapper (image) dimensions for logic to ensure % matches actual image crop
      const rect = ocrWrapperRef.current.getBoundingClientRect();
      const isVertical = type === 'top' || type === 'bottom';
      
      const handleMove = (ev: MouseEvent | TouchEvent) => {
          const clientY = getEventY(ev);
          const clientX = 'touches' in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
          
          if (isVertical) {
              // Percentage from top
              const percentY = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
              
              setOcrBounds(prev => {
                  if (type === 'top') {
                      return { ...prev, top: Math.min(percentY, prev.bottom - 5) };
                  } else {
                      return { ...prev, bottom: Math.max(percentY, prev.top + 5) };
                  }
              });
          } else {
              // Percentage from left
              const percentX = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
              
              setOcrBounds(prev => {
                  if (type === 'left') {
                      return { ...prev, left: Math.min(percentX, prev.right - 5) };
                  } else {
                      return { ...prev, right: Math.max(percentX, prev.left + 5) };
                  }
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


  // 3. Process OCR on selected crop
  const executeOcr = async () => {
      if (!ocrResult?.image || !ocrImageRef.current) return;
      
      setIsOcrProcessing(true);
      try {
          // Determine source image dimensions (natural width/height)
          const img = ocrImageRef.current;
          const naturalW = img.naturalWidth;
          const naturalH = img.naturalHeight;

          // Crop based on ocrBounds percentages
          const canvas = document.createElement('canvas');
          const cropX = (ocrBounds.left / 100) * naturalW;
          const cropY = (ocrBounds.top / 100) * naturalH;
          const cropW = ((ocrBounds.right - ocrBounds.left) / 100) * naturalW;
          const cropH = ((ocrBounds.bottom - ocrBounds.top) / 100) * naturalH;

          // Ensure valid dimensions
          if (cropW <= 0 || cropH <= 0) throw new Error("Invalid selection area");

          canvas.width = cropW;
          canvas.height = cropH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
              const imageToScan = canvas.toDataURL('image/png');
              
              const res = await Tesseract.recognize(
                  imageToScan,
                  ankiConfig.ocrLang || 'eng',
                  { logger: m => console.log(m) }
              );
              
              const rawText = res.data.text;
              const cleanedText = cleanOcrText(rawText, ankiConfig.ocrLang || 'eng');
              
              setOcrResult(prev => prev ? { ...prev, text: cleanedText } : null);
          }
      } catch (e) {
          console.error("OCR Error", e);
          showToast("OCR Failed", 'error');
      } finally {
          setIsOcrProcessing(false);
      }
  };

  const renderLine = (text: string, isInteractive: boolean, alignment: 'center' | 'left' = 'center') => {
      if (!isInteractive) return <span className="cursor-text">{text}</span>;

      let segments: { segment: string; index: number; isWordLike: boolean }[] = [];
      if (segmenterRef.current) {
          const iter = segmenterRef.current.segment(text);
          segments = Array.from(iter).map((s: any, i) => ({ segment: s.segment, index: i, isWordLike: s.isWordLike }));
      } else {
          segments = text.split(/(\s+)/).map((s, i) => ({ segment: s, index: i, isWordLike: /\S/.test(s) }));
      }
      const allSegmentStrings = segments.map(s => s.segment);
      
      return (
        <div className={`flex flex-wrap gap-0 ${alignment === 'center' ? 'justify-center' : 'justify-start'}`}>
            {segments.map((item, i) => {
                if (!item.isWordLike) return <span key={i} className="whitespace-pre">{item.segment}</span>;
                return (
                    <span key={i} className="cursor-pointer hover:text-primary hover:bg-white/10 rounded px-0 transition-colors whitespace-pre"
                        onClick={(e) => { e.stopPropagation(); handleWordClick(item.segment, text, allSegmentStrings, i + 1); }}>
                        {item.segment}
                    </span>
                );
            })}
        </div>
      );
  };


  const renderCurrentSubtitles = () => {
      const primaryText = getActiveSubtitleText(subtitles, playedSeconds);
      const secondaryText = getActiveSubtitleText(secondarySubtitles, playedSeconds);
      
      const containerClass = "inline-block px-4 py-2 rounded-lg text-white select-text transition-transform max-w-[95%] md:max-w-[80%]";
      const dynamicSizeStyle = { 
          fontSize: `${ankiConfig.subtitleSize}px`,
          textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.8)' 
      };
      const secondaryTextClass = "leading-relaxed text-yellow-200/90 mt-1";
      
      const isInteractive = ankiConfig.subtitleDisplayMode === 'interactive';

      if (subtitleMode === 'primary') {
         return primaryText ? <div className={containerClass} onClick={(e) => e.stopPropagation()}><div style={dynamicSizeStyle} className="leading-relaxed font-medium">{renderLine(primaryText, isInteractive, 'center')}</div></div> : null;
      }
      if (subtitleMode === 'secondary') {
         return secondaryText ? <div className={containerClass} onClick={(e) => e.stopPropagation()}><div style={{ fontSize: `${ankiConfig.subtitleSize * 0.8}px`, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }} className={secondaryTextClass}>{secondaryText}</div></div> : null;
      }
      return null;
  };

  const isSubtitleActive = (getActiveSubtitleText(subtitles, playedSeconds) || getActiveSubtitleText(secondarySubtitles, playedSeconds));
  const mainContainerClasses = viewMode === 'library' ? "w-full max-w-7xl px-4 md:px-6 py-6" : "w-full h-[calc(100vh-80px)] overflow-hidden bg-black"; 
  const playerWrapperClasses = isFullscreen ? "flex items-center justify-center bg-black overflow-hidden relative" : "w-full h-full relative group bg-black";
  
  const controlBarHeightEstimate = isControlsVisible ? 85 : 0;
  const subtitleBottomStyle = {
      bottom: `${ankiConfig.subtitleBottomMargin + controlBarHeightEstimate}px`
  };

  const saveMaskConfig = async (top: number, height: number) => {
    const currentItem = activeVideoItemRef.current;
    if (!currentItem) return;

    const newConfig = { top, height };
    const updatedItem = { ...currentItem, maskConfig: newConfig };
    
    // Update DB
    await saveVideo(updatedItem);

    setLibraryItems(prevItems =>
        prevItems.map(item =>
            item.id === currentItem.id
                ? updatedItem
                : item
        )
    );

    setActiveVideoItem(prevActive =>
        prevActive && prevActive.id === currentItem.id ? updatedItem : prevActive
    );
  };

  const handleMaskMouseDown = (e: React.MouseEvent | React.TouchEvent, type: 'move' | 'resize') => {
      e.stopPropagation();
      const startY = getEventY(e);
      const startVal = type === 'move' ? maskTop : maskHeight;
      const videoHeightInPixels = videoGeometry.height;

      if (videoHeightInPixels === 0) return;

      const handleMove = (ev: MouseEvent | TouchEvent) => {
          const diffInPixels = getEventY(ev) - startY;
          const diffInPercent = (diffInPixels / videoHeightInPixels) * 100;
          
          if (type === 'move') {
              setMaskTop(prev => Math.max(0, Math.min(100 - maskHeight, startVal + diffInPercent)));
          } else {
              setMaskHeight(prev => Math.max(2, Math.min(100 - maskTop, startVal + diffInPercent)));
          }
      };

      const handleUp = () => {
          window.removeEventListener('mousemove', handleMove);
          window.removeEventListener('mouseup', handleUp);
          window.removeEventListener('touchmove', handleMove);
          window.removeEventListener('touchend', handleUp);
          saveMaskConfig(maskTopRef.current, maskHeightRef.current);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleUp);
  };
  
  const maskStyle = {
      position: 'absolute' as const,
      top: `${videoGeometry.top + (maskTop / 100) * videoGeometry.height}px`,
      left: `${videoGeometry.left}px`,
      width: `${videoGeometry.width}px`,
      height: `${(maskHeight / 100) * videoGeometry.height}px`,
  };

  const isM3U8 = useMemo(() => {
    if (!activeVideoItem?.src) return false;
    const src = activeVideoItem.src.toLowerCase();
    return src.includes('.m3u8') || src.includes('.m3u') || !!activeVideoItem.isLive;
  }, [activeVideoItem?.src, activeVideoItem?.isLive]);

  const handlePlayerError = useCallback((e: any, data?: any, hlsInstance?: any) => {
      if (window.location.protocol === 'https:' && activeVideoItem?.src?.startsWith('http:')) {
          showToast("Playback Error: Cannot play HTTP stream on HTTPS site (Mixed Content).", 'error');
          if (hlsInstance) {
              hlsInstance.destroy();
              return;
          }
      }

      if (data) {
          if (data.fatal === false) {
              return; 
          }

          console.error('Fatal HLS Error:', data);
          if (hlsInstance) {
              switch (data.type) {
                  case 'mediaError':
                      console.log('Attempting to recover from fatal media error...');
                      hlsInstance.recoverMediaError();
                      return; 
                  case 'networkError':
                      if (data.details === 'manifestLoadError' || data.response?.code === 0) {
                           console.error('Fatal network error (Manifest/CORS/Mixed Content). Destroying HLS instance.');
                           hlsInstance.destroy();
                           break; 
                      }

                      console.error('Fatal network error. Attempting to start load...');
                      hlsInstance.startLoad();
                      return; 
                  default:
                      hlsInstance.destroy();
                      break;
              }
          }
      }

      console.error('Player Error Object:', e);

      if (e?.target?.error?.code === e?.target?.error?.MEDIA_ERR_NETWORK) {
         showToast("Network Error: Check internet or stream availability.", 'error');
      } else if (e?.target?.error?.code === e?.target?.error?.MEDIA_ERR_DECODE) {
         showToast("Decode Error: Video format not supported.", 'error');
      } else {
         showToast("Playback Error: Stream might be offline, CORS restricted, or mixed content.", 'error');
      }
  }, [activeVideoItem, showToast]);

  const handleExportData = async () => {
      try {
          const data = await exportAllData();
          const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `vamplayer_backup_${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast(t.exportSuccess, 'success');
      } catch (e) {
          showToast("Export failed", 'error');
      }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (ev) => {
          try {
              const json = ev.target?.result as string;
              await importAllData(json);
              showToast(t.importSuccess, 'success');
              setTimeout(() => window.location.reload(), 1500);
          } catch (err) {
              console.error(err);
              showToast(t.importError, 'error');
          }
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset input
  };

  const handleClearCache = async () => {
      if (window.confirm(t.clearCacheConfirm)) {
          await clearAllData();
          showToast(t.clearCacheSuccess, 'success');
          setTimeout(() => window.location.reload(), 1500);
      }
  };

  // NEW FUNCTIONS IMPLEMENTATION START

  const handleABLoopClick = useCallback(() => {
    if (ankiConfig.abButtonMode === 'record') {
       // Direct Record Mode: Click 1 = Start, Click 2 = Stop
       if (isRecordingRef.current) {
           handleStopRecording();
       } else {
           handleStartRecording(); 
       }
       return;
    }

    // Loop Mode
    const currentTime = playerRef.current?.getCurrentTime() || 0;
    if (abLoopState === 'none') {
        setLoopA(currentTime);
        setAbLoopState('a-set');
        showToast("Point A set", 'info');
    } else if (abLoopState === 'a-set') {
        if (currentTime > loopA) {
            setLoopB(currentTime);
            setAbLoopState('looping');
            showToast("Looping A-B", 'info');
            playerRef.current?.seekTo(loopA, 'seconds');
        } else {
            showToast("Point B must be after Point A", 'error');
            setAbLoopState('none');
        }
    } else {
        setAbLoopState('none');
        setLoopA(0);
        setLoopB(0);
        showToast("Loop cleared", 'info');
    }
  }, [abLoopState, loopA, ankiConfig.abButtonMode, handleStartRecording, handleStopRecording, showToast]);

  const handleConfirmAddNote = async (noteData: AnkiNoteData) => {
      // 1. Store Media Files (Image)
      let imageFilename = '';
      if (noteData.imageData) {
          imageFilename = `vam_${Date.now()}.jpg`;
          try {
              await ankiService.storeMediaFile(imageFilename, noteData.imageData);
          } catch (e) {
              console.error("Failed to store image", e);
              showToast("Failed to upload image to Anki", 'error');
              return;
          }
      }

      // 2. Store Audio
      let audioFilename = '';
      if (noteData.includeAudio && activeVideoItem) {
          audioFilename = `vam_audio_${Date.now()}.wav`;
          
          let audioBase64: string | null = null;
          if (activeVideoItem.file) {
               audioBase64 = await extractAudioClip(activeVideoItem.file, noteData.audioStart || 0, noteData.audioEnd || 0);
          } else {
               console.warn("Audio extraction for streams not fully implemented in this flow without recording.");
          }

          if (audioBase64) {
              try {
                  await ankiService.storeMediaFile(audioFilename, audioBase64);
              } catch (e) {
                   console.error("Failed to store audio", e);
              }
          } else {
              audioFilename = ''; // Reset if failed
          }
      }

      // 3. Construct Note Fields
      const fields: Record<string, string> = {};
      
      const mapFields = (configFields: any, isIO: boolean) => {
          // Standard mapping
          if (!isIO) {
              if (configFields.word) fields[configFields.word] = noteData.word || '';
              if (configFields.sentence) fields[configFields.sentence] = noteData.sentence || '';
              if (configFields.definition) fields[configFields.definition] = noteData.definition || '';
              if (configFields.translation) fields[configFields.translation] = noteData.translation || '';
              if (configFields.image && imageFilename) fields[configFields.image] = `<img src="${imageFilename}">`;
              if (configFields.audio && audioFilename) fields[configFields.audio] = `[sound:${audioFilename}]`;
          } else {
              // IO mapping
              if (configFields.header) fields[configFields.header] = noteData.word || ''; 
              if (configFields.backExtra) fields[configFields.backExtra] = noteData.definition || '';
              if (configFields.remarks) fields[configFields.remarks] = noteData.remarks || '';
              if (configFields.image && imageFilename) fields[configFields.image] = `<img src="${imageFilename}">`;
              if (configFields.audio && audioFilename) fields[configFields.audio] = `[sound:${audioFilename}]`;
              
              if (configFields.mask && noteData.occlusionMasks) {
                   const svg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                      ${noteData.occlusionMasks.map((m: any) => `<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" fill="#FFEBA2" stroke="none" />`).join('')}
                   </svg>`;
                   fields[configFields.mask] = svg;
              }
          }
      };

      const isIO = ankiModalMode === 'occlusion';
      const deckName = isIO ? ankiConfig.imageOcclusion.deck : ankiConfig.deck;
      const modelName = isIO ? ankiConfig.imageOcclusion.model : ankiConfig.model;
      const configFields = isIO ? ankiConfig.imageOcclusion.fields : ankiConfig.fields;
      const tags = isIO ? ankiConfig.imageOcclusion.tags : ankiConfig.tags;

      mapFields(configFields, isIO);

      const note = {
          deckName: deckName,
          modelName: modelName,
          fields: fields,
          tags: tags || []
      };

      try {
          await ankiService.addNote(note);
          showToast("Note added to Anki", 'success');
          setIsAnkiModalOpen(false);
      } catch (e: any) {
          console.error(e);
          showToast(`Anki Error: ${e.message}`, 'error');
      }
  };

  const handleRetakeImage = () => {
      const videoEl = playerRef.current?.getInternalPlayer() as HTMLVideoElement;
      return captureVideoFrame(videoEl);
  };

  const handleOpenAddBookmarkModal = () => {
      setIsPlaying(false);
      setBookmarkModalState({
          isOpen: true,
          mode: 'add',
          time: playedSeconds,
          defaultTitle: `Bookmark at ${formatTime(playedSeconds)}`,
          defaultNote: ''
      });
  };

  const handleJumpToBookmark = (start: number, end?: number) => {
      playerRef.current?.seekTo(start, 'seconds');
      setPlayedSeconds(start);
      setIsPlaying(true);
  };

  const handleOpenEditBookmarkModal = (bm: Bookmark) => {
      setIsPlaying(false);
      setBookmarkModalState({
          isOpen: true,
          mode: 'edit',
          bookmarkId: bm.id,
          time: bm.time,
          end: bm.end,
          defaultTitle: bm.text,
          defaultNote: bm.note || '',
          color: bm.color
      });
  };

  const handleDeleteBookmark = async (id: string) => {
      if (!activeVideoItem || !activeVideoItem.bookmarks) return;
      const updatedBookmarks = activeVideoItem.bookmarks.filter(b => b.id !== id);
      const updatedItem = { ...activeVideoItem, bookmarks: updatedBookmarks };
      await saveVideo(updatedItem);
      setLibraryItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
      setActiveVideoItem(updatedItem);
      showToast(t.deleteClip || "Bookmark deleted", 'success'); 
  };

  const handleSaveBookmark = async (title: string, note: string, start?: number, end?: number, color?: string) => {
      if (!activeVideoItem) return;
      
      const isEdit = bookmarkModalState.mode === 'edit';
      let updatedBookmarks = activeVideoItem.bookmarks ? [...activeVideoItem.bookmarks] : [];

      if (isEdit && bookmarkModalState.bookmarkId) {
          updatedBookmarks = updatedBookmarks.map(b => b.id === bookmarkModalState.bookmarkId ? {
              ...b, text: title, note, time: start || b.time, end, color
          } : b);
      } else {
          updatedBookmarks.push({
              id: crypto.randomUUID(),
              time: start || playedSeconds,
              end,
              text: title,
              note,
              color
          });
      }

      const updatedItem = { ...activeVideoItem, bookmarks: updatedBookmarks };
      await saveVideo(updatedItem);
      setLibraryItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
      setActiveVideoItem(updatedItem);
      setBookmarkModalState(prev => ({ ...prev, isOpen: false }));
      showToast(t.bookmarkAdded, 'success');
  };

  const handleTriggerRecording = (type: 'video' | 'audio', start: number, end: number) => {
      if (!playerRef.current) return;
      
      setRecordingTarget({ start, end, filename: `${type}_${Date.now()}.${type === 'video' ? 'webm' : 'wav'}` }); 
      setRecorderMode(type);
      playerRef.current.seekTo(start, 'seconds');
      setIsPlaying(true);
      
      setTimeout(() => {
          handleStartRecording(type);
      }, 500); 
  };

  // END NEW FUNCTIONS

  return (
    <div className={`min-h-screen flex flex-col font-sans ${viewMode === 'player' ? 'bg-black' : ''}`}>
      
      {/* Toast Notification */}
      {notification && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-full shadow-2xl backdrop-blur-md font-bold text-sm animate-in slide-in-from-top-2 fade-in duration-300 flex items-center gap-2 ${
              notification.type === 'success' ? 'bg-green-500/90 text-white' : 
              notification.type === 'error' ? 'bg-red-500/90 text-white' : 
              'bg-slate-800/90 text-white border border-white/10'
          }`}>
              {notification.type === 'success' && <CheckCircle size={16} />}
              {notification.type === 'error' && <AlertCircle size={16} />}
              {notification.type === 'info' && <Info size={16} />}
              {notification.message}
          </div>
      )}

      <header className={`w-full flex justify-between items-center px-4 md:px-6 py-2 bg-[#0f172a]/80 backdrop-blur-md border-b border-white/10 z-50 h-[60px] ${isFullscreen ? 'hidden' : ''}`}>
         <div className="flex items-center gap-4">
            {viewMode === 'player' ? (
                <>
                    <button onClick={handleBackToLibrary} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-full">
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
                    onClick={toggleOcrMode} 
                    className={`p-2.5 rounded-full transition-all flex items-center justify-center ${ocrMode === 'dictionary' ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'}`}
                    title={ocrMode === 'standard' ? t.ocrModeStandard : t.ocrModeDictionary}
                >
                    {ocrMode === 'dictionary' ? <Zap size={20} className="fill-current"/> : <ScanText size={20} />}
                </button>
             )}

             {viewMode === 'player' && (
                 <>
                     {/* Clips Button (Icon Only) */}
                    <div className="relative">
                        <button onClick={() => setShowClipsList(!showClipsList)} className="flex items-center gap-2 text-xs font-medium bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors text-slate-300" title={t.clips}>
                            <Scissors size={16}/>
                            {capturedClips.length > 0 && (
                                <span className="bg-primary text-white text-[9px] px-1 rounded-full font-bold">{capturedClips.length}</span>
                            )}
                        </button>
                        {showClipsList && (
                            <div className="absolute top-full right-0 mt-2 bg-[#1e293b] rounded-xl shadow-2xl border border-white/10 w-80 p-2 z-[60] animate-in fade-in zoom-in-95 max-h-[60vh] flex flex-col">
                                <h4 className="text-xs font-bold text-white mb-2 px-2 uppercase sticky top-0 bg-[#1e293b] z-10 py-1 flex justify-between items-center">
                                    <span>{t.clips}</span>
                                    <button onClick={() => setShowClipsList(false)}><X size={14} className="text-slate-400 hover:text-white"/></button>
                                </h4>
                                <div className="overflow-y-auto space-y-1 flex-1 pr-1 custom-scrollbar">
                                    {capturedClips.length === 0 ? (
                                        <p className="text-xs text-slate-500 px-2 py-4 text-center">{t.noClips}</p>
                                    ) : (
                                        capturedClips.map((clip) => (
                                            <div key={clip.id} className="p-2 hover:bg-white/10 rounded group border border-transparent hover:border-white/5 transition-all flex items-center gap-3">
                                                <div 
                                                    onClick={() => setPlaybackClip(clip)}
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
                                                    onClick={() => downloadBlob(clip.blob, clip.title + (clip.type === 'video' ? '.webm' : '.wav'))}
                                                    className="p-1.5 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded"
                                                    title="Download"
                                                >
                                                    <Download size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteClip(clip.id)}
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
                 
                     {/* Media Type Toggle (Icon Only) */}
                     <button onClick={() => setMediaType(prev => prev === 'video' ? 'audio' : 'video')} className="flex items-center gap-2 text-xs font-medium bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors text-slate-300" title={mediaType === 'video' ? t.videoMode : t.audioMode}>
                        {mediaType === 'video' ? <FileVideo size={16}/> : <FileAudio size={16}/>}
                     </button>
                 </>
             )}
             <button onClick={() => setShowSettings(true)} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full text-slate-300 hover:text-white transition-colors" title={t.settings}><SettingsIcon size={20} /></button>
         </div>
      </header>

      {/* Settings Sidebar */}
      <div className={`fixed inset-y-0 right-0 w-80 bg-[#0f172a]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-[100] transition-transform duration-300 transform ${showSettings ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 className="font-semibold text-white flex items-center gap-2"><SettingsIcon size={18} className="text-primary"/> {t.settings}</h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white transition-colors"><X size={22} /></button>
          </div>
          <div className="p-5 space-y-4 overflow-y-auto h-[calc(100%-70px)]">
              
              {/* Basic Settings */}
              <details className="group">
                  <summary className="list-none flex items-center justify-between cursor-pointer text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      <div className="flex items-center gap-2"><Sliders size={14} /> {t.basicSettings}</div>
                      <ChevronDown size={14} className="group-open:rotate-180 transition-transform"/>
                  </summary>
                  <div className="pl-4 pb-4 space-y-4">
                      {/* Language */}
                      <div>
                          <label className="text-[10px] text-slate-400 block mb-1">{t.language}</label>
                          <select 
                            value={lang} 
                            onChange={(e) => setLang(e.target.value as UILanguage)} 
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-slate-200 focus:border-primary outline-none text-sm"
                          >
                              <option value="en">{t.lang_en}</option>
                              <option value="zh">{t.lang_zh}</option>
                          </select>
                      </div>
                      
                      {/* Learning Language */}
                      <div>
                          <label className="text-[10px] text-slate-400 block mb-1">{t.learningLanguage}</label>
                          <select 
                            value={learningLang} 
                            onChange={(e) => setLearningLang(e.target.value as LearningLanguage)} 
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-slate-200 focus:border-primary outline-none text-sm"
                          >
                              {(['en', 'zh', 'ja', 'ru', 'fr', 'es'] as LearningLanguage[]).map(l => (
                                  <option key={l} value={l}>{t[`lang_${l}`] || l}</option>
                              ))}
                          </select>
                      </div>

                      {/* OCR Settings Group */}
                      <div>
                          <label className="flex items-center justify-between cursor-pointer group mb-2">
                              <span className="text-[10px] text-slate-400 block">{t.enableOcr}</span>
                              <div className="relative">
                                  <input 
                                      type="checkbox" 
                                      className="sr-only peer"
                                      checked={!!ankiConfig.ocrEnabled}
                                      onChange={(e) => setAnkiConfig({...ankiConfig, ocrEnabled: e.target.checked})}
                                  />
                                  <div className="w-8 h-4 bg-white/10 rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all"></div>
                              </div>
                          </label>
                          
                          {/* OCR Language - Only show if enabled */}
                          {ankiConfig.ocrEnabled && (
                            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                <label className="text-[10px] text-slate-400 block mb-1">{t.ocrLang}</label>
                                <select 
                                    value={ankiConfig.ocrLang || 'eng'} 
                                    onChange={(e) => setAnkiConfig({...ankiConfig, ocrLang: e.target.value})}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-slate-200 focus:border-primary outline-none text-sm"
                                >
                                    <option value="eng">English</option>
                                    <option value="chi_sim">Chinese (Simplified)</option>
                                    <option value="chi_tra">Chinese (Traditional)</option>
                                    <option value="jpn">Japanese</option>
                                    <option value="kor">Korean</option>
                                    <option value="fra">French</option>
                                    <option value="spa">Spanish</option>
                                    <option value="rus">Russian</option>
                                    <option value="deu">German</option>
                                </select>
                            </div>
                          )}
                      </div>

                      {/* Search Engine */}
                      <div>
                          <label className="text-[10px] text-slate-400 block mb-1">{t.searchEngine}</label>
                          <select 
                            value={ankiConfig.searchEngine} 
                            onChange={(e) => setAnkiConfig({...ankiConfig, searchEngine: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-slate-200 focus:border-primary outline-none text-sm"
                          >
                              <option value="google">Google</option>
                              <option value="bing">Bing</option>
                              <option value="baidu">Baidu</option>
                              <option value="baidu_baike">Baidu Baike</option>
                          </select>
                      </div>

                      {/* AB Button Mode */}
                      <div>
                          <label className="text-[10px] text-slate-400 block mb-1">{t.abButtonMode}</label>
                          <select 
                            value={ankiConfig.abButtonMode} 
                            onChange={(e) => setAnkiConfig({...ankiConfig, abButtonMode: e.target.value as ABButtonMode})}
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-slate-200 focus:border-primary outline-none text-sm"
                          >
                              <option value="loop">{t.abModeLoop}</option>
                              <option value="record">{t.abModeRecord}</option>
                          </select>
                      </div>
                  </div>
              </details>

              {/* Subtitle Settings */}
              <details className="group">
                  <summary className="list-none flex items-center justify-between cursor-pointer text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      <div className="flex items-center gap-2"><Type size={14} /> {t.subtitleSettings}</div>
                      <ChevronDown size={14} className="group-open:rotate-180 transition-transform"/>
                  </summary>
                  <div className="pl-4 pb-4 space-y-4">
                      {/* Mode Switcher */}
                      <div>
                          <label className="text-[10px] text-slate-400 block mb-1">{t.subtitleModeLabel}</label>
                          <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
                              <button 
                                onClick={() => setAnkiConfig({...ankiConfig, subtitleDisplayMode: 'interactive'})}
                                className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] py-1.5 rounded-md transition-all ${ankiConfig.subtitleDisplayMode === 'interactive' ? 'bg-primary text-white font-bold shadow-lg' : 'text-slate-400 hover:text-white'}`}
                              >
                                  <MousePointerClick size={12} /> {t.modeInteractive}
                              </button>
                              <button 
                                onClick={() => setAnkiConfig({...ankiConfig, subtitleDisplayMode: 'selectable'})}
                                className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] py-1.5 rounded-md transition-all ${ankiConfig.subtitleDisplayMode === 'selectable' ? 'bg-primary text-white font-bold shadow-lg' : 'text-slate-400 hover:text-white'}`}
                              >
                                  <TextCursor size={12} /> {t.modeSelectable}
                              </button>
                          </div>
                      </div>

                      {/* Size */}
                      <div>
                          <label className="text-[10px] text-slate-400 block mb-1">{t.subtitleSize}</label>
                          <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-400 font-mono w-6 text-right">{ankiConfig.subtitleSize}</span>
                              <input 
                                type="range" 
                                min="12"
                                max="72"
                                step="1"
                                value={ankiConfig.subtitleSize} 
                                onChange={(e) => setAnkiConfig({...ankiConfig, subtitleSize: parseInt(e.target.value) || 24})}
                                className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                              />
                          </div>
                      </div>
                      
                      {/* Margin */}
                      <div>
                          <label className="text-[10px] text-slate-400 block mb-1">{t.subtitleBottomMargin}</label>
                          <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-400 font-mono w-6 text-right">{ankiConfig.subtitleBottomMargin}</span>
                              <input 
                                type="range" 
                                min="0"
                                max="200"
                                step="1"
                                value={ankiConfig.subtitleBottomMargin} 
                                onChange={(e) => setAnkiConfig({...ankiConfig, subtitleBottomMargin: parseInt(e.target.value) || 0})}
                                className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                              />
                          </div>
                      </div>
                  </div>
              </details>

              {/* Anki Section */}
              <details className="group">
                  <summary className="list-none flex items-center justify-between cursor-pointer text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      <div className="flex items-center gap-2">{t.ankiConfig}</div>
                      <ChevronDown size={14} className="group-open:rotate-180 transition-transform"/>
                  </summary>
                  <div className="pl-4 pb-4">
                      <AnkiWidget isConnected={ankiConnected} onConnectCheck={handleAnkiConnect} config={ankiConfig} onConfigChange={setAnkiConfig} lang={lang} />
                  </div>
              </details>

              {/* Data Management Section */}
              <details className="group">
                  <summary className="list-none flex items-center justify-between cursor-pointer text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      <div className="flex items-center gap-2"><Database size={14} /> {t.dataManagement}</div>
                      <ChevronDown size={14} className="group-open:rotate-180 transition-transform"/>
                  </summary>
                  <div className="pl-4 pb-4 space-y-4">
                      {/* Export */}
                      <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                          <button 
                            onClick={handleExportData}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-xs font-bold transition-colors mb-1"
                          >
                              <Download size={14} /> {t.exportData}
                          </button>
                          <p className="text-[10px] text-slate-500 text-center">{t.exportDataDesc}</p>
                      </div>

                      {/* Import */}
                      <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                          <button 
                            onClick={() => importInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-xs font-bold transition-colors mb-1"
                          >
                              <Upload size={14} /> {t.importData}
                          </button>
                          <input 
                              type="file" 
                              ref={importInputRef} 
                              className="hidden" 
                              accept=".json"
                              onChange={handleImportData}
                          />
                          <p className="text-[10px] text-slate-500 text-center">{t.importDataDesc}</p>
                      </div>

                      {/* Clear Cache */}
                      <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                          <button 
                            onClick={handleClearCache}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-xs font-bold transition-colors mb-1"
                          >
                              <Trash2 size={14} /> {t.clearCache}
                          </button>
                          <p className="text-[10px] text-red-400/70 text-center">{t.clearCacheDesc}</p>
                      </div>
                  </div>
              </details>
          </div>
      </div>
      
      {showSettings && <div className="fixed inset-0 bg-black/50 z-[90] backdrop-blur-sm transition-opacity" onClick={() => setShowSettings(false)} />}
      
      {/* Playback Clip Modal */}
      {playbackClip && (
          <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center backdrop-blur-sm p-4">
              <div className="bg-[#1e293b] rounded-xl overflow-hidden max-w-4xl w-full shadow-2xl border border-white/10">
                  <div className="flex justify-between items-center p-3 border-b border-white/10 bg-[#0f172a]">
                      <h3 className="text-white font-bold">{playbackClip.title}</h3>
                      <button onClick={() => setPlaybackClip(null)}><X className="text-white"/></button>
                  </div>
                  <div className="aspect-video bg-black flex items-center justify-center">
                      <video 
                          src={playbackClip.src} 
                          controls 
                          autoPlay 
                          className="max-w-full max-h-[70vh]" 
                      />
                  </div>
              </div>
          </div>
      )}

      <main className="flex-1 flex flex-col items-center">
        {viewMode === 'library' ? (
            <VideoLibrary 
                items={libraryItems} 
                lang={lang} 
                onSelectSample={handleSampleSelect} 
                onImportLocalFile={handleImportLocalFile} 
                onAddNetworkVideo={handleAddNetworkVideo} 
                onDeleteVideo={handleDeleteVideo} 
                onImportSubtitleAndPlay={handleImportSubtitleAndPlay}
                onUpdateLocalVideo={handleUpdateLocalVideo}
            />
        ) : (
            <div className={mainContainerClasses}>
                <div ref={playerContainerRef} className={playerWrapperClasses} onMouseMove={handlePlayerMouseMove} onClick={handlePlayerMouseMove} onTouchStart={handlePlayerMouseMove}>
                    
                    {/* Buffering Indicator */}
                    {isBuffering && (
                        <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
                            <Loader2 className="w-12 h-12 text-white animate-spin opacity-50" />
                        </div>
                    )}
                    
                    {/* Recording Indicator */}
                    {isRecordingRef.current && (
                         <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-red-500/80 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-2">
                             <span className="w-2 h-2 bg-white rounded-full"></span>
                             REC
                         </div>
                    )}

                    <div ref={videoWrapperRef} className={`relative bg-black overflow-hidden flex items-center justify-center group/video transition-all duration-300 ${isFullscreen && activeFullscreenPanel !== 'none' ? 'w-[calc(100%-400px)] h-full mr-auto' : 'w-full h-full'}`} style={{ isolation: 'isolate' }}>
                        
                        {/* --- Top Overlay Controls --- */}
                        <div className={`absolute top-0 left-0 right-0 z-50 p-2 bg-gradient-to-t from-black/20 to-transparent transition-opacity duration-300 flex justify-between items-start pointer-events-none ${isControlsVisible ? 'opacity-100' : 'opacity-0'}`}>
                            <div className="flex items-center gap-4 pointer-events-auto ml-2">
                                {/* Lock Button */}
                                <button 
                                    onClick={toggleLock} 
                                    className={`p-2 rounded-full transition-all duration-300 ${controlsLock === 'visible' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white'}`}
                                    title={controlsLock ? "Unlock Controls" : "Lock Controls"}
                                >
                                    {controlsLock ? <Lock size={20} /> : <Unlock size={20} />}
                                </button>
                                <div className="flex flex-col">
                                    {abLoopState !== 'none' && <span className="text-primary text-xs font-bold font-mono mt-1">Loop: {formatTime(loopA)} - {abLoopState === 'looping' ? formatTime(loopB) : '...'}</span>}
                                </div>
                            </div>
                            
                            <div className="pointer-events-auto flex gap-2">
                                {/* OCR Button (Moved Here for Visibility and Ease of Use) */}
                                {ankiConfig.ocrEnabled && (
                                    <button onClick={handleOcrClick} className={`bg-white/10 hover:bg-white/20 p-2.5 rounded-full backdrop-blur-sm transition-all ${ocrMode === 'dictionary' ? 'text-amber-400' : 'text-white'}`} title={t.ocrTitle}>
                                        {ocrMode === 'dictionary' ? <Zap size={20} className="fill-current"/> : <ScanText size={20} />}
                                    </button>
                                )}

                                {/* Screenshot / IO Button */}
                                <button onClick={handleScreenshotClick} className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full backdrop-blur-sm transition-all" title={t.screenshot}><Camera size={20} /></button>

                                {/* Bookmark Controls */}
                                <button onClick={handleOpenAddBookmarkModal} className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full backdrop-blur-sm transition-all" title={t.addBookmark}><BookmarkPlus size={20} /></button>
                                <div className="relative">
                                    <button onClick={() => setShowBookmarkList(!showBookmarkList)} className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full backdrop-blur-sm transition-all" title={t.bookmarks}><Book size={20} /></button>
                                    {showBookmarkList && (
                                        <div className="absolute top-full right-0 mt-2 bg-[#1e293b] rounded-xl shadow-2xl border border-white/10 w-72 p-2 z-[60] animate-in fade-in zoom-in-95 max-h-[60vh] flex flex-col">
                                            <h4 className="text-xs font-bold text-white mb-2 px-2 uppercase sticky top-0 bg-[#1e293b] z-10 py-1">{t.bookmarks}</h4>
                                            <div className="overflow-y-auto space-y-1 flex-1 pr-1 custom-scrollbar">
                                                {(!activeVideoItem?.bookmarks || activeVideoItem.bookmarks.length === 0) ? (
                                                    <p className="text-xs text-slate-500 px-2 py-2 text-center">{t.noBookmarks}</p>
                                                ) : (
                                                    // Use spread operator to avoid mutating the original array
                                                    [...activeVideoItem.bookmarks].sort((a,b) => a.time - b.time).map(bm => (
                                                        <div key={bm.id} className="p-2 hover:bg-white/10 rounded group border border-transparent hover:border-white/5 transition-all">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <button onClick={() => handleJumpToBookmark(bm.time, bm.end)} className="text-xs text-slate-200 hover:text-primary text-left flex-1 truncate font-semibold flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: bm.color || '#6366f1' }}></div>
                                                                    <span className="font-mono text-primary mr-2 opacity-80 flex-shrink-0">
                                                                        {formatTime(bm.time)}
                                                                        {bm.end && ` - ${formatTime(bm.end)}`}
                                                                    </span>
                                                                    <span className="truncate">{bm.text}</span>
                                                                </button>
                                                                <div className="flex items-center gap-1">
                                                                    <button onClick={() => handleOpenEditBookmarkModal(bm)} className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10" title={t.editBookmark}>
                                                                        <Edit2 size={12} />
                                                                    </button>
                                                                    <button onClick={() => handleDeleteBookmark(bm.id)} className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-red-500/10">
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            {bm.note && (
                                                                <p className="text-[10px] text-slate-500 line-clamp-2 pl-4 border-l-2 border-white/10 ml-1">{bm.note}</p>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button onClick={() => { setSelectedWord(''); isFullscreen ? setActiveFullscreenPanel('dictionary') : setDictOpen(true); }} className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full backdrop-blur-sm transition-all" title={t.dictionary}><BookA size={20} /></button>
                                <button onClick={() => setShowMask(!showMask)} className={`bg-white/10 hover:bg-white/20 p-2.5 rounded-full backdrop-blur-sm transition-all ${showMask ? 'text-primary' : 'text-white'}`} title={t.toggleMask}><EyeOff size={20} /></button>
                                <button onClick={handleQuickCard} className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full backdrop-blur-sm transition-all" title={t.quickCard}><PlusSquare size={20} /></button>
                            </div>
                        </div>

                        <div className={`w-full h-full ${mediaType === 'audio' ? 'hidden' : 'block'}`}>
                            <Player 
                                key={`${activeVideoItem?.id}-${isM3U8}`}
                                ref={playerRef} 
                                url={activeVideoItem?.src} 
                                width="100%" 
                                height="100%" 
                                playing={isPlaying} 
                                controls={false} 
                                onProgress={handleProgress} 
                                onDuration={handleDuration} 
                                onEnded={() => setIsPlaying(false)} 
                                onBuffer={() => setIsBuffering(true)}
                                onBufferEnd={() => setIsBuffering(false)}
                                progressInterval={100} 
                                onReady={() => {
                                    if (!onReadyRef.current) {
                                      if (!activeVideoItem?.isLive) {
                                          const saved = localStorage.getItem(`vam_progress_${activeVideoItem?.id}`);
                                          if (saved) {
                                            const time = parseFloat(saved);
                                            setTimeout(() => {
                                              if (playerRef.current && !seekLockRef.current) {
                                                playerRef.current.seekTo(time, 'seconds');
                                                setPlayedSeconds(time);
                                              }
                                            }, 300);
                                          }
                                      } else {
                                          setPlayedSeconds(0); 
                                      }
                                      onReadyRef.current = true;
                                      
                                      const pollForDimensions = (retries = 20) => { 
                                          if (retries <= 0) {
                                              return;
                                          }
                                          const videoEl = playerRef.current?.getInternalPlayer();
                                          if (videoEl && videoEl.videoWidth > 0) {
                                              calculateGeometry();
                                          } else {
                                              setTimeout(() => pollForDimensions(retries - 1), 100);
                                          }
                                      };
                                      pollForDimensions();
                                    }
                                }}
                                config={{
                                    file: {
                                        forceHLS: isM3U8,
                                        attributes: {
                                            crossOrigin: 'anonymous', // Force anonymous for CORS support
                                            playsInline: true,
                                            referrerPolicy: 'no-referrer' 
                                        },
                                        hlsOptions: {
                                            enableWorker: false, 
                                            startLevel: -1,
                                            manifestLoadingTimeOut: 20000,
                                            manifestLoadingMaxRetry: 6,
                                            manifestLoadingRetryDelay: 500,
                                            levelLoadingTimeOut: 20000,
                                            levelLoadingMaxRetry: 6,
                                            levelLoadingRetryDelay: 500,
                                            fragLoadingTimeOut: 30000,
                                            fragLoadingMaxRetry: 6,
                                            fragLoadingRetryDelay: 500,
                                            backBufferLength: 300 
                                        }
                                    }
                                }}
                                onError={handlePlayerError}
                                style={{ pointerEvents: 'none' }} 
                            />
                            <div className="absolute inset-0 z-10" onClick={togglePlay}></div>
                        </div>
                        
                        {mediaType === 'audio' && (
                            <div className="flex flex-col items-center gap-6 animate-fade-in z-0 w-full h-full justify-center bg-slate-900">
                                <div className="relative w-48 h-48 md:w-64 md:h-64 rounded-xl shadow-2xl overflow-hidden border border-white/10">
                                    {activeVideoItem?.thumbnail ? (
                                      <img src={activeVideoItem.thumbnail} className="w-full h-full object-cover" alt="Cover" /> 
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-slate-800"><FileAudio size={64} className="text-slate-400" /></div>
                                    )}
                                </div>
                                <h3 className="text-2xl font-light text-slate-300 max-w-md text-center">{activeVideoItem?.title}</h3>
                            </div>
                        )}

                        {!isPlaying && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-2xl scale-100 transition-transform group-hover/video:scale-110">
                                    <Play className="text-white fill-white ml-2" size={40} />
                                </div>
                            </div>
                        )}

                        {subtitleVisible && isSubtitleActive && (
                            <div 
                                className={`absolute left-4 right-4 text-center pointer-events-auto transition-all duration-300 z-30 flex justify-center`}
                                style={subtitleBottomStyle}
                            >
                                {renderCurrentSubtitles()}
                            </div>
                        )}
                    </div>
                    
                    {/* Mask Layer is a sibling of the resizing wrapper */}
                    {showMask && (
                        <div 
                            className="absolute backdrop-blur-xl bg-white/5 border-y border-white/10 z-20 flex group/mask"
                            style={maskStyle}
                        >
                            {/* Left Move Zone */}
                            <div 
                                className="flex-1 cursor-ns-resize"
                                onMouseDown={(e) => handleMaskMouseDown(e, 'move')}
                                onTouchStart={(e) => handleMaskMouseDown(e, 'move')}
                            />

                            {/* Center Resize Zone */}
                            <div 
                                className="w-24 cursor-row-resize hover:bg-white/5 transition-colors border-x border-white/5"
                                onMouseDown={(e) => handleMaskMouseDown(e, 'resize')}
                                onTouchStart={(e) => handleMaskMouseDown(e, 'resize')}
                            />

                            {/* Right Move Zone */}
                            <div 
                                className="flex-1 cursor-ns-resize"
                                onMouseDown={(e) => handleMaskMouseDown(e, 'move')}
                                onTouchStart={(e) => handleMaskMouseDown(e, 'move')}
                            />
                        </div>
                    )}
                    
                    {/* Bottom Controls - More transparent background (from-black/20) */}
                    <div className={`absolute bottom-0 left-0 right-0 px-4 pt-2 bg-gradient-to-t from-black/20 to-transparent transition-opacity duration-300 flex flex-col gap-2 z-30 ${isControlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                        {/* Hide progress bar for live streams, only show 'LIVE' badge if desired, or show simplified controls */}
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
                                        onMouseDown={handleSeekMouseDown} 
                                        onChange={handleSeekChange} 
                                        onMouseUp={handleSeekMouseUp} 
                                        onTouchStart={handleSeekMouseDown} 
                                        onTouchEnd={handleSeekMouseUp}
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
                                <button onClick={togglePlay} className="text-white hover:text-primary transition-colors">
                                    {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                                </button>
                                <div className="w-px h-6 bg-white/20 mx-1" />
                                <button onClick={() => jumpToSubtitle(-1)} className="text-slate-300 hover:text-white transition-colors"><SkipBack size={20} /></button>
                                <button onClick={() => jumpToSubtitle(1)} className="text-slate-300 hover:text-white transition-colors"><SkipForward size={20} /></button>
                                
                                <div className="w-px h-6 bg-white/20 mx-1" />
                                <div className="flex items-center bg-white/10 rounded-lg p-0.5">
                                    <button 
                                        onClick={handleABLoopClick} 
                                        className={`flex items-center gap-1 text-xs font-bold px-2 py-1.5 rounded transition-colors ${abLoopState !== 'none' ? 'bg-primary text-white shadow' : 'text-slate-300 hover:text-white'}`} 
                                        title={t.abLoop}
                                    >
                                        <Repeat size={16} />
                                        {abLoopState === 'a-set' && <span className="text-[10px]">A-</span>}
                                        {abLoopState === 'looping' && <span className="text-[10px]">{ankiConfig.abButtonMode === 'loop' ? 'A-B' : 'REC'}</span>}
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
                                <button onClick={cycleSubtitleMode} className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors ${subtitleMode === 'both' ? 'bg-primary text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`} title={t.cycleMode}>
                                    <MessageSquare size={20} />
                                </button>
                                <button onClick={() => setSubtitleVisible(!subtitleVisible)} className={`${subtitleVisible ? 'text-primary' : 'text-slate-400'} hover:text-white transition-colors`}><Languages size={20} /></button>
                                <button onClick={toggleTranscript} className={`${(activeFullscreenPanel === 'transcript' || showTranscript) ? 'text-primary' : 'text-slate-400'} hover:text-white transition-colors`}><List size={20} /></button>
                                <button onClick={toggleFullscreen} className="text-slate-300 hover:text-white transition-colors">{isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</button>
                            </div>
                        </div>
                    </div>

                    {isAnkiModalOpen && <AnkiEditModal 
                        isOpen={isAnkiModalOpen} 
                        onClose={() => setIsAnkiModalOpen(false)} 
                        onConfirm={handleConfirmAddNote} 
                        initialData={pendingNote} 
                        lang={lang}
                        learningLang={learningLang}
                        currentPlayerTime={playedSeconds}
                        duration={duration}
                        subtitles={subtitles}
                        onRetakeImage={handleRetakeImage}
                        onSeek={handleSeekTo}
                        onPlayAudioRange={handlePreviewAudio}
                        isOcclusionMode={ankiModalMode === 'occlusion'}
                    />}

                    {/* Bookmark Modal - Now inside Player Container for Fullscreen support */}
                    <BookmarkModal 
                        isOpen={bookmarkModalState.isOpen}
                        onClose={() => setBookmarkModalState(prev => ({...prev, isOpen: false}))}
                        onConfirm={handleSaveBookmark}
                        onRecordVideo={(start, end) => handleTriggerRecording('video', start, end)}
                        onRecordAudio={(start, end) => handleTriggerRecording('audio', start, end)}
                        initialTitle={bookmarkModalState.defaultTitle}
                        initialNote={bookmarkModalState.defaultNote}
                        initialTime={bookmarkModalState.time || 0}
                        initialEnd={bookmarkModalState.end}
                        initialColor={bookmarkModalState.color}
                        isEditing={bookmarkModalState.mode === 'edit'}
                        lang={lang}
                        duration={duration}
                    />

                    {/* OCR Result & Capture Modal */}
                    {ocrResult !== null && (
                        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                            <div className="bg-[#1e293b] rounded-xl w-full max-w-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
                                <div className="flex items-center justify-between p-3 border-b border-white/10 bg-[#0f172a] shrink-0">
                                    <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                                        <ScanText size={16} className="text-primary"/> {t.ocrTitle}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={handleOcrRetake} 
                                            className="text-xs flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded transition-colors text-slate-300"
                                        >
                                            <Camera size={14}/> {t.retakeScreenshot}
                                        </button>
                                        <button onClick={() => setOcrResult(null)} className="text-slate-400 hover:text-white ml-1"><X size={18}/></button>
                                    </div>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto bg-black/20 p-4 space-y-4 min-h-0">
                                    {/* Top: Image & Shutter Cropper */}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-center">
                                            {/* Mode Switcher and Reset Buttons */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
                                                    <button 
                                                        onClick={() => setOcrEditMode('vertical')}
                                                        className={`px-3 py-1 text-xs rounded transition-all flex items-center gap-1 ${ocrEditMode === 'vertical' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                                    >
                                                        <MoveVertical size={12}/> Height
                                                    </button>
                                                    <button 
                                                        onClick={() => setOcrEditMode('horizontal')}
                                                        className={`px-3 py-1 text-xs rounded transition-all flex items-center gap-1 ${ocrEditMode === 'horizontal' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                                    >
                                                        <MoveHorizontal size={12}/> Width
                                                    </button>
                                                </div>

                                                <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block"></div>

                                                <button 
                                                    onClick={() => setOcrBounds(prev => ({...prev, top: 0, bottom: 100}))} 
                                                    className="px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 transition-colors text-[10px] flex items-center gap-1"
                                                    title="Reset Height (0-100%)"
                                                >
                                                    <RotateCcw size={12}/> Reset H
                                                </button>
                                                <button 
                                                    onClick={() => setOcrBounds(prev => ({...prev, left: 0, right: 100}))} 
                                                    className="px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 transition-colors text-[10px] flex items-center gap-1"
                                                    title="Reset Width (0-100%)"
                                                >
                                                    <RotateCcw size={12}/> Reset W
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className="relative w-full bg-black rounded-lg overflow-hidden border border-white/10 shadow-lg select-none flex items-center justify-center bg-checkered min-h-[200px] p-4">
                                            {/* Wrapper tightly fits the image dimensions */}
                                            <div ref={ocrWrapperRef} className="relative inline-block max-h-[50vh]">
                                                <img 
                                                    ref={ocrImageRef}
                                                    src={ocrResult.image} 
                                                    alt="Capture" 
                                                    className="max-w-full max-h-[50vh] w-auto h-auto block select-none" 
                                                />
                                                
                                                {/* Shutter Overlay Layers - Positioned absolute to wrapper */}
                                                <div className="absolute inset-0 pointer-events-none touch-none">
                                                    
                                                    {/* Top Curtain */}
                                                    <div 
                                                        className="absolute top-0 left-0 right-0 bg-black/70 border-b border-white/30 backdrop-blur-[1px] transition-all duration-100"
                                                        style={{ height: `${ocrBounds.top}%` }}
                                                    >
                                                        {/* Top Handle */}
                                                        {ocrEditMode === 'vertical' && (
                                                            <div 
                                                                className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-12 h-6 bg-white/20 hover:bg-primary/80 backdrop-blur rounded-full cursor-ns-resize pointer-events-auto flex items-center justify-center shadow-lg transition-colors z-20"
                                                                onMouseDown={(e) => handleShutterDrag(e, 'top')}
                                                                onTouchStart={(e) => handleShutterDrag(e, 'top')}
                                                            >
                                                                <div className="w-6 h-1 bg-white/80 rounded-full"></div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Bottom Curtain */}
                                                    <div 
                                                        className="absolute bottom-0 left-0 right-0 bg-black/70 border-t border-white/30 backdrop-blur-[1px] transition-all duration-100"
                                                        style={{ height: `${100 - ocrBounds.bottom}%` }}
                                                    >
                                                        {/* Bottom Handle */}
                                                        {ocrEditMode === 'vertical' && (
                                                            <div 
                                                                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-6 bg-white/20 hover:bg-primary/80 backdrop-blur rounded-full cursor-ns-resize pointer-events-auto flex items-center justify-center shadow-lg transition-colors z-20"
                                                                onMouseDown={(e) => handleShutterDrag(e, 'bottom')}
                                                                onTouchStart={(e) => handleShutterDrag(e, 'bottom')}
                                                            >
                                                                <div className="w-6 h-1 bg-white/80 rounded-full"></div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Horizontal Shutters (Only visible in horizontal mode) */}
                                                    {ocrEditMode === 'horizontal' && (
                                                        <>
                                                            {/* Left Curtain */}
                                                            <div 
                                                                className="absolute bg-black/70 border-r border-white/30 backdrop-blur-[1px] transition-all duration-100"
                                                                style={{ 
                                                                    top: `${ocrBounds.top}%`, 
                                                                    bottom: `${100 - ocrBounds.bottom}%`,
                                                                    left: 0,
                                                                    width: `${ocrBounds.left}%`
                                                                }}
                                                            >
                                                                <div 
                                                                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-6 h-12 bg-white/20 hover:bg-primary/80 backdrop-blur rounded-full cursor-ew-resize pointer-events-auto flex items-center justify-center shadow-lg transition-colors z-20"
                                                                    onMouseDown={(e) => handleShutterDrag(e, 'left')}
                                                                    onTouchStart={(e) => handleShutterDrag(e, 'left')}
                                                                >
                                                                    <div className="w-1 h-6 bg-white/80 rounded-full"></div>
                                                                </div>
                                                            </div>

                                                            {/* Right Curtain */}
                                                            <div 
                                                                className="absolute bg-black/70 border-l border-white/30 backdrop-blur-[1px] transition-all duration-100"
                                                                style={{ 
                                                                    top: `${ocrBounds.top}%`, 
                                                                    bottom: `${100 - ocrBounds.bottom}%`,
                                                                    right: 0,
                                                                    width: `${100 - ocrBounds.right}%`
                                                                }}
                                                            >
                                                                <div 
                                                                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-12 bg-white/20 hover:bg-primary/80 backdrop-blur rounded-full cursor-ew-resize pointer-events-auto flex items-center justify-center shadow-lg transition-colors z-20"
                                                                    onMouseDown={(e) => handleShutterDrag(e, 'right')}
                                                                    onTouchStart={(e) => handleShutterDrag(e, 'right')}
                                                                >
                                                                    <div className="w-1 h-6 bg-white/80 rounded-full"></div>
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Result Display - Only shown when active/result exists */}
                                    {(ocrResult.text || isOcrProcessing) && (
                                        <div className="flex flex-col animate-in slide-in-from-top-2 fade-in duration-300">
                                            <div className="bg-[#0f172a] rounded-lg border border-white/5 p-3 flex flex-col relative overflow-hidden group">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                                        {t.ocrResult} 
                                                        <span className="text-[9px] bg-black/20 px-1.5 py-0.5 rounded">{ankiConfig.ocrLang || 'eng'}</span>
                                                    </span>
                                                </div>
                                                
                                                {isOcrProcessing ? (
                                                    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 min-h-[4rem]">
                                                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                                        <span className="text-xs">{t.ocrProcessing}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 overflow-y-auto font-serif text-base leading-relaxed text-slate-200 selection:bg-primary/30 whitespace-pre-wrap h-auto min-h-[4rem] max-h-48 transition-all scrollbar-thin scrollbar-thumb-white/20 pr-1">
                                                        {renderLine(ocrResult.text || '', true, 'left')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Footer with Actions */}
                                <div className="p-3 border-t border-white/10 bg-[#0f172a] flex justify-end gap-2 shrink-0">
                                    {ocrResult.text && !isOcrProcessing && (
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(ocrResult.text || '');
                                                showToast(t.copied, 'success');
                                            }}
                                            className="px-4 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 font-bold text-xs flex items-center gap-2 border border-green-600/20 transition-all"
                                        >
                                            <Copy size={16}/> {t.copy}
                                        </button>
                                    )}
                                    
                                    <button 
                                        onClick={executeOcr}
                                        disabled={isOcrProcessing}
                                        className="px-6 py-2 rounded-lg bg-primary hover:bg-primary/80 text-white font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
                                    >
                                        {isOcrProcessing ? <Loader2 className="animate-spin" size={16}/> : <ScanText size={16}/>} 
                                        {t.runOcr}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {isFullscreen && (
                        <>
                            <DictionaryPanel 
                                word={selectedWord} sentence={selectedSentence} onAddToAnki={(term, def, sentence) => addToAnki(term, def, sentence)} isAddingToAnki={isAddingToAnki} 
                                isOpen={activeFullscreenPanel === 'dictionary'} onClose={() => setActiveFullscreenPanel('none')} variant="sidebar" 
                                learningLanguage={learningLang} onAppendNext={handleAppendWord} canAppend={nextSegmentIndex < currentSegments.length}
                                lang={lang}
                                searchEngine={ankiConfig.searchEngine}
                            />
                            <TranscriptPanel isOpen={activeFullscreenPanel === 'transcript'} onClose={() => setActiveFullscreenPanel('none')} subtitles={subtitles} currentSubtitleIndex={currentSubtitleIndex} onSeek={handleSeekTo} subtitleOffset={subtitleOffset} variant="sidebar" lang={lang} />
                        </>
                    )}
                </div>
            </div>
        )}
      </main>
      
      {!isFullscreen && (
        <>
            <DictionaryPanel word={selectedWord} sentence={selectedSentence} onAddToAnki={(term, def, sentence) => addToAnki(term, def, sentence)} isAddingToAnki={isAddingToAnki} isOpen={dictOpen} onClose={() => setDictOpen(false)} variant="bottom-sheet" learningLanguage={learningLang} onAppendNext={handleAppendWord} canAppend={nextSegmentIndex < currentSegments.length} lang={lang} searchEngine={ankiConfig.searchEngine} />
            <TranscriptPanel isOpen={showTranscript} onClose={() => setShowTranscript(false)} subtitles={subtitles} currentSubtitleIndex={currentSubtitleIndex} onSeek={handleSeekTo} subtitleOffset={subtitleOffset} variant="bottom-sheet" lang={lang} />
        </>
      )}
    </div>
  );
};
export default App;