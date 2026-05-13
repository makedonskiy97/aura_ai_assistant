export enum ProviderType {
  GEMINI = 'gemini',
  OLLAMA = 'ollama',
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: string[]; // URLs or base64
  isError?: boolean;
}

export interface FileContext {
  name: string;
  content: string;
  type: string;
  size: number;
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
