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
  for (let i = 0; i < 60; i++) {
    const rx = Phaser.Math.Between(60, WIDTH - 60);
    const ry = Phaser.Math.Between(60, HEIGHT - 60);
    bg.fillCircle(rx, ry, Phaser.Math.Between(4, 14));
  }

  // Декоративный рунический круг в центре зала
  bg.lineStyle(2, 0x334155, 0.45);
  bg.strokeCircle(WIDTH / 2, HEIGHT / 2, 130);
  bg.strokeCircle(WIDTH / 2, HEIGHT / 2, 100);

  // Каменные колонны
  const pillars = [
    { x: WIDTH * 0.2, y: HEIGHT * 0.25 },
    { x: WIDTH * 0.8, y: HEIGHT * 0.25 },
    { x: WIDTH * 0.2, y: HEIGHT * 0.75 },
    { x: WIDTH * 0.8, y: HEIGHT * 0.75 },
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
  const edge = 28;
  const cracks: WorldCrack[] = [
    { x: edge, y: HEIGHT * 0.17 },
    { x: edge, y: HEIGHT * 0.5 },
    { x: edge, y: HEIGHT * 0.83 },
    { x: WIDTH - edge, y: HEIGHT * 0.17 },
    { x: WIDTH - edge, y: HEIGHT * 0.5 },
    { x: WIDTH - edge, y: HEIGHT * 0.83 },
    { x: WIDTH * 0.29, y: edge },
    { x: WIDTH * 0.71, y: edge },
    { x: WIDTH * 0.29, y: HEIGHT - edge },
    { x: WIDTH * 0.71, y: HEIGHT - edge },
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
