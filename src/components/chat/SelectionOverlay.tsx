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
  
  const handleMouseDown = (e: React.MouseEvent) => {
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
      className="fixed inset-0 z-[9999] bg-black/40 cursor-crosshair overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="absolute top-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-white text-xs font-bold uppercase tracking-widest shadow-2xl flex items-center gap-3 pointer-events-none">
        <Crop className="w-4 h-4 text-indigo-500" />
        Select region to capture
        <span className="text-zinc-500 font-medium">ESC to cancel</span>
      </div>

      <AnimatePresence>
        {rect && (
          <div 
            className="absolute border-2 border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.3)] pointer-events-none"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
            }}
          >
            {!isSelecting && rect.width > 20 && rect.height > 20 && (
              <div className="absolute -bottom-12 right-0 flex items-center gap-2 pointer-events-auto">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel();
                  }}
                  className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onCapture(rect);
                  }}
                  className="p-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-500 transition-colors shadow-lg"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
