import Phaser from 'phaser';
import type { EnemyConfig, EnemyTypeKey } from '../core/gameConfig';

// ============================================================================
// ОТРИСОВКА ВРАГОВ (внешний вид тела, глаз, косметики)
// ============================================================================

export interface EnemyVisual {
  container: Phaser.GameObjects.Container;
  bodyShape: Phaser.GameObjects.Shape;
  eyes: Phaser.GameObjects.Arc[];
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
  let hpBar: Phaser.GameObjects.Rectangle | undefined;

  if (type === 'SWARMER') {
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
  } else if (type === 'BRUTE') {
    const shadowAura = scene.add.circle(0, 0, cfg.radius + 6, 0x450a0a, 0.4);
    const hornLeft = scene.add.polygon(8, -14, [0, 0, 14, -8, 4, 6], 0x7f1d1d).setOrigin(0);
    const hornRight = scene.add.polygon(8, 14, [0, 0, 14, 8, 4, -6], 0x7f1d1d).setOrigin(0);
    bodyShape = scene.add.circle(0, 0, cfg.radius, cfg.bodyColor)
      .setStrokeStyle(3, cfg.strokeColor);

    const e1 = scene.add.circle(10, -7, 3.5, cfg.eyeColor);
    const e2 = scene.add.circle(10, 7, 3.5, cfg.eyeColor);
    eyes.push(e1, e2);

    hpBar = scene.add.rectangle(0, -cfg.radius - 10, 34, 5, 0xef4444).setStrokeStyle(1, 0x000000);
    container.add([shadowAura, hornLeft, hornRight, bodyShape, e1, e2, hpBar]);
  } else {
    // Сталкер: компактный призрак с прижатым хвостом сзади
    const cloakTail = scene.add.polygon(-8, 0, [[0, -9], [-10, -5], [-6, 0], [-10, 5], [0, 9]], 0x1e1b4b)
      .setOrigin(0);
    bodyShape = scene.add.circle(0, 0, cfg.radius, cfg.bodyColor)
      .setStrokeStyle(2, cfg.strokeColor);

    // Глаза смотрят вперед
    const e1 = scene.add.circle(4, -4, 2, cfg.eyeColor);
    const e2 = scene.add.circle(4, 4, 2, cfg.eyeColor);
    eyes.push(e1, e2);
    container.add([cloakTail, bodyShape, e1, e2]);
  }

  return { container, bodyShape, eyes, hpBar };
}
