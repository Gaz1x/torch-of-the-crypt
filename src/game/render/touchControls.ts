import Phaser from 'phaser';
import { UI_COLORS, UI_DEPTH } from './uiKit';

// ============================================================================
// TOUCH-УПРАВЛЕНИЕ
// Только отрисовка: два плавающих стика — движение и прицел. Игровая логика
// (какой палец за что отвечает) живёт в GameScene.
// ============================================================================

/** Размеры и зоны, общие для отрисовки и обработки касаний. */
export const TOUCH_CONFIG = {
  /** Верхняя полоса HUD: касания здесь не должны стрелять. */
  HUD_SAFE_HEIGHT: 150,
  JOYSTICK_RADIUS: 80,
  KNOB_RADIUS: 32,
  /** Ход стика, при котором движение ещё не начинается. */
  DEADZONE: 0.16,
  /** Доля радиуса стика прицела, ниже которой огонь не идёт. */
  AIM_DEADZONE: 0.25,
} as const;

export interface TouchControls {
  container: Phaser.GameObjects.Container;
  /** Показать стик в точке первого касания. */
  showMove: (x: number, y: number) => void;
  /** Сдвинуть рукоятку относительно базы. */
  updateMove: (x: number, y: number) => void;
  hideMove: () => void;
  /** Показать стик прицела в точке первого касания. */
  showAim: (x: number, y: number) => void;
  /** Сдвинуть рукоятку прицела относительно базы. */
  updateAim: (x: number, y: number) => void;
  hideAim: () => void;
  setVisible: (visible: boolean) => void;
}

export function createTouchControls(scene: Phaser.Scene): TouchControls {
  const container = scene.add
    .container(0, 0)
    .setDepth(UI_DEPTH.hud - 1)
    .setVisible(false);

  // ------------------------------------------------------------- ДВИЖЕНИЕ
  const moveGroup = scene.add.container(0, 0).setVisible(false);

  const moveBase = scene.add
    .circle(0, 0, TOUCH_CONFIG.JOYSTICK_RADIUS, 0x0f172a, 0.32)
    .setStrokeStyle(2, UI_COLORS.brassBright, 0.55);

  const moveInner = scene.add
    .circle(0, 0, TOUCH_CONFIG.JOYSTICK_RADIUS - 14, 0x000000, 0)
    .setStrokeStyle(1, UI_COLORS.brass, 0.35);

  const moveKnob = scene.add
    .circle(0, 0, TOUCH_CONFIG.KNOB_RADIUS, UI_COLORS.brassBright, 0.24)
    .setStrokeStyle(2, UI_COLORS.brassBright, 0.9);

  moveGroup.add([moveBase, moveInner, moveKnob]);

  // -------------------------------------------------------------- ПРИЦЕЛ
  const aimGroup = scene.add.container(0, 0).setVisible(false);

  const aimBase = scene.add
    .circle(0, 0, TOUCH_CONFIG.JOYSTICK_RADIUS, 0x0f172a, 0.32)
    .setStrokeStyle(2, UI_COLORS.emberBright, 0.55);

  const aimInner = scene.add
    .circle(0, 0, TOUCH_CONFIG.JOYSTICK_RADIUS - 14, 0x000000, 0)
    .setStrokeStyle(1, UI_COLORS.ember, 0.35);

  const aimKnob = scene.add
    .circle(0, 0, TOUCH_CONFIG.KNOB_RADIUS, UI_COLORS.emberBright, 0.24)
    .setStrokeStyle(2, UI_COLORS.emberBright, 0.9);

  aimGroup.add([aimBase, aimInner, aimKnob]);

  container.add([moveGroup, aimGroup]);

  return {
    container,

    showMove(x, y) {
      moveGroup.setPosition(x, y).setVisible(true);
      moveKnob.setPosition(0, 0);
    },

    updateMove(x, y) {
      moveKnob.setPosition(x, y);
    },

    hideMove() {
      moveGroup.setVisible(false);
    },

    showAim(x, y) {
      aimGroup.setPosition(x, y).setVisible(true);
      aimKnob.setPosition(0, 0);
    },

    updateAim(x, y) {
      aimKnob.setPosition(x, y);
    },

    hideAim() {
      aimGroup.setVisible(false);
    },

    setVisible(visible) {
      container.setVisible(visible);
    },
  };
}
