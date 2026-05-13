import { Bot, User, Copy, Check } from 'lucide-react';
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
          ? 'bg-zinc-900/50 p-5 rounded-2xl border border-zinc-800 text-zinc-300 shadow-sm' 
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
          <div className="flex flex-wrap gap-2 mt-4">
            {message.attachments.map((url, i) => (
              <div key={i} className="relative group/img">
                <img 
                  src={url} 
                  alt="Attachment" 
                  className="max-w-[240px] max-h-[240px] rounded-xl border border-zinc-800 shadow-xl transition-all hover:scale-[1.01]" 
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy Message'}
          </button>
        </div>
      </div>
    </div>
  );
}
