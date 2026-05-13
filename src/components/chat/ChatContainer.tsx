import { useState, useRef, useEffect } from 'react';
import { Message, ChatSession, AppSettings, ProviderType, FileContext } from '../../types';
import Composer from './Composer';
import { GeminiProvider, OllamaProvider } from '../../services/ai-providers';
import MessageList from './MessageList';
import { Bot, User, Terminal, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatContainerProps {
  session: ChatSession;
  settings: AppSettings;
  onUpdateSession: (session: ChatSession) => void;
}

export default function ChatContainer({ session, settings, onUpdateSession }: ChatContainerProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.messages]);

  const handleSendMessage = async (content: string, files: FileContext[]) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments: files.filter(f => f.type.startsWith('image/')).map(f => f.content)
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

    const provider = settings.provider === ProviderType.GEMINI ? new GeminiProvider() : new OllamaProvider();
    const assistantMessageId = (Date.now() + 1).toString();
    
    let assistantContent = "";
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
        files: updatedSession.files
      });

      for await (const chunk of stream) {
        assistantContent += chunk;
        onUpdateSession({
          ...updatedSession,
          messages: [...newMessages, { ...assistantMessage, content: assistantContent }]
        });
      }
    } catch (error: any) {
      console.error("AI Error:", error);
      const errorMessageValue = error.message || "Failed to get response";
      onUpdateSession({
        ...updatedSession,
        messages: [...newMessages, { 
          ...assistantMessage, 
          content: `ERROR: ${errorMessageValue}`,
          isError: true 
        } as any]
      });
    } finally {
      setIsStreaming(false);
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
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">
            {settings.provider === ProviderType.GEMINI ? settings.geminiModel : settings.ollamaModel}
          </span>
          <button 
            onClick={() => window.electron?.ipcRenderer.send('toggle-overlay')}
            className="ml-4 px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded border border-indigo-500/30 text-[10px] font-bold uppercase tracking-wider transition-all"
          >
            Overlay Mode
          </button>
        </div>
      </header>

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

      <Composer onSend={handleSendMessage} isStreaming={isStreaming} attachedFiles={session.files} />
    </div>
  );
}
