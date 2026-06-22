import { useRef, useEffect, useState } from 'react';

export function useGameLoop(callback: (dt: number) => void, fps?: number) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let frameId: number;
    let lastTime = performance.now();
    const interval = fps ? 1000 / fps : 0;
    let accumulated = 0;

    const loop = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;

      if (fps) {
        accumulated += dt;
        while (accumulated >= interval) {
          callbackRef.current(interval);
          accumulated -= interval;
        }
      } else {
        callbackRef.current(dt);
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [fps]);
}

export function useCanvas(width: number, height: number) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      const context = canvasRef.current.getContext('2d');
      setCtx(context);
    }
  }, [width, height]);

  return { canvasRef, ctx };
}

export function circleRect(
  cx: number, cy: number, cr: number,
  rx: number, ry: number, rw: number, rh: number
): boolean {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx * dx + dy * dy) <= (cr * cr);
}

export function rectRect(
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number
): boolean {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

export function circleCircle(
  x1: number, y1: number, r1: number,
  x2: number, y2: number, r2: number
): boolean {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return (dx * dx + dy * dy) <= ((r1 + r2) * (r1 + r2));
}

const BRIGHT_COLORS = [
  '#a855f7', '#ec4899', '#22c55e', '#3b82f6', '#f59e0b',
  '#ef4444', '#06b6d4', '#8b5cf6', '#f97316', '#14b8a6',
  '#e879f9', '#fbbf24', '#34d399', '#60a5fa', '#fb7185',
];

export function randomColor(): string {
  return BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)];
}

const EMOJI_LIST = [
  '🎮', '🚀', '🌟', '🎯', '🔥', '💎', '🎪', '🦄',
  '🍕', '🎸', '🌈', '🐉', '👾', '🎲', '🧩', '🪐',
  '🦋', '🍭', '⚡', '🎵',
];

export function randomEmoji(): string {
  return EMOJI_LIST[Math.floor(Math.random() * EMOJI_LIST.length)];
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
