import { MessageSquarePlus, Settings, History, Bot, Sparkles, Trash2 } from 'lucide-react';
import { ChatSession, AppSettings, ProviderType } from '../../types';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onOpenSettings: () => void;
  settings: AppSettings;
}

export default function Sidebar({ sessions, activeSessionId, onSelectSession, onNewSession, onDeleteSession, onOpenSettings, settings }: SidebarProps) {
  return (
    <aside className="w-64 border-r border-zinc-800 flex flex-col h-full bg-zinc-900">
      <div className="p-4 flex flex-col gap-4 border-b border-zinc-800">
        <div className="flex items-center gap-3 px-1 py-1">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight leading-none">Nexus</span>
            <span className="text-[10px] text-zinc-500 font-medium tracking-tighter">Desktop AI</span>
          </div>
          <div className="ml-auto">
            <span className={`text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded border ${settings.provider === ProviderType.GEMINI ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
              {settings.provider}
            </span>
          </div>
        </div>

        <button 
          onClick={onNewSession}
          className="flex items-center gap-2 w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md border border-zinc-700 text-zinc-200 hover:text-white transition-all font-medium text-xs flex items-center justify-center shadow-sm"
        >
          <MessageSquarePlus className="w-4 h-4 text-zinc-400" />
          New Conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        <div>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2 mb-3 flex items-center justify-between">
            Recent Sessions
          </div>
          <div className="space-y-1">
            {sessions.map(session => (
              <div key={session.id} className="group relative">
                <button
                  onClick={() => onSelectSession(session.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs transition-all truncate pr-8 border ${
                    activeSessionId === session.id 
                    ? 'bg-zinc-800/50 border-indigo-500/30 text-zinc-100 font-medium shadow-sm' 
                    : 'text-zinc-400 border-transparent hover:bg-zinc-800/50 hover:text-zinc-200'
                  }`}
                >
                  {session.title}
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded"
                  title="Delete conversation"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          {sessions.length === 0 && (
            <div className="px-3 py-6 text-center text-[10px] text-zinc-600 italic">
              No sessions found
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-zinc-800">
        <button 
          onClick={onOpenSettings}
          className="flex items-center gap-3 w-full p-2 rounded-md text-xs transition-all text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 group"
        >
          <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-[10px] group-hover:bg-zinc-700 transition-colors">
            <Settings className="w-3.5 h-3.5" />
          </div>
          App Settings
        </button>
      </div>
    </aside>
  );
}
