import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useGameLoop, useCanvas } from './utils';

interface GameProps {
  onGameOver: (score: number, won?: boolean, durationSeconds?: number) => void;
}

const COLS = 10;
const ROWS = 20;
const CELL_SIZE = 28;
const BOARD_WIDTH = COLS * CELL_SIZE;
const BOARD_HEIGHT = ROWS * CELL_SIZE;

const TETROMINOES: { shape: number[][]; color: string }[] = [
  { shape: [[1, 1, 1, 1]], color: '#06b6d4' },                          // I
  { shape: [[1, 1], [1, 1]], color: '#fbbf24' },                        // O
  { shape: [[0, 1, 0], [1, 1, 1]], color: '#a855f7' },                  // T
  { shape: [[0, 1, 1], [1, 1, 0]], color: '#22c55e' },                  // S
  { shape: [[1, 1, 0], [0, 1, 1]], color: '#ef4444' },                  // Z
  { shape: [[1, 0, 0], [1, 1, 1]], color: '#3b82f6' },                  // J
  { shape: [[0, 0, 1], [1, 1, 1]], color: '#f97316' },                  // L
];

type Board = (string | null)[][];

interface Piece {
  shape: number[][];
  color: string;
  x: number;
  y: number;
}

function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function rotate(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotated: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rotated[c][rows - 1 - r] = shape[r][c];
    }
  }
  return rotated;
}

function isValid(board: Board, shape: number[][], x: number, y: number): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = x + c;
      const ny = y + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
      if (ny < 0) continue;
      if (board[ny][nx]) return false;
    }
  }
  return true;
}

function placePiece(board: Board, piece: Piece): Board {
  const newBoard = board.map(row => [...row]);
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      const ny = piece.y + r;
      const nx = piece.x + c;
      if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
        newBoard[ny][nx] = piece.color;
      }
    }
  }
  return newBoard;
}

function clearLines(board: Board): { board: Board; cleared: number } {
  const remaining = board.filter(row => row.some(cell => cell === null));
  const cleared = ROWS - remaining.length;
  const newRows = Array.from({ length: cleared }, () => Array(COLS).fill(null));
  return { board: [...newRows, ...remaining], cleared };
}

function getGhostY(board: Board, piece: Piece): number {
  let gy = piece.y;
  while (isValid(board, piece.shape, piece.x, gy + 1)) {
    gy++;
  }
  return gy;
}

function randomPiece(): Piece {
  const t = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
  return {
    shape: t.shape.map(r => [...r]),
    color: t.color,
    x: Math.floor((COLS - t.shape[0].length) / 2),
    y: -t.shape.length,
  };
}

const LINE_SCORES = [0, 100, 300, 500, 800];

const GameTetris: React.FC<GameProps> = ({ onGameOver }) => {
  const { canvasRef, ctx } = useCanvas(BOARD_WIDTH, BOARD_HEIGHT);
  const boardRef = useRef<Board>(createBoard());
  const pieceRef = useRef<Piece>(randomPiece());
  const nextPieceRef = useRef<Piece>(randomPiece());
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [nextPieceDisplay, setNextPieceDisplay] = useState<{ shape: number[][]; color: string }>({
    shape: nextPieceRef.current.shape,
    color: nextPieceRef.current.color,
  });
  const scoreRef = useRef(0);
  const linesRef = useRef(0);
  const gameOverRef = useRef(false);
  const dropTimerRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  const getDropInterval = useCallback(() => {
    const lvl = Math.floor(linesRef.current / 10) + 1;
    return Math.max(100, 800 - (lvl - 1) * 70);
  }, []);

  const spawnPiece = useCallback(() => {
    pieceRef.current = nextPieceRef.current;
    nextPieceRef.current = randomPiece();
    setNextPieceDisplay({ shape: nextPieceRef.current.shape, color: nextPieceRef.current.color });

    if (!isValid(boardRef.current, pieceRef.current.shape, pieceRef.current.x, pieceRef.current.y)) {
      gameOverRef.current = true;
      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      onGameOver(scoreRef.current, false, duration);
    }
  }, [onGameOver]);

  const lockPiece = useCallback(() => {
    boardRef.current = placePiece(boardRef.current, pieceRef.current);
    const { board, cleared } = clearLines(boardRef.current);
    boardRef.current = board;
    if (cleared > 0) {
      const pts = LINE_SCORES[Math.min(cleared, 4)];
      scoreRef.current += pts;
      linesRef.current += cleared;
      setScore(scoreRef.current);
      setLines(linesRef.current);
      setLevel(Math.floor(linesRef.current / 10) + 1);
    }
    spawnPiece();
  }, [spawnPiece]);

  const moveDown = useCallback(() => {
    const p = pieceRef.current;
    if (isValid(boardRef.current, p.shape, p.x, p.y + 1)) {
      pieceRef.current = { ...p, y: p.y + 1 };
    } else {
      lockPiece();
    }
  }, [lockPiece]);

  const hardDrop = useCallback(() => {
    const p = pieceRef.current;
    const gy = getGhostY(boardRef.current, p);
    pieceRef.current = { ...p, y: gy };
    lockPiece();
  }, [lockPiece]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameOverRef.current) return;
      const p = pieceRef.current;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (isValid(boardRef.current, p.shape, p.x - 1, p.y)) {
            pieceRef.current = { ...p, x: p.x - 1 };
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (isValid(boardRef.current, p.shape, p.x + 1, p.y)) {
            pieceRef.current = { ...p, x: p.x + 1 };
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveDown();
          break;
        case 'ArrowUp':
          e.preventDefault();
          const rotated = rotate(p.shape);
          let newX = p.x;
          // Wall kick attempts
          if (isValid(boardRef.current, rotated, newX, p.y)) {
            pieceRef.current = { ...p, shape: rotated, x: newX };
          } else if (isValid(boardRef.current, rotated, newX - 1, p.y)) {
            pieceRef.current = { ...p, shape: rotated, x: newX - 1 };
          } else if (isValid(boardRef.current, rotated, newX + 1, p.y)) {
            pieceRef.current = { ...p, shape: rotated, x: newX + 1 };
          } else if (isValid(boardRef.current, rotated, newX - 2, p.y)) {
            pieceRef.current = { ...p, shape: rotated, x: newX - 2 };
          } else if (isValid(boardRef.current, rotated, newX + 2, p.y)) {
            pieceRef.current = { ...p, shape: rotated, x: newX + 2 };
          }
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [moveDown, hardDrop]);

  const draw = useCallback(() => {
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    // Grid lines
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL_SIZE);
      ctx.lineTo(BOARD_WIDTH, r * CELL_SIZE);
      ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL_SIZE, 0);
      ctx.lineTo(c * CELL_SIZE, BOARD_HEIGHT);
      ctx.stroke();
    }

    // Board cells
    const board = boardRef.current;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]) {
          ctx.fillStyle = board[r][c]!;
          ctx.fillRect(c * CELL_SIZE + 1, r * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.fillRect(c * CELL_SIZE + 1, r * CELL_SIZE + 1, CELL_SIZE - 2, 3);
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.fillRect(c * CELL_SIZE + 1, r * CELL_SIZE + CELL_SIZE - 4, CELL_SIZE - 2, 3);
        }
      }
    }

    const piece = pieceRef.current;

    // Ghost piece
    const ghostY = getGhostY(board, piece);
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        const px = (piece.x + c) * CELL_SIZE;
        const py = (ghostY + r) * CELL_SIZE;
        if (ghostY + r < 0) continue;
        ctx.fillStyle = piece.color + '30';
        ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        ctx.strokeStyle = piece.color + '60';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      }
    }

    // Current piece
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        const px = (piece.x + c) * CELL_SIZE;
        const py = (piece.y + r) * CELL_SIZE;
        if (piece.y + r < 0) continue;
        ctx.fillStyle = piece.color;
        ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(px + 1, py + CELL_SIZE - 4, CELL_SIZE - 2, 3);
      }
    }
  }, [ctx]);

  useGameLoop((dt) => {
    if (gameOverRef.current) return;

    dropTimerRef.current += dt;
    const interval = getDropInterval();
    if (dropTimerRef.current >= interval) {
      dropTimerRef.current -= interval;
      moveDown();
    }

    draw();
  });

  // Also draw when ctx first becomes available
  useEffect(() => {
    draw();
  }, [ctx, draw]);

  return (
    <div style={{ display: 'flex', gap: 20, padding: 16, alignItems: 'flex-start' }}>
      <div style={{
        border: '2px solid #2a2a3e',
        borderRadius: 4,
        overflow: 'hidden',
        boxShadow: '0 0 20px rgba(168,85,247,0.15)',
      }}>
        <canvas
          ref={canvasRef}
          width={BOARD_WIDTH}
          height={BOARD_HEIGHT}
          style={{ display: 'block' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 120 }}>
        <div style={{
          padding: 12, borderRadius: 8,
          backgroundColor: '#1a1a2e',
          border: '1px solid #2a2a3e',
        }}>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Score</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>{score}</div>
        </div>

        <div style={{
          padding: 12, borderRadius: 8,
          backgroundColor: '#1a1a2e',
          border: '1px solid #2a2a3e',
        }}>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Level</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#a855f7' }}>{level}</div>
        </div>

        <div style={{
          padding: 12, borderRadius: 8,
          backgroundColor: '#1a1a2e',
          border: '1px solid #2a2a3e',
        }}>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Lines</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#ec4899' }}>{lines}</div>
        </div>

        <div style={{
          padding: 12, borderRadius: 8,
          backgroundColor: '#1a1a2e',
          border: '1px solid #2a2a3e',
        }}>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Next</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${nextPieceDisplay.shape[0]?.length || 1}, 18px)`,
            gap: 2,
            justifyContent: 'center',
          }}>
            {nextPieceDisplay.shape.flatMap((row, r) =>
              row.map((cell, c) => (
                <div
                  key={`${r}-${c}`}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 2,
                    backgroundColor: cell ? nextPieceDisplay.color : 'transparent',
                  }}
                />
              ))
            )}
          </div>
        </div>

        <div style={{ color: '#64748b', fontSize: 11, lineHeight: 1.6 }}>
          <div><span style={{ color: '#e2e8f0' }}>Arrow keys</span> move</div>
          <div><span style={{ color: '#e2e8f0' }}>Up</span> rotate</div>
          <div><span style={{ color: '#e2e8f0' }}>Space</span> hard drop</div>
        </div>
      </div>
    </div>
  );
};

export default GameTetris;
