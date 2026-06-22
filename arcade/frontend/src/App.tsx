import {
  type ComponentType,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type CatalogEntry,
  type ScoreEntry,
  type SubmitScoreResponse,
  getCoins,
  getScores,
  insertCoin,
  startGame,
  submitScore,
} from "./api/arcadeApi";

/* ================================================================
   Game registry — maps every game id to metadata + lazy component
   ================================================================ */

export interface GameProps {
  onGameOver: (score: number, won?: boolean, durationSeconds?: number) => void;
}

interface GameRegistryEntry {
  name: string;
  icon: string;
  component: React.LazyExoticComponent<ComponentType<GameProps>>;
}

const GAME_REGISTRY: Record<string, GameRegistryEntry> = {
  "2048-sprint": {
    name: "2048 Sprint",
    icon: "🔢",
    component: lazy(() => import("./games/Game2048")),
  },
  "minesweeper": {
    name: "Minesweeper Blitz",
    icon: "💣",
    component: lazy(() => import("./games/GameMinesweeper")),
  },
  "memory": {
    name: "Memory Match",
    icon: "🃏",
    component: lazy(() => import("./games/GameMemory")),
  },
  "stroop": {
    name: "Color Match",
    icon: "🎨",
    component: lazy(() => import("./games/GameStroop")),
  },
  "tetris": {
    name: "Tetris",
    icon: "🧱",
    component: lazy(() => import("./games/GameTetris")),
  },
  "snake": {
    name: "Snake",
    icon: "🐍",
    component: lazy(() => import("./games/GameSnake")),
  },
  "connect4": {
    name: "Connect 4",
    icon: "🔴",
    component: lazy(() => import("./games/GameConnect4")),
  },
  "tictactoe": {
    name: "Tic-Tac-Toe",
    icon: "❌",
    component: lazy(() => import("./games/GameTicTacToe")),
  },
  "breakout": {
    name: "Breakout",
    icon: "🧱",
    component: lazy(() => import("./games/GameBreakout")),
  },
  "flappy": {
    name: "Flappy Clone",
    icon: "🐦",
    component: lazy(() => import("./games/GameFlappy")),
  },
  "pong": {
    name: "Pong",
    icon: "🏓",
    component: lazy(() => import("./games/GamePong")),
  },
  "asteroids": {
    name: "Asteroids",
    icon: "☄️",
    component: lazy(() => import("./games/GameAsteroids")),
  },
  "frogger": {
    name: "Frogger",
    icon: "🐸",
    component: lazy(() => import("./games/GameFrogger")),
  },
  "invaders": {
    name: "Space Invaders",
    icon: "👾",
    component: lazy(() => import("./games/GameInvaders")),
  },
  "bubbles": {
    name: "Bubble Shooter",
    icon: "🫧",
    component: lazy(() => import("./games/GameBubbles")),
  },
};

/* ================================================================
   Shared inline-style constants (reference CSS variables as strings)
   ================================================================ */

const V = {
  bg: "var(--bg)",
  bgSecondary: "var(--bg-secondary)",
  cardBg: "var(--card-bg)",
  cardHover: "var(--card-hover)",
  border: "var(--border)",
  text: "var(--text)",
  textMuted: "var(--text-muted)",
  textDim: "var(--text-dim)",
  accent: "var(--accent)",
  accent2: "var(--accent-2)",
  success: "var(--success)",
  danger: "var(--danger)",
  warning: "var(--warning)",
  gold: "var(--gold)",
  mono: "var(--mono)",
  radius: "var(--radius)",
} as const;

/* ================================================================
   App
   ================================================================ */

type AppState =
  | { view: "dashboard" }
  | { view: "select"; sessionId: string; games: CatalogEntry[] }
  | { view: "playing"; gameId: string }
  | {
      view: "gameover";
      gameId: string;
      score: number;
      result: SubmitScoreResponse;
    };

export default function App() {
  const [state, setState] = useState<AppState>({ view: "dashboard" });
  const [balance, setBalance] = useState<number>(0);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gameStartTime = useRef<number>(0);

  /* ---- fetch initial data ---- */
  useEffect(() => {
    getCoins()
      .then((r) => setBalance(r.balance))
      .catch(() => {});
    getScores()
      .then(setScores)
      .catch(() => {});
  }, []);

  /* ---- refetch scores when returning to dashboard ---- */
  useEffect(() => {
    if (state.view === "dashboard") {
      getScores()
        .then(setScores)
        .catch(() => {});
      getCoins()
        .then((r) => setBalance(r.balance))
        .catch(() => {});
    }
  }, [state.view]);

  /* ---- handlers ---- */
  const handleInsertCoin = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await insertCoin();
      setState({ view: "select", sessionId: res.sessionId, games: res.games });
      setBalance((b) => Math.max(0, b - 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to insert coin");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectGame = useCallback(
    async (gameId: string) => {
      if (state.view !== "select") return;
      setLoading(true);
      setError(null);
      try {
        await startGame(state.sessionId, gameId);
        gameStartTime.current = Date.now();
        setState({ view: "playing", gameId });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start game");
      } finally {
        setLoading(false);
      }
    },
    [state],
  );

  const handleGameOver = useCallback(
    async (score: number, won?: boolean, durationSeconds?: number) => {
      if (state.view !== "playing") return;
      const elapsed =
        durationSeconds ?? Math.round((Date.now() - gameStartTime.current) / 1000);
      try {
        const result = await submitScore({
          gameId: state.gameId,
          score,
          durationSeconds: elapsed,
          won,
        });
        setState({ view: "gameover", gameId: state.gameId, score, result });
      } catch {
        setState({ view: "dashboard" });
      }
    },
    [state],
  );

  const backToDashboard = useCallback(() => {
    setState({ view: "dashboard" });
  }, []);

  /* ================================================================
     Render
     ================================================================ */

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ---------- Header ---------- */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 32px",
          borderBottom: `1px solid ${V.border}`,
          background: V.bgSecondary,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 32 }}>{"🎮"}</span>
          Arcade
        </h1>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 20,
            fontWeight: 700,
            fontFamily: V.mono,
            color: V.gold,
          }}
        >
          <span style={{ fontSize: 24 }}>{"🪙"}</span>
          {balance}
        </div>
      </header>

      {/* ---------- Error banner ---------- */}
      {error && (
        <div
          style={{
            padding: "10px 32px",
            background: "rgba(239, 68, 68, 0.15)",
            color: V.danger,
            fontSize: 14,
            borderBottom: `1px solid ${V.border}`,
          }}
        >
          {error}
        </div>
      )}

      {/* ---------- Main content ---------- */}
      <main style={{ flex: 1, padding: "32px" }}>
        {state.view === "dashboard" && (
          <Dashboard
            balance={balance}
            scores={scores}
            loading={loading}
            onInsertCoin={handleInsertCoin}
          />
        )}

        {state.view === "select" && (
          <GameSelection
            games={state.games}
            loading={loading}
            onSelect={handleSelectGame}
            onBack={backToDashboard}
          />
        )}

        {state.view === "playing" && (
          <GamePlayer gameId={state.gameId} onGameOver={handleGameOver} />
        )}

        {state.view === "gameover" && (
          <GameOverOverlay
            gameId={state.gameId}
            score={state.score}
            result={state.result}
            onBack={backToDashboard}
          />
        )}
      </main>
    </div>
  );
}

/* ================================================================
   Dashboard
   ================================================================ */

function Dashboard(props: {
  balance: number;
  scores: ScoreEntry[];
  loading: boolean;
  onInsertCoin: () => void;
}) {
  const { balance, scores, loading, onInsertCoin } = props;

  const scoreMap = new Map(scores.map((s) => [s.gameId, s]));

  return (
    <div>
      {/* Insert coin button */}
      {balance > 0 && (
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <button
            onClick={onInsertCoin}
            disabled={loading}
            style={{
              padding: "18px 48px",
              fontSize: 22,
              fontWeight: 800,
              fontFamily: V.mono,
              letterSpacing: "0.05em",
              color: "#fff",
              background: `linear-gradient(135deg, ${V.accent}, ${V.accent2})`,
              border: "none",
              borderRadius: V.radius,
              cursor: loading ? "wait" : "pointer",
              animation: "glowPulse 2s ease-in-out infinite",
              transition: "transform 0.15s ease",
              textTransform: "uppercase",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform =
                "scale(1.04)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform =
                "scale(1)";
            }}
          >
            {loading ? "Inserting..." : "🪙 Insert Coin"}
          </button>
        </div>
      )}

      {balance === 0 && (
        <div
          style={{
            textAlign: "center",
            marginBottom: 40,
            color: V.textMuted,
            fontSize: 18,
          }}
        >
          No coins available. Earn coins to play!
        </div>
      )}

      {/* Game stats grid */}
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 20,
          color: V.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Games
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {Object.entries(GAME_REGISTRY).map(([id, entry]) => {
          const stat = scoreMap.get(id);
          const played = stat && stat.timesPlayed > 0;

          return (
            <GameStatCard
              key={id}
              icon={entry.icon}
              name={entry.name}
              highScore={stat?.highScore ?? 0}
              lastScore={stat?.lastScore ?? 0}
              timesPlayed={stat?.timesPlayed ?? 0}
              played={!!played}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================
   GameStatCard
   ================================================================ */

function GameStatCard(props: {
  icon: string;
  name: string;
  highScore: number;
  lastScore: number;
  timesPlayed: number;
  played: boolean;
}) {
  const { icon, name, highScore, lastScore, timesPlayed, played } = props;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? V.cardHover : V.cardBg,
        border: `1px solid ${V.border}`,
        borderRadius: V.radius,
        padding: 20,
        transition: "background 0.15s ease, opacity 0.15s ease",
        opacity: played ? 1 : 0.45,
      }}
    >
      <div
        style={{
          fontSize: 32,
          marginBottom: 8,
          filter: played ? "none" : "grayscale(1)",
        }}
      >
        {icon}
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
        {name}
      </div>

      {played ? (
        <div style={{ fontSize: 12, color: V.textMuted, lineHeight: 1.8 }}>
          <div>
            <span style={{ color: V.gold, fontFamily: V.mono, fontWeight: 600 }}>
              {highScore.toLocaleString()}
            </span>{" "}
            high score
          </div>
          <div>
            <span style={{ fontFamily: V.mono }}>{lastScore.toLocaleString()}</span>{" "}
            last
          </div>
          <div>
            <span style={{ fontFamily: V.mono }}>{timesPlayed}</span>{" "}
            {timesPlayed === 1 ? "play" : "plays"}
          </div>
        </div>
      ) : (
        <div
          style={{
            fontSize: 12,
            color: V.textDim,
            fontStyle: "italic",
          }}
        >
          Not yet played
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Game Selection
   ================================================================ */

function GameSelection(props: {
  games: CatalogEntry[];
  loading: boolean;
  onSelect: (gameId: string) => void;
  onBack: () => void;
}) {
  const { games, loading, onSelect, onBack } = props;

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: V.textMuted,
          cursor: "pointer",
          fontSize: 14,
          marginBottom: 24,
          padding: 0,
        }}
      >
        {"←"} Back
      </button>

      <h2
        style={{
          textAlign: "center",
          fontSize: 24,
          fontWeight: 800,
          marginBottom: 8,
        }}
      >
        Choose Your Game
      </h2>
      <p
        style={{
          textAlign: "center",
          color: V.textMuted,
          fontSize: 14,
          marginBottom: 36,
        }}
      >
        Pick one of these three to play
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        {games.map((g) => {
          const reg = GAME_REGISTRY[g.id];
          const icon = reg?.icon ?? g.icon;
          const name = reg?.name ?? g.name;

          return (
            <SelectionCard
              key={g.id}
              icon={icon}
              name={name}
              type={g.type}
              description={g.description}
              disabled={loading}
              onClick={() => onSelect(g.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function SelectionCard(props: {
  icon: string;
  name: string;
  type: string;
  description: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const { icon, name, type, description, disabled, onClick } = props;
  const [hovered, setHovered] = useState(false);

  const typeBg =
    type === "timed"
      ? "rgba(245, 158, 11, 0.15)"
      : "rgba(34, 197, 94, 0.15)";
  const typeColor = type === "timed" ? V.warning : V.success;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? V.cardHover : V.cardBg,
        border: `1px solid ${hovered ? V.accent : V.border}`,
        borderRadius: V.radius,
        padding: 28,
        cursor: disabled ? "wait" : "pointer",
        textAlign: "center",
        transition: "all 0.2s ease",
        transform: hovered ? "translateY(-2px)" : "none",
        color: V.text,
        width: "100%",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
        {name}
      </div>
      <span
        style={{
          display: "inline-block",
          background: typeBg,
          color: typeColor,
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          padding: "3px 10px",
          borderRadius: 6,
          marginBottom: 12,
        }}
      >
        {type}
      </span>
      <p
        style={{
          color: V.textMuted,
          fontSize: 13,
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {description}
      </p>
    </button>
  );
}

/* ================================================================
   Game Player
   ================================================================ */

function GamePlayer(props: {
  gameId: string;
  onGameOver: (score: number, won?: boolean, durationSeconds?: number) => void;
}) {
  const { gameId, onGameOver } = props;
  const entry = GAME_REGISTRY[gameId];

  if (!entry) {
    return (
      <div style={{ textAlign: "center", color: V.danger, padding: 40 }}>
        Unknown game: {gameId}
      </div>
    );
  }

  const GameComponent = entry.component;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Suspense
        fallback={
          <div
            style={{
              textAlign: "center",
              padding: 60,
              color: V.textMuted,
              fontSize: 18,
            }}
          >
            Loading {entry.name}...
          </div>
        }
      >
        <GameComponent onGameOver={onGameOver} />
      </Suspense>
    </div>
  );
}

/* ================================================================
   Game Over Overlay
   ================================================================ */

function GameOverOverlay(props: {
  gameId: string;
  score: number;
  result: SubmitScoreResponse;
  onBack: () => void;
}) {
  const { gameId, score, result, onBack } = props;
  const entry = GAME_REGISTRY[gameId];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 10, 26, 0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: V.cardBg,
          border: `1px solid ${V.border}`,
          borderRadius: V.radius,
          padding: "48px 56px",
          textAlign: "center",
          maxWidth: 420,
          width: "90%",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>
          {result.isHighScore ? "🏆" : entry?.icon ?? "🎮"}
        </div>

        <h2
          style={{
            fontSize: 26,
            fontWeight: 800,
            marginBottom: 8,
            marginTop: 0,
          }}
        >
          {result.isHighScore ? "New High Score!" : "Game Over"}
        </h2>

        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            fontFamily: V.mono,
            color: result.isHighScore ? V.gold : V.text,
            marginBottom: 8,
          }}
        >
          {score.toLocaleString()}
        </div>

        {result.isHighScore && (
          <div
            style={{
              fontSize: 13,
              color: V.textMuted,
              marginBottom: 4,
            }}
          >
            Previous best:{" "}
            <span style={{ fontFamily: V.mono }}>
              {result.previousHigh.toLocaleString()}
            </span>
          </div>
        )}

        <div
          style={{
            fontSize: 14,
            color: V.textMuted,
            marginBottom: 32,
          }}
        >
          {entry?.name}
        </div>

        <button
          onClick={onBack}
          style={{
            padding: "14px 36px",
            fontSize: 15,
            fontWeight: 700,
            color: "#fff",
            background: `linear-gradient(135deg, ${V.accent}, ${V.accent2})`,
            border: "none",
            borderRadius: V.radius,
            cursor: "pointer",
            transition: "transform 0.15s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform =
              "scale(1.04)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          }}
        >
          {"🎮"} Back to Arcade
        </button>
      </div>
    </div>
  );
}
