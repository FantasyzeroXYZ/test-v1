import React from 'react';
import { Subtitle } from './types';

export const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !Number.isFinite(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const parseSRT = (content: string): Subtitle[] => {
  const blocks = content.trim().split(/\n\s*\n/);
  return blocks.map((block, index) => {
    const lines = block.split('\n');
    if (lines.length < 3) return null;

    let timeLineIndex = 1;
    if (!lines[0].match(/^\d+$/) && lines[0].includes('-->')) {
        timeLineIndex = 0;
    }

    const timeLine = lines[timeLineIndex];
    const timeMatch = timeLine.match(/(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/);

    if (!timeMatch) return null;

    const parseTime = (h: string, m: string, s: string, ms: string) => 
      parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;

    const start = parseTime(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
    const end = parseTime(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);
    
    const text = lines.slice(timeLineIndex + 1)
      .join(' ')
      .replace(/<[^>]*>/g, '')
      .trim();

    return { id: index, start, end, text };
  }).filter((s): s is Subtitle => s !== null);
};

export const parseVTT = (content: string): Subtitle[] => {
  const lines = content.split('\n');
  const subtitles: Subtitle[] = [];
  let currentStart = 0;
  let currentEnd = 0;
  let currentText = '';
  let idCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('-->')) {
        if (currentText) {
            subtitles.push({ id: idCounter++, start: currentStart, end: currentEnd, text: currentText.trim() });
            currentText = '';
        }

        const timeMatch = line.match(/(\d+):(\d+):(\d+)[.,](\d+)\s*-->\s*(\d+):(\d+):(\d+)[.,](\d+)/);
        if (timeMatch) {
            const parseTime = (h: string, m: string, s: string, ms: string) => 
              parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
            currentStart = parseTime(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
            currentEnd = parseTime(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);
        }
    } else if (line && !line.includes('WEBVTT') && !line.match(/^\d+$/)) {
        currentText += ' ' + line;
    } else if (line === '') {
        if (currentText) {
             subtitles.push({ id: idCounter++, start: currentStart, end: currentEnd, text: currentText.trim() });
             currentText = '';
        }
    }
  }
  if (currentText) {
    subtitles.push({ id: idCounter++, start: currentStart, end: currentEnd, text: currentText.trim() });
  }

  return subtitles;
};

export const parseASS = (content: string): Subtitle[] => {
  const lines = content.split(/\r?\n/);
  const subtitles: Subtitle[] = [];
  let eventsSection = false;
  let formatMap: Record<string, number> = {};

  for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '[Events]') {
          eventsSection = true;
          continue;
      }
      if (!eventsSection) continue;

      if (trimmed.startsWith('Format:')) {
          const keys = trimmed.substring(7).split(',').map(k => k.trim().toLowerCase());
          keys.forEach((k, i) => formatMap[k] = i);
      } else if (trimmed.startsWith('Dialogue:')) {
          if (Object.keys(formatMap).length === 0) continue;
          
          // "Dialogue: " length is usually 10, but handle potential spacing
          const rawLine = trimmed.substring(trimmed.indexOf(':') + 1).trim();
          
          const parts = rawLine.split(',');
          // We need at least enough parts to cover the format up to Text
          // Note: Text is the last field and can contain commas, so we handle it specially
          const columns = Object.keys(formatMap).length;
          
          if (parts.length < columns) continue;

          const startIdx = formatMap['start'];
          const endIdx = formatMap['end'];
          const textIdx = formatMap['text'];

          if (startIdx === undefined || endIdx === undefined || textIdx === undefined) continue;

          const parseTime = (str: string) => {
              const [h, m, s] = str.split(':');
              return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
          };

          const start = parseTime(parts[startIdx]);
          const end = parseTime(parts[endIdx]);
          
          // Rejoin text in case it had commas
          let text = parts.slice(textIdx).join(',');
          
          // Clean ASS tags
          text = text.replace(/{[^}]+}/g, ''); // Remove styles like {\an8}
          text = text.replace(/\\N/g, '\n').replace(/\\n/g, '\n').replace(/\\h/g, ' ');

          if (text.trim()) {
              subtitles.push({
                  id: subtitles.length,
                  start, 
                  end, 
                  text: text.trim()
              });
          }
      }
  }
  return subtitles;
};

export const generateVideoThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = URL.createObjectURL(file);
        video.muted = true;
        video.currentTime = 1; 
        
        video.onloadeddata = () => {
            if(video.readyState >= 2) {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
                URL.revokeObjectURL(video.src);
            }
        };
        // fallback
        video.onerror = () => resolve('');
        setTimeout(() => resolve(''), 3000);
    });
};

export const captureVideoFrame = (videoElement: HTMLVideoElement | null): string | null => {
    if (!videoElement) {
        console.warn("Capture failed: No video element provided.");
        return null;
    }
    
    // Ensure video has dimensions and data
    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0 || videoElement.readyState < 2) {
        console.warn("Capture failed: Video not ready or has 0 dimensions.");
        return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    try {
        // Attempt to draw the video frame
        // NOTE: This will fail with SecurityError if the video is cross-origin and lacks CORS headers
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        
        // Returns Base64 string without data:image/jpeg;base64, prefix for AnkiConnect
        // If this line throws, it's a Tainted Canvas issue
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        
        if (!dataUrl || dataUrl === 'data:,') {
            console.warn("Capture produced empty data.");
            return null; 
        }
        
        return dataUrl.split(',')[1];
    } catch (e: any) {
        console.error("Capture frame failed. Likely a CORS/Security restriction on this video source.", e);
        // We cannot bubble the error easily here without breaking types, but returning null indicates failure.
        return null;
    }
};

export const extractAudioClip = async (file: File, start: number, end: number): Promise<string | null> => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const sampleRate = audioBuffer.sampleRate;
        const startFrame = Math.max(0, Math.floor(start * sampleRate));
        const endFrame = Math.min(audioBuffer.length, Math.floor(end * sampleRate));
        const frameCount = endFrame - startFrame;
        
        if (frameCount <= 0) return null;

        const extractedBuffer = audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            frameCount,
            sampleRate
        );

        for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            const channelData = audioBuffer.getChannelData(i);
            const extractedData = extractedBuffer.getChannelData(i);
            extractedData.set(channelData.slice(startFrame, endFrame));
        }

        // Convert to WAV (simple implementation)
        return bufferToWav(extractedBuffer);
    } catch (e) {
        console.error("Audio extraction failed", e);
        return null;
    }
};

export const recordAudioFromPlayer = async (player: any, start: number, end: number): Promise<{base64: string, extension: string} | null> => {
    return null; 
};

// Helper to convert AudioBuffer to WAV Base64
const bufferToWav = (buffer: AudioBuffer): string => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels = [];
    let i;
    let sample;
    let offset = 0;
    let pos = 0;

    // write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this example)

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // write interleaved data
    for (i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    while (pos < buffer.length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][pos]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(44 + offset, sample, true);
            offset += 2;
        }
        pos++;
    }

    let binary = '';
    const bytes = new Uint8Array(bufferArr);
    const len = bytes.byteLength;
    for (i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);

    function setUint16(data: number) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data: number) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
};

export const getEventY = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): number => {
    if ('touches' in e) {
        return e.touches[0].clientY;
    }
    return (e as React.MouseEvent | MouseEvent).clientY;
};

export const getSupportedMimeType = (type: 'video' | 'audio') => {
    // Prefer webm/opus for broad compatibility
    const audioTypes = [
        'audio/webm;codecs=opus', 
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4' // Safari support
    ];
    
    const videoTypes = [
        'video/webm;codecs=vp9', 
        'video/webm;codecs=vp8', 
        'video/webm', 
        'video/mp4'
    ];

    const types = type === 'video' ? videoTypes : audioTypes;
    return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
};

export const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64 = base64String.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};