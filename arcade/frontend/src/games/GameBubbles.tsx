import React, { useRef, useCallback, useEffect } from 'react';
import { useGameLoop, useCanvas } from './utils';

interface GameProps {
  onGameOver: (score: number, won?: boolean, durationSeconds?: number) => void;
}

const W = 400;
const H = 600;
const COLS = 8;
const BUBBLE_R = 20;
const BUBBLE_D = BUBBLE_R * 2;
const ROW_H = BUBBLE_D * 0.866; // sqrt(3)/2 for hex packing
const CANNON_Y = H - 40;
const INITIAL_ROWS = 5;
const SHOTS_PER_PUSH = 5;
const PUSH_INTERVAL = 15000; // ms
const SHOOT_SPEED = 0.6; // px per ms

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#fbbf24', '#a855f7', '#ec4899'];

const BG = '#0a0a1a';
const CARD_BG = '#1a1a2e';
const TEXT_COLOR = '#e2e8f0';
const ACCENT = '#a855f7';

type GridCell = { color: string } | null;

interface FlyingBubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

interface PopAnim {
  x: number;
  y: number;
  color: string;
  t: number; // 0..1
}

interface FallAnim {
  x: number;
  y: number;
  vy: number;
  color: string;
  t: number;
}

interface GameState {
  grid: GridCell[][];
  flying: FlyingBubble | null;
  currentColor: string;
  nextColor: string;
  score: number;
  shotCount: number;
  lastPushTime: number;
  gameOver: boolean;
  aimAngle: number; // radians from vertical
  popAnims: PopAnim[];
  fallAnims: FallAnim[];
  startTime: number;
  gridOffset: number; // rows pushed down (visual offset in pixels)
}

function randomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function gridX(col: number, row: number): number {
  const offset = row % 2 === 1 ? BUBBLE_R : 0;
  return BUBBLE_R + col * BUBBLE_D + offset;
}

function gridY(row: number): number {
  return BUBBLE_R + row * ROW_H;
}

function colsInRow(row: number): number {
  return row % 2 === 1 ? COLS - 1 : COLS;
}

function createGrid(): GridCell[][] {
  const grid: GridCell[][] = [];
  for (let r = 0; r < INITIAL_ROWS; r++) {
    const row: GridCell[] = [];
    const c = colsInRow(r);
    for (let col = 0; col < c; col++) {
      row.push({ color: randomColor() });
    }
    grid.push(row);
  }
  return grid;
}

function addTopRow(grid: GridCell[][]): GridCell[][] {
  const newRow: GridCell[] = [];
  // The new row becomes row 0. Current rows shift. We need to handle
  // the stagger: if the grid currently has N rows, the new row 0 is even (COLS cells).
  // But we need to re-stagger: unshift means all old rows shift by 1.
  // Simplest: add new row at front, swap stagger by adjusting col counts.
  const c = colsInRow(0); // new row 0 is always even-index
  for (let col = 0; col < c; col++) {
    newRow.push({ color: randomColor() });
  }
  return [newRow, ...grid];
}

function snapToGrid(x: number, y: number, gridRows: number): { row: number; col: number } {
  // Find closest row
  let bestRow = 0;
  let bestDist = Infinity;
  const maxRow = gridRows + 2; // allow attaching a bit below existing
  for (let r = 0; r <= maxRow; r++) {
    const gy = gridY(r);
    const dist = Math.abs(y - gy);
    if (dist < bestDist) {
      bestDist = dist;
      bestRow = r;
    }
  }
  // Find closest col in that row
  const c = colsInRow(bestRow);
  let bestCol = 0;
  bestDist = Infinity;
  for (let col = 0; col < c; col++) {
    const gx = gridX(col, bestRow);
    const dist = Math.abs(x - gx);
    if (dist < bestDist) {
      bestDist = dist;
      bestCol = col;
    }
  }
  return { row: bestRow, col: bestCol };
}

function getNeighbors(row: number, col: number, grid: GridCell[][]): { row: number; col: number }[] {
  const neighbors: { row: number; col: number }[] = [];
  const even = row % 2 === 0;
  // Same row neighbors
  if (col > 0) neighbors.push({ row, col: col - 1 });
  if (col < colsInRow(row) - 1) neighbors.push({ row, col: col + 1 });
  // Row above
  if (row > 0) {
    const aOff = even ? -1 : 0;
    const c1 = col + aOff;
    const c2 = c1 + 1;
    if (c1 >= 0 && c1 < colsInRow(row - 1)) neighbors.push({ row: row - 1, col: c1 });
    if (c2 >= 0 && c2 < colsInRow(row - 1)) neighbors.push({ row: row - 1, col: c2 });
  }
  // Row below
  if (row < grid.length - 1) {
    const aOff = even ? -1 : 0;
    const c1 = col + aOff;
    const c2 = c1 + 1;
    if (c1 >= 0 && c1 < colsInRow(row + 1)) neighbors.push({ row: row + 1, col: c1 });
    if (c2 >= 0 && c2 < colsInRow(row + 1)) neighbors.push({ row: row + 1, col: c2 });
  }
  return neighbors;
}

function findConnected(row: number, col: number, color: string, grid: GridCell[][]): { row: number; col: number }[] {
  const visited = new Set<string>();
  const result: { row: number; col: number }[] = [];
  const stack = [{ row, col }];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    const key = `${cur.row},${cur.col}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (cur.row < 0 || cur.row >= grid.length) continue;
    const cell = grid[cur.row]?.[cur.col];
    if (!cell || cell.color !== color) continue;
    result.push(cur);
    const neighbors = getNeighbors(cur.row, cur.col, grid);
    for (const n of neighbors) {
      if (!visited.has(`${n.row},${n.col}`)) stack.push(n);
    }
  }
  return result;
}

function findOrphans(grid: GridCell[][]): { row: number; col: number }[] {
  // BFS from row 0 — anything not reached is orphaned
  const visited = new Set<string>();
  const queue: { row: number; col: number }[] = [];
  // Seed from row 0
  if (grid.length > 0) {
    for (let c = 0; c < grid[0].length; c++) {
      if (grid[0][c]) {
        queue.push({ row: 0, col: c });
        visited.add(`0,${c}`);
      }
    }
  }
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const neighbors = getNeighbors(cur.row, cur.col, grid);
    for (const n of neighbors) {
      const key = `${n.row},${n.col}`;
      if (visited.has(key)) continue;
      if (n.row >= 0 && n.row < grid.length && grid[n.row]?.[n.col]) {
        visited.add(key);
        queue.push(n);
      }
    }
  }
  const orphans: { row: number; col: number }[] = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] && !visited.has(`${r},${c}`)) {
        orphans.push({ row: r, col: c });
      }
    }
  }
  return orphans;
}

function checkGameOver(grid: GridCell[][]): boolean {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c]) {
        const y = gridY(r);
        if (y >= CANNON_Y - BUBBLE_R) return true;
      }
    }
  }
  return false;
}

const GameBubbles: React.FC<GameProps> = ({ onGameOver }) => {
  const { canvasRef, ctx } = useCanvas(W, H);

  const state = useRef<GameState>({
    grid: createGrid(),
    flying: null,
    currentColor: randomColor(),
    nextColor: randomColor(),
    score: 0,
    shotCount: 0,
    lastPushTime: Date.now(),
    gameOver: false,
    aimAngle: 0,
    popAnims: [],
    fallAnims: [],
    startTime: Date.now(),
    gridOffset: 0,
  });

  const mousePos = useRef({ x: W / 2, y: H / 2 });

  const shoot = useCallback(() => {
    const s = state.current;
    if (s.flying || s.gameOver) return;
    const cx = W / 2;
    const cy = CANNON_Y;
    const mx = mousePos.current.x;
    const my = mousePos.current.y;
    let angle = Math.atan2(cx - mx, cy - my);
    // Clamp angle to prevent shooting downward
    const maxAngle = Math.PI * 0.42;
    angle = Math.max(-maxAngle, Math.min(maxAngle, angle));
    const vx = -Math.sin(angle) * SHOOT_SPEED;
    const vy = -Math.cos(angle) * SHOOT_SPEED;
    s.flying = { x: cx, y: cy, vx, vy, color: s.currentColor };
    s.currentColor = s.nextColor;
    s.nextColor = randomColor();
    s.shotCount++;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mousePos.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      // Update aim angle
      const cx = W / 2;
      const cy = CANNON_Y;
      state.current.aimAngle = Math.atan2(
        cx - mousePos.current.x,
        cy - mousePos.current.y
      );
    };
    const handleClick = () => shoot();
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('click', handleClick);
    return () => {
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('click', handleClick);
    };
  }, [canvasRef, shoot]);

  useGameLoop(useCallback((dt: number) => {
    if (!ctx) return;
    const s = state.current;
    if (s.gameOver) return;

    // --- Push new rows periodically ---
    const now = Date.now();
    if (now - s.lastPushTime > PUSH_INTERVAL) {
      s.grid = addTopRow(s.grid);
      s.lastPushTime = now;
      if (checkGameOver(s.grid)) {
        s.gameOver = true;
        const dur = Math.floor((now - s.startTime) / 1000);
        onGameOver(s.score, false, dur);
        return;
      }
    }

    // Push on shot count
    if (s.shotCount > 0 && s.shotCount % SHOTS_PER_PUSH === 0 && !s.flying) {
      // Only push once per threshold: use a sentinel
      const pushKey = Math.floor(s.shotCount / SHOTS_PER_PUSH);
      if ((s as any)._lastPushKey !== pushKey) {
        (s as any)._lastPushKey = pushKey;
        s.grid = addTopRow(s.grid);
        s.lastPushTime = now;
        if (checkGameOver(s.grid)) {
          s.gameOver = true;
          const dur = Math.floor((now - s.startTime) / 1000);
          onGameOver(s.score, false, dur);
          return;
        }
      }
    }

    // --- Update flying bubble ---
    if (s.flying) {
      const b = s.flying;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // Wall bounce
      if (b.x - BUBBLE_R < 0) { b.x = BUBBLE_R; b.vx = Math.abs(b.vx); }
      if (b.x + BUBBLE_R > W) { b.x = W - BUBBLE_R; b.vx = -Math.abs(b.vx); }
      // Hit top
      let landed = false;
      if (b.y - BUBBLE_R <= 0) {
        b.y = BUBBLE_R;
        landed = true;
      }
      // Hit grid bubbles
      if (!landed) {
        for (let r = 0; r < s.grid.length; r++) {
          for (let c = 0; c < s.grid[r].length; c++) {
            if (s.grid[r][c]) {
              const gx = gridX(c, r);
              const gy = gridY(r);
              const dx = b.x - gx;
              const dy = b.y - gy;
              if (dx * dx + dy * dy < (BUBBLE_D - 2) * (BUBBLE_D - 2)) {
                landed = true;
                break;
              }
            }
          }
          if (landed) break;
        }
      }

      if (landed) {
        const snap = snapToGrid(b.x, b.y, s.grid.length);
        // Ensure grid has enough rows
        while (s.grid.length <= snap.row) {
          const c = colsInRow(s.grid.length);
          s.grid.push(new Array(c).fill(null));
        }
        // Ensure row has enough cols
        while (s.grid[snap.row].length < colsInRow(snap.row)) {
          s.grid[snap.row].push(null);
        }
        s.grid[snap.row][snap.col] = { color: b.color };
        s.flying = null;

        // Check matches
        const connected = findConnected(snap.row, snap.col, b.color, s.grid);
        if (connected.length >= 3) {
          // Pop them
          for (const p of connected) {
            const px = gridX(p.col, p.row);
            const py = gridY(p.row);
            s.popAnims.push({ x: px, y: py, color: s.grid[p.row][p.col]!.color, t: 0 });
            s.grid[p.row][p.col] = null;
          }
          s.score += connected.length * 10;

          // Find and remove orphans
          const orphans = findOrphans(s.grid);
          for (const o of orphans) {
            const ox = gridX(o.col, o.row);
            const oy = gridY(o.row);
            s.fallAnims.push({ x: ox, y: oy, vy: 0, color: s.grid[o.row][o.col]!.color, t: 0 });
            s.grid[o.row][o.col] = null;
          }
          s.score += orphans.length * 15; // bonus for orphans
        }

        // Trim empty trailing rows
        while (s.grid.length > 0 && s.grid[s.grid.length - 1].every(c => c === null)) {
          s.grid.pop();
        }

        // Check game over
        if (checkGameOver(s.grid)) {
          s.gameOver = true;
          const dur = Math.floor((Date.now() - s.startTime) / 1000);
          onGameOver(s.score, false, dur);
          return;
        }

        // Check win (all bubbles cleared)
        const hasAny = s.grid.some(row => row.some(c => c !== null));
        if (!hasAny) {
          s.gameOver = true;
          s.score += 100; // clear bonus
          const dur = Math.floor((Date.now() - s.startTime) / 1000);
          onGameOver(s.score, true, dur);
          return;
        }
      }
    }

    // --- Update animations ---
    s.popAnims = s.popAnims.filter(a => {
      a.t += dt / 300;
      return a.t < 1;
    });
    s.fallAnims = s.fallAnims.filter(a => {
      a.vy += 0.02 * dt;
      a.y += a.vy;
      a.t += dt / 800;
      return a.t < 1 && a.y < H + 50;
    });

    // --- DRAW ---
    ctx.fillStyle = CARD_BG;
    ctx.fillRect(0, 0, W, H);

    // Draw grid bubbles
    for (let r = 0; r < s.grid.length; r++) {
      for (let c = 0; c < s.grid[r].length; c++) {
        const cell = s.grid[r][c];
        if (cell) {
          const x = gridX(c, r);
          const y = gridY(r);
          drawBubble(ctx, x, y, BUBBLE_R, cell.color);
        }
      }
    }

    // Draw pop animations
    for (const a of s.popAnims) {
      const scale = 1 + a.t * 0.5;
      const alpha = 1 - a.t;
      ctx.globalAlpha = alpha;
      drawBubble(ctx, a.x, a.y, BUBBLE_R * scale, a.color);
      ctx.globalAlpha = 1;
    }

    // Draw fall animations
    for (const a of s.fallAnims) {
      const alpha = 1 - a.t;
      ctx.globalAlpha = alpha;
      drawBubble(ctx, a.x, a.y, BUBBLE_R, a.color);
      ctx.globalAlpha = 1;
    }

    // Draw flying bubble
    if (s.flying) {
      drawBubble(ctx, s.flying.x, s.flying.y, BUBBLE_R, s.flying.color);
    }

    // Draw aiming line
    if (!s.flying) {
      const cx = W / 2;
      const cy = CANNON_Y;
      let angle = s.aimAngle;
      const maxAngle = Math.PI * 0.42;
      angle = Math.max(-maxAngle, Math.min(maxAngle, angle));
      const lineLen = 80;
      const ex = cx - Math.sin(angle) * lineLen;
      const ey = cy - Math.cos(angle) * lineLen;
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw cannon base
    const cx = W / 2;
    ctx.fillStyle = '#2a2a4e';
    ctx.beginPath();
    ctx.arc(cx, CANNON_Y, BUBBLE_R + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, CANNON_Y, BUBBLE_R + 4, 0, Math.PI * 2);
    ctx.stroke();

    // Draw current bubble at cannon
    if (!s.flying) {
      drawBubble(ctx, cx, CANNON_Y, BUBBLE_R, s.currentColor);
    }

    // Draw next bubble preview
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('NEXT', 20, CANNON_Y - 10);
    drawBubble(ctx, 42, CANNON_Y + 10, BUBBLE_R * 0.6, s.nextColor);

    // Draw score
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`SCORE: ${s.score}`, W - 16, CANNON_Y + 6);

    // Draw danger line
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, CANNON_Y - BUBBLE_R);
    ctx.lineTo(W, CANNON_Y - BUBBLE_R);
    ctx.stroke();
    ctx.setLineDash([]);

  }, [ctx, onGameOver]));

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
          boxShadow: '0 0 30px rgba(168, 85, 247, 0.2), 0 4px 20px rgba(0,0,0,0.5)',
          cursor: 'crosshair',
        }}
      />
    </div>
  );
};

function drawBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string
) {
  // Main circle
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Highlight
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Border
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export default GameBubbles;
