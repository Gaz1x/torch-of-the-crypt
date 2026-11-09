// ============================================================================
// НАСТРОЙКИ ИГРЫ
// Хранятся в localStorage. Если хранилище недоступно или данные повреждены,
// игра возвращается к значениям по умолчанию и продолжает работать.
// ============================================================================

export interface GameSettings {
  /** Громкость музыки: 0..1. */
  musicVolume: number;
  /** Громкость звуковых эффектов: 0..1. */
  sfxVolume: number;
  muted: boolean;
}

export const SETTINGS_STORAGE_KEY = 'torch-of-the-crypt:settings:v1';

export const DEFAULT_SETTINGS: GameSettings = {
  musicVolume: 0.5,
  sfxVolume: 0.7,
  muted: false,
};

function clamp01(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function sanitizeSettings(raw: unknown): GameSettings {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SETTINGS };

  const data = raw as Partial<Record<keyof GameSettings, unknown>>;
  return {
    musicVolume: clamp01(data.musicVolume, DEFAULT_SETTINGS.musicVolume),
    sfxVolume: clamp01(data.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
    muted: typeof data.muted === 'boolean' ? data.muted : DEFAULT_SETTINGS.muted,
  };
}

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Приватный режим или переполнение хранилища — не критично для игры.
  }
}
