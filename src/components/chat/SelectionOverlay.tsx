import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Crop } from 'lucide-react';

interface SelectionOverlayProps {
  onCapture: (rect: { x: number; y: number; width: number; height: number }) => void;
  onCancel: () => void;
}

export default function SelectionOverlay({ onCapture, onCancel }: SelectionOverlayProps) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);

  useEffect(() => {
    if (window.electron) {
      const cleanup = window.electron.ipcRenderer.on('set-capture-bg', (dataUrl: string) => {
        setBackgroundImage(dataUrl);
      });
      return () => cleanup();
    }
  }, []);
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setStart({ x: e.clientX, y: e.clientY });
    setCurrent({ x: e.clientX, y: e.clientY });
    setIsSelecting(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isSelecting) {
      setCurrent({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };

  const getRect = () => {
    if (!start || !current) return null;
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const width = Math.abs(start.x - current.x);
    const height = Math.abs(start.y - current.y);
    if (width < 5 || height < 5) return null;
    return { x, y, width, height };
  };

  const rect = getRect();

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [onCancel]);

  return (
    <div 
      className="fixed inset-0 z-[99999] cursor-crosshair overflow-hidden select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {backgroundImage && (
        <div 
          className="absolute inset-0 grayscale-[0.3] opacity-40 bg-cover bg-center"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      )}

      <div className="absolute top-12 left-1/2 -translate-x-1/2 px-6 py-3 bg-zinc-950/90 backdrop-blur-xl border border-zinc-800 rounded-2xl text-white text-xs font-bold uppercase tracking-[0.2em] shadow-2xl flex items-center gap-4 pointer-events-none z-[100001]">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
          <Crop className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span>Click and drag to capture</span>
          <span className="text-[10px] text-zinc-500 font-medium tracking-normal normal-case">ESC to discard</span>
        </div>
      </div>

      <AnimatePresence>
        {rect && (
          <div 
            className="absolute border-2 border-indigo-500 shadow-[0_0_0_100vmax_rgba(0,0,0,0.6)] z-[100000]"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
            }}
          >
            {backgroundImage && (
              <div 
                className="absolute inset-0 bg-cover"
                style={{ 
                  backgroundImage: `url(${backgroundImage})`,
                  backgroundPosition: `-${rect.x}px -${rect.y}px`,
                  backgroundSize: `${window.innerWidth}px ${window.innerHeight}px`,
                  backgroundRepeat: 'no-repeat'
                }}
              />
            )}

            {!isSelecting && (
              <div className="absolute top-full right-0 mt-4 flex items-center gap-2 pointer-events-auto">
                <button 
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel();
                  }}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all hover:bg-zinc-800 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-2xl"
                >
                  <X className="w-3 h-3" />
                  Discard
                </button>
                <button 
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCapture(rect);
                  }}
                  className="px-6 py-2 bg-indigo-600 rounded-xl text-white hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/20 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
                >
                  <Check className="w-3 h-3" />
                  Capture Region
                </button>
              </div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
