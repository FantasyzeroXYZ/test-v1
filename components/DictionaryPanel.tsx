

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DictionaryResponse, LearningLanguage, UILanguage } from '../types';
import { Search, Plus, Loader2, BookOpen, X, ArrowRight, Volume2, ExternalLink, PenTool } from 'lucide-react';
import { getTranslation } from '../i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  word: string;
  sentence: string;
  learningLanguage: LearningLanguage;
  onAddToAnki: (term: string, definition: string, sentence?: string) => Promise<void>;
  onAppendNext?: () => void;
  canAppend: boolean;
  isAddingToAnki: boolean;
  variant?: 'bottom-sheet' | 'sidebar';
  lang: UILanguage;
  searchEngine: string;
}

const DictionaryPanel: React.FC<Props> = ({ 
  isOpen, onClose, word, sentence, learningLanguage, onAddToAnki, onAppendNext, canAppend, isAddingToAnki, variant = 'bottom-sheet', lang, searchEngine
}) => {
  const t = getTranslation(lang);
  const [searchTerm, setSearchTerm] = useState(word);
  const [data, setData] = useState<DictionaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'dict' | 'web'>('dict');
  const [customDef, setCustomDef] = useState('');
  
  const segmenterRef = useRef<any>(null);

  useEffect(() => {
      try {
        segmenterRef.current = new (Intl as any).Segmenter(learningLanguage, { granularity: 'word' });
      } catch (e) {
        // Fallback or ignore
      }
  }, [learningLanguage]);

  // Update search term when prop changes
  useEffect(() => {
    if (isOpen) {
      setSearchTerm(word);
      if (word) {
          setActiveTab('dict');
          fetchDefinition(word, learningLanguage);
      } else {
          // If word is empty but we have a sentence (e.g. from OCR), don't show empty state immediately
          if (!sentence) setData(null); 
      }
    }
  }, [isOpen, word, learningLanguage, sentence]);

  const fetchDefinition = async (term: string, langCode: string) => {
    if (!term) return;
    setLoading(true);
    setError('');
    setData(null);

    try {
      // Switched to the new, more reliable API endpoint.
      const res = await fetch(`https://freedictionaryapi.com/api/v1/entries/${langCode}/${term}`);
      
      if (!res.ok) {
        throw new Error('Not found');
      }
      
      const json = await res.json();
      
      // The new API returns an object with an 'entries' array.
      if (json && json.entries && json.entries.length > 0) {
        const mappedData: DictionaryResponse = {
          word: json.word,
          entries: json.entries.map((entry: any) => {
            const ipaPronunciation = entry.pronunciations?.find((p: any) => p.type === 'ipa');
            return {
              language: entry.language?.code,
              partOfSpeech: entry.partOfSpeech || 'unknown',
              phonetic: ipaPronunciation ? ipaPronunciation.text : undefined,
              // Note: The new API spec does not provide audio URLs, so the audio button will not render.
              pronunciations: entry.pronunciations?.map((p: any) => ({
                text: p.text,
                audio: undefined
              })),
              senses: entry.senses?.map((sense: any) => ({
                definition: sense.definition,
                examples: sense.examples || [],
                synonyms: sense.synonyms || [],
                antonyms: sense.antonyms || []
              }))
            };
          })
        };
        setData(mappedData);
      } else {
        setError(t.noDefFound);
      }
    } catch (e) {
      setError(t.noDefFound);
    } finally {
      setLoading(false);
    }
  };


  const handleSearch = (term?: string) => {
      const actualTerm = term || searchTerm;
      if (actualTerm && actualTerm.trim()) {
          setSearchTerm(actualTerm);
          if (activeTab === 'dict') {
             fetchDefinition(actualTerm.trim(), learningLanguage);
          }
      }
  };

  const playAudio = (url: string) => {
      new Audio(url).play().catch(e => console.error(e));
  };

  const getSearchUrl = (term: string) => {
      const encoded = encodeURIComponent(term);
      
      switch(searchEngine) {
          case 'bing': return `https://www.bing.com/search?q=${encoded}`;
          case 'baidu': return `https://m.baidu.com/s?word=${encoded}`; 
          case 'baidu_baike': 
            return `https://baike.baidu.com/item/${encoded}`;
          case 'google': default: return `https://www.google.com/search?igu=1&q=${encoded}`;
      }
  };

  const searchUrl = getSearchUrl(searchTerm);

  const isSidebar = variant === 'sidebar';
  
  const containerClasses = isSidebar
    ? `fixed top-0 right-0 h-full w-full md:w-[400px] bg-[#0f172a]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-[200] transition-transform duration-300 transform flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`
    : `fixed bottom-0 left-0 right-0 h-[80vh] bg-[#0f172a]/95 backdrop-blur-xl border-t border-white/10 shadow-2xl z-[200] transition-transform duration-300 transform flex flex-col rounded-t-2xl ${isOpen ? 'translate-y-0' : 'translate-y-full'}`;

  // Interactive Sentence Rendering
  const renderInteractiveSentence = () => {
      if (!sentence) return null;
      
      let segments: { segment: string; isWordLike: boolean }[] = [];
      if (segmenterRef.current) {
          const iter = segmenterRef.current.segment(sentence);
          segments = Array.from(iter).map((s: any) => ({ segment: s.segment, isWordLike: s.isWordLike }));
      } else {
          segments = sentence.split(/(\s+)/).map((s) => ({ segment: s, isWordLike: /\S/.test(s) }));
      }

      return (
          <div className="bg-black/20 border-y border-white/5 p-3 text-sm leading-relaxed text-slate-200 shrink-0">
              <div className="flex flex-wrap gap-0">
                  {segments.map((item, i) => {
                      if (!item.isWordLike) return <span key={i} className="whitespace-pre">{item.segment}</span>;
                      return (
                          <span 
                            key={i} 
                            className="cursor-pointer hover:text-primary hover:bg-white/10 rounded px-0 transition-colors whitespace-pre"
                            onClick={() => handleSearch(item.segment.trim())}
                          >
                              {item.segment}
                          </span>
                      );
                  })}
              </div>
          </div>
      );
  };

  return (
    <>
      {!isSidebar && isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[180] transition-opacity" onClick={onClose} />
      )}

      <div className={containerClasses}>
        {/* Header / Search */}
        <div className="p-4 border-b border-white/10 flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                    <BookOpen size={18} className="text-primary" /> {t.dictionary}
                </h3>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            
            <div className="relative">
               <input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full bg-black/40 border border-white/10 rounded-lg pl-3 pr-10 py-2.5 text-sm text-white focus:border-primary outline-none placeholder:text-slate-600"
                  placeholder={t.search + "..."}
               />
               <button 
                  onClick={() => handleSearch()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
               >
                  <Search size={16} />
               </button>
            </div>
        </div>

        {/* Sentence Area (Above Tabs) */}
        {renderInteractiveSentence()}

        {/* Tabs */}
        <div className="flex border-b border-white/10 shrink-0">
             <button 
                onClick={() => setActiveTab('dict')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'dict' ? 'border-primary text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
             >
                {t.dictionary}
             </button>
             <button 
                onClick={() => setActiveTab('web')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'web' ? 'border-primary text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
             >
                {t.webSearch}
             </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col scrollbar-thin scrollbar-thumb-white/10">
            {activeTab === 'dict' && (
                <div className="space-y-6 p-4">
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={30} /></div>
                    ) : error ? (
                        <div className="text-center py-10">
                            <p className="text-slate-400 mb-2">{error}</p>
                            <p className="text-xs text-slate-600">Try using Web Search tab.</p>
                        </div>
                    ) : data ? (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex items-baseline justify-between mb-4">
                                <div>
                                    <h2 className="text-3xl font-bold text-white mb-1">{data.word}</h2>
                                    {data.entries[0]?.phonetic && <span className="text-slate-400 font-mono text-sm">[{data.entries[0].phonetic}]</span>}
                                </div>
                                {data.entries[0]?.pronunciations?.[0]?.audio && (
                                    <button onClick={() => playAudio(data.entries[0].pronunciations![0].audio!)} className="p-2 bg-white/10 rounded-full hover:bg-primary hover:text-white transition-colors text-slate-300">
                                        <Volume2 size={20} />
                                    </button>
                                )}
                            </div>

                            {/* Append Word Action */}
                            {canAppend && onAppendNext && (
                                <button onClick={onAppendNext} className="w-full mb-6 flex items-center justify-center gap-2 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition-colors">
                                    <ArrowRight size={14} /> Append next word
                                </button>
                            )}
                            
                            {data.entries.map((entry, i) => (
                                <div key={i} className="mb-6">
                                    <span className="inline-block px-2 py-0.5 bg-white/10 text-primary text-[10px] font-bold uppercase rounded-full mb-2">{entry.partOfSpeech}</span>
                                    
                                    <div className="space-y-3">
                                        {entry.senses?.map((sense, j) => (
                                          <div key={j} className="text-sm text-slate-300 border-l-2 border-white/10 pl-3">
                                            <p>{sense.definition}</p>
                                            {sense.examples?.[0] && (
                                              <p className="text-xs text-slate-500 mt-1 italic">"{sense.examples[0]}"</p>
                                            )}
                                          </div>  
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <div className="space-y-3 mt-6 pt-4 border-t border-white/10">
                                <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><PenTool size={12}/> {t.customDef}</h4>
                                <textarea 
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-primary outline-none" 
                                    rows={2}
                                    placeholder="Manually add or edit definition..."
                                    value={customDef}
                                    onChange={(e) => setCustomDef(e.target.value)}
                                ></textarea>
                                <button 
                                    onClick={() => {
                                        const def = customDef || data.entries?.[0]?.senses?.[0]?.definition || '';
                                        onAddToAnki(searchTerm, def);
                                    }}
                                    disabled={isAddingToAnki}
                                    className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary/80 text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isAddingToAnki ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                                    {t.addToAnki}
                                </button>
                            </div>

                        </div>
                    ) : null}
                </div>
            )}
            
            {activeTab === 'web' && (
                <div className="w-full h-full flex flex-col">
                    <a href={searchUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-black/20 text-center text-xs text-slate-400 hover:text-primary flex items-center justify-center gap-2">
                        {t.webSearch} <ExternalLink size={12} />
                    </a>
                    <iframe 
                        src={searchUrl} 
                        className="w-full flex-1 border-0"
                        sandbox="allow-forms allow-scripts allow-same-origin"
                    />
                </div>
            )}
        </div>
      </div>
    </>
  );
};

export default DictionaryPanel;