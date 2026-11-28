import Phaser from 'phaser';
import { DEFAULT_PALETTE, type KnightPalette } from '../core/cosmetics';

// ============================================================================
// ОТРИСОВКА РЫЦАРЯ
// Локальные оси контейнера: +X — направление взгляда, ±Y — стороны тела.
// Тень вынесена отдельно: она не должна вращаться вместе с фигурой.
// ============================================================================

/** Размеры частей тела (в пикселях, относительно центра шлема). */
const BODY_RADIUS = 10;
const ARM_OFFSET_Y = 11; // насколько руки отстоят от центра
const ARM_WIDTH = 9;
const ARM_HEIGHT = 11;

/** Посох в левой руке. */
const STAFF_LENGTH = 18;
const STAFF_X = 11; // центр древка по X
const STAFF_GEM_X = 22;
const STAFF_GEM_RADIUS = 4;

/** Факел в правой руке (древко того же размера, что и у посоха). */
const TORCH_HANDLE_LENGTH = 18;
const TORCH_HANDLE_X = 11;
const FLAME_X = 22;
const FLAME_OUTER_RADIUS = 8;
const FLAME_CORE_RADIUS = 4;

/** Плащ за спиной: два слоя, чтобы читалась глубина. */
const CLOAK_BACK = [[0, -9], [-13, -13], [-13, 13], [0, 9]];
const CLOAK_FRONT = [[0, -7], [-10, -10], [-10, 10], [0, 7]];

export interface PlayerVisual {
  container: Phaser.GameObjects.Container;
  /** Внутренняя фигура: её можно качать и наклонять, не трогая позицию. */
  figure: Phaser.GameObjects.Container;
  /** Лежит на сцене отдельно от контейнера и не вращается. */
  shadow: Phaser.GameObjects.Ellipse;
  torchFlameOuter: Phaser.GameObjects.Arc;
  torchFlameCore: Phaser.GameObjects.Arc;
  /** Части, которые перекрашивает выбранный облик. */
  parts: {
    cloakBack: Phaser.GameObjects.Polygon;
    cloakFront: Phaser.GameObjects.Polygon;
    folds: Phaser.GameObjects.Graphics;
    pauldronLeft: Phaser.GameObjects.Ellipse;
    pauldronRight: Phaser.GameObjects.Ellipse;
    leftArm: Phaser.GameObjects.Ellipse;
    rightArm: Phaser.GameObjects.Ellipse;
    staffRing: Phaser.GameObjects.Rectangle;
    torchBand: Phaser.GameObjects.Rectangle;
    helmet: Phaser.GameObjects.Arc;
    helmetRim: Phaser.GameObjects.Arc;
    staffGemGlow: Phaser.GameObjects.Arc;
    staffGem: Phaser.GameObjects.Arc;
    visor: Phaser.GameObjects.Rectangle;
    /** Силуэт облика: капюшон, гребень, корона или рога. */
    decor: Phaser.GameObjects.Graphics;
  };
}

/** Складки плаща перерисовываются при смене облика. */
function drawCloakFolds(graphics: Phaser.GameObjects.Graphics, color: number): void {
  graphics.clear();
  graphics.lineStyle(1, color, 0.9);
  graphics.lineBetween(-9, -7, -15, -3);
  graphics.lineBetween(-9, 0, -16, 0);
  graphics.lineBetween(-9, 7, -15, 3);
}

/** Дополнительный слой: у каждого облика свой силуэт поверх базовой модели. */
function drawModelDecor(graphics: Phaser.GameObjects.Graphics, palette: KnightPalette): void {
  graphics.clear();
  const p = (x: number, y: number): Phaser.Math.Vector2 => new Phaser.Math.Vector2(x, y);

  switch (palette.model) {
    case 'ASH': {
      // Капюшон: тёмный полумесяц вокруг затылка.
      const hood = [
        p(-2, -12),
        p(-9, -11),
        p(-14, -5),
        p(-15, 0),
        p(-14, 5),
        p(-9, 11),
        p(-2, 12),
        p(1, 6),
        p(2, 0),
        p(1, -6),
      ];
      graphics.fillStyle(palette.cloakDark, 1);
      graphics.fillPoints(hood, true);
      graphics.lineStyle(1, palette.cloakTrim, 1);
      graphics.strokePoints(hood, true);
      break;
    }
    case 'BRASS': {
      // Гребень на шлеме.
      const crest = [p(-2, -9), p(-9, -18), p(-15, -13), p(-5, -6)];
      graphics.fillStyle(palette.metal, 1);
      graphics.fillPoints(crest, true);
      graphics.lineStyle(1, palette.cloakTrim, 0.8);
      graphics.strokePoints(crest, true);
      break;
    }
    case 'FROST': {
      // Ледяная корона: три шипа с мерцающими кончиками.
      graphics.fillStyle(palette.metal, 1);
      graphics.fillTriangle(-7, -8, -9, -17, -3, -9);
      graphics.fillTriangle(-1, -9, 0, -21, 2, -9);
      graphics.fillTriangle(3, -8, 6, -16, 7, -7);
      graphics.fillStyle(palette.glow, 1);
      graphics.fillCircle(-9, -17, 1.4);
      graphics.fillCircle(0, -21, 1.4);
      graphics.fillCircle(6, -16, 1.4);
      break;
    }
    case 'CRIMSON': {
      // Рога по сторонам шлема.
      graphics.fillStyle(palette.metal, 1);
      graphics.fillTriangle(-4, -8, -11, -17, -1, -9);
      graphics.fillTriangle(-4, 8, -11, 17, -1, 9);
      break;
    }
    case 'FLAME': {
      // Огненная корона: языки пламени.
      graphics.fillStyle(palette.metal, 1);
      graphics.fillTriangle(-8, -8, -10, -18, -3, -9);
      graphics.fillTriangle(-2, -9, 0, -22, 2, -9);
      graphics.fillTriangle(3, -8, 7, -17, 7, -7);
      graphics.fillStyle(palette.glow, 1);
      graphics.fillTriangle(-6, -9, -8, -15, -4, -9);
      graphics.fillTriangle(-1, -10, 0, -18, 1, -10);
      graphics.fillTriangle(4, -8, 6, -14, 6, -8);
      break;
    }
    default:
      // СТРАЖ — базовая модель без дополнительных деталей.
      break;
  }
}

/** Перекрашивает уже созданного рыцаря под выбранный облик. */
export function applyPlayerPalette(visual: PlayerVisual, palette: KnightPalette): void {
  const { parts } = visual;
  parts.cloakBack.setFillStyle(palette.cloakDark).setStrokeStyle(1, palette.cloakTrim);
  parts.cloakFront.setFillStyle(palette.cloak).setStrokeStyle(1, palette.cloakTrim);
  drawCloakFolds(parts.folds, palette.cloakTrim);
  parts.leftArm.setFillStyle(palette.armor);
  parts.rightArm.setFillStyle(palette.armor);
  parts.pauldronLeft.setStrokeStyle(1.5, palette.metal);
  parts.pauldronRight.setStrokeStyle(1.5, palette.metal);
  parts.staffRing.setFillStyle(palette.metal);
  parts.torchBand.setFillStyle(palette.metal);
  parts.helmet.setFillStyle(palette.armor);
  parts.helmetRim.setStrokeStyle(1, palette.metal, 0.55);
  parts.staffGemGlow.setFillStyle(palette.glow, 0.35);
  parts.staffGem.setFillStyle(palette.glow);
  parts.visor.setFillStyle(palette.glow);
  drawModelDecor(parts.decor, palette);
}

export function createPlayer(
  scene: Phaser.Scene,
  x: number,
  y: number,
  palette: KnightPalette = DEFAULT_PALETTE,
  options: { animate?: boolean } = {}
): PlayerVisual {
  const shadow = scene.add.ellipse(x + 2, y + 13, 30, 13, 0x03060b, 0.38).setDepth(11);

  const container = scene.add.container(x, y).setDepth(12);
  // Всё тело живёт во внутреннем контейнере: GameScene его качает при ходьбе.
  const figure = scene.add.container(0, 0);

  // 1. Плащ: внешний слой темнее, внутренний — алый, плюс линии складок.
  // setOrigin(0): точки Polygon рисуются минус displayOrigin (origin * размер).
  const cloakBack = scene.add
    .polygon(-10, 0, CLOAK_BACK, palette.cloakDark)
    .setOrigin(0)
    .setStrokeStyle(1, palette.cloakTrim);
  const cloakFront = scene.add
    .polygon(-8, 0, CLOAK_FRONT, palette.cloak)
    .setOrigin(0)
    .setStrokeStyle(1, palette.cloakTrim);

  const folds = scene.add.graphics();
  drawCloakFolds(folds, palette.cloakTrim);

  // 2. Руки — зеркальные копии друг друга.
  const leftArm = scene.add.ellipse(0, -ARM_OFFSET_Y, ARM_WIDTH, ARM_HEIGHT, palette.armor)
    .setStrokeStyle(1.5, 0x0f172a);
  const rightArm = scene.add.ellipse(0, ARM_OFFSET_Y, ARM_WIDTH, ARM_HEIGHT, palette.armor)
    .setStrokeStyle(1.5, 0x0f172a);

  // Наплечники: латунная окантовка и светлая грань.
  const pauldronLeft = scene.add.ellipse(0, -ARM_OFFSET_Y - 2, 13, 8, 0x475569)
    .setStrokeStyle(1.5, palette.metal);
  const pauldronRight = scene.add.ellipse(0, ARM_OFFSET_Y + 2, 13, 8, 0x475569)
    .setStrokeStyle(1.5, palette.metal);

  // 3. Оружие лежит в руках: древко начинается у края руки, дальше от корпуса.
  const staffShaft = scene.add.rectangle(STAFF_X, -ARM_OFFSET_Y, STAFF_LENGTH, 3, 0x475569);
  const staffRing = scene.add.rectangle(STAFF_X + 6, -ARM_OFFSET_Y, 2, 5, palette.metal);
  const staffGemGlow = scene.add
    .circle(STAFF_GEM_X, -ARM_OFFSET_Y, 10, palette.glow, 0.35)
    .setBlendMode(Phaser.BlendModes.ADD);
  const staffGem = scene.add.circle(STAFF_GEM_X, -ARM_OFFSET_Y, STAFF_GEM_RADIUS, palette.glow)
    .setStrokeStyle(1, 0xe0f2fe);
  const staffGemCore = scene.add.circle(STAFF_GEM_X + 1, -ARM_OFFSET_Y - 1, 1.6, 0xe0f2fe);

  const torchHandle = scene.add.rectangle(TORCH_HANDLE_X, ARM_OFFSET_Y, TORCH_HANDLE_LENGTH, 4, 0x78350f)
    .setStrokeStyle(1, 0x451a03);
  const torchBand = scene.add.rectangle(TORCH_HANDLE_X + 5, ARM_OFFSET_Y, 2, 5, palette.metal);
  const torchGlow = scene.add
    .circle(FLAME_X, ARM_OFFSET_Y, FLAME_OUTER_RADIUS + 7, 0xf97316, 0.3)
    .setBlendMode(Phaser.BlendModes.ADD);
  const torchFlameMid = scene.add.circle(FLAME_X, ARM_OFFSET_Y, 6, 0xfbbf24, 0.9);
  const torchFlameOuter = scene.add.circle(FLAME_X, ARM_OFFSET_Y, FLAME_OUTER_RADIUS, 0xf97316, 0.85);
  const torchFlameCore = scene.add.circle(FLAME_X, ARM_OFFSET_Y, FLAME_CORE_RADIUS, 0xfef08a, 1);

  // 4. Центральный шлем: блик, латунный обод и забрало.
  const helmet = scene.add.circle(0, 0, BODY_RADIUS, palette.armor).setStrokeStyle(2, 0x0f172a);
  const helmetRim = scene.add.circle(0, 0, BODY_RADIUS).setStrokeStyle(1, palette.metal, 0.55);
  const helmetHighlight = scene.add.circle(-3.5, -3.5, 3.6, 0xcbd5e1, 0.5);
  const visorH = scene.add.rectangle(5, 0, 3, 8, 0x0f172a);
  const visorCyanGlow = scene.add.rectangle(6, 0, 1.5, 5, palette.glow);

  // 5. Силуэт облика поверх базовой модели.
  const decor = scene.add.graphics();
  drawModelDecor(decor, palette);

  figure.add([
    cloakBack,
    cloakFront,
    folds,
    pauldronLeft,
    pauldronRight,
    leftArm,
    rightArm,
    staffShaft,
    staffRing,
    staffGemGlow,
    staffGem,
    staffGemCore,
    torchHandle,
    torchBand,
    torchGlow,
    torchFlameMid,
    torchFlameOuter,
    torchFlameCore,
    helmet,
    helmetRim,
    helmetHighlight,
    visorH,
    visorCyanGlow,
    decor,
  ]);

  container.add(figure);

  // Камень посоха дышит, пламя факела мерцает. В превью «Книги стража»
  // анимация не нужна: там фигура стоит неподвижно.
  if (options.animate !== false) {
    scene.tweens.add({
      targets: [staffGemGlow, staffGem],
      scale: 1.18,
      alpha: 0.75,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: [torchGlow, torchFlameOuter, torchFlameMid, torchFlameCore],
      scale: 1.14,
      alpha: 0.82,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  return {
    container,
    figure,
    shadow,
    torchFlameOuter,
    torchFlameCore,
    parts: {
      cloakBack,
      cloakFront,
      folds,
      pauldronLeft,
      pauldronRight,
      leftArm,
      rightArm,
      staffRing,
      torchBand,
      helmet,
      helmetRim,
      staffGemGlow,
      staffGem,
      visor: visorCyanGlow,
      decor,
    },
  };
}
