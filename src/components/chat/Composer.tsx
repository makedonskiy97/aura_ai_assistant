import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Camera, X, FileText, Image as ImageIcon, ScreenShare } from 'lucide-react';
import { FileContext } from '../../types';
import { processFile } from '../../services/file-processor';
import SelectionOverlay from './SelectionOverlay';

interface ComposerProps {
  onSend: (content: string, files: FileContext[]) => void;
  isStreaming: boolean;
  attachedFiles?: FileContext[];
}

export default function Composer({ onSend, isStreaming, attachedFiles = [] }: ComposerProps) {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<FileContext[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturePhase, setCapturePhase] = useState<'idle' | 'preparing' | 'requested' | 'ready' | 'success' | 'failed' | 'cancelled'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.electron) {
      const cleanup = window.electron.ipcRenderer.on('on-capture-complete', (dataUrl: string) => {
        setFiles(prev => [...prev, {
          name: `capture-${Date.now()}.png`,
          content: dataUrl,
          type: 'image/png',
          size: 0
        }]);
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
    setFiles([...files, ...processed]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGlobalCapture = () => {
    if (window.electron) {
      setIsCapturing(true);
      setCapturePhase('preparing');
      window.electron.ipcRenderer.send('start-capture');
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  return (
    <div className="p-6 bg-zinc-950 relative">
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
          <div className="flex flex-wrap gap-2 mb-2 p-2 rounded-xl bg-zinc-900 border border-zinc-800">
            {files.map((file, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1 bg-zinc-800 rounded-md border border-zinc-700 shadow-sm animate-in zoom-in-95 duration-200">
                {file.type.startsWith('image/') ? (
                   <ImageIcon className="w-3 h-3 text-indigo-400" />
                ) : (
                  <FileText className="w-3 h-3 text-zinc-500" />
                )}
                <span className="text-[10px] font-medium text-zinc-300 truncate max-w-[100px]">{file.name}</span>
                <button 
                  onClick={() => removeFile(i)}
                  className="p-0.5 hover:bg-zinc-700 rounded-full transition-colors text-zinc-500 hover:text-zinc-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form 
          onSubmit={handleSubmit}
          className="relative group bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500/50 transition-all overflow-hidden"
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask about files or screenshots..."
            className="w-full resize-none bg-transparent py-4 px-4 pr-32 focus:outline-none text-sm min-h-[80px] max-h-[300px] leading-relaxed text-zinc-200 placeholder-zinc-600"
            rows={2}
          />

          <div className="absolute right-2 bottom-2 flex items-center justify-between w-full h-10 px-4 pointer-events-none">
            <div className="flex items-center gap-1 pointer-events-auto">
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
            </div>
            <button
              type="submit"
              disabled={isStreaming || (!content.trim() && files.length === 0)}
              className="pointer-events-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-zinc-800 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20"
            >
              Send Request
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
        
        <p className="text-[10px] text-center text-zinc-400 dark:text-zinc-500 font-medium">
          Aura supports text, PDF, code, and images. Press Shift+Enter for new line.
        </p>
      </div>
    </div>
  );
}
