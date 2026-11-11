import Phaser from 'phaser';
import type { BossConfig, BossTypeKey } from './bosses';
import type { EnemyBehavior, EnemyConfig, EnemyTypeKey } from './gameConfig';

// ============================================================================
// ИНТЕРФЕЙСЫ ИГРОВЫХ СУЩНОСТЕЙ
// ============================================================================

export type EnemyState = 'CHASE' | 'WINDUP' | 'ATTACK' | 'RECOVER';

export interface EnemyEntity {
  type: EnemyTypeKey | BossTypeKey;
  config: EnemyConfig | BossConfig;
  behavior: EnemyBehavior;
  container: Phaser.GameObjects.Container;
  bodyShape: Phaser.GameObjects.Shape;
  eyes: Phaser.GameObjects.Arc[];
  glow?: Phaser.GameObjects.Arc;
  hpBar?: Phaser.GameObjects.Rectangle;
  hpBarBack?: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  inLight: boolean;
  /** Таймер следующей атаки (выстрел или рывок). */
  attackTimer: number;
  /** Таймер следующей особой способности (например, гашения факела). */
  specialTimer: number;
  /** Пауза перед следующим контактным уроном от этого врага. */
  contactCooldown: number;
  state: EnemyState;
  stateTimer: number;
  chargeAngle: number;
  isBoss: boolean;
  hasEnraged: boolean;
}

export interface ProjectileEntity {
  container: Phaser.GameObjects.Container;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface EnemyProjectileEntity {
  container: Phaser.GameObjects.Container;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
}

export interface ManaOrbEntity {
  container: Phaser.GameObjects.Container;
  x: number;
  y: number;
  value: number;
  life: number;
}
