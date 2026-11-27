// ============================================================================
// ОБЛИКИ СТРАЖА
// Косметика за достижения: цвет плаща, брони и камня. Никаких бонусов —
// только внешний вид рыцаря в крипте и в «Книге стража».
// ============================================================================

export interface KnightPalette {
  id: string;
  name: string;
  /** Сколько достижений нужно, чтобы открыть облик. */
  threshold: number;
  /** Плащ: внешний слой, внутренний и цвет складок. */
  cloakDark: number;
  cloak: number;
  cloakTrim: number;
  /** Броня: шлем и руки. */
  armor: number;
  /** Латунная окантовка. */
  metal: number;
  /** Камень посоха и прорезь забрала. */
  glow: number;
}

/** Облики идут по возрастанию порога: первый доступен сразу. */
export const PALETTES: KnightPalette[] = [
  {
    id: 'STEWARD',
    name: 'СТРАЖ',
    threshold: 0,
    cloakDark: 0x5b1414,
    cloak: 0x991b1b,
    cloakTrim: 0x450a0a,
    armor: 0x94a3b8,
    metal: 0xb08a4a,
    glow: 0x38bdf8,
  },
  {
    id: 'ASH',
    name: 'ПЕПЕЛ',
    threshold: 3,
    cloakDark: 0x1e293b,
    cloak: 0x475569,
    cloakTrim: 0x0f172a,
    armor: 0x94a3b8,
    metal: 0x94a3b8,
    glow: 0xe2e8f0,
  },
  {
    id: 'BRASS',
    name: 'ЛАТУНЬ',
    threshold: 6,
    cloakDark: 0x451a03,
    cloak: 0x92400e,
    cloakTrim: 0x1c0a00,
    armor: 0xb08a4a,
    metal: 0xf0c674,
    glow: 0xfbbf24,
  },
  {
    id: 'FROST',
    name: 'ИНЕЙ',
    threshold: 9,
    cloakDark: 0x0f1e4a,
    cloak: 0x1e3a8a,
    cloakTrim: 0x0a1230,
    armor: 0xbfdbfe,
    metal: 0x7dd3fc,
    glow: 0x7dd3fc,
  },
  {
    id: 'CRIMSON',
    name: 'БАГРЯНЕЦ',
    threshold: 12,
    cloakDark: 0x3f0a0a,
    cloak: 0x7f1d1d,
    cloakTrim: 0x1a0303,
    armor: 0xdc2626,
    metal: 0xf87171,
    glow: 0xfca5a5,
  },
  {
    id: 'FLAME',
    name: 'ПЛАМЯ',
    threshold: 15,
    cloakDark: 0x431407,
    cloak: 0x9a3412,
    cloakTrim: 0x1a0800,
    armor: 0xf59e0b,
    metal: 0xfde68a,
    glow: 0xffedd5,
  },
];

export const DEFAULT_PALETTE_ID = PALETTES[0].id;
export const DEFAULT_PALETTE = PALETTES[0];

export const PALETTE_IDS = PALETTES.map((palette) => palette.id);

export function getPalette(id: string | null | undefined): KnightPalette {
  return PALETTES.find((palette) => palette.id === id) ?? PALETTES[0];
}

/** Облик открыт, если набрано достаточно достижений. */
export function isPaletteUnlocked(palette: KnightPalette, achievements: number): boolean {
  return achievements >= palette.threshold;
}

/** Следующий облик и сколько достижений до него осталось; null — всё открыто. */
export function getNextPalette(
  achievements: number
): { palette: KnightPalette; remaining: number } | null {
  const next = PALETTES.find((palette) => palette.threshold > achievements);
  return next ? { palette: next, remaining: next.threshold - achievements } : null;
}
