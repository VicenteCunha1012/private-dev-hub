import React, { useState, useCallback, useEffect, useRef } from 'react';

interface GameProps {
  onGameOver: (score: number, won?: boolean, durationSeconds?: number) => void;
}

const CARD_BG = '#1a1a2e';
const TEXT_COLOR = '#e2e8f0';
const ACCENT = '#a855f7';
const SUCCESS = '#22c55e';
const DANGER = '#ef4444';
const GOLD = '#fbbf24';

type Cell = 'X' | 'O' | null;
type BoardState = Cell[];

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(board: BoardState): { winner: Cell; line: number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return null;
}

function isDraw(board: BoardState): boolean {
  return board.every(c => c !== null) && !checkWinner(board);
}

function minimax(board: BoardState, isMax: boolean): number {
  const result = checkWinner(board);
  if (result?.winner === 'O') return 10;
  if (result?.winner === 'X') return -10;
  if (board.every(c => c !== null)) return 0;

  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] !== null) continue;
      board[i] = 'O';
      best = Math.max(best, minimax(board, false));
      board[i] = null;
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] !== null) continue;
      board[i] = 'X';
      best = Math.min(best, minimax(board, true));
      board[i] = null;
    }
    return best;
  }
}

function bestAiMove(board: BoardState): number {
  let bestVal = -Infinity;
  let bestMove = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] !== null) continue;
    board[i] = 'O';
    const val = minimax(board, false);
    board[i] = null;
    if (val > bestVal) {
      bestVal = val;
      bestMove = i;
    }
  }
  return bestMove;
}

const GameTicTacToe: React.FC<GameProps> = ({ onGameOver }) => {
  const [board, setBoard] = useState<BoardState>(Array(9).fill(null));
  const [turn, setTurn] = useState<'player' | 'ai'>('player');
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost' | 'draw'>('playing');
  const [winLine, setWinLine] = useState<number[]>([]);
  const startTime = useRef(Date.now());

  const handleClick = useCallback((idx: number) => {
    if (board[idx] || turn !== 'player' || gameState !== 'playing') return;

    const newBoard = [...board];
    newBoard[idx] = 'X';
    setBoard(newBoard);

    const result = checkWinner(newBoard);
    if (result) {
      setWinLine(result.line);
      setGameState('won');
      const duration = (Date.now() - startTime.current) / 1000;
      onGameOver(1, true, duration);
      return;
    }
    if (isDraw(newBoard)) {
      setGameState('draw');
      const duration = (Date.now() - startTime.current) / 1000;
      onGameOver(0, false, duration);
      return;
    }
    setTurn('ai');
  }, [board, turn, gameState, onGameOver]);

  useEffect(() => {
    if (turn !== 'ai' || gameState !== 'playing') return;

    const timer = setTimeout(() => {
      const newBoard = [...board];
      const move = bestAiMove(newBoard);
      if (move === -1) return;
      newBoard[move] = 'O';
      setBoard(newBoard);

      const result = checkWinner(newBoard);
      if (result) {
        setWinLine(result.line);
        setGameState('lost');
        const duration = (Date.now() - startTime.current) / 1000;
        onGameOver(0, false, duration);
        return;
      }
      if (isDraw(newBoard)) {
        setGameState('draw');
        const duration = (Date.now() - startTime.current) / 1000;
        onGameOver(0, false, duration);
        return;
      }
      setTurn('player');
    }, 350);

    return () => clearTimeout(timer);
  }, [turn, board, gameState, onGameOver]);

  const statusText = gameState === 'won' ? 'You win!' :
    gameState === 'lost' ? 'AI wins!' :
    gameState === 'draw' ? "It's a draw!" :
    turn === 'player' ? 'Your turn (X)' : 'AI thinking...';

  const statusColor = gameState === 'won' ? SUCCESS :
    gameState === 'lost' ? DANGER :
    gameState === 'draw' ? GOLD : TEXT_COLOR;

  const CELL_SIZE = 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{
        color: statusColor, fontFamily: 'monospace', fontSize: 18, fontWeight: 'bold',
      }}>
        {statusText}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(3, ${CELL_SIZE}px)`,
        gap: 6,
        background: ACCENT,
        padding: 6,
        borderRadius: 12,
      }}>
        {board.map((cell, i) => {
          const isWinCell = winLine.includes(i);
          return (
            <div
              key={i}
              onClick={() => handleClick(i)}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                background: isWinCell ? 'rgba(34,197,94,0.15)' : CARD_BG,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: !cell && gameState === 'playing' && turn === 'player' ? 'pointer' : 'default',
                transition: 'background 0.2s',
                border: isWinCell ? `2px solid ${SUCCESS}` : '2px solid transparent',
              }}
            >
              {cell && (
                <span style={{
                  fontSize: 48,
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  color: cell === 'X' ? ACCENT : GOLD,
                  textShadow: `0 0 12px ${cell === 'X' ? ACCENT : GOLD}`,
                  userSelect: 'none',
                }}>
                  {cell}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GameTicTacToe;
