import React, { useState, useEffect, useRef } from 'react';

interface GameProps {
  onGameOver: (score: number, won?: boolean, durationSeconds?: number) => void;
}

type Grid = number[][];

const TILE_COLORS: Record<number, string> = {
  0: 'transparent',
  2: '#eee4da',
  4: '#ede0c8',
  8: '#f2b179',
  16: '#f59563',
  32: '#f67c5f',
  64: '#f65e3b',
  128: '#edcf72',
  256: '#edcc61',
  512: '#edc850',
  1024: '#edc53f',
  2048: '#fbbf24',
  4096: '#a855f7',
  8192: '#ec4899',
};

const TILE_TEXT_COLORS: Record<number, string> = {
  2: '#776e65',
  4: '#776e65',
};

function createEmptyGrid(): Grid {
  return Array.from({ length: 4 }, () => Array(4).fill(0));
}

function addRandomTile(grid: Grid): Grid {
  const empty: [number, number][] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c] === 0) empty.push([r, c]);
    }
  }
  if (empty.length === 0) return grid;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const newGrid = grid.map(row => [...row]);
  newGrid[r][c] = Math.random() < 0.9 ? 2 : 4;
  return newGrid;
}

function slideLine(line: number[]): { result: number[]; score: number } {
  const filtered = line.filter(v => v !== 0);
  let score = 0;
  const merged: number[] = [];
  let i = 0;
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const val = filtered[i] * 2;
      merged.push(val);
      score += val;
      i += 2;
    } else {
      merged.push(filtered[i]);
      i++;
    }
  }
  while (merged.length < 4) merged.push(0);
  return { result: merged, score };
}

function moveGrid(grid: Grid, direction: 'up' | 'down' | 'left' | 'right'): { grid: Grid; score: number; moved: boolean } {
  let totalScore = 0;
  const newGrid = createEmptyGrid();
  let moved = false;

  for (let i = 0; i < 4; i++) {
    let line: number[];
    if (direction === 'left') {
      line = [grid[i][0], grid[i][1], grid[i][2], grid[i][3]];
    } else if (direction === 'right') {
      line = [grid[i][3], grid[i][2], grid[i][1], grid[i][0]];
    } else if (direction === 'up') {
      line = [grid[0][i], grid[1][i], grid[2][i], grid[3][i]];
    } else {
      line = [grid[3][i], grid[2][i], grid[1][i], grid[0][i]];
    }

    const { result, score } = slideLine(line);
    totalScore += score;

    if (direction === 'left') {
      for (let j = 0; j < 4; j++) newGrid[i][j] = result[j];
    } else if (direction === 'right') {
      for (let j = 0; j < 4; j++) newGrid[i][3 - j] = result[j];
    } else if (direction === 'up') {
      for (let j = 0; j < 4; j++) newGrid[j][i] = result[j];
    } else {
      for (let j = 0; j < 4; j++) newGrid[3 - j][i] = result[j];
    }
  }

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (newGrid[r][c] !== grid[r][c]) moved = true;
    }
  }

  return { grid: newGrid, score: totalScore, moved };
}

function hasMovesLeft(grid: Grid): boolean {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c] === 0) return true;
      if (c < 3 && grid[r][c] === grid[r][c + 1]) return true;
      if (r < 3 && grid[r][c] === grid[r + 1][c]) return true;
    }
  }
  return false;
}

const Game2048: React.FC<GameProps> = ({ onGameOver }) => {
  const [grid, setGrid] = useState<Grid>(() => {
    let g = createEmptyGrid();
    g = addRandomTile(g);
    g = addRandomTile(g);
    return g;
  });
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameOver, setGameOver] = useState(false);
  const gameOverRef = useRef(false);

  useEffect(() => {
    if (gameOver) return;
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [gameOver]);

  useEffect(() => {
    if (timeLeft === 0 && !gameOverRef.current) {
      gameOverRef.current = true;
      setGameOver(true);
      onGameOver(score, false, 60);
    }
  }, [timeLeft, score, onGameOver]);

  useEffect(() => {
    if (!hasMovesLeft(grid) && !gameOverRef.current) {
      gameOverRef.current = true;
      setGameOver(true);
      onGameOver(score, false, 60 - timeLeft);
    }
  }, [grid, score, timeLeft, onGameOver]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameOverRef.current) return;
      const dirMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      };
      const dir = dirMap[e.key];
      if (!dir) return;
      e.preventDefault();

      setGrid(prev => {
        const { grid: newGrid, score: gained, moved } = moveGrid(prev, dir);
        if (!moved) return prev;
        setScore(s => s + gained);
        return addRandomTile(newGrid);
      });
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const timerColor = timeLeft <= 10 ? '#ef4444' : timeLeft <= 20 ? '#fbbf24' : '#a855f7';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: 340, alignItems: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#fbbf24' }}>2048</div>
        <div style={{
          fontSize: 24, fontWeight: 700, color: timerColor,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {timeLeft}s
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0' }}>
          Score: {score}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 80px)',
        gridTemplateRows: 'repeat(4, 80px)',
        gap: 6,
        padding: 6,
        backgroundColor: '#2a2a3e',
        borderRadius: 10,
      }}>
        {grid.flat().map((val, idx) => {
          const bg = TILE_COLORS[val] || '#a855f7';
          const textColor = TILE_TEXT_COLORS[val] || '#ffffff';
          const fontSize = val >= 1024 ? 22 : val >= 128 ? 26 : 32;
          return (
            <div
              key={idx}
              style={{
                width: 80,
                height: 80,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: val === 0 ? '#1a1a2e' : bg,
                borderRadius: 6,
                fontSize,
                fontWeight: 800,
                color: val === 0 ? 'transparent' : textColor,
                transition: 'all 150ms ease',
                userSelect: 'none',
              }}
            >
              {val || ''}
            </div>
          );
        })}
      </div>

      {gameOver && (
        <div style={{
          fontSize: 20, fontWeight: 700,
          color: '#ef4444',
          padding: '8px 16px',
          borderRadius: 8,
          backgroundColor: 'rgba(239,68,68,0.15)',
        }}>
          Game Over! Final Score: {score}
        </div>
      )}

      <div style={{ color: '#64748b', fontSize: 13 }}>
        Use arrow keys to merge tiles
      </div>
    </div>
  );
};

export default Game2048;
