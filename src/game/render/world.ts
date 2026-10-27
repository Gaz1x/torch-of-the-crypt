import Phaser from 'phaser';
import { GAME_CONFIG } from '../core/gameConfig';

// ============================================================================
// ПРОЦЕДУРНАЯ ОТРИСОВКА КРИПТЫ (фон, колонны, стены, точки появления врагов)
// ============================================================================

/** Точка появления врага — трещина в стене. */
export interface WorldCrack {
  x: number;
  y: number;
}

export function drawCryptEnvironment(scene: Phaser.Scene): WorldCrack[] {
  const { WIDTH, HEIGHT } = GAME_CONFIG.WORLD;
  const bg = scene.add.graphics().setDepth(0);

  bg.fillStyle(0x161f30, 1);
  bg.fillRect(0, 0, WIDTH, HEIGHT);

  const tile = 64;
  for (let x = 0; x < WIDTH; x += tile) {
    for (let y = 0; y < HEIGHT; y += tile) {
      const isAlt = ((x / tile) + (y / tile)) % 2 === 0;
      bg.fillStyle(isAlt ? 0x1e293b : 0x192334, 1);
      bg.fillRect(x + 2, y + 2, tile - 4, tile - 4);
    }
  }

  bg.fillStyle(0x0f172a, 0.5);
  for (let i = 0; i < 45; i++) {
    const rx = Phaser.Math.Between(50, WIDTH - 50);
    const ry = Phaser.Math.Between(50, HEIGHT - 50);
    bg.fillCircle(rx, ry, Phaser.Math.Between(4, 14));
  }

  // Декоративный рунический круг в центре зала
  bg.lineStyle(2, 0x334155, 0.45);
  bg.strokeCircle(WIDTH / 2, HEIGHT / 2, 110);
  bg.strokeCircle(WIDTH / 2, HEIGHT / 2, 85);

  // Каменные колонны
  const pillars = [
    { x: 192, y: 160 }, { x: 768, y: 160 },
    { x: 192, y: 480 }, { x: 768, y: 480 },
  ];
  for (const p of pillars) {
    bg.fillStyle(0x090d16, 0.7);
    bg.fillCircle(p.x + 4, p.y + 6, 22);
    bg.fillStyle(0x334155, 1);
    bg.fillCircle(p.x, p.y, 20);
    bg.lineStyle(3, 0x475569, 1);
    bg.strokeCircle(p.x, p.y, 20);
  }

  // Стены по периметру
  bg.lineStyle(24, 0x090d16, 1);
  bg.strokeRect(0, 0, WIDTH, HEIGHT);
  bg.lineStyle(4, 0x334155, 0.6);
  bg.strokeRect(14, 14, WIDTH - 28, HEIGHT - 28);

  // Разломы в стенах — точки, из которых появляются враги
  const cracks: WorldCrack[] = [
    { x: 28, y: 120 }, { x: 28, y: 320 }, { x: 28, y: 520 },
    { x: WIDTH - 28, y: 120 }, { x: WIDTH - 28, y: 320 }, { x: WIDTH - 28, y: 520 },
    { x: 280, y: 28 }, { x: 680, y: 28 },
    { x: 280, y: HEIGHT - 28 }, { x: 680, y: HEIGHT - 28 },
  ];

  for (const c of cracks) {
    bg.fillStyle(0x02040a, 1);
    bg.fillCircle(c.x, c.y, 16);
    bg.lineStyle(2, 0x6d28d9, 0.5);
    bg.strokeCircle(c.x, c.y, 16);

    bg.lineStyle(3, 0x02040a, 1);
    bg.lineBetween(c.x, c.y, c.x + 22, c.y + 15);
    bg.lineBetween(c.x, c.y, c.x - 18, c.y - 20);
    bg.lineBetween(c.x, c.y, c.x + 14, c.y - 19);
  }

  return cracks;
}
