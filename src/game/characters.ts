export interface CharacterConfig {
  id: number;
  name: string;
  title: string;
  color: string;
  accent: string;
  description: string;
  icon: string;
}

export const CHARACTERS: CharacterConfig[] = [
  {
    id: 0,
    name: 'Warrior',
    title: 'Guardian of the Realm',
    color: '#dc2626',
    accent: '#fca5a5',
    description: 'A stalwart fighter clad in crimson armor. Masters heavy blades and shields.',
    icon: '⚔️',
  },
  {
    id: 1,
    name: 'Mage',
    title: 'Weaver of Arcana',
    color: '#2563eb',
    accent: '#93c5fd',
    description: 'A sorcerer draped in azure robes. Commands the elements with ancient runes.',
    icon: '🔮',
  },
  {
    id: 2,
    name: 'Ranger',
    title: 'Warden of the Wild',
    color: '#16a34a',
    accent: '#86efac',
    description: 'A swift hunter clad in emerald cloaks. Strikes from afar with deadly precision.',
    icon: '🏹',
  },
  {
    id: 3,
    name: 'Rogue',
    title: 'Shadow of the Night',
    color: '#9333ea',
    accent: '#d8b4fe',
    description: 'A stealthy assassin in violet leathers. Moves unseen, strikes without warning.',
    icon: '🗡️',
  },
  {
    id: 4,
    name: 'Paladin',
    title: 'Beacon of Light',
    color: '#d97706',
    accent: '#fde68a',
    description: 'A holy knight in golden plate. Wields divine power to smite evil.',
    icon: '🛡️',
  },
  {
    id: 5,
    name: 'Necromancer',
    title: 'Lord of the Dead',
    color: '#0d9488',
    accent: '#5eead4',
    description: 'A dark sorcerer in teal vestments. Raises the fallen to do their bidding.',
    icon: '💀',
  },
];
