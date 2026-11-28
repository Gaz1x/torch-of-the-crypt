import Phaser from 'phaser';
import type { EnemyConfig, EnemyTypeKey } from '../core/gameConfig';

// ============================================================================
// ОТРИСОВКА ВРАГОВ (внешний вид тела, глаз, косметики)
// Полоски HP живут на сцене отдельно от контейнера: они не вращаются вместе
// с телом и появляются только после первого попадания.
// ============================================================================

export interface EnemyVisual {
  container: Phaser.GameObjects.Container;
  bodyShape: Phaser.GameObjects.Shape;
  eyes: Phaser.GameObjects.Arc[];
  glow?: Phaser.GameObjects.Arc;
  hpBar?: Phaser.GameObjects.Rectangle;
  hpBarBack?: Phaser.GameObjects.Rectangle;
}

/** Глубина полосок: выше тел врагов, но ниже игрока. */
const HP_BAR_DEPTH = 10;

/**
 * Новые враги используют силуэты уже нарисованных типов: так локации
 * получают свой облик без второй копии каждой фигуры.
 */
const VISUAL_BASE: Partial<Record<EnemyTypeKey, EnemyTypeKey>> = {
  DROWNED: 'WATCHER',
  ASH_PRIEST: 'SPITTER',
};

interface Eye {
  eye: Phaser.GameObjects.Arc;
  halo: Phaser.GameObjects.Arc;
}

/** Глаз с мягким ореолом: ореол добавляется раньше самого глаза. */
function createEye(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  color: number
): Eye {
  const halo = scene.add
    .circle(x, y, radius * 2.4, color, 0.22)
    .setBlendMode(Phaser.BlendModes.ADD);
  const eye = scene.add.circle(x, y, radius, color);
  return { eye, halo };
}

interface HpBar {
  hpBar: Phaser.GameObjects.Rectangle;
  hpBarBack: Phaser.GameObjects.Rectangle;
}

/** Полоска в стиле интерфейса: тёмная подложка, латунная рамка, кровь. */
function createHpBar(scene: Phaser.Scene, width: number): HpBar {
  const hpBarBack = scene.add
    .rectangle(0, 0, width + 4, 9, 0x0a1019, 0.88)
    .setStrokeStyle(1, 0xb08a4a, 0.6)
    .setDepth(HP_BAR_DEPTH)
    .setVisible(false);

  const hpBar = scene.add
    .rectangle(-width / 2, 0, width, 5, 0xdc2626)
    .setOrigin(0, 0.5)
    .setDepth(HP_BAR_DEPTH + 0.1)
    .setVisible(false);

  return { hpBar, hpBarBack };
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
  let hpBarBack: Phaser.GameObjects.Rectangle | undefined;

  // Элиты носят то же тело, что и базовый тип: ELITE_BRUTE → BRUTE.
  const strippedType = (
    type.startsWith('ELITE_') ? type.slice('ELITE_'.length) : type
  ) as EnemyTypeKey;
  const baseType = VISUAL_BASE[type] ?? strippedType;

  switch (baseType) {
    case 'HOUND': {
      const shadowAura = scene.add.circle(0, 0, cfg.radius + 6, 0x450a1a, 0.35);
      const tail = scene.add.polygon(
        -cfg.radius + 2,
        0,
        [[0, -5], [-16, -9], [-10, 0], [-16, 9], [0, 5]],
        0x2a0d16
      ).setOrigin(0).setStrokeStyle(1, cfg.strokeColor, 0.5);

      bodyShape = scene.add.polygon(
        0,
        0,
        [cfg.radius + 4, 0, -cfg.radius, -cfg.radius * 0.75, -cfg.radius * 0.4, 0, -cfg.radius, cfg.radius * 0.75],
        cfg.bodyColor
      ).setOrigin(0).setStrokeStyle(2, cfg.strokeColor);

      const fangTop = scene.add.polygon(8, -4, [0, 0, 10, -3, 4, 3], cfg.lightStrokeColor, 0.8)
        .setOrigin(0);
      const fangBottom = scene.add.polygon(8, 4, [0, 0, 10, 3, 4, -3], cfg.lightStrokeColor, 0.8)
        .setOrigin(0);

      const e1 = createEye(scene, 5, -3, 2, cfg.eyeColor);
      const e2 = createEye(scene, 5, 3, 2, cfg.eyeColor);
      eyes.push(e1.eye, e2.eye);

      container.add([
        shadowAura,
        tail,
        bodyShape,
        fangTop,
        fangBottom,
        e1.halo,
        e2.halo,
        e1.eye,
        e2.eye,
      ]);
      break;
    }

    case 'WATCHER': {
      const shadowAura = scene.add.circle(0, 0, cfg.radius + 6, 0x042f2e, 0.35);
      const hood = scene.add.polygon(
        -6,
        0,
        [[0, -cfg.radius - 3], [-cfg.radius - 4, -6], [-cfg.radius + 2, 0], [-cfg.radius - 4, 6], [0, cfg.radius + 3]],
        0x0a2a2a
      ).setOrigin(0).setStrokeStyle(1, cfg.strokeColor, 0.6);

      bodyShape = scene.add.circle(0, 0, cfg.radius, cfg.bodyColor)
        .setStrokeStyle(2, cfg.strokeColor);

      const lantern = scene.add.circle(7, 0, 7, cfg.eyeColor, 0.18)
        .setBlendMode(Phaser.BlendModes.ADD);
      glow = scene.add.circle(7, 0, 4, cfg.eyeColor, 0.9);
      const pupil = scene.add.circle(8, 0, 1.8, 0x042f2e, 0.9);
      eyes.push(glow);

      container.add([shadowAura, hood, bodyShape, lantern, glow, pupil]);
      break;
    }

    case 'SWARMER': {
      const shadowAura = scene.add.circle(0, 0, cfg.radius + 5, 0x3b0764, 0.35);
      const wingTop = scene.add.polygon(-4, -6, [-18, -16, -8, -2, -4, -6], 0x2e1065)
        .setOrigin(0)
        .setStrokeStyle(1, 0x7c3aed, 0.6);
      const wingBottom = scene.add.polygon(-4, 6, [-18, 16, -8, 2, -4, 6], 0x2e1065)
        .setOrigin(0)
        .setStrokeStyle(1, 0x7c3aed, 0.6);

      bodyShape = scene.add.polygon(
        0,
        0,
        [14, 0, -10, -10, -5, 0, -10, 10],
        cfg.bodyColor
      ).setOrigin(0).setStrokeStyle(2, cfg.strokeColor);

      const core = scene.add.circle(-1, 0, 3.5, 0x7c3aed, 0.5)
        .setBlendMode(Phaser.BlendModes.ADD);

      const e1 = createEye(scene, 5, -3, 2, cfg.eyeColor);
      const e2 = createEye(scene, 5, 3, 2, cfg.eyeColor);
      const e3 = createEye(scene, 9, 0, 1.8, cfg.eyeColor);
      eyes.push(e1.eye, e2.eye, e3.eye);

      container.add([
        shadowAura,
        wingTop,
        wingBottom,
        bodyShape,
        core,
        e1.halo,
        e2.halo,
        e3.halo,
        e1.eye,
        e2.eye,
        e3.eye,
      ]);
      break;
    }

    case 'BRUTE': {
      const shadowAura = scene.add.circle(0, 0, cfg.radius + 7, 0x450a0a, 0.4);

      const hornLeft = scene.add.polygon(8, -14, [0, 0, 14, -8, 4, 6], 0x7f1d1d).setOrigin(0);
      const hornRight = scene.add.polygon(8, 14, [0, 0, 14, 8, 4, -6], 0x7f1d1d).setOrigin(0);
      const hornLeftLight = scene.add.polygon(9, -13, [0, 0, 8, -4, 3, 3], 0xb91c1c, 0.7)
        .setOrigin(0);
      const hornRightLight = scene.add.polygon(9, 13, [0, 0, 8, 4, 3, -3], 0xb91c1c, 0.7)
        .setOrigin(0);

      bodyShape = scene.add.circle(0, 0, cfg.radius, cfg.bodyColor)
        .setStrokeStyle(3, cfg.strokeColor);

      // Блик сверху-слева и латунные заклёпки по броне.
      const bodyHighlight = scene.add.circle(-5, -6, cfg.radius * 0.72, 0x334155, 0.35);
      const rivets = scene.add.graphics();
      rivets.fillStyle(0xb08a4a, 0.55);
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        rivets.fillCircle(Math.cos(angle) * (cfg.radius - 5), Math.sin(angle) * (cfg.radius - 5), 1.6);
      }

      const e1 = createEye(scene, 10, -7, 3.5, cfg.eyeColor);
      const e2 = createEye(scene, 10, 7, 3.5, cfg.eyeColor);
      eyes.push(e1.eye, e2.eye);

      container.add([
        shadowAura,
        hornLeft,
        hornRight,
        hornLeftLight,
        hornRightLight,
        bodyShape,
        bodyHighlight,
        rivets,
        e1.halo,
        e2.halo,
        e1.eye,
        e2.eye,
      ]);
      break;
    }

    case 'SPITTER': {
      const shadowAura = scene.add.circle(0, 0, cfg.radius + 6, 0x2e1065, 0.4);
      const cloakOuter = scene.add.polygon(
        -8,
        0,
        [[0, -13], [-17, -8], [-11, 0], [-17, 8], [0, 13]],
        0x161338
      ).setOrigin(0);
      const cloakInner = scene.add.polygon(
        -6,
        0,
        [[0, -10], [-13, -6], [-9, 0], [-13, 6], [0, 10]],
        0x1e1b4b
      ).setOrigin(0).setStrokeStyle(1, 0x7c3aed, 0.5);

      bodyShape = scene.add.circle(0, 0, cfg.radius, cfg.bodyColor)
        .setStrokeStyle(2, cfg.strokeColor);
      const hoodHighlight = scene.add.circle(-4, -4, cfg.radius * 0.6, 0x4c1d95, 0.4);

      const staff = scene.add.rectangle(15, 7, 20, 3, 0x475569);
      const staffRing = scene.add.rectangle(20, 7, 2, 5, 0xb08a4a);
      glow = scene.add.circle(25, 7, 6, 0xa855f7, 0.85)
        .setStrokeStyle(1, 0xf5d0fe);
      const orbHalo = scene.add.circle(25, 7, 14, 0xa855f7, 0.22)
        .setBlendMode(Phaser.BlendModes.ADD);

      scene.tweens.add({
        targets: orbHalo,
        scale: 1.25,
        alpha: 0.1,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      const e1 = createEye(scene, 5, -4, 2.2, cfg.eyeColor);
      const e2 = createEye(scene, 5, 4, 2.2, cfg.eyeColor);
      eyes.push(e1.eye, e2.eye);

      container.add([
        shadowAura,
        cloakOuter,
        cloakInner,
        bodyShape,
        hoodHighlight,
        staff,
        staffRing,
        orbHalo,
        glow,
        e1.halo,
        e2.halo,
        e1.eye,
        e2.eye,
      ]);
      break;
    }

    case 'BOMBER': {
      const shadowAura = scene.add.circle(0, 0, cfg.radius + 7, 0x450a0a, 0.45);

      // Шипы по кругу, чтобы силуэт отличался от брута.
      const spikes = scene.add.graphics();
      spikes.fillStyle(0x7f1d1d, 0.9);
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const bx = Math.cos(angle) * (cfg.radius - 2);
        const by = Math.sin(angle) * (cfg.radius - 2);
        spikes.fillTriangle(
          bx,
          by,
          bx + Math.cos(angle + 0.35) * 9,
          by + Math.sin(angle + 0.35) * 9,
          bx + Math.cos(angle - 0.35) * 9,
          by + Math.sin(angle - 0.35) * 9
        );
      }

      bodyShape = scene.add.circle(0, 0, cfg.radius, cfg.bodyColor)
        .setStrokeStyle(2.5, cfg.strokeColor);
      const bodyHighlight = scene.add.circle(-4, -5, cfg.radius * 0.6, 0x7f1d1d, 0.35);

      // Трещины на теле: светятся, как лава под коркой.
      const cracks = scene.add.graphics();
      cracks.lineStyle(2, 0xef4444, 0.85);
      cracks.beginPath();
      cracks.moveTo(-6, -8);
      cracks.lineTo(1, -3);
      cracks.lineTo(-2, 3);
      cracks.lineTo(5, 7);
      cracks.strokePath();
      cracks.beginPath();
      cracks.moveTo(1, -3);
      cracks.lineTo(10, -1);
      cracks.strokePath();

      const crackGlow = scene.add.circle(0, 0, 6, 0xef4444, 0.35)
        .setBlendMode(Phaser.BlendModes.ADD);

      glow = scene.add.circle(0, 0, 7, 0xef4444, 0.9)
        .setStrokeStyle(1, 0xfecaca);

      scene.tweens.add({
        targets: crackGlow,
        scale: 1.5,
        alpha: 0.15,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      const e1 = createEye(scene, 7, -5, 2.2, cfg.eyeColor);
      const e2 = createEye(scene, 7, 5, 2.2, cfg.eyeColor);
      eyes.push(e1.eye, e2.eye);

      container.add([
        shadowAura,
        spikes,
        bodyShape,
        bodyHighlight,
        cracks,
        crackGlow,
        glow,
        e1.halo,
        e2.halo,
        e1.eye,
        e2.eye,
      ]);
      break;
    }

    case 'STALKER':
    default: {
      // Сталкер: компактный призрак с дымным хвостом сзади.
      const shadowAura = scene.add.circle(0, 0, cfg.radius + 5, 0x1e1b4b, 0.4);
      const cloakTail = scene.add.polygon(
        -8,
        0,
        [[0, -11], [-13, -6], [-8, 0], [-13, 6], [0, 11]],
        0x12102e
      ).setOrigin(0).setStrokeStyle(1, 0x4c1d95, 0.7);
      const smokeA = scene.add.circle(-13, -3, 4, 0x4c1d95, 0.22)
        .setBlendMode(Phaser.BlendModes.ADD);
      const smokeB = scene.add.circle(-16, 4, 3, 0x4c1d95, 0.18)
        .setBlendMode(Phaser.BlendModes.ADD);

      bodyShape = scene.add.circle(0, 0, cfg.radius, cfg.bodyColor)
        .setStrokeStyle(2, cfg.strokeColor);
      const bodyHighlight = scene.add.circle(-3, -4, cfg.radius * 0.55, 0x1e1b4b, 0.5);

      const e1 = createEye(scene, 4, -4, 2, cfg.eyeColor);
      const e2 = createEye(scene, 4, 4, 2, cfg.eyeColor);
      eyes.push(e1.eye, e2.eye);

      container.add([
        shadowAura,
        smokeA,
        smokeB,
        cloakTail,
        bodyShape,
        bodyHighlight,
        e1.halo,
        e2.halo,
        e1.eye,
        e2.eye,
      ]);
      break;
    }
  }

  // Полоска здоровья нужна всем, у кого запас больше одного удара:
  // по ней видно, что попадание засчитано (см. GameScene.updateEnemies).
  if (cfg.hp > 1) {
    const barWidth = Phaser.Math.Clamp(Math.round(cfg.radius * 2), 24, 40);
    const bar = createHpBar(scene, barWidth);
    hpBar = bar.hpBar;
    hpBarBack = bar.hpBarBack;
  }

  // Элита получает тонкую яркую оболочку поверх тела.
  if (cfg.elite) {
    const eliteRing = scene.add
      .circle(0, 0, cfg.radius + 7, 0x000000, 0)
      .setStrokeStyle(2, cfg.lightStrokeColor, 0.9)
      .setBlendMode(Phaser.BlendModes.ADD);
    container.add(eliteRing);
  }

  return { container, bodyShape, eyes, glow, hpBar, hpBarBack };
}
