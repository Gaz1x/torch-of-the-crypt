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
      const aura = scene.add.circle(0, 0, cfg.radius + 16, 0x450a0a, 0.35);
      const outerGlow = scene.add.circle(0, 0, cfg.radius + 4, 0x7f1d1d, 0.25);
      const emberHalo = scene.add
        .circle(0, 0, cfg.radius + 28, 0xf97316, 0.12)
        .setBlendMode(Phaser.BlendModes.ADD);

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
      const hornLeftLight = scene.add.polygon(
        7,
        -cfg.radius + 7,
        [0, 0, 15, -6, 7, 5],
        0xdc2626,
        0.8
      ).setOrigin(0);
      const hornRightLight = scene.add.polygon(
        7,
        cfg.radius - 7,
        [0, 0, 15, 6, 7, -5],
        0xdc2626,
        0.8
      ).setOrigin(0);

      const bodyShape = scene.add.circle(0, 0, cfg.radius, cfg.bodyColor)
        .setStrokeStyle(4, cfg.strokeColor);
      const bodyHighlight = scene.add.circle(-8, -8, cfg.radius * 0.7, 0x7f1d1d, 0.3);

      // Огненное ядро: три слоя плюс аддитивное свечение.
      const flameGlow = scene.add
        .circle(4, 0, 34, 0xea580c, 0.22)
        .setBlendMode(Phaser.BlendModes.ADD);
      const flameOuter = scene.add.circle(4, 0, 22, 0xea580c, 0.8);
      const flameMid = scene.add.circle(4, 0, 14, 0xf97316, 0.95);
      const glow = scene.add.circle(4, 0, 8, 0xfef08a, 1)
        .setStrokeStyle(1, 0xfff7ed);

      // Угли, поднимающиеся от тела.
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5 + 0.4;
        const ember = scene.add.circle(
          Math.cos(angle) * (cfg.radius + 6),
          Math.sin(angle) * (cfg.radius + 6),
          2.4,
          0xfbbf24,
          0.7
        );
        container.add(ember);
        scene.tweens.add({
          targets: ember,
          y: ember.y - 26,
          alpha: 0,
          duration: 1500 + i * 220,
          repeat: -1,
          ease: 'Sine.easeOut',
        });
      }

      const eyeLeft = scene.add
        .circle(16, -12, 9, cfg.eyeColor, 0.22)
        .setBlendMode(Phaser.BlendModes.ADD);
      const eyeRight = scene.add
        .circle(16, 12, 9, cfg.eyeColor, 0.22)
        .setBlendMode(Phaser.BlendModes.ADD);
      const e1 = scene.add.circle(16, -12, 4, cfg.eyeColor);
      const e2 = scene.add.circle(16, 12, 4, cfg.eyeColor);
      eyes.push(e1, e2);

      container.add([
        emberHalo,
        aura,
        outerGlow,
        hornLeft,
        hornRight,
        hornLeftLight,
        hornRightLight,
        bodyShape,
        bodyHighlight,
        flameGlow,
        flameOuter,
        flameMid,
        glow,
        eyeLeft,
        eyeRight,
        e1,
        e2,
      ]);

      scene.tweens.add({
        targets: emberHalo,
        scale: 1.12,
        alpha: 0.06,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      scene.tweens.add({
        targets: [flameGlow, flameOuter, flameMid],
        scale: 1.12,
        alpha: 0.8,
        duration: 620,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      return { container, bodyShape, eyes, glow };
    }
  }
}
