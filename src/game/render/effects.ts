import Phaser from 'phaser';
import type { PhaseNotice } from '../core/phases';

// ============================================================================
// ВИЗУАЛЬНЫЕ ЭФФЕКТЫ (искры, взрывы, всплывающий текст, баннер фазы)
// ============================================================================

export function createHitSpark(scene: Phaser.Scene, x: number, y: number): void {
  const ring = scene.add.circle(x, y, 10, 0x38bdf8, 0.6).setDepth(22);
  scene.tweens.add({
    targets: ring,
    scale: 1.8,
    alpha: 0,
    duration: 150,
    onComplete: () => ring.destroy(),
  });
}

export function createDeathEffect(scene: Phaser.Scene, x: number, y: number, color: number): void {
  for (let i = 0; i < 8; i++) {
    const p = scene.add.circle(x, y, Phaser.Math.Between(3, 7), color).setDepth(22);
    const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
    const dist = Phaser.Math.Between(18, 42);
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      scale: 0,
      duration: 300,
      onComplete: () => p.destroy(),
    });
  }
}

export function createDamageEffect(scene: Phaser.Scene, x: number, y: number): void {
  const flash = scene.add.circle(x, y, 48, 0xef4444, 0.55).setDepth(26);
  scene.tweens.add({
    targets: flash,
    scale: 1.9,
    alpha: 0,
    duration: 260,
    onComplete: () => flash.destroy(),
  });
}

export function showFloatingText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  message: string,
  color: string
): void {
  const txt = scene.add.text(x, y, message, {
    fontFamily: 'Inter, sans-serif',
    fontSize: '13px',
    fontStyle: 'bold',
    color,
    stroke: '#0f172a',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(28);

  scene.tweens.add({
    targets: txt,
    y: y - 22,
    alpha: 0,
    duration: 650,
    onComplete: () => txt.destroy(),
  });
}

/** Баннер смены фазы: появляется по центру, держится и плавно исчезает. */
export function showPhaseNotice(scene: Phaser.Scene, notice: PhaseNotice): void {
  const container = scene.add.container(scene.scale.width / 2, 250).setDepth(45);

  const title = scene.add.text(0, 0, notice.title, {
    fontFamily: 'Inter, sans-serif',
    fontSize: '44px',
    fontStyle: 'bold',
    color: notice.color,
    stroke: '#0f172a',
    strokeThickness: 6,
  }).setOrigin(0.5);

  const body = scene.add.text(0, 46, notice.body, {
    fontFamily: 'Inter, sans-serif',
    fontSize: '17px',
    color: '#e2e8f0',
    stroke: '#0f172a',
    strokeThickness: 4,
  }).setOrigin(0.5);

  container.add([title, body]);
  container.setAlpha(0);
  container.setScale(0.9);

  scene.tweens.add({
    targets: container,
    alpha: 1,
    scale: 1,
    duration: 250,
    onComplete: () => {
      scene.tweens.add({
        targets: container,
        alpha: 0,
        delay: 1300,
        duration: 400,
        onComplete: () => container.destroy(),
      });
    },
  });
}
