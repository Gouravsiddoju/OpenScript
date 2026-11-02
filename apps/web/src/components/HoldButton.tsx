import React, { useState, useRef, useCallback, useEffect } from 'react';

export interface HoldButtonProps {
  onHold: () => void;
  holdTime?: number; // Duration in ms to trigger (default 1000ms)
  releaseTime?: number; // Duration in ms to snap back (default 200ms)
  color?: string; // Fill color (default red: #ef4444)
  className?: string;
  fillDirection?: 'right' | 'up';
  title?: string;
  disabled?: boolean;
  children: React.ReactNode;
}

/**
 * HoldButton — React Micro Interaction inspired by React Bits (reactbits.dev/micro/hold-button)
 * Smooth 60fps liquid progress fill with charging glow edge.
 * Snaps back smoothly if released early; triggers onHold when held to 100%.
 */
export const HoldButton: React.FC<HoldButtonProps> = ({
  onHold,
  holdTime = 1000,
  releaseTime = 200,
  color = '#ef4444',
  className = '',
  fillDirection = 'right',
  title = 'Press and hold to confirm',
  disabled = false,
  children,
}) => {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const frameIdRef = useRef<number | null>(null);

  const animate = useCallback((timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsed = timestamp - startTimeRef.current;
    const currentProgress = Math.min(elapsed / holdTime, 1);

    setProgress(currentProgress);

    if (currentProgress < 1) {
      frameIdRef.current = requestAnimationFrame(animate);
    } else {
      setIsCompleted(true);
      onHold();
      setTimeout(() => {
        setIsHolding(false);
        setIsCompleted(false);
        setProgress(0);
      }, 300);
    }
  }, [holdTime, onHold]);

  const startHolding = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (disabled || isCompleted) return;
    setIsHolding(true);
    startTimeRef.current = null;
    frameIdRef.current = requestAnimationFrame(animate);
  };

  const cancelHolding = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (isCompleted) return;
    setIsHolding(false);
    if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
    startTimeRef.current = null;
    setProgress(0);
  };

  useEffect(() => {
    return () => {
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
    };
  }, []);

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={startHolding}
      onMouseUp={cancelHolding}
      onMouseLeave={cancelHolding}
      onTouchStart={startHolding}
      onTouchEnd={cancelHolding}
      className={`relative overflow-hidden select-none transition-transform active:scale-95 duration-100 ${className} ${
        isHolding ? 'ring-1 ring-red-500/50 shadow-lg shadow-red-500/20' : ''
      }`}
    >
      {/* Liquid / Progress Fill Layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundColor: color,
          opacity: 0.28,
          width: fillDirection === 'right' ? `${progress * 100}%` : '100%',
          height: fillDirection === 'up' ? `${progress * 100}%` : '100%',
          bottom: 0,
          left: 0,
          transition: isHolding ? 'none' : `all ${releaseTime}ms ease-out`,
        }}
      />
      
      {/* Glowing progress line at the leading edge */}
      {isHolding && progress > 0 && progress < 1 && (
        <div
          className="absolute pointer-events-none bg-red-400 shadow-[0_0_8px_#ef4444]"
          style={
            fillDirection === 'right'
              ? {
                  top: 0,
                  bottom: 0,
                  left: `${progress * 100}%`,
                  width: '2px',
                }
              : {
                  left: 0,
                  right: 0,
                  bottom: `${progress * 100}%`,
                  height: '2px',
                }
          }
        />
      )}

      {/* Button Content */}
      <span className="relative z-10 flex items-center justify-center gap-1.5 pointer-events-none">
        {children}
      </span>
    </button>
  );
};
