import Phaser from 'phaser';
import type { BossConfig, BossTypeKey } from '../core/bosses';
import type { EnemyVisual } from './enemyArt';

// ============================================================================
// ОТРИСОВКА БОССОВ
// Босс крупнее обычных врагов, поэтому у него отдельный силуэт и огненное ядро.
// ============================================================================

export function createBossVisual(
  scene: Phaser.Scene,
  key: BossTypeKey,
  cfg: BossConfig,
  x: number,
  y: number
): EnemyVisual {
  // Босс остаётся видимым даже вне круга света: иначе его атаки читаются хуже.
  const container = scene.add.container(x, y).setDepth(21);
  const eyes: Phaser.GameObjects.Arc[] = [];

  // Пока босс один, но switch оставляет место для следующего.
  switch (key) {
    case 'FLAME_EATER':
    default: {
      const aura = scene.add.circle(0, 0, cfg.radius + 14, 0x450a0a, 0.35);
      const outerGlow = scene.add.circle(0, 0, cfg.radius + 4, 0x7f1d1d, 0.25);

      const hornLeft = scene.add.polygon(
        6,
        -cfg.radius + 6,
        [0, 0, 26, -12, 10, 10],
        0x7f1d1d
      ).setOrigin(0);
      const hornRight = scene.add.polygon(
        6,
        cfg.radius - 6,
        [0, 0, 26, 12, 10, -10],
        0x7f1d1d
      ).setOrigin(0);

      const bodyShape = scene.add.circle(0, 0, cfg.radius, cfg.bodyColor)
        .setStrokeStyle(4, cfg.strokeColor);

      const flameOuter = scene.add.circle(4, 0, 22, 0xea580c, 0.8);
      const flameMid = scene.add.circle(4, 0, 14, 0xf97316, 0.95);
      const glow = scene.add.circle(4, 0, 8, 0xfef08a, 1)
        .setStrokeStyle(1, 0xfff7ed);

      const e1 = scene.add.circle(16, -12, 4, cfg.eyeColor);
      const e2 = scene.add.circle(16, 12, 4, cfg.eyeColor);
      eyes.push(e1, e2);

      container.add([
        aura,
        outerGlow,
        hornLeft,
        hornRight,
        bodyShape,
        flameOuter,
        flameMid,
        glow,
        e1,
        e2,
      ]);

      return { container, bodyShape, eyes, glow };
    }
  }
}
