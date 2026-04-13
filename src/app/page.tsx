'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { CHARACTERS, CharacterConfig } from '@/game/characters';
import { GameEngine } from '@/game/engine';

/* ─────────────────────────────────────────────────────────────────── */

export default function GamePage() {
  const [phase, setPhase] = useState<'select' | 'loading' | 'playing'>('select');
  const [selectedChar, setSelectedChar] = useState<CharacterConfig | null>(null);
  const [playerName, setPlayerName] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
    };
  }, []);

  // Initialise the game engine once we enter the playing phase
  useEffect(() => {
    if (phase !== 'playing' || !canvasRef.current || !hudRef.current || !selectedChar) return;

    // Small delay so the DOM is painted first
    const timer = setTimeout(() => {
      engineRef.current = new GameEngine(
        canvasRef.current!,
        {
          id: selectedChar.id,
          name: selectedChar.name,
          color: selectedChar.color,
          accent: selectedChar.accent,
        },
        playerName || selectedChar.name,
        hudRef.current!
      );
    }, 100);

    return () => clearTimeout(timer);
  }, [phase, selectedChar, playerName]);

  const handleEnter = useCallback(() => {
    if (!selectedChar) return;
    setPhase('loading');
    // Brief artificial loading screen for atmosphere
    setTimeout(() => setPhase('playing'), 1800);
  }, [selectedChar]);

  /* ── Character Selection ────────────────────────────────────── */
  if (phase === 'select') {
    return <CharacterSelect
      selected={selectedChar}
      onSelect={setSelectedChar}
      name={playerName}
      onNameChange={setPlayerName}
      onEnter={handleEnter}
    />;
  }

  /* ── Loading Screen ────────────────────────────────────────── */
  if (phase === 'loading') {
    return <LoadingScreen character={selectedChar!} />;
  }

  /* ── Game View ─────────────────────────────────────────────── */
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      <div ref={hudRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10 }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */

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
    <div className="select-screen">
      {/* Animated background particles */}
      <div className="select-bg-particles" />
      <div className="select-overlay" />

      <div className="select-container">
        <h1 className="select-title">
          <span className="title-glow">Enter the Realm</span>
        </h1>
        <p className="select-subtitle">
          Choose your champion and step into a living, breathing world alongside other adventurers.
        </p>

        {/* Character Grid */}
        <div className="char-grid">
          {CHARACTERS.map((c) => (
            <button
              key={c.id}
              className={`char-card ${selected?.id === c.id ? 'char-card--selected' : ''}`}
              onClick={() => onSelect(c)}
              style={{
                '--card-color': c.color,
                '--card-accent': c.accent,
              } as React.CSSProperties}
            >
              <div className="char-icon">{c.icon}</div>
              <div className="char-name">{c.name}</div>
              <div className="char-title">{c.title}</div>
              <div className="char-desc">{c.description}</div>
              {selected?.id === c.id && (
                <div className="char-selected-badge">Selected</div>
              )}
            </button>
          ))}
        </div>

        {/* Name Input */}
        <div className="name-row">
          <input
            className="name-input"
            type="text"
            maxLength={20}
            placeholder="Enter your name..."
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onEnter()}
          />
          <button
            className={`enter-btn ${selected ? 'enter-btn--ready' : ''}`}
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

/* ═══════════════════════════════════════════════════════════════════ */

function LoadingScreen({ character }: { character: CharacterConfig }) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loading-screen" style={{ '--load-color': character.color } as React.CSSProperties}>
      <div className="loading-bg" />
      <div className="loading-content">
        <div className="loading-icon">{character.icon}</div>
        <h2 className="loading-name">{character.name}</h2>
        <p className="loading-title">{character.title}</p>
        <div className="loading-bar-track">
          <div className="loading-bar-fill" />
        </div>
        <p className="loading-text">Entering the world{dots}</p>
      </div>
    </div>
  );
}
