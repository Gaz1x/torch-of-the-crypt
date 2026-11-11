import Phaser from 'phaser';
import { createVignette, ensureGlowTexture, spawnEmbers, UI_COLORS } from './uiKit';

// ============================================================================
// ФОН ЛАГЕРЯ
// Полноэкранная процедурная крипта: арки, колонны, туман, угли и силуэт
// стража с факелом. Рисуется целиком, без внешних ассетов.
// ============================================================================

const ARCHES = [
  { x: 330, width: 250, top: 220, height: 360 },
  { x: 640, width: 250, top: 220, height: 360 },
  { x: 950, width: 250, top: 220, height: 360 },
] as const;

const COLUMN_XS = [150, 480, 790, 1120] as const;

/** Graphics в Phaser 4 принимает точки только как полноценные Vector2. */
const point = (x: number, y: number): Phaser.Math.Vector2 =>
  new Phaser.Math.Vector2(x, y);

function drawStoneWall(graphics: Phaser.GameObjects.Graphics, width: number): void {
  graphics.fillStyle(0x0b1220, 1);
  graphics.fillRect(0, 170, width, 420);

  graphics.lineStyle(1, 0x1e293b, 0.4);
  for (let row = 0; row < 10; row++) {
    const y = 180 + row * 42;
    graphics.lineBetween(0, y, width, y);
    const offset = row % 2 === 0 ? 0 : 64;
    for (let x = offset; x < width; x += 128) {
      graphics.lineBetween(x, y, x, y + 42);
    }
  }
}

function drawArches(graphics: Phaser.GameObjects.Graphics): void {
  for (const arch of ARCHES) {
    const radius = arch.width / 2;
    const shoulderY = arch.top + radius;

    graphics.fillStyle(0x03060b, 1);
    graphics.fillCircle(arch.x, shoulderY, radius);
    graphics.fillRect(arch.x - radius, shoulderY, arch.width, arch.height);

    graphics.lineStyle(10, 0x1b2536, 1);
    graphics.beginPath();
    graphics.arc(arch.x, shoulderY, radius, Math.PI, 0, false);
    graphics.strokePath();
    graphics.lineBetween(arch.x - radius, shoulderY, arch.x - radius, shoulderY + arch.height);
    graphics.lineBetween(arch.x + radius, shoulderY, arch.x + radius, shoulderY + arch.height);

    graphics.lineStyle(2, 0x2a3446, 0.7);
    graphics.beginPath();
    graphics.arc(arch.x, shoulderY, radius - 12, Math.PI, 0, false);
    graphics.strokePath();
  }
}

function drawColumns(graphics: Phaser.GameObjects.Graphics): void {
  for (const x of COLUMN_XS) {
    graphics.fillStyle(0x111a29, 1);
    graphics.fillRect(x - 26, 200, 52, 390);

    graphics.fillStyle(0x1c2638, 1);
    graphics.fillRect(x - 34, 186, 68, 18);
    graphics.fillRect(x - 34, 574, 68, 18);

    graphics.lineStyle(2, 0x2a3446, 0.75);
    for (let i = 1; i < 5; i++) {
      graphics.lineBetween(x - 20, 200 + i * 70, x + 20, 200 + i * 70);
    }
  }
}

function drawFloor(
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number
): void {
  graphics.fillStyle(0x070b12, 1);
  graphics.fillRect(0, 588, width, height - 588);

  graphics.lineStyle(1, 0x1e293b, 0.35);
  const vanishingX = width / 2;
  for (let i = 0; i <= 8; i++) {
    const x = (width / 8) * i;
    graphics.lineBetween(vanishingX, 588, x, height);
  }
  for (let i = 1; i <= 4; i++) {
    const y = 588 + (height - 588) * (i / 4);
    graphics.lineBetween(0, y, width, y);
  }
}

/**
 * Бразиер лагеря: каменная чаша с огнём. Огонь даёт световое пятно на полу
 * и тёплый ореол, поэтому фигура стража рядом читается без факела.
 */
function createBrazier(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const brazier = scene.add.container(0, 0);

  const glowKey = ensureGlowTexture(scene);
  const floorLight = scene.add
    .image(0, 8, glowKey)
    .setDisplaySize(380, 120)
    .setTint(UI_COLORS.ember)
    .setAlpha(0.22)
    .setBlendMode(Phaser.BlendModes.ADD);
  const glow = scene.add
    .image(0, -85, glowKey)
    .setDisplaySize(330, 330)
    .setTint(UI_COLORS.ember)
    .setAlpha(0.34)
    .setBlendMode(Phaser.BlendModes.ADD);

  const stone = scene.add.graphics();
  // Постамент.
  const pedestal = [point(-26, 0), point(26, 0), point(16, -44), point(-16, -44)];

  stone.fillStyle(0x111a29, 1);
  stone.fillPoints(pedestal, true);
  stone.lineStyle(2, 0x2a3446, 0.8);
  stone.strokePoints(pedestal, true);
  stone.fillStyle(0x1c2638, 1);
  stone.fillRect(-30, -8, 60, 10);

  // Чаша и угли.
  stone.fillStyle(0x0b1220, 1);
  stone.fillEllipse(0, -50, 84, 22);
  stone.lineStyle(3, 0x334155, 1);
  stone.strokeEllipse(0, -54, 84, 20);
  stone.fillStyle(0x7c2d12, 1);
  stone.fillEllipse(0, -56, 60, 12);

  const flameOuter = scene.add.ellipse(0, -88, 46, 70, 0xf97316, 0.8);
  const flameMid = scene.add.ellipse(0, -83, 32, 52, 0xfbbf24, 0.9);
  const flameCore = scene.add.ellipse(0, -78, 18, 34, 0xfef08a, 0.95);
  const flameLeft = scene.add.ellipse(-14, -76, 14, 30, 0xf97316, 0.45).setRotation(-0.35);
  const flameRight = scene.add.ellipse(13, -74, 13, 26, 0xf97316, 0.4).setRotation(0.35);

  brazier.add([floorLight, glow, stone, flameOuter, flameMid, flameCore, flameLeft, flameRight]);

  scene.tweens.add({
    targets: [flameOuter, flameMid, flameCore, flameLeft, flameRight],
    scale: 1.16,
    alpha: 0.8,
    duration: 520,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  scene.tweens.add({
    targets: glow,
    alpha: 0.24,
    duration: 1600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  return brazier;
}

/** Страж сидит у огня спиной к зрителю: мелкий масштаб скрывает условность. */
function createSeatedKnight(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const knight = scene.add.container(100, 42);
  const art = scene.add.graphics();

  art.fillStyle(0x000000, 0.35);
  art.fillEllipse(0, 10, 58, 12);

  // Плащ за спиной.
  art.fillStyle(0x2a0d0d, 1);
  art.fillPoints(
    [point(2, -34), point(14, -22), point(16, 2), point(-2, 6), point(-8, -10)],
    true
  );

  // Корпус, наклонённый к огню.
  art.fillStyle(0x0f172a, 1);
  art.fillEllipse(-4, -18, 30, 36);

  // Нога: бедро к огню, голень вниз.
  art.fillStyle(0x0f172a, 1);
  art.fillRoundedRect(-34, -8, 30, 12, 5);
  art.fillRect(-36, -2, 10, 18);
  art.fillEllipse(-32, 17, 18, 8);

  // Рука на колене.
  art.fillStyle(0x1e293b, 1);
  art.fillRoundedRect(-28, -16, 30, 8, 4);

  // Шлем и забрало со стороны огня.
  art.fillStyle(0x111827, 1);
  art.fillCircle(-12, -40, 10);
  art.lineStyle(2, 0x475569, 0.9);
  art.strokeCircle(-12, -40, 10);
  art.fillStyle(0xfbbf24, 0.85);
  art.fillRect(-21, -43, 3, 8);

  // Тёплый контражур по спине.
  art.lineStyle(2, 0xf59e0b, 0.3);
  art.beginPath();
  art.moveTo(4, -34);
  art.lineTo(14, -22);
  art.lineTo(16, 2);
  art.strokePath();

  knight.add(art);
  return knight;
}

// ============================================================================
// МОНСТРЫ ЦЕНТРАЛЬНОЙ АРКИ (КРУПНЫЕ ГУМАНОИДНЫЕ СИЛУЭТЫ С ПЛАВНЫМИ ФОРМАМИ)
// ============================================================================

const CENTER_ARCH = ARCHES[1]; // x: 640, width: 250, top: 220, height: 360

/**
 * Строит идеально гладкий массив точек по квадратичной кривой Безье
 * (p0 -> контрольная p1 -> конечная p2).
 */
function quadCurvePoints(
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  steps = 14
): Phaser.Math.Vector2[] {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const inv = 1 - t;
    const x = inv * inv * x0 + 2 * inv * t * cx + t * t * x1;
    const y = inv * inv * y0 + 2 * inv * t * cy + t * t * y1;
    pts.push(point(x, y));
  }
  return pts;
}

/**
 * Создает замкнутую гладкую фигуру-серп (для рогов, клинков и оплечий)
 * из внешней и внутренней дуги Безье.
 */
function drawCurvedBlade(
  g: Phaser.GameObjects.Graphics,
  baseOuter: [number, number],
  ctrlOuter: [number, number],
  tip: [number, number],
  ctrlInner: [number, number],
  baseInner: [number, number],
  fillColor: number,
  highlightColor?: number,
  highlightAlpha = 0.35
): void {
  const outerPts = quadCurvePoints(
    baseOuter[0],
    baseOuter[1],
    ctrlOuter[0],
    ctrlOuter[1],
    tip[0],
    tip[1],
    14
  );
  const innerPts = quadCurvePoints(
    tip[0],
    tip[1],
    ctrlInner[0],
    ctrlInner[1],
    baseInner[0],
    baseInner[1],
    14
  );

  const polygon = [...outerPts, ...innerPts.slice(1)];
  g.fillStyle(fillColor, 1);
  g.fillPoints(polygon, true);

  if (highlightColor !== undefined && highlightAlpha > 0) {
    g.lineStyle(1.5, highlightColor, highlightAlpha);
    g.strokePoints(outerPts, false);
  }
}

/**
 * Создает выразительный светящийся глаз.
 */
function createGlowingEye(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  tilt = 0,
  slitPupil = true
): Phaser.GameObjects.Container {
  const eye = scene.add.container(x, y);
  eye.setRotation(tilt);

  const glowKey = ensureGlowTexture(scene);
  const glow = scene.add
    .image(0, 0, glowKey)
    .setDisplaySize(width * 3.8, height * 4.5)
    .setTint(color)
    .setAlpha(0.32)
    .setBlendMode(Phaser.BlendModes.ADD);

  const gfx = scene.add.graphics();

  const topArc = quadCurvePoints(-width / 2, 0, 0, -height * 0.85, width / 2, 0, 10);
  const botArc = quadCurvePoints(width / 2, 0, 0, height * 0.85, -width / 2, 0, 10);
  const eyePoly = [...topArc, ...botArc.slice(1)];

  gfx.fillStyle(color, 0.95);
  gfx.fillPoints(eyePoly, true);

  gfx.fillStyle(0xffffff, 0.65);
  gfx.fillEllipse(0, 0, width * 0.55, height * 0.55);

  if (slitPupil) {
    gfx.fillStyle(0x020409, 0.95);
    gfx.fillEllipse(0, 0, Math.max(1.8, width * 0.16), height * 0.85);
  }

  eye.add([glow, gfx]);

  scene.tweens.add({
    targets: eye,
    scaleY: 0.05,
    duration: 130,
    yoyo: true,
    delay: Phaser.Math.Between(1200, 4000),
    repeat: -1,
    repeatDelay: Phaser.Math.Between(3000, 6500),
    ease: 'Quad.easeInOut',
  });

  return eye;
}

/**
 * Вариант 1: «Владыка Пепла» (Рогатый Рыцарь Бездны)
 * Лаконичный силуэт: плащ, округлый шлем и два рога. Всё остальное — свет.
 */
function createAshLord(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0);

  const glowKey = ensureGlowTexture(scene);
  // Единственное свечение за фигурой: детали брони не рисуем намеренно.
  const backGlow = scene.add
    .image(0, -8, glowKey)
    .setDisplaySize(150, 180)
    .setTint(0xf59e0b)
    .setAlpha(0.1)
    .setBlendMode(Phaser.BlendModes.ADD);
  root.add(backGlow);

  const body = scene.add.container(0, 0);
  const gfx = scene.add.graphics();

  // Тень на полу: привязывает силуэт к земле.
  gfx.fillStyle(0x02040a, 0.55);
  gfx.fillEllipse(0, 96, 116, 18);

  // Плащ: плавное расширение книзу.
  const cloakLeft = quadCurvePoints(-34, -14, -46, 30, -54, 95, 16);
  const cloakRight = quadCurvePoints(54, 95, 46, 30, 34, -14, 16);
  const cloakNeck = quadCurvePoints(34, -14, 0, -30, -34, -14, 12);
  gfx.fillStyle(0x0e1626, 1);
  gfx.fillPoints([...cloakLeft, ...cloakRight, ...cloakNeck], true);

  // Тёплый контражур по левому краю плаща и холодный по правому.
  gfx.lineStyle(1.8, 0xf59e0b, 0.4);
  gfx.strokePoints(cloakLeft, false);
  gfx.lineStyle(1.4, 0x475569, 0.28);
  gfx.strokePoints(cloakRight, false);

  // Округлый шлем.
  gfx.fillStyle(0x111a2a, 1);
  gfx.fillEllipse(0, -28, 42, 48);

  // Два рога — главная деталь силуэта.
  drawCurvedBlade(
    gfx,
    [-14, -42],
    [-42, -48],
    [-36, -86],
    [-24, -60],
    [-8, -48],
    0x080e18,
    0xfbbf24,
    0.38
  );
  drawCurvedBlade(
    gfx,
    [14, -42],
    [42, -48],
    [36, -86],
    [24, -60],
    [8, -48],
    0x080e18,
    0x475569,
    0.28
  );

  body.add(gfx);

  // Узнаваемая деталь: тлеющая трещина в груди.
  const fissureGlow = scene.add
    .image(0, 24, glowKey)
    .setDisplaySize(46, 96)
    .setTint(0xf97316)
    .setAlpha(0.28)
    .setBlendMode(Phaser.BlendModes.ADD);

  const fissure = scene.add.graphics();
  const fissurePath: [number, number][] = [
    [1, -6],
    [-4, 12],
    [4, 28],
    [-2, 46],
    [2, 60],
  ];
  fissure.lineStyle(3, 0xf97316, 0.55);
  fissure.beginPath();
  fissurePath.forEach(([x, y], i) => (i === 0 ? fissure.moveTo(x, y) : fissure.lineTo(x, y)));
  fissure.strokePath();
  fissure.lineStyle(1, 0xfef08a, 0.9);
  fissure.beginPath();
  fissurePath.forEach(([x, y], i) => (i === 0 ? fissure.moveTo(x, y) : fissure.lineTo(x, y)));
  fissure.strokePath();

  body.add([fissureGlow, fissure]);

  // Угольки поднимаются из трещины.
  for (let i = 0; i < 3; i++) {
    const ember = scene.add.circle(0, 26 + i * 10, 1.8, 0xfbbf24, 0);
    body.add(ember);
    scene.tweens.add({
      targets: ember,
      y: ember.y - 34,
      alpha: { from: 0.9, to: 0 },
      duration: 1400 + i * 260,
      delay: i * 420,
      repeat: -1,
      ease: 'Sine.easeOut',
    });
  }

  scene.tweens.add({
    targets: fissureGlow,
    alpha: 0.16,
    duration: 900,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  body.add([
    createGlowingEye(scene, -8, -28, 8, 3.6, 0xfbbf24, 0.15, true),
    createGlowingEye(scene, 8, -28, 8, 3.6, 0xfbbf24, -0.15, true),
  ]);
  root.add(body);

  scene.tweens.add({
    targets: body,
    y: -4,
    duration: 2100,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  return root;
}

/**
 * Вариант 2: «Багровый Палач» (Тёмный Инквизитор)
 * Высокая мантия и остроконечный капюшон с двумя багровыми глазами.
 */
function createCrimsonInquisitor(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0);

  const glowKey = ensureGlowTexture(scene);
  const auraGlow = scene.add
    .image(0, -8, glowKey)
    .setDisplaySize(150, 190)
    .setTint(0xef4444)
    .setAlpha(0.09)
    .setBlendMode(Phaser.BlendModes.ADD);
  root.add(auraGlow);

  const body = scene.add.container(0, 0);
  const gfx = scene.add.graphics();

  // Тень на полу: привязывает силуэт к земле.
  gfx.fillStyle(0x02040a, 0.55);
  gfx.fillEllipse(0, 96, 108, 18);

  // Мантия: узкий высокий силуэт до пола.
  const robeLeft = quadCurvePoints(-30, -8, -42, 30, -46, 95, 16);
  const robeRight = quadCurvePoints(46, 95, 42, 30, 30, -8, 16);
  gfx.fillStyle(0x0e1524, 1);
  gfx.fillPoints([...robeLeft, ...robeRight], true);
  gfx.lineStyle(1.6, 0xef4444, 0.34);
  gfx.strokePoints(robeLeft, false);
  gfx.lineStyle(1.4, 0xef4444, 0.18);
  gfx.strokePoints(robeRight, false);

  // Капюшон: плавное сужение к макушке.
  const hoodLeft = quadCurvePoints(0, -62, -24, -34, -22, 8, 16);
  const hoodBottom = quadCurvePoints(-22, 8, 0, 18, 22, 8, 10);
  const hoodRight = quadCurvePoints(22, 8, 24, -34, 0, -62, 16);
  gfx.fillStyle(0x111827, 1);
  gfx.fillPoints([...hoodLeft, ...hoodBottom.slice(1), ...hoodRight.slice(1)], true);
  gfx.lineStyle(1.6, 0xef4444, 0.36);
  gfx.strokePoints(hoodLeft, false);
  gfx.lineStyle(1.4, 0xef4444, 0.2);
  gfx.strokePoints(hoodRight, false);

  // Провал внутри капюшона.
  gfx.fillStyle(0x020409, 1);
  gfx.fillEllipse(0, -22, 26, 34);

  body.add(gfx);

  // Узнаваемая деталь: клинок палача остриём вниз.
  const blade = scene.add.container(22, -2);
  const bladeGlow = scene.add
    .image(0, 38, glowKey)
    .setDisplaySize(26, 86)
    .setTint(0xef4444)
    .setAlpha(0.16)
    .setBlendMode(Phaser.BlendModes.ADD);

  const bladeGfx = scene.add.graphics();
  const bladePts = [
    point(-3.5, 0),
    point(3.5, 0),
    point(2.5, 62),
    point(0, 76),
    point(-2.5, 62),
  ];
  bladeGfx.fillStyle(0x1b2536, 1);
  bladeGfx.fillPoints(bladePts, true);
  bladeGfx.lineStyle(1.2, 0xef4444, 0.6);
  bladeGfx.strokePoints(bladePts, true);
  bladeGfx.lineStyle(1, 0xf87171, 0.8);
  bladeGfx.lineBetween(-3, 3, -2, 60);

  // Гарда, рукоять и навершие.
  bladeGfx.fillStyle(0x475569, 1);
  bladeGfx.fillRect(-9, -4, 18, 3);
  bladeGfx.fillStyle(0x334155, 1);
  bladeGfx.fillRect(-2, -16, 4, 13);
  bladeGfx.fillStyle(0xb08a4a, 1);
  bladeGfx.fillCircle(0, -18, 2.6);

  blade.add([bladeGlow, bladeGfx]);
  body.add(blade);

  scene.tweens.add({
    targets: blade,
    rotation: 0.035,
    duration: 3000,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  body.add([
    createGlowingEye(scene, -6, -22, 8, 3.4, 0xef4444, 0.2, true),
    createGlowingEye(scene, 6, -22, 8, 3.4, 0xef4444, -0.2, true),
  ]);
  root.add(body);

  scene.tweens.add({
    targets: body,
    y: -4,
    duration: 2200,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  return root;
}

/**
 * Вариант 3: «Вестник Эхо» (Призрачный Жрец)
 * Долгая мантия, тонкий обод над головой и кристалл Эхо в руках.
 */
function createEchoWraith(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0);

  const glowKey = ensureGlowTexture(scene);
  const auraGlow = scene.add
    .image(0, -6, glowKey)
    .setDisplaySize(150, 190)
    .setTint(0x38bdf8)
    .setAlpha(0.09)
    .setBlendMode(Phaser.BlendModes.ADD);
  root.add(auraGlow);

  const body = scene.add.container(0, 0);
  const gfx = scene.add.graphics();

  // Тень на полу: привязывает силуэт к земле.
  gfx.fillStyle(0x02040a, 0.5);
  gfx.fillEllipse(0, 96, 100, 16);

  // Мантия: плавные линии от капюшона к полу.
  const robeLeft = quadCurvePoints(0, -46, -30, -30, -44, 95, 16);
  const robeRight = quadCurvePoints(44, 95, 30, -30, 0, -46, 16);
  gfx.fillStyle(0x0d1524, 1);
  gfx.fillPoints([...robeLeft, ...robeRight], true);
  gfx.lineStyle(1.6, 0x38bdf8, 0.34);
  gfx.strokePoints(robeLeft, false);
  gfx.lineStyle(1.4, 0x38bdf8, 0.18);
  gfx.strokePoints(robeRight, false);

  // Тёмный провал капюшона.
  const hoodLeft = quadCurvePoints(0, -38, -16, -26, -12, -6, 10);
  const hoodRight = quadCurvePoints(12, -6, 16, -26, 0, -38, 10);
  gfx.fillStyle(0x020409, 1);
  gfx.fillPoints([...hoodLeft, point(0, 0), ...hoodRight], true);

  // Тонкий обод над головой вместо короны с зубцами.
  gfx.lineStyle(1.6, 0x38bdf8, 0.4);
  gfx.beginPath();
  gfx.arc(0, -44, 26, Math.PI + 0.35, -0.35, false);
  gfx.strokePath();

  body.add(gfx);
  body.add([
    createGlowingEye(scene, -6, -20, 7.5, 3.5, 0x38bdf8, 0.15, false),
    createGlowingEye(scene, 6, -20, 7.5, 3.5, 0x38bdf8, -0.15, false),
  ]);
  root.add(body);

  // Кристалл Эхо в руках: ромб и мягкое свечение.
  const hands = scene.add.container(0, 16);
  const crystal = scene.add.graphics();
  const crystalPts = [point(0, -10), point(7, 0), point(0, 10), point(-7, 0)];
  crystal.fillStyle(0x38bdf8, 0.9);
  crystal.fillPoints(crystalPts, true);
  crystal.lineStyle(1.2, 0xe0f2fe, 0.8);
  crystal.strokePoints(crystalPts, true);

  const crystalGlow = scene.add
    .image(0, 0, glowKey)
    .setDisplaySize(44, 44)
    .setTint(0x38bdf8)
    .setAlpha(0.3)
    .setBlendMode(Phaser.BlendModes.ADD);

  hands.add([crystalGlow, crystal]);

  // Узнаваемая деталь: два осколка Эхо на орбите вокруг кристалла.
  const shards: Phaser.GameObjects.Container[] = [];
  for (let i = 0; i < 2; i++) {
    const shard = scene.add.container(0, 0);
    const shardGfx = scene.add.graphics();
    const shardPts = [point(0, -5), point(3.2, 0), point(0, 5), point(-3.2, 0)];
    shardGfx.fillStyle(0x7dd3fc, 0.9);
    shardGfx.fillPoints(shardPts, true);
    shardGfx.lineStyle(1, 0xe0f2fe, 0.8);
    shardGfx.strokePoints(shardPts, true);

    const shardGlow = scene.add
      .image(0, 0, glowKey)
      .setDisplaySize(20, 20)
      .setTint(0x38bdf8)
      .setAlpha(0.32)
      .setBlendMode(Phaser.BlendModes.ADD);

    shard.add([shardGlow, shardGfx]);
    hands.add(shard);
    shards.push(shard);
  }

  // Орбита считается вручную: ромбы должны оставаться вертикальными.
  const orbit = { angle: 0 };
  scene.tweens.add({
    targets: orbit,
    angle: Math.PI * 2,
    duration: 6000,
    repeat: -1,
    ease: 'Linear',
    onUpdate: () => {
      shards.forEach((shard, i) => {
        const a = orbit.angle + i * Math.PI;
        shard.setPosition(Math.cos(a) * 26, Math.sin(a) * 11);
      });
    },
  });
  root.add(hands);

  scene.tweens.add({
    targets: hands,
    y: 12,
    duration: 1500,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  return root;
}

/**
 * Контроллер: управляет спавном в центральной арке.
 * Монстры крупные и появляются ТОЛЬКО снизу/сбоку (левый угол, центр, правый угол).
 */
function setupCentralArchMonsters(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container
): void {
  const archRadius = CENTER_ARCH.width / 2; // 125
  const shoulderY = CENTER_ARCH.top + archRadius; // 345
  const innerRadius = archRadius - 14; // Внутри декоративной обводки арки

  const maskGfx = scene.add.graphics();
  maskGfx.fillStyle(0xffffff);
  maskGfx.fillCircle(CENTER_ARCH.x, shoulderY, innerRadius);
  maskGfx.fillRect(
    CENTER_ARCH.x - innerRadius,
    shoulderY,
    innerRadius * 2,
    CENTER_ARCH.height - 10
  );
  maskGfx.setVisible(false);
  parent.add(maskGfx);

  const monsterLayer = scene.add.container(0, 0);
  monsterLayer.setMask(maskGfx.createGeometryMask());
  parent.add(monsterLayer);

  let isMonsterActive = false;

  const spawnMonster = () => {
    if (isMonsterActive) {
      scene.time.delayedCall(2000, spawnMonster);
      return;
    }

    isMonsterActive = true;

    const variants = [createAshLord, createCrimsonInquisitor, createEchoWraith];
    const pickedCreator = Phaser.Utils.Array.GetRandom(variants);
    const monster = pickedCreator(scene);

    // ТОЛЬКО 3 позиции на уровне земли (без зависания под потолком):
    // 0: Левый угол (выходит из-за левой колонны)
    // 1: Правый угол (выходит из-за правой колонны)
    // 2: По центру (поднимается из глубины проёма)
    const spotType = Phaser.Math.Between(0, 2);

    let startX = Number(CENTER_ARCH.x);
    let targetX = Number(CENTER_ARCH.x);
    // Привязываем по высоте к нижней половине проёма, чтобы подол мантии уходил в пол (588)
    let startY = shoulderY + 135;
    let targetY = shoulderY + 125;

    if (spotType === 0) {
      // Из левого угла
      startX = CENTER_ARCH.x - 82;
      targetX = CENTER_ARCH.x - 38;
      targetY = shoulderY + 130;
      startY = targetY + 18;
      monster.setScale(1.36);
      monster.setRotation(0.06);
    } else if (spotType === 1) {
      // Из правого угла
      startX = CENTER_ARCH.x + 82;
      targetX = CENTER_ARCH.x + 38;
      targetY = shoulderY + 130;
      startY = targetY + 18;
      monster.setScale(1.36);
      monster.setRotation(-0.06);
    } else {
      // По центру в полный рост (крупный план)
      startX = CENTER_ARCH.x + Phaser.Math.Between(-10, 10);
      targetX = startX;
      targetY = shoulderY + 120;
      startY = targetY + 40;
      monster.setScale(1.48);
    }

    monster.setPosition(startX, startY);
    monster.setAlpha(0);
    monsterLayer.add(monster);

    scene.tweens.chain({
      targets: monster,
      tweens: [
        {
          x: targetX,
          y: targetY,
          alpha: 0.95,
          duration: 2100,
          ease: 'Cubic.easeOut',
        },
        {
          y: targetY - 5,
          duration: 2800,
          yoyo: true,
          repeat: 1,
          ease: 'Sine.easeInOut',
        },
        {
          x: startX,
          y: startY,
          alpha: 0,
          duration: 1600,
          ease: 'Sine.easeIn',
          onComplete: () => {
            monster.destroy();
            isMonsterActive = false;
          },
        },
      ],
    });

    scene.time.delayedCall(Phaser.Math.Between(5000, 10000), spawnMonster);
  };

  scene.time.delayedCall(2500, spawnMonster);
}

export function drawHubBackground(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  width: number,
  height: number
): void {
  // 1. Задняя стена и черные пустоты арок
  const backGraphics = scene.add.graphics();
  backGraphics.fillGradientStyle(0x101a2b, 0x101a2b, 0x05070c, 0x05070c, 1);
  backGraphics.fillRect(0, 0, width, height);
  drawStoneWall(backGraphics, width);

  for (const arch of ARCHES) {
    const radius = arch.width / 2;
    const shoulderY = arch.top + radius;
    backGraphics.fillStyle(0x020409, 1);
    backGraphics.fillCircle(arch.x, shoulderY, radius);
    backGraphics.fillRect(arch.x - radius, shoulderY, arch.width, arch.height);
  }
  parent.add(backGraphics);

  // 2. Слой мерцающих монстров СТРОГО в центральной арке
  setupCentralArchMonsters(scene, parent);

  // 3. Каменные рамки арок, колонны и пол (перекрывают края)
  const archBorders = scene.add.graphics();
  for (const arch of ARCHES) {
    const radius = arch.width / 2;
    const shoulderY = arch.top + radius;
    archBorders.lineStyle(10, 0x1b2536, 1);
    archBorders.beginPath();
    archBorders.arc(arch.x, shoulderY, radius, Math.PI, 0, false);
    archBorders.strokePath();
    archBorders.lineBetween(arch.x - radius, shoulderY, arch.x - radius, shoulderY + arch.height);
    archBorders.lineBetween(arch.x + radius, shoulderY, arch.x + radius, shoulderY + arch.height);

    archBorders.lineStyle(2, 0x2a3446, 0.7);
    archBorders.beginPath();
    archBorders.arc(arch.x, shoulderY, radius - 12, Math.PI, 0, false);
    archBorders.strokePath();
  }
  drawColumns(archBorders);
  drawFloor(archBorders, width, height);
  parent.add(archBorders);

  // 4. Фоновый туман: мягкие градиентные пятна вместо эллипсов.
  // У эллипса сплошная заливка и жёсткая граница, поэтому он читался
  // как круглое пятно. Здесь край растворяется в фоне.
  const fogKey = ensureGlowTexture(scene);
  const fogTints = [0x94a3b8, 0x7d8fa8, 0x64748b];
  const fogCount = 26;

  for (let i = 0; i < fogCount; i++) {
    // Пятна держатся у пола, лишь немного поднимаясь к аркам.
    const fogY = Phaser.Math.Between(500, 690);
    const fog = scene.add
      .image(
        Phaser.Math.Between(-60, width + 60),
        fogY,
        fogKey
      )
      .setDisplaySize(
        Phaser.Math.Between(180, 420),
        Phaser.Math.Between(40, 90)
      )
      .setTint(Phaser.Utils.Array.GetRandom(fogTints))
      .setAlpha(Phaser.Math.FloatBetween(0.03, 0.07))
      .setBlendMode(Phaser.BlendModes.ADD);

    parent.add(fog);

    // Медленный дрейф вбок и чуть вверх: дымка, а не падающий снег.
    scene.tweens.add({
      targets: fog,
      x: fog.x + Phaser.Math.Between(40, 140),
      y: fog.y - Phaser.Math.Between(4, 14),
      duration: Phaser.Math.Between(9000, 16000),
      delay: Phaser.Math.Between(0, 5000),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // 5. Костер и сидящий страж на переднем плане
  const camp = scene.add.container(330, 600).setScale(1.55);
  camp.add([createBrazier(scene), createSeatedKnight(scene)]);
  parent.add(camp);

  spawnEmbers(scene, parent, width, height, 34);
  parent.add(createVignette(scene, width, height, UI_COLORS.void, 0.75));
}