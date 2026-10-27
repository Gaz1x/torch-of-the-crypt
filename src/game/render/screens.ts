import Phaser from 'phaser';

// ============================================================================
// ЭКРАНЫ МЕНЮ (стартовый экран и экран поражения)
// Вся статистика и очистка поля остаются в GameScene — здесь только отрисовка.
// ============================================================================

/** Статистика, показываемая на экране поражения. */
export interface GameOverStats {
  score: number;
  killsCount: number;
  survivalTime: number;
  manaCollected: number;
  accuracy: number;
}

export function drawStartScreen(
  scene: Phaser.Scene,
  overlay: Phaser.GameObjects.Container,
  onStart: () => void
): void {
  // Задняя подложка меню с двойной готической рамкой
  const cardBg = scene.add.rectangle(480, 320, 560, 410, 0x090d16, 0.92)
    .setStrokeStyle(2, 0xf97316);
  const innerFrame = scene.add.rectangle(480, 320, 544, 394)
    .setStrokeStyle(1, 0x334155);

  // Декоративная эмблема факела сверху
  const emblemGlow = scene.add.circle(480, 175, 34, 0xf97316, 0.18);
  const emblemOuter = scene.add.circle(480, 175, 20, 0xea580c);
  const emblemCore = scene.add.circle(480, 175, 10, 0xfef08a);
  const emblemStick = scene.add.rectangle(480, 202, 8, 22, 0x78350f);

  const subtitle = scene.add.text(480, 238, 'ХРОНИКИ ПОДЗЕМЕЛЬЯ', {
    fontFamily: 'Inter, sans-serif',
    fontSize: '12px',
    fontStyle: 'bold',
    color: '#94a3b8',
    letterSpacing: 3,
  }).setOrigin(0.5);

  const title = scene.add.text(480, 270, 'ПОСЛЕДНИЙ ФАКЕЛ КРИПТЫ', {
    fontFamily: 'Inter, sans-serif',
    fontSize: '30px',
    fontStyle: 'bold',
    color: '#f8fafc',
  }).setOrigin(0.5);

  const divider = scene.add.rectangle(480, 300, 320, 2, 0x334155);

  // Атмосферное описание без упоминания кнопок управления
  const loreText = scene.add.text(
    480,
    345,
    'Древние своды трещат под натиском бездны.\n' +
    'Пока горит пламя вашего факела, порождения тьмы цепенеют в его свете.\n' +
    'Собирайте осколки эфира павших теней и не дайте огню угаснуть.',
    {
      fontFamily: 'Inter, sans-serif',
      fontSize: '15px',
      color: '#cbd5e1',
      align: 'center',
      lineSpacing: 8,
    }
  ).setOrigin(0.5);

  // Главная кнопка старта
  const btnBg = scene.add.rectangle(480, 445, 260, 54, 0xea580c)
    .setStrokeStyle(2, 0xfed7aa)
    .setInteractive({ useHandCursor: true });

  const btnText = scene.add.text(480, 445, 'СПУСТИТЬСЯ В КРИПТУ', {
    fontFamily: 'Inter, sans-serif',
    fontSize: '16px',
    fontStyle: 'bold',
    color: '#ffffff',
  }).setOrigin(0.5);

  btnBg.on('pointerover', () => {
    btnBg.setFillStyle(0xf97316);
    btnBg.setScale(1.03);
  });
  btnBg.on('pointerout', () => {
    btnBg.setFillStyle(0xea580c);
    btnBg.setScale(1.0);
  });
  btnBg.on('pointerdown', () => onStart());

  // --- ИНТЕРАКТИВНЫЙ БЕЙДЖ ПОДСКАЗКИ ПРИ НАВЕДЕНИИ ---
  const helpBadgeBg = scene.add.rectangle(665, 145, 155, 32, 0x1e293b, 0.95)
    .setStrokeStyle(1.5, 0x38bdf8)
    .setInteractive({ useHandCursor: true });

  const helpBadgeText = scene.add.text(665, 145, '❔ Управление и правила', {
    fontFamily: 'Inter, sans-serif',
    fontSize: '12px',
    fontStyle: 'bold',
    color: '#38bdf8',
  }).setOrigin(0.5);

  // Всплывающее окно (Tooltip), скрытое по умолчанию
  const tooltipContainer = scene.add.container(480, 315).setVisible(false);
  const tooltipBg = scene.add.rectangle(0, 0, 470, 250, 0x0f172a, 0.98)
    .setStrokeStyle(2, 0x38bdf8);

  const tooltipTitle = scene.add.text(0, -92, 'ПАМЯТКА СТРАЖА КРИПТЫ', {
    fontFamily: 'Inter, sans-serif',
    fontSize: '16px',
    fontStyle: 'bold',
    color: '#38bdf8',
  }).setOrigin(0.5);

  const tooltipContent = scene.add.text(
    0,
    10,
    '• Перемещение: клавиши WASD или Стрелки\n' +
    '• Направление взгляда и прицела: Курсор мыши\n' +
    '• Выстрел сгустком света: Левая кнопка мыши или Пробел\n' +
    '• Каждый выстрел расходует 15 ед. Маны\n' +
    '• Подбирайте синие кристаллы маны с убитых монстров\n' +
    '• Внутри круга света все враги сильно замедляются!',
    {
      fontFamily: 'Inter, sans-serif',
      fontSize: '14px',
      color: '#f8fafc',
      align: 'left',
      lineSpacing: 8,
    }
  ).setOrigin(0.5);

  tooltipContainer.add([tooltipBg, tooltipTitle, tooltipContent]);

  helpBadgeBg.on('pointerover', () => {
    helpBadgeBg.setFillStyle(0x0284c7);
    helpBadgeText.setColor('#ffffff');
    tooltipContainer.setVisible(true);
  });
  helpBadgeBg.on('pointerout', () => {
    helpBadgeBg.setFillStyle(0x1e293b);
    helpBadgeText.setColor('#38bdf8');
    tooltipContainer.setVisible(false);
  });

  overlay.add([
    cardBg,
    innerFrame,
    emblemGlow,
    emblemStick,
    emblemOuter,
    emblemCore,
    subtitle,
    title,
    divider,
    loreText,
    btnBg,
    btnText,
    helpBadgeBg,
    helpBadgeText,
    tooltipContainer,
  ]);
}

export function drawGameOverScreen(
  scene: Phaser.Scene,
  overlay: Phaser.GameObjects.Container,
  stats: GameOverStats,
  onBackToMenu: () => void
): void {
  // Карточка экрана поражения
  const cardBg = scene.add.rectangle(480, 320, 520, 430, 0x090d16, 0.95)
    .setStrokeStyle(2, 0xef4444);
  const innerFrame = scene.add.rectangle(480, 320, 504, 414)
    .setStrokeStyle(1, 0x450a0a);

  const badge = scene.add.text(480, 145, 'ИТОГИ ВЫЛАЗКИ', {
    fontFamily: 'Inter, sans-serif',
    fontSize: '12px',
    fontStyle: 'bold',
    color: '#f87171',
    letterSpacing: 3,
  }).setOrigin(0.5);

  const title = scene.add.text(480, 178, 'ФАКЕЛ ПОГАС', {
    fontFamily: 'Inter, sans-serif',
    fontSize: '32px',
    fontStyle: 'bold',
    color: '#ef4444',
  }).setOrigin(0.5);

  const divider = scene.add.rectangle(480, 210, 360, 2, 0x450a0a);

  // Таблица статистики с выравниванием по колонкам
  const statRows: [string, string, string][] = [
    ['Набрано очков славы', `${stats.score}`, '#fbbf24'],
    ['Изгнано порождений тьмы', `${stats.killsCount}`, '#f8fafc'],
    ['Время удержания света', `${stats.survivalTime.toFixed(1)} сек`, '#e2e8f0'],
    ['Собрано эфирной маны', `${stats.manaCollected} ед.`, '#38bdf8'],
    ['Точность заклинаний света', `${stats.accuracy}%`, '#a7f3d0'],
  ];

  const statsElements: Phaser.GameObjects.GameObject[] = [];
  statRows.forEach(([label, val, color], idx) => {
    const yPos = 242 + idx * 34;
    const rowBg = scene.add.rectangle(480, yPos, 410, 28, 0x1e293b, 0.55);
    const lblText = scene.add.text(290, yPos, label, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '14px',
      color: '#cbd5e1',
    }).setOrigin(0, 0.5);
    const valText = scene.add.text(670, yPos, val, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color,
    }).setOrigin(1, 0.5);

    statsElements.push(rowBg, lblText, valText);
  });

  // Кнопка возврата на главный экран
  const btnBg = scene.add.rectangle(480, 455, 260, 52, 0x334155)
    .setStrokeStyle(2, 0x94a3b8)
    .setInteractive({ useHandCursor: true });

  const btnText = scene.add.text(480, 455, 'В ГЛАВНОЕ МЕНЮ', {
    fontFamily: 'Inter, sans-serif',
    fontSize: '16px',
    fontStyle: 'bold',
    color: '#ffffff',
  }).setOrigin(0.5);

  btnBg.on('pointerover', () => {
    btnBg.setFillStyle(0x475569);
    btnBg.setScale(1.03);
  });
  btnBg.on('pointerout', () => {
    btnBg.setFillStyle(0x334155);
    btnBg.setScale(1.0);
  });
  // Переход обратно на стартовый экран вместо мгновенного рестарта
  btnBg.on('pointerdown', () => onBackToMenu());

  overlay.add([
    cardBg,
    innerFrame,
    badge,
    title,
    divider,
    ...statsElements,
    btnBg,
    btnText,
  ]);
}
