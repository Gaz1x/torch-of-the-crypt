import Phaser from 'phaser';
import soundtrackUrl from '../assets/audio/soundtrack.mp3';
import { GAME_CONFIG, type EnemyConfig, type EnemyTypeKey } from './core/gameConfig';
import { BOSS_CONFIG, type BossConfig, type BossTypeKey } from './core/bosses';
import { LEVELS, getFloorIndex, isFloorEnd, type LevelConfig, type WaveConfig } from './core/waves';
import { getPhase, getPhaseProgress, PHASES, type PhaseKey } from './core/phases';
import { pickBoonChoices, type BoonKey } from './core/boons';
import {
  applyRun,
  calculateRank,
  loadProfile,
  purchaseUpgrade,
  saveProfile,
  type Profile,
} from './core/profile';
import { loadSettings, saveSettings, type GameSettings } from './core/settings';
import { startAttempt, track } from './core/analytics';
import {
  getUpgradeBonuses,
  type UpgradeKey,
} from './core/upgrades';
import type {
  EnemyEntity,
  EnemyProjectileEntity,
  ManaOrbEntity,
  ProjectileEntity,
} from './core/entities';
import { drawCryptEnvironment, type WorldCrack } from './render/world';
import { createPlayer, type PlayerVisual } from './render/playerArt';
import { createEnemyVisual } from './render/enemyArt';
import { createBossVisual } from './render/bossArt';
import {
  clearAllNotices,
  createDamageEffect,
  createDeathEffect,
  createExplosionEffect,
  createHitSpark,
  createShotFlash,
  showFloatingText,
  showPhaseNotice,
  showWaveNotice,
} from './render/effects';
import {
  createHud,
  hideBossBar,
  updateHud,
  type HudParts,
} from './render/hud';
import {
  drawGameOverScreen,
  drawPauseScreen,
  drawStartScreen,
  drawVictoryScreen,
  isTouchUi,
  showBoonChoice,
  type GameOverStats,
  type ProfileController,
  type SettingsController,
} from './render/screens';
import {
  createTouchControls,
  TOUCH_CONFIG,
  type TouchControls,
} from './render/touchControls';
import {
  createVignette,
  ensureGlowTexture,
  GLOW_TEXTURE_KEY,
  UI_COLORS,
} from './render/uiKit';

// ============================================================================
// ОСНОВНАЯ СЦЕНА ИГРЫ
// Здесь живёт состояние партии и игровая логика. Константы и баланс — в
// core/gameConfig.ts, волны — в core/waves.ts, босс — в core/bosses.ts,
// отрисовка — в папке render/.
// ============================================================================

type GameState = 'START' | 'PLAYING' | 'PAUSED' | 'GIFT' | 'GAMEOVER' | 'VICTORY';

/** Римские номера этажей для строки HUD. */
const FLOOR_ROMAN = ['I', 'II', 'III'] as const;

// Покачивание фигуры рыцаря при ходьбе (см. updateFigureAnimation).
const WALK_BOB_AMPLITUDE = 2.2;
const WALK_SWAY_AMPLITUDE = 0.05;
const WALK_LEAN_FACTOR = 0.35;
const IDLE_BREATH_AMPLITUDE = 1;
/** Сколько секунд между двумя облачками пыли под ногами. */
const STEP_DUST_INTERVAL = 0.22;

/** BaseSound в типах Phaser не объявляет setVolume, хотя все реальные звуки его имеют. */
type VolumeControlledSound = Phaser.Sound.BaseSound & {
  setVolume(value: number): unknown;
};

export class GameScene extends Phaser.Scene {
  private gameState: GameState = 'START';

  // Игрок
  private player!: Phaser.GameObjects.Container;
  private playerVisual!: PlayerVisual;
  private cooldownArc!: Phaser.GameObjects.Graphics;
  private invulnRing!: Phaser.GameObjects.Arc;
  private playerX: number = GAME_CONFIG.PLAYER.START_X;
  private playerY: number = GAME_CONFIG.PLAYER.START_Y;
  private aimAngle = 0;
  private hp: number = GAME_CONFIG.PLAYER.MAX_HP;
  private mana: number = GAME_CONFIG.COMBAT.START_MANA;
  private invulnTimer = 0;
  /** Часы анимации фигуры и таймер пыли шагов. */
  private figureAnimTime = 0;
  private stepDustTimer = 0;

  // Постоянный прогресс и рассчитанные из улучшений характеристики
  private profile: Profile = loadProfile();
  private maxHp: number = GAME_CONFIG.PLAYER.MAX_HP;
  private startMana: number = GAME_CONFIG.COMBAT.START_MANA;
  private lightMultiplier = 1;
  /** Защита от повторной записи одного и того же забега. */
  private runRecorded = false;

  // Система Света и Тьмы
  private darknessOverlay!: Phaser.GameObjects.RenderTexture;
  /** Контур по границе света: мягкое широкое кольцо и тонкое яркое. */
  private lightRingSoft!: Phaser.GameObjects.Arc;
  private lightRingBright!: Phaser.GameObjects.Arc;
  /** Кисти-источники для вырезания света: у каждой свой размер на кадр. */
  private lightBrush!: Phaser.GameObjects.Image;
  private smallLightBrush!: Phaser.GameObjects.Image;
  private torchLightBrush!: Phaser.GameObjects.Image;
  private torchLights: WorldCrack[] = [];
  private lowHpVignette!: Phaser.GameObjects.Graphics;
  private ambientGlow!: Phaser.GameObjects.Image;
  /** Текущая фаза факела: свет и скорость игрока берутся из PHASES. */
  private currentPhase: PhaseKey = getPhase(0);
  private currentLightRadius: number = PHASES[getPhase(0)].lightRadius;
  /** Пока > 0, босс гасит факел и радиус света ограничен. */
  private torchDrainTimer = 0;

  // Списки объектов
  private enemies: EnemyEntity[] = [];
  private projectiles: ProjectileEntity[] = [];
  private enemyProjectiles: EnemyProjectileEntity[] = [];
  private manaOrbs: ManaOrbEntity[] = [];
  private cracks: WorldCrack[] = [];

  // Волны
  private waveIndex = 0;
  /** Локация, в которой идёт спуск, и выбранная в лагере. */
  private levelIndex = 0;
  private selectedLevel = 0;
  private waveSpawned = 0;
  private waveSpawnTimer = 0;
  private waveTransitionTimer = 0;
  private waveActive = false;
  private guaranteedQueue: EnemyTypeKey[] = [];
  /** Таймер следующего появления свиты босса. */
  private bossAddsTimer = 0;
  /** Дары, выбранные в этом спуске. Живут только до конца партии. */
  private boons = new Set<BoonKey>();

  // Аналитика (Метрика): номер попытки в визите и глубина текущего спуска.
  /** Номер попытки с момента загрузки страницы (1, 2, 3…). */
  private runAttempt = 0;
  /** Самый глубокий этаж текущего спуска, чтобы floor_reached не повторялся. */
  private maxFloorReached = 1;
  /** game_ready отправляется один раз за визит — при первом показе лагеря. */
  private campTracked = false;

  /** Текущая локация: её этажи и волны. */
  private get level(): LevelConfig {
    return LEVELS[this.levelIndex] ?? LEVELS[0];
  }

  // Звук и настройки
  private settings: GameSettings = loadSettings();
  private soundtrack: VolumeControlledSound | null = null;
  private musicStarted = false;
  private musicFade?: Phaser.Tweens.Tween;

  // Таймеры и Статистика
  private fireCooldown = 0;
  private survivalTime = 0;
  private score = 0;
  private killsCount = 0;
  private shotsFired = 0;
  private shotsHit = 0;
  private manaCollected = 0;
  private bossesKilled = 0;
  /** Защита от повторного запуска, пока меню плавно гаснет. */
  private startingRun = false;

  // Клавиши
  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    UP: Phaser.Input.Keyboard.Key;
    LEFT: Phaser.Input.Keyboard.Key;
    DOWN: Phaser.Input.Keyboard.Key;
    RIGHT: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
    ESC: Phaser.Input.Keyboard.Key;
  };

  // Touch-управление: левая половина — стик движения, правая — стик прицела.
  private isTouchDevice = false;
  private touchControls?: TouchControls;
  private touchMovePointerId: number | null = null;
  private touchAimPointerId: number | null = null;
  private touchMoveOrigin = new Phaser.Math.Vector2();
  private touchAimOrigin = new Phaser.Math.Vector2();
  private touchMove = new Phaser.Math.Vector2();
  private touchAimAngle: number | null = null;

  // Элементы HUD и UI
  private hud!: HudParts;
  private uiOverlay!: Phaser.GameObjects.Container;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.load.audio('soundtrack', soundtrackUrl);
  }

  create(): void {
    // На телефоне включаем второй стик и кнопку паузы. Основной признак —
    // грубый указатель; запасной вариант — поддержка touch в Phaser.
    this.isTouchDevice =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(pointer: coarse)').matches
        : this.sys.game.device.input.touch;

    // В лагере по умолчанию выбрана последняя открытая локация.
    this.selectedLevel = this.profile.unlockedLevels - 1;

    const layout = drawCryptEnvironment(this);
    this.cracks = layout.cracks;
    this.torchLights = layout.torches;

    const glowKey = ensureGlowTexture(this);

    this.ambientGlow = this.add
      .image(this.playerX, this.playerY, glowKey)
      .setDepth(5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(GAME_CONFIG.LIGHT.AMBIENT_COLOR)
      .setAlpha(GAME_CONFIG.LIGHT.AMBIENT_ALPHA)
      .setDisplaySize(this.currentLightRadius * 2.2, this.currentLightRadius * 2.2);

    this.playerVisual = createPlayer(this, this.playerX, this.playerY);
    this.player = this.playerVisual.container;
    this.cooldownArc = this.add.graphics().setDepth(13);

    // Кольцо неуязвимости: видно только после полученного урона.
    this.invulnRing = this.add.circle(
      this.playerX,
      this.playerY,
      GAME_CONFIG.PLAYER.RADIUS + 12,
      0x38bdf8,
      0
    )
      .setStrokeStyle(2.5, 0x7dd3fc, 0.95)
      .setDepth(13)
      .setVisible(false);

    this.setupLightingSystem();
    this.setupInputs();
    this.touchControls = createTouchControls(this);
    this.hud = createHud(this, {
      touch: this.isTouchDevice,
      onPause: () => this.togglePause(),
    });
    this.uiOverlay = this.add.container(0, 0).setDepth(40);
    this.lowHpVignette = createVignette(
      this,
      GAME_CONFIG.WORLD.WIDTH,
      GAME_CONFIG.WORLD.HEIGHT,
      UI_COLORS.blood,
      0.5
    )
      .setDepth(26)
      .setVisible(false)
      .setAlpha(0);
    this.setupAudio();
    this.applyProfileBonuses();

    this.showStartScreen();
  }

  // ============================================================================
  // 0. ЗВУК
  // ============================================================================

  private setupAudio(): void {
    this.soundtrack = this.sound.add('soundtrack', {
      loop: true,
      volume: 0,
    }) as VolumeControlledSound;

    this.applyAudioSettings();

    // Браузеры разрешают звук только после жеста пользователя.
    const startMusic = (): void => this.startMusic();
    this.input.once('pointerdown', startMusic);
    this.input.keyboard?.once('keydown', startMusic);
  }

  private startMusic(): void {
    if (this.musicStarted || !this.soundtrack) return;

    this.musicStarted = true;
    this.soundtrack.play();
    this.fadeMusicTo(this.settings.muted ? 0 : this.settings.musicVolume);
  }

  private applyAudioSettings(): void {
    if (!this.soundtrack) return;

    this.musicFade?.remove();
    this.musicFade = undefined;
    this.soundtrack.setVolume(this.settings.muted ? 0 : this.settings.musicVolume);
  }

  private fadeMusicTo(target: number): void {
    if (!this.soundtrack) return;

    this.musicFade?.remove();
    const fade = { value: 0 };
    this.musicFade = this.tweens.add({
      targets: fade,
      value: target,
      duration: 1200,
      ease: 'Sine.easeOut',
      onUpdate: () => this.soundtrack?.setVolume(fade.value),
      onComplete: () => {
        this.musicFade = undefined;
      },
    });
  }

  private getSettingsController(): SettingsController {
    const controller: SettingsController = {
      settings: this.settings,
      update: (next: GameSettings) => {
        controller.settings = next;
        this.settings = next;
        saveSettings(next);
        this.applyAudioSettings();
      },
    };
    return controller;
  }

  /** Пересчитывает характеристики стража из купленных улучшений. */
  private applyProfileBonuses(): void {
    const bonuses = getUpgradeBonuses(this.profile.upgrades);
    this.maxHp = GAME_CONFIG.PLAYER.MAX_HP + bonuses.maxHpBonus;
    this.startMana = GAME_CONFIG.COMBAT.START_MANA + bonuses.startManaBonus;
    this.lightMultiplier = bonuses.lightMultiplier;
  }

  private getProfileController(): ProfileController {
    return {
      getProfile: () => this.profile,
      buyUpgrade: (key: UpgradeKey) => {
        const result = purchaseUpgrade(this.profile, key);
        if (result.ok) {
          this.profile = result.profile;
          saveProfile(this.profile);
          this.applyProfileBonuses();
        }
        return { ok: result.ok, message: result.message };
      },
    };
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000;

    if (this.touchControls) {
      this.touchControls.setVisible(this.isTouchDevice && this.gameState === 'PLAYING');
    }

    if (this.gameState !== 'PLAYING') {
      if (this.touchMovePointerId !== null || this.touchAimPointerId !== null) {
        this.resetTouchInput();
      }
      // В меню рыцарь медленно поворачивается для красоты. На паузе,
      // на экране победы и на экране смерти он остаётся на месте.
      if (this.gameState === 'START') {
        this.player.setRotation(Math.sin(time * 0.0008) * 0.4);
      }
      // Вне боя фигура просто дышит, без пыли и наклонов.
      this.updateFigureAnimation(dt, 0, 0);
      this.player.setAlpha(1);
      this.invulnRing.setVisible(false);
      this.lowHpVignette.setVisible(false);
      this.renderDarkness();
      return;
    }

    this.survivalTime += dt;
    this.checkPhaseChange();
    this.updateInvulnerability(time, dt);
    this.updateTorchDrain(dt);

    this.mana = Math.min(
      GAME_CONFIG.COMBAT.MAX_MANA,
      this.mana + GAME_CONFIG.COMBAT.PASSIVE_MANA_REGEN * dt
    );

    this.handlePlayerMovement(dt);
    this.handleShooting(dt);
    this.updateWaves(dt);
    this.updateProjectiles(dt);
    this.updateEnemyProjectiles(dt);
    this.updateManaOrbs(dt, time);
    this.updateEnemies(dt, time);
    this.updateLowHpVignette(time);
    this.renderDarkness();
    this.updateHUD(dt);
  }

  /** Пульсирующая красная рамка при низком здоровье. */
  private updateLowHpVignette(time: number): void {
    if (this.hp / this.maxHp > 0.34) {
      this.lowHpVignette.setVisible(false);
      return;
    }

    this.lowHpVignette
      .setVisible(true)
      .setAlpha(0.24 + Math.sin(time * 0.006) * 0.1);
  }

  // ============================================================================
  // 1. СВЕТ И ТЬМА
  // ============================================================================

  private setupLightingSystem(): void {
    const { WIDTH, HEIGHT } = GAME_CONFIG.WORLD;
    this.darknessOverlay = this.add.renderTexture(0, 0, WIDTH, HEIGHT)
      .setOrigin(0, 0)
      .setDepth(20);

    // Кисти не добавляются на сцену: они нужны только как источник для erase.
    // В типах Phaser 4 у GameObjectConfig нет поля key, хотя creator его читает.
    this.lightBrush = this.createLightBrush();
    this.smallLightBrush = this.createLightBrush().setDisplaySize(140, 140);
    this.torchLightBrush = this.createLightBrush().setDisplaySize(210, 210);

    // Кольца света лежат поверх тьмы (глубина 20), но под HUD.
    const ringColor = PHASES[this.currentPhase].ringColor;
    this.lightRingSoft = this.add
      .circle(this.playerX, this.playerY, this.currentLightRadius, ringColor, 0)
      .setStrokeStyle(7, ringColor, 1)
      .setDepth(20.5)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.lightRingBright = this.add
      .circle(this.playerX, this.playerY, this.currentLightRadius, ringColor, 0)
      .setStrokeStyle(1.5, ringColor, 1)
      .setDepth(20.6)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  /** Кисть с прозрачным краем: одна текстура, отдельный объект на каждый размер. */
  private createLightBrush(): Phaser.GameObjects.Image {
    return this.make.image(
      { key: GLOW_TEXTURE_KEY } as Phaser.Types.GameObjects.GameObjectConfig & { key: string },
      false
    );
  }

  /** Меняет радиус света только если он действительно изменился. */
  private setLightRadius(radius: number): void {
    if (Math.abs(radius - this.currentLightRadius) < 0.5) return;
    this.currentLightRadius = radius;
    this.ambientGlow.setDisplaySize(radius * 2.2, radius * 2.2);
  }

  private renderDarkness(): void {
    this.darknessOverlay.clear();
    this.darknessOverlay.fill(
      GAME_CONFIG.LIGHT.DARKNESS_COLOR,
      GAME_CONFIG.LIGHT.DARKNESS_ALPHA
    );

    const radius = this.currentLightRadius;

    this.lightBrush.setDisplaySize(radius * 2.3, radius * 2.3);
    this.darknessOverlay.erase(this.lightBrush, this.playerX, this.playerY);

    for (const p of this.projectiles) {
      this.darknessOverlay.erase(this.smallLightBrush, p.x, p.y);
    }
    for (const orb of this.manaOrbs) {
      this.darknessOverlay.erase(this.smallLightBrush, orb.x, orb.y);
    }

    // Настенные факелы дают небольшие пятна света у стен.
    for (const torch of this.torchLights) {
      this.darknessOverlay.erase(this.torchLightBrush, torch.x, torch.y);
    }

    this.updateLightRings(radius);
  }

  /** Двойной контур по границе света: радиус видно даже на тёмном фоне. */
  private updateLightRings(radius: number): void {
    this.lightRingSoft
      .setPosition(this.playerX, this.playerY)
      .setRadius(radius + 4)
      .setAlpha(0.16);
    this.lightRingBright
      .setPosition(this.playerX, this.playerY)
      .setRadius(radius)
      .setAlpha(0.55);
  }

  private updateTorchDrain(dt: number): void {
    if (this.torchDrainTimer <= 0) return;

    this.torchDrainTimer = Math.max(0, this.torchDrainTimer - dt);
    this.applyCurrentPhase();
  }

  // ============================================================================
  // 2. УПРАВЛЕНИЕ, СТРЕЛЬБА И СИСТЕМА МАНЫ
  // ============================================================================

  private setupInputs(): void {
    if (this.input.keyboard) {
      this.keys = this.input.keyboard.addKeys({
        W: Phaser.Input.Keyboard.KeyCodes.W,
        A: Phaser.Input.Keyboard.KeyCodes.A,
        S: Phaser.Input.Keyboard.KeyCodes.S,
        D: Phaser.Input.Keyboard.KeyCodes.D,
        UP: Phaser.Input.Keyboard.KeyCodes.UP,
        LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
        DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
        RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
        ESC: Phaser.Input.Keyboard.KeyCodes.ESC,
      }) as typeof this.keys;

      // ESC переключает паузу. Phaser не шлёт keydown-ESC на автоповтор,
      // пока объект клавиши есть в addKeys, поэтому хватает одного слушателя.
      this.input.keyboard.on('keydown-ESC', () => this.togglePause());
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.gameState !== 'PLAYING') return;

      // На телефоне касание — это стик или прицел, а не клик мышью.
      if (this.isTouchDevice) {
        this.beginTouch(pointer);
        return;
      }

      if (pointer.leftButtonDown()) {
        this.tryFireProjectile();
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.updateTouchPointer(pointer);
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.endTouchPointer(pointer);
    });

    this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => {
      this.endTouchPointer(pointer);
    });

    // При потере фокуса палец «залипает», поэтому сбрасываем стики.
    this.game.events.on('blur', () => this.resetTouchInput());
    this.game.events.on('hidden', () => this.resetTouchInput());
  }

  // ---------------------------------------------------------- TOUCH-ВВОД
  // Левая половина экрана — стик движения, правая — стик прицела и огня.
  // Верхняя полоса HUD не участвует: там панели и кнопка паузы.

  private beginTouch(pointer: Phaser.Input.Pointer): void {
    if (pointer.y < TOUCH_CONFIG.HUD_SAFE_HEIGHT) return;

    if (pointer.x < GAME_CONFIG.WORLD.WIDTH / 2) {
      if (this.touchMovePointerId !== null) return;
      this.touchMovePointerId = pointer.id;
      this.touchMoveOrigin.set(pointer.x, pointer.y);
      this.touchMove.set(0, 0);
      this.touchControls?.showMove(pointer.x, pointer.y);
      return;
    }

    if (this.touchAimPointerId !== null) return;
    this.touchAimPointerId = pointer.id;
    this.touchAimOrigin.set(pointer.x, pointer.y);
    this.touchAimAngle = null;
    this.touchControls?.showAim(pointer.x, pointer.y);
  }

  private updateTouchPointer(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.touchMovePointerId) {
      const dx = pointer.x - this.touchMoveOrigin.x;
      const dy = pointer.y - this.touchMoveOrigin.y;
      const distance = Math.hypot(dx, dy);
      const limit = TOUCH_CONFIG.JOYSTICK_RADIUS;
      const scale = distance > limit ? limit / distance : 1;

      this.touchMove.set((dx / limit) * scale, (dy / limit) * scale);
      this.touchControls?.updateMove(dx * scale, dy * scale);
      return;
    }

    if (pointer.id === this.touchAimPointerId) {
      this.updateTouchAim(pointer);
    }
  }

  private updateTouchAim(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.touchAimOrigin.x;
    const dy = pointer.y - this.touchAimOrigin.y;
    const distance = Math.hypot(dx, dy);
    const limit = TOUCH_CONFIG.JOYSTICK_RADIUS;
    const scale = distance > limit ? limit / distance : 1;

    this.touchControls?.updateAim(dx * scale, dy * scale);

    // В мёртвой зоне прицел не меняется, огонь не идёт.
    if (distance < limit * TOUCH_CONFIG.AIM_DEADZONE) {
      this.touchAimAngle = null;
      return;
    }

    this.touchAimAngle = this.applyAimAssist(Math.atan2(dy, dx));
  }

  /**
   * Слабая доводка к ближайшему врагу: снаряд подтягивается к нему, только
   * если тот попадает в узкий конус вокруг выбранного направления.
   */
  private applyAimAssist(angle: number): number {
    const { TOUCH_AIM_ASSIST_ANGLE, TOUCH_AIM_ASSIST_STRENGTH } = GAME_CONFIG.COMBAT;

    let nearest: EnemyEntity | null = null;
    let nearestDistance = Infinity;
    for (const enemy of this.enemies) {
      const distance = Phaser.Math.Distance.Between(this.playerX, this.playerY, enemy.x, enemy.y);
      if (distance < nearestDistance) {
        nearest = enemy;
        nearestDistance = distance;
      }
    }
    if (!nearest) return angle;

    const targetAngle = Phaser.Math.Angle.Between(this.playerX, this.playerY, nearest.x, nearest.y);
    const delta = Phaser.Math.Angle.Wrap(targetAngle - angle);
    if (Math.abs(delta) > TOUCH_AIM_ASSIST_ANGLE) return angle;

    return angle + delta * TOUCH_AIM_ASSIST_STRENGTH;
  }

  private endTouchPointer(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.touchMovePointerId) {
      this.touchMovePointerId = null;
      this.touchMove.set(0, 0);
      this.touchControls?.hideMove();
    }

    if (pointer.id === this.touchAimPointerId) {
      this.touchAimPointerId = null;
      this.touchAimAngle = null;
      this.touchControls?.hideAim();
    }
  }

  private resetTouchInput(): void {
    this.touchMovePointerId = null;
    this.touchAimPointerId = null;
    this.touchMove.set(0, 0);
    this.touchAimAngle = null;
    this.touchControls?.hideMove();
    this.touchControls?.hideAim();
  }

  private handlePlayerMovement(dt: number): void {
    let vx = 0;
    let vy = 0;

    if (this.touchMovePointerId !== null) {
      // Аналоговый стик: скорость зависит от того, как далеко отведён палец.
      if (Math.hypot(this.touchMove.x, this.touchMove.y) >= TOUCH_CONFIG.DEADZONE) {
        vx = this.touchMove.x;
        vy = this.touchMove.y;
      }
    } else {
      if (this.keys.A.isDown || this.keys.LEFT.isDown) vx -= 1;
      if (this.keys.D.isDown || this.keys.RIGHT.isDown) vx += 1;
      if (this.keys.W.isDown || this.keys.UP.isDown) vy -= 1;
      if (this.keys.S.isDown || this.keys.DOWN.isDown) vy += 1;

      if (vx !== 0 && vy !== 0) {
        vx *= Math.SQRT1_2;
        vy *= Math.SQRT1_2;
      }
    }

    const { WIDTH, HEIGHT, PADDING } = GAME_CONFIG.WORLD;
    // Замедление действует в фазе, когда факел погас (см. core/phases.ts)
    const speed = GAME_CONFIG.PLAYER.SPEED * PHASES[this.currentPhase].playerSpeedFactor;

    this.playerX = Phaser.Math.Clamp(this.playerX + vx * speed * dt, PADDING, WIDTH - PADDING);
    this.playerY = Phaser.Math.Clamp(this.playerY + vy * speed * dt, PADDING, HEIGHT - PADDING);

    this.player.setPosition(this.playerX, this.playerY);
    this.playerVisual.shadow.setPosition(this.playerX + 2, this.playerY + 13);
    this.ambientGlow.setPosition(this.playerX, this.playerY);

    this.updateFigureAnimation(dt, vx, vy);

    if (this.touchAimPointerId !== null && this.touchAimAngle !== null) {
      this.aimAngle = this.touchAimAngle;
    } else if (!this.isTouchDevice) {
      const pointer = this.input.activePointer;
      this.aimAngle = Phaser.Math.Angle.Between(this.playerX, this.playerY, pointer.worldX, pointer.worldY);
    }

    this.player.setRotation(this.aimAngle);
  }

  /**
   * Живая фигура рыцаря: при движении корпус пружинит и наклоняется в
   * сторону шага, в покое — медленно дышит. Пыль выбрасывается шагами.
   */
  private updateFigureAnimation(dt: number, vx: number, vy: number): void {
    const figure = this.playerVisual.figure;
    const moving = vx !== 0 || vy !== 0;
    this.figureAnimTime += dt;

    if (moving) {
      // Две пульсации в секунду: корпус подпрыгивает, плечи покачиваются.
      const phase = this.figureAnimTime * Math.PI * 2 * 2;
      figure.y = Math.sin(phase) * WALK_BOB_AMPLITUDE;
      figure.rotation = Math.sin(phase) * WALK_SWAY_AMPLITUDE;

      // Наклон в сторону движения: локальный поворот фигуры плюс прицел.
      const moveAngle = Math.atan2(vy, vx);
      figure.rotation += Phaser.Math.Angle.Wrap(moveAngle - this.aimAngle) * WALK_LEAN_FACTOR;

      this.stepDustTimer -= dt;
      if (this.stepDustTimer <= 0) {
        this.stepDustTimer = STEP_DUST_INTERVAL;
        this.spawnStepDust();
      }
    } else {
      this.stepDustTimer = 0;
      figure.y = Math.sin(this.figureAnimTime * Math.PI * 2 * 0.35) * IDLE_BREATH_AMPLITUDE;
      figure.rotation = Phaser.Math.Linear(figure.rotation, 0, Math.min(1, dt * 8));
    }
  }

  /** Облачко пыли под ногами: маленький круг растёт и растворяется. */
  private spawnStepDust(): void {
    const dust = this.add
      .circle(this.playerX, this.playerY + 14, 6, 0x94a3b8, 0.35)
      .setDepth(11.5);

    this.tweens.add({
      targets: dust,
      y: dust.y + 8,
      scale: 1.9,
      alpha: 0,
      duration: 420,
      ease: 'Quad.easeOut',
      onComplete: () => dust.destroy(),
    });
  }

  private handleShooting(dt: number): void {
    if (this.fireCooldown > 0) {
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    }

    this.cooldownArc.clear();
    if (this.fireCooldown > 0) {
      const progress = 1 - this.fireCooldown / this.getFireCooldown();
      this.cooldownArc.lineStyle(2.5, 0x38bdf8, 0.8);
      this.cooldownArc.beginPath();
      this.cooldownArc.arc(
        this.playerX,
        this.playerY,
        24,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * progress,
        false
      );
      this.cooldownArc.strokePath();
    }

    const pointer = this.input.activePointer;
    const pointerFire = !pointer.wasTouch && pointer.leftButtonDown();
    // Стреляем, только когда стик прицела выведен за мёртвую зону.
    const touchFire = this.isTouchDevice && this.touchAimAngle !== null;
    if ((this.keys.SPACE.isDown || pointerFire || touchFire) && this.fireCooldown <= 0) {
      this.tryFireProjectile();
    }
  }

  /** Перезарядка с учётом дара «Скорое пламя». */
  private getFireCooldown(): number {
    return this.boons.has('RAPID_FIRE')
      ? GAME_CONFIG.COMBAT.FIRE_COOLDOWN * 0.75
      : GAME_CONFIG.COMBAT.FIRE_COOLDOWN;
  }

  private tryFireProjectile(): void {
    if (this.fireCooldown > 0) return;

    if (this.mana < GAME_CONFIG.COMBAT.SHOT_MANA_COST) {
      this.fireCooldown = 0.25;
      showFloatingText(this, this.playerX, this.playerY - 28, 'Недостаточно маны!', '#38bdf8');
      return;
    }

    this.mana -= GAME_CONFIG.COMBAT.SHOT_MANA_COST;
    this.fireCooldown = this.getFireCooldown();
    this.shotsFired++;

    this.spawnPlayerProjectile(this.aimAngle);

    // «Раздвоенный луч»: второй снаряд летит чуть вбок.
    if (this.boons.has('DOUBLE_SHOT')) {
      this.spawnPlayerProjectile(this.aimAngle + 0.13);
    }
  }

  private spawnPlayerProjectile(angle: number): void {
    const { PROJECTILE_SPEED, PROJECTILE_LIFE, PROJECTILE_RADIUS } = GAME_CONFIG.COMBAT;
    const spawnX = this.playerX + Math.cos(angle) * 26;
    const spawnY = this.playerY + Math.sin(angle) * 26;

    const container = this.add.container(spawnX, spawnY).setDepth(25);
    const halo = this.add
      .circle(0, 0, PROJECTILE_RADIUS + 10, 0x38bdf8, 0.22)
      .setBlendMode(Phaser.BlendModes.ADD);
    const outerGlow = this.add.circle(0, 0, PROJECTILE_RADIUS + 4, 0x0284c7, 0.45);
    const core = this.add.circle(0, 0, PROJECTILE_RADIUS, 0xe0f2fe).setStrokeStyle(2, 0x38bdf8);
    container.add([halo, outerGlow, core]);

    createShotFlash(this, spawnX, spawnY);

    this.projectiles.push({
      container,
      x: spawnX,
      y: spawnY,
      vx: Math.cos(angle) * PROJECTILE_SPEED,
      vy: Math.sin(angle) * PROJECTILE_SPEED,
      life: PROJECTILE_LIFE,
      pierce: this.boons.has('PIERCE') ? 1 : 0,
    });
  }

  private updateProjectiles(dt: number): void {
    const { WIDTH, HEIGHT } = GAME_CONFIG.WORLD;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.container.setPosition(p.x, p.y);

      if (Math.random() < 0.45) {
        const spark = this.add.circle(p.x, p.y, 3, 0x38bdf8, 0.7).setDepth(18);
        this.tweens.add({
          targets: spark,
          alpha: 0,
          scale: 0,
          duration: 160,
          onComplete: () => spark.destroy(),
        });
      }

      if (p.life <= 0 || p.x < 18 || p.x > WIDTH - 18 || p.y < 18 || p.y > HEIGHT - 18) {
        p.container.destroy();
        this.projectiles.splice(i, 1);
      }
    }
  }

  // ============================================================================
  // 3. КРИСТАЛЛЫ МАНЫ
  // ============================================================================

  private spawnManaOrb(x: number, y: number, value: number): void {
    const container = this.add.container(x, y).setDepth(14);

    const aura = this.add.circle(0, 0, 16, 0x38bdf8, 0.18).setBlendMode(Phaser.BlendModes.ADD);
    const diamond = this.add.rectangle(0, 0, 10, 10, 0x38bdf8)
      .setRotation(Math.PI / 4)
      .setStrokeStyle(1.5, 0xe0f2fe);

    container.add([aura, diamond]);

    this.tweens.add({
      targets: diamond,
      rotation: Math.PI / 4 + Math.PI * 2,
      duration: 4200,
      repeat: -1,
    });

    this.manaOrbs.push({
      container,
      x,
      y,
      value,
      life: GAME_CONFIG.MANA_ORB.LIFETIME,
    });
  }

  private updateManaOrbs(dt: number, time: number): void {
    const { MAGNET_RADIUS, PICKUP_RADIUS, MAGNET_SPEED } = GAME_CONFIG.MANA_ORB;

    for (let i = this.manaOrbs.length - 1; i >= 0; i--) {
      const orb = this.manaOrbs[i];
      orb.life -= dt;
      orb.container.setScale(0.9 + Math.sin(time * 0.01 + i) * 0.15);

      const dist = Phaser.Math.Distance.Between(orb.x, orb.y, this.playerX, this.playerY);

      if (dist < MAGNET_RADIUS) {
        const angle = Phaser.Math.Angle.Between(orb.x, orb.y, this.playerX, this.playerY);
        orb.x += Math.cos(angle) * MAGNET_SPEED * dt;
        orb.y += Math.sin(angle) * MAGNET_SPEED * dt;
        orb.container.setPosition(orb.x, orb.y);
      }

      if (dist < PICKUP_RADIUS) {
        this.mana = Math.min(GAME_CONFIG.COMBAT.MAX_MANA, this.mana + orb.value);
        this.manaCollected += orb.value;
        showFloatingText(this, this.playerX, this.playerY - 24, `+${orb.value} Маны`, '#38bdf8');
        orb.container.destroy();
        this.manaOrbs.splice(i, 1);
        continue;
      }

      if (orb.life <= 0) {
        orb.container.destroy();
        this.manaOrbs.splice(i, 1);
      }
    }
  }

  // ============================================================================
  // 4. ВОЛНЫ
  // ============================================================================

  private updateWaves(dt: number): void {
    if (this.waveTransitionTimer > 0) {
      this.waveTransitionTimer -= dt;
      if (this.waveTransitionTimer <= 0) {
        this.beginWave(this.waveIndex + 1);
      }
      return;
    }

    if (!this.waveActive) return;

    const wave = this.level.waves[this.waveIndex];
    if (!wave) return;

    // Боссовая волна заканчивается смертью босса в updateEnemies,
    // а до тех пор из разломов продолжает лезть свита.
    if (wave.boss) {
      this.updateBossAdds(dt, wave);
      return;
    }

    if (this.waveSpawned < wave.spawnCount) {
      this.waveSpawnTimer -= dt;

      if (this.waveSpawnTimer <= 0 && this.enemies.length < wave.maxAlive) {
        const guaranteed = this.guaranteedQueue.shift();
        const type = guaranteed ?? this.pickWaveEnemy(wave);
        this.spawnEnemy(type);
        this.waveSpawned++;
        this.waveSpawnTimer = wave.spawnInterval;
      }
    }

    if (this.waveSpawned >= wave.spawnCount && this.enemies.length === 0) {
      this.completeWave();
    }
  }

  /** Свита босса: не больше maxAlive живых мобов, новые появляются по таймеру. */
  private updateBossAdds(dt: number, wave: WaveConfig): void {
    const adds = wave.adds;
    if (!adds || !this.enemies.some((e) => e.isBoss)) return;

    const alive = this.enemies.filter((e) => !e.isBoss).length;
    this.bossAddsTimer -= dt;

    if (this.bossAddsTimer > 0 || alive >= adds.maxAlive) return;

    this.spawnEnemy(this.pickWeightedEnemy(adds.weights));
    this.bossAddsTimer = adds.spawnInterval;
  }

  private pickWaveEnemy(wave: WaveConfig): EnemyTypeKey {
    return this.pickWeightedEnemy(wave.weights);
  }

  private pickWeightedEnemy(
    weights: Partial<Record<EnemyTypeKey, number>> | undefined
  ): EnemyTypeKey {
    const entries = Object.entries(weights ?? {}) as [EnemyTypeKey, number][];
    const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
    if (totalWeight <= 0) return 'SWARMER';

    let roll = Phaser.Math.Between(1, totalWeight);
    for (const [key, weight] of entries) {
      if (roll <= weight) return key;
      roll -= weight;
    }
    return 'SWARMER';
  }

  private beginWave(index: number): void {
    const wave = this.level.waves[index];
    if (!wave) return;

    this.waveIndex = index;

    // Метрика: первый заход на этаж и выход босса.
    const floor = getFloorIndex(this.level, index) + 1;
    if (floor > this.maxFloorReached) {
      this.maxFloorReached = floor;
      if (floor > 1) {
        track('floor_reached', {
          floor,
          location: this.levelIndex + 1,
          attempt: this.runAttempt,
        });
      }
    }
    if (wave.boss) {
      track('boss_reached', {
        location: this.levelIndex + 1,
        attempt: this.runAttempt,
      });
    }

    this.waveSpawned = 0;
    this.waveSpawnTimer = 1;
    this.waveTransitionTimer = 0;
    this.waveActive = true;
    this.guaranteedQueue = [...(wave.guaranteed ?? [])];
    this.bossAddsTimer = wave.adds?.startDelay ?? 0;

    const detail = wave.boss
      ? 'Хранитель крипты вышел на охоту · не дайте факелу погаснуть'
      : `${wave.spawnCount} теней · не дайте факелу погаснуть`;
    showWaveNotice(this, index + 1, this.level.waves.length, wave.name, detail);

    if (wave.boss) {
      this.spawnBoss(wave.boss);
      for (const escort of wave.escorts ?? []) {
        for (let i = 0; i < escort.count; i++) {
          this.spawnEnemy(escort.type);
        }
      }
    }
  }

  private completeWave(): void {
    this.waveActive = false;
    this.clearEnemyProjectiles();
    hideBossBar(this.hud);

    if (this.waveIndex >= this.level.waves.length - 1) {
      this.triggerVictory();
      return;
    }

    // Короткая передышка между волнами.
    this.hp = Math.min(this.maxHp, this.hp + 1);
    this.mana = Math.min(GAME_CONFIG.COMBAT.MAX_MANA, this.mana + 25);

    // Конец этажа: вместо таймера показываем выбор дара.
    if (isFloorEnd(this.level, this.waveIndex)) {
      this.showGiftChoice();
      return;
    }

    this.waveTransitionTimer = 2.5;
    showFloatingText(this, this.playerX, this.playerY - 34, 'Волна пройдена', '#fbbf24');
  }

  /** Выбор дара после этажа: игра замирает до клика по карточке. */
  private showGiftChoice(): void {
    this.gameState = 'GIFT';
    const choices = pickBoonChoices(this.boons);
    // Метрика: какие карточки предложили — чтобы считать долю выбора каждой.
    track('boon_offer', {
      floor: getFloorIndex(this.level, this.waveIndex) + 1,
      cards: choices.map((boon) => boon.key).join(','),
      attempt: this.runAttempt,
    });
    showBoonChoice(this, this.uiOverlay, choices, (key) => this.takeBoon(key));
  }

  private takeBoon(key: BoonKey): void {
    track('boon_pick', {
      boon: key,
      floor: getFloorIndex(this.level, this.waveIndex) + 1,
      attempt: this.runAttempt,
    });
    this.boons.add(key);

    // Стойкость повышает запас сразу, остальные дары читаются в бою.
    if (key === 'VITALITY') {
      this.maxHp += 1;
      this.hp = Math.min(this.maxHp, this.hp + 1);
    }

    this.uiOverlay.removeAll(true);
    this.gameState = 'PLAYING';
    this.beginWave(this.waveIndex + 1);
  }

  private spawnEnemy(type: EnemyTypeKey): void {
    const cfg = GAME_CONFIG.ENEMIES[type];
    const crack = Phaser.Utils.Array.GetRandom(this.cracks);
    const visual = createEnemyVisual(this, type, cfg, crack.x, crack.y);

    if (visual.hpBar) {
      const maxWidth = visual.hpBar.width;
      const barY = crack.y - cfg.radius - 14;
      visual.hpBar.setData('maxWidth', maxWidth);
      visual.hpBar.setPosition(crack.x - maxWidth / 2, barY);
    }
    if (visual.hpBarBack) {
      visual.hpBarBack.setPosition(crack.x, crack.y - cfg.radius - 14);
    }

    this.enemies.push({
      type,
      config: cfg,
      behavior: cfg.behavior,
      container: visual.container,
      bodyShape: visual.bodyShape,
      eyes: visual.eyes,
      glow: visual.glow,
      hpBar: visual.hpBar,
      hpBarBack: visual.hpBarBack,
      x: crack.x,
      y: crack.y,
      hp: cfg.hp,
      maxHp: cfg.hp,
      inLight: false,
      attackTimer: cfg.attackCooldown ?? 0,
      specialTimer: 0,
      contactCooldown: 0,
      state: 'CHASE',
      stateTimer: 0,
      chargeAngle: 0,
      isBoss: false,
      hasEnraged: false,
    });
  }

  private spawnBoss(key: BossTypeKey): void {
    const cfg = BOSS_CONFIG[key];
    // Босс крупный, поэтому появляется в глубине зала, а не из разлома у стены.
    const { WIDTH, HEIGHT } = GAME_CONFIG.WORLD;
    const spawnX = WIDTH / 2;
    const spawnY = HEIGHT * 0.3;
    const visual = createBossVisual(this, key, cfg, spawnX, spawnY);

    this.enemies.push({
      type: key,
      config: cfg,
      behavior: 'BOSS',
      container: visual.container,
      bodyShape: visual.bodyShape,
      eyes: visual.eyes,
      glow: visual.glow,
      x: spawnX,
      y: spawnY,
      hp: cfg.hp,
      maxHp: cfg.hp,
      inLight: false,
      attackTimer: 2.5,
      specialTimer: 4.5,
      contactCooldown: 0,
      state: 'CHASE',
      stateTimer: 0,
      chargeAngle: 0,
      isBoss: true,
      hasEnraged: false,
    });

    showFloatingText(this, spawnX, spawnY - cfg.radius - 20, cfg.name, '#fbbf24');
  }

  // ============================================================================
  // 5. ВРАГИ И ИХ ПОВЕДЕНИЕ
  // ============================================================================

  private updateEnemies(dt: number, time: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dist = Phaser.Math.Distance.Between(e.x, e.y, this.playerX, this.playerY);
      const angle = Phaser.Math.Angle.Between(e.x, e.y, this.playerX, this.playerY);

      e.contactCooldown = Math.max(0, e.contactCooldown - dt);
      this.updateEnemyVisual(e, dist, time);

      let removed = false;

      if (e.behavior === 'CHASER') {
        removed = this.updateChaserEnemy(e, dt, angle, i, time);
      } else if (e.behavior === 'RANGED') {
        removed = this.updateRangedEnemy(e, dt, dist, angle);
      } else if (e.behavior === 'EXPLODER') {
        removed = this.updateExploderEnemy(e, dt, dist, angle, time);
      } else if (e.behavior === 'BOSS') {
        this.updateBoss(e, dt, dist, angle, time);
      }

      if (removed) {
        e.container.destroy();
        // Полоски здоровья живут отдельно от контейнера врага,
        // поэтому их нужно убирать и при взрыве, и при обычной смерти.
        e.hpBar?.destroy();
        e.hpBarBack?.destroy();
        this.enemies.splice(i, 1);
        if (this.gameState !== 'PLAYING') return;
        continue;
      }

      if (this.gameState !== 'PLAYING') return;

      // Попадания снарядов игрока.
      let killed = false;
      for (let j = this.projectiles.length - 1; j >= 0; j--) {
        const p = this.projectiles[j];
        const hitDist = e.config.radius + GAME_CONFIG.COMBAT.PROJECTILE_RADIUS;

        if (Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y) <= hitDist) {
          if (p.hitEnemies?.includes(e)) continue;

          if (p.pierce > 0) {
            // «Пронзающая искра»: снаряд остаётся и летит дальше.
            p.pierce -= 1;
            (p.hitEnemies ??= []).push(e);
          } else {
            p.container.destroy();
            this.projectiles.splice(j, 1);
          }

          e.hp -= GAME_CONFIG.COMBAT.PROJECTILE_DAMAGE;
          this.shotsHit++;

          if (e.isBoss) {
            // Полоса босса обновляется каждый кадр в updateHUD().
          } else if (e.hpBar) {
            const maxWidth = (e.hpBar.getData('maxWidth') as number | undefined) ?? 34;
            e.hpBar.width = Math.max(0, (e.hp / e.maxHp) * maxWidth);
            e.hpBar.setVisible(true);
            e.hpBarBack?.setVisible(true);
          }

          if (e.hp <= 0) {
            killed = true;
            break;
          }

          createHitSpark(this, e.x, e.y);
        }
      }

      if (killed) {
        const wasBoss = e.isBoss;
        this.killEnemy(e, i, true);
        if (wasBoss) {
          this.handleBossDefeated();
          return;
        }
        continue;
      }
    }
  }

  private updateEnemyVisual(e: EnemyEntity, distToPlayer: number, time: number): void {
    const isInsideLight = distToPlayer <= this.currentLightRadius;
    e.inLight = isInsideLight;

    if (isInsideLight) {
      e.bodyShape.setStrokeStyle(e.isBoss ? 4 : 2.5, e.config.lightStrokeColor);
      e.eyes.forEach((eye) => eye.setFillStyle(0xfef08a));
    } else {
      e.bodyShape.setStrokeStyle(e.isBoss ? 4 : 2.5, e.config.strokeColor);
      e.eyes.forEach((eye) => eye.setFillStyle(e.config.eyeColor));
    }

    if (e.hpBar) {
      const maxWidth = (e.hpBar.getData('maxWidth') as number | undefined) ?? 34;
      const barY = e.y - e.config.radius - 14;
      e.hpBar.setPosition(e.x - maxWidth / 2, barY);
      e.hpBarBack?.setPosition(e.x, barY);
    }

    // Мученик пульсирует перед взрывом.
    if (e.behavior === 'EXPLODER' && e.state === 'WINDUP') {
      const pulse = 1.15 + Math.sin(time * 0.03) * 0.12;
      e.container.setScale(pulse);
      if (e.glow) e.glow.setScale(1.2 + Math.sin(time * 0.04) * 0.3);
    }
  }

  private updateChaserEnemy(
    e: EnemyEntity,
    dt: number,
    angle: number,
    index: number,
    time: number
  ): boolean {
    const speedMultiplier = e.inLight ? e.config.lightSlowFactor : 1;
    const speed = e.config.speed * speedMultiplier;
    const wobble = e.type === 'SWARMER' ? Math.sin(time * 0.012 + index) * 0.35 : 0;

    e.x += Math.cos(angle + wobble) * speed * dt;
    e.y += Math.sin(angle + wobble) * speed * dt;
    this.clampEnemyPosition(e);
    e.container.setPosition(e.x, e.y);
    e.container.setRotation(angle);

    return this.handleMeleeContact(e);
  }

  private updateRangedEnemy(
    e: EnemyEntity,
    dt: number,
    dist: number,
    angle: number
  ): boolean {
    if (this.handleMeleeContact(e)) return true;

    const cfg = e.config;
    const range = cfg.attackRange ?? 320;
    const speed = cfg.speed * (e.inLight ? cfg.lightSlowFactor : 1);

    if (dist > range * 0.9) {
      e.x += Math.cos(angle) * speed * dt;
      e.y += Math.sin(angle) * speed * dt;
    } else if (dist < range * 0.55) {
      e.x -= Math.cos(angle) * speed * dt;
      e.y -= Math.sin(angle) * speed * dt;
    }

    this.clampEnemyPosition(e);
    e.container.setPosition(e.x, e.y);
    e.container.setRotation(angle);

    // В свету враг стреляет реже: таймер идёт медленнее.
    e.attackTimer -= dt * (e.inLight ? 0.7 : 1);

    if (e.attackTimer <= 0 && dist < range * 1.15) {
      this.fireEnemyProjectile(e, angle);
      e.attackTimer = cfg.attackCooldown ?? 2.2;
    }

    return false;
  }

  private updateExploderEnemy(
    e: EnemyEntity,
    dt: number,
    dist: number,
    angle: number,
    time: number
  ): boolean {
    const cfg = e.config;

    if (e.state === 'CHASE') {
      const speed = cfg.speed * (e.inLight ? cfg.lightSlowFactor : 1);
      e.x += Math.cos(angle) * speed * dt;
      e.y += Math.sin(angle) * speed * dt;
      this.clampEnemyPosition(e);
      e.container.setPosition(e.x, e.y);
      e.container.setRotation(angle);

      if (dist < 95) {
        e.state = 'WINDUP';
        e.stateTimer = (cfg.explosionWindup ?? 0.85) * (e.inLight ? 1.4 : 1);
        e.container.setScale(1.15);
      }
      return false;
    }

    if (e.state === 'WINDUP') {
      e.stateTimer -= dt;
      const pulse = 1.15 + Math.sin(time * 0.03) * 0.12;
      e.container.setScale(pulse);

      if (e.stateTimer <= 0) {
        const radius = cfg.explosionRadius ?? 120;
        createExplosionEffect(this, e.x, e.y, radius);
        this.cameras.main.shake(220, 0.012);
        if (dist < radius) {
          this.damagePlayer(1);
        }
        return true;
      }
    }

    return false;
  }

  private updateBoss(
    e: EnemyEntity,
    dt: number,
    dist: number,
    angle: number,
    time: number
  ): void {
    const cfg = e.config as BossConfig;

    // Ярость на половине HP: все боссы ускоряются, а Пожиратель зовёт сталкеров.
    if (!e.hasEnraged && e.hp <= e.maxHp * cfg.enrageThreshold) {
      e.hasEnraged = true;
      showFloatingText(this, e.x, e.y - cfg.radius - 18, 'ЯРОСТЬ', '#ef4444');
      this.cameras.main.shake(260, 0.01);
      if (cfg.mechanic === 'CHARGER') {
        for (let i = 0; i < 2; i++) {
          this.spawnEnemy('STALKER');
        }
      }
    }

    if (cfg.mechanic === 'SHOOTER') {
      this.updateBossShooter(e, cfg, dt, dist, angle);
    } else if (cfg.mechanic === 'SUMMONER') {
      this.updateBossSummoner(e, cfg, dt, dist, angle);
    } else {
      this.updateBossCharger(e, cfg, dt, dist, angle, time);
    }

    this.applyBossContactDamage(e, cfg);
  }

  /** CHARGER: медленно идёт, гасит факел и делает рывок. */
  private updateBossCharger(
    e: EnemyEntity,
    cfg: BossConfig,
    dt: number,
    dist: number,
    angle: number,
    time: number
  ): void {
    if (e.state === 'CHASE') {
      const speed = cfg.speed * (e.inLight ? cfg.lightSlowFactor : 1) * (e.hasEnraged ? 1.2 : 1);
      e.x += Math.cos(angle) * speed * dt;
      e.y += Math.sin(angle) * speed * dt;
      this.clampEnemyPosition(e);
      e.container.setPosition(e.x, e.y);
      e.container.setRotation(angle);

      e.attackTimer -= dt;
      e.specialTimer -= dt;

      // Гашение факела.
      if (e.specialTimer <= 0) {
        e.specialTimer = (cfg.drainCooldown ?? 9) * (e.hasEnraged ? 0.8 : 1);
        this.torchDrainTimer = cfg.drainDuration ?? 3;
        this.applyCurrentPhase();
        showFloatingText(this, this.playerX, this.playerY - 36, 'ФАКЕЛ ГАСНЕТ', '#ef4444');
      }

      // Подготовка рывка.
      if (e.attackTimer <= 0 && dist < 520) {
        e.state = 'WINDUP';
        e.stateTimer = 0.8;
        e.chargeAngle = angle;
        e.attackTimer = (cfg.chargeCooldown ?? 6) * (e.hasEnraged ? 0.8 : 1);
        e.container.setScale(1.12);
      }
    } else if (e.state === 'WINDUP') {
      e.stateTimer -= dt;
      e.container.setRotation(angle);
      if (e.glow) e.glow.setScale(1.1 + Math.sin(time * 0.04) * 0.25);

      if (e.stateTimer <= 0) {
        e.state = 'ATTACK';
        e.stateTimer = 0.55;
      }
    } else if (e.state === 'ATTACK') {
      const chargeSpeed = (cfg.chargeSpeed ?? 520) * (e.hasEnraged ? 1.15 : 1);
      e.x += Math.cos(e.chargeAngle) * chargeSpeed * dt;
      e.y += Math.sin(e.chargeAngle) * chargeSpeed * dt;
      this.clampEnemyPosition(e);
      e.container.setPosition(e.x, e.y);
      e.container.setRotation(e.chargeAngle);
      e.stateTimer -= dt;

      if (e.stateTimer <= 0) {
        e.state = 'RECOVER';
        e.stateTimer = 0.8;
        e.container.setScale(1);
      }
    } else {
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        e.state = 'CHASE';
      }
    }
  }

  /** SHOOTER: держит дистанцию и бьёт веером снарядов. */
  private updateBossShooter(
    e: EnemyEntity,
    cfg: BossConfig,
    dt: number,
    dist: number,
    angle: number
  ): void {
    const keepDistance = 300;
    const speed = cfg.speed * (e.inLight ? cfg.lightSlowFactor : 1) * (e.hasEnraged ? 1.15 : 1);

    if (dist > keepDistance + 50) {
      e.x += Math.cos(angle) * speed * dt;
      e.y += Math.sin(angle) * speed * dt;
    } else if (dist < keepDistance - 90) {
      e.x -= Math.cos(angle) * speed * dt;
      e.y -= Math.sin(angle) * speed * dt;
    }

    this.clampEnemyPosition(e);
    e.container.setPosition(e.x, e.y);
    e.container.setRotation(angle);

    e.attackTimer -= dt;
    if (e.attackTimer > 0) return;

    const count = cfg.shotCount ?? 3;
    const spread = cfg.shotSpread ?? 0.5;
    const shotSpeed = cfg.shotSpeed ?? 250;
    for (let i = 0; i < count; i++) {
      const offset = count > 1 ? -spread / 2 + (spread * i) / (count - 1) : 0;
      this.fireEnemyProjectile(e, angle + offset, shotSpeed);
    }

    e.attackTimer = (cfg.shotCooldown ?? 2.6) * (e.hasEnraged ? 0.7 : 1);
    if (e.glow) {
      e.glow.setScale(1.3);
      this.tweens.add({
        targets: e.glow,
        scale: 1,
        duration: 240,
        ease: 'Quad.easeOut',
      });
    }
  }

  /** SUMMONER: держит дистанцию и по таймеру зовёт свиту. */
  private updateBossSummoner(
    e: EnemyEntity,
    cfg: BossConfig,
    dt: number,
    dist: number,
    angle: number
  ): void {
    const keepDistance = 240;
    const speed = cfg.speed * (e.inLight ? cfg.lightSlowFactor : 1) * (e.hasEnraged ? 1.2 : 1);

    if (dist > keepDistance + 50) {
      e.x += Math.cos(angle) * speed * dt;
      e.y += Math.sin(angle) * speed * dt;
    } else if (dist < keepDistance - 70) {
      e.x -= Math.cos(angle) * speed * dt;
      e.y -= Math.sin(angle) * speed * dt;
    }

    this.clampEnemyPosition(e);
    e.container.setPosition(e.x, e.y);
    e.container.setRotation(angle);

    e.specialTimer -= dt;
    if (e.specialTimer > 0) return;

    e.specialTimer = (cfg.summonInterval ?? 6) * (e.hasEnraged ? 0.7 : 1);
    e.container.setScale(1.18);
    this.tweens.add({
      targets: e.container,
      scale: 1,
      duration: 260,
      ease: 'Quad.easeOut',
    });
    showFloatingText(this, e.x, e.y - cfg.radius - 16, 'РОЙ ПРОБУЖДАЕТСЯ', '#a3e635');

    const summonType = cfg.summonType ?? 'SWARMER';
    for (let i = 0; i < (cfg.summonCount ?? 2); i++) {
      this.spawnEnemy(summonType);
    }
  }

  /** Контактный урон босса: у рывка своя цифра, у остальных — обычная. */
  private applyBossContactDamage(e: EnemyEntity, cfg: BossConfig): void {
    const contactDist = Phaser.Math.Distance.Between(e.x, e.y, this.playerX, this.playerY);
    if (
      contactDist < cfg.radius + GAME_CONFIG.PLAYER.RADIUS &&
      this.invulnTimer <= 0 &&
      e.contactCooldown <= 0
    ) {
      const damage = e.state === 'ATTACK' ? (cfg.chargeDamage ?? cfg.contactDamage) : cfg.contactDamage;
      this.damagePlayer(damage);
      e.contactCooldown = GAME_CONFIG.COMBAT.MELEE_CONTACT_COOLDOWN;
    }
  }

  /**
   * Касание обычного врага. Пока действует неуязвимость, не происходит
   * ничего: ни урона, ни отскока, ни смерти врага. После урона у врага
   * появляется короткая пауза, чтобы он не бил каждый кадр.
   */
  private handleMeleeContact(e: EnemyEntity): boolean {
    if (this.invulnTimer > 0 || e.contactCooldown > 0) return false;

    const dist = Phaser.Math.Distance.Between(e.x, e.y, this.playerX, this.playerY);
    if (dist >= e.config.radius + GAME_CONFIG.PLAYER.RADIUS - 4) return false;

    this.damagePlayer(1);
    e.contactCooldown = GAME_CONFIG.COMBAT.MELEE_CONTACT_COOLDOWN;
    return false;
  }

  private clampEnemyPosition(e: EnemyEntity): void {
    const { WIDTH, HEIGHT, PADDING } = GAME_CONFIG.WORLD;
    e.x = Phaser.Math.Clamp(e.x, PADDING, WIDTH - PADDING);
    e.y = Phaser.Math.Clamp(e.y, PADDING, HEIGHT - PADDING);
  }

  private fireEnemyProjectile(e: EnemyEntity, angle: number, speedOverride?: number): void {
    const speed = speedOverride ?? e.config.projectileSpeed ?? 230;
    const spawnX = e.x + Math.cos(angle) * (e.config.radius + 10);
    const spawnY = e.y + Math.sin(angle) * (e.config.radius + 10);

    const container = this.add.container(spawnX, spawnY).setDepth(24);
    const glow = this.add.circle(0, 0, 10, 0x7f1d1d, 0.5);
    const core = this.add.circle(0, 0, 5, 0xf87171).setStrokeStyle(2, 0x450a0a);
    container.add([glow, core]);

    this.enemyProjectiles.push({
      container,
      x: spawnX,
      y: spawnY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 4,
      damage: 1,
    });
  }

  private updateEnemyProjectiles(dt: number): void {
    const { WIDTH, HEIGHT } = GAME_CONFIG.WORLD;

    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = this.enemyProjectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.container.setPosition(p.x, p.y);

      const hitPlayer =
        Phaser.Math.Distance.Between(p.x, p.y, this.playerX, this.playerY) <
        GAME_CONFIG.PLAYER.RADIUS + 7;

      if (hitPlayer) {
        this.damagePlayer(p.damage);
        p.container.destroy();
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      if (p.life <= 0 || p.x < 18 || p.x > WIDTH - 18 || p.y < 18 || p.y > HEIGHT - 18) {
        p.container.destroy();
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  private killEnemy(e: EnemyEntity, index: number, rewards: boolean): void {
    createDeathEffect(this, e.x, e.y, e.config.strokeColor);

    if (rewards) {
      this.spawnManaOrb(e.x, e.y, e.config.manaDrop);
      this.score += e.config.scoreValue;
      this.killsCount++;
      if (e.isBoss) {
        this.bossesKilled++;
      }
    }

    e.container.destroy();
    e.hpBar?.destroy();
    e.hpBarBack?.destroy();
    this.enemies.splice(index, 1);
  }

  private handleBossDefeated(): void {
    hideBossBar(this.hud);
    this.clearEnemyProjectiles();
    this.waveActive = false;

    // Оставшиеся мелкие враги рассыпаются вместе с хозяином.
    for (const e of this.enemies) {
      createDeathEffect(this, e.x, e.y, e.config.strokeColor);
      e.container.destroy();
      e.hpBar?.destroy();
      e.hpBarBack?.destroy();
    }
    this.enemies = [];

    this.triggerVictory();
  }

  private damagePlayer(amount: number): void {
    if (this.gameState !== 'PLAYING' || this.invulnTimer > 0) return;

    this.hp = Math.max(0, this.hp - amount);
    this.invulnTimer = GAME_CONFIG.PLAYER.INVULN_DURATION;

    createDamageEffect(this, this.playerX, this.playerY);
    this.cameras.main.shake(180, 0.014);

    if (this.hp <= 0) {
      this.triggerGameOver();
    }
  }

  private updateInvulnerability(time: number, dt: number): void {
    if (this.invulnTimer <= 0) {
      this.player.setAlpha(1);
      this.invulnRing.setVisible(false);
      return;
    }

    this.invulnTimer = Math.max(0, this.invulnTimer - dt);

    const blink = Math.floor(time / 80) % 2 === 0;
    this.player.setAlpha(blink ? 0.35 : 1);

    this.invulnRing
      .setVisible(true)
      .setPosition(this.playerX, this.playerY)
      .setAlpha(0.55 + Math.sin(time * 0.02) * 0.35)
      .setScale(0.94 + Math.sin(time * 0.015) * 0.08);
  }

  // ============================================================================
  // 7. HUD И ЭКРАНЫ
  // ============================================================================

  private updateHUD(dt: number): void {
    const wave = this.level.waves[this.waveIndex];
    const phase = getPhaseProgress(this.score);
    const bossEntity = this.enemies.find((e) => e.isBoss);

    // Сколько врагов ещё осталось побить в текущей волне:
    // непоявившиеся + уже на поле.
    const pendingSpawns = wave && !wave.boss
      ? Math.max(0, wave.spawnCount - this.waveSpawned)
      : 0;
    const addsAlive = wave?.boss
      ? this.enemies.filter((e) => !e.isBoss).length
      : 0;

    updateHud(this.hud, {
      hp: this.hp,
      maxHp: this.maxHp,
      mana: this.mana,
      score: this.score,
      killsCount: this.killsCount,
      survivalTime: this.survivalTime,
      slowedEnemies: this.enemies.filter((e) => e.inLight).length,
      wave: this.waveIndex + 1,
      wavesTotal: this.level.waves.length,
      floor: FLOOR_ROMAN[getFloorIndex(this.level, this.waveIndex)] ?? 'III',
      waveName: wave?.name ?? '',
      enemiesLeft: pendingSpawns + this.enemies.length,
      addsLeft: wave?.boss ? addsAlive : null,
      phase: phase.phase,
      phaseProgress: phase.progress,
      phasePointsToNext: phase.pointsToNext,
      phaseNext: phase.next,
      boss: bossEntity
        ? {
            name: bossEntity.config.name,
            hpRatio: bossEntity.hp / bossEntity.maxHp,
            enraged: bossEntity.hasEnraged,
          }
        : null,
      dt,
    });
  }

  /** Убирает с поля все игровые объекты (враги, снаряды, кристаллы маны). */
  private clearField(): void {
    this.enemies.forEach((e) => {
      e.container.destroy();
      e.hpBar?.destroy();
      e.hpBarBack?.destroy();
    });
    this.projectiles.forEach((p) => p.container.destroy());
    this.manaOrbs.forEach((m) => m.container.destroy());
    this.clearEnemyProjectiles();

    this.enemies = [];
    this.projectiles = [];
    this.manaOrbs = [];
    this.waveActive = false;
    this.waveTransitionTimer = 0;
    this.guaranteedQueue = [];
    this.bossAddsTimer = 0;
    this.torchDrainTimer = 0;

    if (this.hud) {
      hideBossBar(this.hud);
    }
  }

  private clearEnemyProjectiles(): void {
    this.enemyProjectiles.forEach((p) => p.container.destroy());
    this.enemyProjectiles = [];
  }

  /** Возвращает игрока и камеру в исходное состояние партии. */
  private resetPlayerPosition(): void {
    this.playerX = GAME_CONFIG.PLAYER.START_X;
    this.playerY = GAME_CONFIG.PLAYER.START_Y;
    this.player.setPosition(this.playerX, this.playerY);
    this.playerVisual.shadow.setPosition(this.playerX + 2, this.playerY + 13);
    this.ambientGlow.setPosition(this.playerX, this.playerY);
  }

  private showStartScreen(): void {
    // Первый показ лагеря за визит — точка «игра загрузилась до меню».
    if (!this.campTracked) {
      this.campTracked = true;
      track('game_ready');
    }

    this.gameState = 'START';
    clearAllNotices(this);
    this.hud.container.setVisible(false);
    hideBossBar(this.hud);
    this.cooldownArc.clear();
    this.uiOverlay.removeAll(true);

    // Очищаем поле и ставим рыцаря в центр для красивого фона меню
    this.clearField();
    this.resetPlayerPosition();
    this.player.setAlpha(1);
    this.invulnRing.setVisible(false);

    // В лагере факел всегда горит ровно — кольцо света янтарное.
    this.currentPhase = getPhase(0);
    this.torchDrainTimer = 0;
    this.applyCurrentPhase();

    drawStartScreen(
      this,
      this.uiOverlay,
      this.getProfileController(),
      () => this.startGame(),
      this.getSettingsController(),
      {
        index: this.selectedLevel,
        unlocked: this.profile.unlockedLevels,
        levels: LEVELS.map((level) => level.name),
        onChange: (index) => {
          this.selectedLevel = index;
        },
      }
    );

    // Меню проявляется мягко, а не появляется одним кадром.
    this.uiOverlay.setAlpha(0);
    this.tweens.add({
      targets: this.uiOverlay,
      alpha: 1,
      duration: 420,
      ease: 'Quad.easeOut',
    });
  }

  /** Плавно гасит меню и только потом начинает новый спуск. */
  private startGame(): void {
    if (this.startingRun) return;
    // Закрытую локацию запустить нельзя.
    if (this.selectedLevel >= this.profile.unlockedLevels) return;
    this.startingRun = true;

    this.tweens.add({
      targets: this.uiOverlay,
      alpha: 0,
      duration: 340,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.startingRun = false;
        this.uiOverlay.setAlpha(1);
        this.beginRun();
      },
    });
  }

  /** Сбрасывает партию и запускает первую волну выбранной локации. */
  private beginRun(): void {
    this.levelIndex = this.selectedLevel;
    this.runAttempt = startAttempt();
    this.maxFloorReached = 1;
    track('run_start', {
      location: this.levelIndex + 1,
      attempt: this.runAttempt,
      control: isTouchUi() ? 'touch' : 'keyboard',
    });
    this.clearField();
    this.resetPlayerPosition();
    this.applyProfileBonuses();

    this.hp = this.maxHp;
    this.mana = this.startMana;
    this.invulnTimer = 0;
    this.runRecorded = false;
    this.player.setAlpha(1);
    this.invulnRing.setVisible(false);

    // Новая партия всегда начинается со светлой фазы
    this.currentPhase = getPhase(0);
    this.torchDrainTimer = 0;
    this.applyCurrentPhase();

    this.score = 0;
    this.killsCount = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.manaCollected = 0;
    this.survivalTime = 0;
    this.fireCooldown = 0;
    this.bossesKilled = 0;

    this.waveIndex = 0;
    this.waveSpawned = 0;
    this.waveSpawnTimer = 0;
    this.waveTransitionTimer = 0;
    this.waveActive = false;
    this.guaranteedQueue = [];
    this.bossAddsTimer = 0;
    this.boons.clear();

    this.uiOverlay.removeAll(true);
    this.hud.container.setVisible(true).setAlpha(0);
    hideBossBar(this.hud);
    this.updateHUD(0);
    this.gameState = 'PLAYING';

    // HUD проявляется вместе с уходом меню.
    this.tweens.add({
      targets: this.hud.container,
      alpha: 1,
      duration: 420,
      ease: 'Quad.easeOut',
    });

    this.beginWave(0);
  }

  private buildStats(victory = false): GameOverStats {
    const accuracy = this.shotsFired > 0
      ? Math.round((this.shotsHit / this.shotsFired) * 100)
      : 0;

    return {
      score: this.score,
      killsCount: this.killsCount,
      survivalTime: this.survivalTime,
      manaCollected: this.manaCollected,
      accuracy,
      wave: this.waveIndex + 1,
      wavesTotal: this.level.waves.length,
      floor: getFloorIndex(this.level, this.waveIndex) + 1,
      bossesKilled: this.bossesKilled,
      hp: this.hp,
      maxHp: this.maxHp,
      echoGained: 0,
      echoTotal: this.profile.echo,
      victory,
      newlyUnlockedLevel: null,
    };
  }

  /** Записывает забег в профиль один раз и возвращает статистику для экрана. */
  private finishRun(victory: boolean): GameOverStats {
    const stats = this.buildStats(victory);

    if (this.runRecorded) {
      stats.echoGained = 0;
      stats.echoTotal = this.profile.echo;
      return stats;
    }

    this.runRecorded = true;
    const unlockedBefore = this.profile.unlockedLevels;
    const reward = applyRun(this.profile, {
      score: stats.score,
      survivalTime: stats.survivalTime,
      wave: stats.wave,
      victory,
      bossesKilled: stats.bossesKilled,
      rank: calculateRank(stats).letter,
      levelIndex: this.levelIndex,
    });

    this.profile = reward.profile;
    saveProfile(this.profile);
    stats.echoGained = reward.echoGained;
    stats.echoTotal = this.profile.echo;
    stats.newlyUnlockedLevel =
      this.profile.unlockedLevels > unlockedBefore ? this.profile.unlockedLevels : null;

    track('run_end', {
      result: victory ? 'victory' : 'death',
      location: this.levelIndex + 1,
      attempt: this.runAttempt,
      max_floor: stats.floor,
      max_wave: stats.wave,
      duration: Math.round(stats.survivalTime),
      score: stats.score,
      kills: stats.killsCount,
    });

    return stats;
  }

  private triggerGameOver(): void {
    if (this.gameState === 'GAMEOVER' || this.gameState === 'VICTORY') return;

    this.gameState = 'GAMEOVER';
    clearAllNotices(this);
    this.hud.container.setVisible(false);
    hideBossBar(this.hud);
    this.cooldownArc.clear();
    this.uiOverlay.removeAll(true);
    this.player.setAlpha(1);
    this.invulnRing.setVisible(false);
    this.clearEnemyProjectiles();

    drawGameOverScreen(
      this,
      this.uiOverlay,
      this.finishRun(false),
      () => {
        track('retry_click', { after: 'death', location: this.levelIndex + 1 });
        this.startGame();
      },
      () => this.showStartScreen()
    );
  }

  private triggerVictory(): void {
    if (this.gameState === 'GAMEOVER' || this.gameState === 'VICTORY') return;

    this.gameState = 'VICTORY';
    clearAllNotices(this);
    this.hud.container.setVisible(false);
    hideBossBar(this.hud);
    this.cooldownArc.clear();
    this.uiOverlay.removeAll(true);
    this.player.setAlpha(1);
    this.invulnRing.setVisible(false);
    this.clearEnemyProjectiles();

    const stats = this.finishRun(true);
    // После победы селектор в лагере сразу показывает новую локацию.
    if (stats.newlyUnlockedLevel !== null) {
      this.selectedLevel = stats.newlyUnlockedLevel - 1;
    }

    drawVictoryScreen(
      this,
      this.uiOverlay,
      stats,
      () => {
        track('retry_click', { after: 'victory', location: this.levelIndex + 1 });
        this.startGame();
      },
      () => this.showStartScreen()
    );
  }

  // ============================================================================
  // 8. ПАУЗА ПО ESC
  // ============================================================================

  /** ESC: PLAYING → пауза, PAUSED → продолжить, в меню и на результатах — игнор. */
  private togglePause(): void {
    if (this.gameState === 'PLAYING') {
      this.pauseGame();
    } else if (this.gameState === 'PAUSED') {
      this.resumeGame();
    }
  }

  /** Замораживает партию и рисует экран паузы поверх HUD. */
  private pauseGame(): void {
    this.gameState = 'PAUSED';
    clearAllNotices(this);
    this.uiOverlay.removeAll(true);
    drawPauseScreen(
      this,
      this.uiOverlay,
      this.buildStats(false),
      () => this.resumeGame(),
      () => this.startGame(),
      () => {
        // Пауза → лагерь: забег брошен, это отдельный исход для статистики.
        if (!this.runRecorded) {
          track('run_end', {
            result: 'abandoned',
            location: this.levelIndex + 1,
            attempt: this.runAttempt,
            max_floor: getFloorIndex(this.level, this.waveIndex) + 1,
            max_wave: this.waveIndex + 1,
            duration: Math.round(this.survivalTime),
            score: this.score,
            kills: this.killsCount,
          });
        }
        this.showStartScreen();
      },
      this.getSettingsController()
    );
  }

  /** Разморозка: статистика и таймеры не сбрасываются, игра идёт дальше. */
  private resumeGame(): void {
    if (this.gameState !== 'PAUSED') return;
    this.uiOverlay.removeAll(true);
    this.gameState = 'PLAYING';
  }

  // ============================================================================
  // 9. ФАЗЫ ФАКЕЛА
  // ============================================================================

  /** Условие смены фазы живёт в core/phases.ts (функция getPhase). */
  private checkPhaseChange(): void {
    const next = getPhase(this.score);
    if (next === this.currentPhase) return;

    this.currentPhase = next;
    this.applyCurrentPhase();
    showPhaseNotice(this, this.currentPhase, PHASES[next].notice);
  }

  /** Применяет свойства текущей фазы: радиус света и свечение вокруг игрока. */
  private applyCurrentPhase(): void {
    const baseRadius = PHASES[this.currentPhase].lightRadius * this.lightMultiplier;
    const drainRadius = this.getActiveDrainRadius();
    const radius = this.torchDrainTimer > 0 && drainRadius !== null
      ? Math.min(baseRadius, drainRadius)
      : baseRadius;

    const ringColor = PHASES[this.currentPhase].ringColor;
    this.lightRingSoft.setStrokeStyle(7, ringColor, 1);
    this.lightRingBright.setStrokeStyle(1.5, ringColor, 1);

    this.setLightRadius(radius);
  }

  /** Радиус, до которого активный босс гасит факел (есть только у CHARGER). */
  private getActiveDrainRadius(): number | null {
    const boss = this.enemies.find((e) => e.isBoss);
    if (!boss) return null;
    return (boss.config as BossConfig).drainRadius ?? null;
  }
}
