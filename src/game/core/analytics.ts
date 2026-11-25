// ============================================================================
// ЯНДЕКС.МЕТРИКА
// Единственная точка отправки игровых событий. Счётчик вставляется в
// index.html, а здесь только обёртка: если скрипт Метрики заблокирован или
// не загрузился, игра продолжает работать как обычно.
// Карта событий и их параметры описаны в README.md и CHANGELOG.md.
// ============================================================================

/** Параметры события: короткие строки, числа и флаги, без персональных данных. */
type Params = Record<string, string | number | boolean>;

/** Подпись window.ym: из всего API нам нужен только reachGoal. */
type Metrika = (id: number, method: 'reachGoal', goal: string, params: Params) => void;

/** Номер счётчика Метрики (Настройки → Счётчик в интерфейсе Метрики). */
const COUNTER_ID = 114661692;

/** Версия игры уходит в каждом событии, чтобы отличать данные после обновлений. */
const GAME_VERSION = '1.0.0';

/** Номер попытки в текущем визите; сбрасывается при перезагрузке страницы. */
let attempt = 0;

/** Начинает новую попытку и возвращает её номер: 1, 2, 3… */
export function startAttempt(): number {
  attempt += 1;
  return attempt;
}

/** Отправляет цель в Метрику. Без счётчика молча ничего не делает. */
export function track(event: string, params: Params = {}): void {
  const data = { ...params, game_version: GAME_VERSION };

  // В dev-сборке видно, какие события и параметры уходят — удобно проверять.
  if (import.meta.env.DEV) console.log('[analytics]', event, data);

  const ym = (window as Window & { ym?: Metrika }).ym;
  if (typeof ym !== 'function') return;

  try {
    ym(COUNTER_ID, 'reachGoal', event, data);
  } catch (error) {
    console.warn('Analytics error', error);
  }
}
