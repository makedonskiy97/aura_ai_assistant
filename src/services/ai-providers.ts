import { GoogleGenerativeAI } from "@google/generative-ai";
import { Message, ProviderType, FileContext } from "../types";

export interface AIProvider {
  sendMessage(messages: Message[], options: { model: string, files?: FileContext[], key?: string, url?: string }): Promise<string>;
  streamMessage(messages: Message[], options: { model: string, files?: FileContext[], key?: string, url?: string }): AsyncGenerator<string>;
}

export class GeminiProvider implements AIProvider {
  async *streamMessage(messages: Message[], options: any): AsyncGenerator<string> {
    if (!options.key) throw new Error("Gemini API Key missing");
    const genAI = new GoogleGenerativeAI(options.key);
    const model = genAI.getGenerativeModel({ model: options.model || "gemini-1.5-flash" });

    // Prepare context
    let promptParts: any[] = [];
    if (options.files) {
      options.files.forEach((f: FileContext) => {
        if (f.type.startsWith('image/')) {
          const base64 = f.content.split(',')[1] || f.content;
          promptParts.push({ inlineData: { data: base64, mimeType: f.type } });
        } else {
          promptParts.push(`File Context (${f.name}):\n${f.content}\n---`);
        }
      });
    }

    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    const result = await model.generateContentStream([
      ...promptParts,
      ...history.flatMap(h => h.parts),
      { text: messages[messages.length - 1].content }
    ]);

    for await (const chunk of result.stream) {
      yield chunk.text();
    }
  }

  async sendMessage(messages: Message[], options: any): Promise<string> {
    let result = "";
    for await (const chunk of this.streamMessage(messages, options)) {
      result += chunk;
    }
    return result;
  }
}

export class OllamaProvider implements AIProvider {
  async *streamMessage(messages: Message[], options: any): AsyncGenerator<string> {
    const url = options.url || "http://localhost:11434";
    const body = {
      model: options.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    };

    const response = await fetch(`${url}/api/chat`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      try {
        const json = JSON.parse(chunk);
        if (json.message?.content) yield json.message.content;
      } catch (e) {
        // Handle split JSON chunks if necessary
      }
    }
  }

  async sendMessage(messages: Message[], options: any): Promise<string> {
    let result = "";
    for await (const chunk of this.streamMessage(messages, options)) {
      result += chunk;
    }
    return result;
  }
}
