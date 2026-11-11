import Phaser from 'phaser';
import type { PhaseKey, PhaseNotice } from '../core/phases';
import {
  createDivider,
  createIcon,
  createMedallion,
  createPanel,
  createVignette,
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
  // Белая вспышка в точке попадания.
  const flash = scene.add.circle(x, y, 8, 0xffffff, 0.85).setDepth(23);
  scene.tweens.add({
    targets: flash,
    scale: 2.2,
    alpha: 0,
    duration: 120,
    onComplete: () => flash.destroy(),
  });

  const ring = scene.add.circle(x, y, 10, 0x38bdf8, 0.6).setDepth(22);
  scene.tweens.add({
    targets: ring,
    scale: 1.8,
    alpha: 0,
    duration: 160,
    onComplete: () => ring.destroy(),
  });

  // Короткие искры-штрихи разлетаются от точки удара.
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.4;
    const spark = scene.add
      .rectangle(x, y, 7, 1.6, i % 2 === 0 ? 0xe0f2fe : 0x7dd3fc)
      .setRotation(angle)
      .setDepth(23);

    scene.tweens.add({
      targets: spark,
      x: x + Math.cos(angle) * Phaser.Math.Between(16, 26),
      y: y + Math.sin(angle) * Phaser.Math.Between(16, 26),
      alpha: 0,
      duration: 170,
      onComplete: () => spark.destroy(),
    });
  }
}

/** Вспышка у факела в момент выстрела. */
export function createShotFlash(scene: Phaser.Scene, x: number, y: number): void {
  const flash = scene.add
    .circle(x, y, 14, 0x7dd3fc, 0.55)
    .setDepth(23)
    .setBlendMode(Phaser.BlendModes.ADD);

  scene.tweens.add({
    targets: flash,
    scale: 1.6,
    alpha: 0,
    duration: 140,
    onComplete: () => flash.destroy(),
  });
}

export function createDeathEffect(scene: Phaser.Scene, x: number, y: number, color: number): void {
  // Дым расходится медленнее искр и даёт объём.
  for (let i = 0; i < 3; i++) {
    const smoke = scene.add.circle(
      x + Phaser.Math.Between(-8, 8),
      y + Phaser.Math.Between(-8, 8),
      Phaser.Math.Between(6, 10),
      0x1e293b,
      0.32
    ).setDepth(21);

    scene.tweens.add({
      targets: smoke,
      y: smoke.y - Phaser.Math.Between(14, 24),
      scale: 2.2,
      alpha: 0,
      duration: 480 + i * 80,
      onComplete: () => smoke.destroy(),
    });
  }

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
      duration: 320,
      onComplete: () => p.destroy(),
    });
  }

  // Угли уходят вверх, как в лагере.
  for (let i = 0; i < 4; i++) {
    const ember = scene.add.circle(
      x + Phaser.Math.Between(-10, 10),
      y + Phaser.Math.Between(-6, 6),
      Phaser.Math.FloatBetween(1.4, 2.4),
      0xfbbf24,
      0.85
    ).setDepth(22);

    scene.tweens.add({
      targets: ember,
      y: ember.y - Phaser.Math.Between(24, 42),
      x: ember.x + Phaser.Math.Between(-10, 10),
      alpha: 0,
      duration: 520,
      onComplete: () => ember.destroy(),
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

  const ring = scene.add.circle(x, y, 22, 0xef4444, 0).setStrokeStyle(3, 0xf87171, 0.8).setDepth(26);
  scene.tweens.add({
    targets: ring,
    scale: 2.4,
    alpha: 0,
    duration: 320,
    onComplete: () => ring.destroy(),
  });

  // Красная виньетка по краям: урон читается даже боковым зрением.
  const vignette = createVignette(scene, scene.scale.width, scene.scale.height, 0xdc2626, 0.85)
    .setDepth(27)
    .setAlpha(0.75);

  scene.tweens.add({
    targets: vignette,
    alpha: 0,
    duration: 420,
    onComplete: () => vignette.destroy(),
  });
}

/** Взрыв мученика: ударная волна, подпалина и разлетающиеся частицы. */
export function createExplosionEffect(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number
): void {
  const flash = scene.add.circle(x, y, radius * 0.5, 0xfef08a, 0.6).setDepth(23);
  scene.tweens.add({
    targets: flash,
    scale: 1.6,
    alpha: 0,
    duration: 180,
    onComplete: () => flash.destroy(),
  });

  const wave = scene.add.circle(x, y, 18, 0xf97316, 0).setStrokeStyle(4, 0xfbbf24, 0.8).setDepth(23);
  scene.tweens.add({
    targets: wave,
    scale: radius / 18,
    alpha: 0,
    duration: 340,
    onComplete: () => wave.destroy(),
  });

  // Подпалина остаётся на полу и медленно остывает.
  const scorch = scene.add.ellipse(x, y, radius * 1.4, radius * 0.85, 0x05070c, 0.5).setDepth(8);
  scene.tweens.add({
    targets: scorch,
    alpha: 0,
    duration: 4200,
    onComplete: () => scorch.destroy(),
  });

  for (let i = 0; i < 14; i++) {
    const p = scene.add.circle(x, y, Phaser.Math.Between(3, 6), 0xef4444).setDepth(22);
    const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.3;
    const dist = Phaser.Math.Between(radius * 0.5, radius);
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      scale: 0,
      duration: 380,
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
