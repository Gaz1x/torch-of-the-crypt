import Phaser from 'phaser';
import { GAME_CONFIG } from '../core/gameConfig';

// ============================================================================
// HUD (панель здоровья, маны, счёта и статуса боя)
// ============================================================================

export interface HudParts {
  container: Phaser.GameObjects.Container;
  hpSlots: Phaser.GameObjects.Arc[];
  manaBarFill: Phaser.GameObjects.Rectangle;
  manaValueText: Phaser.GameObjects.Text;
  scoreValueText: Phaser.GameObjects.Text;
  timeValueText: Phaser.GameObjects.Text;
  lightStatusText: Phaser.GameObjects.Text;
}

/** Данные, которые HUD показывает каждый кадр. */
export interface HudStats {
  hp: number;
  mana: number;
  score: number;
  killsCount: number;
  survivalTime: number;
  slowedEnemies: number;
}

export function createHud(scene: Phaser.Scene): HudParts {
  const container = scene.add.container(0, 0).setDepth(30);

  // --- ЛЕВАЯ ПАНЕЛЬ: Здоровье и Мана ---
  const leftCard = scene.add.rectangle(20, 16, 260, 74, 0x090d16, 0.85)
    .setOrigin(0, 0)
    .setStrokeStyle(1.5, 0x334155);

  const hpLabel = scene.add.text(34, 26, 'ЖИЗНЬ', {
    fontFamily: 'Inter, sans-serif',
    fontSize: '11px',
    fontStyle: 'bold',
    color: '#94a3b8',
  });

  const hpSlots: Phaser.GameObjects.Arc[] = [];
  for (let i = 0; i < GAME_CONFIG.PLAYER.MAX_HP; i++) {
    const slot = scene.add.circle(105 + i * 26, 33, 8, 0xef4444)
      .setStrokeStyle(2, 0xfca5a5);
    hpSlots.push(slot);
  }

  const manaLabel = scene.add.text(34, 58, 'МАНА', {
    fontFamily: 'Inter, sans-serif',
    fontSize: '11px',
    fontStyle: 'bold',
    color: '#38bdf8',
  });

  const manaBarBg = scene.add.rectangle(95, 65, 168, 14, 0x1e293b)
    .setOrigin(0, 0.5)
    .setStrokeStyle(1, 0x475569);

  const manaBarFill = scene.add.rectangle(97, 65, 164, 10, 0x0284c7)
    .setOrigin(0, 0.5);

  const manaValueText = scene.add.text(179, 65, '', {
    fontFamily: 'Inter, sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: '#f8fafc',
  }).setOrigin(0.5);

  // --- ПРАВАЯ ПАНЕЛЬ: Счёт, Время и Статус факела ---
  const rightCard = scene.add.rectangle(940, 16, 290, 74, 0x090d16, 0.85)
    .setOrigin(1, 0)
    .setStrokeStyle(1.5, 0x334155);

  const scoreValueText = scene.add.text(666, 25, '', {
    fontFamily: 'Inter, sans-serif',
    fontSize: '15px',
    fontStyle: 'bold',
    color: '#fbbf24',
  });

  const timeValueText = scene.add.text(926, 25, '', {
    fontFamily: 'Inter, sans-serif',
    fontSize: '14px',
    fontStyle: 'bold',
    color: '#e2e8f0',
  }).setOrigin(1, 0);

  const lightStatusText = scene.add.text(666, 56, '', {
    fontFamily: 'Inter, sans-serif',
    fontSize: '12px',
    color: '#94a3b8',
  });

  container.add([
    leftCard,
    hpLabel,
    ...hpSlots,
    manaLabel,
    manaBarBg,
    manaBarFill,
    manaValueText,
    rightCard,
    scoreValueText,
    timeValueText,
    lightStatusText,
  ]);

  return {
    container,
    hpSlots,
    manaBarFill,
    manaValueText,
    scoreValueText,
    timeValueText,
    lightStatusText,
  };
}

export function updateHud(parts: HudParts, stats: HudStats): void {
  // Обновление кристаллов здоровья
  for (let i = 0; i < parts.hpSlots.length; i++) {
    if (i < stats.hp) {
      parts.hpSlots[i].setFillStyle(0xef4444);
      parts.hpSlots[i].setStrokeStyle(2, 0xfca5a5);
    } else {
      parts.hpSlots[i].setFillStyle(0x1e293b);
      parts.hpSlots[i].setStrokeStyle(1.5, 0x475569);
    }
  }

  // Обновление шкалы маны
  const manaRatio = Phaser.Math.Clamp(stats.mana / GAME_CONFIG.COMBAT.MAX_MANA, 0, 1);
  parts.manaBarFill.width = 164 * manaRatio;
  const canShoot = stats.mana >= GAME_CONFIG.COMBAT.SHOT_MANA_COST;
  parts.manaBarFill.setFillStyle(canShoot ? 0x0284c7 : 0x64748b);
  parts.manaValueText.setText(`${Math.floor(stats.mana)} / ${GAME_CONFIG.COMBAT.MAX_MANA}`);

  // Обновление правой панели
  parts.scoreValueText.setText(`ОЧКИ: ${stats.score}`);
  parts.timeValueText.setText(`⏱ ${stats.survivalTime.toFixed(1)}с`);
  parts.lightStatusText.setText(
    `В круге света: ${stats.slowedEnemies} враг.  |  Убито: ${stats.killsCount}`
  );
}
