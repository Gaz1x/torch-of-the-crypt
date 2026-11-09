import Phaser from 'phaser';
import { DEFAULT_SETTINGS, type GameSettings } from '../core/settings';
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
// ЭКРАНЫ МЕНЮ (стартовый экран, памятка, пауза, победа и поражение)
// Вёрстка рассчитана сразу на 1280×720. Вся статистика и очистка поля
// остаются в GameScene — здесь только отрисовка.
// ============================================================================

/** Статистика, показываемая на экране победы или поражения. */
export interface GameOverStats {
  score: number;
  killsCount: number;
  survivalTime: number;
  manaCollected: number;
  accuracy: number;
  wave: number;
  wavesTotal: number;
  level: number;
  bossesKilled: number;
  hp: number;
  maxHp: number;
  victory: boolean;
}

type RankLetter = 'S' | 'A' | 'B';

const RANK_THRESHOLDS = {
  S: 80,
  A: 55,
} as const;

interface RankResult {
  letter: RankLetter;
  title: string;
}

/** Настройки живут в GameScene, экраны только показывают их и меняют. */
export interface SettingsController {
  settings: GameSettings;
  update: (next: GameSettings) => void;
}

function calculateRank(stats: GameOverStats): RankResult {
  const wavesPart =
    ((stats.wave - 1 + (stats.victory ? 1 : 0)) / Math.max(1, stats.wavesTotal)) * 45;
  const accuracyPart = (stats.accuracy / 100) * 15;
  const hpPart = (stats.maxHp > 0 ? stats.hp / stats.maxHp : 0) * 20;
  const scorePart = (Math.min(stats.score, 150) / 150) * 20;
  const rating = wavesPart + accuracyPart + hpPart + scorePart;

  if (rating >= RANK_THRESHOLDS.S) {
    return { letter: 'S', title: 'ЛЕГЕНДА ПЛАМЕНИ' };
  }
  if (rating >= RANK_THRESHOLDS.A) {
    return { letter: 'A', title: 'СТРАЖ КРИПТЫ' };
  }
  return { letter: 'B', title: 'ВЫЖИВШИЙ' };
}

/** Затемнение, виньетка и угли — общий фон всех меню. */
function createScreenBase(
  scene: Phaser.Scene,
  overlay: Phaser.GameObjects.Container,
  accent: number
): Phaser.GameObjects.Container {
  const screen = scene.add.container(0, 0);
  const { width, height } = scene.scale;

  const dim = scene.add.rectangle(width / 2, height / 2, width, height, UI_COLORS.void, 0.72);
  const vignette = createVignette(scene, width, height, UI_COLORS.void, 0.85);
  const glow = scene.add.circle(width / 2, height / 2, 300, accent, 0.05);

  screen.add([dim, vignette, glow]);
  spawnEmbers(scene, screen, width, height, 26);

  overlay.add(screen);
  return screen;
}

function animateCardIn(scene: Phaser.Scene, card: Phaser.GameObjects.Container): void {
  const targetY = card.y;
  card.setY(targetY + 14);
  card.setAlpha(0);
  card.setScale(0.96);

  scene.tweens.add({
    targets: card,
    y: targetY,
    alpha: 1,
    scale: 1,
    duration: 280,
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
    scene.scale.width,
    scene.scale.height,
    UI_COLORS.void,
    0.6
  ).setInteractive();
  modal.add(backdrop);

  const panel = createPanel(scene, -370, -250, 740, 500, UI_COLORS.mana);
  modal.add(panel);

  const title = scene.add.text(0, -212, 'ПАМЯТКА СТРАЖА', {
    fontFamily: UI_FONT.display,
    fontSize: '27px',
    fontStyle: 'bold',
    color: '#dbeafe',
    letterSpacing: 1,
  }).setOrigin(0.5);

  const divider = createDivider(scene, 0, -178, 460, UI_COLORS.mana);

  const headers = (x: number, y: number, text: string): Phaser.GameObjects.Text =>
    scene.add.text(x, y, text, {
      fontFamily: UI_FONT.body,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#7dd3fc',
      letterSpacing: 2,
    });

  const body = (x: number, y: number, text: string): Phaser.GameObjects.Text =>
    scene.add.text(x, y, text, {
      fontFamily: UI_FONT.body,
      fontSize: '13px',
      color: '#c3cedd',
      lineSpacing: 6,
      wordWrap: { width: 300 },
    });

  const leftX = -340;
  const rightX = 20;

  const leftControlsHeader = headers(leftX, -150, 'УПРАВЛЕНИЕ');
  const leftControlsBody = body(
    leftX,
    -124,
    'WASD или стрелки — движение\n' +
      'Курсор мыши — направление взгляда\n' +
      'ЛКМ или Пробел — выстрел (15 маны)\n' +
      'ESC — пауза'
  );

  const leftLightHeader = headers(leftX, -30, 'СВЕТ И ТЬМА');
  const leftLightBody = body(
    leftX,
    -4,
    'В круге света враги сильно замедляются\n' +
      'Во тьме свет сужается, рыцарь медленнее\n' +
      'Фазы сменяются по набранным очкам'
  );

  const rightWavesHeader = headers(rightX, -150, 'ВОЛНЫ');
  const rightWavesBody = body(
    rightX,
    -124,
    'Пять волн, последняя — босс\n' +
      'Между волнами: +1 HP и +25 маны'
  );

  const rightBossHeader = headers(rightX, -62, 'ПОЖИРАТЕЛЬ ПЛАМЕНИ');
  const rightBossBody = body(
    rightX,
    -36,
    'Гасит факел и бросается в рывок\n' +
      'На половине HP звереет и зовёт свиту'
  );

  const rightTipHeader = headers(rightX, 22, 'СОВЕТ');
  const rightTipBody = body(
    rightX,
    48,
    'Следите за маной и не стойте в толпе.\n' +
      'После урона есть секунда неуязвимости.'
  );

  const closeButton = createButton(scene, 0, 202, 220, 46, 'ЗАКРЫТЬ', {
    variant: 'secondary',
    onClick: () => close(),
    fontSize: 14,
  });

  modal.add([
    title,
    divider,
    leftControlsHeader,
    leftControlsBody,
    leftLightHeader,
    leftLightBody,
    rightWavesHeader,
    rightWavesBody,
    rightBossHeader,
    rightBossBody,
    rightTipHeader,
    rightTipBody,
    closeButton.container,
  ]);

  screen.add(modal);

  const open = (): void => {
    modal.setVisible(true);
    modal.setAlpha(0);
    scene.tweens.add({ targets: modal, alpha: 1, duration: 160 });
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

  const panel = createPanel(scene, 330, 145, 620, 430, UI_COLORS.mana);
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

  const musicLabel = makeLabel(268, 'МУЗЫКА');
  const musicValue = makeValue(268);
  const sfxLabel = makeLabel(348, 'ЗВУКИ');
  const sfxValue = makeValue(348);

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

  const musicSlider = createSlider(scene, width / 2, 302, 360, {
    value: current.musicVolume,
    accent: UI_COLORS.ember,
    onChange: (value) => apply({ ...current, musicVolume: value }),
  });

  const sfxSlider = createSlider(scene, width / 2, 382, 360, {
    value: current.sfxVolume,
    accent: UI_COLORS.mana,
    onChange: (value) => apply({ ...current, sfxVolume: value }),
  });

  const muteButton = createButton(scene, width / 2, 440, 280, 44, '', {
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

  const resetButton = createButton(scene, width / 2 - 130, 505, 220, 44, 'СБРОСИТЬ', {
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

  const closeButton = createButton(scene, width / 2 + 130, 505, 220, 44, 'ЗАКРЫТЬ', {
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
    scene.tweens.add({ targets: modal, alpha: 1, duration: 160 });
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

export function drawStartScreen(
  scene: Phaser.Scene,
  overlay: Phaser.GameObjects.Container,
  onStart: () => void,
  settingsController: SettingsController
): void {
  const screen = createScreenBase(scene, overlay, UI_COLORS.ember);
  const card = scene.add.container(scene.scale.width / 2, scene.scale.height / 2);

  const panel = createPanel(scene, -410, -300, 820, 600, UI_COLORS.brass, {
    glow: true,
  });
  card.add(panel);

  const emblemGlow = scene.add.circle(0, -215, 52, UI_COLORS.ember, 0.14);
  const emblem = createIcon(scene, 0, -215, 'torch', 70, UI_COLORS.emberBright);

  const subtitle = scene.add.text(0, -150, 'ХРОНИКИ ПОДЗЕМЕЛЬЯ', {
    fontFamily: UI_FONT.body,
    fontSize: '11px',
    fontStyle: 'bold',
    color: '#a8844c',
    letterSpacing: 5,
  }).setOrigin(0.5);

  const title = scene.add.text(0, -108, 'ПОСЛЕДНИЙ ФАКЕЛ КРИПТЫ', {
    fontFamily: UI_FONT.display,
    fontSize: '40px',
    fontStyle: 'bold',
    color: '#f4ecd8',
  }).setOrigin(0.5);

  const divider = createDivider(scene, 0, -64, 420, UI_COLORS.brass);

  const lore = scene.add.text(
    0,
    -6,
    'Древние своды трещат под натиском бездны.\n' +
      'Пока горит пламя вашего факела, порождения тьмы цепенеют в его свете.\n' +
      'Собирайте осколки эфира павших теней и не дайте огню угаснуть.',
    {
      fontFamily: UI_FONT.body,
      fontSize: '15px',
      color: '#c3cedd',
      align: 'center',
      lineSpacing: 8,
    }
  ).setOrigin(0.5);

  // Три компактные карточки управления
  const chips: { icon: 'move' | 'aim' | 'bolt'; title: string; keys: string }[] = [
    { icon: 'move', title: 'ДВИЖЕНИЕ', keys: 'WASD / стрелки' },
    { icon: 'aim', title: 'ПРИЦЕЛ', keys: 'курсор мыши' },
    { icon: 'bolt', title: 'ВЫСТРЕЛ', keys: 'ЛКМ / Пробел' },
  ];

  chips.forEach((chip, index) => {
    const chipContainer = scene.add.container(-220 + index * 220, 90);
    const chipPanel = createPanel(scene, -100, -31, 200, 62, 0x4b5d77);
    const chipIcon = createIcon(scene, -70, 0, chip.icon, 22, UI_COLORS.mana);
    const chipTitle = scene.add.text(-48, -18, chip.title, {
      fontFamily: UI_FONT.body,
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#7dd3fc',
      letterSpacing: 1.5,
    });
    const chipKeys = scene.add.text(-48, 2, chip.keys, {
      fontFamily: UI_FONT.body,
      fontSize: '11px',
      color: '#c3cedd',
    });

    chipContainer.add([chipPanel, chipIcon, chipTitle, chipKeys]);
    card.add(chipContainer);
  });

  const startButton = createButton(scene, 0, 188, 360, 60, 'СПУСТИТЬСЯ В КРИПТУ', {
    variant: 'primary',
    accent: UI_COLORS.ember,
    onClick: onStart,
    fontSize: 17,
  });

  const helpButton = createButton(scene, -100, 252, 190, 40, 'ПАМЯТКА', {
    variant: 'ghost',
    accent: UI_COLORS.brass,
    accentHex: '#f0c674',
    onClick: () => help.open(),
    fontSize: 12,
  });

  const settingsButton = createButton(scene, 100, 252, 190, 40, 'НАСТРОЙКИ', {
    variant: 'ghost',
    accent: UI_COLORS.brass,
    accentHex: '#f0c674',
    onClick: () => settingsModal.open(),
    fontSize: 12,
  });

  card.add([
    emblemGlow,
    emblem,
    subtitle,
    title,
    divider,
    lore,
    startButton.container,
    helpButton.container,
    settingsButton.container,
  ]);
  screen.add(card);

  const help = createHelpModal(scene, screen);
  const settingsModal = createSettingsModal(scene, screen, settingsController);

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

  animateCardIn(scene, card);
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
    fontSize: '10px',
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
    fontSize: '11px',
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
    ['УРОВЕНЬ', `${stats.level}`],
  ];

  statCells.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = column === 0 ? -190 : 190;
    const y = 10 + row * 48;

    const cell = scene.add.container(x, y);
    const labelText = scene.add.text(0, -12, label, {
      fontFamily: UI_FONT.body,
      fontSize: '9px',
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
    158,
    `Собрано эфира: ${stats.manaCollected} · Боссов повержено: ${stats.bossesKilled}`,
    {
      fontFamily: UI_FONT.body,
      fontSize: '10px',
      color: '#7c8ba1',
      letterSpacing: 1,
    }
  ).setOrigin(0.5);

  const primaryButton = createButton(scene, 0, 210, 340, 58, options.primaryLabel, {
    variant: 'primary',
    accent: options.accent,
    accentHex: options.primaryTextColor,
    onClick: options.onRetry,
    fontSize: 17,
  });

  const secondaryButton = createButton(scene, 0, 276, 300, 46, 'В ГЛАВНОЕ МЕНЮ', {
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
    primaryLabel: 'ПОПРОБОВАТЬ ЕЩЁ',
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
    primaryLabel: 'СЫГРАТЬ ЕЩЁ',
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
    fontSize: '10px',
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
    ['УРОВЕНЬ', `${stats.level}`],
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
      fontSize: '9px',
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

  const hint = scene.add.text(0, 64, 'ESC — продолжить игру', {
    fontFamily: UI_FONT.body,
    fontSize: '12px',
    color: '#94a3b8',
  }).setOrigin(0.5);

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

  const menuButton = createButton(scene, 115, 244, 220, 40, 'В ГЛАВНОЕ МЕНЮ', {
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
