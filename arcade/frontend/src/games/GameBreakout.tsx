import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useGameLoop, useCanvas, circleRect } from './utils';

interface GameProps {
  onGameOver: (score: number, won?: boolean, durationSeconds?: number) => void;
}

const W = 600;
const H = 500;
const BG = '#0a0a1a';
const CARD_BG = '#1a1a2e';
const TEXT_COLOR = '#e2e8f0';
const ACCENT = '#a855f7';
const DANGER = '#ef4444';
const SUCCESS = '#22c55e';

const PADDLE_W = 90;
const PADDLE_H = 14;
const PADDLE_Y = H - 40;

const BALL_R = 6;
const BALL_SPEED_INIT = 4;
const BALL_SPEED_INC = 0.0002;

const BRICK_ROWS = 5;
const BRICK_COLS = 8;
const BRICK_W = (W - 40) / BRICK_COLS;
const BRICK_H = 22;
const BRICK_GAP = 3;
const BRICK_TOP = 50;

const ROW_COLORS = ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#3b82f6'];

interface Brick {
  x: number;
  y: number;
  alive: boolean;
  color: string;
}

function createBricks(): Brick[] {
  const bricks: Brick[] = [];
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      bricks.push({
        x: 20 + c * (BRICK_W + BRICK_GAP),
        y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
        alive: true,
        color: ROW_COLORS[r],
      });
    }
  }
  return bricks;
}

const GameBreakout: React.FC<GameProps> = ({ onGameOver }) => {
  const { canvasRef, ctx } = useCanvas(W, H);
  const startTime = useRef(Date.now());
  const gameOver = useRef(false);

  const paddleX = useRef(W / 2 - PADDLE_W / 2);
  const ball = useRef({ x: W / 2, y: PADDLE_Y - BALL_R - 2, vx: 3, vy: -3 });
  const bricks = useRef(createBricks());
  const lives = useRef(3);
  const score = useRef(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);
  const speed = useRef(BALL_SPEED_INIT);
  const launched = useRef(false);
  const keysDown = useRef(new Set<string>());

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      paddleX.current = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2));
    };
    const onClick = () => {
      if (!launched.current) {
        launched.current = true;
        const angle = -Math.PI / 4 - Math.random() * Math.PI / 2;
        ball.current.vx = Math.cos(angle) * speed.current;
        ball.current.vy = Math.sin(angle) * speed.current;
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        keysDown.current.add(e.key);
      }
      if (e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.current.delete(e.key);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [canvasRef]);

  const resetBall = useCallback(() => {
    ball.current = {
      x: paddleX.current + PADDLE_W / 2,
      y: PADDLE_Y - BALL_R - 2,
      vx: 0, vy: 0,
    };
    launched.current = false;
  }, []);

  useGameLoop((dt) => {
    if (!ctx || gameOver.current) return;
    const dtFactor = dt / 16.67;

    // keyboard paddle movement
    if (keysDown.current.has('ArrowLeft')) {
      paddleX.current = Math.max(0, paddleX.current - 6 * dtFactor);
    }
    if (keysDown.current.has('ArrowRight')) {
      paddleX.current = Math.min(W - PADDLE_W, paddleX.current + 6 * dtFactor);
    }

    const b = ball.current;

    if (!launched.current) {
      b.x = paddleX.current + PADDLE_W / 2;
      b.y = PADDLE_Y - BALL_R - 2;
    } else {
      speed.current += BALL_SPEED_INC * dtFactor;

      b.x += b.vx * dtFactor;
      b.y += b.vy * dtFactor;

      // wall bounce
      if (b.x - BALL_R < 0) { b.x = BALL_R; b.vx = Math.abs(b.vx); }
      if (b.x + BALL_R > W) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); }
      if (b.y - BALL_R < 0) { b.y = BALL_R; b.vy = Math.abs(b.vy); }

      // bottom - lose life
      if (b.y + BALL_R > H) {
        lives.current--;
        setDisplayLives(lives.current);
        if (lives.current <= 0) {
          gameOver.current = true;
          const duration = (Date.now() - startTime.current) / 1000;
          onGameOver(score.current, false, duration);
          return;
        }
        resetBall();
      }

      // paddle bounce
      if (circleRect(b.x, b.y, BALL_R, paddleX.current, PADDLE_Y, PADDLE_W, PADDLE_H) && b.vy > 0) {
        const hitPos = (b.x - paddleX.current) / PADDLE_W;
        const angle = -Math.PI / 6 - hitPos * (Math.PI * 2 / 3);
        const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        b.vx = Math.cos(angle) * spd;
        b.vy = Math.sin(angle) * spd;
        b.y = PADDLE_Y - BALL_R;
      }

      // brick collision
      for (const brick of bricks.current) {
        if (!brick.alive) continue;
        if (circleRect(b.x, b.y, BALL_R, brick.x, brick.y, BRICK_W, BRICK_H)) {
          brick.alive = false;
          score.current += 10;
          setDisplayScore(score.current);

          // determine bounce direction
          const cx = b.x - (brick.x + BRICK_W / 2);
          const cy = b.y - (brick.y + BRICK_H / 2);
          if (Math.abs(cx / BRICK_W) > Math.abs(cy / BRICK_H)) {
            b.vx = -b.vx;
          } else {
            b.vy = -b.vy;
          }
          break;
        }
      }

      // check win
      if (bricks.current.every(br => !br.alive)) {
        gameOver.current = true;
        const duration = (Date.now() - startTime.current) / 1000;
        onGameOver(score.current, true, duration);
        return;
      }
    }

    // draw
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // bricks
    for (const brick of bricks.current) {
      if (!brick.alive) continue;
      ctx.fillStyle = brick.color;
      ctx.shadowColor = brick.color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.roundRect(brick.x, brick.y, BRICK_W - BRICK_GAP, BRICK_H, 3);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // paddle
    ctx.fillStyle = ACCENT;
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(paddleX.current, PADDLE_Y, PADDLE_W, PADDLE_H, 7);
    ctx.fill();
    ctx.shadowBlur = 0;

    // ball
    ctx.fillStyle = TEXT_COLOR;
    ctx.shadowColor = TEXT_COLOR;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // HUD
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score.current}`, 10, 20);
    ctx.textAlign = 'right';
    ctx.fillText(`Lives: ${'♥'.repeat(lives.current)}`, W - 10, 20);
    ctx.textAlign = 'left';

    if (!launched.current) {
      ctx.fillStyle = 'rgba(168,85,247,0.8)';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Click or press Space to launch', W / 2, H / 2);
      ctx.textAlign = 'left';
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', width: W,
        color: TEXT_COLOR, fontFamily: 'monospace', fontSize: 13,
      }}>
        <span>Score: <span style={{ color: ACCENT, fontWeight: 'bold' }}>{displayScore}</span></span>
        <span>Lives: <span style={{ color: displayLives <= 1 ? DANGER : SUCCESS }}>{displayLives}</span></span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ borderRadius: 8, border: `1px solid ${CARD_BG}`, cursor: 'none' }}
      />
    </div>
  );
};

export default GameBreakout;
