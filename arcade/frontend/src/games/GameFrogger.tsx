import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useGameLoop, useCanvas } from './utils';

interface GameProps {
  onGameOver: (score: number, won?: boolean, durationSeconds?: number) => void;
}

const COLS = 13;
const ROWS = 13;
const CELL = 36;
const W = COLS * CELL;           // 468 -> ~400ish
const H = ROWS * CELL;           // 468 -> ~500ish
const BG = '#0a0a1a';
const CARD_BG = '#1a1a2e';
const TEXT_COLOR = '#e2e8f0';
const ACCENT = '#a855f7';
const SUCCESS = '#22c55e';
const DANGER = '#ef4444';

// Row layout (0 = top, 12 = bottom):
// 0        = goal (safe)
// 1-5      = car lanes
// 6        = median (safe)
// 7-11     = car lanes
// 12       = start (safe)

const SAFE_ROWS = new Set([0, 6, 12]);

interface Car {
  x: number;       // pixel x position
  width: number;   // pixel width
  speed: number;   // pixels per second (negative = moving left)
  color: string;
}

interface LaneConfig {
  row: number;
  speed: number;       // px/s, positive = right, negative = left
  carWidth: number;
  carCount: number;
  color: string;
}

const LANE_CONFIGS: LaneConfig[] = [
  { row: 1,  speed: -60,  carWidth: 60, carCount: 3, color: '#ef4444' },
  { row: 2,  speed: 80,   carWidth: 50, carCount: 3, color: '#3b82f6' },
  { row: 3,  speed: -100, carWidth: 70, carCount: 2, color: '#f59e0b' },
  { row: 4,  speed: 55,   carWidth: 55, carCount: 3, color: '#ec4899' },
  { row: 5,  speed: -120, carWidth: 45, carCount: 4, color: '#06b6d4' },
  { row: 7,  speed: 70,   carWidth: 65, carCount: 3, color: '#8b5cf6' },
  { row: 8,  speed: -90,  carWidth: 50, carCount: 3, color: '#f97316' },
  { row: 9,  speed: 110,  carWidth: 40, carCount: 4, color: '#14b8a6' },
  { row: 10, speed: -65,  carWidth: 70, carCount: 2, color: '#e879f9' },
  { row: 11, speed: 95,   carWidth: 55, carCount: 3, color: '#fb7185' },
];

function initCars(): Map<number, Car[]> {
  const lanes = new Map<number, Car[]>();
  for (const cfg of LANE_CONFIGS) {
    const cars: Car[] = [];
    const spacing = W / cfg.carCount;
    for (let i = 0; i < cfg.carCount; i++) {
      cars.push({
        x: i * spacing,
        width: cfg.carWidth,
        speed: cfg.speed,
        color: cfg.color,
      });
    }
    lanes.set(cfg.row, cars);
  }
  return lanes;
}

const GameFrogger: React.FC<GameProps> = ({ onGameOver }) => {
  const { canvasRef, ctx } = useCanvas(W, H);
  const startTime = useRef(Date.now());
  const gameOver = useRef(false);

  // Mutable game state in refs
  const frogCol = useRef(Math.floor(COLS / 2));
  const frogRow = useRef(ROWS - 1);
  const lives = useRef(3);
  const score = useRef(0);
  const crossings = useRef(0);
  const lanes = useRef<Map<number, Car[]>>(initCars());
  const deathFlash = useRef(0); // countdown ms for death animation

  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);

  // Keyboard input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (gameOver.current) return;
      if (deathFlash.current > 0) return;

      let col = frogCol.current;
      let row = frogRow.current;

      switch (e.key) {
        case 'ArrowUp':    row = Math.max(0, row - 1); break;
        case 'ArrowDown':  row = Math.min(ROWS - 1, row + 1); break;
        case 'ArrowLeft':  col = Math.max(0, col - 1); break;
        case 'ArrowRight': col = Math.min(COLS - 1, col + 1); break;
        default: return;
      }
      e.preventDefault();
      frogCol.current = col;
      frogRow.current = row;

      // Reached the goal row
      if (row === 0) {
        crossings.current += 1;
        score.current = crossings.current * 100;
        setDisplayScore(score.current);
        // Reset frog to start
        frogCol.current = Math.floor(COLS / 2);
        frogRow.current = ROWS - 1;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const die = useCallback(() => {
    lives.current -= 1;
    setDisplayLives(lives.current);
    if (lives.current <= 0) {
      gameOver.current = true;
      const duration = (Date.now() - startTime.current) / 1000;
      onGameOver(score.current, false, duration);
    } else {
      deathFlash.current = 500;
      frogCol.current = Math.floor(COLS / 2);
      frogRow.current = ROWS - 1;
    }
  }, [onGameOver]);

  const checkCollision = useCallback(() => {
    const row = frogRow.current;
    if (SAFE_ROWS.has(row)) return false;

    const cars = lanes.current.get(row);
    if (!cars) return false;

    const frogX = frogCol.current * CELL + 4;
    const frogY = row * CELL + 4;
    const frogW = CELL - 8;
    const frogH = CELL - 8;

    for (const car of cars) {
      const carY = row * CELL + 4;
      const carH = CELL - 8;
      // Check wrapped positions
      if (
        frogX < car.x + car.width &&
        frogX + frogW > car.x &&
        frogY < carY + carH &&
        frogY + frogH > carY
      ) {
        return true;
      }
      // Wrapped copy
      const wrappedX = car.speed > 0 ? car.x - W - car.width : car.x + W + car.width;
      if (
        frogX < wrappedX + car.width &&
        frogX + frogW > wrappedX &&
        frogY < carY + carH &&
        frogY + frogH > carY
      ) {
        return true;
      }
    }
    return false;
  }, []);

  const draw = useCallback(() => {
    if (!ctx) return;

    // Background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Draw safe zones
    for (const safeRow of [0, 6, 12]) {
      ctx.fillStyle = safeRow === 0 ? '#0f2a1a' : safeRow === 6 ? '#1a1a2e' : '#0f1a2a';
      ctx.fillRect(0, safeRow * CELL, W, CELL);
    }

    // Goal zone label
    ctx.fillStyle = SUCCESS;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GOAL', W / 2, 0 * CELL + CELL / 2 + 4);

    // Draw road lanes
    for (const cfg of LANE_CONFIGS) {
      const y = cfg.row * CELL;
      ctx.fillStyle = '#111122';
      ctx.fillRect(0, y, W, CELL);

      // Lane markings (dashed center lines)
      ctx.strokeStyle = '#333355';
      ctx.lineWidth = 1;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Median label
    ctx.fillStyle = '#555580';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SAFE ZONE', W / 2, 6 * CELL + CELL / 2 + 3);

    // Draw cars
    for (const [row, cars] of lanes.current) {
      const y = row * CELL + 5;
      const h = CELL - 10;
      for (const car of cars) {
        // Main car
        ctx.fillStyle = car.color;
        ctx.shadowColor = car.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.roundRect(car.x, y, car.width, h, 4);
        ctx.fill();

        // Windshield
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        const windX = car.speed > 0 ? car.x + car.width - 12 : car.x + 4;
        ctx.fillRect(windX, y + 3, 8, h - 6);
      }
    }
    ctx.shadowBlur = 0;

    // Draw frog
    if (deathFlash.current <= 0 || Math.floor(deathFlash.current / 80) % 2 === 0) {
      const fx = frogCol.current * CELL;
      const fy = frogRow.current * CELL;

      // Frog body
      ctx.fillStyle = SUCCESS;
      ctx.shadowColor = SUCCESS;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(fx + 4, fy + 4, CELL - 8, CELL - 8, 6);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(fx + 12, fy + 12, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(fx + CELL - 12, fy + 12, 3, 0, Math.PI * 2);
      ctx.fill();

      // Pupils
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(fx + 12, fy + 12, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(fx + CELL - 12, fy + 12, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [ctx]);

  useGameLoop((dt) => {
    if (!ctx) return;
    if (gameOver.current) {
      draw();
      return;
    }

    // Death flash countdown
    if (deathFlash.current > 0) {
      deathFlash.current = Math.max(0, deathFlash.current - dt);
      draw();
      return;
    }

    // Update car positions
    for (const [, cars] of lanes.current) {
      for (const car of cars) {
        car.x += car.speed * (dt / 1000);

        // Wrap around
        if (car.speed > 0 && car.x > W) {
          car.x = -car.width;
        } else if (car.speed < 0 && car.x + car.width < 0) {
          car.x = W;
        }
      }
    }

    // Check collision
    if (checkCollision()) {
      die();
    }

    draw();
  });

  return (
    <div style={{
      background: BG,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
      gap: 12,
      padding: 20,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: W,
        color: TEXT_COLOR,
        fontFamily: 'monospace',
        fontSize: 14,
      }}>
        <span>
          Score: <span style={{ color: ACCENT, fontWeight: 'bold' }}>{displayScore}</span>
        </span>
        <span>
          Lives:{' '}
          {Array.from({ length: displayLives }).map((_, i) => (
            <span key={i} style={{ color: DANGER, marginLeft: 2 }}>&#9829;</span>
          ))}
        </span>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>Arrow keys</span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          borderRadius: 10,
          boxShadow: `0 0 24px rgba(168, 85, 247, 0.15), 0 4px 16px rgba(0,0,0,0.5)`,
          border: `1px solid ${CARD_BG}`,
        }}
      />
    </div>
  );
};

export default GameFrogger;
