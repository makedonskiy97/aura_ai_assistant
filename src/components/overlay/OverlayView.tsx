import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Camera, X, Maximize2, Sparkles, ScreenShare, Paperclip, ClipboardPaste, Timer, Zap, FileText } from 'lucide-react';
import { Message, AppSettings, ProviderType, FileContext } from '../../types';
import { GeminiProvider, OllamaProvider } from '../../services/ai-providers';
import SelectionOverlay from '../chat/SelectionOverlay';
import { processFile } from '../../services/file-processor';

interface OverlayViewProps {
  settings: AppSettings;
}

export default function OverlayView({ settings }: OverlayViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<FileContext[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [capturePhase, setCapturePhase] = useState<'idle' | 'preparing' | 'requested' | 'ready' | 'success' | 'failed' | 'cancelled'>('idle');

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent | React.ClipboardEvent) => {
      console.log('[Overlay] Paste event detected');
      
      const items = (e as React.ClipboardEvent).clipboardData?.items || (e as ClipboardEvent).clipboardData?.items;
      let rendererSeesImage = false;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              e.preventDefault();
              const processed = await processFile(file);
              setPendingAttachments(prev => [...prev, processed]);
              rendererSeesImage = true;
              break;
            }
          }
        }
      }

      if (rendererSeesImage) return;

      if (window.electron) {
        const formats = await window.electron.getClipboardFormats();
        if (formats.some(f => f.toLowerCase().includes('image') || f.toLowerCase().includes('png'))) {
          console.log('[Overlay] IPC fallback detected image');
          e.preventDefault();
          handlePasteClipboard();
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  useEffect(() => {
    if (window.electron) {
      const cleanupCapture = window.electron.ipcRenderer.on('on-capture-complete', (dataUrl: string) => {
        console.log('Overlay: global capture received');
        const newFile: FileContext = {
          id: crypto.randomUUID(),
          name: `capture-${Date.now()}.png`,
          content: dataUrl,
          type: 'image/png',
          size: 0,
          timestamp: Date.now()
        };
        setPendingAttachments(prev => [...prev, newFile]);
        setIsCapturing(false);
        setCapturePhase('success');
        setTimeout(() => setCapturePhase('idle'), 2000);
      });

      const cleanupReady = window.electron.ipcRenderer.on('capture-ready', () => {
        setCapturePhase('ready');
      });

      const cleanupStatus = window.electron.ipcRenderer.on('capture-status', (status: string) => {
        if (status === 'requested') setCapturePhase('requested');
      });

      const cleanupError = window.electron.ipcRenderer.on('capture-error', (msg: string) => {
        setError(msg);
        setIsCapturing(false);
        setCapturePhase('failed');
        setTimeout(() => { setError(null); setCapturePhase('idle'); }, 5000);
      });

      const cleanupCancel = window.electron.ipcRenderer.on('on-capture-cancelled', () => {
        setIsCapturing(false);
        setCapturePhase('cancelled');
        setTimeout(() => setCapturePhase('idle'), 2000);
      });

      return () => {
        cleanupCapture();
        cleanupReady();
        cleanupStatus();
        cleanupError();
        cleanupCancel();
      };
    }
  }, []);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && pendingAttachments.length === 0) || isStreaming) return;

    const providerModel = settings.provider === ProviderType.GEMINI ? settings.geminiModel : settings.ollamaModel;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input || (pendingAttachments.some(a => a.type.startsWith('image/')) ? "[Attached Intelligence]" : ""),
      attachments: pendingAttachments,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    const currentAttachments = [...pendingAttachments];
    setPendingAttachments([]);
    setIsStreaming(true);
    abortControllerRef.current = new AbortController();

    const provider = settings.provider === ProviderType.GEMINI ? new GeminiProvider() : new OllamaProvider();
    let assistantContent = "";
    const startTime = Date.now();
    
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: "",
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const stream = provider.streamMessage(newMessages, {
        model: providerModel,
        key: settings.geminiKey,
        url: settings.ollamaUrl,
        files: currentAttachments,
        signal: abortControllerRef.current.signal
      });

      for await (const chunk of stream) {
        assistantContent += chunk;
        setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { ...m, content: assistantContent } : m));
      }

      const endTime = Date.now();
      const durationSeconds = (endTime - startTime) / 1000;
      const tokenCount = assistantContent.split(/\s+/).length;
      const tokensPerSecond = tokenCount / durationSeconds;

      setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { 
        ...m, 
        content: assistantContent,
        metrics: { timeSeconds: durationSeconds, tokensPerSecond }
      } : m));

    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'Generation stopped by user') {
         // Keep partial
      } else {
        console.error('Overlay Error:', err);
        setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { 
          ...m, 
          content: assistantContent + `\n\n[Error: ${err.message || "Failed to get response"}]`,
          isError: true
        } : m));
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleGlobalCapture = () => {
    if (window.electron) {
      setIsCapturing(true);
      setCapturePhase('preparing');
      window.electron.ipcRenderer.send('start-capture');
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      const processed = await Promise.all(selectedFiles.map(processFile));
      setPendingAttachments(prev => [...prev, ...processed]);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      const processed = await Promise.all(droppedFiles.map(processFile));
      setPendingAttachments(prev => [...prev, ...processed]);
    }
  };

  const handlePasteClipboard = async () => {
    if (window.electron) {
      try {
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
          setPendingAttachments(prev => [...prev, newFile]);
          setError(null);
        } else {
          setError('No image found in clipboard');
          setTimeout(() => setError(null), 3000);
        }
      } catch (err) {
        setError('Failed to access clipboard');
        setTimeout(() => setError(null), 3000);
      }
    }
  };

  return (
    <div 
      className={`h-screen w-full flex flex-col bg-zinc-900 border border-indigo-500/50 rounded-xl overflow-hidden shadow-2xl drag transform scale-[0.98] transition-colors ${isDragging ? 'bg-indigo-600/5' : ''}`}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
    >
      <input 
        type="file" 
        multiple
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />
      
      {isDragging && (
        <div className="absolute inset-0 z-[60] border-2 border-dashed border-indigo-500/50 flex flex-col items-center justify-center bg-zinc-950/40 backdrop-blur-sm pointer-events-none no-drag">
           <Paperclip className="w-8 h-8 text-indigo-400 animate-bounce mb-2" />
           <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Release to attach</p>
        </div>
      )}

      {isCapturing && (
        <div className="absolute inset-0 z-50 bg-zinc-950/80 backdrop-blur-md flex flex-col items-center justify-center text-center animate-in fade-in duration-300 no-drag">
          <div className="relative mb-6">
            <div className={`w-16 h-16 rounded-full border-4 ${capturePhase === 'ready' ? 'border-green-500/10 border-t-green-500' : 'border-indigo-500/10 border-t-indigo-500'} animate-spin`} />
            <Camera className={`absolute inset-0 m-auto w-6 h-6 ${capturePhase === 'ready' ? 'text-green-400' : 'text-indigo-400'} animate-pulse`} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-white mb-2">
            {capturePhase === 'preparing' || capturePhase === 'requested' ? 'Preparing Screen' : 'Ready to Select'}
          </h3>
          <p className="text-[10px] text-zinc-400 max-w-[200px] leading-relaxed">
            {capturePhase === 'preparing' 
              ? 'Please wait while we prepare the selection interface...'
              : capturePhase === 'requested'
              ? 'Waiting for system permission. Please check for any popups.'
              : 'The selection layer is now active. Drag your mouse across the screen to capture a region.'}
          </p>
          <button 
            onClick={() => {
              setIsCapturing(false);
              setCapturePhase('idle');
              window.electron?.ipcRenderer.send('close-selection');
            }}
            className="mt-8 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[10px] font-bold uppercase tracking-widest text-zinc-400 transition-all border border-zinc-700"
          >
            Cancel Capture
          </button>
        </div>
      )}

      <header className="h-12 flex items-center px-4 gap-3 bg-zinc-950 border-b border-zinc-800">
        <div className="w-4 h-4 rounded bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Sparkles className="w-2.5 h-2.5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300">Nexus Overlay</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className={`w-1 h-1 rounded-full ${settings.provider === ProviderType.GEMINI ? 'bg-blue-400' : 'bg-orange-400'}`} />
            <span className="text-[8px] text-zinc-500 font-medium uppercase tracking-widest">
              {settings.provider === ProviderType.GEMINI ? settings.geminiModel : settings.ollamaModel}
            </span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1 no-drag">
          <button 
            onClick={handleGlobalCapture}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-indigo-400" 
            title="Desktop Screenshot (Region)"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={handlePasteClipboard}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-indigo-400" 
            title="Paste Screenshot from Clipboard"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => window.electron?.ipcRenderer.send('toggle-overlay')}
            className="p-1.5 hover:bg-red-900/20 hover:text-red-400 rounded-lg transition-colors text-zinc-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-drag scrollbar-hide bg-zinc-900">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-10 text-zinc-500">
            <Bot className="w-10 h-10 mb-2" />
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]">Active Window Intelligence</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            {m.attachments?.map((att) => (
              <div key={att.id} className="mb-2 max-w-[80%]">
                {att.type.startsWith('image/') ? (
                  <img src={att.content} className="rounded-lg border border-zinc-800 shadow-xl" alt={att.name} />
                ) : (
                  <div className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg flex items-center gap-2">
                    <FileText className="w-3 h-3 text-indigo-400" />
                    <span className="text-[10px] text-zinc-300 truncate max-w-[120px]">{att.name}</span>
                  </div>
                )}
              </div>
            ))}
            <div className={`max-w-[90%] px-3 py-2.5 rounded-xl text-[11px] leading-relaxed ${
              m.role === 'user' 
              ? 'bg-zinc-800 text-zinc-300 border border-zinc-700' 
              : `${m.isError ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/10'}`
            }`}>
              {m.content}
              {m.metrics && (
                 <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-3 opacity-60 text-[9px] font-bold uppercase tracking-tighter tabular-nums">
                    <div className="flex items-center gap-1">
                      <Timer className="w-2.5 h-2.5" />
                      <span>{m.metrics.timeSeconds.toFixed(1)}s</span>
                    </div>
                    {m.metrics.tokensPerSecond && (
                      <div className="flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" />
                        <span>{m.metrics.tokensPerSecond.toFixed(0)} t/s</span>
                      </div>
                    )}
                 </div>
              )}
            </div>
          </div>
        ))}
        {isStreaming && (
          <div className="flex gap-1 py-1">
            <div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce"></div>
            <div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          </div>
        )}
      </div>

      {pendingAttachments.length > 0 && (
        <div className="px-4 py-3 bg-zinc-950/90 border-t border-zinc-800 flex gap-3 overflow-x-auto no-drag scrollbar-hide">
          {pendingAttachments.map((att) => (
            <div key={att.id} className="relative group shrink-0">
              {att.type.startsWith('image/') ? (
                <img src={att.content} className="w-12 h-12 rounded-lg border border-zinc-700 object-cover shadow-lg" alt={att.name} />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-zinc-500" />
                </div>
              )}
              <button 
                onClick={() => setPendingAttachments(prev => prev.filter(p => p.id !== att.id))}
                className="absolute -top-1.5 -right-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-red-400 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-xl"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border-t border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-widest no-drag transition-all animate-in slide-in-from-bottom-2">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 shrink-0">⚠️</div>
            <div className="leading-relaxed flex-1">
              {error}
              {error.includes('Wayland') && (
                <div className="mt-2 normal-case font-normal text-[9px] text-zinc-500">
                  Tip: Ensure xdg-desktop-portal and a backend (like -gtk or -kde) are installed. 
                  Try switching to X11 if problems persist.
                </div>
              )}
            </div>
            <button 
              onClick={() => setError(null)}
              className="p-1 hover:bg-zinc-800 rounded transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      <div className="p-4 bg-zinc-950/50 border-t border-zinc-800 no-drag">
        <div className="relative group">
          <button
            onClick={handleFileClick}
            className="absolute left-2 top-2.5 text-zinc-500 hover:text-indigo-400 transition-colors"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={(e) => {
              // We rely on the window listener for overlay inputs usually, 
              // but direct binding is safer
              console.log('[Overlay Input] Paste event');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a quick question..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 pl-8 pr-10 text-[11px] text-zinc-300 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
          />
          {isStreaming ? (
            <button 
              onClick={handleStop}
              className="absolute right-2 top-2.5 text-red-400 hover:text-red-300 animate-pulse"
            >
              <div className="w-3.5 h-3.5 bg-current rounded-sm"></div>
            </button>
          ) : (
            <button 
              onClick={handleSend}
              disabled={isStreaming || (!input.trim() && pendingAttachments.length === 0)}
              className="absolute right-2 top-2.5 text-indigo-500 hover:text-indigo-400 disabled:opacity-30 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <button 
            onClick={() => {
              console.log('Overlay: expand click');
              window.electron?.ipcRenderer.send('show-main-window');
            }}
            className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md text-[9px] font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-100 transition-all"
          >
            Expand App
          </button>
          <button 
            onClick={() => {
              console.log('Overlay: exit click');
              window.electron?.ipcRenderer.send('toggle-overlay');
            }}
            className="px-3 py-1.5 bg-red-900/10 hover:bg-red-900/20 text-red-400 rounded-md text-[9px] font-bold uppercase tracking-widest"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}
