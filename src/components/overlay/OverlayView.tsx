import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Camera, X, Maximize2, Sparkles, ScreenShare, Paperclip } from 'lucide-react';
import { Message, AppSettings, ProviderType } from '../../types';
import { GeminiProvider, OllamaProvider } from '../../services/ai-providers';
import SelectionOverlay from '../chat/SelectionOverlay';

interface OverlayViewProps {
  settings: AppSettings;
}

export default function OverlayView({ settings }: OverlayViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.electron) {
      const cleanupCapture = window.electron.ipcRenderer.on('on-capture-complete', (dataUrl: string) => {
        console.log('Overlay: global capture received');
        setPendingAttachments(prev => [...prev, dataUrl]);
      });

      const cleanupError = window.electron.ipcRenderer.on('capture-error', (msg: string) => {
        console.error('Overlay: capture error:', msg);
        setError(msg);
        setTimeout(() => setError(null), 3000);
      });

      return () => {
        cleanupCapture();
        cleanupError();
      };
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    if ((!input.trim() && pendingAttachments.length === 0) || isStreaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input || (pendingAttachments.length > 0 ? "[Attached Images]" : ""),
      attachments: pendingAttachments,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setPendingAttachments([]);
    setIsStreaming(true);

    const provider = settings.provider === ProviderType.GEMINI ? new GeminiProvider() : new OllamaProvider();
    let assistantContent = "";
    
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: "",
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const stream = provider.streamMessage(newMessages, {
        model: settings.provider === ProviderType.GEMINI ? settings.geminiModel : settings.ollamaModel,
        key: settings.geminiKey,
        url: settings.ollamaUrl,
        files: pendingAttachments.map(dataUrl => ({
          name: 'capture.png',
          type: 'image/png',
          content: dataUrl,
          size: 0
        }))
      });

      for await (const chunk of stream) {
        assistantContent += chunk;
        setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { ...m, content: assistantContent } : m));
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { 
        ...m, 
        content: `Error: ${err.message || "Failed to get response"}`,
        isError: true
      } : m));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleGlobalCapture = () => {
    console.log('Overlay: global capture triggered');
    window.electron?.ipcRenderer.send('start-capture');
  };

  const handleFileClick = () => {
    console.log('Overlay: file attach click');
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('Overlay: file selected', file.name);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (rev) => {
          if (rev.target?.result) {
            setPendingAttachments(prev => [...prev, rev.target?.result as string]);
          }
        };
        reader.readAsDataURL(file);
      } else {
        setInput(prev => prev + ` [Attached File: ${file.name}] `);
      }
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-zinc-900 border border-indigo-500/50 rounded-xl overflow-hidden shadow-2xl drag transform scale-[0.98]">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />
      <header className="h-12 flex items-center px-4 gap-3 bg-zinc-950 border-b border-zinc-800">
        <div className="w-4 h-4 rounded bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Sparkles className="w-2.5 h-2.5 text-white" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300">Nexus Overlay</span>
        <div className="ml-auto flex items-center gap-1 no-drag">
          <button 
            onClick={handleGlobalCapture}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-indigo-400" 
            title="Desktop Screenshot (Region)"
          >
            <Camera className="w-3.5 h-3.5" />
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
            {m.attachments?.map((att, i) => (
              <img key={i} src={att} className="max-w-[80%] h-auto rounded-lg mb-2 border border-zinc-800 shadow-xl" alt="Attachment" />
            ))}
            <div className={`max-w-[90%] px-3 py-2.5 rounded-xl text-[11px] leading-relaxed ${
              m.role === 'user' 
              ? 'bg-zinc-800 text-zinc-300 border border-zinc-700' 
              : `${m.isError ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/10'}`
            }`}>
              {m.content}
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
        <div className="px-4 py-2 bg-zinc-950/80 border-t border-zinc-800 flex gap-2 overflow-x-auto no-drag">
          {pendingAttachments.map((att, i) => (
            <div key={i} className="relative group shrink-0">
              <img src={att} className="w-12 h-12 rounded border border-zinc-700 object-cover" alt="Preview" />
              <button 
                onClick={() => setPendingAttachments(prev => prev.filter((_, idx) => idx !== i))}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-widest no-drag">
          {error}
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a quick question..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 pl-8 pr-10 text-[11px] text-zinc-300 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
          />
          <button 
            onClick={handleSend}
            disabled={isStreaming || (!input.trim() && pendingAttachments.length === 0)}
            className="absolute right-2 top-2.5 text-indigo-500 hover:text-indigo-400 disabled:opacity-30 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
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
