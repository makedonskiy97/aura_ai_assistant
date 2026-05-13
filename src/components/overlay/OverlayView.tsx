import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Camera, X, Maximize2, Sparkles } from 'lucide-react';
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
  const [isSelecting, setIsSelecting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
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
        url: settings.ollamaUrl
      });

      for await (const chunk of stream) {
        assistantContent += chunk;
        setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { ...m, content: assistantContent } : m));
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { ...m, content: "Error occurred." } : m));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleCapture = () => {
    setIsSelecting(true);
  };

  const onConfirmCapture = async (rect: { x: number; y: number; width: number; height: number }) => {
    if (!window.electron) return;
    try {
      const fullScreenshot = await window.electron.captureScreen();
      const img = new Image();
      img.src = fullScreenshot;
      await new Promise((resolve) => (img.onload = resolve));

      const canvas = document.createElement('canvas');
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
        const dataUrl = canvas.toDataURL('image/png');
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'user',
          content: "[Captured Region]",
          attachments: [dataUrl],
          timestamp: Date.now()
        }]);
      }
    } catch (err) {
      console.error("Capture failed:", err);
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-zinc-900 border border-indigo-500/50 rounded-xl overflow-hidden shadow-2xl drag transform scale-[0.98]">
      {isSelecting && (
        <SelectionOverlay 
          onCapture={onConfirmCapture}
          onCancel={() => setIsSelecting(false)}
        />
      )}
      <header className="h-12 flex items-center px-4 gap-3 bg-zinc-950 border-b border-zinc-800 no-drag">
        <div className="w-4 h-4 rounded bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Sparkles className="w-2.5 h-2.5 text-white" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300">Nexus Overlay</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={handleCapture} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-indigo-400">
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
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-10">
            <Bot className="w-10 h-10 mb-2 text-zinc-500" />
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">Active Window Intelligence</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            {m.attachments?.[0] && (
              <img src={m.attachments[0]} className="max-w-[80%] h-auto rounded-lg mb-2 border border-zinc-800 shadow-xl" alt="Screen" />
            )}
            <div className={`max-w-[90%] px-3 py-2.5 rounded-xl text-[11px] leading-relaxed ${
              m.role === 'user' 
              ? 'bg-zinc-800 text-zinc-300 border border-zinc-700' 
              : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/10'
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

      <div className="p-4 bg-zinc-950/50 border-t border-zinc-800 no-drag">
        <div className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a quick question..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 pl-3 pr-10 text-[11px] text-zinc-300 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
          />
          <button 
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="absolute right-2 top-2 text-indigo-500 hover:text-indigo-400 disabled:opacity-30 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button 
            className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md text-[9px] font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-100 transition-all"
          >
            Expand App
          </button>
          <button 
            onClick={() => window.electron?.ipcRenderer.send('toggle-overlay')}
            className="px-3 py-1.5 bg-red-900/10 hover:bg-red-900/20 text-red-400 rounded-md text-[9px] font-bold uppercase tracking-widest"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}
