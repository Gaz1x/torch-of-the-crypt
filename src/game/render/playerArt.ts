import Phaser from 'phaser';
import {
  DEFAULT_PALETTE,
  type KnightModel,
  type KnightPalette,
} from '../core/cosmetics';

// ============================================================================
// ОТРИСОВКА РЫЦАРЯ
// Локальные оси контейнера: +X — направление взгляда, ±Y — стороны тела.
// Тень вынесена отдельно: она не должна вращаться вместе с фигурой.
//
// Каждый облик собирает собственную фигуру: у него свои плащ, шлем, плечи и
// оружие. Общими остаются только хитбокс, тень и анимация ходьбы.
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

/** Цвета пламени факела: у каждого облика своё пламя. */
const FLAME_STYLES: Record<KnightModel, { outer: number; mid: number; core: number }> = {
  STEWARD: { outer: 0xf97316, mid: 0xfbbf24, core: 0xfef08a },
  ASH: { outer: 0x94a3b8, mid: 0xcbd5e1, core: 0xf8fafc },
  BRASS: { outer: 0xf59e0b, mid: 0xfbbf24, core: 0xfef3c7 },
  FROST: { outer: 0x0ea5e9, mid: 0x7dd3fc, core: 0xe0f2fe },
  CRIMSON: { outer: 0xdc2626, mid: 0xf87171, core: 0xfee2e2 },
  FLAME: { outer: 0xfb923c, mid: 0xfde68a, core: 0xfff7ed },
};

export interface PlayerVisual {
  container: Phaser.GameObjects.Container;
  /** Внутренняя фигура: её можно качать и наклонять, не трогая позицию. */
  figure: Phaser.GameObjects.Container;
  /** Лежит на сцене отдельно от контейнера и не вращается. */
  shadow: Phaser.GameObjects.Ellipse;
  torchFlameOuter: Phaser.GameObjects.Arc;
  torchFlameCore: Phaser.GameObjects.Arc;
  /** Нужна ли анимация огня: превью в «Книге стража» стоит неподвижно. */
  animate: boolean;
}

/** Всё, что собрал конкретный облик. */
interface ModelBuild {
  objects: Phaser.GameObjects.GameObject[];
  torchFlameOuter: Phaser.GameObjects.Arc;
  torchFlameCore: Phaser.GameObjects.Arc;
  /** Пламя и камень, которые мерцают. */
  flameTargets: Phaser.GameObjects.GameObject[];
  pulseTargets: Phaser.GameObjects.GameObject[];
}

interface TorchBuild {
  objects: Phaser.GameObjects.GameObject[];
  outer: Phaser.GameObjects.Arc;
  core: Phaser.GameObjects.Arc;
  targets: Phaser.GameObjects.GameObject[];
}

interface WeaponBuild {
  objects: Phaser.GameObjects.GameObject[];
  targets: Phaser.GameObjects.GameObject[];
}

function toPoints(coords: number[]): Phaser.Math.Vector2[] {
  const result: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < coords.length; i += 2) {
    result.push(new Phaser.Math.Vector2(coords[i], coords[i + 1]));
  }
  return result;
}

/** Рисует замкнутый многоугольник в локальных координатах фигуры. */
function fillPolygon(
  graphics: Phaser.GameObjects.Graphics,
  coords: number[],
  fill: number,
  stroke?: number,
  strokeAlpha = 1
): void {
  const points = toPoints(coords);
  graphics.fillStyle(fill, 1);
  graphics.fillPoints(points, true);
  if (stroke !== undefined) {
    graphics.lineStyle(1, stroke, strokeAlpha);
    graphics.strokePoints(points, true);
  }
}

/** Обычный посох с камнем: стражи, пепел и латунь. */
function makeGemStaff(
  scene: Phaser.Scene,
  palette: KnightPalette,
  y = -ARM_OFFSET_Y
): WeaponBuild {
  const shaft = scene.add.rectangle(STAFF_X, y, STAFF_LENGTH, 3, 0x475569);
  const ring = scene.add.rectangle(STAFF_X + 6, y, 2, 5, palette.metal);
  const glow = scene.add
    .circle(STAFF_GEM_X, y, 10, palette.glow, 0.35)
    .setBlendMode(Phaser.BlendModes.ADD);
  const gem = scene.add
    .circle(STAFF_GEM_X, y, STAFF_GEM_RADIUS, palette.glow)
    .setStrokeStyle(1, 0xe0f2fe);
  const core = scene.add.circle(STAFF_GEM_X + 1, y - 1, 1.6, 0xe0f2fe);

  return { objects: [shaft, ring, glow, gem, core], targets: [glow, gem] };
}

/** Факел: древко одно, пламя — своего цвета у каждого облика. */
function makeTorch(scene: Phaser.Scene, style: { outer: number; mid: number; core: number }): TorchBuild {
  const handle = scene.add
    .rectangle(TORCH_HANDLE_X, ARM_OFFSET_Y, TORCH_HANDLE_LENGTH, 4, 0x78350f)
    .setStrokeStyle(1, 0x451a03);
  const band = scene.add.rectangle(TORCH_HANDLE_X + 5, ARM_OFFSET_Y, 2, 5, 0xb08a4a);
  const glow = scene.add
    .circle(FLAME_X, ARM_OFFSET_Y, FLAME_OUTER_RADIUS + 7, style.outer, 0.3)
    .setBlendMode(Phaser.BlendModes.ADD);
  const mid = scene.add.circle(FLAME_X, ARM_OFFSET_Y, 6, style.mid, 0.9);
  const outer = scene.add.circle(FLAME_X, ARM_OFFSET_Y, FLAME_OUTER_RADIUS, style.outer, 0.85);
  const core = scene.add.circle(FLAME_X, ARM_OFFSET_Y, FLAME_CORE_RADIUS, style.core, 1);

  return {
    objects: [handle, band, glow, mid, outer, core],
    outer,
    core,
    targets: [glow, mid, outer, core],
  };
}

// ============================================================================
// ШЕСТЬ МОДЕЛЕЙ
// ============================================================================

/** СТРАЖ: классический рыцарь в длинном плаще с посохом и факелом. */
function buildSteward(scene: Phaser.Scene, palette: KnightPalette): ModelBuild {
  const objects: Phaser.GameObjects.GameObject[] = [];

  const cloak = scene.add.graphics();
  fillPolygon(cloak, [-13, -13, 0, -9, 0, 9, -13, 13], palette.cloakDark, palette.cloakTrim);
  fillPolygon(cloak, [-10, -10, 0, -7, 0, 7, -10, 10], palette.cloak, palette.cloakTrim);
  cloak.lineStyle(1, palette.cloakTrim, 0.9);
  cloak.lineBetween(-9, -7, -15, -3);
  cloak.lineBetween(-9, 0, -16, 0);
  cloak.lineBetween(-9, 7, -15, 3);
  objects.push(cloak);

  const leftArm = scene.add
    .ellipse(0, -ARM_OFFSET_Y, ARM_WIDTH, ARM_HEIGHT, palette.armor)
    .setStrokeStyle(1.5, 0x0f172a);
  const rightArm = scene.add
    .ellipse(0, ARM_OFFSET_Y, ARM_WIDTH, ARM_HEIGHT, palette.armor)
    .setStrokeStyle(1.5, 0x0f172a);
  const pauldronLeft = scene.add
    .ellipse(0, -ARM_OFFSET_Y - 2, 13, 8, 0x475569)
    .setStrokeStyle(1.5, palette.metal);
  const pauldronRight = scene.add
    .ellipse(0, ARM_OFFSET_Y + 2, 13, 8, 0x475569)
    .setStrokeStyle(1.5, palette.metal);
  objects.push(leftArm, rightArm, pauldronLeft, pauldronRight);

  const staff = makeGemStaff(scene, palette);
  const torch = makeTorch(scene, FLAME_STYLES.STEWARD);
  objects.push(...staff.objects, ...torch.objects);

  const helmet = scene.add.circle(0, 0, BODY_RADIUS, palette.armor).setStrokeStyle(2, 0x0f172a);
  const rim = scene.add.circle(0, 0, BODY_RADIUS).setStrokeStyle(1, palette.metal, 0.55);
  const highlight = scene.add.circle(-3.5, -3.5, 3.6, 0xcbd5e1, 0.5);
  const visor = scene.add.rectangle(5, 0, 3, 8, 0x0f172a);
  const visorGlow = scene.add.rectangle(6, 0, 1.5, 5, palette.glow);
  objects.push(helmet, rim, highlight, visor, visorGlow);

  return {
    objects,
    torchFlameOuter: torch.outer,
    torchFlameCore: torch.core,
    flameTargets: torch.targets,
    pulseTargets: staff.targets,
  };
}

/** ПЕПЕЛ: странник в рваном плаще, вместо шлема — глубокий капюшон. */
function buildAsh(scene: Phaser.Scene, palette: KnightPalette): ModelBuild {
  const objects: Phaser.GameObjects.GameObject[] = [];

  const cloak = scene.add.graphics();
  fillPolygon(
    cloak,
    [0, -8, -9, -13, -17, -9, -13, -4, -21, 0, -13, 4, -17, 9, -8, 12, 0, 8],
    palette.cloakDark,
    palette.cloakTrim
  );
  fillPolygon(
    cloak,
    [0, -6, -8, -9, -12, -5, -10, 0, -13, 5, -7, 8, 0, 6],
    palette.cloak,
    palette.cloakTrim
  );
  cloak.lineStyle(1, palette.cloakTrim, 0.8);
  cloak.lineBetween(-8, -6, -13, -3);
  cloak.lineBetween(-8, 0, -14, 0);
  cloak.lineBetween(-8, 6, -13, 3);
  objects.push(cloak);

  const leftArm = scene.add
    .ellipse(0, -ARM_OFFSET_Y, 7, 10, palette.armor)
    .setStrokeStyle(1.5, 0x0f172a);
  const rightArm = scene.add
    .ellipse(0, ARM_OFFSET_Y, 7, 10, palette.armor)
    .setStrokeStyle(1.5, 0x0f172a);
  const pauldronLeft = scene.add
    .ellipse(0, -ARM_OFFSET_Y - 1, 9, 6, 0x334155)
    .setStrokeStyle(1, palette.metal, 0.5);
  const pauldronRight = scene.add
    .ellipse(0, ARM_OFFSET_Y + 1, 9, 6, 0x334155)
    .setStrokeStyle(1, palette.metal, 0.5);
  objects.push(leftArm, rightArm, pauldronLeft, pauldronRight);

  // Кривой посох-коряга с тусклым осколком на конце.
  const staff = scene.add.graphics();
  staff.lineStyle(3, 0x57534e, 1);
  staff.strokePoints(toPoints([8, -11, 13, -12.5, 17, -10, 21, -11.5, 24, -11]), false);
  staff.lineStyle(1.5, 0x78350f, 0.8);
  staff.strokePoints(toPoints([12, -12, 14, -15, 16, -12]), false);
  const gemGlow = scene.add
    .circle(25, -11, 7, palette.glow, 0.28)
    .setBlendMode(Phaser.BlendModes.ADD);
  const gem = scene.add.circle(25, -11, 3, palette.glow, 0.85).setStrokeStyle(1, 0xe2e8f0);
  objects.push(staff, gemGlow, gem);

  const torch = makeTorch(scene, FLAME_STYLES.ASH);
  objects.push(...torch.objects);

  const body = scene.add.circle(0, 0, 8.5, palette.armor).setStrokeStyle(2, 0x0f172a);
  const hood = scene.add.graphics();
  fillPolygon(
    hood,
    [2, -6, -3, -10, -9, -10, -14, -5, -14, 5, -9, 10, -3, 10, 2, 6, 4, 0],
    palette.cloak,
    palette.cloakTrim
  );
  const face = scene.add.ellipse(2, 0, 9, 13, 0x0f172a);
  const eyeGlowLeft = scene.add
    .circle(5, -3, 2.4, palette.glow, 0.35)
    .setBlendMode(Phaser.BlendModes.ADD);
  const eyeGlowRight = scene.add
    .circle(5, 3, 2.4, palette.glow, 0.35)
    .setBlendMode(Phaser.BlendModes.ADD);
  const eyeLeft = scene.add.circle(5, -3, 1.3, palette.glow);
  const eyeRight = scene.add.circle(5, 3, 1.3, palette.glow);
  objects.push(body, hood, face, eyeGlowLeft, eyeGlowRight, eyeLeft, eyeRight);

  return {
    objects,
    torchFlameOuter: torch.outer,
    torchFlameCore: torch.core,
    flameTargets: torch.targets,
    pulseTargets: [gemGlow, gem],
  };
}

/** ЛАТУНЬ: тяжёлый латник с гребнем, широкими плечами и массивным посохом. */
function buildBrass(scene: Phaser.Scene, palette: KnightPalette): ModelBuild {
  const objects: Phaser.GameObjects.GameObject[] = [];

  const cloak = scene.add.graphics();
  fillPolygon(cloak, [0, -11, -7, -14, -7, 14, 0, 11], palette.cloakDark, palette.cloakTrim);
  fillPolygon(cloak, [0, -9, -5, -11, -5, 11, 0, 9], palette.cloak, palette.cloakTrim);
  cloak.lineStyle(1, palette.cloakTrim, 0.9);
  cloak.lineBetween(-4, -8, -6, 0);
  cloak.lineBetween(-4, 8, -6, 0);
  objects.push(cloak);

  const leftArm = scene.add
    .ellipse(0, -ARM_OFFSET_Y, 10, 12, palette.armor)
    .setStrokeStyle(1.5, 0x1c0a00);
  const rightArm = scene.add
    .ellipse(0, ARM_OFFSET_Y, 10, 12, palette.armor)
    .setStrokeStyle(1.5, 0x1c0a00);
  const pauldronLeft = scene.add
    .ellipse(0, -ARM_OFFSET_Y - 3, 17, 10, 0x475569)
    .setStrokeStyle(2, palette.metal);
  const pauldronRight = scene.add
    .ellipse(0, ARM_OFFSET_Y + 3, 17, 10, 0x475569)
    .setStrokeStyle(2, palette.metal);
  const insetLeft = scene.add.ellipse(0, -ARM_OFFSET_Y - 3, 11, 5, palette.metal, 0.3);
  const insetRight = scene.add.ellipse(0, ARM_OFFSET_Y + 3, 11, 5, palette.metal, 0.3);
  const rivetLeft = scene.add.circle(-3, -ARM_OFFSET_Y - 5, 1.4, palette.metal);
  const rivetRight = scene.add.circle(-3, ARM_OFFSET_Y + 5, 1.4, palette.metal);
  objects.push(
    leftArm,
    rightArm,
    pauldronLeft,
    pauldronRight,
    insetLeft,
    insetRight,
    rivetLeft,
    rivetRight
  );

  // Массивный посох: толстое древко, латунные обручи, крупный камень.
  const shaft = scene.add.rectangle(12, -ARM_OFFSET_Y, 20, 5, 0x57534e).setStrokeStyle(1, 0x292524);
  const band1 = scene.add.rectangle(15, -ARM_OFFSET_Y, 2, 8, palette.metal);
  const band2 = scene.add.rectangle(20, -ARM_OFFSET_Y, 2, 8, palette.metal);
  const gemGlow = scene.add
    .circle(24, -ARM_OFFSET_Y, 12, palette.glow, 0.35)
    .setBlendMode(Phaser.BlendModes.ADD);
  const gem = scene.add
    .circle(24, -ARM_OFFSET_Y, 5, palette.glow)
    .setStrokeStyle(1.5, 0xfef3c7);
  const gemCore = scene.add.circle(24, -ARM_OFFSET_Y, 2, 0xfff7ed);
  objects.push(shaft, band1, band2, gemGlow, gem, gemCore);

  const torch = makeTorch(scene, FLAME_STYLES.BRASS);
  objects.push(...torch.objects);

  const helmet = scene.add.circle(0, 0, 11, palette.armor).setStrokeStyle(2, 0x1c0a00);
  const rim = scene.add.circle(0, 0, 11).setStrokeStyle(1.5, palette.metal, 0.7);
  const highlight = scene.add.circle(-4, -4, 3.6, 0xfef3c7, 0.45);
  const visor = scene.add.rectangle(5.5, 0, 3, 9, 0x1c0a00);
  const visorGlow = scene.add.rectangle(6.5, 0, 1.5, 6, palette.glow);
  objects.push(helmet, rim, highlight, visor, visorGlow);

  // Высокий гребень поверх шлема.
  const crest = scene.add.graphics();
  fillPolygon(crest, [-8, -8, -13, -19, -6, -20, -1, -9], palette.metal, palette.cloakTrim, 0.9);
  fillPolygon(crest, [-1, -9, -6, -23, 1, -22, 5, -9], palette.metal, palette.cloakTrim, 0.9);
  objects.push(crest);

  return {
    objects,
    torchFlameOuter: torch.outer,
    torchFlameCore: torch.core,
    flameTargets: torch.targets,
    pulseTargets: [gemGlow, gem],
  };
}

/** ИНЕЙ: ледяной дух с гранёным телом, шипастым плащом и ледяным копьём. */
function buildFrost(scene: Phaser.Scene, palette: KnightPalette): ModelBuild {
  const objects: Phaser.GameObjects.GameObject[] = [];

  const cloak = scene.add.graphics();
  fillPolygon(
    cloak,
    [0, -8, -6, -14, -10, -9, -16, -12, -13, -4, -20, 0, -13, 4, -16, 12, -9, 9, -5, 14, 0, 8],
    palette.cloakDark,
    palette.glow,
    0.6
  );
  fillPolygon(
    cloak,
    [0, -6, -6, -10, -11, -5, -13, 0, -11, 5, -6, 10, 0, 6],
    palette.cloak,
    palette.glow,
    0.7
  );
  objects.push(cloak);

  // Парящие осколки льда вокруг плаща.
  const shards = scene.add.graphics();
  shards.fillStyle(palette.glow, 0.55);
  shards.fillTriangle(-19, -9, -22, -3, -16, -4);
  shards.fillTriangle(-21, 4, -24, 10, -17, 8);
  shards.fillTriangle(-13, 12, -14, 18, -9, 14);
  objects.push(shards);

  const leftArm = scene.add
    .ellipse(0, -ARM_OFFSET_Y, 8, 10, palette.armor)
    .setStrokeStyle(1.5, 0x0a1230);
  const rightArm = scene.add
    .ellipse(0, ARM_OFFSET_Y, 8, 10, palette.armor)
    .setStrokeStyle(1.5, 0x0a1230);
  objects.push(leftArm, rightArm);

  // Плечи — ледяные шипы.
  const shoulders = scene.add.graphics();
  shoulders.fillStyle(palette.armor, 1);
  shoulders.fillTriangle(-2, -10, -7, -19, 4, -13);
  shoulders.fillTriangle(-2, 10, -7, 19, 4, 13);
  shoulders.lineStyle(1, palette.glow, 0.8);
  shoulders.strokeTriangle(-2, -10, -7, -19, 4, -13);
  shoulders.strokeTriangle(-2, 10, -7, 19, 4, 13);
  objects.push(shoulders);

  // Ледяное копьё вместо посоха.
  const shaft = scene.add.rectangle(13, -ARM_OFFSET_Y, 24, 3, 0x93c5fd).setStrokeStyle(1, 0x3b82f6);
  const guard = scene.add.rectangle(19, -ARM_OFFSET_Y, 2, 7, 0xbfdbfe);
  const glow = scene.add
    .circle(30, -ARM_OFFSET_Y, 9, palette.glow, 0.35)
    .setBlendMode(Phaser.BlendModes.ADD);
  const head = scene.add.graphics();
  fillPolygon(head, [24, -ARM_OFFSET_Y, 34, -ARM_OFFSET_Y, 28, -16], 0xe0f2fe, palette.glow);
  fillPolygon(head, [24, -ARM_OFFSET_Y, 34, -ARM_OFFSET_Y, 28, -6], 0xbfdbfe, palette.glow);
  objects.push(shaft, guard, glow, head);

  const torch = makeTorch(scene, FLAME_STYLES.FROST);
  objects.push(...torch.objects);

  // Гранёное тело вместо круга.
  const body = scene.add.graphics();
  fillPolygon(body, [9, 0, 5, -8, -4, -10, -9, -4, -9, 4, -4, 10, 5, 8], palette.armor, palette.metal);
  body.lineStyle(1, palette.glow, 0.5);
  body.lineBetween(-4, -10, -1, 0);
  body.lineBetween(-4, 10, -1, 0);
  body.lineBetween(5, -8, -1, 0);
  body.lineBetween(5, 8, -1, 0);
  objects.push(body);

  const visor = scene.add.graphics();
  fillPolygon(visor, [4, -4, 9, 0, 4, 4, 2, 0], palette.glow, 0xe0f2fe);
  objects.push(visor);

  return {
    objects,
    torchFlameOuter: torch.outer,
    torchFlameCore: torch.core,
    flameTargets: torch.targets,
    pulseTargets: [glow, shards],
  };
}

/** БАГРЯНЕЦ: рогатый вождь с шипастым плащом и посохом-черепом. */
function buildCrimson(scene: Phaser.Scene, palette: KnightPalette): ModelBuild {
  const objects: Phaser.GameObjects.GameObject[] = [];

  const cloak = scene.add.graphics();
  fillPolygon(
    cloak,
    [0, -10, -8, -15, -16, -11, -13, -5, -21, 0, -13, 5, -16, 11, -8, 15, 0, 10],
    palette.cloakDark,
    palette.cloakTrim
  );
  fillPolygon(
    cloak,
    [0, -8, -7, -11, -11, -6, -9, 0, -11, 6, -7, 11, 0, 8],
    palette.cloak,
    palette.cloakTrim
  );
  cloak.lineStyle(1, palette.cloakTrim, 0.9);
  cloak.lineBetween(-7, -7, -12, -3);
  cloak.lineBetween(-7, 0, -13, 0);
  cloak.lineBetween(-7, 7, -12, 3);
  objects.push(cloak);

  const leftArm = scene.add
    .ellipse(0, -ARM_OFFSET_Y, 9, 11, palette.armor)
    .setStrokeStyle(1.5, 0x1a0303);
  const rightArm = scene.add
    .ellipse(0, ARM_OFFSET_Y, 9, 11, palette.armor)
    .setStrokeStyle(1.5, 0x1a0303);
  const pauldronLeft = scene.add
    .ellipse(0, -ARM_OFFSET_Y - 3, 15, 9, 0x450a0a)
    .setStrokeStyle(1.5, palette.metal);
  const pauldronRight = scene.add
    .ellipse(0, ARM_OFFSET_Y + 3, 15, 9, 0x450a0a)
    .setStrokeStyle(1.5, palette.metal);
  const spikes = scene.add.graphics();
  spikes.fillStyle(palette.metal, 1);
  spikes.fillTriangle(-2, -13, -7, -22, 4, -16);
  spikes.fillTriangle(-2, 13, -7, 22, 4, 16);
  objects.push(leftArm, rightArm, pauldronLeft, pauldronRight, spikes);

  // Посох с шипами и черепом вместо камня.
  const shaft = scene.add.rectangle(11, -ARM_OFFSET_Y, 20, 4, 0x3f3f46).setStrokeStyle(1, 0x18181b);
  const shaftSpikes = scene.add.graphics();
  shaftSpikes.fillStyle(palette.metal, 1);
  shaftSpikes.fillTriangle(14, -13, 13, -18, 17, -13);
  shaftSpikes.fillTriangle(19, -13, 18, -18, 22, -13);
  const skullGlow = scene.add
    .circle(25, -ARM_OFFSET_Y, 10, palette.glow, 0.3)
    .setBlendMode(Phaser.BlendModes.ADD);
  const skull = scene.add
    .circle(25, -ARM_OFFSET_Y, 5, 0xe7e5e4)
    .setStrokeStyle(1, 0x57534e);
  const eyeLeft = scene.add.circle(23.5, -12.5, 1.2, 0x1a0303);
  const eyeRight = scene.add.circle(26.5, -9.5, 1.2, 0x1a0303);
  objects.push(shaft, shaftSpikes, skullGlow, skull, eyeLeft, eyeRight);

  const torch = makeTorch(scene, FLAME_STYLES.CRIMSON);
  objects.push(...torch.objects);

  // Длинные рога: рисуются до тела, чтобы основания спрятались под шлемом.
  const horns = scene.add.graphics();
  fillPolygon(horns, [-5, -7, -9, -10, -5, -15, 6, -22, 2, -13, 1, -8], palette.metal, 0x1a0303);
  fillPolygon(horns, [-5, 7, -9, 10, -5, 15, 6, 22, 2, 13, 1, 8], palette.metal, 0x1a0303);
  objects.push(horns);

  const body = scene.add.graphics();
  fillPolygon(body, [10, 0, 6, -7, -2, -10, -8, -6, -8, 6, -2, 10, 6, 7], palette.armor, 0x1a0303);
  body.lineStyle(1.5, palette.metal, 0.6);
  body.lineBetween(-2, -10, -4, 0);
  body.lineBetween(-2, 10, -4, 0);
  objects.push(body);

  const eyeGlowLeft = scene.add
    .circle(5, -3, 2.6, palette.glow, 0.35)
    .setBlendMode(Phaser.BlendModes.ADD);
  const eyeGlowRight = scene.add
    .circle(5, 3, 2.6, palette.glow, 0.35)
    .setBlendMode(Phaser.BlendModes.ADD);
  const bodyEyeLeft = scene.add.circle(5, -3, 1.4, palette.glow);
  const bodyEyeRight = scene.add.circle(5, 3, 1.4, palette.glow);
  objects.push(eyeGlowLeft, eyeGlowRight, bodyEyeLeft, bodyEyeRight);

  return {
    objects,
    torchFlameOuter: torch.outer,
    torchFlameCore: torch.core,
    flameTargets: torch.targets,
    pulseTargets: [skullGlow, skull],
  };
}

/** ПЛАМЯ: огненный дух, вместо шлема — пламя, в руке — горящая ветвь. */
function buildFlame(scene: Phaser.Scene, palette: KnightPalette): ModelBuild {
  const objects: Phaser.GameObjects.GameObject[] = [];

  const cloak = scene.add.graphics();
  fillPolygon(
    cloak,
    [0, -9, -6, -13, -11, -8, -16, -14, -14, -4, -22, 0, -14, 4, -16, 14, -10, 8, -6, 13, 0, 9],
    palette.cloakDark,
    palette.cloakTrim
  );
  fillPolygon(
    cloak,
    [0, -7, -5, -10, -8, -6, -11, 0, -8, 6, -5, 10, 0, 7],
    palette.cloak,
    palette.cloakTrim
  );
  // Языки пламени внутри плаща.
  cloak.fillStyle(palette.glow, 0.35);
  cloak.fillTriangle(-8, -6, -13, -2, -7, 0);
  cloak.fillTriangle(-8, 6, -13, 2, -7, 0);
  objects.push(cloak);

  const leftArm = scene.add
    .ellipse(0, -ARM_OFFSET_Y, 8, 10, palette.armor)
    .setStrokeStyle(1.5, 0x431407);
  const rightArm = scene.add
    .ellipse(0, ARM_OFFSET_Y, 8, 10, palette.armor)
    .setStrokeStyle(1.5, 0x431407);
  objects.push(leftArm, rightArm);

  const wisps = scene.add.graphics();
  wisps.fillStyle(palette.metal, 0.9);
  wisps.fillTriangle(-2, -11, -6, -18, 4, -13);
  wisps.fillTriangle(-2, 11, -6, 18, 4, 13);
  objects.push(wisps);

  // Горящая ветвь вместо посоха.
  const branch = scene.add.graphics();
  branch.lineStyle(3, 0x92400e, 1);
  branch.strokePoints(toPoints([8, -11, 12, -13, 16, -10, 20, -13, 25, -11]), false);
  branch.lineStyle(1.5, 0x78350f, 0.9);
  branch.strokePoints(toPoints([14, -11, 15, -15, 18, -13]), false);
  const branchFlames = scene.add.graphics();
  branchFlames.fillStyle(0xf59e0b, 0.9);
  branchFlames.fillTriangle(12, -13, 10, -18, 15, -14);
  branchFlames.fillTriangle(20, -13, 19, -19, 23, -14);
  const tipGlow = scene.add
    .circle(25, -11, 9, 0xffedd5, 0.35)
    .setBlendMode(Phaser.BlendModes.ADD);
  const tip = scene.add.circle(25, -11, 3.5, 0xfef08a);
  objects.push(branch, branchFlames, tipGlow, tip);

  const torch = makeTorch(scene, FLAME_STYLES.FLAME);
  objects.push(...torch.objects);

  const aura = scene.add
    .circle(0, 0, 15, palette.glow, 0.18)
    .setBlendMode(Phaser.BlendModes.ADD);
  const body = scene.add.circle(0, 0, 9.5, palette.armor).setStrokeStyle(2, 0x431407);
  const ember = scene.add.circle(0, 0, 4.5, 0xfff7ed, 0.9);
  const crown = scene.add.graphics();
  crown.fillStyle(palette.metal, 1);
  crown.fillTriangle(-6, -8, -10, -17, -2, -10);
  crown.fillTriangle(-2, -9, 0, -22, 2, -9);
  crown.fillTriangle(3, -8, 7, -16, 7, -7);
  crown.fillStyle(palette.glow, 1);
  crown.fillTriangle(-5, -9, -8, -15, -2, -10);
  crown.fillTriangle(-1, -10, 0, -19, 1, -10);
  crown.fillTriangle(4, -8, 6, -14, 6, -8);
  objects.push(aura, body, ember, crown);

  // Парящие искры вокруг духа.
  const sparks = scene.add.graphics();
  sparks.fillStyle(0xffedd5, 0.9);
  sparks.fillCircle(-14, -15, 1.6);
  sparks.fillCircle(-19, 7, 1.3);
  sparks.fillCircle(-9, 16, 1.5);
  objects.push(sparks);

  const eyeGlowLeft = scene.add
    .circle(5, -3, 2.6, 0xffedd5, 0.4)
    .setBlendMode(Phaser.BlendModes.ADD);
  const eyeGlowRight = scene.add
    .circle(5, 3, 2.6, 0xffedd5, 0.4)
    .setBlendMode(Phaser.BlendModes.ADD);
  const eyeLeft = scene.add.circle(5, -3, 1.4, 0xfff7ed);
  const eyeRight = scene.add.circle(5, 3, 1.4, 0xfff7ed);
  objects.push(eyeGlowLeft, eyeGlowRight, eyeLeft, eyeRight);

  return {
    objects,
    torchFlameOuter: torch.outer,
    torchFlameCore: torch.core,
    flameTargets: torch.targets,
    pulseTargets: [tipGlow, tip, aura, sparks],
  };
}

function buildModel(scene: Phaser.Scene, palette: KnightPalette): ModelBuild {
  switch (palette.model) {
    case 'ASH':
      return buildAsh(scene, palette);
    case 'BRASS':
      return buildBrass(scene, palette);
    case 'FROST':
      return buildFrost(scene, palette);
    case 'CRIMSON':
      return buildCrimson(scene, palette);
    case 'FLAME':
      return buildFlame(scene, palette);
    default:
      return buildSteward(scene, palette);
  }
}

/** Пламя мерцает, камень/осколок дышит. */
function startModelTweens(scene: Phaser.Scene, built: ModelBuild): void {
  if (built.pulseTargets.length > 0) {
    scene.tweens.add({
      targets: built.pulseTargets,
      scale: 1.18,
      alpha: 0.75,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  if (built.flameTargets.length > 0) {
    scene.tweens.add({
      targets: built.flameTargets,
      scale: 1.14,
      alpha: 0.82,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

/** Пересобирает фигуру под выбранный облик. */
export function applyPlayerPalette(visual: PlayerVisual, palette: KnightPalette): void {
  const scene = visual.figure.scene;

  scene.tweens.killTweensOf(visual.figure.list);
  visual.figure.removeAll(true);

  const built = buildModel(scene, palette);
  visual.figure.add(built.objects);
  visual.torchFlameOuter = built.torchFlameOuter;
  visual.torchFlameCore = built.torchFlameCore;

  if (visual.animate) {
    startModelTweens(scene, built);
  }
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

  const built = buildModel(scene, palette);
  figure.add(built.objects);
  container.add(figure);

  const animate = options.animate !== false;
  if (animate) {
    startModelTweens(scene, built);
  }

  return {
    container,
    figure,
    shadow,
    torchFlameOuter: built.torchFlameOuter,
    torchFlameCore: built.torchFlameCore,
    animate,
  };
}
