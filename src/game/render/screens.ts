import Phaser from 'phaser';
import {
  calculateRank,
  type Profile,
  type RankResult,
} from '../core/profile';
import { DEFAULT_SETTINGS, type GameSettings } from '../core/settings';
import type { BoonDefinition, BoonKey } from '../core/boons';
import {
  getUpgradeCost,
  UPGRADE_ORDER,
  UPGRADES,
  type UpgradeKey,
} from '../core/upgrades';
import { drawHubBackground } from './hubBackground';
import {
  createButton,
  createDivider,
  createIcon,
  createMedallion,
  createPanel,
  createSlider,
  createVignette,
  spawnEmbers,
  UI_COLORS,
  UI_FONT,
} from './uiKit';

// ============================================================================
// ЭКРАНЫ (лагерь, улучшения, памятка, пауза, победа и поражение)
// Вёрстка рассчитана сразу на 1280×720. Вся статистика и очистка поля
// остаются в GameScene — здесь только отрисовка.
// ============================================================================

const FLOOR_ROMAN = ['I', 'II', 'III'] as const;

/** На сенсорных экранах подсказки про клавиши заменяются на жесты. */
function isTouchUi(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
}

/** «II / III» — этап, на котором закончился спуск. */
function formatFloor(floor: number): string {
  return `${FLOOR_ROMAN[floor - 1] ?? 'I'} / ${FLOOR_ROMAN[FLOOR_ROMAN.length - 1]}`;
}

/** Статистика, показываемая на экране победы или поражения. */
export interface GameOverStats {
  score: number;
  killsCount: number;
  survivalTime: number;
  manaCollected: number;
  accuracy: number;
  wave: number;
  wavesTotal: number;
  /** Номер этажа, на котором закончился спуск (1–3). */
  floor: number;
  bossesKilled: number;
  hp: number;
  maxHp: number;
  /** Сколько Эха принёс этот спуск. */
  echoGained: number;
  /** Сколько Эха всего накоплено в профиле. */
  echoTotal: number;
  victory: boolean;
  /** Номер локации, открытой этой победой (если открылась новая). */
  newlyUnlockedLevel: number | null;
}

/** Выбор локации на главном экране. */
export interface LevelSelectState {
  /** Выбранная локация (0 — первая). */
  index: number;
  /** Сколько локаций открыто. */
  unlocked: number;
  /** Названия всех локаций по порядку. */
  levels: string[];
  onChange: (index: number) => void;
}

/** Настройки живут в GameScene, экраны только показывают их и меняют. */
export interface SettingsController {
  settings: GameSettings;
  update: (next: GameSettings) => void;
}

/** Профиль и покупки тоже живут в GameScene, хаб только вызывает их. */
export interface ProfileController {
  getProfile: () => Profile;
  buyUpgrade: (key: UpgradeKey) => { ok: boolean; message: string };
}

/** Затемнение, виньетка и угли — общий фон всех меню. */
function createScreenBase(
  scene: Phaser.Scene,
  overlay: Phaser.GameObjects.Container,
  accent: number
): Phaser.GameObjects.Container {
  const screen = scene.add.container(0, 0);
  const backdrop = scene.add.container(0, 0);
  const { width, height } = scene.scale;

  const dim = scene.add.rectangle(width / 2, height / 2, width, height, UI_COLORS.void, 0.72);
  const vignette = createVignette(scene, width, height, UI_COLORS.void, 0.85);
  const glow = scene.add.circle(width / 2, height / 2, 300, accent, 0.05);

  backdrop.add([dim, vignette, glow]);
  spawnEmbers(scene, backdrop, width, height, 26);

  // Фон проявляется мягко, а карточка поверх него выезжает отдельно.
  backdrop.setAlpha(0);
  scene.tweens.add({
    targets: backdrop,
    alpha: 1,
    duration: 320,
    ease: 'Quad.easeOut',
  });

  screen.add(backdrop);
  overlay.add(screen);
  return screen;
}

function animateCardIn(scene: Phaser.Scene, card: Phaser.GameObjects.Container): void {
  const targetY = card.y;
  card.setY(targetY + 18);
  card.setAlpha(0);
  card.setScale(0.95);

  scene.tweens.add({
    targets: card,
    y: targetY,
    alpha: 1,
    scale: 1,
    duration: 320,
    ease: 'Cubic.easeOut',
  });
}

// ============================================================================
// СТАРТОВЫЙ ЭКРАН
// ============================================================================

interface HelpModal {
  open: () => void;
}

function createHelpModal(scene: Phaser.Scene, screen: Phaser.GameObjects.Container): HelpModal {
  const modal = scene.add.container(scene.scale.width / 2, scene.scale.height / 2);
  modal.setVisible(false).setAlpha(0);

  const backdrop = scene.add.rectangle(
    0,
    0,
    scene.scale.width * 1.1,
    scene.scale.height * 1.1,
    UI_COLORS.void,
    0.6
  ).setInteractive();
  modal.add(backdrop);

  const panel = createPanel(scene, -400, -260, 800, 520, UI_COLORS.mana);
  modal.add(panel);

  const title = scene.add.text(0, -220, 'ПАМЯТКА СТРАЖА', {
    fontFamily: UI_FONT.display,
    fontSize: '28px',
    fontStyle: 'bold',
    color: '#dbeafe',
    letterSpacing: 1,
  }).setOrigin(0.5);

  const divider = createDivider(scene, 0, -182, 520, UI_COLORS.mana);

  const headers = (x: number, y: number, text: string): Phaser.GameObjects.Text =>
    scene.add.text(x, y, text, {
      fontFamily: UI_FONT.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#7dd3fc',
      letterSpacing: 2,
    });

  const body = (x: number, y: number, text: string): Phaser.GameObjects.Text =>
    scene.add.text(x, y, text, {
      fontFamily: UI_FONT.body,
      fontSize: '14px',
      color: '#c3cedd',
      lineSpacing: 7,
      wordWrap: { width: 320 },
    });

  const leftX = -340;
  const rightX = 20;

  const leftControlsHeader = headers(leftX, -146, 'УПРАВЛЕНИЕ');
  const leftControlsBody = body(
    leftX,
    -118,
    isTouchUi()
      ? 'Левая половина — стик движения\n' +
          'Правая половина — стик прицела\n' +
          'Верхняя полоса — панели и пауза\n' +
          'Отпустите палец, чтобы остановиться'
      : 'WASD или стрелки — движение\n' +
          'Курсор мыши — направление взгляда\n' +
          'ЛКМ или Пробел — выстрел (15 маны)\n' +
          'ESC — пауза'
  );

  const rightCombatHeader = headers(rightX, -146, 'БОЙ');
  const rightCombatBody = body(
    rightX,
    -118,
    'В круге света враги сильно замедляются\n' +
      'Во тьме свет сужается, рыцарь медленнее\n' +
      'Фазы сменяются по набранным очкам\n' +
      'После урона — секунда неуязвимости'
  );

  const midDivider = createDivider(scene, 0, -18, 620, UI_COLORS.mana);

  const leftRunHeader = headers(leftX, 20, 'СПУСК');
  const leftRunBody = body(
    leftX,
    46,
    'Каждый спуск — три этажа по три волны\n' +
      'После каждого этажа — выбор дара\n' +
      'Между волнами: +1 HP и +25 маны'
  );

  const rightEchoHeader = headers(rightX, 20, 'ЭХО И ЛАГЕРЬ');
  const rightEchoBody = body(
    rightX,
    46,
    'Эхо за спуск: очки / 2 + 20 за босса\n' +
      'Победа — полная награда, смерть — половина\n' +
      'Эхо тратится на улучшения в лагере\n' +
      'Победа открывает следующую локацию'
  );

  const closeButton = createButton(scene, 0, 200, 220, 46, 'ЗАКРЫТЬ', {
    variant: 'secondary',
    onClick: () => close(),
    fontSize: 14,
  });

  modal.add([
    title,
    divider,
    leftControlsHeader,
    leftControlsBody,
    rightCombatHeader,
    rightCombatBody,
    midDivider,
    leftRunHeader,
    leftRunBody,
    rightEchoHeader,
    rightEchoBody,
    closeButton.container,
  ]);

  screen.add(modal);

  const open = (): void => {
    modal.setVisible(true);
    modal.setAlpha(0);
    modal.setScale(0.96);
    scene.tweens.add({
      targets: modal,
      alpha: 1,
      scale: 1,
      duration: 240,
      ease: 'Cubic.easeOut',
    });
  };

  const close = (): void => {
    scene.tweens.add({
      targets: modal,
      alpha: 0,
      duration: 140,
      onComplete: () => modal.setVisible(false),
    });
  };

  return { open };
}

// ============================================================================
// НАСТРОЙКИ
// ============================================================================

interface SettingsModal {
  open: () => void;
}

function createSettingsModal(
  scene: Phaser.Scene,
  screen: Phaser.GameObjects.Container,
  controller: SettingsController
): SettingsModal {
  const { width, height } = scene.scale;

  // Контейнер стоит в (0, 0), чтобы координаты слайдеров совпадали
  // с координатами указателя.
  const modal = scene.add.container(0, 0);
  modal.setVisible(false).setAlpha(0);

  const backdrop = scene.add
    .rectangle(width / 2, height / 2, width, height, UI_COLORS.void, 0.6)
    .setInteractive();
  modal.add(backdrop);

  const panel = createPanel(scene, 330, 145, 620, 455, UI_COLORS.mana);
  modal.add(panel);

  const title = scene.add.text(width / 2, 192, 'НАСТРОЙКИ', {
    fontFamily: UI_FONT.display,
    fontSize: '30px',
    fontStyle: 'bold',
    color: '#dbeafe',
    letterSpacing: 2,
  }).setOrigin(0.5);

  const divider = createDivider(scene, width / 2, 226, 400, UI_COLORS.mana);

  const labelColor = '#7dd3fc';
  const valueColor = '#e2e8f0';

  const makeLabel = (y: number, text: string): Phaser.GameObjects.Text =>
    scene.add.text(430, y, text, {
      fontFamily: UI_FONT.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: labelColor,
      letterSpacing: 2,
    }).setOrigin(0, 0.5);

  const makeValue = (y: number): Phaser.GameObjects.Text =>
    scene.add.text(850, y, '', {
      fontFamily: UI_FONT.body,
      fontSize: '13px',
      fontStyle: 'bold',
      color: valueColor,
    }).setOrigin(1, 0.5);

  const musicLabel = makeLabel(288, 'МУЗЫКА');
  const musicValue = makeValue(288);
  const sfxLabel = makeLabel(376, 'ЗВУКИ');
  const sfxValue = makeValue(376);

  let current: GameSettings = { ...controller.settings };

  const refreshValues = (): void => {
    musicValue.setText(`${Math.round(current.musicVolume * 100)}%`);
    sfxValue.setText(`${Math.round(current.sfxVolume * 100)}%`);
  };

  const apply = (next: GameSettings): void => {
    current = next;
    refreshValues();
    controller.update(current);
  };

  const musicSlider = createSlider(scene, width / 2, 322, 360, {
    value: current.musicVolume,
    accent: UI_COLORS.ember,
    onChange: (value) => apply({ ...current, musicVolume: value }),
  });

  const sfxSlider = createSlider(scene, width / 2, 410, 360, {
    value: current.sfxVolume,
    accent: UI_COLORS.mana,
    onChange: (value) => apply({ ...current, sfxVolume: value }),
  });

  const sfxHint = scene.add.text(width / 2, 434, 'эффекты появятся позже', {
    fontFamily: UI_FONT.body,
    fontSize: '10px',
    color: '#64748b',
  }).setOrigin(0.5);

  const muteButton = createButton(scene, width / 2, 486, 280, 44, '', {
    variant: 'secondary',
    onClick: () => {
      current = { ...current, muted: !current.muted };
      refreshMute();
      controller.update(current);
    },
    fontSize: 13,
  });

  function refreshMute(): void {
    muteButton.label.setText(current.muted ? 'ЗВУК ВЫКЛЮЧЕН' : 'ЗВУК ВКЛЮЧЁН');
    muteButton.label.setColor(current.muted ? '#fca5a5' : '#e2e8f0');
  }

  const resetButton = createButton(scene, width / 2 - 130, 546, 220, 44, 'СБРОСИТЬ', {
    variant: 'ghost',
    accent: UI_COLORS.brass,
    accentHex: '#f0c674',
    onClick: () => {
      current = { ...DEFAULT_SETTINGS };
      musicSlider.setValue(current.musicVolume);
      sfxSlider.setValue(current.sfxVolume);
      refreshValues();
      refreshMute();
      controller.update(current);
    },
    fontSize: 12,
  });

  const closeButton = createButton(scene, width / 2 + 130, 546, 220, 44, 'ЗАКРЫТЬ', {
    variant: 'secondary',
    onClick: () => close(),
    fontSize: 13,
  });

  modal.add([
    title,
    divider,
    musicLabel,
    musicValue,
    sfxLabel,
    sfxValue,
    musicSlider.container,
    sfxSlider.container,
    sfxHint,
    muteButton.container,
    resetButton.container,
    closeButton.container,
  ]);
  screen.add(modal);

  refreshValues();
  refreshMute();

  const open = (): void => {
    current = { ...controller.settings };
    musicSlider.setValue(current.musicVolume);
    sfxSlider.setValue(current.sfxVolume);
    refreshValues();
    refreshMute();
    modal.setVisible(true);
    modal.setAlpha(0);
    scene.tweens.add({
      targets: modal,
      alpha: 1,
      duration: 220,
      ease: 'Quad.easeOut',
    });
  };

  function close(): void {
    scene.tweens.add({
      targets: modal,
      alpha: 0,
      duration: 140,
      onComplete: () => modal.setVisible(false),
    });
  }

  return { open };
}

// ============================================================================
// УЛУЧШЕНИЯ
// ============================================================================

interface UpgradesModal {
  open: () => void;
}

interface UpgradeCardRef {
  key: UpgradeKey;
  container: Phaser.GameObjects.Container;
  baseY: number;
  levelText: Phaser.GameObjects.Text;
  buyButton: ReturnType<typeof createButton>;
}

function createUpgradesModal(
  scene: Phaser.Scene,
  screen: Phaser.GameObjects.Container,
  controller: ProfileController,
  onProfileChanged: () => void
): UpgradesModal {
  const { width, height } = scene.scale;
  const modal = scene.add.container(0, 0).setVisible(false).setAlpha(0);

  const backdrop = scene.add
    .rectangle(width / 2, height / 2, width, height, UI_COLORS.void, 0.72)
    .setInteractive();
  modal.add(backdrop);

  const panel = createPanel(scene, 160, 48, 960, 624, UI_COLORS.ember, { glow: true });
  modal.add(panel);

  const title = scene.add.text(640, 94, 'УЛУЧШЕНИЯ', {
    fontFamily: UI_FONT.display,
    fontSize: '32px',
    fontStyle: 'bold',
    color: '#f4ecd8',
    letterSpacing: 2,
  }).setOrigin(0.5);

  const divider = createDivider(scene, 640, 128, 520, UI_COLORS.ember);

  const echoText = scene.add.text(1108, 94, '', {
    fontFamily: UI_FONT.body,
    fontSize: '14px',
    fontStyle: 'bold',
    color: '#f0c674',
    letterSpacing: 1,
  }).setOrigin(1, 0.5);

  const statusText = scene.add.text(640, 578, '', {
    fontFamily: UI_FONT.body,
    fontSize: '12px',
    fontStyle: 'bold',
    color: '#94a3b8',
  }).setOrigin(0.5);

  const cards: UpgradeCardRef[] = UPGRADE_ORDER.map((key, index) => {
    const definition = UPGRADES[key];
    const y = 158 + index * 136;
    const iconKind = key === 'VITALITY' ? 'banner' : key === 'MANA_RESERVE' ? 'crystal' : 'flame';

    const cardContainer = scene.add.container(0, y);
    const cardPanel = createPanel(scene, 220, 0, 840, 120, 0x4b5d77);
    const icon = createIcon(scene, 268, 60, iconKind, 32, UI_COLORS.emberBright);

    const name = scene.add.text(300, 14, definition.name, {
      fontFamily: UI_FONT.display,
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#f0c674',
      letterSpacing: 1,
    });

    const description = scene.add.text(300, 42, definition.description, {
      fontFamily: UI_FONT.body,
      fontSize: '12px',
      color: '#c3cedd',
      lineSpacing: 4,
      wordWrap: { width: 400 },
    });

    const effect = scene.add.text(300, 88, definition.effect, {
      fontFamily: UI_FONT.body,
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#7dd3fc',
    });

    const levelText = scene.add.text(1040, 16, '', {
      fontFamily: UI_FONT.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#94a3b8',
      letterSpacing: 1,
    }).setOrigin(1, 0);

    const buyButton = createButton(scene, 960, 72, 180, 40, '', {
      variant: 'primary',
      accent: UI_COLORS.ember,
      accentHex: '#1a1205',
      onClick: () => handleBuy(key),
      fontSize: 12,
    });

    cardContainer.add([
      cardPanel,
      icon,
      name,
      description,
      effect,
      levelText,
      buyButton.container,
    ]);
    modal.add(cardContainer);

    return { key, container: cardContainer, baseY: y, levelText, buyButton };
  });

  const refresh = (): void => {
    const profile = controller.getProfile();
    echoText.setText(`ЭХО: ${profile.echo}`);

    for (const card of cards) {
      const definition = UPGRADES[card.key];
      const level = profile.upgrades[card.key];
      const cost = getUpgradeCost(card.key, level);
      card.levelText.setText(`УРОВЕНЬ ${level} / ${definition.maxLevel}`);

      if (cost === null) {
        card.buyButton.label.setText('МАКСИМУМ');
        card.buyButton.label.setColor('#64748b');
        card.buyButton.background.setFillStyle(0x1e293b, 0.9);
        card.buyButton.background.disableInteractive();
        card.buyButton.container.setAlpha(0.7);
        continue;
      }

      card.buyButton.label.setText(`КУПИТЬ · ${cost}`);

      if (profile.echo >= cost) {
        card.buyButton.label.setColor('#1a1205');
        card.buyButton.background.setFillStyle(UI_COLORS.ember, 0.96);
        card.buyButton.background.setInteractive({ useHandCursor: true });
        card.buyButton.container.setAlpha(1);
      } else {
        card.buyButton.label.setColor('#94a3b8');
        card.buyButton.background.setFillStyle(0x1e293b, 0.9);
        card.buyButton.background.disableInteractive();
        card.buyButton.container.setAlpha(0.8);
      }
    }
  };

  function handleBuy(key: UpgradeKey): void {
    const result = controller.buyUpgrade(key);
    statusText.setText(result.message);
    statusText.setColor(result.ok ? '#fbbf24' : '#fca5a5');
    if (result.ok) {
      onProfileChanged();
      refresh();
    }
  }

  const closeButton = createButton(scene, 640, 626, 220, 46, 'ЗАКРЫТЬ', {
    variant: 'secondary',
    onClick: () => close(),
    fontSize: 13,
  });

  modal.add([title, divider, echoText, statusText, closeButton.container]);
  screen.add(modal);

  const open = (): void => {
    statusText.setText('');
    statusText.setColor('#94a3b8');
    refresh();
    modal.setVisible(true);
    modal.setAlpha(0);
    scene.tweens.add({
      targets: modal,
      alpha: 1,
      duration: 220,
      ease: 'Quad.easeOut',
    });

    // Карточки поднимаются по очереди, чтобы окно «раскрывалось».
    cards.forEach((card, index) => {
      scene.tweens.killTweensOf(card.container);
      card.container.setAlpha(0);
      card.container.y = card.baseY + 14;
      scene.tweens.add({
        targets: card.container,
        y: card.baseY,
        alpha: 1,
        delay: 80 + index * 60,
        duration: 280,
        ease: 'Cubic.easeOut',
      });
    });
  };

  function close(): void {
    scene.tweens.add({
      targets: modal,
      alpha: 0,
      duration: 140,
      onComplete: () => modal.setVisible(false),
    });
  }

  return { open };
}

// ============================================================================
// ХАБ / СТАРТОВЫЙ ЭКРАН
// ============================================================================

/** Слоганы под лором: сменяются, пока игрок стоит в лагере. */
const START_SLOGANS = [
  'Тьма не спешит. Спешит пламя.',
  'Каждый спуск оставляет имя — или пепел.',
  'Факел гаснет быстрее, чем храбрость.',
  'Внизу нет героев. Только те, кто ещё идёт.',
  'Свет — не спасение. Свет — отсрочка.',
  'Крипта помнит всех. Некоторые имена ещё горят.',
];

export function drawStartScreen(
  scene: Phaser.Scene,
  overlay: Phaser.GameObjects.Container,
  profileController: ProfileController,
  onStart: () => void,
  settingsController: SettingsController,
  levelSelect: LevelSelectState
): void {
  const { width, height } = scene.scale;
  const screen = scene.add.container(0, 0);
  overlay.add(screen);

  drawHubBackground(scene, screen, width, height);

  // ------------------------------------------------------------ ЛОГОТИП
  const emblemGlow = scene.add.circle(100, 96, 46, UI_COLORS.ember, 0.14);
  const emblem = createIcon(scene, 100, 96, 'torch', 62, UI_COLORS.emberBright);

  const subtitle = scene.add.text(150, 56, 'ХРОНИКИ ПОДЗЕМЕЛЬЯ', {
    fontFamily: UI_FONT.body,
    fontSize: '11px',
    fontStyle: 'bold',
    color: '#a8844c',
    letterSpacing: 4,
  });

  const titleLine1 = scene.add.text(148, 74, 'ПОСЛЕДНИЙ ФАКЕЛ', {
    fontFamily: UI_FONT.display,
    fontSize: '32px',
    fontStyle: 'bold',
    color: '#f4ecd8',
  });

  const titleLine2 = scene.add.text(148, 110, 'КРИПТЫ', {
    fontFamily: UI_FONT.display,
    fontSize: '32px',
    fontStyle: 'bold',
    color: '#f4ecd8',
  });

  const logoDivider = createDivider(scene, 300, 154, 320, UI_COLORS.brass);

  const lore = scene.add.text(
    70,
    184,
    'Крипта не хоронит мёртвых — она их запоминает.\n' +
      'Спуститесь в темноту, отнимите у неё Эхо павших\n' +
      'и вернитесь, пока факел ещё горит.',
    {
      fontFamily: UI_FONT.body,
      fontSize: '14px',
      color: '#c3cedd',
      lineSpacing: 7,
      wordWrap: { width: 460 },
    }
  );

  // Слоган меняется сам, пока игрок выбирает, куда идти.
  let sloganIndex = 0;
  const sloganText = scene.add.text(70, 266, `— ${START_SLOGANS[0]}`, {
    fontFamily: UI_FONT.body,
    fontSize: '13px',
    fontStyle: 'italic',
    color: '#8fa3ba',
    lineSpacing: 4,
    wordWrap: { width: 460 },
  });

  const sloganTimer = scene.time.addEvent({
    delay: 7000,
    loop: true,
    callback: () => {
      if (!sloganText.active) return;
      scene.tweens.add({
        targets: sloganText,
        alpha: 0,
        duration: 340,
        ease: 'Quad.easeIn',
        onComplete: () => {
          sloganIndex = (sloganIndex + 1) % START_SLOGANS.length;
          sloganText.setText(`— ${START_SLOGANS[sloganIndex]}`);
          scene.tweens.add({
            targets: sloganText,
            alpha: 1,
            duration: 420,
            ease: 'Quad.easeOut',
          });
        },
      });
    },
  });
  screen.once('destroy', () => sloganTimer.remove());

  // ------------------------------------------------------- КНОПКИ СПРАВА
  const menuX = 1000;
  const menuTitle = scene.add.text(menuX, 168, 'ЛАГЕРЬ СТРАЖА', {
    fontFamily: UI_FONT.body,
    fontSize: '11px',
    fontStyle: 'bold',
    color: '#a8844c',
    letterSpacing: 4,
  }).setOrigin(0.5);

  const startButton = createButton(scene, menuX, 250, 320, 64, 'СПУСТИТЬСЯ', {
    variant: 'primary',
    accent: UI_COLORS.ember,
    accentHex: '#fff7ed',
    onClick: onStart,
    fontSize: 17,
  });

  // Локация: стрелки листают все, но закрытую нельзя начать.
  let selectedLevel = Phaser.Math.Clamp(levelSelect.index, 0, Math.max(0, levelSelect.levels.length - 1));
  const levelLabel = scene.add.text(menuX, 196, '', {
    fontFamily: UI_FONT.body,
    fontSize: '11px',
    fontStyle: 'bold',
    color: '#f0c674',
    letterSpacing: 1,
  }).setOrigin(0.5);

  const renderLevel = (): void => {
    const unlocked = selectedLevel < levelSelect.unlocked;
    const roman = FLOOR_ROMAN[selectedLevel] ?? `${selectedLevel + 1}`;
    const name = levelSelect.levels[selectedLevel] ?? '';
    levelLabel.setText(
      unlocked ? `ЛОКАЦИЯ ${roman} · ${name.toUpperCase()}` : `ЛОКАЦИЯ ${roman} · ЗАКРЫТО`
    );
    levelLabel.setColor(unlocked ? '#f0c674' : '#64748b');
    startButton.container.setAlpha(unlocked ? 1 : 0.45);
  };

  const cycleLevel = (direction: number): void => {
    const count = Math.max(1, levelSelect.levels.length);
    selectedLevel = (selectedLevel + direction + count) % count;
    levelSelect.onChange(selectedLevel);
    renderLevel();
  };

  const levelPrev = createButton(scene, 834, 196, 40, 30, '‹', {
    variant: 'ghost',
    accent: UI_COLORS.brass,
    accentHex: '#f0c674',
    onClick: () => cycleLevel(-1),
    fontSize: 18,
  });

  const levelNext = createButton(scene, 1166, 196, 40, 30, '›', {
    variant: 'ghost',
    accent: UI_COLORS.brass,
    accentHex: '#f0c674',
    onClick: () => cycleLevel(1),
    fontSize: 18,
  });

  renderLevel();

  const upgradesButton = createButton(scene, menuX, 334, 320, 50, 'УЛУЧШЕНИЯ', {
    variant: 'secondary',
    onClick: () => upgradesModal.open(),
    fontSize: 14,
  });

  const settingsButton = createButton(scene, menuX, 398, 320, 50, 'НАСТРОЙКИ', {
    variant: 'ghost',
    accent: UI_COLORS.brass,
    accentHex: '#f0c674',
    onClick: () => settingsModal.open(),
    fontSize: 13,
  });

  const helpButton = createButton(scene, menuX, 462, 320, 50, 'ПАМЯТКА', {
    variant: 'ghost',
    accent: UI_COLORS.brass,
    accentHex: '#f0c674',
    onClick: () => help.open(),
    fontSize: 13,
  });

  // ------------------------------------------------ ХРОНИКА В ПРАВОЙ КОЛОНКЕ
  const statsPanel = createPanel(scene, 840, 500, 320, 124, UI_COLORS.brass, {
    alpha: 0.96,
  });

  const statsHeader = scene.add.text(1000, 516, 'ХРОНИКА СТРАЖА', {
    fontFamily: UI_FONT.body,
    fontSize: '10px',
    fontStyle: 'bold',
    color: '#7c8ba1',
    letterSpacing: 2,
  }).setOrigin(0.5);

  const statsDivider = createDivider(scene, 1000, 530, 260, UI_COLORS.brass);

  const echoIcon = createIcon(scene, 886, 558, 'crystal', 20, UI_COLORS.mana);

  const echoLabel = scene.add.text(904, 544, 'ЭХО', {
    fontFamily: UI_FONT.body,
    fontSize: '10px',
    fontStyle: 'bold',
    color: '#7c8ba1',
    letterSpacing: 2,
  });

  const echoValue = scene.add.text(904, 556, '', {
    fontFamily: UI_FONT.display,
    fontSize: '26px',
    fontStyle: 'bold',
    color: '#f0c674',
  });

  const rankMedallion = createMedallion(scene, 1106, 556, 22, UI_COLORS.brass);
  const rankValue = scene.add.text(1106, 556, '', {
    fontFamily: UI_FONT.display,
    fontSize: '22px',
    fontStyle: 'bold',
    color: '#f4ecd8',
  }).setOrigin(0.5);
  const rankLabel = scene.add.text(1106, 588, 'РАНГ', {
    fontFamily: UI_FONT.body,
    fontSize: '9px',
    fontStyle: 'bold',
    color: '#7c8ba1',
    letterSpacing: 2,
  }).setOrigin(0.5);

  const statsSummary = scene.add.text(1000, 610, '', {
    fontFamily: UI_FONT.body,
    fontSize: '10px',
    color: '#94a3b8',
  }).setOrigin(0.5);

  const refreshStats = (): void => {
    const profile = profileController.getProfile();
    echoValue.setText(`${profile.echo}`);
    rankValue.setText(profile.bestRank ?? '—');
    statsSummary.setText(
      `Спуски ${profile.runs} · Победы ${profile.victories} · Лучший счёт ${profile.bestScore}`
    );
  };
  refreshStats();

  screen.add([
    emblemGlow,
    emblem,
    subtitle,
    titleLine1,
    titleLine2,
    logoDivider,
    lore,
    sloganText,
    menuTitle,
    levelLabel,
    levelPrev.container,
    levelNext.container,
    startButton.container,
    upgradesButton.container,
    settingsButton.container,
    helpButton.container,
    statsPanel,
    statsHeader,
    statsDivider,
    echoIcon,
    echoLabel,
    echoValue,
    rankMedallion,
    rankValue,
    rankLabel,
    statsSummary,
  ]);

  const help = createHelpModal(scene, screen);
  const settingsModal = createSettingsModal(scene, screen, settingsController);
  const upgradesModal = createUpgradesModal(scene, screen, profileController, refreshStats);

  scene.tweens.add({
    targets: emblemGlow,
    scale: 1.3,
    alpha: 0.05,
    duration: 1700,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  const baseScale = emblem.scale;
  scene.tweens.add({
    targets: emblem,
    scale: baseScale * 1.08,
    duration: 750,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

// ============================================================================
// ЭКРАНЫ ИТОГОВ
// ============================================================================

interface ResultScreenOptions {
  badge: string;
  title: string;
  accent: number;
  accentHex: string;
  primaryLabel: string;
  primaryTextColor: string;
  onRetry: () => void;
  onBackToMenu: () => void;
}

function createRankBlock(
  scene: Phaser.Scene,
  rank: RankResult,
  accent: number,
  y: number
): Phaser.GameObjects.Container {
  const group = scene.add.container(0, y);

  const rays = scene.add.graphics();
  rays.lineStyle(2, accent, 0.22);
  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 * i) / 12;
    rays.lineBetween(
      Math.cos(angle) * 72,
      Math.sin(angle) * 72,
      Math.cos(angle) * 96,
      Math.sin(angle) * 96
    );
  }
  group.add(rays);

  const medallion = createMedallion(scene, 0, 0, 62, accent);
  group.add(medallion);

  const letterColor =
    rank.letter === 'S' ? '#fbbf24' : rank.letter === 'A' ? '#7dd3fc' : '#cbd5e1';
  const letter = scene.add.text(0, 2, rank.letter, {
    fontFamily: UI_FONT.display,
    fontSize: '56px',
    fontStyle: 'bold',
    color: letterColor,
  }).setOrigin(0.5);
  group.add(letter);

  group.setAlpha(0);
  group.setScale(1.5);
  scene.tweens.add({
    targets: group,
    alpha: 1,
    scale: 1,
    delay: 140,
    duration: 320,
    ease: 'Back.easeOut',
  });

  return group;
}

function drawResultScreen(
  scene: Phaser.Scene,
  overlay: Phaser.GameObjects.Container,
  stats: GameOverStats,
  options: ResultScreenOptions
): void {
  const screen = createScreenBase(scene, overlay, options.accent);
  const card = scene.add.container(scene.scale.width / 2, scene.scale.height / 2);

  const panel = createPanel(scene, -420, -310, 840, 620, options.accent, { glow: true });
  card.add(panel);

  const badge = scene.add.text(0, -270, options.badge, {
    fontFamily: UI_FONT.body,
    fontSize: '11px',
    fontStyle: 'bold',
    color: options.accentHex,
    letterSpacing: 5,
  }).setOrigin(0.5);

  const title = scene.add.text(0, -232, options.title, {
    fontFamily: UI_FONT.display,
    fontSize: '40px',
    fontStyle: 'bold',
    color: options.accentHex,
  }).setOrigin(0.5);

  const divider = createDivider(scene, 0, -190, 440, options.accent);

  const rank = calculateRank(stats);
  const rankBlock = createRankBlock(scene, rank, options.accent, -116);

  const rankTitle = scene.add.text(0, -36, rank.title, {
    fontFamily: UI_FONT.body,
    fontSize: '12px',
    fontStyle: 'bold',
    color: options.accentHex,
    letterSpacing: 3,
  }).setOrigin(0.5);

  const statCells: [string, string][] = [
    ['ОЧКИ', `${stats.score}`],
    ['УБИТО', `${stats.killsCount}`],
    ['ВРЕМЯ', `${stats.survivalTime.toFixed(1)} сек`],
    ['ТОЧНОСТЬ', `${stats.accuracy}%`],
    ['ВОЛНА', `${stats.wave} / ${stats.wavesTotal}`],
    ['ЭТАЖ', formatFloor(stats.floor)],
  ];

  statCells.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = column === 0 ? -190 : 190;
    const y = 10 + row * 48;

    const cell = scene.add.container(x, y);
    const labelText = scene.add.text(0, -12, label, {
      fontFamily: UI_FONT.body,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#7c8ba1',
      letterSpacing: 2,
    }).setOrigin(0.5);

    const valueText = scene.add.text(0, 10, value, {
      fontFamily: UI_FONT.display,
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#e8eef7',
    }).setOrigin(0.5);

    cell.add([labelText, valueText]);
    cell.setAlpha(0);
    cell.setY(y + 10);

    scene.tweens.add({
      targets: cell,
      alpha: 1,
      y,
      delay: 200 + index * 45,
      duration: 220,
      ease: 'Cubic.easeOut',
    });

    card.add(cell);
  });

  const footnote = scene.add.text(
    0,
    146,
    stats.newlyUnlockedLevel !== null
      ? `Собрано эфира: ${stats.manaCollected} · Боссов повержено: ${stats.bossesKilled} · Открыта локация ${
          FLOOR_ROMAN[stats.newlyUnlockedLevel - 1] ?? stats.newlyUnlockedLevel
        }`
      : `Собрано эфира: ${stats.manaCollected} · Боссов повержено: ${stats.bossesKilled}`,
    {
      fontFamily: UI_FONT.body,
      fontSize: '11px',
      color: stats.newlyUnlockedLevel !== null ? '#f0c674' : '#8b9bb0',
      letterSpacing: 1,
    }
  ).setOrigin(0.5);

  const echoText = scene.add.text(
    0,
    170,
    `+${stats.echoGained} ЭХА · ВСЕГО ${stats.echoTotal}`,
    {
      fontFamily: UI_FONT.body,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#f0c674',
      letterSpacing: 2,
    }
  ).setOrigin(0.5);

  const primaryButton = createButton(scene, 0, 218, 340, 58, options.primaryLabel, {
    variant: 'primary',
    accent: options.accent,
    accentHex: options.primaryTextColor,
    onClick: options.onRetry,
    fontSize: 17,
  });

  const secondaryButton = createButton(scene, 0, 280, 300, 46, 'В ЛАГЕРЬ', {
    variant: 'secondary',
    onClick: options.onBackToMenu,
    fontSize: 14,
  });

  card.add([
    badge,
    title,
    divider,
    rankBlock,
    rankTitle,
    footnote,
    echoText,
    primaryButton.container,
    secondaryButton.container,
  ]);
  screen.add(card);

  animateCardIn(scene, card);
}

export function drawGameOverScreen(
  scene: Phaser.Scene,
  overlay: Phaser.GameObjects.Container,
  stats: GameOverStats,
  onRetry: () => void,
  onBackToMenu: () => void
): void {
  drawResultScreen(scene, overlay, stats, {
    badge: 'ИТОГИ ВЫЛАЗКИ',
    title: 'ФАКЕЛ ПОГАС',
    accent: 0xef4444,
    accentHex: '#f87171',
    primaryLabel: 'ЕЩЁ РАЗ',
    primaryTextColor: '#fff5f5',
    onRetry,
    onBackToMenu,
  });
}

export function drawVictoryScreen(
  scene: Phaser.Scene,
  overlay: Phaser.GameObjects.Container,
  stats: GameOverStats,
  onRetry: () => void,
  onBackToMenu: () => void
): void {
  drawResultScreen(scene, overlay, stats, {
    badge: 'ПОБЕДА',
    title: 'КРИПТА ОЧИЩЕНА',
    accent: 0xfbbf24,
    accentHex: '#f0c674',
    primaryLabel: 'ЕЩЁ РАЗ',
    primaryTextColor: '#1a1205',
    onRetry,
    onBackToMenu,
  });
}

// ============================================================================
// ПАУЗА
// ============================================================================

export function drawPauseScreen(
  scene: Phaser.Scene,
  overlay: Phaser.GameObjects.Container,
  stats: GameOverStats,
  onResume: () => void,
  onRestart: () => void,
  onBackToMenu: () => void,
  settingsController: SettingsController
): void {
  const screen = createScreenBase(scene, overlay, UI_COLORS.ember);
  const card = scene.add.container(scene.scale.width / 2, scene.scale.height / 2);

  const panel = createPanel(scene, -360, -270, 720, 540, UI_COLORS.brass, { glow: true });
  card.add(panel);

  const badge = scene.add.text(0, -230, 'ИГРА ОСТАНОВЛЕНА', {
    fontFamily: UI_FONT.body,
    fontSize: '11px',
    fontStyle: 'bold',
    color: '#a8844c',
    letterSpacing: 5,
  }).setOrigin(0.5);

  const title = scene.add.text(0, -192, 'ПАУЗА', {
    fontFamily: UI_FONT.display,
    fontSize: '42px',
    fontStyle: 'bold',
    color: '#f4ecd8',
  }).setOrigin(0.5);

  const divider = createDivider(scene, 0, -148, 380, UI_COLORS.brass);

  const pauseStats: [string, string][] = [
    ['ВОЛНА', `${stats.wave} / ${stats.wavesTotal}`],
    ['ОЧКИ', `${stats.score}`],
    ['ЭТАЖ', formatFloor(stats.floor)],
    ['УБИТО', `${stats.killsCount}`],
    ['ВРЕМЯ', `${stats.survivalTime.toFixed(1)} сек`],
    ['ЗДОРОВЬЕ', `${stats.hp} / ${stats.maxHp}`],
  ];

  pauseStats.forEach(([label, value], index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = -220 + column * 220;
    const y = -88 + row * 82;

    const cell = scene.add.container(x, y);
    const labelText = scene.add.text(0, -13, label, {
      fontFamily: UI_FONT.body,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#7c8ba1',
      letterSpacing: 2,
    }).setOrigin(0.5);
    const valueText = scene.add.text(0, 11, value, {
      fontFamily: UI_FONT.display,
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#e8eef7',
    }).setOrigin(0.5);

    cell.add([labelText, valueText]);
    card.add(cell);
  });

  const hint = scene.add.text(
    0,
    64,
    isTouchUi() ? 'Кнопка «Продолжить» вернёт в бой' : 'ESC — продолжить игру',
    {
      fontFamily: UI_FONT.body,
      fontSize: '12px',
      color: '#94a3b8',
    }
  ).setOrigin(0.5);

  const resumeButton = createButton(scene, 0, 126, 340, 56, 'ПРОДОЛЖИТЬ', {
    variant: 'primary',
    accent: UI_COLORS.ember,
    onClick: onResume,
    fontSize: 16,
  });

  const restartButton = createButton(scene, 0, 192, 340, 48, 'НАЧАТЬ ЗАНОВО', {
    variant: 'secondary',
    onClick: onRestart,
    fontSize: 14,
  });

  const settingsButton = createButton(scene, -105, 244, 190, 40, 'НАСТРОЙКИ', {
    variant: 'ghost',
    accent: UI_COLORS.brass,
    accentHex: '#f0c674',
    onClick: () => settingsModal.open(),
    fontSize: 12,
  });

  const menuButton = createButton(scene, 115, 244, 220, 40, 'В ЛАГЕРЬ', {
    variant: 'ghost',
    accent: UI_COLORS.brass,
    accentHex: '#f0c674',
    onClick: onBackToMenu,
    fontSize: 12,
  });

  card.add([
    badge,
    title,
    divider,
    hint,
    resumeButton.container,
    restartButton.container,
    settingsButton.container,
    menuButton.container,
  ]);
  screen.add(card);

  const settingsModal = createSettingsModal(scene, screen, settingsController);

  animateCardIn(scene, card);
}

// ============================================================================
// ДАРЫ ЭТАЖА
// ============================================================================

const BOON_ICONS: Record<BoonKey, 'bolt' | 'aim' | 'crystal' | 'banner'> = {
  RAPID_FIRE: 'bolt',
  DOUBLE_SHOT: 'aim',
  PIERCE: 'crystal',
  VITALITY: 'banner',
};

/** Модалка выбора дара после этажа. Игра стоит, пока игрок не выберет. */
export function showBoonChoice(
  scene: Phaser.Scene,
  overlay: Phaser.GameObjects.Container,
  choices: BoonDefinition[],
  onPick: (key: BoonKey) => void
): void {
  const { width, height } = scene.scale;

  const backdrop = scene.add
    .rectangle(width / 2, height / 2, width, height, UI_COLORS.void, 0.78)
    .setInteractive();
  backdrop.setAlpha(0);
  overlay.add(backdrop);

  const panel = createPanel(scene, 120, 86, 1040, 548, UI_COLORS.ember, { glow: true });
  panel.setAlpha(0);
  overlay.add(panel);

  const title = scene.add.text(640, 132, 'ДАРЫ ЭТАЖА', {
    fontFamily: UI_FONT.display,
    fontSize: '34px',
    fontStyle: 'bold',
    color: '#f4ecd8',
    letterSpacing: 2,
  }).setOrigin(0.5);

  const subtitle = scene.add.text(640, 170, 'Выберите один дар — он продержится до конца спуска', {
    fontFamily: UI_FONT.body,
    fontSize: '12px',
    color: '#a9b7c9',
  }).setOrigin(0.5);

  const divider = createDivider(scene, 640, 196, 520, UI_COLORS.ember);
  const note = scene.add.text(640, 600, 'Дар действует только в этом спуске', {
    fontFamily: UI_FONT.body,
    fontSize: '11px',
    color: '#7c8ba1',
  }).setOrigin(0.5);

  const header = [title, subtitle, divider, note];
  header.forEach((item) => item.setAlpha(0));
  overlay.add(header);

  // Подложка и заголовок проявляются раньше карточек.
  scene.tweens.add({ targets: backdrop, alpha: 1, duration: 260, ease: 'Quad.easeOut' });
  scene.tweens.add({
    targets: panel,
    alpha: 1,
    delay: 50,
    duration: 300,
    ease: 'Quad.easeOut',
  });
  scene.tweens.add({
    targets: header,
    alpha: 1,
    delay: 120,
    duration: 300,
    ease: 'Quad.easeOut',
  });

  const cardWidth = 290;
  const gap = 30;
  const totalWidth = choices.length * cardWidth + (choices.length - 1) * gap;
  const startX = 640 - totalWidth / 2;

  choices.forEach((choice, index) => {
    const x = startX + index * (cardWidth + gap);
    const y = 228;

    const cardContainer = scene.add.container(x, y);
    overlay.add(cardContainer);

    const card = createPanel(scene, 0, 0, cardWidth, 300, UI_COLORS.brass);
    const icon = createIcon(
      scene,
      cardWidth / 2,
      46,
      BOON_ICONS[choice.key],
      28,
      UI_COLORS.emberBright
    );
    const name = scene.add.text(cardWidth / 2, 86, choice.name, {
      fontFamily: UI_FONT.display,
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#f0c674',
      align: 'center',
      wordWrap: { width: cardWidth - 36 },
    }).setOrigin(0.5, 0);

    const cardDivider = createDivider(scene, cardWidth / 2, 120, cardWidth - 60, UI_COLORS.brass);

    const description = scene.add.text(22, 140, choice.description, {
      fontFamily: UI_FONT.body,
      fontSize: '12px',
      color: '#c3cedd',
      lineSpacing: 4,
      wordWrap: { width: cardWidth - 44 },
    });

    const effect = scene.add.text(22, 212, choice.effect, {
      fontFamily: UI_FONT.body,
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#7dd3fc',
      wordWrap: { width: cardWidth - 44 },
    });

    const pickButton = createButton(scene, cardWidth / 2, 266, cardWidth - 70, 40, 'ВЗЯТЬ', {
      variant: 'primary',
      accent: UI_COLORS.ember,
      accentHex: '#1a1205',
      onClick: () => onPick(choice.key),
      fontSize: 13,
    });

    cardContainer.add([card, icon, name, cardDivider, description, effect, pickButton.container]);

    // Карточки выезжают снизу по очереди — окно «раскрывается».
    cardContainer.setAlpha(0);
    cardContainer.y = y + 22;
    scene.tweens.add({
      targets: cardContainer,
      y,
      alpha: 1,
      delay: 160 + index * 70,
      duration: 320,
      ease: 'Cubic.easeOut',
    });
  });
}
