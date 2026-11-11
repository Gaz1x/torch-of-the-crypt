import Phaser from 'phaser';
import { GAME_CONFIG } from '../core/gameConfig';
import { createVignette, spawnEmbers, UI_COLORS } from './uiKit';

// ============================================================================
// ПРОЦЕДУРНАЯ ОТРИСОВКА КРИПТЫ (стены, плиты, колонны, факелы, порталы)
// Палитра повторяет интерфейс: тёмно-синий камень, латунь, тёплый огонь.
// ============================================================================

/** Точка на карте: трещина-портал или настенный факел. */
export interface WorldCrack {
  x: number;
  y: number;
}

/** Всё, что сцена забирает из фона: точки спавна и источники света. */
export interface WorldLayout {
  cracks: WorldCrack[];
  torches: WorldCrack[];
}

/** Толщина стен по периметру и размер каменной плиты пола. */
const WALL = 46;
const TILE = 96;

const FLOOR_COLORS = [0x18212f, 0x1a2333, 0x161e2b, 0x1c2638] as const;
const MORTAR_COLOR = 0x080d15;
const BEVEL_LIGHT = 0x2c3a4f;
const BEVEL_DARK = 0x05080f;
const BRASS = 0xb08a4a;

/** Graphics в Phaser 4 принимает точки только как полноценные Vector2. */
const point = (x: number, y: number): Phaser.Math.Vector2 => new Phaser.Math.Vector2(x, y);

export function drawCryptEnvironment(scene: Phaser.Scene): WorldLayout {
  const { WIDTH, HEIGHT } = GAME_CONFIG.WORLD;

  const bg = scene.add.graphics().setDepth(0);
  bg.fillStyle(UI_COLORS.void, 1);
  bg.fillRect(0, 0, WIDTH, HEIGHT);

  const cracks: WorldCrack[] = [
    { x: 28, y: HEIGHT * 0.17 },
    { x: 28, y: HEIGHT * 0.5 },
    { x: 28, y: HEIGHT * 0.83 },
    { x: WIDTH - 28, y: HEIGHT * 0.17 },
    { x: WIDTH - 28, y: HEIGHT * 0.5 },
    { x: WIDTH - 28, y: HEIGHT * 0.83 },
    { x: WIDTH * 0.29, y: 28 },
    { x: WIDTH * 0.71, y: 28 },
    { x: WIDTH * 0.29, y: HEIGHT - 28 },
    { x: WIDTH * 0.71, y: HEIGHT - 28 },
  ];

  drawFloor(bg, WIDTH, HEIGHT);
  drawWalls(bg, WIDTH, HEIGHT);
  drawRunicCircle(bg, WIDTH / 2, HEIGHT / 2);
  drawColumns(bg);
  drawCrackPits(bg, cracks);

  createCrackGlows(scene, cracks);
  const torches = createWallTorches(scene, WIDTH, HEIGHT);

  createFog(scene, WIDTH, HEIGHT);

  const embers = scene.add.container(0, 0).setDepth(3);
  spawnEmbers(scene, embers, WIDTH, HEIGHT, 26);

  createVignette(scene, WIDTH, HEIGHT, UI_COLORS.void, 0.55).setDepth(19);

  return { cracks, torches };
}

// ----------------------------------------------------------------------------
// ПОЛ
// ----------------------------------------------------------------------------

function drawFloor(g: Phaser.GameObjects.Graphics, width: number, height: number): void {
  g.fillStyle(MORTAR_COLOR, 1);
  g.fillRect(WALL, WALL, width - WALL * 2, height - WALL * 2);

  const cols = Math.ceil((width - WALL * 2) / TILE);
  const rows = Math.ceil((height - WALL * 2) / TILE);
  let index = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = WALL + col * TILE;
      const y = WALL + row * TILE;
      const w = Math.min(TILE, width - WALL - x);
      const h = Math.min(TILE, height - WALL - y);
      if (w <= 0 || h <= 0) continue;

      const color = FLOOR_COLORS[(col * 5 + row * 3) % FLOOR_COLORS.length];
      g.fillStyle(color, 1);
      g.fillRect(x + 2, y + 2, w - 4, h - 4);

      // Фаска: свет сверху-слева, тень снизу-справа.
      g.lineStyle(1, BEVEL_LIGHT, 0.32);
      g.lineBetween(x + 3, y + 3, x + w - 3, y + 3);
      g.lineBetween(x + 3, y + 3, x + 3, y + h - 3);
      g.lineStyle(1, BEVEL_DARK, 0.5);
      g.lineBetween(x + 3, y + h - 3, x + w - 3, y + h - 3);
      g.lineBetween(x + w - 3, y + 3, x + w - 3, y + h - 3);

      // Редкие трещины делают пол живым, но не мешают читать бой.
      if ((index + row) % 7 === 0 && w > 40 && h > 40) {
        const sx = x + 16 + ((index * 13) % 40);
        const sy = y + 18 + ((index * 29) % 40);
        g.lineStyle(1, 0x04070d, 0.55);
        g.beginPath();
        g.moveTo(sx, sy);
        g.lineTo(sx + 18, sy + 9);
        g.lineTo(sx + 30, sy + 4);
        g.strokePath();
      }

      index++;
    }
  }

  // Мягкая тень от стен на полу: несколько рамок с убывающей прозрачностью.
  for (let i = 0; i < 5; i++) {
    const inset = WALL + i * 7;
    g.lineStyle(7, 0x000000, 0.16 - i * 0.028);
    g.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
  }
}

// ----------------------------------------------------------------------------
// СТЕНЫ
// ----------------------------------------------------------------------------

function drawWalls(g: Phaser.GameObjects.Graphics, width: number, height: number): void {
  const stone = 0x121a28;
  const stoneAlt = 0x0e1520;

  g.fillStyle(stoneAlt, 1);
  g.fillRect(0, 0, width, WALL);
  g.fillRect(0, height - WALL, width, WALL);
  g.fillRect(0, WALL, WALL, height - WALL * 2);
  g.fillRect(width - WALL, WALL, WALL, height - WALL * 2);

  // Кладка: ряды камня со сдвигом, как у настоящей стены.
  const blockW = 92;
  const blockH = 22;
  const rows = Math.ceil(WALL / blockH);

  for (let row = 0; row < rows; row++) {
    const by = row * blockH;
    const bh = Math.min(blockH, WALL - by);
    if (bh <= 0) continue;

    const offset = row % 2 === 0 ? 0 : blockW / 2;
    for (let x = -blockW; x < width + blockW; x += blockW) {
      const bx = x + offset;
      const isAlt = (Math.round(bx / blockW) + row) % 2 === 0;
      g.fillStyle(isAlt ? stone : stoneAlt, 1);

      g.fillRect(bx + 2, by + 2, blockW - 4, bh - 4);
      g.fillRect(bx + 2, height - WALL + by + 2, blockW - 4, bh - 4);

      g.fillStyle(BEVEL_LIGHT, 0.16);
      g.fillRect(bx + 2, by + 2, blockW - 4, 2);
      g.fillRect(bx + 2, height - WALL + by + 2, blockW - 4, 2);
    }
  }

  // Боковые стены: те же камни, повёрнутые вертикально.
  for (let col = 0; col < rows; col++) {
    const bx = col * blockH;
    const bw = Math.min(blockH, WALL - bx);
    if (bw <= 0) continue;

    const offset = col % 2 === 0 ? 0 : blockW / 2;
    for (let y = -blockW; y < height + blockW; y += blockW) {
      const by = y + offset;
      const isAlt = (Math.round(by / blockW) + col) % 2 === 0;
      g.fillStyle(isAlt ? stone : stoneAlt, 1);

      g.fillRect(bx + 2, by + 2, bw - 4, blockW - 4);
      g.fillRect(width - WALL + bx + 2, by + 2, bw - 4, blockW - 4);

      g.fillStyle(BEVEL_LIGHT, 0.14);
      g.fillRect(bx + 2, by + 2, 2, blockW - 4);
      g.fillRect(width - WALL + bx + 2, by + 2, 2, blockW - 4);
    }
  }

  // Внутренняя кромка стены — светлая линия, отделяющая пол.
  g.lineStyle(2, 0x334155, 0.55);
  g.strokeRect(WALL - 1, WALL - 1, width - WALL * 2 + 2, height - WALL * 2 + 2);
  g.lineStyle(1, BRASS, 0.18);
  g.strokeRect(WALL + 4, WALL + 4, width - WALL * 2 - 8, height - WALL * 2 - 8);
}

// ----------------------------------------------------------------------------
// РУНИЧЕСКИЙ КРУГ
// ----------------------------------------------------------------------------

function drawRunicCircle(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  g.fillStyle(0x0a1019, 0.35);
  g.fillCircle(cx, cy, 136);

  g.lineStyle(2, BRASS, 0.34);
  g.strokeCircle(cx, cy, 124);
  g.lineStyle(1, BRASS, 0.22);
  g.strokeCircle(cx, cy, 104);
  g.lineStyle(1, BRASS, 0.12);
  g.strokeCircle(cx, cy, 64);

  // Насечки по внешнему кольцу.
  const ticks = 32;
  for (let i = 0; i < ticks; i++) {
    const angle = (Math.PI * 2 * i) / ticks;
    const long = i % 4 === 0;
    const inner = long ? 104 : 111;
    g.lineStyle(long ? 2 : 1, BRASS, long ? 0.4 : 0.24);
    g.lineBetween(
      cx + Math.cos(angle) * inner,
      cy + Math.sin(angle) * inner,
      cx + Math.cos(angle) * 119,
      cy + Math.sin(angle) * 119
    );
  }

  // Спицы и ромб в центре.
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8 + Math.PI / 8;
    g.lineStyle(1, BRASS, 0.1);
    g.lineBetween(
      cx + Math.cos(angle) * 70,
      cy + Math.sin(angle) * 70,
      cx + Math.cos(angle) * 98,
      cy + Math.sin(angle) * 98
    );
  }

  const diamond = [point(cx, cy - 42), point(cx + 42, cy), point(cx, cy + 42), point(cx - 42, cy)];
  g.lineStyle(1, BRASS, 0.2);
  g.strokePoints(diamond, true);
}

// ----------------------------------------------------------------------------
// КОЛОННЫ И ПОРТАЛЫ
// ----------------------------------------------------------------------------

function drawColumns(g: Phaser.GameObjects.Graphics): void {
  const { WIDTH, HEIGHT } = GAME_CONFIG.WORLD;
  const positions = [
    { x: WIDTH * 0.2, y: HEIGHT * 0.27 },
    { x: WIDTH * 0.8, y: HEIGHT * 0.27 },
    { x: WIDTH * 0.2, y: HEIGHT * 0.73 },
    { x: WIDTH * 0.8, y: HEIGHT * 0.73 },
  ];

  for (const p of positions) {
    // Тень на полу.
    g.fillStyle(0x03060b, 0.55);
    g.fillEllipse(p.x + 8, p.y + 10, 78, 26);

    // База и капитель.
    g.fillStyle(0x0d1521, 1);
    g.fillRect(p.x - 24, p.y - 8, 48, 14);
    g.fillStyle(0x1d2839, 1);
    g.fillRect(p.x - 21, p.y - 12, 42, 6);

    g.fillStyle(0x1d2839, 1);
    g.fillRect(p.x - 21, p.y - 74, 42, 11);
    g.fillStyle(BRASS, 0.45);
    g.fillRect(p.x - 21, p.y - 66, 42, 2);
    g.fillStyle(0x0d1521, 1);
    g.fillRect(p.x - 24, p.y - 82, 48, 9);

    // Ствол: светлая грань слева, тень справа.
    g.fillStyle(0x131c2a, 1);
    g.fillRect(p.x - 16, p.y - 64, 32, 54);
    g.fillStyle(0x203047, 1);
    g.fillRect(p.x - 16, p.y - 64, 12, 54);
    g.fillStyle(0x0a1019, 1);
    g.fillRect(p.x + 9, p.y - 64, 7, 54);

    // Стыки камня.
    g.lineStyle(1, 0x05080f, 0.5);
    g.lineBetween(p.x - 16, p.y - 36, p.x + 16, p.y - 36);
    g.lineBetween(p.x - 16, p.y - 52, p.x + 16, p.y - 52);

    // Тёплый отблеск от факелов.
    g.fillStyle(0xf59e0b, 0.045);
    g.fillCircle(p.x - 2, p.y - 40, 24);
  }
}

function drawCrackPits(g: Phaser.GameObjects.Graphics, cracks: WorldCrack[]): void {
  for (const c of cracks) {
    g.fillStyle(0x02040a, 1);
    g.fillCircle(c.x, c.y, 17);

    g.lineStyle(2, 0x7c3aed, 0.5);
    g.strokeCircle(c.x, c.y, 17);

    g.lineStyle(1, 0xa855f7, 0.35);
    g.strokeCircle(c.x, c.y, 10);

    // Рваные края провала.
    g.lineStyle(3, 0x02040a, 1);
    g.lineBetween(c.x, c.y, c.x + 22, c.y + 15);
    g.lineBetween(c.x, c.y, c.x - 18, c.y - 20);
    g.lineBetween(c.x, c.y, c.x + 14, c.y - 19);
    g.lineBetween(c.x, c.y, c.x - 21, c.y + 12);
  }
}

/** Пульсирующее фиолетовое свечение поверх провалов. */
function createCrackGlows(scene: Phaser.Scene, cracks: WorldCrack[]): void {
  cracks.forEach((c, index) => {
    const glow = scene.add.circle(c.x, c.y, 26, 0x6d28d9, 0.2).setDepth(2);
    scene.tweens.add({
      targets: glow,
      scale: 1.3,
      alpha: 0.08,
      duration: 1500 + index * 140,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  });
}

// ----------------------------------------------------------------------------
// ФАКЕЛЫ
// ----------------------------------------------------------------------------

function createWallTorches(
  scene: Phaser.Scene,
  width: number,
  height: number
): WorldCrack[] {
  const positions: WorldCrack[] = [
    { x: width * 0.35, y: WALL },
    { x: width * 0.65, y: WALL },
    { x: width * 0.35, y: height - WALL },
    { x: width * 0.65, y: height - WALL },
  ];

  for (const p of positions) {
    createTorch(scene, p.x, p.y);
  }

  // Свет точечных источников чуть выше чаши.
  return positions.map((p) => ({ x: p.x, y: p.y - 10 }));
}

function createTorch(scene: Phaser.Scene, x: number, y: number): void {
  const torch = scene.add.container(x, y).setDepth(4);

  const glow = scene.add.circle(0, -8, 52, 0xf97316, 0.13);
  const bracket = scene.add.rectangle(0, 8, 7, 18, 0x2a1a0d).setStrokeStyle(1, 0x120b06);
  const bowl = scene.add.ellipse(0, 1, 20, 7, 0x3f2a16).setStrokeStyle(1, 0x1c1008);
  const flameOuter = scene.add.circle(0, -9, 9, 0xf97316, 0.85);
  const flameMid = scene.add.circle(0, -13, 5.5, 0xfbbf24, 0.95);
  const flameCore = scene.add.circle(0, -16, 3, 0xfef08a, 1);

  torch.add([glow, bracket, bowl, flameOuter, flameMid, flameCore]);

  scene.tweens.add({
    targets: [flameOuter, flameMid, flameCore],
    scale: 1.2,
    alpha: 0.78,
    duration: 460,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  scene.tweens.add({
    targets: glow,
    scale: 1.18,
    alpha: 0.05,
    duration: 1400,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

// ----------------------------------------------------------------------------
// ТУМАН
// ----------------------------------------------------------------------------

function createFog(scene: Phaser.Scene, width: number, height: number): void {
  const fogA = scene.add.ellipse(width * 0.32, height * 0.62, 720, 190, 0x8fa8c8, 0.05).setDepth(2);
  const fogB = scene.add.ellipse(width * 0.7, height * 0.38, 840, 210, 0x6b88b0, 0.04).setDepth(2);
  const fogC = scene.add.ellipse(width * 0.5, height * 0.86, 900, 170, 0x0ea5e9, 0.03).setDepth(2);

  scene.tweens.add({
    targets: fogA,
    x: width * 0.4,
    alpha: 0.08,
    duration: 7200,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  scene.tweens.add({
    targets: fogB,
    x: width * 0.62,
    alpha: 0.07,
    duration: 8800,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  scene.tweens.add({
    targets: fogC,
    alpha: 0.06,
    duration: 5600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}
