import Phaser from 'phaser';
import type { EnemyConfig, EnemyTypeKey } from './gameConfig';

// ============================================================================
// ИНТЕРФЕЙСЫ ИГРОВЫХ СУЩНОСТЕЙ
// ============================================================================

export interface EnemyEntity {
  type: EnemyTypeKey;
  config: EnemyConfig;
  container: Phaser.GameObjects.Container;
  bodyShape: Phaser.GameObjects.Shape;
  eyes: Phaser.GameObjects.Arc[];
  hpBar?: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  inLight: boolean;
}

export interface ProjectileEntity {
  container: Phaser.GameObjects.Container;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface ManaOrbEntity {
  container: Phaser.GameObjects.Container;
  x: number;
  y: number;
  value: number;
  life: number;
}
