
import { AnkiConnectResponse } from '../types';

let ANKI_BASE_URL = 'http://127.0.0.1:8765';

export const setAnkiAddress = (ip: string, port: string) => {
  const cleanIp = ip.trim() || '127.0.0.1';
  const cleanPort = port.trim() || '8765';
  ANKI_BASE_URL = `http://${cleanIp}:${cleanPort}`;
};

const invoke = async <T>(action: string, params: object = {}): Promise<T> => {
  try {
    const response = await fetch(ANKI_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, version: 6, params }),
    });
    if (!response.ok) throw new Error('Network response was not ok');
    const data: AnkiConnectResponse<T> = await response.json();
    if (data.error) throw new Error(data.error);
    return data.result;
  } catch (error) {
    console.error(`AnkiConnect Error (${action}):`, error);
    throw error;
  }
};

export const ankiService = {
  checkConnection: async (): Promise<boolean> => {
    try {
      await invoke('version');
      return true;
    } catch {
      return false;
    }
  },
  getDeckNames: async () => invoke<string[]>('deckNames'),
  getModelNames: async () => invoke<string[]>('modelNames'),
  getModelFields: async (modelName: string) => invoke<string[]>('modelFieldNames', { modelName }),
  
  addNote: async (note: any) => invoke<number>('addNote', { note }),
  
  storeMediaFile: async (filename: string, data: string) => 
    invoke<string>('storeMediaFile', { filename, data }), 
};
