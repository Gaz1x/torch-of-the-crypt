import Phaser from 'phaser';
import type { EnemyConfig, EnemyTypeKey } from '../core/gameConfig';

// ============================================================================
// ОТРИСОВКА ВРАГОВ (внешний вид тела, глаз, косметики)
// ============================================================================

export interface EnemyVisual {
  container: Phaser.GameObjects.Container;
  bodyShape: Phaser.GameObjects.Shape;
  eyes: Phaser.GameObjects.Arc[];
  glow?: Phaser.GameObjects.Arc;
  hpBar?: Phaser.GameObjects.Rectangle;
}

// Во всех полигонах ниже нужен setOrigin(0): точки Polygon рисуются минус
// displayOrigin (origin * размер), и без него фигура со смещёнными точками
// сдвигается на полразмера влево-вверх относительно заданной позиции.
export function createEnemyVisual(
  scene: Phaser.Scene,
  type: EnemyTypeKey,
  cfg: EnemyConfig,
  x: number,
  y: number
): EnemyVisual {
  const container = scene.add.container(x, y).setDepth(9);
  const eyes: Phaser.GameObjects.Arc[] = [];
  let bodyShape: Phaser.GameObjects.Shape;
  let glow: Phaser.GameObjects.Arc | undefined;
  let hpBar: Phaser.GameObjects.Rectangle | undefined;

  switch (type) {
    case 'SWARMER': {
      const shadowAura = scene.add.circle(0, 0, cfg.radius + 4, 0x3b0764, 0.35);
      bodyShape = scene.add.polygon(
        0,
        0,
        [14, 0, -10, -10, -5, 0, -10, 10],
        cfg.bodyColor
      ).setOrigin(0).setStrokeStyle(2, cfg.strokeColor);

      const e1 = scene.add.circle(5, -3, 2, cfg.eyeColor);
      const e2 = scene.add.circle(5, 3, 2, cfg.eyeColor);
      const e3 = scene.add.circle(9, 0, 1.8, cfg.eyeColor);
      eyes.push(e1, e2, e3);
      container.add([shadowAura, bodyShape, e1, e2, e3]);
      break;
    }

    case 'BRUTE': {
      const shadowAura = scene.add.circle(0, 0, cfg.radius + 6, 0x450a0a, 0.4);
      const hornLeft = scene.add.polygon(8, -14, [0, 0, 14, -8, 4, 6], 0x7f1d1d).setOrigin(0);
      const hornRight = scene.add.polygon(8, 14, [0, 0, 14, 8, 4, -6], 0x7f1d1d).setOrigin(0);
      bodyShape = scene.add.circle(0, 0, cfg.radius, cfg.bodyColor)
        .setStrokeStyle(3, cfg.strokeColor);

      const e1 = scene.add.circle(10, -7, 3.5, cfg.eyeColor);
      const e2 = scene.add.circle(10, 7, 3.5, cfg.eyeColor);
      eyes.push(e1, e2);

      hpBar = scene.add.rectangle(0, -cfg.radius - 10, 34, 5, 0xef4444)
        .setStrokeStyle(1, 0x000000);
      container.add([shadowAura, hornLeft, hornRight, bodyShape, e1, e2, hpBar]);
      break;
    }

    case 'SPITTER': {
      const shadowAura = scene.add.circle(0, 0, cfg.radius + 5, 0x2e1065, 0.4);
      const cloakTail = scene.add.polygon(
        -8,
        0,
        [[0, -11], [-14, -7], [-9, 0], [-14, 7], [0, 11]],
        0x1e1b4b
      ).setOrigin(0);
      bodyShape = scene.add.circle(0, 0, cfg.radius, cfg.bodyColor)
        .setStrokeStyle(2, cfg.strokeColor);

      const staff = scene.add.rectangle(15, 7, 18, 3, 0x475569);
      glow = scene.add.circle(25, 7, 6, 0xa855f7, 0.85)
        .setStrokeStyle(1, 0xf5d0fe);

      const e1 = scene.add.circle(5, -4, 2.2, cfg.eyeColor);
      const e2 = scene.add.circle(5, 4, 2.2, cfg.eyeColor);
      eyes.push(e1, e2);

      hpBar = scene.add.rectangle(0, -cfg.radius - 10, 30, 5, 0xef4444)
        .setStrokeStyle(1, 0x000000);
      container.add([shadowAura, cloakTail, staff, bodyShape, glow, e1, e2, hpBar]);
      break;
    }

    case 'BOMBER': {
      const shadowAura = scene.add.circle(0, 0, cfg.radius + 6, 0x450a0a, 0.45);
      bodyShape = scene.add.circle(0, 0, cfg.radius, cfg.bodyColor)
        .setStrokeStyle(2.5, cfg.strokeColor);

      // Трещины на теле: маленькие тёмные полоски, чтобы силуэт отличался.
      const crack1 = scene.add.rectangle(1, -3, 13, 2, 0x7f1d1d).setRotation(0.6);
      const crack2 = scene.add.rectangle(-3, 5, 10, 2, 0x7f1d1d).setRotation(-0.5);
      const crack3 = scene.add.rectangle(5, 7, 8, 2, 0x7f1d1d).setRotation(1.1);

      glow = scene.add.circle(0, 0, 7, 0xef4444, 0.9)
        .setStrokeStyle(1, 0xfecaca);

      const e1 = scene.add.circle(7, -5, 2.2, cfg.eyeColor);
      const e2 = scene.add.circle(7, 5, 2.2, cfg.eyeColor);
      eyes.push(e1, e2);

      hpBar = scene.add.rectangle(0, -cfg.radius - 10, 32, 5, 0xef4444)
        .setStrokeStyle(1, 0x000000);
      container.add([
        shadowAura,
        bodyShape,
        crack1,
        crack2,
        crack3,
        glow,
        e1,
        e2,
        hpBar,
      ]);
      break;
    }

    case 'STALKER':
    default: {
      // Сталкер: компактный призрак с прижатым хвостом сзади
      const cloakTail = scene.add.polygon(
        -8,
        0,
        [[0, -9], [-10, -5], [-6, 0], [-10, 5], [0, 9]],
        0x1e1b4b
      ).setOrigin(0);
      bodyShape = scene.add.circle(0, 0, cfg.radius, cfg.bodyColor)
        .setStrokeStyle(2, cfg.strokeColor);

      // Глаза смотрят вперед
      const e1 = scene.add.circle(4, -4, 2, cfg.eyeColor);
      const e2 = scene.add.circle(4, 4, 2, cfg.eyeColor);
      eyes.push(e1, e2);
      container.add([cloakTail, bodyShape, e1, e2]);
      break;
    }
  }

  return { container, bodyShape, eyes, glow, hpBar };
}
