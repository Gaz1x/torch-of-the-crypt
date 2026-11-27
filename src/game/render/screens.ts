import Phaser from 'phaser';
import {
  calculateRank,
  RANK_TITLES,
  VICTORY_RANKS,
  type Profile,
  type RankLetter,
  type RankResult,
} from '../core/profile';
import { DEFAULT_SETTINGS, type GameSettings } from '../core/settings';
import { track } from '../core/analytics';
import type { BoonDefinition, BoonKey } from '../core/boons';
import {
  getUpgradeCost,
  getUpgradeMaxLevel,
  UPGRADE_ORDER,
  UPGRADES,
  type UpgradeKey,
} from '../core/upgrades';
import { getMastery, MASTERY_STEPS } from '../core/mastery';
import { ACHIEVEMENTS, countUnlocked, getAchievement } from '../core/achievements';
import {
  getNextPalette,
  getPalette,
  isPaletteUnlocked,
  PALETTES,
} from '../core/cosmetics';
import { BESTIARY_ENTRIES, countDiscovered } from '../core/bestiary';
import { GAME_CONFIG, type EnemyTypeKey } from '../core/gameConfig';
import { BOSS_CONFIG, type BossTypeKey } from '../core/bosses';
import { LEVELS } from '../core/waves';
import {
  DAILY_ECHO_BONUS,
  formatDailyKey,
  getDailyKey,
  getDailyRun,
} from '../core/daily';
import { createEnemyVisual } from './enemyArt';
import { createBossVisual } from './bossArt';
import { applyPlayerPalette, createPlayer } from './playerArt';
import {
  getTrialMultiplier,
  TRIAL_ORDER,
  TRIALS,
  type TrialKey,
} from '../core/trials';
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
export function isTouchUi(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
}

/** «II / III» — этап, на котором закончился спуск. */
function formatFloor(floor: number): string {
  return `${FLOOR_ROMAN[floor - 1] ?? 'I'} / ${FLOOR_ROMAN[FLOOR_ROMAN.length - 1]}`;
}

/**
 * Шеврон для селектора локаций. Тонкий штрих (2 px) совпадает по весу
 * с рамками панелей и не спорит с подписью. direction: -1 — влево, 1 — вправо.
 */
function createChevron(scene: Phaser.Scene, direction: number): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
  const back = -direction * 4;
  const tip = direction * 3.5;
  graphics.lineStyle(2, UI_COLORS.brassBright, 1);
  graphics.beginPath();
  graphics.moveTo(back, -6.5);
  graphics.lineTo(tip, 0);
  graphics.lineTo(back, 6.5);
  graphics.strokePath();
  return graphics;
}

/**
 * Сегмент-стрелка внутри полоски выбора локации. Виден только шеврон,
 * а зона нажатия шире него — под палец. Плашки и тени не рисуются,
 * чтобы стрелки не выглядели отдельными кнопками.
 */
function createLevelArrow(
  scene: Phaser.Scene,
  direction: number,
  onClick: () => void
): { container: Phaser.GameObjects.Container; hit: Phaser.GameObjects.Rectangle } {
  const container = scene.add.container(direction * 140, 0);
  const chevron = createChevron(scene, direction).setAlpha(0.7);
  const hit = scene.add
    .rectangle(0, 0, 40, 30, 0x000000, 0)
    .setInteractive({ useHandCursor: true });

  hit.on('pointerover', () => chevron.setAlpha(1));
  hit.on('pointerout', () => chevron.setAlpha(0.7));
  hit.on('pointerdown', () => chevron.setAlpha(0.5));
  hit.on('pointerup', () => {
    chevron.setAlpha(1);
    onClick();
  });

  container.add([hit, chevron]);
  return { container, hit };
}

/** Лучшее время локации: «—», секунды или «м:сс». */
function formatRunTime(seconds: number): string {
  if (seconds <= 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}с`;
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** «1 240» — разряды через пробел, чтобы числа читались с одного взгляда. */
function formatNumber(value: number): string {
  return Math.max(0, Math.round(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

interface RankStyle {
  accent: number;
  hex: string;
}

/** Цвета рангов: от стали к белому пламени. */
const RANK_STYLES: Record<RankLetter, RankStyle> = {
  B: { accent: 0x94a3b8, hex: '#94a3b8' },
  A: { accent: 0x38bdf8, hex: '#7dd3fc' },
  S: { accent: 0xfbbf24, hex: '#fbbf24' },
  SS: { accent: 0xfb923c, hex: '#fb923c' },
  'SS+': { accent: 0xf87171, hex: '#f87171' },
  SSS: { accent: 0xa78bfa, hex: '#a78bfa' },
  'SSS+': { accent: 0xe2e8f0, hex: '#e2e8f0' },
};

/** Длинный ранг не должен вылезать за медальон: уменьшаем кегль. */
function rankFontSize(letter: string, base: number, step: number): number {
  return Math.max(16, base - (letter.length - 1) * step);
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
  /** Множитель Эха за спуск (улучшение, мастерство и локация): 1 — без бонусов. */
  echoMultiplier: number;
  /** Множитель очков за включённые испытания: 1 — без испытаний. */
  trialMultiplier: number;
  /** Сколько испытаний было включено на старте спуска. */
  trialsCount: number;
  /** Сколько Эха всего накоплено в профиле. */
  echoTotal: number;
  victory: boolean;
  /** Спуск был ежедневным: на итогах показываем отдельную отметку. */
  daily: boolean;
  /** Номер локации, открытой этой победой (если открылась новая). */
  newlyUnlockedLevel: number | null;
  /** Достижения, открытые именно этим спуском. */
  newAchievements: string[];
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
  setTrials: (trials: TrialKey[]) => void;
  selectAppearance: (id: string) => void;
  /** Запускает ежедневный спуск, если попытка ещё не потрачена. */
  startDaily: () => void;
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

  // Сообщение о покупке живёт рядом с кошельком: снизу место заняли карточки.
  const statusText = scene.add.text(1108, 116, '', {
    fontFamily: UI_FONT.body,
    fontSize: '11px',
    fontStyle: 'bold',
    color: '#94a3b8',
  }).setOrigin(1, 0.5);

  const iconByKey: Record<UpgradeKey, 'banner' | 'crystal' | 'flame' | 'bolt' | 'star'> = {
    VITALITY: 'banner',
    MANA_RESERVE: 'crystal',
    BRIGHT_TORCH: 'flame',
    SWIFT_HAND: 'bolt',
    FORTUNE: 'star',
  };

  const cards: UpgradeCardRef[] = UPGRADE_ORDER.map((key, index) => {
    const definition = UPGRADES[key];
    // Пять карточек по 86 px с шагом 94: последняя заканчивается на 594,
    // ниже остаётся место для кнопки «Закрыть».
    const y = 132 + index * 94;
    const iconKind = iconByKey[key];

    const cardContainer = scene.add.container(0, y);
    const cardPanel = createPanel(scene, 220, 0, 840, 86, 0x4b5d77);
    const icon = createIcon(scene, 264, 43, iconKind, 26, UI_COLORS.emberBright);

    const name = scene.add.text(296, 6, definition.name, {
      fontFamily: UI_FONT.display,
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#f0c674',
      letterSpacing: 1,
    });

    const description = scene.add.text(296, 28, definition.description, {
      fontFamily: UI_FONT.body,
      fontSize: '11px',
      color: '#c3cedd',
      lineSpacing: 2,
      wordWrap: { width: 430 },
    });

    const effect = scene.add.text(296, 58, definition.effect, {
      fontFamily: UI_FONT.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#7dd3fc',
    });

    const levelText = scene.add.text(1040, 8, '', {
      fontFamily: UI_FONT.body,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#94a3b8',
      letterSpacing: 1,
    }).setOrigin(1, 0);

    const buyButton = createButton(scene, 960, 50, 170, 34, '', {
      variant: 'primary',
      accent: UI_COLORS.ember,
      accentHex: '#1a1205',
      onClick: () => handleBuy(key),
      fontSize: 11,
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
      const level = profile.upgrades[card.key];
      const cost = getUpgradeCost(card.key, level, profile.unlockedLevels);
      card.levelText.setText(
        `УРОВЕНЬ ${level} / ${getUpgradeMaxLevel(card.key, profile.unlockedLevels)}`
      );

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
    // Данные «до покупки» нужны для события Метрики: какой уровень куплен и за сколько.
    const before = controller.getProfile();
    const cost = getUpgradeCost(key, before.upgrades[key], before.unlockedLevels);
    const result = controller.buyUpgrade(key);
    statusText.setText(result.message);
    statusText.setColor(result.ok ? '#fbbf24' : '#fca5a5');
    if (result.ok) {
      track('upgrade_buy', {
        key,
        level: before.upgrades[key] + 1,
        cost: cost ?? 0,
        echo_left: controller.getProfile().echo,
      });
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
    track('upgrades_opened', { echo: controller.getProfile().echo });
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
// ИСПЫТАНИЯ
// ============================================================================

interface TrialsModal {
  open: () => void;
}

interface TrialToggle {
  container: Phaser.GameObjects.Container;
  setEnabled: (enabled: boolean) => void;
}

interface TrialCardRef {
  key: TrialKey;
  container: Phaser.GameObjects.Container;
  baseY: number;
  toggle: TrialToggle;
}

function createTrialsModal(
  scene: Phaser.Scene,
  screen: Phaser.GameObjects.Container,
  controller: ProfileController,
  onTrialsChanged: () => void
): TrialsModal {
  const { width, height } = scene.scale;
  const modal = scene.add.container(0, 0).setVisible(false).setAlpha(0);

  const backdrop = scene.add
    .rectangle(width / 2, height / 2, width, height, UI_COLORS.void, 0.72)
    .setInteractive();
  modal.add(backdrop);

  const panel = createPanel(scene, 160, 48, 960, 624, UI_COLORS.mana, { glow: true });
  modal.add(panel);

  const title = scene.add.text(640, 94, 'ИСПЫТАНИЯ', {
    fontFamily: UI_FONT.display,
    fontSize: '32px',
    fontStyle: 'bold',
    color: '#f4ecd8',
    letterSpacing: 2,
  }).setOrigin(0.5);

  const divider = createDivider(scene, 640, 128, 520, UI_COLORS.mana);

  // Итоговый множитель живёт в правом верхнем углу, как кошелёк в улучшениях.
  const multiplierText = scene.add.text(1108, 94, '', {
    fontFamily: UI_FONT.body,
    fontSize: '14px',
    fontStyle: 'bold',
    color: '#7dd3fc',
    letterSpacing: 1,
  }).setOrigin(1, 0.5);

  const hintText = scene.add.text(1108, 116, 'действуют на следующий спуск', {
    fontFamily: UI_FONT.body,
    fontSize: '10px',
    color: '#94a3b8',
  }).setOrigin(1, 0.5);

  const iconByKey: Record<TrialKey, 'banner' | 'flame' | 'clock' | 'skull'> = {
    GLASS: 'banner',
    DIM_TORCH: 'flame',
    FAST_DARK: 'clock',
    CROWD: 'skull',
  };

  /**
   * Переключатель испытания. createButton здесь не подходит: при pointerout
   * он возвращает цвет, заданный при создании, и включённая кнопка снова
   * выглядит серой. Поэтому цвет хранится вместе с состоянием.
   */
  const createTrialToggle = (
    x: number,
    y: number,
    onClick: () => void
  ): TrialToggle => {
    const container = scene.add.container(x, y);
    const background = scene.add
      .rectangle(0, 0, 170, 34, 0x1e293b, 0.9)
      .setStrokeStyle(2, 0x64748b, 0.95)
      .setInteractive({ useHandCursor: true });
    const label = scene.add.text(0, 0, 'ВЫКЛЮЧЕНО', {
      fontFamily: UI_FONT.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#94a3b8',
      letterSpacing: 1,
    }).setOrigin(0.5);

    container.add([background, label]);

    let enabled = false;
    let pressed = false;

    const paint = (hover: boolean): void => {
      if (enabled) {
        background.setFillStyle(hover ? 0x7dd3fc : UI_COLORS.mana, 0.96);
        background.setStrokeStyle(2, 0x7dd3fc, 0.95);
        label.setColor('#04121f');
      } else {
        background.setFillStyle(hover ? 0x27364b : 0x1e293b, 0.9);
        background.setStrokeStyle(2, 0x64748b, 0.95);
        label.setColor('#94a3b8');
      }
    };

    background.on('pointerover', () => {
      container.setScale(1.02);
      paint(true);
    });
    background.on('pointerout', () => {
      container.setScale(1);
      pressed = false;
      paint(false);
    });
    background.on('pointerdown', () => {
      pressed = true;
      container.setScale(0.98);
    });
    background.on('pointerup', () => {
      container.setScale(1.02);
      if (!pressed) return;
      pressed = false;
      onClick();
    });

    return {
      container,
      setEnabled: (value: boolean) => {
        enabled = value;
        label.setText(value ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО');
        paint(false);
      },
    };
  };

  const cards: TrialCardRef[] = TRIAL_ORDER.map((key, index) => {
    const definition = TRIALS[key];
    const y = 132 + index * 94;
    const iconKind = iconByKey[key];

    const cardContainer = scene.add.container(0, y);
    const cardPanel = createPanel(scene, 220, 0, 840, 86, 0x4b5d77);
    const icon = createIcon(scene, 264, 43, iconKind, 26, UI_COLORS.mana);

    const name = scene.add.text(296, 6, definition.name, {
      fontFamily: UI_FONT.display,
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#7dd3fc',
      letterSpacing: 1,
    });

    const description = scene.add.text(296, 28, definition.description, {
      fontFamily: UI_FONT.body,
      fontSize: '11px',
      color: '#c3cedd',
      lineSpacing: 2,
      wordWrap: { width: 430 },
    });

    const effect = scene.add.text(296, 58, definition.effect, {
      fontFamily: UI_FONT.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#f0c674',
    });

    const multiplier = scene.add.text(1040, 8, `×${definition.multiplier.toFixed(2)}`, {
      fontFamily: UI_FONT.body,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#94a3b8',
      letterSpacing: 1,
    }).setOrigin(1, 0);

    const toggle = createTrialToggle(960, 50, () => handleToggle(key));

    cardContainer.add([
      cardPanel,
      icon,
      name,
      description,
      effect,
      multiplier,
      toggle.container,
    ]);
    modal.add(cardContainer);

    return { key, container: cardContainer, baseY: y, toggle };
  });

  const refresh = (): void => {
    const active = new Set(controller.getProfile().activeTrials);
    multiplierText.setText(`МНОЖИТЕЛЬ ×${getTrialMultiplier(active).toFixed(2)}`);

    for (const card of cards) {
      const enabled = active.has(card.key);
      card.toggle.setEnabled(enabled);
      card.container.setAlpha(enabled ? 1 : 0.82);
    }
  };

  function handleToggle(key: TrialKey): void {
    const active = new Set(controller.getProfile().activeTrials);
    if (active.has(key)) {
      active.delete(key);
    } else {
      active.add(key);
    }

    // Порядок фиксирован, чтобы профиль не зависел от кликов.
    const next = TRIAL_ORDER.filter((trial) => active.has(trial));
    controller.setTrials(next);
    track('trials_changed', {
      trials: next.join(','),
      multiplier: Number(getTrialMultiplier(next).toFixed(2)),
    });
    refresh();
    onTrialsChanged();
  }

  const closeButton = createButton(scene, 640, 626, 220, 46, 'ЗАКРЫТЬ', {
    variant: 'secondary',
    onClick: () => close(),
    fontSize: 13,
  });

  modal.add([title, divider, multiplierText, hintText, closeButton.container]);
  screen.add(modal);

  const open = (): void => {
    refresh();
    modal.setVisible(true);
    modal.setAlpha(0);
    scene.tweens.add({
      targets: modal,
      alpha: 1,
      duration: 220,
      ease: 'Quad.easeOut',
    });

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
// КНИГА СТРАЖА
// Четыре вкладки: достижения, бестиарий, мастерство и облик. Книга только
// читает профиль; единственное изменение — выбор облика (косметика).
// ============================================================================

type BookTab = 'ACHIEVEMENTS' | 'BESTIARY' | 'MASTERY' | 'LOOK';

interface GuardBookModal {
  open: () => void;
}

function createGuardBookModal(
  scene: Phaser.Scene,
  screen: Phaser.GameObjects.Container,
  controller: ProfileController
): GuardBookModal {
  const { width, height } = scene.scale;
  const modal = scene.add.container(0, 0).setVisible(false).setAlpha(0);

  const backdrop = scene.add
    .rectangle(width / 2, height / 2, width, height, UI_COLORS.void, 0.72)
    .setInteractive();
  modal.add(backdrop);

  const panel = createPanel(scene, 160, 48, 960, 624, UI_COLORS.brass, { glow: true });
  const title = scene.add.text(640, 88, 'КНИГА СТРАЖА', {
    fontFamily: UI_FONT.display,
    fontSize: '30px',
    fontStyle: 'bold',
    color: '#f4ecd8',
    letterSpacing: 2,
  }).setOrigin(0.5);

  const subtitle = scene.add.text(640, 116, 'ДОСТИЖЕНИЯ · БЕСТИАРИЙ · МАСТЕРСТВО · ОБЛИК', {
    fontFamily: UI_FONT.body,
    fontSize: '9px',
    fontStyle: 'bold',
    color: '#7c8ba1',
    letterSpacing: 2,
  }).setOrigin(0.5);

  const divider = createDivider(scene, 640, 136, 520, UI_COLORS.brass);

  // Арт врагов создаётся с бесконечными твинами. В книге они не нужны:
  // без остановки твины копились бы при каждом пересоздании лагеря.
  const freezeVisual = (object: Phaser.GameObjects.GameObject): void => {
    scene.tweens.killTweensOf(object);
    if (object instanceof Phaser.GameObjects.Container) {
      for (const child of object.list) {
        freezeVisual(child as Phaser.GameObjects.GameObject);
      }
    }
  };

  const tabDefs: { id: BookTab; label: string }[] = [
    { id: 'ACHIEVEMENTS', label: 'ДОСТИЖЕНИЯ' },
    { id: 'BESTIARY', label: 'БЕСТИАРИЙ' },
    { id: 'MASTERY', label: 'МАСТЕРСТВО' },
    { id: 'LOOK', label: 'ОБЛИК' },
  ];

  const tabButtons = tabDefs.map(({ id, label }, index) => {
    const container = scene.add.container(322 + index * 212, 160);
    const bg = scene.add
      .rectangle(0, 0, 200, 32, 0x0f1626, 0.95)
      .setStrokeStyle(2, UI_COLORS.brass, 0.8)
      .setInteractive({ useHandCursor: true });
    const text = scene.add.text(0, 0, label, {
      fontFamily: UI_FONT.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#f0c674',
      letterSpacing: 1,
    }).setOrigin(0.5);

    bg.on('pointerdown', () => setTab(id));
    container.add([bg, text]);
    return { id, container, bg, text };
  });

  // ---------------------------------------------------------------- ДОСТИЖЕНИЯ
  const achievementsContent = scene.add.container(0, 0);
  const achievementsHeader = scene.add.text(206, 182, '', {
    fontFamily: UI_FONT.body,
    fontSize: '10px',
    fontStyle: 'bold',
    color: '#f0c674',
    letterSpacing: 1,
  });
  const achievementsHint = scene.add.text(1074, 182, '', {
    fontFamily: UI_FONT.body,
    fontSize: '9px',
    color: '#7c8ba1',
  }).setOrigin(1, 0);

  const achievementCards = ACHIEVEMENTS.map((definition, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const card = scene.add.container(350 + column * 290, 198 + row * 80);
    const cardPanel = createPanel(scene, -140, 0, 280, 74, 0x4b5d77, { alpha: 0.95 });
    const diamond = scene.add.rectangle(-116, 24, 10, 10, UI_COLORS.panelLine, 0.6).setAngle(45);
    const name = scene.add.text(-96, 12, definition.name, {
      fontFamily: UI_FONT.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#7c8ba1',
      letterSpacing: 1,
    });
    const description = scene.add.text(-96, 32, definition.description, {
      fontFamily: UI_FONT.body,
      fontSize: '9px',
      color: '#64748b',
      wordWrap: { width: 214 },
    });
    const status = scene.add.text(124, 12, '', {
      fontFamily: UI_FONT.body,
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#64748b',
    }).setOrigin(1, 0);

    card.add([cardPanel, diamond, name, description, status]);
    achievementsContent.add(card);
    return { definition, card, cardPanel, diamond, name, description, status };
  });

  const refreshAchievements = (): void => {
    const profile = controller.getProfile();
    const unlocked = new Set(profile.achievements);
    const count = countUnlocked(profile);
    achievementsHeader.setText(`ОТКРЫТО ${count} / ${ACHIEVEMENTS.length}`);
    const next = getNextPalette(count);
    achievementsHint.setText(
      next
        ? `СЛЕДУЮЩИЙ ОБЛИК: «${next.palette.name}» · ЕЩЁ ${next.remaining}`
        : 'ВСЕ ОБЛИКИ ОТКРЫТЫ'
    );

    for (const card of achievementCards) {
      const done = unlocked.has(card.definition.id);
      card.card.setAlpha(done ? 1 : 0.6);
      card.name.setColor(done ? '#f0c674' : '#7c8ba1');
      card.description.setColor(done ? '#c3cedd' : '#64748b');
      card.diamond.setFillStyle(
        done ? UI_COLORS.brassBright : UI_COLORS.panelLine,
        done ? 1 : 0.6
      );
      card.status.setText(done ? 'ОТКРЫТО' : 'ЗАКРЫТО');
      card.status.setColor(done ? '#f0c674' : '#64748b');
    }
  };

  // ----------------------------------------------------------------- БЕСТИАРИЙ
  const bestiaryContent = scene.add.container(0, 0);
  const bestiaryHeader = scene.add.text(206, 182, '', {
    fontFamily: UI_FONT.body,
    fontSize: '10px',
    fontStyle: 'bold',
    color: '#f0c674',
    letterSpacing: 1,
  });
  const bestiaryHint = scene.add.text(1074, 182, 'УБЕЙТЕ ВРАГА, ЧТОБЫ ЗАПИСАТЬ ЕГО', {
    fontFamily: UI_FONT.body,
    fontSize: '9px',
    color: '#7c8ba1',
  }).setOrigin(1, 0);

  const bestiaryCards = BESTIARY_ENTRIES.map((entry, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const card = scene.add.container(317 + column * 215, 198 + row * 100);
    const cardPanel = createPanel(scene, -102, 0, 204, 92, 0x4b5d77, { alpha: 0.95 });
    const artHolder = scene.add.container(0, 30);

    const isBoss = entry.kind === 'boss';
    const radius = isBoss
      ? BOSS_CONFIG[entry.key as BossTypeKey].radius
      : GAME_CONFIG.ENEMIES[entry.key as EnemyTypeKey].radius;
    const visual = isBoss
      ? createBossVisual(
          scene,
          entry.key as BossTypeKey,
          BOSS_CONFIG[entry.key as BossTypeKey],
          0,
          0
        )
      : createEnemyVisual(
          scene,
          entry.key as EnemyTypeKey,
          GAME_CONFIG.ENEMIES[entry.key as EnemyTypeKey],
          0,
          0
        );
    visual.container.setScale(Math.min(1.6, 24 / radius));
    freezeVisual(visual.container);
    // Полоски здоровья живут отдельно от контейнера и в книге не нужны.
    visual.hpBar?.destroy();
    visual.hpBarBack?.destroy();
    artHolder.add(visual.container);

    const name = scene.add.text(0, 58, entry.name, {
      fontFamily: UI_FONT.body,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#7c8ba1',
      letterSpacing: 0.5,
    }).setOrigin(0.5);
    const role = scene.add.text(0, 73, entry.role, {
      fontFamily: UI_FONT.body,
      fontSize: '8px',
      color: '#64748b',
    }).setOrigin(0.5);
    const count = scene.add.text(94, 8, '', {
      fontFamily: UI_FONT.mono,
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#f0c674',
    }).setOrigin(1, 0);

    card.add([cardPanel, artHolder, name, role, count]);
    bestiaryContent.add(card);
    return { entry, card, cardPanel, artHolder, name, role, count };
  });

  const refreshBestiary = (): void => {
    const profile = controller.getProfile();
    const discovered = countDiscovered(profile.bestiary);
    bestiaryHeader.setText(`ОТКРЫТО ${discovered} / ${BESTIARY_ENTRIES.length}`);

    for (const card of bestiaryCards) {
      const kills = profile.bestiary[card.entry.key] ?? 0;
      const seen = kills > 0;
      card.artHolder.setAlpha(seen ? 1 : 0.14);
      card.name.setText(seen ? card.entry.name : '???');
      card.name.setColor(seen ? '#e8eef7' : '#64748b');
      card.role.setText(seen ? card.entry.role : 'НЕ ВСТРЕЧЕН');
      card.role.setColor(seen ? '#7c8ba1' : '#475569');
      card.count.setText(seen ? `×${kills}` : '');
      card.cardPanel.setAlpha(seen ? 1 : 0.7);
    }
  };

  // ---------------------------------------------------------------- МАСТЕРСТВО
  const masteryContent = scene.add.container(0, 0);
  const masteryHeader = scene.add.text(
    206,
    182,
    'ПОБЕДЫ В ЛОКАЦИИ ОТКРЫВАЮТ ЕЁ ПЕРКИ',
    {
      fontFamily: UI_FONT.body,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#f0c674',
      letterSpacing: 1,
    }
  );

  const masteryRows = LEVELS.map((level, index) => {
    const card = scene.add.container(0, 200 + index * 126);
    const cardPanel = createPanel(scene, 210, 0, 860, 114, 0x4b5d77, { alpha: 0.95 });
    const name = scene.add.text(
      230,
      14,
      `ЛОКАЦИЯ ${FLOOR_ROMAN[index] ?? index + 1} · ${level.name.toUpperCase()}`,
      {
        fontFamily: UI_FONT.display,
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#f0c674',
        letterSpacing: 1,
      }
    );
    const wins = scene.add.text(1050, 18, '', {
      fontFamily: UI_FONT.mono,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#c3cedd',
    }).setOrigin(1, 0);

    // Панель кладём первой, иначе она закроет чипы ступеней.
    card.add([cardPanel, name, wins]);

    const steps = MASTERY_STEPS.map((step, stepIndex) => {
      const chip = scene.add.container(230 + stepIndex * 284, 74);
      const bg = scene.add
        .rectangle(0, 0, 272, 60, 0x0f1626, 0.92)
        .setStrokeStyle(1, UI_COLORS.panelLine, 0.8);
      const stepTitle = scene.add.text(10, 8, step.title, {
        fontFamily: UI_FONT.body,
        fontSize: '9px',
        fontStyle: 'bold',
        color: '#7c8ba1',
        letterSpacing: 1,
      });
      const effect = scene.add.text(10, 24, step.effect, {
        fontFamily: UI_FONT.body,
        fontSize: '8px',
        color: '#64748b',
        wordWrap: { width: 198 },
      });
      const progress = scene.add.text(126, 8, '', {
        fontFamily: UI_FONT.mono,
        fontSize: '9px',
        fontStyle: 'bold',
        color: '#64748b',
      }).setOrigin(1, 0);

      chip.add([bg, stepTitle, effect, progress]);
      card.add(chip);
      return { step, bg, stepTitle, effect, progress };
    });

    masteryContent.add(card);
    return { level, card, name, wins, steps };
  });

  const refreshMastery = (): void => {
    const profile = controller.getProfile();
    masteryRows.forEach((row, index) => {
      const victories = profile.levelStats[index]?.victories ?? 0;
      const mastery = getMastery(victories);
      row.wins.setText(`ПОБЕД: ${victories} · СТУПЕНЬ ${mastery.tier}/3`);
      row.wins.setColor(mastery.tier > 0 ? '#f0c674' : '#7c8ba1');

      for (const step of row.steps) {
        const done = victories >= step.step.threshold;
        step.stepTitle.setColor(done ? '#f0c674' : '#7c8ba1');
        step.effect.setColor(done ? '#c3cedd' : '#64748b');
        step.bg.setFillStyle(done ? 0x1a2438 : 0x0f1626, done ? 0.95 : 0.92);
        step.bg.setStrokeStyle(1, done ? UI_COLORS.brass : UI_COLORS.panelLine, done ? 0.9 : 0.6);
        step.progress.setText(
          done ? 'ОТКРЫТО' : `${Math.min(victories, step.step.threshold)} / ${step.step.threshold}`
        );
        step.progress.setColor(done ? '#f0c674' : '#64748b');
      }
    });
  };

  // -------------------------------------------------------------------- ОБЛИК
  const lookContent = scene.add.container(0, 0);
  const previewPanel = createPanel(scene, 210, 198, 360, 390, UI_COLORS.brass, { glow: true });
  const previewTitle = scene.add.text(390, 218, 'ПРЕДПРОСМОТР', {
    fontFamily: UI_FONT.body,
    fontSize: '9px',
    fontStyle: 'bold',
    color: '#7c8ba1',
    letterSpacing: 2,
  }).setOrigin(0.5);

  const previewHolder = scene.add.container(390, 382);
  const previewVisual = createPlayer(scene, 0, 0, getPalette(controller.getProfile().appearance), {
    animate: false,
  });
  previewVisual.shadow.destroy();
  previewVisual.container.setScale(3.2).setRotation(-0.18);
  previewHolder.add(previewVisual.container);

  const previewName = scene.add.text(390, 520, '', {
    fontFamily: UI_FONT.display,
    fontSize: '18px',
    fontStyle: 'bold',
    color: '#f0c674',
    letterSpacing: 2,
  }).setOrigin(0.5);
  const previewHint = scene.add.text(390, 546, '', {
    fontFamily: UI_FONT.body,
    fontSize: '9px',
    color: '#7c8ba1',
  }).setOrigin(0.5);

  const paletteCards = PALETTES.map((palette, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const card = scene.add.container(705 + column * 242, 198 + row * 126);
    const cardPanel = createPanel(scene, -115, 0, 230, 114, 0x4b5d77, { alpha: 0.95 });
    const hit = scene.add
      .rectangle(0, 57, 222, 106, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    const name = scene.add.text(-100, 12, palette.name, {
      fontFamily: UI_FONT.display,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#c3cedd',
      letterSpacing: 1,
    });
    const swatches = [palette.cloak, palette.armor, palette.metal, palette.glow].map(
      (color, swatchIndex) =>
        scene.add
          .circle(-88 + swatchIndex * 26, 48, 9, color)
          .setStrokeStyle(1.5, 0x0f172a)
    );
    const requirement = scene.add.text(-100, 70, '', {
      fontFamily: UI_FONT.body,
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#64748b',
    });
    const state = scene.add.text(100, 12, '', {
      fontFamily: UI_FONT.body,
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#f0c674',
    }).setOrigin(1, 0);

    hit.on('pointerdown', () => {
      const profile = controller.getProfile();
      if (!isPaletteUnlocked(palette, countUnlocked(profile))) return;
      controller.selectAppearance(palette.id);
      refreshLook();
    });

    card.add([cardPanel, hit, name, ...swatches, requirement, state]);
    lookContent.add(card);
    return { palette, card, cardPanel, hit, name, requirement, state };
  });

  // Скрытые вкладки не должны перехватывать клики: Phaser проверяет
  // видимость только у самого объекта, а не у родительского контейнера.
  const setPaletteInputEnabled = (enabled: boolean): void => {
    for (const card of paletteCards) {
      if (enabled) card.hit.setInteractive({ useHandCursor: true });
      else card.hit.disableInteractive();
    }
  };

  const refreshLook = (): void => {
    const profile = controller.getProfile();
    const count = countUnlocked(profile);
    const selected = getPalette(profile.appearance);
    applyPlayerPalette(previewVisual, selected);
    previewName.setText(selected.name);

    const next = getNextPalette(count);
    previewHint.setText(
      next
        ? `ОТКРЫТО ${count} ДОСТИЖЕНИЙ · ДО «${next.palette.name}»: ${next.remaining}`
        : `ОТКРЫТО ${count} ДОСТИЖЕНИЙ · ВСЕ ОБЛИКИ`
    );

    for (const card of paletteCards) {
      const unlocked = isPaletteUnlocked(card.palette, count);
      const isSelected = card.palette.id === profile.appearance;
      card.card.setAlpha(unlocked ? 1 : 0.5);
      card.name.setColor(isSelected ? '#f0c674' : unlocked ? '#e8eef7' : '#7c8ba1');
      card.state.setText(isSelected ? '●' : '');
      if (unlocked) {
        card.requirement.setText(isSelected ? 'ВЫБРАН' : 'ОТКРЫТ');
        card.requirement.setColor(isSelected ? '#f0c674' : '#94a3b8');
      } else {
        card.requirement.setText(`${card.palette.threshold} ДОСТИЖЕНИЙ`);
        card.requirement.setColor('#64748b');
      }
    }
  };

  // ------------------------------------------------------------ ПЕРЕКЛЮЧЕНИЕ
  const contentByTab: Record<BookTab, Phaser.GameObjects.Container> = {
    ACHIEVEMENTS: achievementsContent,
    BESTIARY: bestiaryContent,
    MASTERY: masteryContent,
    LOOK: lookContent,
  };

  function setTab(tab: BookTab): void {
    for (const button of tabButtons) {
      const active = button.id === tab;
      button.bg.setFillStyle(active ? UI_COLORS.ember : 0x0f1626, active ? 0.96 : 0.92);
      button.bg.setStrokeStyle(
        2,
        active ? UI_COLORS.emberBright : UI_COLORS.brass,
        active ? 1 : 0.8
      );
      button.text.setColor(active ? '#1a1205' : '#f0c674');
    }
    for (const [id, content] of Object.entries(contentByTab) as [
      BookTab,
      Phaser.GameObjects.Container,
    ][]) {
      content.setVisible(id === tab);
    }

    // Скрытые карточки обликов не должны ловить клики за пределами книги.
    setPaletteInputEnabled(tab === 'LOOK');
  }

  achievementsContent.add([achievementsHeader, achievementsHint]);
  bestiaryContent.add([bestiaryHeader, bestiaryHint]);
  masteryContent.add(masteryHeader);
  lookContent.add([previewPanel, previewTitle, previewHolder, previewName, previewHint]);

  // До первого открытия книга скрыта, но её карточки обликов интерактивны.
  // Сразу выбираем вкладку, чтобы они не перехватывали клики по лагерю.
  setTab('ACHIEVEMENTS');

  const closeButton = createButton(scene, 640, 618, 220, 42, 'ЗАКРЫТЬ', {
    variant: 'secondary',
    onClick: () => close(),
    fontSize: 13,
  });

  modal.add([
    panel,
    title,
    subtitle,
    divider,
    ...tabButtons.map((button) => button.container),
    achievementsContent,
    bestiaryContent,
    masteryContent,
    lookContent,
    closeButton.container,
  ]);
  screen.add(modal);

  const open = (): void => {
    refreshAchievements();
    refreshBestiary();
    refreshMastery();
    refreshLook();
    setTab('ACHIEVEMENTS');
    // Книга создаётся раньше кнопок лагеря: поднимаем её поверх всей сцены.
    screen.bringToTop(modal);
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
    // Карточки обликов лежат глубже контейнера книги и остаются
    // интерактивными, даже когда книга скрыта.
    setPaletteInputEnabled(false);
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
          // Экран мог уйти, пока твин доходил: текст уже уничтожен.
          if (!sloganText.active) return;
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

  // Локация: сегментная полоска во всю ширину колонки. Стрелки — сегменты
  // по краям, между ними подпись выбранной локации.
  let selectedLevel = Phaser.Math.Clamp(levelSelect.index, 0, Math.max(0, levelSelect.levels.length - 1));

  const levelStrip = scene.add.container(menuX, 196);
  const levelStripBg = scene.add
    .rectangle(0, 0, 320, 30, 0x0f1626, 0.96)
    .setStrokeStyle(2, UI_COLORS.brass, 0.95);
  const levelStripHighlight = scene.add.rectangle(0, -13, 314, 2, 0xffffff, 0.08);
  const levelStripSideLeft = scene.add.rectangle(-120, 0, 1, 22, UI_COLORS.brass, 0.35);
  const levelStripSideRight = scene.add.rectangle(120, 0, 1, 22, UI_COLORS.brass, 0.35);

  const levelLabel = scene.add.text(0, 0, '', {
    fontFamily: UI_FONT.body,
    fontSize: '10px',
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
    refreshStats();
  };

  const levelPrev = createLevelArrow(scene, -1, () => cycleLevel(-1));
  const levelNext = createLevelArrow(scene, 1, () => cycleLevel(1));

  // Ховер по стрелкам подсвечивает всю полоску, как у обычных кнопок.
  for (const arrow of [levelPrev, levelNext]) {
    arrow.hit.on('pointerover', () => levelStripBg.setFillStyle(0x16203a, 0.98));
    arrow.hit.on('pointerout', () => levelStripBg.setFillStyle(0x0f1626, 0.96));
  }

  levelStrip.add([
    levelStripBg,
    levelStripHighlight,
    levelStripSideLeft,
    levelStripSideRight,
    levelLabel,
    levelPrev.container,
    levelNext.container,
  ]);

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

  const book = createGuardBookModal(scene, screen, profileController);

  const helpButton = createButton(scene, menuX - 110, 462, 100, 50, 'ПАМЯТКА', {
    variant: 'ghost',
    accent: UI_COLORS.brass,
    accentHex: '#f0c674',
    onClick: () => help.open(),
    fontSize: 10,
  });

  const bookButton = createButton(scene, menuX, 462, 100, 50, 'КНИГА', {
    variant: 'ghost',
    accent: UI_COLORS.brass,
    accentHex: '#f0c674',
    onClick: () => book.open(),
    fontSize: 10,
  });

  const trialsButton = createButton(scene, menuX + 110, 462, 100, 50, 'ИСПЫТАНИЯ', {
    variant: 'ghost',
    accent: UI_COLORS.brass,
    accentHex: '#f0c674',
    onClick: () => trials.open(),
    fontSize: 9,
  });

  /** Кнопка показывает, сколько испытаний включено прямо сейчас. */
  const refreshTrialsButton = (): void => {
    const count = profileController.getProfile().activeTrials.length;
    trialsButton.label.setText(count > 0 ? `ИСПЫТАНИЯ · ${count}` : 'ИСПЫТАНИЯ');
    trialsButton.label.setColor(count > 0 ? '#7dd3fc' : '#f0c674');
  };

  // --------------------------------------------------------- СПУСК ДНЯ
  // Слева под лором: ежедневная попытка с готовым набором испытаний.
  const dailyProfile = profileController.getProfile();
  const dailyKey = getDailyKey();
  const dailyRun = getDailyRun(dailyKey, dailyProfile.unlockedLevels);
  const dailyUsed = dailyProfile.daily.key === dailyKey && dailyProfile.daily.used;
  const dailyRoman = FLOOR_ROMAN[dailyRun.levelIndex] ?? `${dailyRun.levelIndex + 1}`;
  const dailyLevelName = LEVELS[dailyRun.levelIndex]?.name ?? '';
  const dailyTrialNames = dailyRun.trials.map((key) => TRIALS[key].name).join(' · ');

  const dailyPanel = createPanel(scene, 70, 308, 460, 128, UI_COLORS.mana, {
    alpha: 0.96,
  });

  const dailyHeader = scene.add.text(
    86,
    324,
    `СПУСК ДНЯ · ${formatDailyKey(dailyKey)}`,
    {
      fontFamily: UI_FONT.body,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#7dd3fc',
      letterSpacing: 1.5,
    }
  ).setOrigin(0, 0.5);

  const dailyReward = scene.add.text(
    514,
    324,
    `ЭХО ×${DAILY_ECHO_BONUS.toFixed(1)}`,
    {
      fontFamily: UI_FONT.mono,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#7dd3fc',
    }
  ).setOrigin(1, 0.5);

  const dailyLocation = scene.add.text(
    86,
    344,
    `ЛОКАЦИЯ ${dailyRoman} · ${dailyLevelName.toUpperCase()}`,
    {
      fontFamily: UI_FONT.body,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#f0c674',
      letterSpacing: 1,
    }
  ).setOrigin(0, 0.5);

  const dailyTrials = scene.add.text(86, 364, `ИСПЫТАНИЯ · ${dailyTrialNames}`, {
    fontFamily: UI_FONT.body,
    fontSize: '9px',
    color: '#c3cedd',
    letterSpacing: 0.5,
  }).setOrigin(0, 0.5);

  const dailyStatus = scene.add.text(
    86,
    382,
    dailyUsed
      ? dailyProfile.daily.bestRank
        ? `ИСПОЛЬЗОВАНА · ЛУЧШИЙ РЕЗУЛЬТАТ ${dailyProfile.daily.bestRank} · ${formatNumber(dailyProfile.daily.bestScore)}`
        : 'ПОПЫТКА ИСПОЛЬЗОВАНА'
      : 'ОДНА ПОПЫТКА В ДЕНЬ',
    {
      fontFamily: UI_FONT.body,
      fontSize: '9px',
      fontStyle: 'bold',
      color: dailyUsed ? '#8b9bb0' : '#7dd3fc',
      letterSpacing: 0.5,
    }
  ).setOrigin(0, 0.5);

  const dailyButton = createButton(scene, 446, 408, 148, 34, dailyUsed ? 'ЗАВТРА' : 'НАЧАТЬ', {
    variant: dailyUsed ? 'ghost' : 'primary',
    accent: UI_COLORS.mana,
    accentHex: '#e0f2fe',
    onClick: () => profileController.startDaily(),
    fontSize: 11,
  });
  if (dailyUsed) {
    dailyButton.background.disableInteractive();
    dailyButton.container.setAlpha(0.45);
  }

  // ------------------------------------------------ ХРОНИКА В ПРАВОЙ КОЛОНКЕ
  // Сверху Эхо, отдельный блок ранга, построчные рекорды и полоса мастерства.
  const statsPanel = createPanel(scene, 840, 492, 320, 200, UI_COLORS.brass, {
    alpha: 0.96,
  });

  const statsHeader = scene.add.text(856, 506, 'ХРОНИКА · ЛОКАЦИЯ I', {
    fontFamily: UI_FONT.body,
    fontSize: '9px',
    fontStyle: 'bold',
    color: '#7c8ba1',
    letterSpacing: 1.5,
  }).setOrigin(0, 0.5);

  const echoIcon = createIcon(scene, 1090, 506, 'crystal', 12, UI_COLORS.mana);
  const echoValue = scene.add.text(1144, 506, '0', {
    fontFamily: UI_FONT.mono,
    fontSize: '12px',
    fontStyle: 'bold',
    color: '#f0c674',
  }).setOrigin(1, 0.5);

  const statsDividerTop = createDivider(scene, 1000, 518, 288, UI_COLORS.brass);

  const rankMedallion = createMedallion(scene, 872, 542, 16, UI_COLORS.brass);
  const rankLetter = scene.add.text(894, 542, '—', {
    fontFamily: UI_FONT.display,
    fontSize: '32px',
    fontStyle: 'bold',
    color: '#64748b',
  }).setOrigin(0, 0.5);
  const rankCaption = scene.add.text(1144, 530, 'ЛУЧШИЙ РАНГ', {
    fontFamily: UI_FONT.body,
    fontSize: '8px',
    fontStyle: 'bold',
    color: '#7c8ba1',
    letterSpacing: 1.5,
  }).setOrigin(1, 0.5);
  const rankTitle = scene.add.text(894, 562, 'ПОКА НЕТ', {
    fontFamily: UI_FONT.body,
    fontSize: '9px',
    fontStyle: 'bold',
    color: '#64748b',
    letterSpacing: 1,
  }).setOrigin(0, 0.5);

  const statsDividerRank = createDivider(scene, 1000, 570, 288, UI_COLORS.brass);

  const statDefs = [
    { caption: 'ЛУЧШИЙ СЧЁТ', y: 584 },
    { caption: 'ЛУЧШЕЕ ВРЕМЯ', y: 602 },
    { caption: 'СПУСКИ', y: 620 },
    { caption: 'ПОБЕДЫ', y: 638 },
  ] as const;

  const statRows = statDefs.map(({ caption, y }) => {
    const label = scene.add.text(856, y, caption, {
      fontFamily: UI_FONT.body,
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#7c8ba1',
      letterSpacing: 1.5,
    }).setOrigin(0, 0.5);
    const value = scene.add.text(1144, y, '—', {
      fontFamily: UI_FONT.mono,
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#e8eef7',
    }).setOrigin(1, 0.5);
    return { label, value };
  });

  const statsDividerBottom = createDivider(scene, 1000, 648, 288, UI_COLORS.brass);

  const masteryLabel = scene.add.text(856, 660, 'МАСТЕРСТВО', {
    fontFamily: UI_FONT.body,
    fontSize: '9px',
    fontStyle: 'bold',
    color: '#7c8ba1',
    letterSpacing: 1.5,
  }).setOrigin(0, 0.5);

  const masteryDiamonds = MASTERY_STEPS.map((_, index) =>
    scene.add.rectangle(1010 + index * 16, 660, 7, 7, UI_COLORS.panelLine, 0.6).setAngle(45)
  );

  const masteryValue = scene.add.text(1144, 660, '0/3', {
    fontFamily: UI_FONT.mono,
    fontSize: '11px',
    fontStyle: 'bold',
    color: '#f0c674',
  }).setOrigin(1, 0.5);

  const masteryHint = scene.add.text(856, 676, '', {
    fontFamily: UI_FONT.body,
    fontSize: '9px',
    color: '#7c8ba1',
  }).setOrigin(0, 0.5);

  const refreshStats = (): void => {
    const profile = profileController.getProfile();
    const levelStats = profile.levelStats[selectedLevel] ?? profile.levelStats[0];
    const roman = FLOOR_ROMAN[selectedLevel] ?? `${selectedLevel + 1}`;
    const mastery = getMastery(levelStats.victories);

    statsHeader.setText(`ХРОНИКА · ЛОКАЦИЯ ${roman}`);
    echoValue.setText(formatNumber(profile.echo));

    // Рекорд выбранной локации: цвет и кегль зависят от длины ранга.
    const style = levelStats.bestRank ? RANK_STYLES[levelStats.bestRank] : null;
    const rankText = levelStats.bestRank ?? '—';
    rankLetter.setText(rankText);
    rankLetter.setFontSize(rankFontSize(rankText, 32, 3));
    rankLetter.setColor(style?.hex ?? '#64748b');
    rankTitle.setText(levelStats.bestRank ? RANK_TITLES[levelStats.bestRank] : 'ПОКА НЕТ');
    rankTitle.setColor(style?.hex ?? '#64748b');

    statRows[0].value.setText(formatNumber(levelStats.bestScore));
    statRows[1].value.setText(formatRunTime(levelStats.bestTime));
    statRows[2].value.setText(`${levelStats.runs}`);
    statRows[3].value.setText(`${levelStats.victories}`);

    masteryDiamonds.forEach((diamond, index) => {
      const filled = index < mastery.tier;
      diamond.setFillStyle(
        filled ? UI_COLORS.brassBright : UI_COLORS.panelLine,
        filled ? 1 : 0.6
      );
    });
    masteryValue.setText(`${mastery.tier}/${MASTERY_STEPS.length}`);
    if (mastery.victoriesToNext === null) {
      masteryHint.setText('ВСЕ СТУПЕНИ ОТКРЫТЫ');
    } else {
      const nextStep =
        MASTERY_STEPS[Math.min(mastery.tier, MASTERY_STEPS.length - 1)];
      masteryHint.setText(`«${nextStep.title}» · ещё ${mastery.victoriesToNext}`);
    }
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
    levelStrip,
    startButton.container,
    upgradesButton.container,
    settingsButton.container,
    helpButton.container,
    bookButton.container,
    trialsButton.container,
    dailyPanel,
    dailyHeader,
    dailyReward,
    dailyLocation,
    dailyTrials,
    dailyStatus,
    dailyButton.container,
    statsPanel,
    statsHeader,
    echoIcon,
    echoValue,
    statsDividerTop,
    rankMedallion,
    rankLetter,
    rankCaption,
    rankTitle,
    statsDividerRank,
    ...statRows.flatMap((row) => [row.label, row.value]),
    statsDividerBottom,
    masteryLabel,
    ...masteryDiamonds,
    masteryValue,
    masteryHint,
  ]);

  const help = createHelpModal(scene, screen);
  const settingsModal = createSettingsModal(scene, screen, settingsController);
  const upgradesModal = createUpgradesModal(scene, screen, profileController, refreshStats);
  const trials = createTrialsModal(scene, screen, profileController, refreshTrialsButton);
  refreshTrialsButton();

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
  y: number
): Phaser.GameObjects.Container {
  const group = scene.add.container(0, y);
  const style = RANK_STYLES[rank.letter];

  const rays = scene.add.graphics();
  rays.lineStyle(2, style.accent, 0.22);
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

  const medallion = createMedallion(scene, 0, 0, 62, style.accent);
  group.add(medallion);

  const letter = scene.add.text(0, 2, rank.letter, {
    fontFamily: UI_FONT.display,
    fontSize: `${rankFontSize(rank.letter, 56, 8)}px`,
    fontStyle: 'bold',
    color: style.hex,
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

  const panel = createPanel(scene, -420, -325, 840, 650, options.accent, { glow: true });
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
  const rankStyle = RANK_STYLES[rank.letter];
  const rankBlock = createRankBlock(scene, rank, -116);

  const rankTitle = scene.add.text(0, -36, rank.title, {
    fontFamily: UI_FONT.body,
    fontSize: '12px',
    fontStyle: 'bold',
    color: rankStyle.hex,
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
    140,
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

  const echoPrefix = stats.daily ? 'СПУСК ДНЯ · ' : '';
  const echoText = scene.add.text(
    0,
    162,
    stats.echoMultiplier > 1
      ? `${echoPrefix}+${stats.echoGained} ЭХА · ×${stats.echoMultiplier.toFixed(2)} · ВСЕГО ${stats.echoTotal}`
      : `${echoPrefix}+${stats.echoGained} ЭХА · ВСЕГО ${stats.echoTotal}`,
    {
      fontFamily: UI_FONT.body,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#f0c674',
      letterSpacing: 2,
    }
  ).setOrigin(0.5);

  // Победа подсказывает следующий ранг; смерть показывает только множитель.
  const nextRank =
    stats.victory && stats.trialsCount < VICTORY_RANKS.length - 1
      ? VICTORY_RANKS[stats.trialsCount + 1] ?? null
      : null;
  const trialLine = stats.victory
    ? nextRank !== null
      ? stats.trialsCount > 0
        ? `ИСПЫТАНИЯ ×${stats.trialMultiplier.toFixed(2)} · ДО ${nextRank}: +1 ИСПЫТАНИЕ`
        : `ДО ${nextRank}: +1 ИСПЫТАНИЕ`
      : `ИСПЫТАНИЯ ×${stats.trialMultiplier.toFixed(2)} · МАКСИМАЛЬНЫЙ РАНГ`
    : `ИСПЫТАНИЯ ×${stats.trialMultiplier.toFixed(2)}`;
  const showTrialLine = stats.victory || stats.trialMultiplier > 1;

  const trialText = scene.add.text(0, 184, trialLine, {
    fontFamily: UI_FONT.body,
    fontSize: '12px',
    fontStyle: 'bold',
    color: '#7dd3fc',
    letterSpacing: 2,
  }).setOrigin(0.5).setVisible(showTrialLine);

  // Новые достижения показываются одной строкой и слегка раздвигают кнопки.
  const newAchievements = stats.newAchievements
    .map((id) => getAchievement(id)?.name ?? id)
    .filter((name) => name.length > 0);
  const achievementLine =
    newAchievements.length === 1
      ? `НОВОЕ ДОСТИЖЕНИЕ · ${newAchievements[0]}`
      : `НОВЫХ ДОСТИЖЕНИЙ: ${newAchievements.length}`;
  const achievementText = scene.add.text(0, 204, achievementLine, {
    fontFamily: UI_FONT.body,
    fontSize: '10px',
    fontStyle: 'bold',
    color: '#f0c674',
    letterSpacing: 1,
  }).setOrigin(0.5).setVisible(newAchievements.length > 0);

  const primaryY = newAchievements.length > 0 ? 240 : 226;
  const secondaryY = newAchievements.length > 0 ? 296 : 284;

  const primaryButton = createButton(scene, 0, primaryY, 340, 58, options.primaryLabel, {
    variant: 'primary',
    accent: options.accent,
    accentHex: options.primaryTextColor,
    onClick: options.onRetry,
    fontSize: 17,
  });

  const secondaryButton = createButton(scene, 0, secondaryY, 300, 46, 'В ЛАГЕРЬ', {
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
    trialText,
    achievementText,
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
  const rank = calculateRank(stats);
  const style = RANK_STYLES[rank.letter];

  drawResultScreen(scene, overlay, stats, {
    badge: 'ПОБЕДА',
    title: 'КРИПТА ОЧИЩЕНА',
    accent: style.accent,
    accentHex: style.hex,
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
