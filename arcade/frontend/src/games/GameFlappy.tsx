import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useGameLoop, useCanvas } from './utils';

interface GameProps {
  onGameOver: (score: number, won?: boolean, durationSeconds?: number) => void;
}

const W = 400;
const H = 600;
const BG_TOP = '#0c1445';
const BG_BOT = '#1a1a2e';
const TEXT_COLOR = '#e2e8f0';
const ACCENT = '#a855f7';
const PIPE_COLOR = '#22c55e';
const PIPE_DARK = '#16a34a';
const BIRD_COLOR = '#fbbf24';
const BIRD_DARK = '#f59e0b';
const GROUND_COLOR = '#2d1f0e';
const GROUND_H = 40;

const GRAVITY = 0.35;
const FLAP_VEL = -6.5;
const BIRD_X = 80;
const BIRD_W = 28;
const BIRD_H = 22;
const PIPE_W = 52;
const PIPE_GAP = 140;
const PIPE_SPEED = 2.5;
const PIPE_INTERVAL = 200;

interface Pipe {
  x: number;
  gapY: number;
  scored: boolean;
}

const GameFlappy: React.FC<GameProps> = ({ onGameOver }) => {
  const { canvasRef, ctx } = useCanvas(W, H);
  const startTime = useRef(0);
  const gameOver = useRef(false);

  const birdY = useRef(H / 2 - 50);
  const birdVel = useRef(0);
  const pipes = useRef<Pipe[]>([]);
  const score = useRef(0);
  const [displayScore, setDisplayScore] = useState(0);
  const frameCount = useRef(0);
  const started = useRef(false);
  const flap = useCallback(() => {
    if (gameOver.current) return;
    if (!started.current) {
      started.current = true;
      startTime.current = Date.now();
    }
    birdVel.current = FLAP_VEL;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        flap();
      }
    };
    const onClick = () => flap();
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [flap]);

  useGameLoop((dt) => {
    if (!ctx || gameOver.current) return;
    const dtFactor = dt / 16.67;

    // background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, BG_TOP);
    grad.addColorStop(1, BG_BOT);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // stars (subtle)
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (let i = 0; i < 30; i++) {
      const sx = (i * 137.5) % W;
      const sy = (i * 97.3) % (H - GROUND_H - 100);
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    if (!started.current) {
      // idle bob
      birdY.current = H / 2 - 50 + Math.sin(frameCount.current * 0.05) * 10;
      frameCount.current++;

      // draw bird
      drawBird(ctx, BIRD_X, birdY.current, 0);

      // ground
      drawGround(ctx);

      // start text
      ctx.fillStyle = 'rgba(168,85,247,0.9)';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Click or Space to start', W / 2, H / 2 + 60);
      ctx.textAlign = 'left';

      // score
      drawScore(ctx, score.current);
      return;
    }

    // physics
    birdVel.current += GRAVITY * dtFactor;
    birdY.current += birdVel.current * dtFactor;

    // spawn pipes
    frameCount.current++;
    if (frameCount.current % Math.round(PIPE_INTERVAL / dtFactor) === 0 || pipes.current.length === 0 && frameCount.current > 10) {
      const minY = 80;
      const maxY = H - GROUND_H - PIPE_GAP - 80;
      const gapY = minY + Math.random() * (maxY - minY);
      pipes.current.push({ x: W + 10, gapY, scored: false });
    }

    // move pipes
    for (const pipe of pipes.current) {
      pipe.x -= PIPE_SPEED * dtFactor;

      // scoring
      if (!pipe.scored && pipe.x + PIPE_W < BIRD_X) {
        pipe.scored = true;
        score.current++;
        setDisplayScore(score.current);
      }
    }

    // remove off-screen pipes
    pipes.current = pipes.current.filter(p => p.x + PIPE_W > -10);

    // collision detection
    const by = birdY.current;
    const bx = BIRD_X;

    // ground / ceiling
    if (by + BIRD_H / 2 > H - GROUND_H || by - BIRD_H / 2 < 0) {
      endGame();
      return;
    }

    // pipe collision
    for (const pipe of pipes.current) {
      const inXRange = bx + BIRD_W / 2 > pipe.x && bx - BIRD_W / 2 < pipe.x + PIPE_W;
      if (inXRange) {
        const aboveGap = by - BIRD_H / 2 < pipe.gapY;
        const belowGap = by + BIRD_H / 2 > pipe.gapY + PIPE_GAP;
        if (aboveGap || belowGap) {
          endGame();
          return;
        }
      }
    }

    // draw pipes
    for (const pipe of pipes.current) {
      drawPipe(ctx, pipe);
    }

    // draw ground
    drawGround(ctx);

    // draw bird
    const rotation = Math.max(-0.4, Math.min(0.6, birdVel.current * 0.08));
    drawBird(ctx, bx, by, rotation);

    // score display
    drawScore(ctx, score.current);
  });

  function endGame() {
    if (gameOver.current) return;
    gameOver.current = true;
    const duration = startTime.current ? (Date.now() - startTime.current) / 1000 : 0;
    onGameOver(score.current, false, duration);
  }

  function drawBird(c: CanvasRenderingContext2D, x: number, y: number, rot: number) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);

    // body
    c.fillStyle = BIRD_COLOR;
    c.shadowColor = BIRD_COLOR;
    c.shadowBlur = 8;
    c.beginPath();
    c.ellipse(0, 0, BIRD_W / 2, BIRD_H / 2, 0, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;

    // wing
    c.fillStyle = BIRD_DARK;
    c.beginPath();
    c.ellipse(-4, 2, 8, 5, -0.3, 0, Math.PI * 2);
    c.fill();

    // eye
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(8, -4, 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#000';
    c.beginPath();
    c.arc(9, -4, 2, 0, Math.PI * 2);
    c.fill();

    // beak
    c.fillStyle = '#ef4444';
    c.beginPath();
    c.moveTo(BIRD_W / 2 - 2, -1);
    c.lineTo(BIRD_W / 2 + 6, 1);
    c.lineTo(BIRD_W / 2 - 2, 4);
    c.closePath();
    c.fill();

    c.restore();
  }

  function drawPipe(c: CanvasRenderingContext2D, pipe: Pipe) {
    const capH = 20;
    const capExtra = 4;

    // top pipe
    c.fillStyle = PIPE_COLOR;
    c.fillRect(pipe.x, 0, PIPE_W, pipe.gapY);
    c.fillStyle = PIPE_DARK;
    c.fillRect(pipe.x + 4, 0, 6, pipe.gapY);
    // top cap
    c.fillStyle = PIPE_COLOR;
    c.beginPath();
    c.roundRect(pipe.x - capExtra, pipe.gapY - capH, PIPE_W + capExtra * 2, capH, 4);
    c.fill();

    // bottom pipe
    const botY = pipe.gapY + PIPE_GAP;
    c.fillStyle = PIPE_COLOR;
    c.fillRect(pipe.x, botY, PIPE_W, H - GROUND_H - botY);
    c.fillStyle = PIPE_DARK;
    c.fillRect(pipe.x + 4, botY, 6, H - GROUND_H - botY);
    // bottom cap
    c.fillStyle = PIPE_COLOR;
    c.beginPath();
    c.roundRect(pipe.x - capExtra, botY, PIPE_W + capExtra * 2, capH, 4);
    c.fill();
  }

  function drawGround(c: CanvasRenderingContext2D) {
    c.fillStyle = GROUND_COLOR;
    c.fillRect(0, H - GROUND_H, W, GROUND_H);
    c.fillStyle = '#3d2f1e';
    c.fillRect(0, H - GROUND_H, W, 4);
  }

  function drawScore(c: CanvasRenderingContext2D, s: number) {
    c.fillStyle = TEXT_COLOR;
    c.font = 'bold 32px monospace';
    c.textAlign = 'center';
    c.shadowColor = 'rgba(0,0,0,0.5)';
    c.shadowBlur = 6;
    c.fillText(String(s), W / 2, 40);
    c.shadowBlur = 0;
    c.textAlign = 'left';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{
        color: TEXT_COLOR, fontFamily: 'monospace', fontSize: 13,
      }}>
        Score: <span style={{ color: ACCENT, fontWeight: 'bold' }}>{displayScore}</span>
        <span style={{ marginLeft: 16, color: '#94a3b8', fontSize: 11 }}>Space / Click to flap</span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ borderRadius: 8, border: `1px solid #1a1a2e`, cursor: 'pointer' }}
      />
    </div>
  );
};

export default GameFlappy;
