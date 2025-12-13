
import React, { useState, useEffect } from 'react';
import { AnkiConfig, UILanguage } from '../types';
import { ankiService, setAnkiAddress } from '../services/ankiService';
import { RefreshCw, CheckCircle, XCircle, Settings, Link, Tag, Layers, ScanEye } from 'lucide-react';
import { getTranslation } from '../i18n';

interface Props {
  isConnected: boolean;
  onConnectCheck: () => Promise<boolean>;
  config: AnkiConfig;
  onConfigChange: (newConfig: AnkiConfig) => void;
  lang: UILanguage;
}

const AnkiWidget: React.FC<Props> = ({ isConnected, onConnectCheck, config, onConfigChange, lang }) => {
  const t = getTranslation(lang);
  const [decks, setDecks] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [fields, setFields] = useState<string[]>([]);
  const [ioFields, setIoFields] = useState<string[]>([]); // Fields for IO model
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'standard' | 'io'>('standard');

  // Load data if already connected (e.g. page refresh with valid config)
  useEffect(() => {
    if (isConnected) {
        loadAnkiData();
        setTestStatus('success');
    }
  }, [isConnected]);

  // When standard model changes, fetch its fields
  useEffect(() => {
    if (config.model && isConnected) {
      ankiService.getModelFields(config.model).then(setFields);
    }
  }, [config.model, isConnected]);

  // When IO model changes, fetch its fields
  useEffect(() => {
    if (config.imageOcclusion?.model && isConnected) {
      ankiService.getModelFields(config.imageOcclusion.model).then(setIoFields);
    }
  }, [config.imageOcclusion?.model, isConnected]);

  const loadAnkiData = async () => {
    setLoading(true);
    try {
      const [d, m] = await Promise.all([ankiService.getDeckNames(), ankiService.getModelNames()]);
      setDecks(d);
      setModels(m);
    } catch (e) {
        console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
      setLoading(true);
      setTestStatus('idle');
      // Update service address
      setAnkiAddress(config.ip, config.port);
      
      const success = await onConnectCheck();
      if (success) {
          setTestStatus('success');
          await loadAnkiData();
      } else {
          setTestStatus('error');
      }
      setLoading(false);
  };

  const handleFieldMapChange = (key: keyof AnkiConfig['fields'], value: string) => {
    onConfigChange({
      ...config,
      fields: { ...config.fields, [key]: value }
    });
  };

  const handleIoFieldMapChange = (key: keyof AnkiConfig['imageOcclusion']['fields'], value: string) => {
    onConfigChange({
      ...config,
      imageOcclusion: { 
          ...config.imageOcclusion, 
          fields: { ...config.imageOcclusion.fields, [key]: value }
      }
    });
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const tags = e.target.value.split(' ').map(t => t.trim()).filter(Boolean);
      onConfigChange({ ...config, tags });
  };
  
  const handleIoTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const tags = e.target.value.split(' ').map(t => t.trim()).filter(Boolean);
      onConfigChange({ 
          ...config, 
          imageOcclusion: { ...config.imageOcclusion, tags }
      });
  };

  const inputClass = "w-full bg-black/40 border border-white/10 rounded-lg p-2 text-slate-200 focus:border-primary outline-none text-xs";
  const labelClass = "block text-slate-400 mb-1 text-[10px] font-bold uppercase tracking-wider";

  return (
    <div className="w-full space-y-5">
      
      {/* Connection Settings */}
      <div className="space-y-3 p-3 bg-white/5 rounded-xl border border-white/5">
          <h4 className="text-xs font-semibold text-white flex items-center gap-2">
              <Link size={14} className="text-primary"/> Connection
          </h4>
          <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                  <label className={labelClass}>IP Address</label>
                  <input 
                    type="text" 
                    value={config.ip} 
                    placeholder="127.0.0.1"
                    onChange={e => onConfigChange({...config, ip: e.target.value})}
                    className={inputClass}
                  />
              </div>
              <div>
                  <label className={labelClass}>Port</label>
                  <input 
                    type="text" 
                    value={config.port} 
                    placeholder="8765"
                    onChange={e => onConfigChange({...config, port: e.target.value})}
                    className={inputClass}
                  />
              </div>
          </div>
          
          <button 
            onClick={handleTestConnection}
            disabled={loading}
            className={`w-full py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${testStatus === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : testStatus === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-primary hover:bg-primary/80 text-white'}`}
          >
             {loading ? <RefreshCw className="animate-spin" size={14} /> : testStatus === 'success' ? <CheckCircle size={14} /> : testStatus === 'error' ? <XCircle size={14} /> : <RefreshCw size={14} />}
             {loading ? 'Testing...' : testStatus === 'success' ? 'Connected' : testStatus === 'error' ? 'Failed' : 'Test Connection'}
          </button>
      </div>

      {/* Card Configuration - Only show if connected */}
      {isConnected && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
           
           {/* Tabs */}
           <div className="flex border-b border-white/10 mb-4">
                <button 
                    onClick={() => setActiveTab('standard')}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'standard' ? 'border-primary text-white' : 'border-transparent text-slate-500'}`}
                >
                    <Settings size={12} className="inline mr-1"/> Standard
                </button>
                <button 
                    onClick={() => setActiveTab('io')}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'io' ? 'border-primary text-white' : 'border-transparent text-slate-500'}`}
                >
                    <ScanEye size={12} className="inline mr-1"/> {t.ioConfig}
                </button>
           </div>

           {/* STANDARD CONFIG */}
           {activeTab === 'standard' && (
               <div className="space-y-4">
                   <div className="grid grid-cols-1 gap-3">
                       <div>
                         <label className={labelClass}>{t.deck}</label>
                         <select value={config.deck} onChange={e => onConfigChange({...config, deck: e.target.value})} className={inputClass}>
                           <option value="">{t.selectDeck}</option>
                           {decks.map(d => <option key={d} value={d}>{d}</option>)}
                         </select>
                       </div>
                       <div>
                         <label className={labelClass}>{t.noteType}</label>
                         <select value={config.model} onChange={e => onConfigChange({...config, model: e.target.value})} className={inputClass}>
                           <option value="">{t.selectModel}</option>
                           {models.map(m => <option key={m} value={m}>{m}</option>)}
                         </select>
                       </div>
                   </div>

                   {fields.length > 0 && (
                     <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                       <p className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-2">
                           <Settings size={14} /> {t.fieldMapping}
                       </p>
                       <div className="space-y-2">
                           {(['word', 'definition', 'sentence', 'translation', 'audio', 'image'] as const).map(key => (
                             <div key={key} className="grid grid-cols-[80px_1fr] items-center gap-2">
                               <label className="text-[10px] text-slate-400 capitalize text-right">{t[key] || key}</label>
                               <select 
                                 value={config.fields[key]} 
                                 onChange={e => handleFieldMapChange(key, e.target.value)}
                                 className="bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-primary/50"
                               >
                                 <option value="">{t.none}</option>
                                 {fields.map(f => <option key={f} value={f}>{f}</option>)}
                               </select>
                             </div>
                           ))}
                       </div>
                     </div>
                   )}

                   <div>
                       <label className={labelClass}><Tag size={12} className="inline mr-1"/> Tags</label>
                       <input 
                         type="text" 
                         defaultValue={config.tags.join(' ')}
                         onBlur={handleTagsChange}
                         className={inputClass}
                       />
                   </div>
               </div>
           )}

           {/* IMAGE OCCLUSION CONFIG */}
           {activeTab === 'io' && (
               <div className="space-y-4">
                   <div className="grid grid-cols-1 gap-3">
                       <div>
                         <label className={labelClass}>{t.deck}</label>
                         <select 
                             value={config.imageOcclusion?.deck || ''} 
                             onChange={e => onConfigChange({ ...config, imageOcclusion: { ...config.imageOcclusion, deck: e.target.value }})} 
                             className={inputClass}
                         >
                           <option value="">{t.selectDeck}</option>
                           {decks.map(d => <option key={d} value={d}>{d}</option>)}
                         </select>
                       </div>
                       <div>
                         <label className={labelClass}>{t.noteType}</label>
                         <select 
                             value={config.imageOcclusion?.model || ''} 
                             onChange={e => onConfigChange({ ...config, imageOcclusion: { ...config.imageOcclusion, model: e.target.value }})} 
                             className={inputClass}
                         >
                           <option value="">{t.selectModel}</option>
                           {models.map(m => <option key={m} value={m}>{m}</option>)}
                         </select>
                       </div>
                   </div>

                   {ioFields.length > 0 && (
                     <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                       <p className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-2">
                           <Layers size={14} /> {t.fieldMapping}
                       </p>
                       <div className="space-y-2">
                           {[
                               { key: 'mask', label: t.maskField },
                               { key: 'image', label: t.imageField },
                               { key: 'audio', label: t.ioAudioField },
                               { key: 'header', label: t.headerField },
                               { key: 'backExtra', label: t.backExtraField },
                               { key: 'remarks', label: t.remarksField },
                           ].map(({key, label}) => (
                             <div key={key} className="grid grid-cols-[80px_1fr] items-center gap-2">
                               <label className="text-[10px] text-slate-400 capitalize text-right">{label}</label>
                               <select 
                                 value={(config.imageOcclusion?.fields as any)?.[key] || ''} 
                                 onChange={e => handleIoFieldMapChange(key as any, e.target.value)}
                                 className="bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-primary/50"
                               >
                                 <option value="">{t.none}</option>
                                 {ioFields.map(f => <option key={f} value={f}>{f}</option>)}
                               </select>
                             </div>
                           ))}
                       </div>
                     </div>
                   )}

                   <div>
                       <label className={labelClass}><Tag size={12} className="inline mr-1"/> Tags</label>
                       <input 
                         type="text" 
                         defaultValue={config.imageOcclusion?.tags?.join(' ') || 'image_occlusion'}
                         onBlur={handleIoTagsChange}
                         className={inputClass}
                       />
                   </div>
               </div>
           )}

        </div>
      )}
    </div>
  );
};
export default AnkiWidget;