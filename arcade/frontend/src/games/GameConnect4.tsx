import React, { useState, useCallback, useEffect, useRef } from 'react';

interface GameProps {
  onGameOver: (score: number, won?: boolean, durationSeconds?: number) => void;
}

const ROWS = 6;
const COLS = 7;
const EMPTY = 0;
const PLAYER = 1;
const AI = 2;

const CARD_BG = '#1a1a2e';
const TEXT_COLOR = '#e2e8f0';
const ACCENT = '#a855f7';
const PLAYER_COLOR = '#ef4444';
const AI_COLOR = '#fbbf24';
const SUCCESS = '#22c55e';
const CELL_SIZE = 64;
const CELL_GAP = 4;

type Board = number[][];

function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

function clone(b: Board): Board {
  return b.map(r => [...r]);
}

function dropRow(board: Board, col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === EMPTY) return r;
  }
  return -1;
}

function checkWin(board: Board, player: number): [number, number][] | null {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== player) continue;
      for (const [dr, dc] of dirs) {
        const cells: [number, number][] = [];
        let ok = true;
        for (let i = 0; i < 4; i++) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== player) {
            ok = false;
            break;
          }
          cells.push([nr, nc]);
        }
        if (ok) return cells;
      }
    }
  }
  return null;
}

function isFull(board: Board): boolean {
  return board[0].every(c => c !== EMPTY);
}

function evaluate(board: Board): number {
  if (checkWin(board, AI)) return 100000;
  if (checkWin(board, PLAYER)) return -100000;

  let score = 0;
  const scoreWindow = (cells: number[]) => {
    const ai = cells.filter(c => c === AI).length;
    const pl = cells.filter(c => c === PLAYER).length;
    const empty = cells.filter(c => c === EMPTY).length;
    if (ai > 0 && pl > 0) return;
    if (ai === 3 && empty === 1) score += 50;
    else if (ai === 2 && empty === 2) score += 10;
    if (pl === 3 && empty === 1) score -= 40;
    else if (pl === 2 && empty === 2) score -= 8;
  };

  // horizontal
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      scoreWindow([board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]]);
  // vertical
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r <= ROWS - 4; r++)
      scoreWindow([board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]]);
  // diag
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 0; c <= COLS - 4; c++)
      scoreWindow([board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]]);
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 3; c < COLS; c++)
      scoreWindow([board[r][c], board[r + 1][c - 1], board[r + 2][c - 2], board[r + 3][c - 3]]);

  // center preference
  for (let r = 0; r < ROWS; r++) {
    if (board[r][3] === AI) score += 6;
  }

  return score;
}

function minimax(board: Board, depth: number, alpha: number, beta: number, maximizing: boolean): number {
  if (checkWin(board, AI)) return 100000 + depth;
  if (checkWin(board, PLAYER)) return -100000 - depth;
  if (isFull(board) || depth === 0) return evaluate(board);

  const validCols = [];
  for (let c = 0; c < COLS; c++) if (dropRow(board, c) !== -1) validCols.push(c);

  if (maximizing) {
    let max = -Infinity;
    for (const c of validCols) {
      const b = clone(board);
      b[dropRow(b, c)][c] = AI;
      const val = minimax(b, depth - 1, alpha, beta, false);
      max = Math.max(max, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return max;
  } else {
    let min = Infinity;
    for (const c of validCols) {
      const b = clone(board);
      b[dropRow(b, c)][c] = PLAYER;
      const val = minimax(b, depth - 1, alpha, beta, true);
      min = Math.min(min, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return min;
  }
}

function bestMove(board: Board): number {
  let best = -Infinity;
  let bestCol = 3;
  const validCols = [];
  for (let c = 0; c < COLS; c++) if (dropRow(board, c) !== -1) validCols.push(c);

  for (const c of validCols) {
    const b = clone(board);
    b[dropRow(b, c)][c] = AI;
    const val = minimax(b, 4, -Infinity, Infinity, false);
    if (val > best) {
      best = val;
      bestCol = c;
    }
  }
  return bestCol;
}

const GameConnect4: React.FC<GameProps> = ({ onGameOver }) => {
  const [board, setBoard] = useState<Board>(createBoard);
  const [turn, setTurn] = useState<'player' | 'ai'>('player');
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [winCells, setWinCells] = useState<Set<string>>(new Set());
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost' | 'draw'>('playing');
  const startTime = useRef(Date.now());
  const aiThinking = useRef(false);

  const handleClick = useCallback((col: number) => {
    if (turn !== 'player' || gameState !== 'playing') return;
    const row = dropRow(board, col);
    if (row === -1) return;

    const newBoard = clone(board);
    newBoard[row][col] = PLAYER;
    setBoard(newBoard);

    const win = checkWin(newBoard, PLAYER);
    if (win) {
      setWinCells(new Set(win.map(([r, c]) => `${r},${c}`)));
      setGameState('won');
      const duration = (Date.now() - startTime.current) / 1000;
      onGameOver(1, true, duration);
      return;
    }
    if (isFull(newBoard)) {
      setGameState('draw');
      const duration = (Date.now() - startTime.current) / 1000;
      onGameOver(0, false, duration);
      return;
    }
    setTurn('ai');
  }, [board, turn, gameState, onGameOver]);

  useEffect(() => {
    if (turn !== 'ai' || gameState !== 'playing') return;
    aiThinking.current = true;

    const timer = setTimeout(() => {
      const col = bestMove(board);
      const row = dropRow(board, col);
      if (row === -1) return;

      const newBoard = clone(board);
      newBoard[row][col] = AI;
      setBoard(newBoard);

      const win = checkWin(newBoard, AI);
      if (win) {
        setWinCells(new Set(win.map(([r, c]) => `${r},${c}`)));
        setGameState('lost');
        const duration = (Date.now() - startTime.current) / 1000;
        onGameOver(0, false, duration);
        aiThinking.current = false;
        return;
      }
      if (isFull(newBoard)) {
        setGameState('draw');
        const duration = (Date.now() - startTime.current) / 1000;
        onGameOver(0, false, duration);
        aiThinking.current = false;
        return;
      }
      setTurn('player');
      aiThinking.current = false;
    }, 400);

    return () => clearTimeout(timer);
  }, [turn, board, gameState, onGameOver]);

  const previewRow = hoverCol !== null ? dropRow(board, hoverCol) : -1;

  const statusText = gameState === 'won' ? 'You win!' :
    gameState === 'lost' ? 'AI wins!' :
    gameState === 'draw' ? 'Draw!' :
    turn === 'player' ? 'Your turn (Red)' : 'AI thinking...';

  const statusColor = gameState === 'won' ? SUCCESS :
    gameState === 'lost' ? '#ef4444' :
    gameState === 'draw' ? '#fbbf24' : TEXT_COLOR;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{
        color: statusColor, fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold',
      }}>
        {statusText}
      </div>
      <div style={{
        background: ACCENT,
        borderRadius: 12,
        padding: 12,
        display: 'inline-block',
      }}>
        {Array.from({ length: ROWS }, (_, r) => (
          <div key={r} style={{ display: 'flex', gap: CELL_GAP }}>
            {Array.from({ length: COLS }, (_, c) => {
              const val = board[r][c];
              const isWin = winCells.has(`${r},${c}`);
              const isPreview = turn === 'player' && gameState === 'playing' &&
                hoverCol === c && r === previewRow && val === EMPTY;

              let pieceColor = 'transparent';
              if (val === PLAYER) pieceColor = PLAYER_COLOR;
              else if (val === AI) pieceColor = AI_COLOR;
              else if (isPreview) pieceColor = 'rgba(239, 68, 68, 0.3)';

              return (
                <div
                  key={c}
                  onClick={() => handleClick(c)}
                  onMouseEnter={() => setHoverCol(c)}
                  onMouseLeave={() => setHoverCol(null)}
                  style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    background: CARD_BG,
                    borderRadius: '50%',
                    margin: CELL_GAP / 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: turn === 'player' && gameState === 'playing' ? 'pointer' : 'default',
                    transition: 'transform 0.1s',
                  }}
                >
                  <div style={{
                    width: CELL_SIZE - 12,
                    height: CELL_SIZE - 12,
                    borderRadius: '50%',
                    background: pieceColor,
                    transition: 'background 0.3s ease',
                    boxShadow: isWin ? `0 0 16px 4px ${SUCCESS}` :
                      val !== EMPTY ? `inset 0 -4px 8px rgba(0,0,0,0.3)` : 'none',
                    border: isWin ? `2px solid ${SUCCESS}` : 'none',
                  }} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GameConnect4;
