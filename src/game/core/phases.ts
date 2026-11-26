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
  LIGHT_SCORE: 25,
  /** Сколько очков набрать во тьме, чтобы факел загорелся снова. */
  DARK_SCORE: 15,
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
  /** Цвет контура по границе света. */
  ringColor: number;
  /** Множитель скорости персонажа (1 — без замедления). */
  playerSpeedFactor: number;
  /** Что показать игроку при смене фазы. */
  notice: PhaseNotice;
}

export const PHASES: Record<PhaseKey, PhaseDefinition> = {
  LIGHT: {
    lightRadius: 200,
    ringColor: 0xfbbf24,
    playerSpeedFactor: 1,
    notice: {
      title: 'СВЕТ ВОЗВРАЩАЕТСЯ',
      body: 'Враги снова замедлены в круге света · Факел горит ярко',
      color: '#fbbf24',
    },
  },
  DARK: {
    lightRadius: 90,
    ringColor: 0xef4444,
    playerSpeedFactor: 0.85,
    notice: {
      title: 'ФАКЕЛ ГАСНЕТ',
      body: `Свет сузился, движение медленнее · Набери ${PHASE_SCORING.DARK_SCORE} очков, чтобы вернуть пламя`,
      color: '#ef4444',
    },
  },
};

export interface PhaseProgress {
  phase: PhaseKey;
  /** Фаза, которая наступит следующей. */
  next: PhaseKey;
  /** Сколько очков осталось до переключения. */
  pointsToNext: number;
  /** Длина текущей фазы в очках. */
  phaseLength: number;
  /** Прогресс внутри фазы: 0 — только началась, 1 — вот-вот сменится. */
  progress: number;
}

/**
 * То же условие, что и в getPhase, но с данными для шкалы HUD.
 * thresholdMultiplier меньше 1 ускоряет смену фаз (испытание «Быстрая тьма»).
 */
export function getPhaseProgress(
  totalScore: number,
  thresholdMultiplier = 1
): PhaseProgress {
  const LIGHT_SCORE = PHASE_SCORING.LIGHT_SCORE * thresholdMultiplier;
  const DARK_SCORE = PHASE_SCORING.DARK_SCORE * thresholdMultiplier;

  if (totalScore < LIGHT_SCORE) {
    return {
      phase: 'LIGHT',
      next: 'DARK',
      pointsToNext: Math.ceil(LIGHT_SCORE - totalScore),
      phaseLength: LIGHT_SCORE,
      progress: totalScore / LIGHT_SCORE,
    };
  }

  const inDark = totalScore - LIGHT_SCORE;
  const cycle = LIGHT_SCORE + DARK_SCORE;
  const position = inDark % cycle;

  if (position < DARK_SCORE) {
    return {
      phase: 'DARK',
      next: 'LIGHT',
      pointsToNext: Math.ceil(DARK_SCORE - position),
      phaseLength: DARK_SCORE,
      progress: position / DARK_SCORE,
    };
  }

  const lightElapsed = position - DARK_SCORE;
  return {
    phase: 'LIGHT',
    next: 'DARK',
    pointsToNext: Math.ceil(LIGHT_SCORE - lightElapsed),
    phaseLength: LIGHT_SCORE,
    progress: lightElapsed / LIGHT_SCORE,
  };
}

/**
 * Условие активации фазы: чистая функция от общего счёта.
 * Свет держится, пока набрано меньше LIGHT_SCORE; после этого тьма идёт
 * ровно DARK_SCORE очков, потом снова свет — и так по кругу.
 * Нужно другое правило (по времени, здоровью) — меняется только эта функция.
 */
export function getPhase(totalScore: number, thresholdMultiplier = 1): PhaseKey {
  const LIGHT_SCORE = PHASE_SCORING.LIGHT_SCORE * thresholdMultiplier;
  const DARK_SCORE = PHASE_SCORING.DARK_SCORE * thresholdMultiplier;
  const inDark = totalScore - LIGHT_SCORE;

  if (inDark < 0) return 'LIGHT';
  return inDark % (LIGHT_SCORE + DARK_SCORE) < DARK_SCORE ? 'DARK' : 'LIGHT';
}
