import Phaser from 'phaser';

// ============================================================================
// UI-НАБОР
// Общая палитра, панели, иконки, кнопки и атмосферные эффекты для HUD и меню.
// Всё рисуется процедурно, без внешних ассетов и библиотек.
// ============================================================================

export const UI_COLORS = {
  void: 0x05070c,
  panelTop: 0x141d2d,
  panelBottom: 0x0a1019,
  panelLine: 0x334155,
  brass: 0xb08a4a,
  brassBright: 0xf0c674,
  ember: 0xf97316,
  emberBright: 0xfbbf24,
  blood: 0xdc2626,
  bloodBright: 0xf87171,
  mana: 0x38bdf8,
  manaDeep: 0x0284c7,
  text: 0xe8eef7,
  textMuted: 0x94a3b8,
  textDim: 0x64748b,
} as const;

export const UI_FONT = {
  /** Заголовки: системный serif, чтобы не тянуть шрифты из сети. */
  display: '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
  /** Интерфейс и описания. */
  body: '"Segoe UI", "Trebuchet MS", system-ui, sans-serif',
} as const;

export const UI_DEPTH = {
  hud: 30,
  notice: 35,
  overlay: 40,
} as const;

export type IconKind =
  | 'torch'
  | 'flame'
  | 'crystal'
  | 'star'
  | 'skull'
  | 'clock'
  | 'banner'
  | 'move'
  | 'aim'
  | 'bolt';

/** Превращает пары координат в точки, которые понимает Phaser.Graphics. */
function toPoints(coords: number[]): Phaser.Math.Vector2[] {
  const result: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < coords.length; i += 2) {
    result.push(new Phaser.Math.Vector2(coords[i], coords[i + 1]));
  }
  return result;
}

function lighten(color: number, percent: number): number {
  return Phaser.Display.Color.IntegerToColor(color).brighten(percent).color;
}

// ============================================================================
// ПАНЕЛИ
// ============================================================================

export interface PanelOptions {
  /** Дополнительное свечение вокруг панели. */
  glow?: boolean;
  /** Прозрачность всей панели. */
  alpha?: number;
}

/**
 * Панель с градиентом, двойной рамкой и руническими уголками.
 * Координаты локальные: (0, 0) — левый верхний угол.
 */
export function createPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: number = UI_COLORS.brass,
  options: PanelOptions = {}
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const graphics = scene.add.graphics();

  // Тень
  graphics.fillStyle(0x000000, 0.35);
  graphics.fillRoundedRect(3, 5, width, height, 10);

  // Основной градиент
  graphics.fillGradientStyle(
    UI_COLORS.panelTop,
    UI_COLORS.panelTop,
    UI_COLORS.panelBottom,
    UI_COLORS.panelBottom,
    1
  );
  graphics.fillRoundedRect(0, 0, width, height, 10);

  // Внешняя и внутренняя рамки
  graphics.lineStyle(1.5, accent, 0.85);
  graphics.strokeRoundedRect(1, 1, width - 2, height - 2, 10);
  graphics.lineStyle(1, UI_COLORS.panelLine, 0.65);
  graphics.strokeRoundedRect(6, 6, width - 12, height - 12, 7);

  // Рунические уголки
  const corner = 16;
  const inset = 7;
  graphics.lineStyle(2, accent, 0.6);
  const corners: [number, number, number, number][] = [
    [inset, inset + corner, inset, inset],
    [inset, inset, inset + corner, inset],
    [width - inset - corner, inset, width - inset, inset],
    [width - inset, inset, width - inset, inset + corner],
    [inset, height - inset - corner, inset, height - inset],
    [inset, height - inset, inset + corner, height - inset],
    [width - inset - corner, height - inset, width - inset, height - inset],
    [width - inset, height - inset - corner, width - inset, height - inset],
  ];
  for (const [x1, y1, x2, y2] of corners) {
    graphics.beginPath();
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);
    graphics.strokePath();
  }

  // Ромб по центру верхней кромки
  graphics.fillStyle(accent, 0.9);
  graphics.fillPoints(
    toPoints([width / 2, -5, width / 2 + 7, 0, width / 2, 5, width / 2 - 7, 0]),
    true
  );

  container.add(graphics);

  if (options.glow) {
    const glow = scene.add.circle(width / 2, height / 2, width * 0.55, accent, 0.06);
    container.addAt(glow, 0);
  }

  if (options.alpha !== undefined) {
    container.setAlpha(options.alpha);
  }

  return container;
}

/** Тонкий разделитель с ромбом по центру. */
export function createDivider(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  color: number = UI_COLORS.brass
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const graphics = scene.add.graphics();

  graphics.lineStyle(1, color, 0.55);
  graphics.lineBetween(-width / 2, 0, width / 2, 0);
  graphics.fillStyle(color, 0.9);
  graphics.fillPoints(
    toPoints([0, -5, 6, 0, 0, 5, -6, 0]),
    true
  );

  container.add(graphics);
  return container;
}

// ============================================================================
// ИКОНКИ
// Иконки рисуются в условной сетке 24×24 и масштабируются под нужный размер.
// ============================================================================

export function createIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  kind: IconKind,
  size: number,
  color: number = UI_COLORS.emberBright
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const graphics = scene.add.graphics();
  const scale = size / 24;

  const flame = (): void => {
    graphics.fillStyle(color, 0.16);
    graphics.fillCircle(0, -1, 11);
    graphics.fillStyle(color, 0.95);
    graphics.fillPoints(
      toPoints([0, -12, 6, -4, 5, 2, 0, 7, -5, 2, -6, -4]),
      true
    );
    graphics.fillStyle(0xfef3c7, 0.95);
    graphics.fillPoints(
      toPoints([0, -6, 3, -2, 2, 2, 0, 4, -2, 2, -3, -2]),
      true
    );
  };

  switch (kind) {
    case 'torch':
      graphics.fillStyle(0x6b4423, 1);
      graphics.fillRect(-2.5, 3, 5, 9);
      graphics.lineStyle(1, 0x3f2a16, 1);
      graphics.strokeRect(-2.5, 3, 5, 9);
      graphics.fillStyle(0xb08a4a, 1);
      graphics.fillRect(-4, 1, 8, 3);
      flame();
      break;

    case 'flame':
      flame();
      break;

    case 'crystal':
      graphics.fillStyle(color, 0.18);
      graphics.fillCircle(0, 0, 11);
      graphics.fillStyle(color, 0.95);
      graphics.fillPoints(
        toPoints([0, -11, 7, -1, 0, 11, -7, -1]),
        true
      );
      graphics.fillStyle(0xf0f9ff, 0.75);
      graphics.fillPoints(
        toPoints([-1, -7, 2, -1, -1, 3, -3, -1]),
        true
      );
      break;

    case 'star':
      graphics.fillStyle(color, 0.18);
      graphics.fillCircle(0, 0, 11);
      graphics.fillStyle(color, 0.95);
      graphics.fillPoints(
        toPoints([0, -11, 3, -3, 11, 0, 3, 3, 0, 11, -3, 3, -11, 0, -3, -3]),
        true
      );
      break;

    case 'skull':
      graphics.fillStyle(color, 0.95);
      graphics.fillCircle(0, -2, 8);
      graphics.fillRect(-5, 5, 10, 5);
      graphics.fillStyle(UI_COLORS.void, 1);
      graphics.fillCircle(-3.2, -2, 2.2);
      graphics.fillCircle(3.2, -2, 2.2);
      graphics.fillRect(-1.5, 3, 3, 3);
      break;

    case 'clock':
      graphics.lineStyle(2, color, 0.95);
      graphics.strokeCircle(0, 0, 9);
      graphics.lineStyle(2, color, 0.95);
      graphics.lineBetween(0, 0, 0, -5);
      graphics.lineBetween(0, 0, 4, 2);
      graphics.fillStyle(color, 1);
      graphics.fillCircle(0, 0, 1.6);
      break;

    case 'banner':
      graphics.fillStyle(color, 0.95);
      graphics.fillRect(-7, -9, 14, 12);
      graphics.fillStyle(UI_COLORS.void, 1);
      graphics.fillPoints(
        toPoints([-7, 3, 0, -1, 7, 3, 7, 9, 0, 5, -7, 9]),
        true
      );
      graphics.fillStyle(0x6b4423, 1);
      graphics.fillRect(-9, -11, 3, 22);
      break;

    case 'move':
      graphics.lineStyle(2, color, 0.95);
      graphics.lineBetween(0, -8, 0, 8);
      graphics.lineBetween(-8, 0, 8, 0);
      graphics.fillStyle(color, 1);
      graphics.fillTriangle(0, -11, -3, -6, 3, -6);
      graphics.fillTriangle(0, 11, -3, 6, 3, 6);
      graphics.fillTriangle(-11, 0, -6, -3, -6, 3);
      graphics.fillTriangle(11, 0, 6, -3, 6, 3);
      break;

    case 'aim':
      graphics.lineStyle(2, color, 0.95);
      graphics.strokeCircle(0, 0, 7);
      graphics.lineBetween(-11, 0, -4, 0);
      graphics.lineBetween(4, 0, 11, 0);
      graphics.lineBetween(0, -11, 0, -4);
      graphics.lineBetween(0, 4, 0, 11);
      graphics.fillStyle(color, 1);
      graphics.fillCircle(0, 0, 1.8);
      break;

    case 'bolt':
      graphics.fillStyle(color, 0.18);
      graphics.fillCircle(0, 0, 11);
      graphics.fillStyle(color, 0.95);
      graphics.fillPoints(
        toPoints([-2, -11, 7, -3, 2, -1, 5, 11, -6, 1, -1, -1]),
        true
      );
      break;

    default:
      break;
  }

  container.add(graphics);
  container.setScale(scale);
  return container;
}

/** Круглый медальон под иконку или номер. */
export function createMedallion(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  accent: number = UI_COLORS.brass
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const graphics = scene.add.graphics();

  graphics.fillStyle(accent, 0.12);
  graphics.fillCircle(0, 0, radius + 6);
  graphics.fillStyle(0x0b1220, 1);
  graphics.fillCircle(0, 0, radius);
  graphics.lineStyle(2, accent, 0.9);
  graphics.strokeCircle(0, 0, radius);
  graphics.lineStyle(1, UI_COLORS.panelLine, 0.8);
  graphics.strokeCircle(0, 0, radius - 6);

  container.add(graphics);
  return container;
}

// ============================================================================
// КНОПКИ
// ============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonOptions {
  variant?: ButtonVariant;
  accent?: number;
  accentHex?: string;
  fontSize?: number;
  onClick: () => void;
}

export interface ButtonParts {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  options: ButtonOptions
): ButtonParts {
  const variant = options.variant ?? 'primary';
  const accent = options.accent ?? UI_COLORS.ember;
  const accentHex = options.accentHex ?? '#fff7ed';
  const fontSize = options.fontSize ?? 16;

  const fill =
    variant === 'primary' ? accent : variant === 'secondary' ? 0x1e293b : 0x0f1626;
  const stroke =
    variant === 'primary' ? lighten(accent, 35) : variant === 'secondary' ? 0x64748b : accent;
  const textColor = variant === 'primary' ? accentHex : variant === 'secondary' ? '#e2e8f0' : '#f0c674';

  const container = scene.add.container(x, y);

  const shadow = scene.add.rectangle(2, 4, width, height, 0x000000, 0.3).setOrigin(0.5).setOrigin(0.5);
  const background = scene.add
    .rectangle(0, 0, width, height, fill, 0.96)
    .setStrokeStyle(2, stroke, 0.95)
    .setInteractive({ useHandCursor: true });

  const topLine = scene.add.rectangle(0, -height / 2 + 2, width - 6, 2, 0xffffff, 0.08);

  const text = scene.add
    .text(0, 0, label, {
      fontFamily: UI_FONT.body,
      fontSize: `${fontSize}px`,
      fontStyle: 'bold',
      color: textColor,
      letterSpacing: 1,
    })
    .setOrigin(0.5);

  container.add([shadow, background, topLine, text]);

  let pressed = false;

  const hoverFill = variant === 'primary' ? lighten(accent, 12) : lighten(fill, 18);

  background.on('pointerover', () => {
    background.setFillStyle(hoverFill, 0.98);
    container.setScale(1.02);
  });

  background.on('pointerout', () => {
    background.setFillStyle(fill, 0.96);
    container.setScale(1);
    pressed = false;
  });

  background.on('pointerdown', () => {
    pressed = true;
    container.setScale(0.98);
  });

  background.on('pointerup', () => {
    container.setScale(1.02);
    if (!pressed) return;
    pressed = false;
    options.onClick();
  });

  return { container, background, label: text };
}

// ============================================================================
// СЛАЙДЕР
// Горизонтальный ползунок для настроек. Координаты — экранные: слайдер
// добавляется в контейнер, который стоит в (0, 0), поэтому pointer.x
// напрямую переводится в значение.
// ============================================================================

export interface SliderOptions {
  /** Начальное значение: 0..1. */
  value: number;
  onChange: (value: number) => void;
  accent?: number;
}

export interface SliderParts {
  container: Phaser.GameObjects.Container;
  /** Обновить положение без вызова onChange. */
  setValue: (value: number) => void;
}

export function createSlider(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  options: SliderOptions
): SliderParts {
  const accent = options.accent ?? UI_COLORS.ember;
  const container = scene.add.container(x, y);

  let value = Phaser.Math.Clamp(options.value, 0, 1);
  let dragging = false;

  const track = scene.add
    .rectangle(0, 0, width, 6, 0x1e293b, 1)
    .setStrokeStyle(1, 0x475569, 0.9);
  const fill = scene.add
    .rectangle(-width / 2, 0, width, 4, accent, 1)
    .setOrigin(0, 0.5);
  const handle = scene.add
    .circle(0, 0, 9, accent, 1)
    .setStrokeStyle(2, 0xfef3c7, 0.95);
  const hitArea = scene.add
    .zone(0, 0, width + 24, 30)
    .setInteractive({ useHandCursor: true });

  container.add([track, fill, handle, hitArea]);

  const apply = (next: number, notify: boolean): void => {
    value = Phaser.Math.Clamp(next, 0, 1);
    fill.scaleX = value;
    handle.x = -width / 2 + value * width;
    if (notify) options.onChange(value);
  };

  const updateFromPointer = (pointerX: number): void => {
    const next = Phaser.Math.Clamp((pointerX - x) / width + 0.5, 0, 1);
    if (Math.abs(next - value) < 0.001) return;
    apply(next, true);
  };

  const onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (dragging) updateFromPointer(pointer.x);
  };
  const onPointerUp = (): void => {
    dragging = false;
  };

  hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    dragging = true;
    updateFromPointer(pointer.x);
  });

  scene.input.on('pointermove', onPointerMove);
  scene.input.on('pointerup', onPointerUp);

  container.once('destroy', () => {
    scene.input.off('pointermove', onPointerMove);
    scene.input.off('pointerup', onPointerUp);
  });

  apply(value, false);

  return {
    container,
    setValue: (next: number) => apply(next, false),
  };
}

// ============================================================================
// АТМОСФЕРА
// ============================================================================

/** Ключ общей текстуры радиального свечения. */
export const GLOW_TEXTURE_KEY = 'ui-radial-glow';

/**
 * Радиальный градиент для свечения: одна canvas-текстура на всю игру.
 * Возвращает ключ, чтобы её можно было использовать и как кисть света.
 */
export function ensureGlowTexture(scene: Phaser.Scene, size = 512): string {
  if (!scene.textures.exists(GLOW_TEXTURE_KEY)) {
    const texture = scene.textures.createCanvas(GLOW_TEXTURE_KEY, size, size);
    if (texture) {
      const ctx = texture.context;
      const half = size / 2;
      const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.9)');
      gradient.addColorStop(0.72, 'rgba(255, 255, 255, 0.42)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      texture.refresh();
    }
  }

  return GLOW_TEXTURE_KEY;
}

/** Медленно поднимающиеся угли. Добавляются в переданный контейнер. */
export function spawnEmbers(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  width: number,
  height: number,
  count: number
): void {
  const palette = [0xf97316, 0xfbbf24, 0x9a3412, 0xfdba74];

  for (let i = 0; i < count; i++) {
    const startX = Phaser.Math.Between(0, width);
    const startY = Phaser.Math.Between(0, height);
    const radius = Phaser.Math.FloatBetween(1, 2.6);
    const color = Phaser.Utils.Array.GetRandom(palette);
    const alpha = Phaser.Math.FloatBetween(0.15, 0.5);

    const ember = scene.add.circle(startX, startY, radius, color, alpha);
    parent.add(ember);

    const drift = Phaser.Math.Between(-50, 50);
    const rise = Phaser.Math.Between(140, 320);

    scene.tweens.add({
      targets: ember,
      x: startX + drift,
      y: startY - rise,
      alpha: 0,
      duration: Phaser.Math.Between(4000, 9000),
      delay: Phaser.Math.Between(0, 4000),
      repeat: -1,
      onRepeat: () => {
        ember.setPosition(Phaser.Math.Between(0, width), height + 10);
        ember.setAlpha(Phaser.Math.FloatBetween(0.15, 0.5));
      },
    });

    // Не оставляем твин висеть после удаления меню.
    ember.once('destroy', () => {
      scene.tweens.killTweensOf(ember);
    });
  }
}

/** Затемнение по краям экрана. */
export function createVignette(
  scene: Phaser.Scene,
  width: number,
  height: number,
  color: number = UI_COLORS.void,
  strength: number = 0.8
): Phaser.GameObjects.Graphics {
  const edge = 200;
  const graphics = scene.add.graphics();

  graphics.fillGradientStyle(color, color, color, color, strength, strength, 0, 0);
  graphics.fillRect(0, 0, width, edge);

  graphics.fillGradientStyle(color, color, color, color, 0, 0, strength, strength);
  graphics.fillRect(0, height - edge, width, edge);

  graphics.fillGradientStyle(color, color, color, color, strength, 0, strength, 0);
  graphics.fillRect(0, 0, edge, height);

  graphics.fillGradientStyle(color, color, color, color, 0, strength, 0, strength);
  graphics.fillRect(width - edge, 0, edge, height);

  return graphics;
}

/** Обновляет текст только при изменении значения. */
export function setTextIfChanged(text: Phaser.GameObjects.Text, value: string): void {
  if (text.text !== value) {
    text.setText(value);
  }
}
