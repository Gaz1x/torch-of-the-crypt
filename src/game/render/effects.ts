import Phaser from 'phaser';
import type { PhaseKey, PhaseNotice } from '../core/phases';
import {
  createDivider,
  createIcon,
  createMedallion,
  createPanel,
  UI_COLORS,
  UI_DEPTH,
  UI_FONT,
} from './uiKit';

// ============================================================================
// ВИЗУАЛЬНЫЕ ЭФФЕКТЫ
// Искры, взрывы, всплывающий текст и очередь крупных уведомлений
// (волна / смена фазы). Уведомления не перекрывают друг друга и меню.
// ============================================================================

export function createHitSpark(scene: Phaser.Scene, x: number, y: number): void {
  const ring = scene.add.circle(x, y, 10, 0x38bdf8, 0.6).setDepth(22);
  scene.tweens.add({
    targets: ring,
    scale: 1.8,
    alpha: 0,
    duration: 150,
    onComplete: () => ring.destroy(),
  });
}

export function createDeathEffect(scene: Phaser.Scene, x: number, y: number, color: number): void {
  for (let i = 0; i < 8; i++) {
    const p = scene.add.circle(x, y, Phaser.Math.Between(3, 7), color).setDepth(22);
    const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
    const dist = Phaser.Math.Between(18, 42);
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      scale: 0,
      duration: 300,
      onComplete: () => p.destroy(),
    });
  }
}

export function createDamageEffect(scene: Phaser.Scene, x: number, y: number): void {
  const flash = scene.add.circle(x, y, 48, 0xef4444, 0.55).setDepth(26);
  scene.tweens.add({
    targets: flash,
    scale: 1.9,
    alpha: 0,
    duration: 260,
    onComplete: () => flash.destroy(),
  });
}

/** Взрыв мученика: большое кольцо + разлетающиеся частицы. */
export function createExplosionEffect(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number
): void {
  const ring = scene.add.circle(x, y, 18, 0xf97316, 0.5).setDepth(22);
  scene.tweens.add({
    targets: ring,
    scale: radius / 18,
    alpha: 0,
    duration: 320,
    onComplete: () => ring.destroy(),
  });

  for (let i = 0; i < 12; i++) {
    const p = scene.add.circle(x, y, Phaser.Math.Between(3, 6), 0xef4444).setDepth(22);
    const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.3;
    const dist = Phaser.Math.Between(radius * 0.5, radius);
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      scale: 0,
      duration: 360,
      onComplete: () => p.destroy(),
    });
  }
}

export function showFloatingText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  message: string,
  color: string
): void {
  const txt = scene.add.text(x, y, message, {
    fontFamily: UI_FONT.body,
    fontSize: '13px',
    fontStyle: 'bold',
    color,
    stroke: '#05070c',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(28);

  scene.tweens.add({
    targets: txt,
    y: y - 24,
    alpha: 0,
    duration: 700,
    onComplete: () => txt.destroy(),
  });
}

// ============================================================================
// ОЧЕРЕДЬ УВЕДОМЛЕНИЙ
// ============================================================================

type NoticeKind = 'wave' | 'phase';

interface NoticeSpec {
  kind: NoticeKind;
  title: string;
  badge: string;
  detail: string;
  accent: number;
  duration: number;
  wave?: number;
  phase?: PhaseKey;
  /** Сырой номер волны для большого водяного знака. */
  watermark?: string;
}

interface NoticeState {
  busy: boolean;
  items: NoticeSpec[];
  active: Phaser.GameObjects.Container | null;
  timer: Phaser.Time.TimerEvent | null;
}

const noticeStates = new WeakMap<Phaser.Scene, NoticeState>();

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function roman(value: number): string {
  return ROMAN[value - 1] ?? `${value}`;
}

function getState(scene: Phaser.Scene): NoticeState {
  let state = noticeStates.get(scene);
  if (!state) {
    state = { busy: false, items: [], active: null, timer: null };
    noticeStates.set(scene, state);
  }
  return state;
}

function buildWaveCard(scene: Phaser.Scene, spec: NoticeSpec): Phaser.GameObjects.Container {
  const container = scene.add
    .container(scene.scale.width / 2, 300)
    .setDepth(UI_DEPTH.notice);

  const panel = createPanel(scene, -280, -75, 560, 150, spec.accent);
  container.add(panel);

  if (spec.watermark) {
    const watermark = scene.add.text(238, 6, spec.watermark, {
      fontFamily: UI_FONT.display,
      fontSize: '104px',
      fontStyle: 'bold',
      color: '#f0c674',
    }).setOrigin(1, 0.5).setAlpha(0.1);
    container.add(watermark);
  }

  const badge = scene.add.text(0, -50, spec.badge, {
    fontFamily: UI_FONT.body,
    fontSize: '10px',
    fontStyle: 'bold',
    color: '#c7a86a',
    letterSpacing: 4,
  }).setOrigin(0.5);

  const title = scene.add.text(0, -16, spec.title, {
    fontFamily: UI_FONT.display,
    fontSize: '34px',
    fontStyle: 'bold',
    color: '#f4ecd8',
  }).setOrigin(0.5);

  const divider = createDivider(scene, 0, 10, 320, spec.accent);

  const detail = scene.add.text(0, 34, spec.detail, {
    fontFamily: UI_FONT.body,
    fontSize: '12px',
    color: '#a9b7c9',
    letterSpacing: 1,
  }).setOrigin(0.5);

  container.add([badge, title, divider, detail]);
  return container;
}

function buildPhaseCard(scene: Phaser.Scene, spec: NoticeSpec): Phaser.GameObjects.Container {
  const container = scene.add
    .container(scene.scale.width / 2, 178)
    .setDepth(UI_DEPTH.notice);

  const panel = createPanel(scene, -250, -46, 500, 92, spec.accent);
  container.add(panel);

  const medallion = createMedallion(scene, -202, 0, 28, spec.accent);
  const icon = createIcon(scene, -202, 0, 'torch', 34, spec.accent);
  container.add([medallion, icon]);

  const title = scene.add.text(-158, -30, spec.title, {
    fontFamily: UI_FONT.display,
    fontSize: '18px',
    fontStyle: 'bold',
    color: spec.accent === UI_COLORS.bloodBright ? '#fca5a5' : '#f0c674',
    letterSpacing: 1,
  });

  const detail = scene.add.text(-158, -3, spec.detail, {
    fontFamily: UI_FONT.body,
    fontSize: '11px',
    color: '#c3cedd',
    lineSpacing: 3,
    wordWrap: { width: 380 },
  });

  container.add([title, detail]);
  return container;
}

function playNext(scene: Phaser.Scene): void {
  const state = getState(scene);

  state.timer?.remove(false);
  state.timer = null;

  if (state.items.length === 0) {
    state.busy = false;
    state.active = null;
    return;
  }

  const spec = state.items.shift();
  if (!spec) return;

  state.busy = true;
  const container = spec.kind === 'wave'
    ? buildWaveCard(scene, spec)
    : buildPhaseCard(scene, spec);
  state.active = container;

  container.setAlpha(0);
  container.setScale(0.96);

  scene.tweens.add({
    targets: container,
    alpha: 1,
    scale: 1,
    duration: 220,
    ease: 'Cubic.easeOut',
  });

  state.timer = scene.time.delayedCall(spec.duration, () => {
    if (!container.active) {
      playNext(scene);
      return;
    }

    scene.tweens.add({
      targets: container,
      alpha: 0,
      y: container.y - 12,
      duration: 320,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        container.destroy();
        state.active = null;
        state.timer = scene.time.delayedCall(220, () => playNext(scene));
      },
    });
  });
}

function enqueueNotice(scene: Phaser.Scene, spec: NoticeSpec): void {
  const state = getState(scene);
  state.items.push(spec);
  if (!state.busy) {
    playNext(scene);
  }
}

/** Убирает активное уведомление и очередь (используется при входе в меню). */
export function clearAllNotices(scene: Phaser.Scene): void {
  const state = noticeStates.get(scene);
  if (!state) return;

  state.items = [];
  state.timer?.remove(false);
  state.timer = null;

  if (state.active) {
    scene.tweens.killTweensOf(state.active);
    state.active.destroy();
    state.active = null;
  }

  state.busy = false;
}

/** Карточка начала волны. */
export function showWaveNotice(
  scene: Phaser.Scene,
  wave: number,
  total: number,
  name: string,
  detail: string
): void {
  enqueueNotice(scene, {
    kind: 'wave',
    title: name,
    badge: `ВОЛНА ${roman(wave)} / ${roman(total)}`,
    detail,
    accent: UI_COLORS.emberBright,
    duration: 2000,
    wave,
    watermark: roman(wave),
  });
}

/** Карточка смены фазы с объяснением механики. */
export function showPhaseNotice(
  scene: Phaser.Scene,
  phase: PhaseKey,
  notice: PhaseNotice
): void {
  const accent = phase === 'LIGHT' ? UI_COLORS.emberBright : UI_COLORS.bloodBright;

  // Короткая вспышка по всему экрану — сразу читается краем глаза.
  const flash = scene.add
    .rectangle(
      scene.scale.width / 2,
      scene.scale.height / 2,
      scene.scale.width,
      scene.scale.height,
      accent,
      0.12
    )
    .setDepth(UI_DEPTH.notice - 1);

  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 480,
    onComplete: () => flash.destroy(),
  });

  enqueueNotice(scene, {
    kind: 'phase',
    title: notice.title,
    badge: 'ФАКЕЛ',
    detail: notice.body,
    accent,
    duration: 2600,
    phase,
  });
}
