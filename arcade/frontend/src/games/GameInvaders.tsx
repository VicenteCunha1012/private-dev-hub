import React, { useRef, useCallback, useEffect } from 'react';
import { useGameLoop, useCanvas, rectRect } from './utils';

interface GameProps {
  onGameOver: (score: number, won?: boolean, durationSeconds?: number) => void;
}

const W = 500;
const H = 600;
const BG = '#0a0a1a';
const CARD_BG = '#1a1a2e';
const ACCENT = '#a855f7';
const TEXT_COLOR = '#e2e8f0';
const SUCCESS = '#22c55e';
const DANGER = '#ef4444';
const GOLD = '#fbbf24';

const COLS = 8;
const ROWS = 5;
const ALIEN_W = 30;
const ALIEN_H = 22;
const ALIEN_PAD_X = 14;
const ALIEN_PAD_Y = 12;
const ALIEN_START_X = 30;
const ALIEN_START_Y = 60;

const PLAYER_W = 36;
const PLAYER_H = 20;
const PLAYER_SPEED = 0.28;
const PLAYER_Y = H - 50;

const BULLET_W = 3;
const BULLET_H = 10;
const BULLET_SPEED = 0.45;

const ALIEN_BULLET_W = 3;
const ALIEN_BULLET_H = 12;
const ALIEN_BULLET_SPEED = 0.18;
const ALIEN_FIRE_INTERVAL = 1200;

const SHIELD_COUNT = 4;
const SHIELD_BLOCK = 4;
const SHIELD_COLS = 12;
const SHIELD_ROWS = 8;
const SHIELD_Y = H - 120;

const ROW_SCORES = [50, 40, 30, 20, 10];

interface Alien {
  row: number;
  col: number;
  alive: boolean;
}

interface Bullet {
  x: number;
  y: number;
  active: boolean;
}

interface AlienBullet {
  x: number;
  y: number;
  active: boolean;
}

interface ShieldBlock {
  x: number;
  y: number;
  alive: boolean;
}

interface GameState {
  playerX: number;
  lives: number;
  score: number;
  aliens: Alien[];
  alienOffsetX: number;
  alienOffsetY: number;
  alienDir: number;
  alienSpeed: number;
  bullet: Bullet;
  alienBullets: AlienBullet[];
  alienFireTimer: number;
  shields: ShieldBlock[][];
  gameOver: boolean;
  won: boolean;
  started: boolean;
  keys: Set<string>;
}

function createAliens(): Alien[] {
  const aliens: Alien[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      aliens.push({ row: r, col: c, alive: true });
    }
  }
  return aliens;
}

function createShields(): ShieldBlock[][] {
  const allShields: ShieldBlock[][] = [];
  const totalWidth = SHIELD_COUNT * SHIELD_COLS * SHIELD_BLOCK + (SHIELD_COUNT - 1) * 40;
  const startX = (W - totalWidth) / 2;

  for (let s = 0; s < SHIELD_COUNT; s++) {
    const blocks: ShieldBlock[] = [];
    const sx = startX + s * (SHIELD_COLS * SHIELD_BLOCK + 40);
    for (let r = 0; r < SHIELD_ROWS; r++) {
      for (let c = 0; c < SHIELD_COLS; c++) {
        const inNotch =
          r >= SHIELD_ROWS - 3 && c >= 3 && c < SHIELD_COLS - 3;
        const topCorner =
          (r === 0 && (c < 2 || c >= SHIELD_COLS - 2)) ||
          (r === 1 && (c < 1 || c >= SHIELD_COLS - 1));
        if (!inNotch && !topCorner) {
          blocks.push({
            x: sx + c * SHIELD_BLOCK,
            y: SHIELD_Y + r * SHIELD_BLOCK,
            alive: true,
          });
        }
      }
    }
    allShields.push(blocks);
  }
  return allShields;
}

function initState(): GameState {
  return {
    playerX: W / 2 - PLAYER_W / 2,
    lives: 3,
    score: 0,
    aliens: createAliens(),
    alienOffsetX: 0,
    alienOffsetY: 0,
    alienDir: 1,
    alienSpeed: 0.03,
    bullet: { x: 0, y: 0, active: false },
    alienBullets: [],
    alienFireTimer: 0,
    shields: createShields(),
    gameOver: false,
    won: false,
    started: false,
    keys: new Set(),
  };
}

function getAlienPos(a: Alien, offsetX: number, offsetY: number) {
  return {
    x: ALIEN_START_X + a.col * (ALIEN_W + ALIEN_PAD_X) + offsetX,
    y: ALIEN_START_Y + a.row * (ALIEN_H + ALIEN_PAD_Y) + offsetY,
  };
}

function drawAlien(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  row: number
) {
  const colors = [DANGER, GOLD, GOLD, SUCCESS, SUCCESS];
  ctx.fillStyle = colors[row] || ACCENT;

  if (row === 0) {
    // Top row: octopus-like
    ctx.fillRect(x + 10, y, 10, 4);
    ctx.fillRect(x + 6, y + 4, 18, 4);
    ctx.fillRect(x + 2, y + 8, 26, 4);
    ctx.fillRect(x + 2, y + 12, 4, 4);
    ctx.fillRect(x + 10, y + 12, 10, 4);
    ctx.fillRect(x + 24, y + 12, 4, 4);
    ctx.fillRect(x + 4, y + 16, 6, 4);
    ctx.fillRect(x + 20, y + 16, 6, 4);
    // Eyes
    ctx.fillStyle = BG;
    ctx.fillRect(x + 8, y + 8, 4, 4);
    ctx.fillRect(x + 18, y + 8, 4, 4);
  } else if (row <= 2) {
    // Middle rows: crab-like
    ctx.fillRect(x + 8, y, 14, 4);
    ctx.fillRect(x + 4, y + 4, 22, 4);
    ctx.fillRect(x + 2, y + 8, 26, 4);
    ctx.fillRect(x + 2, y + 12, 6, 4);
    ctx.fillRect(x + 22, y + 12, 6, 4);
    ctx.fillRect(x + 12, y + 12, 6, 4);
    ctx.fillRect(x + 4, y + 16, 4, 4);
    ctx.fillRect(x + 22, y + 16, 4, 4);
    ctx.fillStyle = BG;
    ctx.fillRect(x + 8, y + 8, 4, 4);
    ctx.fillRect(x + 18, y + 8, 4, 4);
  } else {
    // Bottom rows: squid-like
    ctx.fillRect(x + 6, y, 18, 4);
    ctx.fillRect(x + 2, y + 4, 26, 4);
    ctx.fillRect(x + 2, y + 8, 26, 4);
    ctx.fillRect(x + 6, y + 12, 6, 4);
    ctx.fillRect(x + 18, y + 12, 6, 4);
    ctx.fillRect(x + 8, y + 16, 4, 4);
    ctx.fillRect(x + 18, y + 16, 4, 4);
    ctx.fillStyle = BG;
    ctx.fillRect(x + 8, y + 6, 4, 4);
    ctx.fillRect(x + 18, y + 6, 4, 4);
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = ACCENT;
  // Base
  ctx.fillRect(x, y + 8, PLAYER_W, 12);
  // Middle tier
  ctx.fillRect(x + 6, y + 4, PLAYER_W - 12, 8);
  // Cannon
  ctx.fillRect(x + PLAYER_W / 2 - 2, y, 4, 8);
}

const GameInvaders: React.FC<GameProps> = ({ onGameOver }) => {
  const { canvasRef, ctx } = useCanvas(W, H);
  const startTime = useRef(Date.now());
  const state = useRef<GameState>(initState());
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  // Key handlers
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      state.current.keys.add(e.key);
      if (!state.current.started && !state.current.gameOver) {
        state.current.started = true;
        startTime.current = Date.now();
      }
    };
    const handleUp = (e: KeyboardEvent) => {
      state.current.keys.delete(e.key);
    };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, []);

  const gameLoop = useCallback(
    (dt: number) => {
      if (!ctx) return;
      const s = state.current;

      // --- Update ---
      if (s.started && !s.gameOver) {
        // Player movement
        if (s.keys.has('ArrowLeft')) {
          s.playerX = Math.max(0, s.playerX - PLAYER_SPEED * dt);
        }
        if (s.keys.has('ArrowRight')) {
          s.playerX = Math.min(W - PLAYER_W, s.playerX + PLAYER_SPEED * dt);
        }

        // Fire bullet
        if (s.keys.has(' ') && !s.bullet.active) {
          s.bullet = {
            x: s.playerX + PLAYER_W / 2 - BULLET_W / 2,
            y: PLAYER_Y - BULLET_H,
            active: true,
          };
        }

        // Move player bullet
        if (s.bullet.active) {
          s.bullet.y -= BULLET_SPEED * dt;
          if (s.bullet.y + BULLET_H < 0) {
            s.bullet.active = false;
          }
        }

        // Count alive aliens for speed scaling
        const aliveCount = s.aliens.filter((a) => a.alive).length;
        const totalAliens = ROWS * COLS;
        s.alienSpeed = 0.03 + (1 - aliveCount / totalAliens) * 0.12;

        // Move aliens
        s.alienOffsetX += s.alienDir * s.alienSpeed * dt;

        // Check alien boundaries
        let minX = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const a of s.aliens) {
          if (!a.alive) continue;
          const pos = getAlienPos(a, s.alienOffsetX, s.alienOffsetY);
          minX = Math.min(minX, pos.x);
          maxX = Math.max(maxX, pos.x + ALIEN_W);
          maxY = Math.max(maxY, pos.y + ALIEN_H);
        }

        if (maxX >= W - 5 && s.alienDir > 0) {
          s.alienDir = -1;
          s.alienOffsetY += ALIEN_H;
        } else if (minX <= 5 && s.alienDir < 0) {
          s.alienDir = 1;
          s.alienOffsetY += ALIEN_H;
        }

        // Check if aliens reached bottom
        if (maxY >= PLAYER_Y) {
          s.gameOver = true;
          s.won = false;
          const dur = (Date.now() - startTime.current) / 1000;
          onGameOverRef.current(s.score, false, dur);
        }

        // Alien shooting
        s.alienFireTimer += dt;
        if (s.alienFireTimer >= ALIEN_FIRE_INTERVAL) {
          s.alienFireTimer = 0;
          const alive = s.aliens.filter((a) => a.alive);
          if (alive.length > 0) {
            const shooter = alive[Math.floor(Math.random() * alive.length)];
            const pos = getAlienPos(
              shooter,
              s.alienOffsetX,
              s.alienOffsetY
            );
            s.alienBullets.push({
              x: pos.x + ALIEN_W / 2 - ALIEN_BULLET_W / 2,
              y: pos.y + ALIEN_H,
              active: true,
            });
          }
        }

        // Move alien bullets
        for (const ab of s.alienBullets) {
          if (!ab.active) continue;
          ab.y += ALIEN_BULLET_SPEED * dt;
          if (ab.y > H) {
            ab.active = false;
          }
        }

        // --- Collision: player bullet vs aliens ---
        if (s.bullet.active) {
          for (const a of s.aliens) {
            if (!a.alive) continue;
            const pos = getAlienPos(a, s.alienOffsetX, s.alienOffsetY);
            if (
              rectRect(
                s.bullet.x,
                s.bullet.y,
                BULLET_W,
                BULLET_H,
                pos.x,
                pos.y,
                ALIEN_W,
                ALIEN_H
              )
            ) {
              a.alive = false;
              s.bullet.active = false;
              s.score += ROW_SCORES[a.row] ?? 10;
              break;
            }
          }
        }

        // --- Collision: player bullet vs shields ---
        if (s.bullet.active) {
          for (const shield of s.shields) {
            for (const block of shield) {
              if (!block.alive) continue;
              if (
                rectRect(
                  s.bullet.x,
                  s.bullet.y,
                  BULLET_W,
                  BULLET_H,
                  block.x,
                  block.y,
                  SHIELD_BLOCK,
                  SHIELD_BLOCK
                )
              ) {
                block.alive = false;
                s.bullet.active = false;
                break;
              }
            }
            if (!s.bullet.active) break;
          }
        }

        // --- Collision: alien bullets vs player ---
        for (const ab of s.alienBullets) {
          if (!ab.active) continue;
          if (
            rectRect(
              ab.x,
              ab.y,
              ALIEN_BULLET_W,
              ALIEN_BULLET_H,
              s.playerX,
              PLAYER_Y,
              PLAYER_W,
              PLAYER_H
            )
          ) {
            ab.active = false;
            s.lives--;
            if (s.lives <= 0) {
              s.gameOver = true;
              s.won = false;
              const dur = (Date.now() - startTime.current) / 1000;
              onGameOverRef.current(s.score, false, dur);
            }
          }
        }

        // --- Collision: alien bullets vs shields ---
        for (const ab of s.alienBullets) {
          if (!ab.active) continue;
          for (const shield of s.shields) {
            for (const block of shield) {
              if (!block.alive) continue;
              if (
                rectRect(
                  ab.x,
                  ab.y,
                  ALIEN_BULLET_W,
                  ALIEN_BULLET_H,
                  block.x,
                  block.y,
                  SHIELD_BLOCK,
                  SHIELD_BLOCK
                )
              ) {
                block.alive = false;
                ab.active = false;
                break;
              }
            }
            if (!ab.active) break;
          }
        }

        // --- Collision: aliens vs shields ---
        for (const a of s.aliens) {
          if (!a.alive) continue;
          const pos = getAlienPos(a, s.alienOffsetX, s.alienOffsetY);
          for (const shield of s.shields) {
            for (const block of shield) {
              if (!block.alive) continue;
              if (
                rectRect(
                  pos.x,
                  pos.y,
                  ALIEN_W,
                  ALIEN_H,
                  block.x,
                  block.y,
                  SHIELD_BLOCK,
                  SHIELD_BLOCK
                )
              ) {
                block.alive = false;
              }
            }
          }
        }

        // Clean up inactive alien bullets
        s.alienBullets = s.alienBullets.filter((ab) => ab.active);

        // Win condition
        if (s.aliens.every((a) => !a.alive)) {
          s.gameOver = true;
          s.won = true;
          const dur = (Date.now() - startTime.current) / 1000;
          onGameOverRef.current(s.score, true, dur);
        }
      }

      // --- Draw ---
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      // Draw shields
      ctx.fillStyle = SUCCESS;
      for (const shield of s.shields) {
        for (const block of shield) {
          if (block.alive) {
            ctx.fillRect(block.x, block.y, SHIELD_BLOCK, SHIELD_BLOCK);
          }
        }
      }

      // Draw aliens
      for (const a of s.aliens) {
        if (!a.alive) continue;
        const pos = getAlienPos(a, s.alienOffsetX, s.alienOffsetY);
        drawAlien(ctx, pos.x, pos.y, a.row);
      }

      // Draw player
      drawPlayer(ctx, s.playerX, PLAYER_Y);

      // Draw player bullet
      if (s.bullet.active) {
        ctx.fillStyle = TEXT_COLOR;
        ctx.fillRect(s.bullet.x, s.bullet.y, BULLET_W, BULLET_H);
      }

      // Draw alien bullets
      ctx.fillStyle = DANGER;
      for (const ab of s.alienBullets) {
        if (ab.active) {
          ctx.fillRect(ab.x, ab.y, ALIEN_BULLET_W, ALIEN_BULLET_H);
        }
      }

      // HUD
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = '14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`SCORE: ${s.score}`, 12, 24);
      ctx.textAlign = 'right';
      ctx.fillText(`LIVES: ${'♥'.repeat(s.lives)}`, W - 12, 24);
      ctx.textAlign = 'center';
      ctx.fillText('SPACE INVADERS', W / 2, 24);

      // Score row legend
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = CARD_BG;
      ctx.fillText('50  40  30  20  10', 12, 44);

      // Pre-game message
      if (!s.started && !s.gameOver) {
        ctx.fillStyle = 'rgba(10, 10, 26, 0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = ACCENT;
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SPACE INVADERS', W / 2, H / 2 - 30);
        ctx.fillStyle = TEXT_COLOR;
        ctx.font = '14px monospace';
        ctx.fillText('Arrow keys to move, Space to fire', W / 2, H / 2 + 10);
        ctx.fillStyle = GOLD;
        ctx.fillText('Press any key to start', W / 2, H / 2 + 40);
      }

      // Game over overlay
      if (s.gameOver) {
        ctx.fillStyle = 'rgba(10, 10, 26, 0.8)';
        ctx.fillRect(0, 0, W, H);
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        if (s.won) {
          ctx.fillStyle = SUCCESS;
          ctx.fillText('YOU WIN!', W / 2, H / 2 - 20);
        } else {
          ctx.fillStyle = DANGER;
          ctx.fillText('GAME OVER', W / 2, H / 2 - 20);
        }
        ctx.fillStyle = GOLD;
        ctx.font = '18px monospace';
        ctx.fillText(`Score: ${s.score}`, W / 2, H / 2 + 20);
      }
    },
    [ctx]
  );

  useGameLoop(gameLoop);

  return (
    <div
      style={{
        background: BG,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        minHeight: H + 40,
      }}
    >
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          borderRadius: 12,
          boxShadow: `0 0 30px ${ACCENT}33, 0 4px 20px rgba(0,0,0,0.5)`,
          display: 'block',
        }}
      />
    </div>
  );
};

export default GameInvaders;
