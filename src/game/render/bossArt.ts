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
  let glow: Phaser.GameObjects.Arc | undefined;

  // Пока босс один, но switch оставляет место для следующего.
  switch (key) {
    case 'PALE_WARDEN': {
      // Бледный Часовой: высокий силуэт в капюшоне с ледяным фонарём.
      const aura = scene.add.circle(0, 0, cfg.radius + 18, 0x0b1420, 0.4);
      const frostHalo = scene.add
        .circle(0, 0, cfg.radius + 30, cfg.lightStrokeColor, 0.1)
        .setBlendMode(Phaser.BlendModes.ADD);

      const cowl = scene.add.polygon(
        -10,
        0,
        [
          [6, -cfg.radius - 14],
          [-cfg.radius - 6, -cfg.radius * 0.55],
          [-cfg.radius + 2, 0],
          [-cfg.radius - 6, cfg.radius * 0.55],
          [6, cfg.radius + 14],
        ],
        0x0f2438
      ).setOrigin(0).setStrokeStyle(2, cfg.strokeColor, 0.9);

      const bodyShape = scene.add.circle(0, 0, cfg.radius, cfg.bodyColor)
        .setStrokeStyle(4, cfg.strokeColor);
      const bodyHighlight = scene.add.circle(-8, -9, cfg.radius * 0.7, 0x1e3a5f, 0.35);

      // Плечевые пластины.
      const plateTop = scene.add.polygon(4, -cfg.radius + 10, [0, 0, 26, -14, 12, 8], 0x1e3a5f)
        .setOrigin(0);
      const plateBottom = scene.add.polygon(4, cfg.radius - 10, [0, 0, 26, 14, 12, -8], 0x1e3a5f)
        .setOrigin(0);

      // Ледяной фонарь вместо глаз.
      const lanternGlow = scene.add
        .circle(18, 0, 26, cfg.eyeColor, 0.18)
        .setBlendMode(Phaser.BlendModes.ADD);
      const lantern = scene.add.circle(18, 0, 12, cfg.eyeColor, 0.85);
      const lanternCore = scene.add.circle(18, 0, 6, 0xf0f9ff, 1);
      glow = scene.add.circle(18, 0, 18, cfg.eyeColor, 0.25);

      // Ледяные осколки вокруг тела.
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6;
        const shard = scene.add
          .polygon(
            Math.cos(angle) * (cfg.radius + 10),
            Math.sin(angle) * (cfg.radius + 10),
            [0, -7, 5, 0, 0, 7, -5, 0],
            cfg.lightStrokeColor,
            0.55
          )
          .setOrigin(0);
        container.add(shard);
        scene.tweens.add({
          targets: shard,
          alpha: 0.15,
          duration: 900 + i * 140,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      container.add([
        frostHalo,
        aura,
        cowl,
        plateTop,
        plateBottom,
        bodyShape,
        bodyHighlight,
        lanternGlow,
        glow,
        lantern,
        lanternCore,
      ]);

      scene.tweens.add({
        targets: [lanternGlow, glow],
        scale: 1.15,
        alpha: 0.12,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      return { container, bodyShape, eyes, glow };
    }

    case 'ROT_MOTHER': {
      // Мать Роя: вздутое тело, россыпь глаз и поднимающиеся споры.
      const aura = scene.add.circle(0, 0, cfg.radius + 20, 0x0a1a0f, 0.42);
      const sporeHalo = scene.add
        .circle(0, 0, cfg.radius + 34, cfg.eyeColor, 0.1)
        .setBlendMode(Phaser.BlendModes.ADD);

      const bodyShape = scene.add.circle(0, 0, cfg.radius, cfg.bodyColor)
        .setStrokeStyle(4, cfg.strokeColor);

      // Неровная «плоть»: несколько полупрозрачных кругов поверх тела.
      const lumps = scene.add.graphics();
      lumps.fillStyle(0x14301a, 0.7);
      lumps.fillCircle(-10, -12, cfg.radius * 0.42);
      lumps.fillCircle(12, 10, cfg.radius * 0.36);
      lumps.fillCircle(-4, 14, cfg.radius * 0.3);

      // Россыпь глаз.
      const extraEyes: Phaser.GameObjects.Arc[] = [];
      for (let i = 0; i < 7; i++) {
        const angle = (Math.PI * 2 * i) / 7 + 0.3;
        const distance = cfg.radius * 0.5;
        const eye = scene.add
          .circle(
            Math.cos(angle) * distance,
            Math.sin(angle) * distance,
            i % 2 === 0 ? 4 : 3,
            cfg.eyeColor,
            0.9
          );
        eyes.push(eye);
        extraEyes.push(eye);
      }

      // Споры, поднимающиеся от тела.
      const spores: Phaser.GameObjects.Arc[] = [];
      for (let i = 0; i < 7; i++) {
        const angle = (Math.PI * 2 * i) / 7 + 0.5;
        const spore = scene.add
          .circle(
            Math.cos(angle) * (cfg.radius + 4),
            Math.sin(angle) * (cfg.radius + 4),
            2.6,
            cfg.lightStrokeColor,
            0.7
          )
          .setBlendMode(Phaser.BlendModes.ADD);
        spores.push(spore);
        scene.tweens.add({
          targets: spore,
          y: spore.y - 34,
          alpha: 0,
          duration: 1700 + i * 200,
          repeat: -1,
          ease: 'Sine.easeOut',
        });
      }

      const core = scene.add.circle(0, 0, 13, cfg.eyeColor, 0.5);
      glow = scene.add.circle(0, 0, 7, cfg.lightStrokeColor, 0.9);

      container.add([
        sporeHalo,
        aura,
        bodyShape,
        lumps,
        ...spores,
        ...extraEyes,
        core,
        glow,
      ]);

      scene.tweens.add({
        targets: [sporeHalo, core, glow],
        scale: 1.1,
        alpha: 0.35,
        duration: 950,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      return { container, bodyShape, eyes, glow };
    }

    case 'DROWNED_KING': {
      // Король-утопленник: корона, трезубец и поднимающиеся пузыри.
      const aura = scene.add.circle(0, 0, cfg.radius + 18, 0x03161d, 0.42);
      const tideHalo = scene.add
        .circle(0, 0, cfg.radius + 32, cfg.lightStrokeColor, 0.1)
        .setBlendMode(Phaser.BlendModes.ADD);

      const bodyShape = scene.add.circle(0, 0, cfg.radius, cfg.bodyColor)
        .setStrokeStyle(4, cfg.strokeColor);
      const bodyHighlight = scene.add.circle(-9, -10, cfg.radius * 0.7, 0x0e4a5c, 0.35);

      // Корона: три зубца над головой.
      const crown = scene.add.graphics();
      crown.fillStyle(0xb08a4a, 0.95);
      const crownY = -cfg.radius - 4;
      crown.fillTriangle(-24, crownY + 10, -17, crownY - 14, -9, crownY + 8);
      crown.fillTriangle(-5, crownY + 8, 0, crownY - 20, 5, crownY + 8);
      crown.fillTriangle(9, crownY + 8, 17, crownY - 14, 24, crownY + 10);

      // Трезубец: древко и три зубца.
      const staff = scene.add.rectangle(cfg.radius + 14, 4, 5, cfg.radius * 1.6, 0x475569);
      const prongTop = scene.add
        .polygon(cfg.radius + 14, -cfg.radius * 0.7, [0, 0, 4, -18, 8, 0], cfg.lightStrokeColor, 0.85)
        .setOrigin(0);
      const prongLeft = scene.add
        .polygon(cfg.radius + 5, -cfg.radius * 0.5, [0, 0, 3, -13, 6, 0], cfg.lightStrokeColor, 0.7)
        .setOrigin(0);
      const prongRight = scene.add
        .polygon(cfg.radius + 23, -cfg.radius * 0.5, [0, 0, 3, -13, 6, 0], cfg.lightStrokeColor, 0.7)
        .setOrigin(0);

      const eyeGlow = scene.add
        .circle(16, 0, 14, cfg.eyeColor, 0.2)
        .setBlendMode(Phaser.BlendModes.ADD);
      const e1 = scene.add.circle(18, -9, 5, cfg.eyeColor);
      const e2 = scene.add.circle(18, 9, 5, cfg.eyeColor);
      eyes.push(e1, e2);

      // Пузыри, поднимающиеся от тела.
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6 + 0.3;
        const bubble = scene.add
          .circle(
            Math.cos(angle) * (cfg.radius + 8),
            Math.sin(angle) * (cfg.radius + 8),
            2.4,
            cfg.lightStrokeColor,
            0.65
          )
          .setBlendMode(Phaser.BlendModes.ADD);
        container.add(bubble);
        scene.tweens.add({
          targets: bubble,
          y: bubble.y - 38,
          alpha: 0,
          duration: 1500 + i * 210,
          repeat: -1,
          ease: 'Sine.easeOut',
        });
      }

      container.add([
        tideHalo,
        aura,
        staff,
        prongLeft,
        prongTop,
        prongRight,
        crown,
        bodyShape,
        bodyHighlight,
        eyeGlow,
        e1,
        e2,
      ]);

      scene.tweens.add({
        targets: [tideHalo, eyeGlow],
        scale: 1.12,
        alpha: 0.08,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      return { container, bodyShape, eyes, glow };
    }

    case 'ASH_LORD': {
      // Пепельный Владыка: корона углей, тяжёлые плечи и пепел вокруг.
      const aura = scene.add.circle(0, 0, cfg.radius + 20, 0x2a0b04, 0.42);
      const emberHalo = scene.add
        .circle(0, 0, cfg.radius + 34, cfg.eyeColor, 0.1)
        .setBlendMode(Phaser.BlendModes.ADD);

      const bodyShape = scene.add.circle(0, 0, cfg.radius, cfg.bodyColor)
        .setStrokeStyle(4, cfg.strokeColor);
      const bodyHighlight = scene.add.circle(-10, -11, cfg.radius * 0.7, 0x7c2d12, 0.3);

      const plateTop = scene.add
        .polygon(4, -cfg.radius + 12, [0, 0, 30, -16, 14, 9], 0x431407)
        .setOrigin(0);
      const plateBottom = scene.add
        .polygon(4, cfg.radius - 12, [0, 0, 30, 16, 14, -9], 0x431407)
        .setOrigin(0);

      // Корона из углей по верхней дуге.
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI * 0.85 + (i * Math.PI * 0.7) / 4;
        const x = Math.cos(angle) * (cfg.radius + 2);
        const y = Math.sin(angle) * (cfg.radius + 2);
        const coal = scene.add
          .polygon(x, y, [0, -10, 6, 4, -6, 4], i % 2 === 0 ? 0xf97316 : cfg.lightStrokeColor, 0.9)
          .setOrigin(0);
        container.add(coal);
      }

      const core = scene.add.circle(0, 0, 16, cfg.eyeColor, 0.35);
      glow = scene.add.circle(0, 0, 8, cfg.lightStrokeColor, 0.95);
      const e1 = scene.add.circle(18, -9, 4.5, cfg.eyeColor);
      const e2 = scene.add.circle(18, 9, 4.5, cfg.eyeColor);
      eyes.push(e1, e2);

      // Пепел, медленно поднимающийся вверх.
      for (let i = 0; i < 7; i++) {
        const angle = (Math.PI * 2 * i) / 7 + 0.4;
        const ash = scene.add.circle(
          Math.cos(angle) * (cfg.radius + 10),
          Math.sin(angle) * (cfg.radius + 6),
          2.2,
          0xd6d3d1,
          0.55
        );
        container.add(ash);
        scene.tweens.add({
          targets: ash,
          y: ash.y - 44,
          alpha: 0,
          duration: 1800 + i * 190,
          repeat: -1,
          ease: 'Sine.easeOut',
        });
      }

      container.add([
        emberHalo,
        aura,
        plateTop,
        plateBottom,
        bodyShape,
        bodyHighlight,
        core,
        glow,
        e1,
        e2,
      ]);

      scene.tweens.add({
        targets: [emberHalo, core, glow],
        scale: 1.1,
        alpha: 0.3,
        duration: 820,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      return { container, bodyShape, eyes, glow };
    }

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
