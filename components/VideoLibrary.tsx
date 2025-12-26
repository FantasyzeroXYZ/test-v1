
import React, { useRef, useState, useEffect } from 'react';
import { VideoLibraryItem, UILanguage } from '../types';
import { getTranslation } from '../i18n';
import { formatTime } from '../utils';
import { Play, Film, Music, FileText, Languages, Trash2, Link as LinkIcon, Plus, X, Check, Upload, Edit, HardDrive, Globe, Radio, FolderInput, FileDown, LayoutGrid, List } from 'lucide-react';

interface Props {
  items: VideoLibraryItem[];
  lang: UILanguage;
  onSelectSample: (item: VideoLibraryItem) => void;
  onImportLocalFile: (file: File) => void;
  onAddNetworkVideo: (url: string, title: string, source: string, id?: string, isLive?: boolean) => void; // Added source
  onDeleteVideo: (id: string) => void;
  onImportSubtitleAndPlay: (item: VideoLibraryItem, file: File, type: 'primary' | 'secondary', shouldPlay: boolean) => void;
  onUpdateLocalVideo: (id: string, newTitle: string, source: string, file?: File) => void; // Added source
}

const VideoLibrary: React.FC<Props> = ({ 
  items, 
  lang,
  onSelectSample, 
  onImportLocalFile, 
  onAddNetworkVideo, 
  onDeleteVideo, 
  onImportSubtitleAndPlay,
  onUpdateLocalVideo
}) => {
  const t = getTranslation(lang);
  const hiddenSubInputRef = useRef<HTMLInputElement>(null);
  const hiddenReimportInputRef = useRef<HTMLInputElement>(null);
  
  const activeItemRef = useRef<VideoLibraryItem | null>(null);
  const activeSubTypeRef = useRef<'primary' | 'secondary'>('primary');

  const [showUrlModal, setShowUrlModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [sourceInput, setSourceInput] = useState('');
  const [isLiveInput, setIsLiveInput] = useState(false);
  
  // Local Edit State
  const [isEditingLocal, setIsEditingLocal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // View Mode State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
      const savedMode = localStorage.getItem('vam_library_view_mode');
      if (savedMode === 'grid' || savedMode === 'list') {
          setViewMode(savedMode);
      }
  }, []);

  const toggleViewMode = () => {
      const newMode = viewMode === 'grid' ? 'list' : 'grid';
      setViewMode(newMode);
      localStorage.setItem('vam_library_view_mode', newMode);
  };

  // Handle Subtitle Upload Click
  const handleSubClick = (e: React.MouseEvent, item: VideoLibraryItem, type: 'primary' | 'secondary') => {
    e.stopPropagation();
    activeItemRef.current = item;
    activeSubTypeRef.current = type;
    if (hiddenSubInputRef.current) {
        hiddenSubInputRef.current.value = ''; 
        hiddenSubInputRef.current.click();
    }
  };

  const handleSubFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeItemRef.current) {
        onImportSubtitleAndPlay(activeItemRef.current, file, activeSubTypeRef.current, false);
    }
    e.target.value = '';
  };

  // Handle Video Edit Click
  const handleEditClick = (e: React.MouseEvent, item: VideoLibraryItem) => {
    e.stopPropagation();
    setEditingId(item.id);
    setTitleInput(item.title);
    setSourceInput(item.source || '');
    
    // Check if it's local. Use isLocal flag first as file might be missing in metadata
    if (item.isLocal) {
        setIsEditingLocal(true);
        setPendingFile(null);
    } else {
        setIsEditingLocal(false);
        setUrlInput(item.src);
        setIsLiveInput(!!item.isLive);
    }
    setShowUrlModal(true);
  };

  const handleReimportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setPendingFile(file);
          // If title is empty, default to filename
          if (!titleInput.trim()) {
              setTitleInput(file.name);
          }
      }
      e.target.value = '';
  };

  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportLocalFile(file);
    }
    e.target.value = ''; 
  };

  const openAddModal = () => {
      setEditingId(null);
      setUrlInput('');
      setTitleInput('');
      setSourceInput('');
      setIsLiveInput(false);
      setIsEditingLocal(false);
      setShowUrlModal(true);
  };

  const handleCloseModal = () => {
      setShowUrlModal(false);
      setEditingId(null);
      setUrlInput('');
      setTitleInput('');
      setSourceInput('');
      setIsLiveInput(false);
      setIsEditingLocal(false);
      setPendingFile(null);
  };

  const submitUrl = () => {
    if (isEditingLocal && editingId) {
        if (titleInput) {
            onUpdateLocalVideo(editingId, titleInput, sourceInput, pendingFile || undefined);
            handleCloseModal();
        }
    } else {
        if (urlInput && titleInput) {
            onAddNetworkVideo(urlInput, titleInput, sourceInput, editingId || undefined, isLiveInput);
            handleCloseModal();
        }
    }
  };

  const handleDownloadNotes = (e: React.MouseEvent, video: VideoLibraryItem) => {
    e.stopPropagation();
    if (!video.bookmarks || video.bookmarks.length === 0) return;

    const sortedBookmarks = [...video.bookmarks].sort((a, b) => a.time - b.time);

    let mdContent = `# ${video.title}\n\n`;
    
    // Metadata Header
    // Prioritize technical filename/link for the Source line
    const technicalSource = video.isLocal ? (video.filename || video.title) : video.src;
    mdContent += `- **${t.mdSource}**: ${technicalSource}\n`;
    if (video.source) {
        // Use a generic label or append if desired. 
        mdContent += `- **Origin**: ${video.source}\n`;
    }

    if (video.duration) mdContent += `- **${t.mdDuration}**: ${video.duration}\n`;
    
    mdContent += `\n## ${t.mdNotes}\n\n`;

    sortedBookmarks.forEach(bm => {
        mdContent += `### ${formatTime(bm.time)} - ${bm.text}\n`;
        if (bm.note) {
            mdContent += `> ${bm.note.replace(/\n/g, '\n> ')}\n`;
        }
        mdContent += `\n`;
    });

    mdContent += `\n---\n*${t.mdGenerated || 'Generated by VAMplayer'}*`;

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Sanitize filename but allow Unicode (for Chinese/Japanese titles)
    const safeTitle = video.title.replace(/[<>:"/\\|?*]+/g, '_');
    a.download = `${safeTitle}.md`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isMixedContent = typeof window !== 'undefined' && window.location.protocol === 'https:' && urlInput.trim().toLowerCase().startsWith('http:');

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <input 
        type="file" 
        ref={hiddenSubInputRef} 
        accept=".srt,.vtt,.ass" 
        className="hidden" 
        onChange={handleSubFileChange}
      />
      {/* Hidden input for local file replacement */}
      <input 
        type="file" 
        ref={hiddenReimportInputRef} 
        accept="video/*,audio/*,.mkv" 
        className="hidden" 
        onChange={handleReimportFileChange}
      />

      <div className="flex flex-row items-center justify-between mb-6 md:mb-8 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Film className="text-primary w-6 h-6 md:w-7 md:h-7 shrink-0" />
          <h2 className="text-xl md:text-2xl font-bold text-white truncate">{t.mediaLibrary}</h2>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
            {/* View Mode Toggle */}
            <button 
                onClick={toggleViewMode} 
                className="h-10 w-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-lg text-slate-300 hover:text-white transition-colors border border-white/5 box-border"
                title={viewMode === 'grid' ? t.listView : t.gridView}
            >
                {viewMode === 'grid' ? <List size={20} /> : <LayoutGrid size={20} />}
            </button>

            {/* Import Local Button */}
            <label className="h-10 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 px-4 rounded-lg text-sm font-medium transition-colors cursor-pointer border border-white/5 hover:border-white/20 text-slate-200 hover:text-white box-border select-none leading-none">
                <input 
                    type="file" 
                    accept="video/*,audio/*,.mkv,video/x-matroska" 
                    className="hidden" 
                    onChange={handleLocalFileSelect} 
                />
                <Upload size={16} />
                <span className="hidden sm:inline">{t.importLocal}</span>
            </label>

            {/* Add Link Button */}
            <button 
                onClick={openAddModal}
                className="h-10 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 px-4 rounded-lg text-sm font-medium transition-colors border border-white/5 hover:border-white/20 text-slate-200 hover:text-white box-border select-none leading-none"
            >
                <LinkIcon size={16} />
                <span className="hidden sm:inline">{t.addLink}</span>
            </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-6">
            {items.map((video) => {
            const isLive = video.isLive || video.duration === 'Live';
            const hasNotes = video.bookmarks && video.bookmarks.length > 0;
            
            return (
            <div 
                key={video.id}
                onClick={() => onSelectSample(video)}
                className="group relative bg-glass border border-white/10 rounded-xl overflow-hidden cursor-pointer hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1"
            >
                {/* Thumbnail */}
                <div className="aspect-[3/4] md:aspect-video relative overflow-hidden bg-black/50">
                {video.thumbnail ? (
                    <img 
                    src={video.thumbnail} 
                    alt={video.title} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80 group-hover:opacity-100"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800">
                    <Film className="text-white/20 w-12 h-12" />
                    </div>
                )}
                
                {/* Source/Live Badge */}
                <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider backdrop-blur-md border border-white/10 text-white flex items-center gap-1 z-20 ${isLive ? 'bg-red-500/80 animate-pulse border-red-500/40' : 'bg-black/40'}`}>
                    {video.isLocal ? <HardDrive size={10} /> : isLive ? <Radio size={10} /> : <Globe size={10} />}
                    {video.isLocal ? t.sourceLocal : isLive ? t.live : t.sourceNetwork}
                </div>

                {/* Delete */}
                <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteVideo(video.id); }}
                    className="absolute top-1 right-1 p-1.5 bg-black/60 hover:bg-red-500/80 rounded-full text-white/70 hover:text-white transition-colors z-20 opacity-0 group-hover:opacity-100"
                    title={t.deleteVideo}
                >
                    <Trash2 size={12} />
                </button>

                {/* Play Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 pointer-events-none">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-2xl scale-100 transition-transform group-hover/video:scale-110">
                        <Play fill="white" className="text-white ml-1" size={16} />
                    </div>
                </div>
                
                {/* Actions Badges/Buttons */}
                <div className="absolute bottom-1 right-1 flex flex-col gap-1 z-30">
                    {/* Re-import / Edit Source Button */}
                    <button 
                        onClick={(e) => handleEditClick(e, video)}
                        className="flex items-center gap-1 backdrop-blur-md px-1.5 py-1 rounded text-[10px] text-white border border-white/10 transition-colors bg-black/60 hover:bg-blue-500/80"
                        title={t.editVideo}
                    >
                        <Edit size={10} />
                        <span className="hidden md:inline">{t.editVideo}</span>
                    </button>

                    {/* Download Notes Button - Only if bookmarks exist */}
                    {hasNotes && (
                        <button 
                            onClick={(e) => handleDownloadNotes(e, video)}
                            className="flex items-center gap-1 backdrop-blur-md px-1.5 py-1 rounded text-[10px] text-white border border-white/10 transition-colors bg-black/60 hover:bg-amber-500/80"
                            title={t.downloadNotes}
                        >
                            <FileDown size={10} />
                            <span className="hidden md:inline">Notes</span>
                        </button>
                    )}

                    <button 
                        onClick={(e) => handleSubClick(e, video, 'primary')}
                        className={`flex items-center gap-1 backdrop-blur-md px-1.5 py-1 rounded text-[10px] text-white border border-white/10 transition-colors ${video.hasPrimarySubtitle ? 'bg-green-500/80 hover:bg-green-600' : 'bg-black/60 hover:bg-primary/80'}`}
                        title={video.hasPrimarySubtitle ? t.autoLoad : t.clickToUpload}
                    >
                        {video.hasPrimarySubtitle ? <Check size={10} /> : <FileText size={10} />}
                        <span className="hidden md:inline">{t.orig}</span>
                    </button>
                    <button 
                        onClick={(e) => handleSubClick(e, video, 'secondary')}
                        className={`flex items-center gap-1 backdrop-blur-md px-1.5 py-1 rounded text-[10px] text-white border border-white/10 transition-colors ${video.hasSecondarySubtitle ? 'bg-green-500/80 hover:bg-green-600' : 'bg-black/60 hover:bg-pink-500/80'}`}
                        title={video.hasSecondarySubtitle ? t.autoLoad : t.clickToUpload}
                    >
                        {video.hasSecondarySubtitle ? <Check size={10} /> : <Languages size={10} />}
                        <span className="hidden md:inline">{t.trans}</span>
                    </button>
                </div>
                </div>
                
                {/* Info */}
                <div className="p-2 md:p-3">
                <h3 className="font-semibold text-xs md:text-sm text-slate-200 group-hover:text-white truncate" title={video.title}>{video.title}</h3>
                <div className="flex items-center gap-2 mt-1 text-[10px] md:text-xs text-slate-400">
                    {video.type === 'video' ? <Film size={12} /> : <Music size={12} />}
                    <span className="capitalize">{video.type}</span>
                </div>
                </div>
            </div>
            );
            })}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
            {items.map((video) => {
                const isLive = video.isLive || video.duration === 'Live';
                const hasNotes = video.bookmarks && video.bookmarks.length > 0;
                
                return (
                    <div 
                        key={video.id}
                        onClick={() => onSelectSample(video)}
                        className="group flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-3 bg-glass border border-white/10 rounded-xl cursor-pointer hover:bg-white/5 hover:border-white/20 transition-all duration-200"
                    >
                        {/* Thumbnail Section */}
                        <div className="w-full sm:w-48 aspect-video relative overflow-hidden bg-black/50 rounded-lg flex-shrink-0">
                            {video.thumbnail ? (
                                <img 
                                src={video.thumbnail} 
                                alt={video.title} 
                                className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                <Film className="text-white/20 w-8 h-8" />
                                </div>
                            )}
                             {/* Source/Live Badge */}
                            <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider backdrop-blur-md border border-white/10 text-white flex items-center gap-1 z-20 ${isLive ? 'bg-red-500/80 animate-pulse border-red-500/40' : 'bg-black/40'}`}>
                                {video.isLocal ? <HardDrive size={10} /> : isLive ? <Radio size={10} /> : <Globe size={10} />}
                                {video.isLocal ? t.sourceLocal : isLive ? t.live : t.sourceNetwork}
                            </div>
                             {/* Play Overlay (Mini) */}
                             <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors flex items-center justify-center">
                                <div className="w-8 h-8 bg-white/10 backdrop-blur rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Play fill="white" className="text-white ml-0.5" size={12} />
                                </div>
                             </div>
                        </div>

                        {/* Metadata Section */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                            <h3 className="font-bold text-base text-slate-200 group-hover:text-white truncate pr-2">{video.title}</h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                                <span className="flex items-center gap-1.5">
                                    {video.type === 'video' ? <Film size={12} /> : <Music size={12} />}
                                    <span className="capitalize">{video.type}</span>
                                </span>
                                <span className="w-1 h-1 rounded-full bg-white/20"></span>
                                <span>{video.duration}</span>
                                {video.bookmarks && video.bookmarks.length > 0 && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-white/20"></span>
                                        <span className="text-primary flex items-center gap-1">
                                            {video.bookmarks.length} {t.bookmarks}
                                        </span>
                                    </>
                                )}
                                {video.source && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-white/20"></span>
                                        <span className="text-slate-500 italic truncate max-w-[150px]">{video.source}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Actions Section */}
                        <div className="flex items-center gap-2 self-start sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 w-full sm:w-auto justify-end">
                            <button 
                                onClick={(e) => handleEditClick(e, video)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                title={t.editVideo}
                            >
                                <Edit size={16} />
                            </button>

                            {hasNotes && (
                                <button 
                                    onClick={(e) => handleDownloadNotes(e, video)}
                                    className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                                    title={t.downloadNotes}
                                >
                                    <FileDown size={16} />
                                </button>
                            )}

                             <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block"></div>

                            <button 
                                onClick={(e) => handleSubClick(e, video, 'primary')}
                                className={`p-2 rounded-lg transition-colors ${video.hasPrimarySubtitle ? 'text-green-400 hover:bg-green-500/10' : 'text-slate-500 hover:text-primary hover:bg-white/10'}`}
                                title={video.hasPrimarySubtitle ? `${t.orig}: ${t.autoLoad}` : `${t.orig}: ${t.clickToUpload}`}
                            >
                                <FileText size={16} />
                            </button>
                            <button 
                                onClick={(e) => handleSubClick(e, video, 'secondary')}
                                className={`p-2 rounded-lg transition-colors ${video.hasSecondarySubtitle ? 'text-green-400 hover:bg-green-500/10' : 'text-slate-500 hover:text-pink-400 hover:bg-pink-500/10'}`}
                                title={video.hasSecondarySubtitle ? `${t.trans}: ${t.autoLoad}` : `${t.trans}: ${t.clickToUpload}`}
                            >
                                <Languages size={16} />
                            </button>

                            <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block"></div>

                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteVideo(video.id); }}
                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                title={t.deleteVideo}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showUrlModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1e293b] border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">{editingId ? t.updateVideo : t.addVideo}</h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="space-y-4">
              
              {/* Title Field (Always Visible) */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">{t.videoTitle}</label>
                <input 
                  value={titleInput} 
                  onChange={e => setTitleInput(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-primary outline-none"
                  placeholder="e.g. My Video"
                />
              </div>

              {/* Source Field (Optional) */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">{t.videoSource}</label>
                <input 
                  value={sourceInput} 
                  onChange={e => setSourceInput(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-primary outline-none text-xs"
                  placeholder="e.g. YouTube, Netflix, Original Site..."
                />
              </div>

              {/* Local File Edit UI */}
              {isEditingLocal ? (
                  <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-400">{t.replaceFile}</span>
                          <button 
                            onClick={() => hiddenReimportInputRef.current?.click()}
                            className="text-xs flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition-colors text-white"
                          >
                              <FolderInput size={12} /> {t.importLocal}
                          </button>
                      </div>
                      <div className="text-xs font-mono text-primary truncate">
                          {pendingFile ? `${t.selectedFile}: ${pendingFile.name}` : t.none}
                      </div>
                  </div>
              ) : (
                  // Network URL Field
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">{t.videoUrl}</label>
                    <input 
                      value={urlInput} 
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-primary outline-none font-mono text-sm"
                      placeholder="https://example.com/video.m3u8"
                    />
                    {isMixedContent && (
                        <div className="text-yellow-500 text-xs mt-2 flex items-start gap-1 p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
                            <span className="font-bold">⚠️</span> 
                            <span>{t.warningMixedContent}</span>
                        </div>
                    )}
                  </div>
              )}

              {/* Live Stream Checkbox (Network Only) */}
              {!isEditingLocal && (
                  <div className="flex items-center gap-2 mt-2">
                      <input 
                        type="checkbox" 
                        id="isLiveCheckbox"
                        checked={isLiveInput} 
                        onChange={e => setIsLiveInput(e.target.checked)}
                        className="w-4 h-4 rounded border-white/10 bg-black/30 text-primary focus:ring-offset-0 focus:ring-primary"
                      />
                      <label htmlFor="isLiveCheckbox" className="text-xs font-medium text-slate-400 select-none cursor-pointer">
                          {t.markAsLive}
                      </label>
                  </div>
              )}

              <div className="flex justify-end gap-3 mt-4">
                <button onClick={handleCloseModal} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/5">{t.cancel}</button>
                <button 
                    onClick={submitUrl} 
                    disabled={!titleInput || (!isEditingLocal && !urlInput)} 
                    className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                    {editingId ? t.updateVideo : t.addVideo}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoLibrary;