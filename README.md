# Prompta — Full Concept Analysis

This is a genuinely creative idea.

## 🧠 Core Concept

Two players compete not just with reflexes, but with **creativity and speed of thought**. Prompts are the "magic spells" — the better your imagination and the faster you write, the stronger your moves. It's a fusion of:

- A traditional 2D fighter (movement, HP, collision)
- A language/creativity game (prompt writing)
- A real-time strategy element (when do you spend your "prompt turn"?)

---

## 🏗️ Architecture Breakdown

### 1. The Game Engine Layer
Handles the physical world:
- 2D battleground with gravity, platforms, and collision
- Character sprites/avatars moving around
- HP bars, timers, powerup items on the map
- Joystick/keyboard input for movement, jump, and basic attack

### 2. The Prompt Layer
Handles the "imagination battle":
- A prompt input field appears during designated windows
- Player types a prompt → sent to an AI (Claude) to be **evaluated and translated into a game effect**
- The AI acts as the **referee + magic system**

### 3. The Judge (AI Core)
This is the most critical and interesting piece. Claude evaluates both prompts and decides:
- What ability does this prompt grant? (speed boost, shield, fireball, etc.)
- How powerful is it? (based on creativity, specificity, context)
- Does it counter the opponent's prompt? (rock-paper-scissors style resolution)
- Does it violate the rules?

## ⚖️ The Rules Problem (Most Important Design Challenge)

Without rules, prompt battles become absurd instantly:
- "I am omnipotent and delete the opponent from existence"
- "I have infinite HP"

**Proposed rule layers:**

| Rule | Description |
|------|-------------|
| **Lore Lock** | Your prompt must fit your chosen character's archetype. A wizard can't suddenly have a gun. |
| **Power Budget** | Each prompt is scored 1–10 for power. You have a budget per round. |
| **Cooldown** | After a strong prompt, you must wait longer before the next one. |
| **Counters exist** | Every ability has a weakness — the AI knows this. Speed loses to prediction. Fire loses to water. |
| **Creativity bonus** | Generic prompts ("I am strong") get low scores. Creative, specific prompts get bonuses. |
| **No meta-prompts** | "I am immune to all prompts" or "I win" are auto-rejected. |

## ⏱️ Timing & Flow

```
Game Start
│
├─ [5s] Character selection + naming
├─ [5s] Opening prompt — define your character's core power
│
└─ BATTLE LOOP
    ├─ Players move freely with the joystick
    ├─ Powerup spawns on map → player picks it up
    │     └─ [5s prompt window opens] → player writes a prompt
    │           └─ AI evaluates → grants an ability for X seconds
    ├─ Ability activates (visual effect + stat change)
    ├─ [Optional] Direct prompt clash — if both players pick up at the same time
    │     └─ Both write prompts → AI judges whose wins → loser takes damage
    └─ Repeat until HP → 0
```

## 🎮 Game Modes to Consider

| Mode | Description |
|------|-------------|
| **Classic** | Powerups trigger prompt windows. Best of 3 rounds. |
| **Debate Duel** | Every 15 seconds, both players write simultaneously. AI picks a winner. Direct clash. |
| **Story Mode** | AI builds a narrative — your prompts must fit the evolving story. |
| **Speed Round** | 3-second prompt windows only. Pure instinct. |

## 🖥️ Tech Stack Options

Since we're building in the browser (Artefact), here's what's realistic:

| Component | Technology |
|-----------|-----------|
| Game engine | HTML5 Canvas or a lightweight JS lib like Kaboom.js |
| Prompt evaluation | Anthropic API (Claude) |
| Multiplayer | Same-screen (easiest), or WebSockets for online |
| Characters | CSS/SVG sprites or pixel art |
| State | In-memory JS (or persistent storage for scores) |

## 🚧 Biggest Technical Challenges

1. **AI latency** — Claude takes 1–3 seconds to respond. This needs to feel like part of the game, not a bug. (The "casting" animation solves this.)
2. **Fairness arbitration** — When both prompts are submitted, Claude must judge consistently.
3. **Same-screen multiplayer** — Two keyboards on one screen is awkward. Needs careful key mapping.
4. **Prompt-to-mechanic translation** — Claude needs a very tight system prompt to produce structured game effects (e.g. JSON: `{ "effect": "speed_boost", "multiplier": 1.8, "duration": 5 }`)

## 📐 Simple Version (v0) — What We Built First

Here's what the first version looks like:

- **One screen**, two players (WASD vs Arrow keys)
- **Two characters** (pre-made, players pick from a small list)
- **One flat arena** with 2–3 powerup spawn points
- **When a powerup is grabbed**, a 5-second text box appears for that player
- **Claude evaluates the prompt** and grants one of ~10 possible abilities (speed, shield, fireball, heal, freeze, etc.)
- **Ability activates** with a visual cue for 5–8 seconds
- **HP bars** — first to 0 loses
- **No online multiplayer yet** — same keyboard


**Architecture for this build:**
- Full HTML file with Canvas game engine
- Stick figures with walk/attack/jump/hurt animations
- Ground + elevated platforms
- Simultaneous prompt clash → Claude judges → winner gets ability, loser takes damage
- Desktop: WASD+F vs Arrow Keys+L
- Mobile: Two virtual D-pads at bottom corners (transparent overlay on canvas)
- 5 abilities: speed boost, shield, fireball, freeze, heal**PROMPTA v0 is live.** Here's everything that's in it:

**How to play:**
- Both players pick a name and archetype (Warrior / Ninja / Mage / Tank)
- A ⭐ power star spawns on the arena every ~14 seconds — grab it first
- The moment anyone touches it, both players get **7 seconds** to type their prompt simultaneously
- Hit **LOCK IN** (or let the timer run out) — Claude judges both prompts and picks a winner
- Winner gets an ability, loser takes damage

**5 abilities Claude can grant:**
| Ability | Effect |
|---|---|
| ⚡ Speed Boost | 2.2x movement speed for 9 seconds |
| 🛡 Shield | Absorbs the next hit completely |
| 🔥 Fireball | Launches a projectile at the opponent |
| ❄️ Freeze | Opponent can barely move for 9 seconds |
| 💚 Heal | Restores 25 HP |

**Controls:**
- P1: `WASD` to move, `F` to attack
- P2: `Arrow keys` to move, `L` to attack
- Mobile: virtual D-pads at bottom corners

**What's next for v2:**
- Opening 5-second character-defining prompt (your character's core power)
- More abilities and archetype-specific powers
- Projectile dodging / mid-air attacks
- Sound effects + combo system
- Online multiplayer (WebSockets)
