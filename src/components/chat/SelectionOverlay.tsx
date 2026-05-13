import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Crop } from 'lucide-react';

interface SelectionOverlayProps {
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}

export default function SelectionOverlay({ onCapture, onCancel }: SelectionOverlayProps) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [scaleFactor, setScaleFactor] = useState(1);

  const handleConfirm = async (rect: { x: number; y: number; width: number; height: number }) => {
    if (!backgroundImage) return;
    
    try {
      const img = new Image();
      img.src = backgroundImage;
      await new Promise((resolve) => (img.onload = resolve));

      const canvas = document.createElement('canvas');
      // Use physical pixels for output quality
      canvas.width = rect.width * scaleFactor;
      canvas.height = rect.height * scaleFactor;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(
          img, 
          rect.x * scaleFactor, 
          rect.y * scaleFactor, 
          rect.width * scaleFactor, 
          rect.height * scaleFactor, 
          0, 
          0, 
          rect.width * scaleFactor, 
          rect.height * scaleFactor
        );
        const croppedDataUrl = canvas.toDataURL('image/png');
        onCapture(croppedDataUrl);
      }
    } catch (err) {
      console.error("Capture crop failed:", err);
    }
  };

  useEffect(() => {
    if (window.electron) {
      const cleanup = window.electron.ipcRenderer.on('set-capture-bg', (dataUrl: string, scale: number) => {
        console.log('CaptureOverlay: bg received, scale:', scale);
        setBackgroundImage(dataUrl);
        setScaleFactor(scale || 1);
      });
      return () => cleanup();
    }
  }, []);
  
  const handleMouseDown = (e: React.MouseEvent) => {
    console.log('Capture: handleMouseDown', e.clientX, e.clientY);
    if ((e.target as HTMLElement).closest('button')) {
      console.log('Capture: handleMouseDown - clicked button, ignoring');
      return;
    }
    const x = e.clientX;
    const y = e.clientY;
    setStart({ x, y });
    setCurrent({ x, y });
    setIsSelecting(true);
    console.log(`Capture: Start selection at ${x},${y}`);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isSelecting) {
      setCurrent({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
    if (start && current) {
      const dx = Math.abs(current.x - start.x);
      const dy = Math.abs(current.y - start.y);
      console.log(`Capture: Selection delta ${dx}x${dy}`);
    }
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
      if (e.key === 'Escape') {
        console.log('Capture: ESC pressed, cancelling');
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [onCancel]);

  return (
    <div 
      className="fixed inset-0 z-[99999] cursor-crosshair overflow-hidden select-none bg-black/10 no-drag pointer-events-auto"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {!backgroundImage && (
        <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center text-center no-drag pointer-events-auto z-[99999]">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin mb-4" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400">Initializing Capture...</p>
        </div>
      )}

      {backgroundImage && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ 
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: '100vw 100vh',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'brightness(0.6)'
          }}
        />
      )}

      {/* Dimmed overlay */}
      {!rect && (
         <div className="absolute inset-0 bg-black/30 pointer-events-none" />
      )}

      <div className="absolute top-12 left-1/2 -translate-x-1/2 px-6 py-3 bg-zinc-950/90 backdrop-blur-xl border border-zinc-800 rounded-2xl text-white text-xs font-bold uppercase tracking-[0.2em] shadow-2xl flex items-center gap-4 pointer-events-none z-[100001]">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
          <Crop className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span>Desktop Region Capture</span>
          <span className="text-[10px] text-zinc-500 font-medium tracking-normal normal-case">Drag to select • ESC to cancel</span>
        </div>
      </div>

      <AnimatePresence>
        {rect && (
          <div 
            className="absolute border-2 border-indigo-500 shadow-[0_0_0_100vmax_rgba(0,0,0,0.5)] z-[100000]"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
            }}
          >
            {backgroundImage && (
              <div 
                className="absolute inset-0 bg-no-repeat pointer-events-none"
                style={{ 
                  backgroundImage: `url(${backgroundImage})`,
                  backgroundPosition: `-${rect.x}px -${rect.y}px`,
                  backgroundSize: '100vw 100vh',
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
                    console.log('Capture: triggering crop', rect);
                    handleConfirm(rect);
                  }}
                  className="px-6 py-2 bg-indigo-600 rounded-xl text-white hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/20 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
                >
                  <Check className="w-3 h-3" />
                  Confirm Capture
                </button>
              </div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
