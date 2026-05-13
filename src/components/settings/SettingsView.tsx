import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Globe, Cpu, Palette, Info, ExternalLink, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { AppSettings, ProviderType } from '../../types';

interface SettingsViewProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onBack: () => void;
}

export default function SettingsView({ settings, onSave, onBack }: SettingsViewProps) {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [ollamaStatus, setOllamaStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const testOllamaConnection = async (url: string) => {
    setOllamaStatus('loading');
    setErrorMessage('');
    try {
      const cleanUrl = url.replace(/\/$/, "");
      const response = await fetch(`${cleanUrl}/api/tags`);
      if (!response.ok) throw new Error("Server responded with " + response.status);
      
      const data = await response.json();
      const models = data.models?.map((m: any) => m.name) || [];
      setOllamaModels(models);
      setOllamaStatus(models.length > 0 ? 'connected' : 'error');
      if (models.length === 0) {
        setErrorMessage("Connected, but no models found. Run 'ollama pull <model>' first.");
      }
    } catch (err: any) {
      setOllamaStatus('error');
      setErrorMessage(err.message.includes('fetch') ? "Ollama is offline or unreachable" : err.message);
    }
  };

  useEffect(() => {
    if (formData.provider === ProviderType.OLLAMA) {
      testOllamaConnection(formData.ollamaUrl);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onBack();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-950 scrollbar-hide">
      <div className="max-w-2xl mx-auto py-16 px-6">
        <div className="flex items-center gap-6 mb-12">
          <button 
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-full transition-all text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">App Settings</h1>
            <p className="text-zinc-500 text-sm mt-1">Configure backend providers and visual preferences</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Provider Selection */}
          <section className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 space-y-8">
            <div className="flex items-center gap-3 text-white font-semibold">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <Globe className="w-4 h-4 text-indigo-500" />
              </div>
              <span className="tracking-tight">Model Intelligence</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, provider: ProviderType.GEMINI })}
                className={`p-5 rounded-2xl border-2 transition-all text-left relative overflow-hidden group ${
                  formData.provider === ProviderType.GEMINI 
                  ? 'border-indigo-500 bg-indigo-500/5 shadow-lg shadow-indigo-500/10' 
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                }`}
              >
                <div className={`font-bold text-sm ${formData.provider === ProviderType.GEMINI ? 'text-white' : 'text-zinc-400'}`}>Google Gemini</div>
                <div className="text-[10px] text-zinc-500 mt-1 uppercase font-bold tracking-wider">Cloud API</div>
                {formData.provider === ProviderType.GEMINI && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-indigo-500 rounded-full" />}
              </button>
              
              <button
                type="button"
                onClick={() => setFormData({ ...formData, provider: ProviderType.OLLAMA })}
                className={`p-5 rounded-2xl border-2 transition-all text-left relative overflow-hidden group ${
                  formData.provider === ProviderType.OLLAMA 
                  ? 'border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10' 
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                }`}
              >
                <div className={`font-bold text-sm ${formData.provider === ProviderType.OLLAMA ? 'text-white' : 'text-zinc-400'}`}>Ollama</div>
                <div className="text-[10px] text-zinc-500 mt-1 uppercase font-bold tracking-wider">Local Host</div>
                {formData.provider === ProviderType.OLLAMA && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
              </button>
            </div>

            {formData.provider === ProviderType.GEMINI ? (
              <div className="space-y-6 pt-6 border-t border-zinc-800">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Gemini API Key</label>
                  <input 
                    type="password"
                    value={formData.geminiKey}
                    onChange={(e) => setFormData({ ...formData, geminiKey: e.target.value })}
                    placeholder="••••••••••••••••"
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 text-zinc-200"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-[10px] text-zinc-500 hover:text-indigo-400 inline-flex items-center gap-1 transition-colors"
                    >
                      Retrieve API key from Google AI Studio <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Intelligence Model</label>
                  <select 
                    value={formData.geminiModel}
                    onChange={(e) => setFormData({ ...formData, geminiModel: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 outline-none hover:border-zinc-700 transition-colors"
                  >
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash (Default)</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro (Advanced)</option>
                    <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Experimental)</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-6 pt-6 border-t border-zinc-800">
                <div className="flex flex-col gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Connection Endpoint</label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={formData.ollamaUrl}
                        onChange={(e) => setFormData({ ...formData, ollamaUrl: e.target.value })}
                        placeholder="http://localhost:11434"
                        className="flex-1 px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <button 
                        type="button"
                        onClick={() => testOllamaConnection(formData.ollamaUrl)}
                        disabled={ollamaStatus === 'loading'}
                        className="px-4 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${ollamaStatus === 'loading' ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {ollamaStatus !== 'idle' && (
                    <div className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold uppercase tracking-wider ${
                      ollamaStatus === 'connected' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                      : ollamaStatus === 'error' 
                        ? 'bg-red-500/10 border-red-500/20 text-red-500' 
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                    }`}>
                      {ollamaStatus === 'connected' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {ollamaStatus === 'connected' ? 'Connected' : ollamaStatus === 'error' ? (errorMessage || 'Offline') : 'Connecting...'}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Selected Model</label>
                    <select 
                      value={formData.ollamaModel}
                      onChange={(e) => setFormData({ ...formData, ollamaModel: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200"
                    >
                      {ollamaModels.length > 0 ? (
                        ollamaModels.map(m => <option key={m} value={m}>{m}</option>)
                      ) : (
                        <option value={formData.ollamaModel}>{formData.ollamaModel || 'No models found'}</option>
                      )}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Preferences */}
          <section className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 space-y-8">
            <div className="flex items-center gap-3 text-white font-semibold">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <Palette className="w-4 h-4 text-indigo-500" />
              </div>
              <span className="tracking-tight">Personalization</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
              <div>
                <div className="font-bold text-sm text-zinc-200">System Theme</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-0.5">Interface Accent</div>
              </div>
              <div className="flex p-1 bg-zinc-900 rounded-lg border border-zinc-800">
                {(['light', 'dark', 'system'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormData({ ...formData, theme: t })}
                    className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
                      formData.theme === t 
                      ? 'bg-zinc-800 shadow-lg text-indigo-400 border border-indigo-500/20' 
                      : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-2xl">
              <div>
                <div className="font-bold text-sm text-zinc-200">Overlay Automation</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-0.5">Auto-launch mini-chat</div>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, autoStartOverlay: !formData.autoStartOverlay })}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 ease-in-out ${formData.autoStartOverlay ? 'bg-indigo-600' : 'bg-zinc-800 border border-zinc-700'}`}
              >
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300 ${formData.autoStartOverlay ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </section>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="flex-1 py-4 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-sm transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              <Save className="w-5 h-5" />
              Commit Changes
            </button>
          </div>
        </form>

        <div className="mt-16 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-700">Nexus Desktop v0.1.0-alpha</p>
        </div>
      </div>
    </div>
  );
}
