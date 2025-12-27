

import React, { useState, useEffect } from 'react';
import { AnkiConfig, UILanguage, LearningLanguage, ABButtonMode, KeyboardShortcut } from '../types';
import { getTranslation } from '../i18n';
import AnkiWidget from './AnkiWidget';
import { DEFAULT_KEY_BINDINGS } from '../App';
import { Settings as SettingsIcon, X, Sliders, ChevronDown, Type, MousePointerClick, TextCursor, Database, Download, Upload, Trash2, Keyboard, Edit2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: UILanguage;
  setLang: (l: UILanguage) => void;
  learningLang: LearningLanguage;
  setLearningLang: (l: LearningLanguage) => void;
  ankiConfig: AnkiConfig;
  setAnkiConfig: (c: AnkiConfig) => void;
  ankiConnected: boolean;
  onConnectCheck: () => Promise<boolean>;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearCache: () => void;
  importInputRef: React.RefObject<HTMLInputElement>;
}

const SettingsSidebar: React.FC<Props> = ({
  isOpen, onClose, lang, setLang, learningLang, setLearningLang,
  ankiConfig, setAnkiConfig, ankiConnected, onConnectCheck,
  onExportData, onImportData, onClearCache, importInputRef
}) => {
  const t = getTranslation(lang);
  const [recordingKey, setRecordingKey] = useState<string | null>(null);

  // Handle key recording
  useEffect(() => {
    if (!recordingKey) return;

    const handleRecord = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore modifiers if pressed alone (optional, but good UX)
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

      const newBindings = { ...ankiConfig.keyBindings };
      newBindings[recordingKey] = e.code; // Use code for layout independence, or key for char
      
      setAnkiConfig({ ...ankiConfig, keyBindings: newBindings });
      setRecordingKey(null);
    };

    window.addEventListener('keydown', handleRecord);
    return () => window.removeEventListener('keydown', handleRecord);
  }, [recordingKey, ankiConfig, setAnkiConfig]);

  const currentBindings = ankiConfig.keyBindings || DEFAULT_KEY_BINDINGS;

  const resetBindings = () => {
    if(confirm("Reset all shortcuts to default?")) {
        setAnkiConfig({ ...ankiConfig, keyBindings: { ...DEFAULT_KEY_BINDINGS } });
    }
  };

  const ShortcutRow = ({ action, label }: { action: string, label: string }) => (
      <li className="flex justify-between items-center text-sm text-slate-300 py-1">
          <span className="flex-1 text-xs text-slate-400">{label}</span>
          <button 
            onClick={() => setRecordingKey(action)}
            className={`font-mono px-2 py-0.5 rounded-md text-[10px] min-w-[60px] text-center border transition-all ${recordingKey === action ? 'bg-red-500/20 text-red-400 border-red-500 animate-pulse' : 'bg-white/10 text-primary-200 border-transparent hover:border-white/20'}`}
          >
             {recordingKey === action ? 'Press key...' : (currentBindings[action] || 'Unbound')}
          </button>
      </li>
  );

  return (
    <>
      <div className={`fixed inset-y-0 right-0 w-80 bg-[#0f172a]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-[100] transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 className="font-semibold text-white flex items-center gap-2"><SettingsIcon size={18} className="text-primary"/> {t.settings}</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={22} /></button>
          </div>
          <div className="p-5 space-y-4 overflow-y-auto h-[calc(100%-70px)] custom-scrollbar">
              
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
                      <AnkiWidget isConnected={ankiConnected} onConnectCheck={onConnectCheck} config={ankiConfig} onConfigChange={setAnkiConfig} lang={lang} />
                  </div>
              </details>

              {/* Keyboard Shortcuts Section */}
              <details className="group">
                  <summary className="list-none flex items-center justify-between cursor-pointer text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      <div className="flex items-center gap-2"><Keyboard size={14} /> {t.keyboardShortcuts}</div>
                      <ChevronDown size={14} className="group-open:rotate-180 transition-transform"/>
                  </summary>
                  <div className="pl-4 pb-4 space-y-3">
                      <div className="flex justify-between items-center mb-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                              <div className="relative">
                                  <input 
                                      type="checkbox" 
                                      className="sr-only peer"
                                      checked={!!ankiConfig.keyboardShortcutsEnabled}
                                      onChange={(e) => setAnkiConfig({...ankiConfig, keyboardShortcutsEnabled: e.target.checked})}
                                  />
                                  <div className="w-8 h-4 bg-white/10 rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all"></div>
                              </div>
                              <span className="text-[10px] text-slate-400">{t.enableShortcuts}</span>
                          </label>
                          <button onClick={resetBindings} className="text-[10px] text-slate-500 hover:text-white underline">Reset</button>
                      </div>
                      
                      {ankiConfig.keyboardShortcutsEnabled && (
                          <ul className="space-y-1 bg-black/20 rounded-lg p-2 border border-white/5">
                              <ShortcutRow action="playPause" label={t.shortcutPlayPause} />
                              <ShortcutRow action="prevSub" label={t.shortcutPrevSub} />
                              <ShortcutRow action="nextSub" label={t.shortcutNextSub} />
                              <ShortcutRow action="toggleDict" label={t.shortcutToggleDict} />
                              <ShortcutRow action="toggleTranscript" label={t.shortcutToggleTranscript} />
                              <ShortcutRow action="quickCard" label={t.shortcutQuickCard} />
                              <ShortcutRow action="toggleMask" label={t.shortcutToggleMask} />
                              <ShortcutRow action="toggleFullscreen" label={t.shortcutToggleFullscreen} />
                              <ShortcutRow action="setA" label={t.shortcutSetA} />
                              <ShortcutRow action="setB" label={t.shortcutSetB} />
                              <ShortcutRow action="clearLoop" label={t.shortcutClearAB} />
                              <ShortcutRow action="ocr" label={t.shortcutOcr} />
                          </ul>
                      )}
                      <p className="text-xs text-slate-500 italic mt-3 pt-3 border-t border-white/5">{t.gamepadSupport}</p>
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
                            onClick={onExportData}
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
                              onChange={onImportData}
                          />
                          <p className="text-[10px] text-slate-500 text-center">{t.importDataDesc}</p>
                      </div>

                      {/* Clear Cache */}
                      <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                          <button 
                            onClick={onClearCache}
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
      {isOpen && <div className="fixed inset-0 bg-black/50 z-[90] backdrop-blur-sm transition-opacity" onClick={onClose} />}
    </>
  );
};

export default SettingsSidebar;