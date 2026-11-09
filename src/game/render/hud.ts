import Phaser from 'phaser';
import { GAME_CONFIG } from '../core/gameConfig';
import type { PhaseKey } from '../core/phases';
import {
  createIcon,
  createMedallion,
  createPanel,
  setTextIfChanged,
  UI_COLORS,
  UI_DEPTH,
  UI_FONT,
} from './uiKit';

// ============================================================================
// HUD
// Три зоны в верхней полосе:
//  - «Страж»: уровень, здоровье, мана, опыт;
//  - «Факел»: текущая фаза и прогресс до следующей;
//  - «Хроника»: волна, остаток врагов, очки, время и убийства.
// Полоса босса живёт под индикатором фазы.
// ============================================================================

export interface BossHudStats {
  name: string;
  hpRatio: number;
  enraged: boolean;
}

/** Данные, которые HUD показывает каждый кадр. */
export interface HudStats {
  hp: number;
  mana: number;
  score: number;
  killsCount: number;
  survivalTime: number;
  slowedEnemies: number;
  level: number;
  xp: number;
  xpToNext: number;
  wave: number;
  wavesTotal: number;
  waveName: string;
  enemiesLeft: number;
  /** Для боссовой волны — число живых мобов свиты (без самого босса). */
  addsLeft: number | null;
  phase: PhaseKey;
  phaseProgress: number;
  phasePointsToNext: number;
  phaseNext: PhaseKey;
  boss: BossHudStats | null;
  /** Время кадра в секундах — для плавного «призрачного» урона босса. */
  dt: number;
}

export interface HudParts {
  container: Phaser.GameObjects.Container;
  levelText: Phaser.GameObjects.Text;
  hpSegments: Phaser.GameObjects.Rectangle[];
  hpFlash: Phaser.GameObjects.Rectangle;
  manaBarFill: Phaser.GameObjects.Rectangle;
  manaValueText: Phaser.GameObjects.Text;
  xpBarFill: Phaser.GameObjects.Rectangle;
  xpValueText: Phaser.GameObjects.Text;
  scoreValueText: Phaser.GameObjects.Text;
  timeValueText: Phaser.GameObjects.Text;
  killsValueText: Phaser.GameObjects.Text;
  waveText: Phaser.GameObjects.Text;
  waveNameText: Phaser.GameObjects.Text;
  enemiesLeftText: Phaser.GameObjects.Text;
  slowedText: Phaser.GameObjects.Text;
  waveMedallionText: Phaser.GameObjects.Text;
  phaseTitleText: Phaser.GameObjects.Text;
  phaseProgressText: Phaser.GameObjects.Text;
  phaseBarFill: Phaser.GameObjects.Rectangle;
  phaseRing: Phaser.GameObjects.Arc;
  phaseGlow: Phaser.GameObjects.Arc;
  phaseIcon: Phaser.GameObjects.Container;
  bossBarContainer: Phaser.GameObjects.Container;
  bossBarFill: Phaser.GameObjects.Rectangle;
  bossBarGhost: Phaser.GameObjects.Rectangle;
  bossNameText: Phaser.GameObjects.Text;
  bossEnragedText: Phaser.GameObjects.Text;
  /** Предыдущее HP — чтобы ловить момент потери здоровья. */
  prevHp: number;
  /** Плавно догоняющая полоса урона босса. */
  bossGhostRatio: number;
}

const LEFT_PANEL = { x: 16, y: 14, width: 372, height: 132 };
const RIGHT_PANEL = { x: 892, y: 14, width: 372, height: 132 };
const PHASE_PANEL = { x: 520, y: 14, width: 240, height: 84 };

const HP_BAR = {
  x: 96,
  y: 30,
  width: 260,
  height: 16,
  gap: 4,
  count: GAME_CONFIG.PLAYER.MAX_HP,
};

const MANA_BAR = {
  x: 96,
  y: 66,
  width: 260,
  innerWidth: 256,
  height: 12,
};

const XP_BAR = {
  x: 96,
  y: 98,
  width: 260,
  innerWidth: 256,
  height: 7,
};

const BOSS_BAR = {
  width: 480,
  innerWidth: 476,
  innerHeight: 12,
};

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}с`;
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

function createStatLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    fontFamily: UI_FONT.body,
    fontSize: '9px',
    fontStyle: 'bold',
    color: '#7c8ba1',
    letterSpacing: 1.5,
  });
}

export function createHud(scene: Phaser.Scene): HudParts {
  const container = scene.add.container(0, 0).setDepth(UI_DEPTH.hud);

  // ---------------------------------------------------------------- СТРАЖ
  const leftPanel = createPanel(
    scene,
    LEFT_PANEL.x,
    LEFT_PANEL.y,
    LEFT_PANEL.width,
    LEFT_PANEL.height,
    UI_COLORS.brass
  );
  container.add(leftPanel);

  const levelMedallion = createMedallion(scene, 48, 66, 30, UI_COLORS.brassBright);
  leftPanel.add(levelMedallion);

  const levelCaptionText = scene.add.text(48, 52, 'УР.', {
    fontFamily: UI_FONT.body,
    fontSize: '8px',
    fontStyle: 'bold',
    color: '#8a6a3b',
    letterSpacing: 1,
  }).setOrigin(0.5);

  const levelText = scene.add.text(48, 70, '1', {
    fontFamily: UI_FONT.display,
    fontSize: '26px',
    fontStyle: 'bold',
    color: '#f0c674',
  }).setOrigin(0.5);

  leftPanel.add([levelCaptionText, levelText]);

  const hpLabel = createStatLabel(scene, HP_BAR.x, 16, 'ЖИЗНЬ');
  leftPanel.add(hpLabel);

  const hpSlots: Phaser.GameObjects.Rectangle[] = [];
  const slotWidth =
    (HP_BAR.width - HP_BAR.gap * (HP_BAR.count - 1)) / HP_BAR.count;

  for (let i = 0; i < HP_BAR.count; i++) {
    const slot = scene.add
      .rectangle(
        HP_BAR.x + i * (slotWidth + HP_BAR.gap),
        HP_BAR.y,
        slotWidth,
        HP_BAR.height,
        UI_COLORS.blood
      )
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0xfca5a5, 0.75);
    hpSlots.push(slot);
    leftPanel.add(slot);
  }

  const hpFlash = scene.add
    .rectangle(
      HP_BAR.x + HP_BAR.width / 2,
      HP_BAR.y + HP_BAR.height / 2,
      HP_BAR.width,
      HP_BAR.height,
      0xffffff,
      0
    )
    .setOrigin(0.5);
  leftPanel.add(hpFlash);

  const manaLabel = createStatLabel(scene, MANA_BAR.x, 52, 'МАНА');
  const manaValueText = scene.add.text(MANA_BAR.x + MANA_BAR.width, 52, '', {
    fontFamily: UI_FONT.body,
    fontSize: '9px',
    fontStyle: 'bold',
    color: '#7dd3fc',
  }).setOrigin(1, 0);

  const manaBarBg = scene.add
    .rectangle(MANA_BAR.x, MANA_BAR.y, MANA_BAR.width, MANA_BAR.height, 0x0c1422, 1)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x334155, 0.9);

  const manaBarFill = scene.add
    .rectangle(
      MANA_BAR.x + 2,
      MANA_BAR.y + 2,
      MANA_BAR.innerWidth,
      MANA_BAR.height - 4,
      UI_COLORS.manaDeep
    )
    .setOrigin(0, 0);

  // Насечки стоимости выстрела: 15, 30, 45 ... единиц маны.
  const manaTicks = scene.add.graphics();
  manaTicks.lineStyle(1, 0x0b1220, 0.7);
  for (
    let value = GAME_CONFIG.COMBAT.SHOT_MANA_COST;
    value < GAME_CONFIG.COMBAT.MAX_MANA;
    value += GAME_CONFIG.COMBAT.SHOT_MANA_COST
  ) {
    const tickX = MANA_BAR.x + 2 + (MANA_BAR.innerWidth * value) / GAME_CONFIG.COMBAT.MAX_MANA;
    manaTicks.lineBetween(tickX, MANA_BAR.y + 2, tickX, MANA_BAR.y + MANA_BAR.height - 2);
  }

  const xpLabel = createStatLabel(scene, XP_BAR.x, 84, 'ОПЫТ');
  const xpValueText = scene.add.text(XP_BAR.x + XP_BAR.width, 84, '', {
    fontFamily: UI_FONT.body,
    fontSize: '9px',
    fontStyle: 'bold',
    color: '#fde68a',
  }).setOrigin(1, 0);

  const xpBarBg = scene.add
    .rectangle(XP_BAR.x, XP_BAR.y, XP_BAR.width, XP_BAR.height, 0x0c1422, 1)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x334155, 0.9);

  const xpBarFill = scene.add
    .rectangle(
      XP_BAR.x + 2,
      XP_BAR.y + 2,
      XP_BAR.innerWidth,
      XP_BAR.height - 4,
      UI_COLORS.emberBright
    )
    .setOrigin(0, 0);

  leftPanel.add([
    manaLabel,
    manaValueText,
    manaBarBg,
    manaBarFill,
    manaTicks,
    xpLabel,
    xpValueText,
    xpBarBg,
    xpBarFill,
  ]);

  // --------------------------------------------------------------- ХРОНИКА
  const rightPanel = createPanel(
    scene,
    RIGHT_PANEL.x,
    RIGHT_PANEL.y,
    RIGHT_PANEL.width,
    RIGHT_PANEL.height,
    UI_COLORS.brass
  );
  container.add(rightPanel);

  const waveMedallion = createMedallion(scene, 48, 66, 30, 0x8fb8d8);
  rightPanel.add(waveMedallion);

  const waveMedallionText = scene.add.text(48, 66, '1', {
    fontFamily: UI_FONT.display,
    fontSize: '26px',
    fontStyle: 'bold',
    color: '#c7e4f7',
  }).setOrigin(0.5);
  rightPanel.add(waveMedallionText);

  const waveText = scene.add.text(96, 14, '', {
    fontFamily: UI_FONT.body,
    fontSize: '10px',
    fontStyle: 'bold',
    color: '#8fb8d8',
    letterSpacing: 1.5,
  });

  const waveNameText = scene.add.text(96, 31, '', {
    fontFamily: UI_FONT.display,
    fontSize: '19px',
    fontStyle: 'bold',
    color: '#e8eef7',
  });

  const enemiesLeftText = scene.add.text(96, 60, '', {
    fontFamily: UI_FONT.body,
    fontSize: '11px',
    color: '#a9b7c9',
  });

  const slowedText = scene.add.text(96, 76, '', {
    fontFamily: UI_FONT.body,
    fontSize: '10px',
    color: '#7dd3fc',
  });

  const statsDivider = scene.add.graphics();
  statsDivider.lineStyle(1, UI_COLORS.panelLine, 0.55);
  statsDivider.lineBetween(96, 92, 356, 92);

  const scoreLabel = createStatLabel(scene, 96, 97, 'ОЧКИ');
  const timeLabel = createStatLabel(scene, 190, 97, 'ВРЕМЯ');
  const killsLabel = createStatLabel(scene, 284, 97, 'УБИТО');

  const scoreValueText = scene.add.text(96, 108, '', {
    fontFamily: UI_FONT.body,
    fontSize: '15px',
    fontStyle: 'bold',
    color: '#f0c674',
  });

  const timeValueText = scene.add.text(190, 108, '', {
    fontFamily: UI_FONT.body,
    fontSize: '14px',
    fontStyle: 'bold',
    color: '#e2e8f0',
  });

  const killsValueText = scene.add.text(284, 108, '', {
    fontFamily: UI_FONT.body,
    fontSize: '14px',
    fontStyle: 'bold',
    color: '#e2e8f0',
  });

  rightPanel.add([
    waveText,
    waveNameText,
    enemiesLeftText,
    slowedText,
    statsDivider,
    scoreLabel,
    timeLabel,
    killsLabel,
    scoreValueText,
    timeValueText,
    killsValueText,
  ]);

  // ------------------------------------------------------------------ ФАКЕЛ
  const phasePanel = createPanel(
    scene,
    PHASE_PANEL.x,
    PHASE_PANEL.y,
    PHASE_PANEL.width,
    PHASE_PANEL.height,
    UI_COLORS.brass
  );
  container.add(phasePanel);

  const phaseGlow = scene.add.circle(36, 42, 26, UI_COLORS.emberBright, 0.1);
  const phaseMedallion = createMedallion(scene, 36, 42, 22, UI_COLORS.emberBright);
  const phaseRing = scene.add.circle(36, 42, 22).setStrokeStyle(2, UI_COLORS.emberBright, 0.9);
  const phaseIcon = createIcon(scene, 36, 42, 'torch', 28, UI_COLORS.emberBright);

  const phaseTitleText = scene.add.text(66, 12, '', {
    fontFamily: UI_FONT.display,
    fontSize: '15px',
    fontStyle: 'bold',
    color: '#f0c674',
    letterSpacing: 2,
  });

  const phaseProgressText = scene.add.text(66, 34, '', {
    fontFamily: UI_FONT.body,
    fontSize: '10px',
    color: '#a9b7c9',
  });

  const phaseBarBg = scene.add
    .rectangle(66, 58, 158, 7, 0x0c1422, 1)
    .setOrigin(0, 0.5)
    .setStrokeStyle(1, 0x334155, 0.8);

  const phaseBarFill = scene.add
    .rectangle(67, 58, 156, 3, UI_COLORS.emberBright)
    .setOrigin(0, 0.5);

  phasePanel.add([
    phaseGlow,
    phaseMedallion,
    phaseRing,
    phaseIcon,
    phaseTitleText,
    phaseProgressText,
    phaseBarBg,
    phaseBarFill,
  ]);

  // ------------------------------------------------------------ ПОЛОСА БОССА
  const bossBarContainer = scene.add.container(640, 106).setVisible(false);

  const bossNameText = scene.add.text(0, -2, '', {
    fontFamily: UI_FONT.display,
    fontSize: '13px',
    fontStyle: 'bold',
    color: '#f0c674',
    stroke: '#05070c',
    strokeThickness: 3,
  }).setOrigin(0.5, 0);

  const bossBarBg = scene.add
    .rectangle(0, 18, BOSS_BAR.width, 16, 0x1e293b)
    .setOrigin(0.5, 0)
    .setStrokeStyle(1.5, UI_COLORS.blood, 0.9);

  const bossBarGhost = scene.add
    .rectangle(-BOSS_BAR.innerWidth / 2, 20, BOSS_BAR.innerWidth, BOSS_BAR.innerHeight, 0xfef3c7, 0.3)
    .setOrigin(0, 0);

  const bossBarFill = scene.add
    .rectangle(-BOSS_BAR.innerWidth / 2, 20, BOSS_BAR.innerWidth, BOSS_BAR.innerHeight, UI_COLORS.blood)
    .setOrigin(0, 0);

  const bossEnrageMark = scene.add
    .rectangle(0, 18, 2, 16, UI_COLORS.brassBright, 0.85)
    .setOrigin(0.5, 0);

  const bossEnragedText = scene.add.text(238, -2, 'ЯРОСТЬ', {
    fontFamily: UI_FONT.body,
    fontSize: '9px',
    fontStyle: 'bold',
    color: '#fca5a5',
    letterSpacing: 1,
  }).setOrigin(1, 0).setVisible(false);

  bossBarContainer.add([
    bossNameText,
    bossBarBg,
    bossBarGhost,
    bossBarFill,
    bossEnrageMark,
    bossEnragedText,
  ]);
  container.add(bossBarContainer);

  return {
    container,
    levelText,
    hpSegments: hpSlots,
    hpFlash,
    manaBarFill,
    manaValueText,
    xpBarFill,
    xpValueText,
    scoreValueText,
    timeValueText,
    killsValueText,
    waveText,
    waveNameText,
    enemiesLeftText,
    slowedText,
    waveMedallionText,
    phaseTitleText,
    phaseProgressText,
    phaseBarFill,
    phaseRing,
    phaseGlow,
    phaseIcon,
    bossBarContainer,
    bossBarFill,
    bossBarGhost,
    bossNameText,
    bossEnragedText,
    prevHp: GAME_CONFIG.PLAYER.MAX_HP,
    bossGhostRatio: 1,
  };
}

export function updateHud(parts: HudParts, stats: HudStats): void {
  // --- Здоровье ---
  const hpChanged = stats.hp !== parts.prevHp;
  if (hpChanged && stats.hp < parts.prevHp) {
    parts.hpFlash.setAlpha(0.35);
  }
  parts.hpFlash.setAlpha(Math.max(0, parts.hpFlash.alpha - stats.dt * 2.4));

  for (let i = 0; i < parts.hpSegments.length; i++) {
    const filled = i < stats.hp;
    parts.hpSegments[i].setFillStyle(filled ? UI_COLORS.blood : 0x1e293b, filled ? 1 : 0.85);
    parts.hpSegments[i].setStrokeStyle(1, filled ? 0xfca5a5 : 0x475569, filled ? 0.75 : 0.5);
  }
  parts.prevHp = stats.hp;

  // --- Мана ---
  const manaRatio = Phaser.Math.Clamp(stats.mana / GAME_CONFIG.COMBAT.MAX_MANA, 0, 1);
  parts.manaBarFill.scaleX = manaRatio;
  const canShoot = stats.mana >= GAME_CONFIG.COMBAT.SHOT_MANA_COST;
  parts.manaBarFill.setFillStyle(canShoot ? UI_COLORS.manaDeep : 0x475569);
  setTextIfChanged(
    parts.manaValueText,
    `${Math.floor(stats.mana)} / ${GAME_CONFIG.COMBAT.MAX_MANA}`
  );

  // --- Опыт ---
  const xpRatio = Phaser.Math.Clamp(stats.xp / stats.xpToNext, 0, 1);
  parts.xpBarFill.scaleX = xpRatio;
  setTextIfChanged(parts.xpValueText, `${Math.floor(stats.xp)} / ${stats.xpToNext}`);
  setTextIfChanged(parts.levelText, `${stats.level}`);

  // --- Волна ---
  setTextIfChanged(parts.waveText, `ВОЛНА ${stats.wave} / ${stats.wavesTotal}`);
  setTextIfChanged(parts.waveNameText, stats.waveName);
  setTextIfChanged(parts.waveMedallionText, `${stats.wave}`);
  setTextIfChanged(
    parts.enemiesLeftText,
    stats.addsLeft === null ? `Осталось: ${stats.enemiesLeft}` : `Свита: ${stats.addsLeft}`
  );
  setTextIfChanged(parts.slowedText, `В свете: ${stats.slowedEnemies}`);
  parts.slowedText.setColor(stats.slowedEnemies > 0 ? '#7dd3fc' : '#64748b');

  // --- Счёт, время, убийства ---
  setTextIfChanged(parts.scoreValueText, `${stats.score}`);
  parts.timeValueText.setText(formatTime(stats.survivalTime));
  setTextIfChanged(parts.killsValueText, `${stats.killsCount}`);

  // --- Фаза ---
  const isLight = stats.phase === 'LIGHT';
  const phaseColor = isLight ? UI_COLORS.emberBright : UI_COLORS.bloodBright;
  const phaseColorHex = isLight ? '#f0c674' : '#fca5a5';

  setTextIfChanged(parts.phaseTitleText, isLight ? 'СВЕТ' : 'ТЬМА');
  parts.phaseTitleText.setColor(phaseColorHex);
  setTextIfChanged(
    parts.phaseProgressText,
    `до ${stats.phaseNext === 'DARK' ? 'тьмы' : 'света'}: ${stats.phasePointsToNext}`
  );
  parts.phaseBarFill.scaleX = Phaser.Math.Clamp(stats.phaseProgress, 0, 1);
  parts.phaseBarFill.setFillStyle(phaseColor);
  parts.phaseRing.setStrokeStyle(2, phaseColor, 0.9);
  parts.phaseGlow.setFillStyle(phaseColor, isLight ? 0.12 : 0.16);
  parts.phaseIcon.setAlpha(isLight ? 1 : 0.55);

  // --- Босс ---
  if (stats.boss) {
    parts.bossBarContainer.setVisible(true);
    setTextIfChanged(parts.bossNameText, stats.boss.name);

    const ratio = Phaser.Math.Clamp(stats.boss.hpRatio, 0, 1);
    if (ratio > parts.bossGhostRatio) {
      parts.bossGhostRatio = ratio;
    }

    parts.bossBarFill.scaleX = ratio;
    parts.bossBarGhost.scaleX = parts.bossGhostRatio;
    parts.bossGhostRatio = Math.max(ratio, parts.bossGhostRatio - stats.dt * 0.6);

    parts.bossBarFill.setFillStyle(stats.boss.enraged ? UI_COLORS.ember : UI_COLORS.blood);
    parts.bossEnragedText.setVisible(stats.boss.enraged);
  } else {
    parts.bossBarContainer.setVisible(false);
    parts.bossGhostRatio = 1;
  }
}

/** Показать полосу босса вручную (например, сразу при появлении). */
export function showBossBar(parts: HudParts): void {
  parts.bossBarContainer.setVisible(true);
}

export function hideBossBar(parts: HudParts): void {
  parts.bossBarContainer.setVisible(false);
  parts.bossGhostRatio = 1;
}
