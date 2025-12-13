

import { VideoLibraryItem, CapturedClip } from '../types';

const DB_NAME = 'VAMPlayerDB';
const DB_VERSION = 2; // Upgraded to support clips
const STORE_METADATA = 'metadata';
const STORE_FILES = 'files';
const STORE_CLIPS = 'clips';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_METADATA)) {
        db.createObjectStore(STORE_METADATA, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES);
      }
      if (!db.objectStoreNames.contains(STORE_CLIPS)) {
        db.createObjectStore(STORE_CLIPS, { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const initDB = async () => {
  await openDB();
};

export const saveVideo = async (item: VideoLibraryItem, file?: File | Blob) => {
  const db = await openDB();
  const tx = db.transaction([STORE_METADATA, STORE_FILES], 'readwrite');
  
  // Clone to avoid mutating original
  const meta = { ...item };
  if (meta.isLocal) {
      delete meta.file; // Metadata shouldn't hold the blob for performance
      // Clear blob URL as it is session-specific and invalid after reload
      if (meta.src && meta.src.startsWith('blob:')) {
          meta.src = '';
      }
  }

  tx.objectStore(STORE_METADATA).put(meta);

  if (file && item.isLocal) {
    tx.objectStore(STORE_FILES).put(file, item.id);
  }

  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getLibrary = async (): Promise<VideoLibraryItem[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_METADATA, 'readonly');
    const store = tx.objectStore(STORE_METADATA);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const getVideoFile = async (id: string): Promise<Blob | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, 'readonly');
    const store = tx.objectStore(STORE_FILES);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

export const deleteVideo = async (id: string) => {
  const db = await openDB();
  const tx = db.transaction([STORE_METADATA, STORE_FILES], 'readwrite');
  tx.objectStore(STORE_METADATA).delete(id);
  tx.objectStore(STORE_FILES).delete(id);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// --- Clips Management ---

export const saveClip = async (clip: CapturedClip) => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_CLIPS, 'readwrite');
    const store = tx.objectStore(STORE_CLIPS);
    // Note: IndexedDB can store Blobs directly in objects
    const request = store.put(clip);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getClips = async (videoId?: string): Promise<CapturedClip[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CLIPS, 'readonly');
    const store = tx.objectStore(STORE_CLIPS);
    const request = store.getAll();
    request.onsuccess = () => {
        const clips = request.result || [];
        if (videoId) {
            // Filter clips by videoId if provided
            resolve(clips.filter((c: CapturedClip) => c.videoId === videoId));
        } else {
            resolve(clips);
        }
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteClip = async (id: string) => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_CLIPS, 'readwrite');
    const store = tx.objectStore(STORE_CLIPS);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// --- Export / Import / Clear Utils ---

export const exportAllData = async () => {
  // 1. Get Library Metadata
  const library = await getLibrary();
  
  // 2. Get LocalStorage Data (Settings)
  const settings: Record<string, string | null> = {
      vam_anki_config: localStorage.getItem('vam_anki_config'),
      vam_ui_lang: localStorage.getItem('vam_ui_lang'),
      vam_learning_lang: localStorage.getItem('vam_learning_lang'),
  };

  // Add progress and subtitles keys
  for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('vam_progress_') || key.startsWith('vam_sub_'))) {
          settings[key] = localStorage.getItem(key);
      }
  }

  // NOTE: We generally do NOT export large video files or clips to JSON 
  // to prevent browser crash. Export metadata only.

  return {
      version: 1,
      date: new Date().toISOString(),
      library, // Contains metadata including bookmarks
      settings
  };
};

export const importAllData = async (jsonData: string) => {
  try {
      const data = JSON.parse(jsonData);
      
      // 1. Restore Settings
      if (data.settings) {
          Object.keys(data.settings).forEach(key => {
              const val = data.settings[key];
              if (val !== null) localStorage.setItem(key, val);
          });
      }

      // 2. Restore Library Metadata
      if (data.library && Array.isArray(data.library)) {
          const db = await openDB();
          const tx = db.transaction([STORE_METADATA], 'readwrite');
          const store = tx.objectStore(STORE_METADATA);
          
          await Promise.all(data.library.map((item: VideoLibraryItem) => {
              return new Promise<void>((resolve, reject) => {
                  const req = store.put(item);
                  req.onsuccess = () => resolve();
                  req.onerror = () => reject(req.error);
              });
          }));
          
          await new Promise<void>((resolve) => {
              tx.oncomplete = () => resolve();
          });
      }
      return true;
  } catch (e) {
      console.error("Import failed", e);
      throw e;
  }
};

export const clearAllData = async () => {
  // Clear IndexedDB
  const req = indexedDB.deleteDatabase(DB_NAME);
  await new Promise<void>((resolve, reject) => {
      req.onsuccess = () => resolve();
      req.onerror = () => reject();
      req.onblocked = () => resolve(); // Attempted
  });
  
  // Clear LocalStorage
  localStorage.clear();
};