import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Camera, X, FileText, Image as ImageIcon, ScreenShare, ClipboardPaste } from 'lucide-react';
import { FileContext } from '../../types';
import { processFile } from '../../services/file-processor';
import SelectionOverlay from './SelectionOverlay';

interface ComposerProps {
  onSend: (content: string, files: FileContext[]) => void;
  onStop?: () => void;
  isStreaming: boolean;
  attachedFiles?: FileContext[];
}

export default function Composer({ onSend, onStop, isStreaming, attachedFiles = [] }: ComposerProps) {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<FileContext[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [capturePhase, setCapturePhase] = useState<'idle' | 'preparing' | 'requested' | 'ready' | 'success' | 'failed' | 'cancelled'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (window.electron) {
      const cleanup = window.electron.ipcRenderer.on('on-capture-complete', (dataUrl: string) => {
        const newFile: FileContext = {
          id: crypto.randomUUID(),
          name: `capture-${Date.now()}.png`,
          content: dataUrl,
          type: 'image/png',
          size: 0,
          timestamp: Date.now()
        };
        setFiles(prev => [...prev, newFile]);
        setIsCapturing(false);
        setCapturePhase('success');
      });

      const cleanupReady = window.electron.ipcRenderer.on('capture-ready', () => {
        setCapturePhase('ready');
      });

      const cleanupStatus = window.electron.ipcRenderer.on('capture-status', (status: string) => {
        if (status === 'requested') setCapturePhase('requested');
      });

      const cleanupError = window.electron.ipcRenderer.on('capture-error', (msg: string) => {
        setIsCapturing(false);
        setCapturePhase('failed');
      });

      const cleanupCancel = window.electron.ipcRenderer.on('on-capture-cancelled', () => {
        setIsCapturing(false);
        setCapturePhase('cancelled');
      });

      return () => {
        cleanup();
        cleanupReady();
        cleanupStatus();
        cleanupError();
        cleanupCancel();
      };
    }
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim() && files.length === 0) return;
    if (isStreaming) return;

    onSend(content, files);
    setContent('');
    setFiles([]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const processed = await Promise.all(selectedFiles.map(processFile));
    setFiles(prev => [...prev, ...processed]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      const processed = await Promise.all(droppedFiles.map(processFile));
      setFiles(prev => [...prev, ...processed]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleGlobalCapture = () => {
    if (window.electron) {
      setIsCapturing(true);
      setCapturePhase('preparing');
      window.electron.ipcRenderer.send('start-capture');
    }
  };

  const handlePasteClipboard = async () => {
    if (window.electron) {
      try {
        console.log('Composer: Manual paste triggered');
        const dataUrl = await window.electron.readClipboardImage();
        if (dataUrl) {
          const newFile: FileContext = {
            id: crypto.randomUUID(),
            name: `clipboard-${Date.now()}.png`,
            content: dataUrl,
            type: 'image/png',
            size: 0,
            timestamp: Date.now()
          };
          setFiles(prev => [...prev, newFile]);
          setError(null);
        } else {
          console.warn('Composer: No image found in clipboard');
          setError('No image found in clipboard');
          setTimeout(() => setError(null), 3000);
        }
      } catch (err) {
        console.error('Composer: Failed to read clipboard:', err);
        setError('Failed to access clipboard');
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      console.log('[Composer] Paste event detected');
      const target = e.target as HTMLElement;
      
      // Allow standard paste if in an input/textarea that is NOT our main chat composer
      // unless we detect an image, in which case we might want to intercept.
      const isOurComposer = target === textareaRef.current;
      
      const items = e.clipboardData?.items;
      let rendererSeesImage = false;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            rendererSeesImage = true;
            break;
          }
        }
      }

      if (rendererSeesImage) {
        console.log('[Composer] Renderer detected image in clipboard items');
        // Handle via IPC for better accuracy across platforms
        handlePasteClipboard();
        return;
      }

      // FALLBACK: If renderer sees nothing, check IPC bridge (Main process has better clipboard access)
      if (window.electron) {
        const formats = await window.electron.getClipboardFormats();
        const hasImageFormat = formats.some(f => 
          f.toLowerCase().includes('image') || 
          f.toLowerCase().includes('png') || 
          f.toLowerCase().includes('jpeg') || 
          f.toLowerCase().includes('bmp')
        );

        if (hasImageFormat) {
          console.log('[Composer] IPC detected image format even though renderer was blind:', formats);
          handlePasteClipboard();
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  return (
    <div 
      className={`p-6 bg-zinc-950 relative transition-all ${isDragging ? 'bg-indigo-600/5' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {isDragging && (
        <div className="absolute inset-0 z-[60] border-2 border-dashed border-indigo-500/50 flex items-center justify-center pointer-events-none bg-zinc-950/20 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Paperclip className="w-10 h-10 text-indigo-500 animate-bounce" />
            <p className="text-sm font-bold uppercase tracking-widest text-indigo-400">Release to attach files</p>
          </div>
        </div>
      )}

      {isCapturing && (
        <div className="absolute inset-0 z-50 bg-zinc-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-center animate-in fade-in duration-200">
          <div className={`w-10 h-10 rounded-full border-4 ${capturePhase === 'ready' ? 'border-green-500/20 border-t-green-500' : 'border-indigo-500/20 border-t-indigo-500'} animate-spin mb-3`} />
          <p className={`text-[10px] font-bold uppercase tracking-widest ${capturePhase === 'ready' ? 'text-green-400' : 'text-indigo-400'}`}>
            {capturePhase === 'preparing' ? 'Preparing Desktop...' : 
             capturePhase === 'requested' ? 'Waiting for System...' : 'Select Screen Region'}
          </p>
        </div>
      )}

      <div className="max-w-4xl mx-auto flex flex-col gap-2">
        {files.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-4 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-inner max-h-[300px] overflow-y-auto scrollbar-hide animate-in slide-in-from-bottom-4">
            {files.map((file) => (
              <div key={file.id} className="relative group/attachment">
                <div className="flex items-center gap-3 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl shadow-sm transition-all hover:border-indigo-500/30">
                  {file.type.startsWith('image/') ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-700 flex-shrink-0">
                      <img src={file.content} alt={file.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-zinc-500" />
                    </div>
                  )}
                  <div className="flex flex-col min-w-0 pr-6">
                    <span className="text-[11px] font-bold text-zinc-200 truncate max-w-[120px]">{file.name}</span>
                    <span className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <button 
                    onClick={() => removeFile(file.id)}
                    className="absolute -top-2 -right-2 p-1 bg-zinc-800 border border-zinc-700 rounded-full text-zinc-400 hover:text-red-400 hover:bg-zinc-700 transition-all opacity-0 group-hover/attachment:opacity-100 shadow-lg scale-90 group-hover/attachment:scale-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[10px] font-bold uppercase tracking-widest animate-in slide-in-from-bottom-2">
            ⚠️ {error}
          </div>
        )}

        <form 
          onSubmit={handleSubmit}
          className="relative group bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500/50 transition-all overflow-hidden"
        >
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Type message, drop files, or paste screenshots..."
            className="w-full resize-none bg-transparent py-4 px-4 pr-32 focus:outline-none text-sm min-h-[100px] max-h-[300px] leading-relaxed text-zinc-200 placeholder-zinc-600"
            rows={2}
          />

          <div className="absolute right-2 bottom-2 flex items-center justify-between w-full h-10 px-4 pointer-events-none">
            <div className="flex items-center gap-1 pointer-events-auto">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all animate-pulse"
                  title="Stop generation"
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 bg-current rounded-sm"></div>
                  </div>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-indigo-400"
                    title="Attach files"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleGlobalCapture}
                    className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-indigo-400"
                    title="Capture screen region"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-indigo-400"
                    title="Paste image from clipboard"
                  >
                    <ClipboardPaste className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
            <button
              type="submit"
              disabled={isStreaming || (!content.trim() && files.length === 0)}
              className="pointer-events-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-zinc-800 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20"
            >
              Send Message
            </button>
          </div>
        </form>

        <input 
          ref={fileInputRef}
          type="file" 
          multiple
          className="hidden" 
          onChange={handleFileChange}
        />
        
        <p className="text-[10px] text-center text-zinc-500 font-medium mt-2">
          Drop files or use <span className="text-zinc-400 font-bold">Ctrl+V</span> for fast screenshot sharing.
        </p>
      </div>
    </div>
  );
}
