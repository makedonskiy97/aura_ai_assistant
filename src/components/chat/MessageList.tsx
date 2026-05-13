import { Bot, User, Copy, Check, FileText, Timer, Cpu, Zap } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../../types';

interface MessageListProps {
  messages: Message[];
}

export default function MessageList({ messages }: MessageListProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-10">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}

function MessageItem({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === 'assistant';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-5 group animate-in fade-in slide-in-from-bottom-4 duration-500`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-md border ${
        isAssistant 
        ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/20 text-[10px] font-bold' 
        : 'bg-zinc-800 text-zinc-300 border-zinc-700 text-[10px] font-bold'
      }`}>
        {isAssistant ? 'AI' : 'U'}
      </div>

      <div className="flex-1 min-w-0">
        <div className={`prose dark:prose-invert max-w-none text-sm leading-relaxed ${
          isAssistant 
          ? `${message.isError ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-zinc-900/50 border-zinc-800 text-zinc-300'} p-5 rounded-2xl border shadow-sm` 
          : 'text-zinc-200 py-2'
        }`}>
          {isAssistant ? (
            <ReactMarkdown
              components={{
                code({ inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline ? (
                    <div className="relative group/code my-4">
                      <pre className={`${className} p-4 rounded-xl bg-zinc-950 border border-zinc-800 overflow-x-auto scrollbar-hide`}>
                        <code {...props}>{children}</code>
                      </pre>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(String(children));
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="absolute right-2 top-2 p-1.5 rounded-lg bg-zinc-800/50 backdrop-blur opacity-0 group-hover/code:opacity-100 transition-opacity"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ) : (
                    <code className="bg-zinc-800 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-indigo-400 font-medium" {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            <div className="whitespace-pre-wrap">{message.content}</div>
          )}
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-4">
            {message.attachments.map((file) => (
              <div key={file.id} className="relative group/attachment flex flex-col gap-2">
                {file.type.startsWith('image/') ? (
                   <div className="relative rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl transition-all hover:scale-[1.01] bg-zinc-900 max-w-[400px]">
                     <img src={file.content} alt={file.name} className="w-full h-auto object-contain max-h-[400px]" />
                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/attachment:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm shadow-xl">
                          {file.name}
                        </span>
                     </div>
                   </div>
                ) : (
                  <div className="px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center gap-3 min-w-[200px] max-w-[300px] shadow-lg group-hover/attachment:border-indigo-500/30 transition-all">
                    <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-zinc-200 truncate">{file.name}</span>
                      <span className="text-[9px] font-medium text-zinc-500 uppercase tracking-widest">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between opacity-40 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            
            {isAssistant && message.metrics && (
              <div className="flex items-center gap-3 border-l border-zinc-800 pl-4 py-0.5">
                 <div className="flex flex-col">
                   <span className="text-[8px] font-sans font-medium text-zinc-600 uppercase tracking-widest leading-none mb-1">Duration</span>
                   <div className="flex items-center gap-1 text-[9px] font-mono font-medium text-zinc-400 tracking-tighter">
                      <Timer className="w-2.5 h-2.5 text-zinc-600" />
                      <span>{message.metrics.timeSeconds.toFixed(1)}s</span>
                   </div>
                 </div>
                 
                 {message.metrics.tokensPerSecond && (
                   <>
                     <div className="h-6 w-[1px] bg-zinc-800/50 mx-1"></div>
                     <div className="flex flex-col">
                       <span className="text-[8px] font-sans font-medium text-zinc-600 uppercase tracking-widest leading-none mb-1">Velocity</span>
                       <div className="flex items-center gap-1 text-[9px] font-mono font-medium text-zinc-400 tracking-tighter">
                          <Zap className="w-2.5 h-2.5 text-amber-500/40" />
                          <span>{message.metrics.tokensPerSecond.toFixed(1)} <span className="text-[8px] text-zinc-600 uppercase">tok/s</span></span>
                       </div>
                     </div>
                   </>
                 )}
              </div>
            )}
          </div>
          
          <div className="text-[9px] font-medium text-zinc-600 tabular-nums">
             {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
}
