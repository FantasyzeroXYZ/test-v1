

export interface Subtitle {
  id: number;
  start: number;
  end: number;
  text: string;
}

export type MediaType = 'video' | 'audio';

export interface Bookmark {
  id: string;
  time: number;
  end?: number; // End time for range-based bookmarks
  text: string;
  note?: string;
  color?: string; // Hex color code for categorization
}

export interface CapturedClip {
  id: string;
  type: MediaType;
  src: string; // Blob URL
  title: string;
  timestamp: number;
  duration: number;
  blob: Blob;
  videoId?: string;
}

export type ABLoopMode = 'loop' | 'record-video' | 'record-audio';
export type ABButtonMode = 'loop' | 'record';

export interface AnkiConfig {
  ip: string;
  port: string;
  deck: string;
  model: string;
  tags: string[];
  fields: {
    word: string;
    sentence: string;
    definition: string;
    translation: string;
    audio: string;
    image: string;
    video?: string; // New video field
  };
  imageOcclusion: {
      deck: string;
      model: string;
      tags: string[];
      fields: {
          image: string;
          mask: string;
          header: string;
          backExtra: string;
          remarks: string;
          audio: string;
          id?: string;
      };
  };
  subtitleSize: number;
  subtitleBottomMargin: number;
  subtitleDisplayMode: 'interactive' | 'selectable';
  searchEngine: string;
  abButtonMode?: ABButtonMode; // 'loop' (3 clicks) or 'record' (2 clicks)
  ocrLang?: string; // Default OCR Language
  ocrEnabled?: boolean; // Default OCR Enabled status
  keyboardShortcutsEnabled?: boolean; // Enable/Disable keyboard shortcuts
  customKeybindings?: Record<string, string>; // Custom keybindings map: action -> keycode
}

export interface AnkiNoteData {
  word?: string;
  sentence?: string;
  definition?: string;
  translation?: string;
  remarks?: string;
  audioStart?: number;
  audioEnd?: number;
  imageData?: string | null;
  includeAudio?: boolean; // For explicit audio inclusion
  includeVideo?: boolean; // For explicit video inclusion
  occlusionMasks?: { x: number; y: number; w: number; h: number }[];
}

export interface VideoLibraryItem {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  src: string;
  type: MediaType;
  file?: File; // For local files
  bookmarks?: Bookmark[];
  isLive?: boolean;
  isLocal?: boolean;
  hasPrimarySubtitle?: boolean;
  hasSecondarySubtitle?: boolean;
  maskConfig?: {
      top: number;
      height: number;
  };
  source?: string;
  filename?: string;
}

export interface DictionaryEntry {
  language: string;
  partOfSpeech: string;
  phonetic?: string;
  pronunciations?: { text: string; audio?: string }[];
  senses?: {
    definition: string;
    examples?: string[];
    synonyms?: string[];
    antonyms?: string[];
  }[];
}

export interface DictionaryResponse {
  word: string;
  entries: DictionaryEntry[];
}

export type UILanguage = 'en' | 'zh';
export type LearningLanguage = 'en' | 'zh' | 'ja' | 'ru' | 'fr' | 'es';

export type SubtitleMode = 'primary' | 'secondary' | 'both';

export interface AnkiConnectResponse<T> {
  result: T;
  error: string | null;
}

export interface KeyboardShortcut {
  action: string; // Unique identifier for the action
  defaultKey: string; // Default key code (e.g., 'Space', 'ArrowLeft')
  description: string; // i18n key for description
}