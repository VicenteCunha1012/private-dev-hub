import React, { useState, useEffect, useRef, useCallback } from 'react';

interface GameProps {
  onGameOver: (score: number, won?: boolean, durationSeconds?: number) => void;
}

interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
}

const ROWS = 9;
const COLS = 9;
const MINES = 10;

const NUMBER_COLORS: Record<number, string> = {
  1: '#3b82f6',
  2: '#22c55e',
  3: '#ef4444',
  4: '#8b5cf6',
  5: '#f59e0b',
  6: '#06b6d4',
  7: '#e2e8f0',
  8: '#64748b',
};

function createBoard(firstR?: number, firstC?: number): Cell[][] {
  const board: Cell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
    }))
  );

  let placed = 0;
  while (placed < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if (board[r][c].mine) continue;
    if (firstR !== undefined && firstC !== undefined) {
      if (Math.abs(r - firstR) <= 1 && Math.abs(c - firstC) <= 1) continue;
    }
    board[r][c].mine = true;
    placed++;
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc].mine) {
            count++;
          }
        }
      }
      board[r][c].adjacent = count;
    }
  }

  return board;
}

const GameMinesweeper: React.FC<GameProps> = ({ onGameOver }) => {
  const [board, setBoard] = useState<Cell[][] | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [timer, setTimer] = useState(0);
  const [flagCount, setFlagCount] = useState(0);
  const gameOverRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setBoard(createBoard());
  }, []);

  useEffect(() => {
    if (gameStarted && !gameOver) {
      timerRef.current = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStarted, gameOver]);

  const revealCell = useCallback((board: Cell[][], r: number, c: number): Cell[][] => {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return board;
    if (board[r][c].revealed || board[r][c].flagged) return board;

    board[r][c].revealed = true;

    if (board[r][c].adjacent === 0 && !board[r][c].mine) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          board = revealCell(board, r + dr, c + dc);
        }
      }
    }

    return board;
  }, []);

  const checkWin = useCallback((board: Cell[][]): boolean => {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!board[r][c].mine && !board[r][c].revealed) return false;
      }
    }
    return true;
  }, []);

  const handleClick = useCallback((r: number, c: number) => {
    if (gameOverRef.current) return;
    if (!board) return;

    let newBoard: Cell[][];

    if (!gameStarted) {
      newBoard = createBoard(r, c);
      setGameStarted(true);
    } else {
      newBoard = board.map(row => row.map(cell => ({ ...cell })));
    }

    if (newBoard[r][c].flagged || newBoard[r][c].revealed) return;

    if (newBoard[r][c].mine) {
      // Reveal all mines
      for (let i = 0; i < ROWS; i++) {
        for (let j = 0; j < COLS; j++) {
          if (newBoard[i][j].mine) newBoard[i][j].revealed = true;
        }
      }
      setBoard(newBoard);
      setGameOver(true);
      setWon(false);
      gameOverRef.current = true;
      onGameOver(timer, false, timer);
      return;
    }

    newBoard = revealCell(newBoard, r, c);
    setBoard(newBoard);

    if (checkWin(newBoard)) {
      setGameOver(true);
      setWon(true);
      gameOverRef.current = true;
      onGameOver(timer, true, timer);
    }
  }, [board, gameStarted, timer, onGameOver, revealCell, checkWin]);

  const handleRightClick = useCallback((e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (gameOverRef.current || !board) return;
    if (board[r][c].revealed) return;

    const newBoard = board.map(row => row.map(cell => ({ ...cell })));
    newBoard[r][c].flagged = !newBoard[r][c].flagged;
    setBoard(newBoard);
    setFlagCount(prev => newBoard[r][c].flagged ? prev + 1 : prev - 1);
  }, [board]);

  if (!board) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: 306, alignItems: 'center' }}>
        <div style={{
          fontSize: 18, fontWeight: 700, color: '#ef4444',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>💣</span> {MINES - flagCount}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#a855f7' }}>Minesweeper</div>
        <div style={{
          fontSize: 18, fontWeight: 700, color: '#fbbf24',
          fontVariantNumeric: 'tabular-nums',
        }}>
          ⏱ {timer}s
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, 32px)`,
          gridTemplateRows: `repeat(${ROWS}, 32px)`,
          gap: 2,
          padding: 4,
          backgroundColor: '#2a2a3e',
          borderRadius: 8,
        }}
        onContextMenu={e => e.preventDefault()}
      >
        {board.flatMap((row, r) =>
          row.map((cell, c) => {
            let bg = '#1a1a2e';
            let content: React.ReactNode = '';
            let textColor = '#e2e8f0';
            let fontSize = 14;
            let fontWeight: number = 700;

            if (cell.revealed) {
              bg = '#0a0a1a';
              if (cell.mine) {
                content = '💣';
                bg = '#ef4444';
                fontSize = 16;
              } else if (cell.adjacent > 0) {
                content = cell.adjacent;
                textColor = NUMBER_COLORS[cell.adjacent] || '#e2e8f0';
                fontWeight = 800;
              }
            } else if (cell.flagged) {
              content = '🚩';
              fontSize = 16;
            } else {
              bg = '#2d2d4a';
            }

            return (
              <div
                key={`${r}-${c}`}
                onClick={() => handleClick(r, c)}
                onContextMenu={(e) => handleRightClick(e, r, c)}
                style={{
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: bg,
                  borderRadius: 3,
                  fontSize,
                  fontWeight,
                  color: textColor,
                  cursor: gameOver ? 'default' : 'pointer',
                  userSelect: 'none',
                  transition: 'background-color 100ms',
                }}
              >
                {content}
              </div>
            );
          })
        )}
      </div>

      {gameOver && (
        <div style={{
          fontSize: 20, fontWeight: 700,
          color: won ? '#22c55e' : '#ef4444',
          padding: '8px 16px',
          borderRadius: 8,
          backgroundColor: won ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
        }}>
          {won ? `You Won! Time: ${timer}s` : 'Boom! Game Over'}
        </div>
      )}

      <div style={{ color: '#64748b', fontSize: 13 }}>
        Left click to reveal, right click to flag
      </div>
    </div>
  );
};

export default GameMinesweeper;
