import { useState, useRef, useEffect } from 'react';
import { Message, ChatSession, AppSettings, ProviderType, FileContext } from '../../types';
import Composer from './Composer';
import { GeminiProvider, OllamaProvider } from '../../services/ai-providers';
import MessageList from './MessageList';
import { Bot, User, Terminal, Copy, Check, Trash2, ShieldAlert, Cpu, Timer, HardDrive, Settings2, Sliders, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatContainerProps {
  session: ChatSession;
  settings: AppSettings;
  onUpdateSession: (session: ChatSession) => void;
  onDeleteSession: (id: string) => void;
}

export default function ChatContainer({ session, settings, onUpdateSession, onDeleteSession }: ChatContainerProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.messages]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const updateSystemPrompt = (prompt: string) => {
    onUpdateSession({ ...session, systemPrompt: prompt, updatedAt: Date.now() });
  };

  const handleSendMessage = async (content: string, files: FileContext[]) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments: files
    };

    const newMessages = [...session.messages, userMessage];
    const updatedSession = { 
      ...session, 
      messages: newMessages, 
      files: [...session.files, ...files],
      updatedAt: Date.now() 
    };
    onUpdateSession(updatedSession);

    setIsStreaming(true);
    abortControllerRef.current = new AbortController();

    const provider = settings.provider === ProviderType.GEMINI ? new GeminiProvider() : new OllamaProvider();
    const assistantMessageId = crypto.randomUUID();
    
    let assistantContent = "";
    const startTime = Date.now();
    
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: "",
      timestamp: Date.now(),
    };

    onUpdateSession({ ...updatedSession, messages: [...newMessages, assistantMessage] });

    try {
      const stream = provider.streamMessage([...newMessages], {
        model: settings.provider === ProviderType.GEMINI ? settings.geminiModel : settings.ollamaModel,
        key: settings.geminiKey,
        url: settings.ollamaUrl,
        files: updatedSession.files,
        signal: abortControllerRef.current.signal,
        systemPrompt: session.systemPrompt
      });

      for await (const chunk of stream) {
        assistantContent += chunk;
        onUpdateSession({
          ...updatedSession,
          messages: [...newMessages, { ...assistantMessage, content: assistantContent }]
        });
      }

      // Finish and calculate metrics
      const endTime = Date.now();
      const durationSeconds = (endTime - startTime) / 1000;
      const tokenCount = assistantContent.split(/\s+/).length; // Simple estimation
      const tokensPerSecond = tokenCount / durationSeconds;

      onUpdateSession({
        ...updatedSession,
        messages: [...newMessages, { 
          ...assistantMessage, 
          content: assistantContent,
          metrics: {
            timeSeconds: durationSeconds,
            tokensPerSecond: tokensPerSecond
          }
        }]
      });

    } catch (error: any) {
      if (error.name === 'AbortError' || error.message === 'Generation stopped by user') {
        console.log("Generation stopped by user");
        // We keep what was generated
      } else {
        console.error("AI Error:", error);
        const errorMessageValue = error.message || "Failed to get response";
        onUpdateSession({
          ...updatedSession,
          messages: [...newMessages, { 
            ...assistantMessage, 
            content: assistantContent + `\n\n[ERROR: ${errorMessageValue}]`,
            isError: true 
          } as any]
        });
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950">
      <header className="h-14 border-b border-zinc-800 flex items-center px-6 gap-4 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20"></div>
          <h2 className="font-semibold text-xs tracking-tight text-zinc-200">{session.title}</h2>
        </div>
        <div className="h-4 w-[1px] bg-zinc-800 mx-2"></div>
        
        <div className="flex items-center gap-4 ml-auto">
          {session.systemPrompt && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded text-indigo-400">
               <ShieldAlert className="w-3 h-3" />
               <span className="text-[10px] font-bold uppercase tracking-widest">System Active</span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">
              {settings.provider === ProviderType.GEMINI ? settings.geminiModel : settings.ollamaModel}
            </span>
          </div>

          <button 
            onClick={() => setShowSystemPrompt(!showSystemPrompt)}
            className={`p-2 rounded border transition-all ${showSystemPrompt ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 'text-zinc-500 border-transparent hover:bg-zinc-900 hover:text-zinc-300'}`}
            title="Chat Instructions"
          >
            <Settings2 className="w-4 h-4" />
          </button>

          <button 
            onClick={() => onDeleteSession(session.id)}
            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
            title="Delete Chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {showSystemPrompt && (
        <div className="p-4 bg-zinc-900 border-b border-zinc-800 animate-in slide-in-from-top-4 duration-300">
          <div className="max-w-4xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2 text-zinc-400">
                 <Sliders className="w-3.5 h-3.5" />
                 <span className="text-[10px] font-bold uppercase tracking-widest">System Instructions</span>
               </div>
               <button onClick={() => setShowSystemPrompt(false)} className="text-[10px] text-zinc-500 hover:text-zinc-300 uppercase tracking-widest font-bold">Close</button>
            </div>
            <textarea 
              value={session.systemPrompt || ''}
              onChange={(e) => updateSystemPrompt(e.target.value)}
              placeholder="e.g. You are a senior PHP developer. Answer concisely and focus on security..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500/50 min-h-[80px] resize-none leading-relaxed"
            />
            <p className="text-[9px] text-zinc-600 font-medium">These instructions will be applied to every message in this session.</p>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-10 space-y-10 scroll-smooth scrollbar-hide">
        {session.messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20 px-10">
            <Bot className="w-12 h-12 mb-4" />
            <h3 className="text-xl font-medium">Ready to help</h3>
            <p className="max-w-xs mt-2 text-sm leading-relaxed">
              Ask questions, analyze images, or upload code for review.
            </p>
          </div>
        ) : (
          <MessageList messages={session.messages} />
        )}
        {isStreaming && (
          <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="flex-1 pt-1 ml-1">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Composer onSend={handleSendMessage} onStop={handleStop} isStreaming={isStreaming} attachedFiles={session.files} />
    </div>
  );
}
