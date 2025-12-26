
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactPlayer from 'react-player';
import Tesseract from 'tesseract.js';
import { Subtitle, MediaType, AnkiConfig, VideoLibraryItem, SubtitleMode, UILanguage, LearningLanguage, AnkiNoteData, Bookmark, ABLoopMode, CapturedClip, ABButtonMode } from './types';
import { formatTime, parseSRT, parseVTT, parseASS, generateVideoThumbnail, captureVideoFrame, extractAudioClip, recordAudioFromPlayer, getEventY, getSupportedMimeType, downloadBlob, blobToBase64 } from './utils';
import { ankiService, setAnkiAddress } from './services/ankiService';
import { initDB, saveVideo, getLibrary, getVideoFile, deleteVideo, exportAllData, importAllData, clearAllData, saveClip, getClips, deleteClip } from './services/storageService';
import { getTranslation } from './i18n';
import DictionaryPanel from './components/DictionaryPanel';
import AnkiEditModal from './components/AnkiEditModal';
import BookmarkModal from './components/BookmarkModal';
import VideoLibrary from './components/VideoLibrary';
import TranscriptPanel from './components/TranscriptPanel';
import Header from './components/Header';
import SettingsSidebar from './components/SettingsSidebar';
import PlayerControls from './components/PlayerControls';
import OCRModal from './components/OCRModal';
import { 
  Play, Loader2, Lock, Unlock, BookmarkPlus, Book, Camera, BookA, EyeOff, PlusSquare, ScanText, Zap,
  CheckCircle, AlertCircle, Info, X, Edit2, Trash2, FileAudio, Mic, Video
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
  const [isWideScreen, setIsWideScreen] = useState(false); 
  
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
  
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

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

  const [isAnkiModalOpen, setIsAnkiModalOpen] = useState(false);
  const [pendingNote, setPendingNote] = useState<AnkiNoteData>({
      word: '', definition: '', sentence: '', translation: '', audioStart: 0, audioEnd: 0, imageData: null
  });
  const [ankiModalMode, setAnkiModalMode] = useState<'standard' | 'occlusion'>('standard');
  
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [controlsLock, setControlsLock] = useState<'visible' | null>(null);
  
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedWord, setSelectedWord] = useState('');
  const [selectedSentence, setSelectedSentence] = useState('');
  const [currentSegments, setCurrentSegments] = useState<string[]>([]);
  const [nextSegmentIndex, setNextSegmentIndex] = useState<number>(-1);

  const [ankiConnected, setAnkiConnected] = useState(false);
  const [isAddingToAnki, setIsAddingToAnki] = useState(false);
  
  const [showMask, setShowMask] = useState(false);
  const [maskTop, setMaskTop] = useState(70); 
  const [maskHeight, setMaskHeight] = useState(15); 
  const [videoGeometry, setVideoGeometry] = useState({ width: 0, height: 0, top: 0, left: 0 });

  const [abLoopState, setAbLoopState] = useState<'none' | 'a-set' | 'looping'>('none');
  const [loopA, setLoopA] = useState(0);
  const [loopB, setLoopB] = useState(0);
  const [capturedClips, setCapturedClips] = useState<CapturedClip[]>([]);
  const [showClipsList, setShowClipsList] = useState(false);
  const [playbackClip, setPlaybackClip] = useState<CapturedClip | null>(null); 
  
  const [recorderMode, setRecorderMode] = useState<'video' | 'audio' | null>(null);
  const [recordingTarget, setRecordingTarget] = useState<{start: number, end: number, filename?: string} | null>(null);

  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<{ text: string | null; image: string; debug?: any } | null>(null);
  const [ocrMode, setOcrMode] = useState<'standard' | 'dictionary'>('standard');
  const [ocrBounds, setOcrBounds] = useState<{top: number, bottom: number, left: number, right: number}>({ top: 70, bottom: 90, left: 10, right: 90 });
  const [ocrEditMode, setOcrEditMode] = useState<'vertical' | 'horizontal'>('vertical');
  
  const ocrImageRef = useRef<HTMLImageElement>(null);
  const ocrWrapperRef = useRef<HTMLDivElement>(null); 
  
  const [ankiConfig, setAnkiConfig] = useState<AnkiConfig>({
    ip: '127.0.0.1', port: '8765',
    deck: '', model: '', tags: ['vamplayer'],
    fields: { word: '', sentence: '', definition: '', translation: '', audio: '', image: '', video: '' },
    imageOcclusion: { deck: '', model: '', tags: ['vamplayer_io'], fields: { image: '', mask: '', header: '', backExtra: '', remarks: '', audio: '', id: '' } },
    subtitleSize: 16, 
    subtitleBottomMargin: 5, 
    subtitleDisplayMode: 'interactive', 
    searchEngine: 'bing',
    abButtonMode: 'loop',
    ocrLang: 'eng',
    ocrEnabled: false,
    keyboardShortcutsEnabled: true // Default to true
  });

  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const seekLockRef = useRef(false);
  const onReadyRef = useRef(false);
  const isRecordingRef = useRef(false); 
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const ankiRecordingCallbackRef = useRef<((blob: Blob) => Promise<void>) | null>(null);
  const geometryRafRef = useRef<number | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const dictResumeRef = useRef(false);
  const wasPlayingRef = useRef(false); 

  const Player = ReactPlayer as any;
  const segmenterRef = useRef<any>(null);

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
  
  useEffect(() => {
      const media = window.matchMedia('(min-width: 768px)');
      setIsWideScreen(media.matches);
      const listener = (e: MediaQueryListEvent) => setIsWideScreen(e.matches);
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
  }, []);

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

  const cleanOcrText = useCallback((text: string, lang: string = 'eng') => {
      if (!text) return "";
      const target = lang.toLowerCase();
      if (target.startsWith('chi') || target.startsWith('jpn')) {
          return text.replace(/\s+/g, '');
      }
      return text.trim();
  }, []);

  const calculateGeometry = useCallback(() => {
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
        if (containerAR > videoAR) { 
            frameHeight = containerHeight;
            frameWidth = containerHeight * videoAR;
            frameTop = 0;
            frameLeft = (containerWidth - frameWidth) / 2;
        } else { 
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

  useEffect(() => {
    if (isFullscreen) {
        const timer = setTimeout(() => { calculateGeometry(); }, 350);
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

  useEffect(() => {
      const init = async () => {
        try {
          await initDB();
          const items = await getLibrary();
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
          if (!config.imageOcclusion) {
              config.imageOcclusion = { deck: '', model: '', tags: ['vamplayer_io'], fields: { image: '', mask: '', header: '', backExtra: '', remarks: '', audio: '', id: '' } };
          } 
          if (!config.fields.video) config.fields.video = '';
          if (!config.ocrLang) config.ocrLang = 'eng';
          if (typeof config.ocrEnabled === 'undefined') config.ocrEnabled = false;
          if (typeof config.keyboardShortcutsEnabled === 'undefined') config.keyboardShortcutsEnabled = true; // Default to true
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
          const captureStream = (videoEl as any).captureStream() as MediaStream;
          let streamToRecord = captureStream;
          if (currentMode === 'audio') {
              const audioTracks = captureStream.getAudioTracks();
              if (audioTracks.length > 0) {
                  streamToRecord = new MediaStream(audioTracks);
              } else {
                  showToast("No audio tracks found on video element", 'error');
                  return; 
              }
          }
          const mimeType = getSupportedMimeType(currentMode === 'video' ? 'video' : 'audio');
          if (!mimeType) {
              showToast("No supported recording MIME type found", 'error');
              return;
          }
          const recorder = new MediaRecorder(streamToRecord, { mimeType });
          mediaRecorderRef.current = recorder;
          recordedChunksRef.current = [];
          recorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                  recordedChunksRef.current.push(event.data);
              }
          };
          recorder.onstop = async () => {
              const currentTarget = recordingTargetRef.current;
              const mode = recorderModeRef.current || 'video';
              const mimeType = getSupportedMimeType(mode === 'video' ? 'video' : 'audio');
              const blob = new Blob(recordedChunksRef.current, { type: mimeType });
              if (ankiRecordingCallbackRef.current) {
                  await ankiRecordingCallbackRef.current(blob);
                  ankiRecordingCallbackRef.current = null;
                  isRecordingRef.current = false;
                  setRecorderMode(null);
                  setRecordingTarget(null);
                  recordedChunksRef.current = [];
                  return; 
              }
              const url = URL.createObjectURL(blob);
              if (currentTarget?.filename) {
                  const title = currentTarget.filename;
                  const newClip: CapturedClip = {
                      id: crypto.randomUUID(),
                      type: mode === 'video' ? 'video' : 'audio',
                      src: url,
                      title: title,
                      timestamp: Date.now(),
                      duration: 0,
                      blob: blob,
                      videoId: activeVideoItemRef.current?.id
                  };
                  try {
                      await saveClip(newClip);
                      setCapturedClips(prev => [newClip, ...prev]);
                      showToast(`${t.clipSaved}: ${title}`, 'success');
                  } catch (e) {
                      console.error("Failed to save clip", e);
                      showToast(t.clipFailed, 'error');
                  }
              } else {
                  const titleTime = formatTime(playerRef.current?.getCurrentTime() || 0);
                  const ext = mode === 'video' ? 'webm' : 'weba';
                  let title = `${mode === 'video' ? 'Video' : 'Audio'} ${titleTime}`;
                  if (currentTarget) {
                      title = `${mode === 'video' ? 'Video' : 'Audio'} Clip ${formatTime(currentTarget.start)} - ${formatTime(currentTarget.end)}`;
                  }
                  const newClip: CapturedClip = {
                      id: crypto.randomUUID(),
                      type: mode === 'video' ? 'video' : 'audio',
                      src: url, 
                      title: title,
                      timestamp: Date.now(),
                      duration: 0, 
                      blob: blob,
                      videoId: activeVideoItemRef.current?.id 
                  };
                  try {
                      await saveClip(newClip);
                      setCapturedClips(prev => [newClip, ...prev]);
                      showToast(t.clipSaved, 'success');
                  } catch (e) {
                      console.error("Failed to save clip", e);
                      showToast(t.clipFailed, 'error');
                  }
              }
              isRecordingRef.current = false;
              setRecorderMode(null);
              setRecordingTarget(null);
              recordedChunksRef.current = [];
          };
          recorder.start(100); 
          isRecordingRef.current = true;
          if (!ankiRecordingCallbackRef.current) {
              showToast(t.recording, 'info');
          }
      } catch (e) {
          console.error("Recording failed", e);
          showToast(t.recordingFailed, 'error');
      }
  }, [t, showToast]);

  const handleStopRecording = useCallback(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }
  }, []);

  const handleDeleteClip = async (id: string) => {
      try {
          await deleteClip(id);
          setCapturedClips(prev => {
              const updated = prev.filter(c => c.id !== id);
              const deleted = prev.find(c => c.id === id);
              if (deleted) URL.revokeObjectURL(deleted.src);
              return updated;
          });
          showToast(t.deleteClip + " Success", 'success');
      } catch (e) {
          console.error("Failed to delete clip", e);
          showToast("Failed to delete clip", 'error');
      }
  };

  const handleProgress = useCallback((state: any) => {
      if (isSeeking || seekLockRef.current || !playerRef.current) return; 
      const time = state.playedSeconds;
      if (isRecordingRef.current && recordingTarget && time >= recordingTarget.end) {
           handleStopRecording();
           setIsPlaying(false);
           return;
      }
      if (abLoopState === 'looping' && time >= (loopB - 0.05)) { // Added a small buffer to ensure loop restarts before exact B
          playerRef.current.seekTo(loopA, 'seconds');
          setPlayedSeconds(loopA);
          return;
      }
      if (isRecordingRef.current) {
          setPlayedSeconds(time); 
          return;
      }
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
    // Ensure that after seeking, the next subtitle jump starts from the new position
    const index = subtitles.findIndex(s => time >= (s.start + subtitleOffset) && time <= (s.end + subtitleOffset));
    if (index !== -1) setCurrentSubtitleIndex(index);
    
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
      await saveVideo(newItem, file); 
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
            await saveVideo(newItem); 
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
        await saveVideo(newItem); 
        setLibraryItems(prev => [...prev, newItem]);
    }
  };

  const handleDeleteVideo = async (id: string) => {
      await deleteVideo(id); 
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
      await saveVideo(updatedItem); 
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
          let parsed: Subtitle[] = [];
          if (file.name.endsWith('.vtt')) parsed = parseVTT(text);
          else if (file.name.endsWith('.ass')) parsed = parseASS(text);
          else parsed = parseSRT(text);
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
          await saveVideo(updatedItem); 
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
      initialMasks?: any[],
      scriptHtmlDef?: string // New parameter for script HTML definition
  ) => {
      setIsAddingToAnki(true);
      try {
          setIsPlaying(false);
          const videoEl = playerRef.current?.getInternalPlayer() as HTMLVideoElement;
          const imageData = captureVideoFrame(videoEl);
          if (!imageData && isScreenshot) {
              showToast(t.ocrErrorCORS || "Screenshot failed", 'error');
          }
          let start = Math.max(0, playedSeconds - 2);
          let end = Math.min(duration, playedSeconds + 2);
          if (currentSubtitleIndex !== -1 && subtitles[currentSubtitleIndex]) {
              start = subtitles[currentSubtitleIndex].start + subtitleOffset;
              end = subtitles[currentSubtitleIndex].end + subtitleOffset;
          }
          const finalSentence = sentence || getActiveSubtitleText(subtitles, playedSeconds) || "";
          let processedSentence = finalSentence;
          if (term && finalSentence) {
             try {
                 const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                 const regex = new RegExp(`(${escapedTerm})`, 'gi');
                 processedSentence = finalSentence.replace(regex, '<b>$1</b>');
             } catch(e) {
                 console.warn("Failed to highlight term in sentence", e);
             }
          }
          const noteData: AnkiNoteData = {
              word: term,
              definition: scriptHtmlDef || definition, // Use scriptHtmlDef if provided, otherwise the 'definition' argument
              sentence: processedSentence,
              translation: translation || getActiveSubtitleText(secondarySubtitles, playedSeconds) || "",
              imageData: imageData,
              audioStart: start,
              audioEnd: end,
              occlusionMasks: initialMasks
          };
          setPendingNote(noteData);
          setAnkiModalMode(isScreenshot || initialMasks ? 'occlusion' : 'standard'); 
          if (autoOpen) {
              setDictOpen(false);
              setActiveFullscreenPanel('none');
              setIsAnkiModalOpen(true);
          }
      } catch (e) {
          console.error(e);
          showToast(t.failedToPrepareCard, 'error');
      } finally {
          setIsAddingToAnki(false);
      }
  };

  const handleWordClick = (segment: string, fullText: string, segments: string[], nextIndex: number) => {
    dictResumeRef.current = isPlaying;
    if (isPlaying) setIsPlaying(false);
    const cleanWord = segment.trim(); 
    if (!cleanWord) return;
    setSelectedWord(cleanWord);
    setSelectedSentence(fullText);
    setCurrentSegments(segments);
    setNextSegmentIndex(nextIndex);
    if (isFullscreen) {
        setActiveFullscreenPanel('dictionary');
    } else {
        setDictOpen(true);
    }
  };

  const handleDictClose = () => {
    if (isFullscreen) {
        setActiveFullscreenPanel('none');
    } else {
        setDictOpen(false);
    }
    if (dictResumeRef.current && !isPlaying) {
        setIsPlaying(true);
    }
    dictResumeRef.current = false;
  };

  const handleAppendWord = () => {
      if (nextSegmentIndex < currentSegments.length) {
          const nextSegment = currentSegments[nextSegmentIndex];
          const isCJK = ['zh', 'ja'].includes(learningLang || 'en');
          const separator = isCJK ? '' : ' ';
          const newWord = selectedWord + separator + nextSegment;
          setSelectedWord(newWord);
          setNextSegmentIndex(prev => prev + 1);
      }
  };

  const handleSeekTo = useCallback((time: number) => {
      if (playerRef.current) {
          playerRef.current.seekTo(time, 'seconds');
          setPlayedSeconds(time);
      }
  }, []);
  
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

    const currentTime = playerRef.current?.getCurrentTime() || playedSeconds;
    let targetIndex;
    
    if (offset > 0) {
        // Find the next subtitle after current time (with a small buffer)
        targetIndex = subtitles.findIndex(s => (s.start + subtitleOffset) > (currentTime + 0.1));
        if (targetIndex === -1) targetIndex = subtitles.length - 1; // If no next, go to last
    } else {
        // Find the previous subtitle before current time (with a small buffer)
        const reversedIndex = [...subtitles].reverse().findIndex(s => (s.start + subtitleOffset) < (currentTime - 0.1)); // Changed 0.5 to 0.1 for faster prev
        targetIndex = reversedIndex === -1 ? 0 : subtitles.length - 1 - reversedIndex; // If no prev, go to first
    }

    const sub = subtitles[targetIndex];
    handleSeekTo(sub.start + subtitleOffset);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) playerContainerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };
  const toggleTranscript = () => {
      if (isFullscreen) {
          setActiveFullscreenPanel(prev => prev === 'transcript' ? 'none' : 'transcript');
      } else {
          setShowTranscript(prev => !prev);
      }
  };

  const handleQuickCard = async () => {
      await addToAnki("", "", undefined, undefined, undefined, true, false); 
  };

  const handleScreenshotClick = async () => {
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

  const performDirectOcr = async () => {
      const videoEl = playerRef.current?.getInternalPlayer();
      if (!videoEl || !(videoEl instanceof HTMLVideoElement)) {
          showToast(t.ocrErrorCORS, 'error');
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
              setSelectedWord(''); 
              if (isFullscreen) {
                  setActiveFullscreenPanel('dictionary');
              } else {
                  setDictOpen(true);
              }
          } else {
              showToast(t.ocrNoText, 'error');
          }
      } catch (e) {
          console.error("Direct OCR Error", e);
          showToast(t.ocrErrorEmpty, 'error');
      }
  };

  const handleOcrClick = () => {
      if (ocrMode === 'dictionary') {
          performDirectOcr();
          return;
      }
      const videoEl = playerRef.current?.getInternalPlayer();
      if (!videoEl || !(videoEl instanceof HTMLVideoElement)) {
          showToast(t.ocrErrorCORS, 'error');
          return;
      }
      setIsPlaying(false);
      const dataUrl = captureVideoFrame(videoEl);
      if (dataUrl) {
          const src = dataUrl.startsWith('data:') ? dataUrl : `data:image/jpeg;base64,${dataUrl}`;
          setOcrResult({ text: null, image: src });
      } else {
          showToast(t.ocrErrorCORS, 'error');
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

  const executeOcr = async () => {
      if (!ocrResult?.image || !ocrImageRef.current) return;
      setIsOcrProcessing(true);
      try {
          const img = ocrImageRef.current;
          const naturalW = img.naturalWidth;
          const naturalH = img.naturalHeight;
          const canvas = document.createElement('canvas');
          const cropX = (ocrBounds.left / 100) * naturalW;
          const cropY = (ocrBounds.top / 100) * naturalH;
          const cropW = ((ocrBounds.right - ocrBounds.left) / 100) * naturalW;
          const cropH = ((ocrBounds.bottom - ocrBounds.top) / 100) * naturalH;
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
          showToast(t.ocrErrorEmpty, 'error');
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
      const isInteractive = ankiConfig.subtitleDisplayMode === 'interactive';
      if (subtitleMode === 'primary') {
         return primaryText ? <div className={containerClass} onClick={(e) => e.stopPropagation()}><div style={dynamicSizeStyle} className="leading-relaxed font-medium">{renderLine(primaryText, isInteractive, 'center')}</div></div> : null;
      }
      if (subtitleMode === 'secondary') {
         return secondaryText ? <div className={containerClass} onClick={(e) => e.stopPropagation()}><div style={{ fontSize: `${ankiConfig.subtitleSize * 0.8}px`, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }} className="leading-relaxed text-yellow-200/90 mt-1">{secondaryText}</div></div> : null;
      }
      return null;
  };

  const isSubtitleActive = (getActiveSubtitleText(subtitles, playedSeconds) || getActiveSubtitleText(secondarySubtitles, playedSeconds));
  const mainContainerClasses = viewMode === 'library' ? "w-full max-w-7xl px-4 md:px-6 py-6" : "w-full h-full overflow-hidden bg-black"; 
  const playerWrapperClasses = isFullscreen ? "flex items-center justify-center bg-black overflow-hidden relative w-full h-full" : "w-full h-full relative group bg-black";
  
  // Estimate height of player controls when visible
  // For non-fullscreen, the PlayerControls div is relative to the bottom of the video,
  // so the estimate already accounts for the absolute position.
  // For fullscreen, it's relative to the bottom of the entire screen.
  // PlayerControls has pb-3 (12px), range input (~24px), main controls (~40px)
  const fullscreenControlsHeight = 70; // Adjusted based on player controls height
  const nonFullscreenControlsHeight = 85; // Roughly the height of controls including progress bar and padding

  const actualControlBarHeight = isControlsVisible 
    ? (isFullscreen ? fullscreenControlsHeight : nonFullscreenControlsHeight) 
    : 0;
    
  const subtitleBottomStyle = {
      bottom: `${ankiConfig.subtitleBottomMargin + actualControlBarHeight}px`
  };

  const saveMaskConfig = async (top: number, height: number) => {
    const currentItem = activeVideoItemRef.current;
    if (!currentItem) return;
    const newConfig = { top, height };
    const updatedItem = { ...currentItem, maskConfig: newConfig };
    await saveVideo(updatedItem);
    setLibraryItems(prevItems => prevItems.map(item => item.id === currentItem.id ? updatedItem : item));
    setActiveVideoItem(prevActive => prevActive && prevActive.id === currentItem.id ? updatedItem : prevActive);
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
          showToast(t.warningMixedContent, 'error');
          if (hlsInstance) {
              hlsInstance.destroy();
              return;
          }
      }
      if (data) {
          if (data.fatal === false) return; 
          if (hlsInstance) {
              switch (data.type) {
                  case 'mediaError':
                      hlsInstance.recoverMediaError();
                      return; 
                  case 'networkError':
                      if (data.details === 'manifestLoadError' || data.response?.code === 0) {
                           hlsInstance.destroy();
                           break; 
                      }
                      hlsInstance.startLoad();
                      return; 
                  default:
                      hlsInstance.destroy();
                      break;
              }
          }
      }
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
      e.target.value = ''; 
  };

  const handleClearCache = async () => {
      if (window.confirm(t.clearCacheConfirm)) {
          await clearAllData();
          showToast(t.clearCacheSuccess, 'success');
          setTimeout(() => window.location.reload(), 1500);
      }
  };

  const handleABLoopClick = useCallback(() => {
    if (ankiConfig.abButtonMode === 'record') {
       if (isRecordingRef.current) {
           handleStopRecording();
       } else {
           handleStartRecording(); 
       }
       return;
    }
    const currentTime = playerRef.current?.getCurrentTime() || 0;
    if (abLoopState === 'none') {
        setLoopA(currentTime);
        setAbLoopState('a-set');
        showToast(t.pointASet, 'info');
    } else if (abLoopState === 'a-set') {
        if (currentTime > loopA) {
            setLoopB(currentTime);
            setAbLoopState('looping');
            showToast(t.loopingAB, 'info');
            playerRef.current?.seekTo(loopA, 'seconds');
        } else {
            showToast(t.pointBError, 'error');
            setAbLoopState('none');
        }
    } else {
        setAbLoopState('none');
        setLoopA(0);
        setLoopB(0);
        showToast(t.loopCleared, 'info');
    }
  }, [abLoopState, loopA, ankiConfig.abButtonMode, handleStartRecording, handleStopRecording, showToast]);

  const handleConfirmAddNote = async (noteData: AnkiNoteData) => {
      setIsAnkiModalOpen(false);
      const isIO = ankiModalMode === 'occlusion';
      const configFields = (isIO ? ankiConfig.imageOcclusion.fields : ankiConfig.fields) as any;
      const timestamp = Date.now();
      const videoFilename = `vam_video_${timestamp}.webm`;
      const audioFilename = `vam_audio_${timestamp}.webm`;
      const executeNoteCreation = async (audioBlob?: Blob) => {
          if (isIO) {
              if (!configFields.image || !configFields.mask) {
                  showToast("Error: Image or Mask field not mapped in Settings!", 'error');
                  return;
              }
          }
          let imageRef = '';
          if (noteData.imageData) {
              const imageFilename = `vam_img_${timestamp}.jpg`;
              try {
                  const storedImageName = await ankiService.storeMediaFile(imageFilename, noteData.imageData);
                  imageRef = `<img src="${storedImageName || imageFilename}">`;
              } catch (e) {
                  console.error("Failed to store image", e);
                  showToast(t.failedToStoreImage, 'error');
                  return;
              }
          }
          let audioRef = '';
          if (audioBlob) {
               try {
                   const audioBase64 = await blobToBase64(audioBlob);
                   const storedAudioName = await ankiService.storeMediaFile(audioFilename, audioBase64);
                   audioRef = `[sound:${storedAudioName || audioFilename}]`;
               } catch (e) {
                   console.error("Failed to store audio", e);
                   showToast(t.failedToStoreAudio, 'error');
               }
          }
          let videoRef = '';
          if (noteData.includeVideo && activeVideoItem) {
              videoRef = `[sound:${videoFilename}]`;
          }
          const fields: Record<string, string> = {};
          const mapFields = () => {
              if (!isIO) {
                  if (configFields.word) fields[configFields.word] = noteData.word || '';
                  if (configFields.sentence) fields[configFields.sentence] = noteData.sentence || '';
                  if (configFields.definition) fields[configFields.definition] = noteData.definition || '';
                  if (configFields.translation) fields[configFields.translation] = noteData.translation || '';
                  if (configFields.image && imageRef) fields[configFields.image] = imageRef;
                  if (configFields.audio && audioRef) fields[configFields.audio] = audioRef;
                  if (configFields.video && videoRef) fields[configFields.video] = videoRef;
              } else {
                  if (configFields.header) fields[configFields.header] = noteData.word || ''; 
                  if (configFields.backExtra) fields[configFields.backExtra] = noteData.definition || '';
                  if (configFields.remarks) fields[configFields.remarks] = noteData.remarks || '';
                  if (configFields.image && imageRef) fields[configFields.image] = imageRef;
                  if (configFields.audio && audioRef) fields[configFields.audio] = audioRef;
                  if (configFields.id) fields[configFields.id] = crypto.randomUUID(); 
              }
          };
          const deckName = isIO ? ankiConfig.imageOcclusion.deck : ankiConfig.deck;
          const modelName = isIO ? ankiConfig.imageOcclusion.model : ankiConfig.model;
          const tags = isIO ? ankiConfig.imageOcclusion.tags : ankiConfig.tags;
          mapFields();
          if (isIO && configFields.mask && noteData.occlusionMasks && noteData.occlusionMasks.length > 0) {
               const maskStrings = noteData.occlusionMasks.map((m: any, index: number) => {
                   const formatVal = (val: number) => (val / 100).toFixed(6).replace(/^0\./, '.');
                   const l = formatVal(m.x);
                   const t = formatVal(m.y);
                   const w = formatVal(m.w);
                   const h = formatVal(m.h);
                   const cIndex = index + 1; 
                   return `{{c${cIndex}::image-occlusion:rect:left=${l}:top=${t}:width=${w}:height=${h}:oi=1}}`;
               });
               fields[configFields.mask] = maskStrings.join('');
          }
          const note = { deckName, modelName, fields, tags: tags || [] };
          try {
              await ankiService.addNote(note);
              showToast(t.noteAdded, 'success');
              if (noteData.includeVideo && activeVideoItem) {
                  const start = noteData.audioStart || 0;
                  const end = noteData.audioEnd || (start + 5);
                  setTimeout(() => { handleTriggerRecording('video', start, end, videoFilename); }, 500);
              }
          } catch (e: any) {
              console.error(e);
              showToast(`${t.ankiError}: ${e.message}`, 'error');
          }
      };
      if (noteData.includeAudio && activeVideoItem) {
          if (!configFields.audio) {
              showToast("Warning: Audio field not mapped in settings. Skipping audio.", 'info');
              await executeNoteCreation(undefined);
              return;
          }
          showToast(t.recording || "Recording audio segment...", 'info');
          ankiRecordingCallbackRef.current = async (recordedBlob: Blob) => { await executeNoteCreation(recordedBlob); };
          const start = noteData.audioStart || 0;
          const end = noteData.audioEnd || (start + 5);
          handleTriggerRecording('audio', start, end);
          return;
      }
      await executeNoteCreation(undefined);
  };

  const handleRetakeImage = () => {
      const videoEl = playerRef.current?.getInternalPlayer() as HTMLVideoElement;
      return captureVideoFrame(videoEl);
  };

  const handleOpenAddBookmarkModal = () => {
      setIsPlaying(false);
      setBookmarkModalState({
          isOpen: true, mode: 'add', time: playedSeconds,
          defaultTitle: `${t.bookmarkAt} ${formatTime(playedSeconds)}`,
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
          isOpen: true, mode: 'edit', bookmarkId: bm.id, time: bm.time, end: bm.end,
          defaultTitle: bm.text, defaultNote: bm.note || '', color: bm.color
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
              id: crypto.randomUUID(), time: start || playedSeconds, end, text: title, note, color
          });
      }
      const updatedItem = { ...activeVideoItem, bookmarks: updatedBookmarks };
      await saveVideo(updatedItem);
      setLibraryItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
      setActiveVideoItem(updatedItem);
      setBookmarkModalState(prev => ({ ...prev, isOpen: false }));
      showToast(t.bookmarkAdded, 'success');
  };

  const handleTriggerRecording = (type: 'video' | 'audio', start: number, end: number, specificFilename?: string) => {
      if (!playerRef.current) return;
      const ext = type === 'video' ? 'webm' : 'weba';
      const filename = specificFilename || `${type}_${Date.now()}.${ext}`;
      setRecordingTarget({ start, end, filename }); 
      setRecorderMode(type);
      playerRef.current.seekTo(start, 'seconds');
      setIsPlaying(true);
      setTimeout(() => { handleStartRecording(type); }, 500); 
  };

  // --- Keyboard Shortcuts Effect ---
  useEffect(() => {
    if (!ankiConfig.keyboardShortcutsEnabled) {
      return; // If shortcuts are disabled, don't register listeners
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default browser actions for common keys if we handle them
      const isHandledKey = [' ', 'ArrowLeft', 'ArrowRight', 'd', 't', 'q', 'm', 'f', 'a', 'b', 'c', 'o'].includes(e.key.toLowerCase());
      if (isHandledKey && e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
          // Allow default behavior for input fields
          return;
      }

      if (isHandledKey) {
        e.preventDefault();
        e.stopPropagation(); // Stop event propagation to prevent multiple triggers
      }

      switch (e.key.toLowerCase()) {
        case ' ': // Play/Pause
          togglePlay();
          break;
        case 'arrowleft': // Previous Subtitle
          jumpToSubtitle(-1);
          break;
        case 'arrowright': // Next Subtitle
          jumpToSubtitle(1);
          break;
        case 'd': // Toggle Dictionary
          if (isFullscreen) {
            setActiveFullscreenPanel(prev => prev === 'dictionary' ? 'none' : 'dictionary');
          } else {
            setDictOpen(prev => !prev);
          }
          break;
        case 't': // Toggle Transcript
          toggleTranscript();
          break;
        case 'q': // Quick Anki Card
          handleQuickCard();
          break;
        case 'm': // Toggle Mask
          setShowMask(prev => !prev);
          break;
        case 'f': // Toggle Fullscreen
          toggleFullscreen();
          break;
        case 'a': // Set AB Loop A
          if (ankiConfig.abButtonMode === 'loop') {
            const currentTime = playerRef.current?.getCurrentTime() || 0;
            if (abLoopState === 'none') {
              setLoopA(currentTime);
              setAbLoopState('a-set');
              showToast(t.pointASet, 'info');
            } else if (abLoopState === 'looping') { // If already looping, clear it
              setAbLoopState('none');
              setLoopA(0);
              setLoopB(0);
              showToast(t.loopCleared, 'info');
            }
          }
          break;
        case 'b': // Set AB Loop B / Record Stop
          if (ankiConfig.abButtonMode === 'loop') {
            const currentTime = playerRef.current?.getCurrentTime() || 0;
            if (abLoopState === 'a-set' && currentTime > loopA) {
              setLoopB(currentTime);
              setAbLoopState('looping');
              showToast(t.loopingAB, 'info');
              playerRef.current?.seekTo(loopA, 'seconds');
            } else if (abLoopState === 'looping') { // If already looping, clear it
              setAbLoopState('none');
              setLoopA(0);
              setLoopB(0);
              showToast(t.loopCleared, 'info');
            } else {
              showToast(t.pointBError, 'error');
              setAbLoopState('none');
            }
          } else if (ankiConfig.abButtonMode === 'record') {
            if (isRecordingRef.current) {
              handleStopRecording();
            } else {
              handleStartRecording();
            }
          }
          break;
        case 'c': // Clear AB Loop (if in loop mode)
          if (abLoopState !== 'none') {
            setAbLoopState('none');
            setLoopA(0);
            setLoopB(0);
            showToast(t.loopCleared, 'info');
          }
          break;
        case 'o': // Perform OCR
          if (ankiConfig.ocrEnabled) {
            handleOcrClick();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    ankiConfig.keyboardShortcutsEnabled,
    isPlaying, togglePlay,
    abLoopState, loopA, loopB,
    handleStartRecording, handleStopRecording,
    ankiConfig.abButtonMode,
    isFullscreen, setDictOpen, setActiveFullscreenPanel, toggleTranscript,
    setShowMask, toggleFullscreen,
    handleQuickCard, handleOcrClick, ankiConfig.ocrEnabled,
    jumpToSubtitle, isRecordingRef, showToast, t
  ]);

  return (
    <div className={`fixed inset-0 h-[100dvh] w-[100vw] flex flex-col font-sans ${viewMode === 'player' ? 'bg-black' : ''}`}>
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

      <Header 
        viewMode={viewMode} onBackToLibrary={handleBackToLibrary} activeVideoItem={activeVideoItem} ankiConfig={ankiConfig}
        ocrMode={ocrMode} onToggleOcrMode={toggleOcrMode} capturedClips={capturedClips} showClipsList={showClipsList}
        onToggleClipsList={() => setShowClipsList(!showClipsList)} onCloseClipsList={() => setShowClipsList(false)}
        onPlayClip={setPlaybackClip} onDeleteClip={handleDeleteClip} mediaType={mediaType} setMediaType={setMediaType}
        onOpenSettings={() => setShowSettings(true)} isFullscreen={isFullscreen} lang={lang}
      />

      <SettingsSidebar 
        isOpen={showSettings} onClose={() => setShowSettings(false)} lang={lang} setLang={setLang}
        learningLang={learningLang} setLearningLang={setLearningLang} ankiConfig={ankiConfig} setAnkiConfig={setAnkiConfig}
        ankiConnected={ankiConnected} onConnectCheck={handleAnkiConnect} onExportData={handleExportData}
        onImportData={handleImportData} onClearCache={handleClearCache} importInputRef={importInputRef}
      />
      
      {playbackClip && (
          <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center backdrop-blur-sm p-4">
              <div className="bg-[#1e293b] rounded-xl overflow-hidden max-w-4xl w-full shadow-2xl border border-white/10">
                  <div className="flex justify-between items-center p-3 border-b border-white/10 bg-[#0f172a]">
                      <h3 className="text-white font-bold">{playbackClip.title}</h3>
                      <button onClick={() => setPlaybackClip(null)}><X className="text-white"/></button>
                  </div>
                  <div className="aspect-video bg-black flex items-center justify-center">
                      <video src={playbackClip.src} controls autoPlay className="max-w-full max-h-[70vh]" />
                  </div>
              </div>
          </div>
      )}

      <main className="flex-1 overflow-hidden relative">
        {viewMode === 'library' ? (
            <div className="h-full overflow-y-auto w-full flex flex-col items-center">
                <VideoLibrary 
                    items={libraryItems} lang={lang} onSelectSample={handleSampleSelect} onImportLocalFile={handleImportLocalFile} 
                    onAddNetworkVideo={handleAddNetworkVideo} onDeleteVideo={handleDeleteVideo} onImportSubtitleAndPlay={handleImportSubtitleAndPlay}
                    onUpdateLocalVideo={handleUpdateLocalVideo}
                />
            </div>
        ) : (
            <div ref={playerContainerRef} className={mainContainerClasses}>
                <div className={playerWrapperClasses} onMouseMove={handlePlayerMouseMove} onClick={handlePlayerMouseMove} onTouchStart={handlePlayerMouseMove}>
                    {isBuffering && (
                        <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
                            <Loader2 className="w-12 h-12 text-white animate-spin opacity-50" />
                        </div>
                    )}
                    {isRecordingRef.current && (
                         <div className={`absolute top-12 left-1/2 -translate-x-1/2 z-50 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-2 ${recorderModeRef.current === 'audio' ? 'bg-pink-500/80' : 'bg-red-500/80'}`}>
                             <span className="w-2 h-2 bg-white rounded-full"></span>
                             {recorderModeRef.current === 'audio' ? 'REC AUDIO' : 'REC VIDEO'}
                         </div>
                    )}
                    <div ref={videoWrapperRef} className={`relative bg-black overflow-hidden flex items-center justify-center group/video transition-all duration-300 w-full h-full`} style={{ isolation: 'isolate' }}>
                        <div className={`absolute top-0 left-0 right-0 z-50 p-2 bg-gradient-to-t from-black/20 to-transparent transition-opacity duration-300 flex justify-between items-start pointer-events-none ${isControlsVisible ? 'opacity-100' : 'opacity-0'}`}>
                            <div className="flex items-center gap-4 pointer-events-auto ml-2">
                                <button onClick={toggleLock} className={`p-2 rounded-full transition-all duration-300 ${controlsLock === 'visible' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white'}`}>
                                    {controlsLock ? <Lock size={20} /> : <Unlock size={20} />}
                                </button>
                                {abLoopState !== 'none' && <span className="text-primary text-xs font-bold font-mono mt-1">Loop: {formatTime(loopA)} - {abLoopState === 'looping' ? formatTime(loopB) : '...'}</span>}
                            </div>
                            <div className="pointer-events-auto flex gap-2">
                                {ankiConfig.ocrEnabled && (
                                    <button onClick={handleOcrClick} className={`bg-white/10 hover:bg-white/20 p-2.5 rounded-full backdrop-blur-sm transition-all ${ocrMode === 'dictionary' ? 'text-amber-400' : 'text-white'}`}>
                                        {ocrMode === 'dictionary' ? <Zap size={20} className="fill-current"/> : <ScanText size={20} />}
                                    </button>
                                )}
                                <button onClick={handleScreenshotClick} className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full backdrop-blur-sm transition-all"><Camera size={20} /></button>
                                <button onClick={handleOpenAddBookmarkModal} className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full backdrop-blur-sm transition-all"><BookmarkPlus size={20} /></button>
                                <div className="relative">
                                    <button onClick={() => setShowBookmarkList(!showBookmarkList)} className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full backdrop-blur-sm transition-all"><Book size={20} /></button>
                                    {showBookmarkList && (
                                        <div className="absolute top-full right-0 mt-2 bg-[#1e293b] rounded-xl shadow-2xl border border-white/10 w-72 p-2 z-[60] animate-in fade-in zoom-in-95 max-h-[60vh] flex flex-col">
                                            <h4 className="text-xs font-bold text-white mb-2 px-2 uppercase sticky top-0 bg-[#1e293b] z-10 py-1">{t.bookmarks}</h4>
                                            <div className="overflow-y-auto space-y-1 flex-1 pr-1 custom-scrollbar">
                                                {(!activeVideoItem?.bookmarks || activeVideoItem.bookmarks.length === 0) ? (
                                                    <p className="text-xs text-slate-500 px-2 py-2 text-center">{t.noBookmarks}</p>
                                                ) : (
                                                    [...activeVideoItem.bookmarks].sort((a,b) => a.time - b.time).map(bm => (
                                                        <div key={bm.id} className="p-2 hover:bg-white/10 rounded group border border-transparent hover:border-white/5 transition-all">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <button onClick={() => handleJumpToBookmark(bm.time, bm.end)} className="text-xs text-slate-200 hover:text-primary text-left flex-1 truncate font-semibold flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: bm.color || '#6366f1' }}></div>
                                                                    <span className="font-mono text-primary mr-2 opacity-80 flex-shrink-0">
                                                                        {formatTime(bm.time)}{bm.end && ` - ${formatTime(bm.end)}`}
                                                                    </span>
                                                                    <span className="truncate">{bm.text}</span>
                                                                </button>
                                                                <div className="flex items-center gap-1">
                                                                    <button onClick={() => handleOpenEditBookmarkModal(bm)} className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10"><Edit2 size={12} /></button>
                                                                    <button onClick={() => handleDeleteBookmark(bm.id)} className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-red-500/10"><Trash2 size={12} /></button>
                                                                </div>
                                                            </div>
                                                            {bm.note && <p className="text-[10px] text-slate-500 line-clamp-2 pl-4 border-l-2 border-white/10 ml-1">{bm.note}</p>}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => { setSelectedWord(''); isFullscreen ? setActiveFullscreenPanel('dictionary') : setDictOpen(true); }} className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full backdrop-blur-sm transition-all"><BookA size={20} /></button>
                                <button onClick={() => setShowMask(!showMask)} className={`bg-white/10 hover:bg-white/20 p-2.5 rounded-full backdrop-blur-sm transition-all ${showMask ? 'text-primary' : 'text-white'}`}><EyeOff size={20} /></button>
                                <button onClick={handleQuickCard} className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full backdrop-blur-sm transition-all"><PlusSquare size={20} /></button>
                            </div>
                        </div>
                        <div className={`w-full h-full flex items-center justify-center ${mediaType === 'audio' ? 'hidden' : 'block'}`}>
                            <Player 
                                key={`${activeVideoItem?.id}-${isM3U8}`}
                                ref={playerRef} url={activeVideoItem?.src} width="100%" height="100%" playing={isPlaying} 
                                controls={false} onProgress={handleProgress} onDuration={handleDuration} onEnded={() => setIsPlaying(false)} 
                                onBuffer={() => setIsBuffering(true)} onBufferEnd={() => setIsBuffering(false)} progressInterval={100} 
                                onReady={() => {
                                    if (!onReadyRef.current) {
                                      if (!activeVideoItem?.isLive) {
                                          const saved = localStorage.getItem(`vam_progress_${activeVideoItem?.id}`);
                                          if (saved) {
                                            const time = parseFloat(saved);
                                            setTimeout(() => { if (playerRef.current && !seekLockRef.current) { playerRef.current.seekTo(time, 'seconds'); setPlayedSeconds(time); } }, 300);
                                          }
                                      } else { setPlayedSeconds(0); }
                                      onReadyRef.current = true;
                                      const pollForDimensions = (retries = 20) => { 
                                          if (retries <= 0) return;
                                          const videoEl = playerRef.current?.getInternalPlayer();
                                          if (videoEl && videoEl.videoWidth > 0) { calculateGeometry(); } 
                                          else { setTimeout(() => pollForDimensions(retries - 1), 100); }
                                      };
                                      pollForDimensions();
                                    }
                                }}
                                config={{ file: { forceHLS: isM3U8, attributes: { crossOrigin: 'anonymous', playsInline: true, referrerPolicy: 'no-referrer' }, hlsOptions: { enableWorker: false, startLevel: -1 } } }}
                                onError={handlePlayerError} style={{ pointerEvents: 'none' }} 
                            />
                            <div className="absolute inset-0 z-10" onClick={togglePlay}></div>
                        </div>
                        {mediaType === 'audio' && (
                            <div className="flex flex-col items-center gap-6 animate-fade-in z-0 w-full h-full justify-center bg-slate-900">
                                <div className="relative w-48 h-48 md:w-64 md:h-64 rounded-xl shadow-2xl overflow-hidden border border-white/10">
                                    {activeVideoItem?.thumbnail ? <img src={activeVideoItem.thumbnail} className="w-full h-full object-cover" alt="Cover" /> : <div className="w-full h-full flex items-center justify-center bg-slate-800"><FileAudio size={64} className="text-slate-400" /></div>}
                                </div>
                                <h3 className="text-2xl font-light text-slate-300 max-w-md text-center">{activeVideoItem?.title}</h3>
                            </div>
                        )}
                        {!isPlaying && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-2xl">
                                    <Play className="text-white fill-white ml-2" size={40} />
                                </div>
                            </div>
                        )}
                        {subtitleVisible && isSubtitleActive && (
                            <div className={`absolute left-4 right-4 text-center pointer-events-auto transition-all duration-300 z-40 flex justify-center`} style={subtitleBottomStyle}>
                                {renderCurrentSubtitles()}
                            </div>
                        )}
                    </div>
                    {showMask && <div className="absolute backdrop-blur-xl bg-white/5 border-y border-white/10 z-20 flex group/mask" style={maskStyle}><div className="flex-1 cursor-ns-resize" onMouseDown={(e) => handleMaskMouseDown(e, 'move')} onTouchStart={(e) => handleMaskMouseDown(e, 'move')} /><div className="w-24 cursor-row-resize hover:bg-white/5 transition-colors border-x border-white/5" onMouseDown={(e) => handleMaskMouseDown(e, 'resize')} onTouchStart={(e) => handleMaskMouseDown(e, 'resize')} /><div className="flex-1 cursor-ns-resize" onMouseDown={(e) => handleMaskMouseDown(e, 'move')} onTouchStart={(e) => handleMaskMouseDown(e, 'move')} /></div>}
                    <PlayerControls 
                        isControlsVisible={isControlsVisible} isLiveStream={isLiveStream} playedSeconds={playedSeconds} duration={duration} onSeekMouseDown={handleSeekMouseDown} onSeekChange={handleSeekChange} onSeekMouseUp={handleSeekMouseUp}
                        isPlaying={isPlaying} onTogglePlay={togglePlay} onJumpSubtitle={jumpToSubtitle} abLoopState={abLoopState} abButtonMode={ankiConfig.abButtonMode || 'loop'} onABLoopClick={handleABLoopClick} showSubSettings={showSubSettings} setShowSubSettings={setShowSubSettings}
                        subtitleOffset={subtitleOffset} setSubtitleOffset={setSubtitleOffset} subtitleMode={subtitleMode} onCycleSubtitleMode={cycleSubtitleMode} subtitleVisible={subtitleVisible} setSubtitleVisible={setSubtitleVisible} activeFullscreenPanel={activeFullscreenPanel}
                        showTranscript={showTranscript} onToggleTranscript={toggleTranscript} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} lang={lang}
                    />
                    {isAnkiModalOpen && <AnkiEditModal 
                        isOpen={isAnkiModalOpen} onClose={() => setIsAnkiModalOpen(false)} onConfirm={handleConfirmAddNote} initialData={pendingNote} lang={lang} learningLang={learningLang} currentPlayerTime={playedSeconds} duration={duration} subtitles={subtitles}
                        onRetakeImage={handleRetakeImage} onSeek={handleSeekTo} onPlayAudioRange={handlePreviewAudio} isOcclusionMode={ankiModalMode === 'occlusion'}
                    />}
                    <BookmarkModal 
                        isOpen={bookmarkModalState.isOpen} onClose={() => setBookmarkModalState(prev => ({...prev, isOpen: false}))} onConfirm={handleSaveBookmark} onRecordVideo={(start, end) => handleTriggerRecording('video', start, end)} onRecordAudio={(start, end) => handleTriggerRecording('audio', start, end)}
                        initialTitle={bookmarkModalState.defaultTitle} initialNote={bookmarkModalState.defaultNote} initialTime={bookmarkModalState.time || 0} initialEnd={bookmarkModalState.end} initialColor={bookmarkModalState.color} isEditing={bookmarkModalState.mode === 'edit'} lang={lang} duration={duration}
                    />
                    {ocrResult !== null && (
                        <OCRModal ocrResult={ocrResult} onClose={() => setOcrResult(null)} onRetake={handleOcrRetake} isProcessing={isOcrProcessing} onExecute={executeOcr} editMode={ocrEditMode} setEditMode={setOcrEditMode}
                            bounds={ocrBounds} setBounds={setOcrBounds} imageRef={ocrImageRef} wrapperRef={ocrWrapperRef} renderTextContent={renderLine} lang={lang} ocrLang={ankiConfig.ocrLang || 'eng'}
                        />
                    )}
                    {isFullscreen && (
                        <>
                            <DictionaryPanel 
                                word={selectedWord} sentence={selectedSentence} onAddToAnki={(term, def, sentence, scriptHtmlDef) => addToAnki(term, def, sentence, undefined, undefined, true, false, undefined, scriptHtmlDef)} isAddingToAnki={isAddingToAnki} 
                                isOpen={activeFullscreenPanel === 'dictionary'} onClose={handleDictClose} variant="sidebar" 
                                learningLanguage={learningLang} onAppendNext={handleAppendWord} canAppend={nextSegmentIndex < currentSegments.length}
                                lang={lang} searchEngine={ankiConfig.searchEngine}
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
            <DictionaryPanel 
                word={selectedWord} sentence={selectedSentence} onAddToAnki={(term, def, sentence, scriptHtmlDef) => addToAnki(term, def, sentence, undefined, undefined, true, false, undefined, scriptHtmlDef)} isAddingToAnki={isAddingToAnki} 
                isOpen={dictOpen} onClose={handleDictClose} variant={isWideScreen ? "sidebar" : "bottom-sheet"} 
                learningLanguage={learningLang} onAppendNext={handleAppendWord} canAppend={nextSegmentIndex < currentSegments.length} 
                lang={lang} searchEngine={ankiConfig.searchEngine} 
            />
            <TranscriptPanel 
                isOpen={showTranscript} onClose={() => setShowTranscript(false)} subtitles={subtitles} 
                currentSubtitleIndex={currentSubtitleIndex} onSeek={handleSeekTo} subtitleOffset={subtitleOffset} 
                variant={isWideScreen ? "sidebar" : "bottom-sheet"} lang={lang} 
            />
        </>
      )}
    </div>
  );
};
export default App;