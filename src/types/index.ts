export enum ProviderType {
  GEMINI = 'gemini',
  OLLAMA = 'ollama',
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: FileContext[]; 
  isError?: boolean;
  metrics?: {
    timeSeconds: number;
    tokensPerSecond?: number;
  };
}

export interface FileContext {
  id: string;
  name: string;
  content: string;
  type: string;
  size: number;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  provider: ProviderType;
  model: string;
  createdAt: number;
  updatedAt: number;
  files: FileContext[];
  systemPrompt?: string;
}

export interface AppSettings {
  provider: ProviderType;
  geminiKey: string;
  geminiModel: string;
  ollamaUrl: string;
  ollamaModel: string;
  theme: 'dark' | 'light' | 'system';
  autoStartOverlay: boolean;
}
