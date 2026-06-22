import { useRef, useCallback, useEffect } from 'react';
import { useGameLoop, useCanvas } from './utils';

interface GameProps {
  onGameOver: (score: number, won?: boolean, durationSeconds?: number) => void;
}

const W = 600;
const H = 400;
const PADDLE_W = 12;
const PADDLE_H = 70;
const BALL_R = 7;
const PADDLE_MARGIN = 20;
const WIN_SCORE = 5;
const BASE_BALL_SPEED = 0.3; // px per ms
const SPEED_INCREMENT = 0.02;
const AI_SPEED = 0.28; // px per ms — beatable but challenging
const PLAYER_SPEED = 0.4;

const BG = '#0a0a1a';
const CARD_BG = '#1a1a2e';
const TEXT_COLOR = '#e2e8f0';
const ACCENT = '#a855f7';
const SUCCESS = '#22c55e';
const DANGER = '#ef4444';
const GOLD = '#fbbf24';
const LINE_COLOR = 'rgba(226, 232, 240, 0.15)';

type GameState = 'waiting' | 'playing' | 'scored' | 'over';

export default function GamePong({ onGameOver }: GameProps) {
  const { canvasRef, ctx } = useCanvas(W, H);
  const startTime = useRef(Date.now());

  const state = useRef<{
    phase: GameState;
    playerY: number;
    aiY: number;
    ballX: number;
    ballY: number;
    ballVX: number;
    ballVY: number;
    playerScore: number;
    aiScore: number;
    serveSide: 'player' | 'ai';
    ballSpeed: number;
    scoreFlashTimer: number;
  }>({
    phase: 'waiting',
    playerY: H / 2 - PADDLE_H / 2,
    aiY: H / 2 - PADDLE_H / 2,
    ballX: W / 2,
    ballY: H / 2,
    ballVX: 0,
    ballVY: 0,
    playerScore: 0,
    aiScore: 0,
    serveSide: 'player',
    ballSpeed: BASE_BALL_SPEED,
    scoreFlashTimer: 0,
  });

  const keys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
      keys.current.add(e.key);

      if (state.current.phase === 'waiting' && e.key === ' ') {
        serve();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const serve = useCallback(() => {
    const s = state.current;
    const angle = (Math.random() * 0.8 - 0.4); // -0.4 to 0.4 radians
    const dir = s.serveSide === 'player' ? 1 : -1;
    s.ballX = W / 2;
    s.ballY = H / 2;
    s.ballVX = Math.cos(angle) * s.ballSpeed * dir;
    s.ballVY = Math.sin(angle) * s.ballSpeed;
    s.phase = 'playing';
  }, []);

  const resetAfterScore = useCallback(() => {
    const s = state.current;
    s.ballX = W / 2;
    s.ballY = H / 2;
    s.ballVX = 0;
    s.ballVY = 0;
    s.ballSpeed += SPEED_INCREMENT;

    if (s.playerScore >= WIN_SCORE || s.aiScore >= WIN_SCORE) {
      s.phase = 'over';
      const won = s.playerScore >= WIN_SCORE;
      const duration = Math.floor((Date.now() - startTime.current) / 1000);
      onGameOver(s.playerScore, won, duration);
    } else {
      s.phase = 'waiting';
    }
  }, [onGameOver]);

  const update = useCallback((dt: number) => {
    const s = state.current;

    // Player paddle movement
    if (keys.current.has('ArrowUp')) {
      s.playerY = Math.max(0, s.playerY - PLAYER_SPEED * dt);
    }
    if (keys.current.has('ArrowDown')) {
      s.playerY = Math.min(H - PADDLE_H, s.playerY + PLAYER_SPEED * dt);
    }

    if (s.phase === 'scored') {
      s.scoreFlashTimer -= dt;
      if (s.scoreFlashTimer <= 0) {
        resetAfterScore();
      }
      return;
    }

    if (s.phase !== 'playing') return;

    // AI paddle movement — tracks ball center with slight delay
    const aiCenter = s.aiY + PADDLE_H / 2;
    const diff = s.ballY - aiCenter;
    const maxMove = AI_SPEED * dt;
    if (Math.abs(diff) > 5) {
      s.aiY += Math.sign(diff) * Math.min(Math.abs(diff), maxMove);
    }
    s.aiY = Math.max(0, Math.min(H - PADDLE_H, s.aiY));

    // Ball movement
    s.ballX += s.ballVX * dt;
    s.ballY += s.ballVY * dt;

    // Top/bottom wall bounce
    if (s.ballY - BALL_R <= 0) {
      s.ballY = BALL_R;
      s.ballVY = Math.abs(s.ballVY);
    }
    if (s.ballY + BALL_R >= H) {
      s.ballY = H - BALL_R;
      s.ballVY = -Math.abs(s.ballVY);
    }

    // Player paddle collision (left side)
    const pPaddleX = PADDLE_MARGIN;
    if (
      s.ballVX < 0 &&
      s.ballX - BALL_R <= pPaddleX + PADDLE_W &&
      s.ballX - BALL_R >= pPaddleX - BALL_R &&
      s.ballY >= s.playerY &&
      s.ballY <= s.playerY + PADDLE_H
    ) {
      const hitPos = (s.ballY - s.playerY) / PADDLE_H; // 0..1
      const angle = (hitPos - 0.5) * (Math.PI / 3); // -60 to 60 degrees
      s.ballVX = Math.cos(angle) * s.ballSpeed;
      s.ballVY = Math.sin(angle) * s.ballSpeed;
      s.ballX = pPaddleX + PADDLE_W + BALL_R;
    }

    // AI paddle collision (right side)
    const aiPaddleX = W - PADDLE_MARGIN - PADDLE_W;
    if (
      s.ballVX > 0 &&
      s.ballX + BALL_R >= aiPaddleX &&
      s.ballX + BALL_R <= aiPaddleX + PADDLE_W + BALL_R &&
      s.ballY >= s.aiY &&
      s.ballY <= s.aiY + PADDLE_H
    ) {
      const hitPos = (s.ballY - s.aiY) / PADDLE_H;
      const angle = (hitPos - 0.5) * (Math.PI / 3);
      s.ballVX = -Math.cos(angle) * s.ballSpeed;
      s.ballVY = Math.sin(angle) * s.ballSpeed;
      s.ballX = aiPaddleX - BALL_R;
    }

    // Scoring
    if (s.ballX < -BALL_R) {
      s.aiScore++;
      s.serveSide = 'player';
      s.phase = 'scored';
      s.scoreFlashTimer = 600;
    }
    if (s.ballX > W + BALL_R) {
      s.playerScore++;
      s.serveSide = 'ai';
      s.phase = 'scored';
      s.scoreFlashTimer = 600;
    }
  }, [resetAfterScore]);

  const draw = useCallback(() => {
    if (!ctx) return;
    const s = state.current;

    // Background
    ctx.fillStyle = CARD_BG;
    ctx.fillRect(0, 0, W, H);

    // Center line (dotted)
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Scores
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(s.playerScore), W / 2 - 60, 20);
    ctx.fillText(String(s.aiScore), W / 2 + 60, 20);

    // Player paddle
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    roundRect(ctx, PADDLE_MARGIN, s.playerY, PADDLE_W, PADDLE_H, 4);
    ctx.fill();

    // AI paddle
    ctx.fillStyle = DANGER;
    ctx.beginPath();
    roundRect(ctx, W - PADDLE_MARGIN - PADDLE_W, s.aiY, PADDLE_W, PADDLE_H, 4);
    ctx.fill();

    // Ball
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(s.ballX, s.ballY, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Waiting / scored messages
    if (s.phase === 'waiting') {
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Press SPACE to serve', W / 2, H - 30);
    }

    if (s.phase === 'scored') {
      ctx.fillStyle = GOLD;
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SCORE!', W / 2, H / 2);
    }

    if (s.phase === 'over') {
      const won = s.playerScore >= WIN_SCORE;
      ctx.fillStyle = 'rgba(10, 10, 26, 0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = won ? SUCCESS : DANGER;
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(won ? 'YOU WIN!' : 'YOU LOSE', W / 2, H / 2 - 10);
    }
  }, [ctx]);

  useGameLoop((dt) => {
    update(dt);
    draw();
  });

  return (
    <div
      style={{
        background: BG,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        minHeight: 500,
      }}
    >
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          borderRadius: 12,
          boxShadow: '0 0 30px rgba(168, 85, 247, 0.2), 0 4px 20px rgba(0, 0, 0, 0.5)',
        }}
      />
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
