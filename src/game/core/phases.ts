// ============================================================================
// ФАЗЫ ФАКЕЛА
// Пороги очков, свойства фаз и условие их активации.
//
// Как менять:
// - КОГДА фазы переключаются → правится только функция getPhase() внизу;
// - ЧТО делает фаза (свет, замедление персонажа, уведомление) →
//   правится только таблица PHASES;
// - GameScene лишь применяет текущую фазу и о порогах ничего не знает.
// ============================================================================

export type PhaseKey = 'LIGHT' | 'DARK';

/** Пороги очков, при которых факел переключается между фазами. */
export const PHASE_SCORING = {
  /** Сколько очков набрать при свете, чтобы факел погас. */
  LIGHT_SCORE: 20,
  /** Сколько очков набрать во тьме, чтобы факел загорелся снова. */
  DARK_SCORE: 10,
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
      body: `Набери ещё ${PHASE_SCORING.DARK_SCORE} очков, чтобы вернуть свет`,
      color: '#ef4444',
    },
  },
};

/**
 * Условие активации фазы: чистая функция от общего счёта.
 * Свет держится, пока набрано меньше LIGHT_SCORE; после этого тьма идёт
 * ровно DARK_SCORE очков, потом снова свет — и так по кругу.
 * Нужно другое правило (по времени, здоровью) — меняется только эта функция.
 */
export function getPhase(totalScore: number): PhaseKey {
  const { LIGHT_SCORE, DARK_SCORE } = PHASE_SCORING;
  const inDark = totalScore - LIGHT_SCORE;

  if (inDark < 0) return 'LIGHT';
  return inDark % (LIGHT_SCORE + DARK_SCORE) < DARK_SCORE ? 'DARK' : 'LIGHT';
}
