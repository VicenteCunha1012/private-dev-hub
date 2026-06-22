import { useRef, useCallback, useEffect, useState } from 'react';
import { useGameLoop, useCanvas } from './utils';

interface GameProps {
  onGameOver: (score: number, won?: boolean, durationSeconds?: number) => void;
}

const W = 600;
const H = 600;
const BG = '#0a0a1a';
const ACCENT = '#a855f7';
const TEXT_COLOR = '#e2e8f0';
const DANGER = '#ef4444';
const SUCCESS = '#22c55e';
const GOLD = '#fbbf24';

const SHIP_SIZE = 14;
const TURN_SPEED = 0.005; // rad per ms
const THRUST_ACCEL = 0.0002; // px per ms^2
const FRICTION = 0.997;
const BULLET_SPEED = 0.4; // px per ms
const BULLET_MAX_DIST = W * 0.8;
const FIRE_COOLDOWN = 150; // ms
const INVINCIBLE_TIME = 2500; // ms
const ASTEROID_SPEED_BASE = 0.03;

interface Ship {
  x: number;
  y: number;
  angle: number; // radians, 0 = up
  vx: number;
  vy: number;
  thrusting: boolean;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dist: number;
}

type AsteroidSize = 'large' | 'medium' | 'small';

interface Asteroid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: AsteroidSize;
  radius: number;
  shape: number[]; // offsets for vertices
  rotation: number;
  rotSpeed: number;
}

const ASTEROID_RADII: Record<AsteroidSize, number> = { large: 40, medium: 22, small: 12 };
const ASTEROID_SCORE: Record<AsteroidSize, number> = { large: 20, medium: 50, small: 100 };
const ASTEROID_VERTICES = 10;

function wrap(x: number, y: number): [number, number] {
  return [((x % W) + W) % W, ((y % H) + H) % H];
}

function randomAsteroidShape(): number[] {
  const offsets: number[] = [];
  for (let i = 0; i < ASTEROID_VERTICES; i++) {
    offsets.push(0.7 + Math.random() * 0.6); // 0.7 to 1.3 multiplier
  }
  return offsets;
}

function spawnAsteroid(size: AsteroidSize, x?: number, y?: number): Asteroid {
  const radius = ASTEROID_RADII[size];
  const speed = ASTEROID_SPEED_BASE * (size === 'large' ? 1 : size === 'medium' ? 1.5 : 2.2);
  const angle = Math.random() * Math.PI * 2;
  const ax = x ?? Math.random() * W;
  const ay = y ?? Math.random() * H;
  return {
    x: ax,
    y: ay,
    vx: Math.cos(angle) * speed * (0.5 + Math.random()),
    vy: Math.sin(angle) * speed * (0.5 + Math.random()),
    size,
    radius,
    shape: randomAsteroidShape(),
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.003,
  };
}

function spawnWaveAsteroids(wave: number): Asteroid[] {
  const count = 3 + wave;
  const asteroids: Asteroid[] = [];
  for (let i = 0; i < count; i++) {
    // spawn away from center
    let x: number, y: number;
    do {
      x = Math.random() * W;
      y = Math.random() * H;
    } while (Math.hypot(x - W / 2, y - H / 2) < 120);
    asteroids.push(spawnAsteroid('large', x, y));
  }
  return asteroids;
}

function circleCircle(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): boolean {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy <= (r1 + r2) * (r1 + r2);
}

interface GameState {
  ship: Ship;
  bullets: Bullet[];
  asteroids: Asteroid[];
  score: number;
  lives: number;
  wave: number;
  invincibleTimer: number;
  fireCooldown: number;
  gameOver: boolean;
  startTime: number;
  particles: Particle[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

function createInitialState(): GameState {
  return {
    ship: { x: W / 2, y: H / 2, angle: -Math.PI / 2, vx: 0, vy: 0, thrusting: false },
    bullets: [],
    asteroids: spawnWaveAsteroids(0),
    score: 0,
    lives: 3,
    wave: 0,
    invincibleTimer: INVINCIBLE_TIME,
    fireCooldown: 0,
    gameOver: false,
    startTime: Date.now(),
    particles: [],
  };
}

export default function GameAsteroids({ onGameOver }: GameProps) {
  const { canvasRef, ctx } = useCanvas(W, H);
  const stateRef = useRef<GameState>(createInitialState());
  const keysRef = useRef<Set<string>>(new Set());
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);
  const [displayWave, setDisplayWave] = useState(1);
  const [gameStarted, setGameStarted] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const gameOverCalledRef = useRef(false);

  // Key handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(e.key)) {
        e.preventDefault();
      }
      keysRef.current.add(e.key);
      if (!gameStarted && !showGameOver) {
        setGameStarted(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameStarted, showGameOver]);

  const update = useCallback((dt: number) => {
    if (!ctx) return;
    const s = stateRef.current;
    const keys = keysRef.current;

    if (!s.gameOver) {
      // --- Input ---
      if (keys.has('ArrowLeft')) s.ship.angle -= TURN_SPEED * dt;
      if (keys.has('ArrowRight')) s.ship.angle += TURN_SPEED * dt;

      s.ship.thrusting = keys.has('ArrowUp');
      if (s.ship.thrusting) {
        s.ship.vx += Math.cos(s.ship.angle) * THRUST_ACCEL * dt;
        s.ship.vy += Math.sin(s.ship.angle) * THRUST_ACCEL * dt;
      }

      // Friction
      s.ship.vx *= FRICTION;
      s.ship.vy *= FRICTION;

      // Move ship
      s.ship.x += s.ship.vx * dt;
      s.ship.y += s.ship.vy * dt;
      [s.ship.x, s.ship.y] = wrap(s.ship.x, s.ship.y);

      // Shooting
      s.fireCooldown = Math.max(0, s.fireCooldown - dt);
      if (keys.has(' ') && s.fireCooldown <= 0) {
        s.bullets.push({
          x: s.ship.x + Math.cos(s.ship.angle) * SHIP_SIZE,
          y: s.ship.y + Math.sin(s.ship.angle) * SHIP_SIZE,
          vx: Math.cos(s.ship.angle) * BULLET_SPEED,
          vy: Math.sin(s.ship.angle) * BULLET_SPEED,
          dist: 0,
        });
        s.fireCooldown = FIRE_COOLDOWN;
      }

      // Move bullets
      for (const b of s.bullets) {
        const dx = b.vx * dt;
        const dy = b.vy * dt;
        b.x += dx;
        b.y += dy;
        b.dist += Math.hypot(dx, dy);
        [b.x, b.y] = wrap(b.x, b.y);
      }
      s.bullets = s.bullets.filter(b => b.dist < BULLET_MAX_DIST);

      // Move asteroids
      for (const a of s.asteroids) {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        [a.x, a.y] = wrap(a.x, a.y);
        a.rotation += a.rotSpeed * dt;
      }

      // Invincibility timer
      if (s.invincibleTimer > 0) {
        s.invincibleTimer = Math.max(0, s.invincibleTimer - dt);
      }

      // Bullet-asteroid collisions
      const newAsteroids: Asteroid[] = [];
      const bulletsToRemove = new Set<number>();
      const asteroidsToRemove = new Set<number>();

      for (let bi = 0; bi < s.bullets.length; bi++) {
        const b = s.bullets[bi];
        for (let ai = 0; ai < s.asteroids.length; ai++) {
          if (asteroidsToRemove.has(ai)) continue;
          const a = s.asteroids[ai];
          if (circleCircle(b.x, b.y, 2, a.x, a.y, a.radius)) {
            bulletsToRemove.add(bi);
            asteroidsToRemove.add(ai);
            s.score += ASTEROID_SCORE[a.size];

            // Spawn particles
            for (let p = 0; p < 6; p++) {
              const pAngle = Math.random() * Math.PI * 2;
              const pSpeed = 0.05 + Math.random() * 0.1;
              s.particles.push({
                x: a.x, y: a.y,
                vx: Math.cos(pAngle) * pSpeed,
                vy: Math.sin(pAngle) * pSpeed,
                life: 400 + Math.random() * 300,
                maxLife: 700,
                color: ACCENT,
              });
            }

            // Break asteroid
            if (a.size === 'large') {
              newAsteroids.push(spawnAsteroid('medium', a.x, a.y));
              newAsteroids.push(spawnAsteroid('medium', a.x, a.y));
            } else if (a.size === 'medium') {
              newAsteroids.push(spawnAsteroid('small', a.x, a.y));
              newAsteroids.push(spawnAsteroid('small', a.x, a.y));
            }
            break;
          }
        }
      }

      s.bullets = s.bullets.filter((_, i) => !bulletsToRemove.has(i));
      s.asteroids = s.asteroids.filter((_, i) => !asteroidsToRemove.has(i));
      s.asteroids.push(...newAsteroids);

      // Ship-asteroid collision
      if (s.invincibleTimer <= 0) {
        for (const a of s.asteroids) {
          if (circleCircle(s.ship.x, s.ship.y, SHIP_SIZE * 0.7, a.x, a.y, a.radius)) {
            s.lives--;
            // Explosion particles
            for (let p = 0; p < 12; p++) {
              const pAngle = Math.random() * Math.PI * 2;
              const pSpeed = 0.08 + Math.random() * 0.15;
              s.particles.push({
                x: s.ship.x, y: s.ship.y,
                vx: Math.cos(pAngle) * pSpeed,
                vy: Math.sin(pAngle) * pSpeed,
                life: 500 + Math.random() * 500,
                maxLife: 1000,
                color: DANGER,
              });
            }
            if (s.lives <= 0) {
              s.gameOver = true;
            } else {
              // Respawn
              s.ship.x = W / 2;
              s.ship.y = H / 2;
              s.ship.vx = 0;
              s.ship.vy = 0;
              s.ship.angle = -Math.PI / 2;
              s.invincibleTimer = INVINCIBLE_TIME;
            }
            break;
          }
        }
      }

      // New wave
      if (s.asteroids.length === 0 && !s.gameOver) {
        s.wave++;
        s.asteroids = spawnWaveAsteroids(s.wave);
      }

      // Update particles
      for (const p of s.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      s.particles = s.particles.filter(p => p.life > 0);

      // Update display state
      setDisplayScore(s.score);
      setDisplayLives(s.lives);
      setDisplayWave(s.wave + 1);
    }

    // Handle game over
    if (s.gameOver && !gameOverCalledRef.current) {
      gameOverCalledRef.current = true;
      const duration = Math.floor((Date.now() - s.startTime) / 1000);
      setShowGameOver(true);
      setTimeout(() => {
        onGameOver(s.score, false, duration);
      }, 2000);
    }

    // --- Render ---
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Draw particles
    for (const p of s.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Draw asteroids
    for (const a of s.asteroids) {
      ctx.strokeStyle = TEXT_COLOR;
      ctx.lineWidth = 1.5;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rotation);
      ctx.beginPath();
      for (let i = 0; i < ASTEROID_VERTICES; i++) {
        const angle = (i / ASTEROID_VERTICES) * Math.PI * 2;
        const r = a.radius * a.shape[i];
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // Draw ship
    if (!s.gameOver) {
      const shipVisible = s.invincibleTimer <= 0 || Math.floor(s.invincibleTimer / 100) % 2 === 0;
      if (shipVisible) {
        ctx.save();
        ctx.translate(s.ship.x, s.ship.y);
        ctx.rotate(s.ship.angle);

        // Flame when thrusting
        if (s.ship.thrusting) {
          ctx.fillStyle = GOLD;
          ctx.beginPath();
          const flicker = 0.7 + Math.random() * 0.6;
          ctx.moveTo(-SHIP_SIZE * 0.5, -SHIP_SIZE * 0.35);
          ctx.lineTo(-SHIP_SIZE * (0.8 + flicker * 0.5), 0);
          ctx.lineTo(-SHIP_SIZE * 0.5, SHIP_SIZE * 0.35);
          ctx.closePath();
          ctx.fill();
        }

        // Ship body
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(SHIP_SIZE, 0);
        ctx.lineTo(-SHIP_SIZE * 0.7, -SHIP_SIZE * 0.6);
        ctx.lineTo(-SHIP_SIZE * 0.4, 0);
        ctx.lineTo(-SHIP_SIZE * 0.7, SHIP_SIZE * 0.6);
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
      }
    }

    // Draw bullets
    ctx.fillStyle = ACCENT;
    for (const b of s.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // HUD
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${s.score}`, 15, 30);
    ctx.textAlign = 'right';
    ctx.fillText(`WAVE ${s.wave + 1}`, W - 15, 30);
    ctx.textAlign = 'center';
    // Lives as small ship icons
    for (let i = 0; i < s.lives; i++) {
      const lx = W / 2 - (s.lives - 1) * 12 + i * 24;
      const ly = 25;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(-Math.PI / 2);
      ctx.strokeStyle = SUCCESS;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-5, -4.5);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-5, 4.5);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // Start message
    if (!gameStarted && !s.gameOver) {
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PRESS ANY KEY TO START', W / 2, H / 2 + 80);
      ctx.font = '14px monospace';
      ctx.fillStyle = ACCENT;
      ctx.fillText('ARROWS: rotate & thrust  |  SPACE: fire', W / 2, H / 2 + 110);
    }

    // Game over
    if (s.gameOver) {
      ctx.fillStyle = 'rgba(10, 10, 26, 0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = DANGER;
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 20);
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = '20px monospace';
      ctx.fillText(`Final Score: ${s.score}`, W / 2, H / 2 + 20);
      ctx.fillStyle = GOLD;
      ctx.font = '16px monospace';
      ctx.fillText(`Wave ${s.wave + 1}`, W / 2, H / 2 + 50);
    }
  }, [ctx, gameStarted, onGameOver]);

  useGameLoop(update, 60);

  return (
    <div
      style={{
        background: BG,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        padding: 24,
        gap: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: W,
          color: TEXT_COLOR,
          fontFamily: 'monospace',
          fontSize: 14,
        }}
      >
        <span style={{ color: ACCENT, fontWeight: 'bold' }}>ASTEROIDS</span>
        <span>
          Score: <span style={{ color: GOLD, fontWeight: 'bold' }}>{displayScore}</span>
          {' | '}
          Lives: <span style={{ color: displayLives > 1 ? SUCCESS : DANGER, fontWeight: 'bold' }}>{displayLives}</span>
          {' | '}
          Wave: <span style={{ color: ACCENT }}>{displayWave}</span>
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        tabIndex={0}
        style={{
          borderRadius: 12,
          boxShadow: `0 0 30px ${ACCENT}33, 0 4px 20px rgba(0,0,0,0.5)`,
          outline: 'none',
          cursor: 'crosshair',
        }}
      />
    </div>
  );
}
