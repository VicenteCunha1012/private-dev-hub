import React, { useState, useRef, useCallback } from 'react';
import { shuffleArray } from './utils';

interface GameProps {
  onGameOver: (score: number, won?: boolean, durationSeconds?: number) => void;
}

const ALL_EMOJIS = [
  '🎮', '🚀', '🌟', '🎯', '🔥', '💎', '🎪', '🦄',
  '🍕', '🎸', '🌈', '🐉', '👾', '🎲', '🧩', '🪐',
  '🦋', '🍭', '⚡', '🎵',
];

interface Card {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

function createCards(): Card[] {
  const chosen = shuffleArray(ALL_EMOJIS).slice(0, 8);
  const pairs = [...chosen, ...chosen].map((emoji, i) => ({
    id: i,
    emoji,
    flipped: false,
    matched: false,
  }));
  return shuffleArray(pairs);
}

const GameMemory: React.FC<GameProps> = ({ onGameOver }) => {
  const [cards, setCards] = useState<Card[]>(createCards);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [locked, setLocked] = useState(false);
  const [startTime] = useState(() => Date.now());
  const gameOverRef = useRef(false);

  const handleCardClick = useCallback((id: number) => {
    if (locked || gameOverRef.current) return;
    const card = cards.find(c => c.id === id);
    if (!card || card.flipped || card.matched) return;

    const newFlipped = [...flippedIds, id];
    setCards(prev => prev.map(c => c.id === id ? { ...c, flipped: true } : c));
    setFlippedIds(newFlipped);

    if (newFlipped.length === 2) {
      setAttempts(a => a + 1);
      setLocked(true);

      const [firstId, secondId] = newFlipped;
      const first = cards.find(c => c.id === firstId)!;
      const second = cards.find(c => c.id === secondId)!;

      if (first.emoji === second.emoji) {
        // Match
        setCards(prev => prev.map(c =>
          c.id === firstId || c.id === secondId
            ? { ...c, matched: true, flipped: true }
            : c
        ));
        setFlippedIds([]);
        setLocked(false);

        const newMatched = matchedPairs + 1;
        setMatchedPairs(newMatched);

        if (newMatched === 8 && !gameOverRef.current) {
          gameOverRef.current = true;
          const duration = Math.floor((Date.now() - startTime) / 1000);
          const score = Math.max(0, 1000 - ((attempts + 1) * 50) - (duration * 5));
          setTimeout(() => onGameOver(score, true, duration), 500);
        }
      } else {
        // No match - flip back after delay
        setTimeout(() => {
          setCards(prev => prev.map(c =>
            c.id === firstId || c.id === secondId
              ? { ...c, flipped: false }
              : c
          ));
          setFlippedIds([]);
          setLocked(false);
        }, 800);
      }
    }
  }, [cards, flippedIds, locked, attempts, matchedPairs, startTime, onGameOver]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: 340, alignItems: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#a855f7' }}>Memory</div>
        <div style={{ fontSize: 16, color: '#e2e8f0', fontWeight: 600 }}>
          Attempts: {attempts}
        </div>
        <div style={{ fontSize: 16, color: '#ec4899', fontWeight: 600 }}>
          Pairs: {matchedPairs}/8
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 80px)',
        gridTemplateRows: 'repeat(4, 80px)',
        gap: 8,
        perspective: '1000px',
      }}>
        {cards.map(card => (
          <div
            key={card.id}
            onClick={() => handleCardClick(card.id)}
            style={{
              width: 80,
              height: 80,
              cursor: card.flipped || card.matched ? 'default' : 'pointer',
              position: 'relative',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.4s ease',
              transform: card.flipped || card.matched ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Card back */}
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              backfaceVisibility: 'hidden',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              color: 'rgba(255,255,255,0.3)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              userSelect: 'none',
            }}>
              ?
            </div>

            {/* Card front */}
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              borderRadius: 8,
              backgroundColor: card.matched ? '#1a3a2e' : '#1a1a2e',
              border: card.matched ? '2px solid #22c55e' : '2px solid #3a3a5e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              userSelect: 'none',
            }}>
              {card.emoji}
            </div>
          </div>
        ))}
      </div>

      {matchedPairs === 8 && (
        <div style={{
          fontSize: 20, fontWeight: 700,
          color: '#22c55e',
          padding: '8px 16px',
          borderRadius: 8,
          backgroundColor: 'rgba(34,197,94,0.15)',
        }}>
          All pairs matched!
        </div>
      )}

      <div style={{ color: '#64748b', fontSize: 13 }}>
        Click cards to flip and find matching pairs
      </div>
    </div>
  );
};

export default GameMemory;
