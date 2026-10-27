import Phaser from 'phaser';
import { GAME_CONFIG, type EnemyConfig, type EnemyTypeKey } from './core/gameConfig';
import { getPhase, PHASES, type PhaseKey } from './core/phases';
import type { EnemyEntity, ManaOrbEntity, ProjectileEntity } from './core/entities';
import { drawCryptEnvironment, type WorldCrack } from './render/world';
import { createPlayer, type PlayerVisual } from './render/playerArt';
import { createEnemyVisual } from './render/enemyArt';
import {
  createDamageEffect,
  createDeathEffect,
  createHitSpark,
  showFloatingText,
  showPhaseNotice,
} from './render/effects';
import { createHud, updateHud, type HudParts } from './render/hud';
import { drawGameOverScreen, drawPauseScreen, drawStartScreen } from './render/screens';

// ============================================================================
// ОСНОВНАЯ СЦЕНА ИГРЫ
// Здесь живёт состояние партии и игровая логика. Константы и баланс — в
// core/gameConfig.ts, отрисовка — в папке render/ (world, playerArt,
// enemyArt, effects, hud, screens).
// ============================================================================

export class GameScene extends Phaser.Scene {
  private gameState: 'START' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' = 'START';

  // Игрок
  private player!: Phaser.GameObjects.Container;
  private playerVisual!: PlayerVisual;
  private cooldownArc!: Phaser.GameObjects.Graphics;
  private playerX: number = GAME_CONFIG.PLAYER.START_X;
  private playerY: number = GAME_CONFIG.PLAYER.START_Y;
  private aimAngle = 0;
  private hp: number = GAME_CONFIG.PLAYER.MAX_HP;
  private mana: number = GAME_CONFIG.COMBAT.START_MANA;

  // Система Света и Тьмы
  private darknessOverlay!: Phaser.GameObjects.RenderTexture;
  private lightCutout!: Phaser.GameObjects.Graphics;
  private smallLightCutout!: Phaser.GameObjects.Graphics;
  private ambientGlow!: Phaser.GameObjects.Arc;
  /** Текущая фаза факела: свет и скорость игрока берутся из PHASES. */
  private currentPhase: PhaseKey = getPhase(0);
  private currentLightRadius: number = PHASES[getPhase(0)].lightRadius;

  // Списки объектов
  private enemies: EnemyEntity[] = [];
  private projectiles: ProjectileEntity[] = [];
  private manaOrbs: ManaOrbEntity[] = [];
  private cracks: WorldCrack[] = [];

  // Таймеры и Статистика
  private spawnTimer = 0;
  private fireCooldown = 0;
  private survivalTime = 0;
  private score = 0;
  private killsCount = 0;
  private shotsFired = 0;
  private shotsHit = 0;
  private manaCollected = 0;

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

  // Элементы HUD и UI
  private hud!: HudParts;
  private uiOverlay!: Phaser.GameObjects.Container;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.cracks = drawCryptEnvironment(this);

    this.ambientGlow = this.add.circle(
      this.playerX,
      this.playerY,
      this.currentLightRadius,
      GAME_CONFIG.LIGHT.AMBIENT_COLOR,
      GAME_CONFIG.LIGHT.AMBIENT_ALPHA
    ).setDepth(5);

    this.playerVisual = createPlayer(this, this.playerX, this.playerY);
    this.player = this.playerVisual.container;
    this.cooldownArc = this.add.graphics().setDepth(13);

    this.setupLightingSystem();
    this.setupInputs();
    this.hud = createHud(this);
    this.uiOverlay = this.add.container(0, 0).setDepth(40);

    this.showStartScreen();
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000;

    // Свет статичен: мерцание пламени факела и пульсация свечения вокруг
    // игрока отключены, чтобы световой круг не менял размер каждый кадр.

    if (this.gameState !== 'PLAYING') {
      // На паузе рыцарь остаётся в прицеле, вращение — только фон в меню
      if (this.gameState !== 'PAUSED') {
        // Легкое вращение рыцаря на фоне в меню для красоты
        this.player.setRotation(Math.sin(time * 0.0008) * 0.4);
      }
      this.renderDarkness();
      return;
    }

    this.survivalTime += dt;
    this.checkPhaseChange();

    this.mana = Math.min(
      GAME_CONFIG.COMBAT.MAX_MANA,
      this.mana + GAME_CONFIG.COMBAT.PASSIVE_MANA_REGEN * dt
    );

    this.handlePlayerMovement(dt);
    this.handleShooting(dt);
    this.handleSpawning(delta);
    this.updateProjectiles(dt);
    this.updateManaOrbs(dt, time);
    this.updateEnemies(dt, time);
    this.renderDarkness();
    this.updateHUD();
  }

  // ============================================================================
  // 1. СВЕТ И ТЬМА
  // ============================================================================

  private setupLightingSystem(): void {
    const { WIDTH, HEIGHT } = GAME_CONFIG.WORLD;
    this.darknessOverlay = this.add.renderTexture(0, 0, WIDTH, HEIGHT)
      .setOrigin(0, 0)
      .setDepth(20);

    this.lightCutout = this.make.graphics({}, false);
    this.rebuildLightBrush(this.currentLightRadius);

    this.smallLightCutout = this.make.graphics({}, false);
    this.smallLightCutout.fillStyle(0xffffff, 0.35);
    this.smallLightCutout.fillCircle(0, 0, 48);
    this.smallLightCutout.fillStyle(0xffffff, 0.85);
    this.smallLightCutout.fillCircle(0, 0, 24);
  }

  private rebuildLightBrush(radius: number): void {
    this.lightCutout.clear();
    this.lightCutout.fillStyle(0xffffff, 0.2);
    this.lightCutout.fillCircle(0, 0, radius * 1.18);
    this.lightCutout.fillStyle(0xffffff, 0.45);
    this.lightCutout.fillCircle(0, 0, radius * 1.06);
    this.lightCutout.fillStyle(0xffffff, 0.8);
    this.lightCutout.fillCircle(0, 0, radius * 0.92);
    this.lightCutout.fillStyle(0xffffff, 1.0);
    this.lightCutout.fillCircle(0, 0, radius * 0.75);
  }

  private renderDarkness(): void {
    this.darknessOverlay.clear();
    this.darknessOverlay.fill(
      GAME_CONFIG.LIGHT.DARKNESS_COLOR,
      GAME_CONFIG.LIGHT.DARKNESS_ALPHA
    );

    this.darknessOverlay.erase(this.lightCutout, this.playerX, this.playerY);

    for (const p of this.projectiles) {
      this.darknessOverlay.erase(this.smallLightCutout, p.x, p.y);
    }
    for (const orb of this.manaOrbs) {
      this.darknessOverlay.erase(this.smallLightCutout, orb.x, orb.y);
    }
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
      if (this.gameState === 'PLAYING' && pointer.leftButtonDown()) {
        this.tryFireProjectile();
      }
    });
  }

  private handlePlayerMovement(dt: number): void {
    let vx = 0;
    let vy = 0;

    if (this.keys.A.isDown || this.keys.LEFT.isDown) vx -= 1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) vx += 1;
    if (this.keys.W.isDown || this.keys.UP.isDown) vy -= 1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) vy += 1;

    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }

    const { WIDTH, HEIGHT, PADDING } = GAME_CONFIG.WORLD;
    // Замедление действует в фазе, когда факел погас (см. core/phases.ts)
    const speed = GAME_CONFIG.PLAYER.SPEED * PHASES[this.currentPhase].playerSpeedFactor;

    this.playerX = Phaser.Math.Clamp(this.playerX + vx * speed * dt, PADDING, WIDTH - PADDING);
    this.playerY = Phaser.Math.Clamp(this.playerY + vy * speed * dt, PADDING, HEIGHT - PADDING);

    this.player.setPosition(this.playerX, this.playerY);
    this.ambientGlow.setPosition(this.playerX, this.playerY);

    const pointer = this.input.activePointer;
    this.aimAngle = Phaser.Math.Angle.Between(this.playerX, this.playerY, pointer.worldX, pointer.worldY);
    this.player.setRotation(this.aimAngle);
  }

  private handleShooting(dt: number): void {
    if (this.fireCooldown > 0) {
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    }

    this.cooldownArc.clear();
    if (this.fireCooldown > 0) {
      const progress = 1 - this.fireCooldown / GAME_CONFIG.COMBAT.FIRE_COOLDOWN;
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
    if ((this.keys.SPACE.isDown || pointer.leftButtonDown()) && this.fireCooldown <= 0) {
      this.tryFireProjectile();
    }
  }

  private tryFireProjectile(): void {
    if (this.fireCooldown > 0) return;

    if (this.mana < GAME_CONFIG.COMBAT.SHOT_MANA_COST) {
      this.fireCooldown = 0.25;
      showFloatingText(this, this.playerX, this.playerY - 28, 'Недостаточно маны!', '#38bdf8');
      return;
    }

    this.mana -= GAME_CONFIG.COMBAT.SHOT_MANA_COST;
    this.fireCooldown = GAME_CONFIG.COMBAT.FIRE_COOLDOWN;
    this.shotsFired++;

    const { PROJECTILE_SPEED, PROJECTILE_LIFE, PROJECTILE_RADIUS } = GAME_CONFIG.COMBAT;
    const spawnX = this.playerX + Math.cos(this.aimAngle) * 26;
    const spawnY = this.playerY + Math.sin(this.aimAngle) * 26;

    const container = this.add.container(spawnX, spawnY).setDepth(25);
    const outerGlow = this.add.circle(0, 0, PROJECTILE_RADIUS + 4, 0x0284c7, 0.45);
    const core = this.add.circle(0, 0, PROJECTILE_RADIUS, 0xe0f2fe).setStrokeStyle(2, 0x38bdf8);
    container.add([outerGlow, core]);

    this.projectiles.push({
      container,
      x: spawnX,
      y: spawnY,
      vx: Math.cos(this.aimAngle) * PROJECTILE_SPEED,
      vy: Math.sin(this.aimAngle) * PROJECTILE_SPEED,
      life: PROJECTILE_LIFE,
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

    const aura = this.add.circle(0, 0, 11, 0x0284c7, 0.35);
    const diamond = this.add.rectangle(0, 0, 10, 10, 0x38bdf8)
      .setRotation(Math.PI / 4)
      .setStrokeStyle(1.5, 0xe0f2fe);

    container.add([aura, diamond]);

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
  // 4. МОНСТРЫ
  // ============================================================================

  private handleSpawning(delta: number): void {
    this.spawnTimer += delta;
    const { INITIAL_INTERVAL, MIN_INTERVAL, INTERVAL_DECREASE_PER_SCORE } = GAME_CONFIG.SPAWN;
    const currentInterval = Math.max(
      MIN_INTERVAL,
      INITIAL_INTERVAL - this.score * INTERVAL_DECREASE_PER_SCORE
    );

    if (this.spawnTimer >= currentInterval) {
      this.spawnTimer = 0;
      this.spawnRandomEnemy();
    }
  }

  private pickEnemyType(): EnemyTypeKey {
    const entries = Object.entries(GAME_CONFIG.ENEMIES) as [EnemyTypeKey, EnemyConfig][];
    const totalWeight = entries.reduce((sum, [, cfg]) => sum + cfg.spawnWeight, 0);
    let roll = Phaser.Math.Between(1, totalWeight);

    for (const [key, cfg] of entries) {
      if (roll <= cfg.spawnWeight) return key;
      roll -= cfg.spawnWeight;
    }
    return 'STALKER';
  }

  private spawnRandomEnemy(): void {
    const type = this.pickEnemyType();
    const cfg = GAME_CONFIG.ENEMIES[type];
    const crack = Phaser.Utils.Array.GetRandom(this.cracks);

    const visual = createEnemyVisual(this, type, cfg, crack.x, crack.y);

    this.enemies.push({
      type,
      config: cfg,
      container: visual.container,
      bodyShape: visual.bodyShape,
      eyes: visual.eyes,
      hpBar: visual.hpBar,
      x: crack.x,
      y: crack.y,
      hp: cfg.hp,
      maxHp: cfg.hp,
      inLight: false,
    });
  }

  private updateEnemies(dt: number, time: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const distToPlayer = Phaser.Math.Distance.Between(e.x, e.y, this.playerX, this.playerY);

      const isInsideLight = distToPlayer <= this.currentLightRadius;
      e.inLight = isInsideLight;

      if (isInsideLight) {
        e.bodyShape.setStrokeStyle(2.5, e.config.lightStrokeColor);
        e.eyes.forEach((eye) => eye.setFillStyle(0xfef08a));
      } else {
        e.bodyShape.setStrokeStyle(2.5, e.config.strokeColor);
        e.eyes.forEach((eye) => eye.setFillStyle(e.config.eyeColor));
      }

      const speedMultiplier = isInsideLight ? e.config.lightSlowFactor : 1.0;
      const currentSpeed = e.config.speed * speedMultiplier;
      const angle = Phaser.Math.Angle.Between(e.x, e.y, this.playerX, this.playerY);

      const wobble = e.type === 'SWARMER' ? Math.sin(time * 0.012 + i) * 0.35 : 0;

      e.x += Math.cos(angle + wobble) * currentSpeed * dt;
      e.y += Math.sin(angle + wobble) * currentSpeed * dt;
      e.container.setPosition(e.x, e.y);
      e.container.setRotation(angle);

      if (e.hpBar) {
        e.hpBar.setRotation(-angle);
      }

      let killed = false;
      for (let j = this.projectiles.length - 1; j >= 0; j--) {
        const p = this.projectiles[j];
        const hitDist = e.config.radius + GAME_CONFIG.COMBAT.PROJECTILE_RADIUS;

        if (Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y) <= hitDist) {
          p.container.destroy();
          this.projectiles.splice(j, 1);

          e.hp -= GAME_CONFIG.COMBAT.PROJECTILE_DAMAGE;
          this.shotsHit++;

          if (e.hpBar) {
            e.hpBar.width = Math.max(0, (e.hp / e.maxHp) * 34);
          }

          if (e.hp <= 0) {
            killed = true;
            break;
          } else {
            createHitSpark(this, e.x, e.y);
          }
        }
      }

      if (killed) {
        createDeathEffect(this, e.x, e.y, e.config.strokeColor);
        this.spawnManaOrb(e.x, e.y, e.config.manaDrop);
        this.score += e.config.scoreValue;
        this.killsCount++;
        e.container.destroy();
        this.enemies.splice(i, 1);
        continue;
      }

      if (distToPlayer < e.config.radius + GAME_CONFIG.PLAYER.RADIUS - 4) {
        createDamageEffect(this, this.playerX, this.playerY);
        e.container.destroy();
        this.enemies.splice(i, 1);
        this.hp -= 1;

        this.cameras.main.shake(180, 0.014);

        if (this.hp <= 0) {
          this.triggerGameOver();
          return;
        }
      }
    }
  }

  // ============================================================================
  // 5. HUD И ЭКРАНЫ МЕНЮ
  // ============================================================================

  private updateHUD(): void {
    updateHud(this.hud, {
      hp: this.hp,
      mana: this.mana,
      score: this.score,
      killsCount: this.killsCount,
      survivalTime: this.survivalTime,
      slowedEnemies: this.enemies.filter((e) => e.inLight).length,
    });
  }

  /** Убирает с поля все игровые объекты (враги, снаряды, кристаллы маны). */
  private clearField(): void {
    this.enemies.forEach((e) => e.container.destroy());
    this.projectiles.forEach((p) => p.container.destroy());
    this.manaOrbs.forEach((m) => m.container.destroy());
    this.enemies = [];
    this.projectiles = [];
    this.manaOrbs = [];
  }

  /** Возвращает игрока и камеру в исходное состояние партии. */
  private resetPlayerPosition(): void {
    this.playerX = GAME_CONFIG.PLAYER.START_X;
    this.playerY = GAME_CONFIG.PLAYER.START_Y;
    this.player.setPosition(this.playerX, this.playerY);
    this.ambientGlow.setPosition(this.playerX, this.playerY);
  }

  private showStartScreen(): void {
    this.gameState = 'START';
    this.hud.container.setVisible(false);
    this.cooldownArc.clear();
    this.uiOverlay.removeAll(true);

    // Очищаем поле и ставим рыцаря в центр для красивого фона меню
    this.clearField();
    this.resetPlayerPosition();

    drawStartScreen(this, this.uiOverlay, () => this.startGame());
  }

  private startGame(): void {
    this.clearField();
    this.resetPlayerPosition();

    this.hp = GAME_CONFIG.PLAYER.MAX_HP;
    this.mana = GAME_CONFIG.COMBAT.START_MANA;
    // Новая партия всегда начинается со светлой фазы
    this.currentPhase = getPhase(0);
    this.applyCurrentPhase();

    this.score = 0;
    this.killsCount = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.manaCollected = 0;
    this.survivalTime = 0;
    this.fireCooldown = 0;
    this.spawnTimer = 0;

    this.uiOverlay.removeAll(true);
    this.hud.container.setVisible(true);
    this.updateHUD();
    this.gameState = 'PLAYING';
  }

  private triggerGameOver(): void {
    this.gameState = 'GAMEOVER';
    this.hud.container.setVisible(false);
    this.cooldownArc.clear();
    this.uiOverlay.removeAll(true);

    const accuracy = this.shotsFired > 0 ? Math.round((this.shotsHit / this.shotsFired) * 100) : 0;

    drawGameOverScreen(
      this,
      this.uiOverlay,
      {
        score: this.score,
        killsCount: this.killsCount,
        survivalTime: this.survivalTime,
        manaCollected: this.manaCollected,
        accuracy,
      },
      () => this.showStartScreen()
    );
  }

  // ============================================================================
  // 6. ПАУЗА ПО ESC
  // ============================================================================

  /** ESC: PLAYING → пауза, PAUSED → продолжить, в меню и на экране смерти — игнор. */
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
    this.uiOverlay.removeAll(true);
    drawPauseScreen(this, this.uiOverlay, () => this.resumeGame(), () => this.startGame());
  }

  /** Разморозка: статистика и таймеры не сбрасываются, игра идёт дальше. */
  private resumeGame(): void {
    if (this.gameState !== 'PAUSED') return;
    this.uiOverlay.removeAll(true);
    this.gameState = 'PLAYING';
  }

  // ============================================================================
  // 7. ФАЗЫ ФАКЕЛА
  // ============================================================================

  /** Условие смены фазы живёт в core/phases.ts (функция getPhase). */
  private checkPhaseChange(): void {
    const next = getPhase(this.survivalTime);
    if (next === this.currentPhase) return;

    this.currentPhase = next;
    this.applyCurrentPhase();
    showPhaseNotice(this, PHASES[next].notice);
  }

  /** Применяет свойства текущей фазы: радиус света и свечение вокруг игрока. */
  private applyCurrentPhase(): void {
    this.currentLightRadius = PHASES[this.currentPhase].lightRadius;
    this.rebuildLightBrush(this.currentLightRadius);
    this.ambientGlow.setRadius(this.currentLightRadius);
  }
}
