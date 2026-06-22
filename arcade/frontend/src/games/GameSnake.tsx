import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useGameLoop, useCanvas } from './utils';

interface GameProps {
  onGameOver: (score: number, won?: boolean, durationSeconds?: number) => void;
}

const GRID = 20;
const CELL = 20;
const W = GRID * CELL;
const H = GRID * CELL;
const BG = '#0a0a1a';
const GRID_LINE = '#1a1a2e';
const SNAKE_COLOR = '#22c55e';
const SNAKE_HEAD = '#16a34a';
const FOOD_COLOR = '#ef4444';
const TEXT_COLOR = '#e2e8f0';
const ACCENT = '#a855f7';

type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Pt = { x: number; y: number };

const opposite: Record<Dir, Dir> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };

function randomFood(snake: Pt[]): Pt {
  const occupied = new Set(snake.map(p => `${p.x},${p.y}`));
  let pt: Pt;
  do {
    pt = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (occupied.has(`${pt.x},${pt.y}`));
  return pt;
}

const GameSnake: React.FC<GameProps> = ({ onGameOver }) => {
  const { canvasRef, ctx } = useCanvas(W, H);
  const startTime = useRef(Date.now());
  const gameOver = useRef(false);

  const snake = useRef<Pt[]>([
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]);
  const dir = useRef<Dir>('RIGHT');
  const nextDir = useRef<Dir>('RIGHT');
  const food = useRef<Pt>(randomFood(snake.current));
  const score = useRef(0);
  const [displayScore, setDisplayScore] = useState(0);
  const tickAccum = useRef(0);

  const getTickInterval = useCallback(() => {
    const len = snake.current.length;
    return Math.max(60, 150 - (len - 3) * 3);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
        w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT',
      };
      const nd = map[e.key];
      if (nd && nd !== opposite[dir.current]) {
        e.preventDefault();
        nextDir.current = nd;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const draw = useCallback(() => {
    if (!ctx) return;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // grid lines
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(W, i * CELL);
      ctx.stroke();
    }

    // food
    const f = food.current;
    ctx.fillStyle = FOOD_COLOR;
    ctx.shadowColor = FOOD_COLOR;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // snake
    snake.current.forEach((seg, i) => {
      const isHead = i === 0;
      ctx.fillStyle = isHead ? SNAKE_HEAD : SNAKE_COLOR;
      ctx.shadowColor = isHead ? SNAKE_HEAD : SNAKE_COLOR;
      ctx.shadowBlur = isHead ? 10 : 4;
      const r = 3;
      const x = seg.x * CELL + 1;
      const y = seg.y * CELL + 1;
      const s = CELL - 2;
      ctx.beginPath();
      ctx.roundRect(x, y, s, s, r);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }, [ctx]);

  useGameLoop((dt) => {
    if (gameOver.current || !ctx) return;

    tickAccum.current += dt;
    const interval = getTickInterval();

    if (tickAccum.current < interval) {
      draw();
      return;
    }
    tickAccum.current -= interval;

    dir.current = nextDir.current;

    const head = snake.current[0];
    const deltas: Record<Dir, Pt> = {
      UP: { x: 0, y: -1 }, DOWN: { x: 0, y: 1 },
      LEFT: { x: -1, y: 0 }, RIGHT: { x: 1, y: 0 },
    };
    const d = deltas[dir.current];
    const newHead = { x: head.x + d.x, y: head.y + d.y };

    // wall collision
    if (newHead.x < 0 || newHead.x >= GRID || newHead.y < 0 || newHead.y >= GRID) {
      gameOver.current = true;
      const duration = (Date.now() - startTime.current) / 1000;
      onGameOver(score.current, false, duration);
      return;
    }

    // self collision
    if (snake.current.some(s => s.x === newHead.x && s.y === newHead.y)) {
      gameOver.current = true;
      const duration = (Date.now() - startTime.current) / 1000;
      onGameOver(score.current, false, duration);
      return;
    }

    snake.current = [newHead, ...snake.current];

    // eat food
    if (newHead.x === food.current.x && newHead.y === food.current.y) {
      score.current += 10;
      setDisplayScore(score.current);
      food.current = randomFood(snake.current);
    } else {
      snake.current.pop();
    }

    // win condition: filled the board
    if (snake.current.length >= GRID * GRID) {
      gameOver.current = true;
      const duration = (Date.now() - startTime.current) / 1000;
      onGameOver(score.current, true, duration);
      return;
    }

    draw();
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', width: W,
        color: TEXT_COLOR, fontFamily: 'monospace', fontSize: 14,
      }}>
        <span>Score: <span style={{ color: ACCENT, fontWeight: 'bold' }}>{displayScore}</span></span>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>Arrow keys to move</span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ borderRadius: 8, border: `1px solid ${GRID_LINE}` }}
      />
    </div>
  );
};

export default GameSnake;
