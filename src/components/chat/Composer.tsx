import { useState, useRef } from 'react';
import { Send, Paperclip, Camera, X, FileText, Image as ImageIcon } from 'lucide-react';
import { FileContext } from '../../types';
import { processFile } from '../../services/file-processor';

interface ComposerProps {
  onSend: (content: string, files: FileContext[]) => void;
  isStreaming: boolean;
  attachedFiles?: FileContext[];
}

export default function Composer({ onSend, isStreaming, attachedFiles = [] }: ComposerProps) {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<FileContext[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim() && files.length === 0) return;
    if (isStreaming) return;

    onSend(content, files);
    setContent('');
    setFiles([]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const processed = await Promise.all(selectedFiles.map(processFile));
    setFiles([...files, ...processed]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCaptureScreen = async () => {
    if (!window.electron) return;
    try {
      const dataUrl = await window.electron.captureScreen();
      setFiles([...files, {
        name: `screenshot-${Date.now()}.png`,
        content: dataUrl,
        type: 'image/png',
        size: 0
      }]);
    } catch (err) {
      console.error("Screenshot failed:", err);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  return (
    <div className="p-6 bg-zinc-950">
      <div className="max-w-4xl mx-auto flex flex-col gap-2">
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 p-2 rounded-xl bg-zinc-900 border border-zinc-800">
            {files.map((file, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1 bg-zinc-800 rounded-md border border-zinc-700 shadow-sm animate-in zoom-in-95 duration-200">
                {file.type.startsWith('image/') ? (
                   <ImageIcon className="w-3 h-3 text-indigo-400" />
                ) : (
                  <FileText className="w-3 h-3 text-zinc-500" />
                )}
                <span className="text-[10px] font-medium text-zinc-300 truncate max-w-[100px]">{file.name}</span>
                <button 
                  onClick={() => removeFile(i)}
                  className="p-0.5 hover:bg-zinc-700 rounded-full transition-colors text-zinc-500 hover:text-zinc-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form 
          onSubmit={handleSubmit}
          className="relative group bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500/50 transition-all overflow-hidden"
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask about files or screenshots..."
            className="w-full resize-none bg-transparent py-4 px-4 pr-32 focus:outline-none text-sm min-h-[80px] max-h-[300px] leading-relaxed text-zinc-200 placeholder-zinc-600"
            rows={2}
          />

          <div className="absolute right-2 bottom-2 flex items-center justify-between w-full h-10 px-4 pointer-events-none">
            <div className="flex items-center gap-1 pointer-events-auto">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-indigo-400"
                title="Attach files"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleCaptureScreen}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-indigo-400"
                title="Capture screen region"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>
            <button
              type="submit"
              disabled={isStreaming || (!content.trim() && files.length === 0)}
              className="pointer-events-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-zinc-800 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20"
            >
              Send Request
            </button>
          </div>
        </form>

        <input 
          ref={fileInputRef}
          type="file" 
          multiple
          className="hidden" 
          onChange={handleFileChange}
        />
        
        <p className="text-[10px] text-center text-zinc-400 dark:text-zinc-500 font-medium">
          Aura supports text, PDF, code, and images. Press Shift+Enter for new line.
        </p>
      </div>
    </div>
  );
}
