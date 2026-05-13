import { useState, useEffect } from 'react';
import { Message, ChatSession, AppSettings, ProviderType } from './types';
import Sidebar from './components/layout/Sidebar';
import ChatContainer from './components/chat/ChatContainer';
import OverlayView from './components/overlay/OverlayView';
import SettingsView from './components/settings/SettingsView';
import SelectionOverlay from './components/chat/SelectionOverlay';
import { GeminiProvider, OllamaProvider } from './services/ai-providers';

const DEFAULT_SETTINGS: AppSettings = {
  provider: ProviderType.GEMINI,
  geminiKey: '',
  geminiModel: 'gemini-1.5-flash',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3',
  theme: 'dark',
  autoStartOverlay: false,
};

export default function App() {
  const [currentView, setCurrentView] = useState<'chat' | 'settings'>('chat');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isOverlay, setIsOverlay] = useState(false);
  const [isCaptureMode, setIsCaptureMode] = useState(false);

  useEffect(() => {
    // Check if we are in overlay mode via hash
    if (window.location.hash === '#overlay') {
      setIsOverlay(true);
    }
    if (window.location.hash === '#capture') {
      setIsCaptureMode(true);
    }

    // Load settings and history from electron-store if available
    const loadData = async () => {
      if (window.electron) {
        const storedSettings = await window.electron.store.get('settings');
        if (storedSettings) setSettings(storedSettings);
        
        const storedSessions = await window.electron.store.get('sessions');
        if (storedSessions) {
          setSessions(storedSessions);
          if (storedSessions.length > 0) setActiveSessionId(storedSessions[0].id);
        }
      }
    };
    loadData();
  }, []);

  const saveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    if (window.electron) {
      await window.electron.store.set('settings', newSettings);
    }
  };

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      provider: settings.provider,
      model: settings.provider === ProviderType.GEMINI ? settings.geminiModel : settings.ollamaModel,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      files: [],
    };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
    setCurrentView('chat');
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  if (isCaptureMode) {
    return (
      <SelectionOverlay 
        onCapture={async (rect) => {
          if (window.electron) {
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
              const croppedDataUrl = canvas.toDataURL('image/png');
              window.electron.ipcRenderer.send('capture-result', croppedDataUrl);
            }
          }
        }}
        onCancel={() => {
          if (window.electron) window.electron.ipcRenderer.send('close-selection');
        }}
      />
    );
  }

  if (isOverlay) {
    return <OverlayView settings={settings} />;
  }

  return (
    <div className={`flex h-screen w-full overflow-hidden ${settings.theme === 'dark' ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-900 border-zinc-200'} font-sans`}>
      <Sidebar 
        sessions={sessions} 
        activeSessionId={activeSessionId} 
        onSelectSession={setActiveSessionId}
        onNewSession={createNewSession}
        onOpenSettings={() => setCurrentView('settings')}
        settings={settings}
      />
      
      <main className="flex-1 flex flex-col min-w-0 relative">
        {currentView === 'chat' ? (
          activeSession ? (
            <ChatContainer 
              session={activeSession} 
              settings={settings}
              onUpdateSession={(updated) => {
                const newSessions = sessions.map(s => s.id === updated.id ? updated : s);
                setSessions(newSessions);
                if (window.electron) window.electron.store.set('sessions', newSessions);
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500">
              <div className="text-center">
                <h1 className="text-2xl font-semibold mb-2">Aura AI</h1>
                <p>Select or create a chat to begin</p>
                <button 
                  onClick={createNewSession}
                  className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                >
                  Start New Chat
                </button>
              </div>
            </div>
          )
        ) : (
          <SettingsView settings={settings} onSave={saveSettings} onBack={() => setCurrentView('chat')} />
        )}
      </main>
    </div>
  );
}
