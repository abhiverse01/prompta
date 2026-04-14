'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { CHARACTERS, CharacterConfig } from '@/game/characters';
import { GameEngine } from '@/game/engine';

export default function GamePage() {
  const [phase, setPhase] = useState<'select' | 'loading' | 'playing' | 'error'>('select');
  const [selectedChar, setSelectedChar] = useState<CharacterConfig | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Clean up engine on unmount
  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  // Create engine when entering playing phase
  useEffect(() => {
    if (phase !== 'playing' || !canvasRef.current || !hudRef.current || !selectedChar) return;

    // Dispose any previous engine to prevent duplicates
    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }

    let disposed = false;

    const timer = setTimeout(() => {
      if (disposed || !canvasRef.current || !hudRef.current) return;

      try {
        engineRef.current = new GameEngine(
          canvasRef.current,
          {
            id: selectedChar.id,
            name: selectedChar.name,
            color: selectedChar.color,
            accent: selectedChar.accent,
          },
          playerName || selectedChar.name,
          hudRef.current
        );
      } catch (err) {
        console.error('[Page] Failed to create game engine:', err);
        if (!disposed) {
          setErrorMsg(err instanceof Error ? err.message : 'Failed to start the game engine');
          setPhase('error');
        }
      }
    }, 100);

    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [phase, selectedChar, playerName]);

  const handleEnter = useCallback(() => {
    if (!selectedChar) return;
    setErrorMsg('');
    setPhase('loading');
    setTimeout(() => setPhase('playing'), 1800);
  }, [selectedChar]);

  const handleRetry = useCallback(() => {
    setErrorMsg('');
    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }
    setPhase('select');
  }, []);

  // ── Phase Routing ──────────────────────────────────────────────

  if (phase === 'select') {
    return (
      <CharacterSelect
        selected={selectedChar}
        onSelect={setSelectedChar}
        name={playerName}
        onNameChange={setPlayerName}
        onEnter={handleEnter}
      />
    );
  }

  if (phase === 'loading') {
    return <LoadingScreen character={selectedChar!} />;
  }

  if (phase === 'error') {
    return <ErrorScreen message={errorMsg} onRetry={handleRetry} />;
  }

  // ── Playing Phase ──────────────────────────────────────────────
  return (
    <div className="game-wrapper">
      <canvas ref={canvasRef} className="game-canvas" />
      <div ref={hudRef} className="game-hud-layer" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CHARACTER SELECTION
   ═══════════════════════════════════════════════════════════════════ */

function CharacterSelect({
  selected,
  onSelect,
  name,
  onNameChange,
  onEnter,
}: {
  selected: CharacterConfig | null;
  onSelect: (c: CharacterConfig) => void;
  name: string;
  onNameChange: (n: string) => void;
  onEnter: () => void;
}) {
  return (
    <div className="cs-root">
      <div className="cs-bg" />
      <div className="cs-vignette" />

      <div className="cs-container">
        <h1 className="cs-title">
          <span className="cs-title-text">Enter the Realm</span>
        </h1>
        <p className="cs-subtitle">
          Choose your champion and step into a living, breathing world alongside other adventurers.
        </p>

        <div className="cs-grid">
          {CHARACTERS.map((c) => (
            <button
              key={c.id}
              className={`cs-card ${selected?.id === c.id ? 'cs-card--active' : ''}`}
              onClick={() => onSelect(c)}
              style={
                { '--card-color': c.color, '--card-accent': c.accent } as React.CSSProperties
              }
            >
              <div className="cs-card__shimmer" />
              <div className="cs-card__icon">{c.icon}</div>
              <div className="cs-card__name">{c.name}</div>
              <div className="cs-card__title">{c.title}</div>
              <div className="cs-card__desc">{c.description}</div>
              {selected?.id === c.id && (
                <div className="cs-card__badge">Selected</div>
              )}
            </button>
          ))}
        </div>

        <div className="cs-footer">
          <input
            className="cs-input"
            type="text"
            maxLength={20}
            placeholder="Enter your name..."
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onEnter()}
          />
          <button
            className={`cs-btn ${selected ? 'cs-btn--ready' : 'cs-btn--disabled'}`}
            disabled={!selected}
            onClick={onEnter}
          >
            {selected ? `Enter as ${selected.name}` : 'Select a Character'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LOADING SCREEN
   ═══════════════════════════════════════════════════════════════════ */

function LoadingScreen({ character }: { character: CharacterConfig }) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 400);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="ld-root"
      style={{ '--ld-color': character.color } as React.CSSProperties}
    >
      <div className="ld-glow" />
      <div className="ld-content">
        <div className="ld-icon">{character.icon}</div>
        <h2 className="ld-name">{character.name}</h2>
        <p className="ld-title">{character.title}</p>
        <div className="ld-bar">
          <div className="ld-bar__fill" />
        </div>
        <p className="ld-text">Entering the world{dots}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ERROR SCREEN
   ═══════════════════════════════════════════════════════════════════ */

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="err-root">
      <div className="err-content">
        <div className="err-icon">!</div>
        <h2 className="err-title">Something Went Wrong</h2>
        <p className="err-msg">{message || 'The game engine failed to start.'}</p>
        <button className="err-btn" onClick={onRetry}>Go Back</button>
      </div>
    </div>
  );
}
