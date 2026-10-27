// ============================================================================
// ФАЗЫ ФАКЕЛА
// Тайминги, свойства фаз и условие их активации.
//
// Как менять:
// - КОГДА фазы переключаются → правится только функция getPhase() внизу;
// - ЧТО делает фаза (свет, замедление персонажа, уведомление) →
//   правится только таблица PHASES;
// - GameScene лишь применяет текущую фазу и о таймингах ничего не знает.
// ============================================================================

export type PhaseKey = 'LIGHT' | 'DARK';

/** Тайминги цикла фаз в секундах от начала партии. */
export const PHASE_TIMING = {
  /** Сколько секунд в цикле факел горит. */
  LIGHT_DURATION: 30,
  /** Сколько секунд в цикле факел тухнет. */
  DARK_DURATION: 10,
} as const;

/** Уведомление, показываемое на экране при входе в фазу. */
export interface PhaseNotice {
  title: string;
  body: string;
  color: string;
}

export interface PhaseDefinition {
  /** Радиус света факела в пикселях. */
  lightRadius: number;
  /** Множитель скорости персонажа (1 — без замедления). */
  playerSpeedFactor: number;
  /** Что показать игроку при смене фазы. */
  notice: PhaseNotice;
}

export const PHASES: Record<PhaseKey, PhaseDefinition> = {
  LIGHT: {
    lightRadius: 210,
    playerSpeedFactor: 1,
    notice: {
      title: 'ФАКЕЛ ЗАГОРЕЛСЯ',
      body: 'Свет вернулся — враги снова замедлены',
      color: '#fbbf24',
    },
  },
  DARK: {
    lightRadius: 70,
    playerSpeedFactor: 0.8,
    notice: {
      title: 'ФАКЕЛ ПОГАС',
      body: `Тьма — ${PHASE_TIMING.DARK_DURATION} сек. Ты медленнее, враги свободны`,
      color: '#ef4444',
    },
  },
};

/**
 * Условие активации фазы: чистая функция от времени выживания.
 * Нужно переключать по счёту, здоровью или любому другому правилу —
 * меняется только эта функция.
 */
export function getPhase(elapsedSeconds: number): PhaseKey {
  const cycle = PHASE_TIMING.LIGHT_DURATION + PHASE_TIMING.DARK_DURATION;
  return elapsedSeconds % cycle < PHASE_TIMING.LIGHT_DURATION ? 'LIGHT' : 'DARK';
}
