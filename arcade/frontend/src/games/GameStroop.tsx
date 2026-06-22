import React, { useState, useEffect, useRef, useCallback } from 'react';

interface GameProps {
  onGameOver: (score: number, won?: boolean, durationSeconds?: number) => void;
}

type ColorName = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW';

const COLORS: { name: ColorName; hex: string }[] = [
  { name: 'RED', hex: '#ef4444' },
  { name: 'BLUE', hex: '#3b82f6' },
  { name: 'GREEN', hex: '#22c55e' },
  { name: 'YELLOW', hex: '#fbbf24' },
];

function randomDifferent(): { word: ColorName; displayColor: ColorName } {
  const names = COLORS.map(c => c.name);
  const word = names[Math.floor(Math.random() * names.length)];
  let displayColor: ColorName;
  do {
    displayColor = names[Math.floor(Math.random() * names.length)];
  } while (displayColor === word);
  return { word, displayColor };
}

const GameStroop: React.FC<GameProps> = ({ onGameOver }) => {
  const [round, setRound] = useState(() => randomDifferent());
  const [timeLeft, setTimeLeft] = useState(30);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [flash, setFlash] = useState<'correct' | 'wrong' | null>(null);
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
      onGameOver(correct, undefined, 30);
    }
  }, [timeLeft, correct, onGameOver]);

  const handleAnswer = useCallback((colorName: ColorName) => {
    if (gameOverRef.current) return;

    if (colorName === round.displayColor) {
      setCorrect(c => c + 1);
      setFlash('correct');
    } else {
      setWrong(w => w + 1);
      setFlash('wrong');
    }

    setRound(randomDifferent());
    setTimeout(() => setFlash(null), 200);
  }, [round.displayColor]);

  const displayColorHex = COLORS.find(c => c.name === round.displayColor)!.hex;
  const timerColor = timeLeft <= 5 ? '#ef4444' : timeLeft <= 10 ? '#fbbf24' : '#a855f7';

  let bgOverlay = 'transparent';
  if (flash === 'correct') bgOverlay = 'rgba(34,197,94,0.15)';
  if (flash === 'wrong') bgOverlay = 'rgba(239,68,68,0.15)';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 24, padding: 24,
      backgroundColor: bgOverlay,
      borderRadius: 12,
      transition: 'background-color 150ms',
      minWidth: 360,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#a855f7' }}>Stroop</div>
        <div style={{
          fontSize: 28, fontWeight: 800, color: timerColor,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {timeLeft}s
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
        <div style={{
          padding: '4px 12px', borderRadius: 6,
          backgroundColor: 'rgba(34,197,94,0.15)',
          color: '#22c55e', fontWeight: 700, fontSize: 16,
        }}>
          Correct: {correct}
        </div>
        <div style={{
          padding: '4px 12px', borderRadius: 6,
          backgroundColor: 'rgba(239,68,68,0.15)',
          color: '#ef4444', fontWeight: 700, fontSize: 16,
        }}>
          Wrong: {wrong}
        </div>
      </div>

      <div style={{
        fontSize: 72, fontWeight: 900,
        color: displayColorHex,
        padding: '20px 0',
        userSelect: 'none',
        letterSpacing: 4,
        textShadow: `0 0 20px ${displayColorHex}40`,
      }}>
        {round.word}
      </div>

      <div style={{ color: '#64748b', fontSize: 14, marginTop: -12 }}>
        Click the button matching the <span style={{ color: '#e2e8f0', fontWeight: 700 }}>displayed color</span> (not the word!)
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {COLORS.map(color => (
          <button
            key={color.name}
            onClick={() => handleAnswer(color.name)}
            disabled={gameOver}
            style={{
              padding: '14px 28px',
              fontSize: 18,
              fontWeight: 800,
              color: '#ffffff',
              backgroundColor: color.hex,
              border: 'none',
              borderRadius: 10,
              cursor: gameOver ? 'default' : 'pointer',
              opacity: gameOver ? 0.5 : 1,
              transition: 'transform 100ms, opacity 100ms',
              boxShadow: `0 4px 12px ${color.hex}40`,
              minWidth: 80,
            }}
            onMouseDown={e => {
              if (!gameOver) (e.currentTarget.style.transform = 'scale(0.95)');
            }}
            onMouseUp={e => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {color.name}
          </button>
        ))}
      </div>

      {gameOver && (
        <div style={{
          fontSize: 22, fontWeight: 700,
          color: '#fbbf24',
          padding: '10px 20px',
          borderRadius: 8,
          backgroundColor: 'rgba(251,191,36,0.15)',
        }}>
          Time's up! Score: {correct}
        </div>
      )}
    </div>
  );
};

export default GameStroop;
