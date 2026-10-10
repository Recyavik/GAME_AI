// Мир занятия 1 (сценарий v3): один этаж школы в день Фестиваля ИИ.
//
// План (вид сверху, камера смотрит с юга). Номера — станции фестиваля.
//
//  z=-13 ┌─────────┬──────────┬─────────┬──────────┬──────────┬───────────┐
//        │Радиоузел│Библиотека│ ИЗО (4) │Шахматная │Технология│ЛАБОРАТОРИЯ│
//        │  (2)    │   (3)    │         │рекр. (5) │   (6)    │ ИИ (7)    │
//  z=-3  ├───дверь─┴──дверь───┴──дверь──┴─открыто──┴──дверь───┴──[шлюз]───┤
//        │ ХОЛЛ (старт)        К О Р И Д О Р                                │
//  z=+3  ├──дверь──┬─дверь────┬──дверь──┬──дверь───┬──дверь───┬──дверь────┤
//        │Вход,    │ Гардероб │ Столовая│ Медкаб.  │ Спортзал │ АКТОВЫЙ   │
//        │турникет │          │         │          │          │ ЗАЛ       │
//  z=+13 └─────────┴──────────┴─────────┴──────────┴──────────┴───────────┘
//       x=-32     -22        -13       -2          6          18         32
import * as THREE from 'three';
import { IMG } from './images.js';
import { sound } from '../../src/engine/sound.js';

export default function world(W, F) {
  const item = (fn, x, z, rot = 0, opts) => W.item((g) => fn(W, g), x, z, rot, opts);
  const face = (fx, fz, tx, tz) => Math.atan2(tx - fx, tz - fz); // поворот «лицом к точке»
  const N = -3, S = 3; // стены коридора

  // ---------------- Помещения ----------------
  W.room({
    x: [-32, 32], z: [N, S], floor: 0xeee2c8, wall: 0xfff4e2, sides: 'nswe', pattern: { color: 0xdccfb2, step: 2 },
    doors: [
      { side: 'n', at: -23 }, { side: 'n', at: -15.5 }, { side: 'n', at: -5 }, { side: 'n', at: 5, w: 7 }, { side: 'n', at: 15.5 }, { side: 'n', at: 26, w: 2 },
      { side: 's', at: -27, w: 3 }, { side: 's', at: -17.5 }, { side: 's', at: -7.5 }, { side: 's', at: 2 }, { side: 's', at: 12 }, { side: 's', at: 20, w: 2.4 },
    ],
  });
  // Северные кабинеты (южная стена — стена коридора).
  W.room({ x: [-32, -21], z: [-13, N], floor: 0xdfe3ec, wall: 0xe8ecf8, sides: 'nwe' });
  W.room({ x: [-21, -10], z: [-13, N], floor: 0xe6d3b5, wall: 0xf3e6d4, sides: 'ne', pattern: { color: 0xd6c19e, step: 1 } });
  W.room({ x: [-10, 0], z: [-13, N], floor: 0xf1e3d0, wall: 0xfdeee6, sides: 'ne' });
  W.room({ x: [0, 10], z: [-13, N], floor: 0xe3eedf, wall: 0xeef7ea, sides: 'ne', pattern: { color: 0xd2e2cc, step: 1 } });
  W.room({ x: [10, 21], z: [-13, N], floor: 0xd5d9e0, wall: 0xe3ecf6, sides: 'ne' });
  W.room({ x: [21, 32], z: [-13, N], floor: 0xdde6f7, wall: 0xeaf0ff, sides: 'ne' });
  // Южные помещения (северная стена — стена коридора).
  W.room({ x: [-32, -22], z: [S, 13], floor: 0xe9dcc6, wall: 0xfdf3e3, sides: 'swe', pattern: { color: 0xd8c8ad, step: 1.25 } });
  W.room({ x: [-22, -13], z: [S, 13], floor: 0xe2dccf, wall: 0xf4efe4, sides: 'se' });
  W.room({ x: [-13, -2], z: [S, 13], floor: 0xf3e9d6, wall: 0xfff1df, sides: 'se', pattern: { color: 0xe3d5bb, step: 1 } });
  W.room({ x: [-2, 6], z: [S, 13], floor: 0xeaf4f4, wall: 0xf2fbfb, sides: 'se' });
  W.room({ x: [6, 18], z: [S, 13], floor: 0xd9b48a, wall: 0xf3ead8, sides: 'se', pattern: { color: 0xc9a277, step: 1 } });
  W.room({ x: [18, 32], z: [S, 13], h: 3.6, floor: 0xcf9f6a, wall: 0xf0e4f6, sides: 'se', pattern: { color: 0xbb8d5c, step: 1 } });

  // Таблички: над дверями северных кабинетов (на стене) и «раскладушки» у южных дверей.
  const doorSign = (text, x, bg = '#6e4bff') => W.onWall(W.sign(text, x, 2.28, N + 0.1, 's', { bg, hgt: 0.32, maxW: 3 }), N);
  doorSign('2 · Радиоузел', -23);
  doorSign('3 · Библиотека', -15.5);
  doorSign('4 · Кабинет ИЗО', -5);
  doorSign('5 · Шахматная рекреация', 5);
  doorSign('6 · Технология', 15.5);
  doorSign('7 · Лаборатория ИИ', 26, '#2563eb');
  const floorSign = (text, x, bg = '#ff7a59') => {
    item((W, g) => F.signStand(W, g), x, S - 0.55, 0, { block: true });
    W.sign(text, x, 1.15, S - 0.52, 's', { bg, hgt: 0.3, maxW: 1.9 });
  };
  floorSign('1 · Лица — вход', -24.6);
  floorSign('Гардероб', -19.6, '#8a8fa8');
  floorSign('Столовая', -9.8, '#8a8fa8');
  floorSign('Медкабинет', 0, '#8a8fa8');
  floorSign('Спортзал', 9.6, '#8a8fa8');
  floorSign('Актовый зал', 22.6);

  // ---------------- Холл (запад коридора) ----------------
  item((W, g) => F.standBoard(W, g, { w: 2.2, h: 1.2, color: 0xffc53d }), -28, -2.1);
  W.sign('ФЕСТИВАЛЬ ИИ', -28, 1.75, -2.04, 's', { bg: '#6e4bff', hgt: 0.32 });
  W.sign('правда и слухи', -28, 1.3, -2.04, 's', { bg: '#ff7a59', hgt: 0.26 });
  W.point('hallStand', { at: [-28, -2.1], stand: [-28, -0.3], label: 'Вера Андреевна', h: 2.6 });
  W.npc('vera', -26.4, -0.9, face(-26.4, -0.9, -28, 0.4));
  W.npc('masha', -29.7, 0.6, face(-29.7, 0.6, -28, 0.2));
  W.npc('vanya', -30.5, -0.6, face(-30.5, -0.6, -28, 0.2));
  W.npc('gosha', -26.0, 1.6, face(-26.0, 1.6, -28, 0.4));
  W.start = [-28.4, 2.0, Math.PI];
  owlTerminal(-24.6, -2.45, IMG.owl.normal);
  item((W, g) => F.plant(W, g, { big: true }), -31.4, 0);
  W.spot('secret', -23.6, -2.5, 1.9);
  // Камера над входом + листовка.
  wallCamera(-27, S - 0.15, Math.PI);
  W.spot('cam', -25.4, 2.6, 2.1);

  // Гирлянды в коридоре.
  F.buntingOnWall(W, -31.5, 31.5, 2.76, N + 0.12);

  // ---------------- Вход (станция 1: Лица) ----------------
  item((W, g) => F.turnstile(W, g), -28.4, 9.2);
  item((W, g) => F.turnstile(W, g), -25.8, 9.2);
  W.box(0.6, 2.3, 0.3, 0xcfd6e6, -27.1, 0, 9.4);
  W.box(0.5, 0.36, 0.06, 0x30344a, -27.1, 1.7, 9.24, { shadow: false });
  W.picture(IMG.owl.normal, 0.32, 0.32, -27.1, 1.88, 9.22, 's', { frame: null, transparent: true, glow: true });
  W.box(4.0, 2.4, 0.1, 0xbfe3ff, -27, 0, 12.85, { shadow: false }); // стеклянные входные двери
  W.point('turnstile', { at: [-27.1, 9.2], stand: [-27.1, 7.4], label: 'Алина у турникета', h: 2.7 });
  W.npc('alina', -25.6, 7.3, face(-25.6, 7.3, -27.1, 7.0));
  W.npc('masha@entrance', -28.7, 7.2, face(-28.7, 7.2, -27.1, 7.0));
  item((W, g) => F.bench(W, g, { color: 0x7e9ad8 }), -31.3, 6.5, Math.PI / 2);
  item((W, g) => F.plant(W, g, { big: true }), -22.8, 12.3);

  // ---------------- Радиоузел (станция 2: Голос) ----------------
  item((W, g) => F.radioDesk(W, g), -26, -9.6);
  W.box(0.5, 0.18, 0.04, 0xe5484d, -26, 2.15, -12.9, { shadow: false }); // «В ЭФИРЕ»
  W.sign('В ЭФИРЕ', -26, 2.24, -12.85, 's', { bg: '#e5484d', hgt: 0.24 });
  item((W, g) => F.shelf(W, g, { w: 1.6, h: 1.4, books: false, color: 0x5b6280 }), -30.6, -10, Math.PI / 2);
  item((W, g) => F.chair(W, g, { color: 0x30344a }), -26, -8.6, Math.PI);
  W.point('radio', { at: [-26, -9.6], stand: [-26, -7.5], label: 'Артём и колонка Бусинка', h: 2.2 });
  W.npc('artem', -24.4, -8.1, face(-24.4, -8.1, -26, -7.4));
  for (const x of [-31, -21.8]) W.box(0.25, 2.2, 0.25, 0x8fa0c8, x, 0, -12.6); // акустические панели
  item((W, g) => F.window(W, g), -29, -12.92, 0, { block: false });

  // ---------------- Библиотека (станция 3: Тексты) ----------------
  for (const x of [-19.4, -17.1, -13.9, -11.6]) item((W, g) => F.shelf(W, g, { w: 2.2, h: 2.2 }), x, -12.65);
  item((W, g) => F.shelf(W, g, { w: 2.4, h: 1.6 }), -20.2, -8.6, Math.PI / 2);
  item((W, g) => F.desk(W, g, { w: 2.0, d: 0.8, color: 0xb88a5a, legs: 0x6b4a2e }), -15.5, -9.2);
  owlTerminal(-13.6, -9.6, IMG.owl.think, 1.4, 0.9);
  W.point('library', { at: [-15.5, -9.2], stand: [-15.5, -7.4], label: 'Галина Сергеевна', h: 2.2 });
  W.npc('galina', -16.3, -10.2, 0);
  for (const x of [-19.3, -11.6]) item((W, g) => { F.table(W, g, { w: 1.4, d: 0.9, color: 0xe8d2a8 }); const l = new THREE.Group(); g.add(l); F.lamp(W, l); }, x, -5.6);
  W.spot('free', -18.4, -11.2, 2.0);

  // ---------------- Кабинет ИЗО (станция 4: Рисунки) ----------------
  W.picture(IMG.draw.cat_library, 1.3, 1.3, -8, 1.6, -12.9, 's', { frame: 0xb88a5a });
  W.picture(IMG.draw.fox_baikal, 1.3, 1.3, -2, 1.6, -12.9, 's', { frame: 0xb88a5a });
  item((W, g) => F.tvStand(W, g, { w: 1.9, h: 1.2, color: 0x30344a }), -5, -10.3);
  W.picture(IMG.draw.owl_space, 1.8, 1.1, -5, 1.71, -10.25, 's', { frame: null, glow: true });
  W.point('easel', { at: [-5, -10.3], stand: [-5, -8.3], label: 'Лев Борисович', h: 2.9 });
  W.npc('lev', -3.4, -8.9, face(-3.4, -8.9, -5, -8.2));
  item((W, g) => F.easel(W, g), -8.6, -7.4, 0.3);
  W.picture(IMG.draw.fox_space, 0.85, 0.85, -8.6, 1.35, -7.32, 's', { frame: 0xffffff });
  item((W, g) => F.table(W, g, { w: 1.8, d: 0.9, color: 0xf2c48a }), -1.6, -5.4);
  for (const [x, c] of [[-1.2, 0xe05a4f], [-1.5, 0x4f8be0], [-0.9, 0xf2b84b]]) W.cyl(0.04, 0.1, c, x, 0.77, -5.3);

  // ---------------- Шахматная рекреация (станция 5: Игры) ----------------
  for (const [x, z] of [[2.6, -10.6], [7.4, -10.6], [7.4, -7.2]]) item((W, g) => F.chessTable(W, g), x, z);
  item((W, g) => { F.chessTable(W, g); }, 5, -8.2);
  item((W, g) => F.tvStand(W, g, { w: 1.4, h: 0.9 }), 5, -12.4);
  W.box(1.3, 0.8, 0.02, 0xcfe6ff, 5, 1.15, -12.32, { shadow: false });
  W.sign('ИИ ✕ ◯', 5, 1.55, -12.3, 's', { bg: '#2563eb', hgt: 0.3 });
  W.point('chess', { at: [5, -8.2], stand: [5, -6.4], label: 'Даня', h: 2.2 });
  W.npc('danya', 6.4, -7.0, face(6.4, -7.0, 5, -6.3));
  W.npc('vanya@chess', 3.4, -6.6, face(3.4, -6.6, 5, -6.3));
  item((W, g) => F.sofa(W, g, { w: 2, color: 0x58b97a }), 1.2, -5.0, Math.PI / 2);

  // ---------------- Технология (станция 6: Робот, ИИ и человек) ----------------
  // Верстак с экспонатами задания «Робот или ИИ?» (те же 8 предметов, что на карточках).
  item((W, g) => F.workbench(W, g, { w: 3.2, d: 1.0 }), 15.5, -10.4);
  item((W, g) => {
    const put = (fn, x, z, s = 1, ry = 0) => { const q = new THREE.Group(); q.position.set(x, 0.8, z); q.scale.setScalar(s); q.rotation.y = ry; g.add(q); fn(W, q); };
    put(F.armRobot, -1.25, -0.15, 0.5);
    put(F.shustrik, -0.75, 0.15, 0.4, 0.4);
    put(F.vacuum, -0.3, -0.18, 0.8);
    put(F.car, 0.15, 0.12, 0.42, -0.3);
    put(F.phone, 0.55, -0.2, 1, 0.3);
    put((W, q) => F.pc(W, q, { y: 0, screen: 0x6e4bff }), 0.85, -0.25, 0.5);
    put(F.calculator, 1.0, 0.2, 1, -0.2);
    put(F.alarmClock, 1.35, 0.1, 1, -0.4);
  }, 15.5, -10.4, 0, { block: false });
  // Зарядка Шустрика (сам он ездит по коридору — живой мир).
  W.box(0.5, 0.06, 0.5, 0x30344a, 19.6, 0, -11.6, { shadow: false });
  item((W, g) => F.cabinet(W, g, { w: 1.6, h: 1.8, d: 0.5, color: 0xcfd6e6 }), 11.2, -9, Math.PI / 2);
  item((W, g) => F.table(W, g, { w: 1.4, d: 0.8, color: 0xc9a77c }), 12.6, -5.4);
  W.point('tech', { at: [15.5, -10.4], stand: [15.5, -8.6], label: 'Сергей Николаевич', h: 2.2 });
  W.npc('sergey', 17.2, -9.0, face(17.2, -9.0, 15.5, -8.5));
  item((W, g) => F.window(W, g), 13, -12.92, 0, { block: false });

  // ---------------- Лаборатория ИИ (станция 7) со шлюзом ----------------
  // Стойка шлюза со считывателем и экраном (в коридоре, справа от двери).
  W.box(0.35, 1.5, 0.35, 0xcfd6e6, 27.5, 0, N + 0.35);
  W.box(0.3, 0.22, 0.05, 0x30344a, 27.5, 1.2, N + 0.54, { shadow: false });
  W.box(0.16, 0.16, 0.04, 0x3ad0ff, 27.5, 0.85, N + 0.54, { shadow: false });
  W.sign('Только по пропуску', 27.5, 1.62, N + 0.56, 's', { bg: '#30344a', hgt: 0.14 });
  wallCamera(27.5, N - 0.05, 0, 2.3);
  // Стеклянные створки (двигаются).
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd3ff, transparent: true, opacity: 0.55 });
  const panes = [-1, 1].map((sx) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.06), glass);
    m.position.set(26 + sx * 0.5, 1.05, N);
    W.dynamic.add(m);
    return { m, sx, home: 26 + sx * 0.5 };
  });
  let gateOpenK = 0, gateWant = 0;
  W.animated.push((dt) => {
    gateOpenK += (gateWant - gateOpenK) * Math.min(1, dt * 3);
    for (const p of panes) p.m.position.x = p.home + p.sx * gateOpenK * 0.95;
  });
  const gateRect = [25, N - 0.15, 27, N + 0.15];
  W.onNav = (nav) => nav.setBlock('gate', gateRect);
  W.actions.gateOpen = async ({ nav, sleep }) => { if (gateWant !== 1) sound.play('door', 0.8); gateWant = 1; nav.setBlock('gate', null); await sleep(500); };
  W.actions.gateClose = async ({ nav }) => { if (gateWant !== 0) sound.play('door', 0.6); gateWant = 0; nav.setBlock('gate', gateRect); };
  W.point('labGate', { at: [26, N], stand: [26, -1.4], label: 'Шлюз Лаборатории', h: 2.6, reach: 1.2 });
  // Внутри: большой экран Совёнка, стол Веры, у дальней стены — стол с рукой-манипулятором.
  W.box(3.2, 2.0, 0.08, 0x30344a, 26.5, 0.6, -12.9, { shadow: false });
  W.box(3.0, 1.8, 0.02, 0xcfe6ff, 26.5, 0.7, -12.84, { shadow: false });
  W.picture(IMG.owl.happy, 1.6, 1.6, 26.5, 1.6, -12.8, 's', { frame: null, transparent: true, glow: true });
  W.point('labScreen', { at: [26.5, -12.4], stand: [26.5, -10.4], label: 'Экран Совёнка', h: 2.9 });
  W.npc('vera@lab', 24.6, -10.0, face(24.6, -10.0, 26.5, -10.3));
  W.npc('vera@gate', 24.4, -1.2, face(24.4, -1.2, 26, -1.4));
  W.npc('gosha@lab', 27.6, -0.6, face(27.6, -0.6, 26, -1.4));
  for (const z of [-9.5, -6.5]) item((W, g) => { F.desk(W, g, { w: 1.4, d: 0.7, color: 0xffffff }); F.pc(W, g, { screen: 0x7c6bff }); }, 22.6, z, Math.PI / 2);
  item((W, g) => F.table(W, g, { w: 2.4, d: 0.8, color: 0x8a8fa8 }), 30.6, -9, Math.PI / 2); // стол с рукой-манипулятором
  item((W, g) => { const q = new THREE.Group(); q.position.y = 0.77; g.add(q); F.armRobot(W, q, { color: 0x2f7fe0 }); }, 30.6, -9, -Math.PI / 2, { block: false });
  wallCamera(-6, S - 0.15, Math.PI);

  // ---------------- Гардероб ----------------
  item((W, g) => F.coatRack(W, g), -19.6, 7.5);
  item((W, g) => F.coatRack(W, g), -15.6, 10.5);
  item((W, g) => F.bench(W, g, { w: 1.6, color: 0x8a8fa8 }), -20.6, 11.6);
  W.spot('thanks', -17.6, 9.2, 2.0);

  // ---------------- Столовая ----------------
  for (const [x, z] of [[-10.5, 7.5], [-6.5, 7.5], [-10.5, 10.8], [-6.5, 10.8]]) {
    item((W, g) => {
      F.table(W, g, { w: 1.8, d: 0.9, color: 0xffffff });
      for (const sz of [-1, 1]) W.box(1.6, 0.06, 0.32, 0x7e9ad8, 0, 0.44, sz * 0.75, { parent: g });
    }, x, z);
  }
  item((W, g) => F.juiceMachine(W, g), -3.2, 4.2, -Math.PI / 2);
  W.spot('juice', -3.2, 4.2, 2.3);

  // ---------------- Медкабинет ----------------
  item((W, g) => F.couch(W, g), 3.6, 11.6);
  item((W, g) => F.cabinet(W, g, { w: 1.2, h: 1.8, d: 0.5, color: 0xffffff }), -0.8, 8, Math.PI / 2);
  W.box(0.5, 0.5, 0.05, 0xe5484d, 1.2, 1.6, 12.9, { shadow: false });
  W.spot('doctor', 1.6, 9.0, 1.9);

  // ---------------- Спортзал ----------------
  for (const x of [8, 9.6, 11.2, 12.8]) item((W, g) => F.wallBars(W, g), x, 12.7, 0, { block: true });
  item((W, g) => F.rug(W, g, { w: 3, d: 2, color: 0x2f7fe0 }), 14.5, 11.2, 0, { block: false });
  W.spot('never', 10.4, 12.2, 2.4);

  // ---------------- Актовый зал (финал) ----------------
  item((W, g) => F.stage(W, g, { w: 9, d: 3.2, color: 0xb5793f, curtain: 0x8e2d4a }), 26, 5.0, 0, { pad: 0.05 });
  W.box(3.6, 1.9, 0.06, 0x30344a, 26, 0.8, S + 0.12, { shadow: false });
  W.box(3.4, 1.75, 0.02, 0xcfe6ff, 26, 0.87, S + 0.17, { shadow: false });
  W.picture(IMG.owl.happy, 1.5, 1.5, 26, 1.75, S + 0.2, 's', { frame: null, transparent: true, glow: true });
  for (const z of [9.2, 10.6, 12.0]) item((W, g) => F.seats(W, g, { n: 9, color: 0x5a6fd6 }), 26, z, Math.PI);
  wallCamera(28.5, S + 0.15, 0, 2.9);
  W.point('assemblyStage', { at: [26, 5.2], stand: [26, 7.6], label: 'Актовый зал', h: 2.8 });
  W.npc('gosha@assembly', 20.6, 6.0, face(20.6, 6.0, 26, 7.6));
  W.npc('gosha@stage', 20.8, 6.6, face(20.8, 6.6, 26, 7.6));
  W.npc('vera@hall9', 28.3, 7.6, face(28.3, 7.6, 26, 7.6));
  W.npc('masha@hall9', 21.0, 9.2, face(21.0, 9.2, 26, 7.6));
  W.npc('vanya@hall9', 31.0, 9.2, face(31.0, 9.2, 26, 7.6));

  // Рюкзак у стены коридора — камера примет его за собаку.
  item((W, g) => {
    W.box(0.42, 0.5, 0.26, 0x2f7fe0, 0, 0, 0, { parent: g });
    W.box(0.32, 0.2, 0.06, 0x1d4ed8, 0, 0.12, 0.15, { parent: g });
    W.box(0.3, 0.06, 0.1, 0x1d4ed8, 0, 0.5, -0.02, { parent: g });
  }, -4.5, 2.45);

  // ---------------- Обстановка кабинетов и «живые» предметы ----------------
  // live(): предмет; если у него есть анимация (g.userData.tick) — не объединяем его с остальной
  // геометрией и вызываем tick каждый кадр. На стене вдоль X (z — линия стены) предмет прячется со стеной.
  const live = (fn, x, z, rot = 0, opts) => {
    const g = W.item((g) => fn(W, g), x, z, rot, opts);
    if (g.userData.tick) { W.dynamic.add(g); W.animated.push(g.userData.tick); }
    return g;
  };
  const onWallX = (fn, x, z, y = 0) => {
    const g = live(fn, x, z + 0.1, 0, { block: false });
    g.position.y = y;
    W.dynamic.add(g);
    W.onWall(g, z);
    return g;
  };
  const wallSign = (text, x, y, z, o) => W.onWall(W.sign(text, x, y, z + 0.13, 's', o), z);

  // Радиоузел: колонки, микрофон, экран с проектором, кресло, часы.
  live(F.speakerBox, -27.4, -12.4);
  live(F.speakerBox, -25.1, -12.4);
  onWallX((W, g) => F.projScreen(W, g, { w: 1.6, h: 1.0 }), -23.9, -13);
  live((W, g) => { F.table(W, g, { w: 0.6, d: 0.5, color: 0x8a8fa8 }); F.projector(W, g); }, -23.9, -6.9);
  live(F.micStand, -27.5, -9.0);
  live((W, g) => F.armchair(W, g, { color: 0x7c6bff }), -30.9, -4.3, Math.PI / 2);
  live((W, g) => F.rug(W, g, { w: 2.6, d: 1.6, color: 0x7c6bff }), -26, -9.4, 0, { block: false });
  onWallX(F.clock, -30.35, -13, 1.9);
  live((W, g) => F.plant(W, g), -21.7, -4.0);

  // Библиотека: глобус, тележка с книгами, кресло для чтения, часы.
  live(F.globe, -11.2, -5.35, 0, { block: false });
  live(F.bookCart, -10.75, -8.6, Math.PI / 2);
  live((W, g) => F.armchair(W, g, { color: 0x58b97a }), -20.3, -11.5, Math.PI / 2);
  onWallX(F.clock, -15.5, -13, 2.42);
  live((W, g) => F.plant(W, g), -10.6, -4.0);

  // Кабинет ИЗО: ещё мольберты, скульптура, парты, стеллаж с тетрадями, классный уголок.
  live(F.easel, -9.0, -10.7, 0.25);
  live(F.easel, -1.0, -10.9, -0.25);
  live(F.bust, -6.7, -12.4);
  live((W, g) => F.schoolDesk(W, g, { color: 0xd9b98c }), -8.4, -4.9);
  live((W, g) => F.schoolDesk(W, g, { color: 0xd9b98c }), -6.9, -4.9);
  live((W, g) => F.notebookShelf(W, g), -9.65, -9.0, Math.PI / 2);
  live((W, g) => F.corkBoard(W, g), -0.12, -11.4, -Math.PI / 2, { block: false });
  W.sign('Классный уголок', -0.1, 2.12, -11.4, 'w', { bg: '#ff7a59', hgt: 0.2 });

  // Шахматная рекреация: полка с настольными играми и наградами, кресла-мешки, цветок.
  live((W, g) => F.gameShelf(W, g), 9.75, -9.5, -Math.PI / 2);
  live((W, g) => F.beanBag(W, g, { color: 0xff7a59 }), 1.0, -12.0, 0, { block: false });
  live((W, g) => F.beanBag(W, g, { color: 0x58b97a }), 8.6, -12.1, 0, { block: false });
  live((W, g) => F.plant(W, g), 9.4, -3.6);

  // Технология: доска, 3D-принтер, инструменты на стене, ящики, стеллаж с тетрадями, часы.
  onWallX((W, g) => F.board(W, g, { w: 2.0 }), 15.5, -13, 0.1);
  live(F.printer3d, 12.6, -5.4, 0, { block: false });
  live((W, g) => F.toolBoard(W, g), 20.88, -7.0, -Math.PI / 2, { block: false });
  live(F.crates, 11.0, -12.2);
  live((W, g) => F.notebookShelf(W, g, { w: 1.0 }), 20.65, -11.9, -Math.PI / 2);
  onWallX(F.clock, 17.4, -13, 2.0);

  // Лаборатория ИИ: серверные стойки, стол с голограммой, цветок.
  for (const z of [-12.3, -11.6]) live(F.serverRack, 31.5, z, -Math.PI / 2);
  live(F.holoTable, 28.3, -5.4);
  live((W, g) => F.plant(W, g, { big: true }), 21.6, -3.8);

  // Гардероб: шкафчики, раковина с зеркалом, коробка «находок».
  live((W, g) => F.lockers(W, g, { n: 5 }), -21.65, 6.0, Math.PI / 2);
  live(F.sink, -13.45, 5.4, -Math.PI / 2);
  live(F.crates, -14.4, 12.2);

  // Столовая: раздача, баки для раздельного сбора, кулер, часы.
  live((W, g) => F.servingCounter(W, g, { w: 4 }), -8.0, 12.4);
  live(F.trashBins, -12.6, 5.3, Math.PI / 2);
  ['Бумага', 'Пластик', 'Стекло', 'Прочее'].forEach((t, i) => W.sign(t, -12.9, 1.02, 5.3 - (i - 1.5) * 0.52, 'e', { bg: ['#2f7fe0', '#e0a21f', '#1db57a', '#6b7086'][i], hgt: 0.13, maxW: 0.5 }));
  live(F.waterCooler, -2.4, 9.0, -Math.PI / 2);
  live((W, g) => F.clock(W, g), -12.9, 8.5, Math.PI / 2, { block: false }).position.y = 2.0;

  // Медкабинет: весы с ростомером, таблица для проверки зрения, раковина, стол медсестры.
  live(F.medScale, 5.55, 4.7, -Math.PI / 2);
  W.box(0.03, 1.15, 0.75, 0xffffff, 5.93, 0.9, 9.0, { shadow: false });
  [['Ш Б', 1.82, 0.2], ['М Н К', 1.56, 0.15], ['Ы М Б Ш', 1.34, 0.11], ['Б Ы Н К М', 1.16, 0.085]].forEach(([t, y, hgt]) => W.sign(t, 5.9, y, 9.0, 'w', { bg: '#ffffff', fg: '#1f2340', hgt, maxW: 0.65 }));
  live(F.sink, -1.55, 11.9, Math.PI / 2);
  live((W, g) => F.schoolDesk(W, g, { color: 0xffffff }), 4.6, 8.3, -Math.PI / 2);

  // Спортзал: баскетбольные кольца, маты, фишки, скамейка.
  live(F.basketHoop, 6.1, 8.2, Math.PI / 2, { block: false });
  live(F.basketHoop, 17.9, 8.2, -Math.PI / 2, { block: false });
  live((W, g) => F.mats(W, g), 17.1, 11.8);
  for (const x of [7.2, 8.2, 9.2]) live(F.sportCone, x, 4.2, 0, { block: false });
  live((W, g) => F.bench(W, g, { w: 1.6, color: 0x8a6a42 }), 6.5, 5.4, Math.PI / 2);

  // Вход: доска почёта отличников и доска «Наши учителя» (на стене у коридора), аквариум.
  const P = IMG.portraits;
  const honorBoard = (title, x, people, frame) => {
    const z = S + 0.11;
    const items = [W.box(2.6, 1.55, 0.04, frame, x, 0.85, z), W.box(2.45, 1.4, 0.02, 0xfff8ea, x, 0.92, z + 0.02, { shadow: false })];
    items.forEach((m) => { W.dynamic.add(m); W.onWall(m, S); });
    W.onWall(W.sign(title, x, 2.17, z + 0.06, 's', { bg: '#b8862b', hgt: 0.26 }), S);
    people.forEach(([img, name], i) => {
      const px = x + (i - (people.length - 1) / 2) * 0.6;
      W.onWall(W.picture(img, 0.46, 0.46, px, 1.55, z + 0.05, 's', { frame: 0xe7c35a, transparent: true }), S);
      W.onWall(W.sign(name, px, 1.17, z + 0.06, 's', { bg: '#30344a', hgt: 0.11, maxW: 0.56 }), S);
    });
  };
  honorBoard('Наши отличники', -30.2, [[P.masha, 'Маша'], [P.danya, 'Даня'], [P.artem, 'Артём'], [P.vanya, 'Ваня']], 0xd9a03a);
  honorBoard('Наши учителя', -23.8, [[P.vera, 'Вера Андреевна'], [P.galina, 'Галина Сергеевна'], [P.lev, 'Лев Борисович'], [P.sergey, 'Сергей Николаевич']], 0x5b6280);
  live((W, g) => F.aquarium(W, g), -22.95, 6.2, -Math.PI / 2);

  // Коридор: камеры наблюдения, баки для раздельного сбора, кулер.
  for (const x of [-15, 5, 15]) wallCamera(x, S - 0.15, Math.PI);
  live(F.trashBins, 30.3, N + 0.35);
  ['Бумага', 'Пластик', 'Стекло', 'Прочее'].forEach((t, i) => wallSign(t, 30.3 + (i - 1.5) * 0.52, 1.12, N, { bg: ['#2f7fe0', '#e0a21f', '#1db57a', '#6b7086'][i], hgt: 0.13, maxW: 0.5 }));
  live(F.waterCooler, 28.85, N + 0.25);

  // Туалеты в конце коридора: две отдельные двери «М» и «Ж» на торцевой стене.
  const wcDoor = (z, letter, color, css, female) => {
    const X = 31.9;
    W.box(0.05, 2.2, 1.04, 0xffffff, X, 0, z, { shadow: false }); // наличник
    W.box(0.05, 2.1, 0.9, 0xeef2fb, X - 0.03, 0, z, { shadow: false }); // полотно двери
    W.box(0.04, 0.04, 0.14, 0x8a8fa8, X - 0.07, 1.0, z - 0.3, { shadow: false }); // ручка
    W.box(0.02, 0.42, 0.34, 0xffffff, X - 0.06, 1.3, z, { shadow: false }); // табличка
    W.ball(0.045, color, X - 0.08, 1.62, z, { shadow: false }); // голова
    if (female) {
      W.cone(0.085, 0.2, color, X - 0.08, 1.38, z, { shadow: false }); // платье
    } else {
      W.box(0.02, 0.16, 0.11, color, X - 0.08, 1.42, z, { shadow: false }); // туловище
    }
    for (const s of [-1, 1]) W.box(0.02, 0.1, 0.025, color, X - 0.08, 1.3, z + s * 0.03, { shadow: false }); // ноги
    W.sign(letter, X - 0.09, 2.38, z, 'w', { bg: css, hgt: 0.26 });
  };
  wcDoor(-1.3, 'М', 0x2f7fe0, '#2f7fe0', false);
  wcDoor(1.3, 'Ж', 0xe5484d, '#e5484d', true);

  // Цветы в горшках: на стеллажах, шкафах и подоконниках.
  const FLOWERS = [0xef7fb0, 0xe5484d, 0xffc53d, 0x9a6bd8, 0xffffff, 0xff8a3d];
  [
    [-19.4, 2.2, -12.65], [-13.9, 2.2, -12.65], [-11.6, 2.2, -12.7], // библиотека, верх стеллажей
    [-30.6, 1.4, -10.4], [-29.35, 0.92, -12.78], [-28.65, 0.92, -12.78], // радиоузел: стеллаж, подоконник
    [-9.65, 1.6, -8.6], // ИЗО: стеллаж с тетрадями
    [9.75, 1.6, -10.0], // шахматы: полка с играми
    [11.2, 1.8, -9.4], [20.65, 1.6, -11.6], [12.6, 0.92, -12.78], [13.4, 0.92, -12.78], // технология: шкаф, стеллаж, подоконник
    [-0.8, 1.8, 8.3], // медкабинет: шкаф
    [-21.65, 1.8, 6.6], // гардероб: шкафчики
  ].forEach(([x, y, z], i) => { item((W, g) => F.flowerPot(W, g, { color: FLOWERS[i % FLOWERS.length] }), x, z, i, { block: false }).position.y = y; });

  // Указатели на полу (их хорошо видно сверху, и они не загораживают героя).
  // Указатели на полу: небольшая бело-серая полупрозрачная стрелка, внутри серая надпись — не отвлекают.
  const EXIT = {};
  W.floorArrow('Библиотека · ИЗО · Шахматы', -20.5, 0.15, 'r');
  W.floorArrow('Холл · Радиоузел · Выход', -12.0, 0.15, 'l');
  W.floorArrow('Технология · Лаборатория ИИ · Актовый зал', 4.5, 0.15, 'r');
  W.floorArrow('Вход · Выход', -27.0, 1.9, 'd', EXIT);
  W.floorArrow('Выход', -27.0, 11.2, 'd', EXIT);

  // Пост охраны у входа: стол с монитором и охранник.
  item((W, g) => { F.desk(W, g, { w: 1.2, d: 0.6, color: 0x8a8fa8 }); F.pc(W, g, { screen: 0x2b3a67 }); }, -24.0, 11.0);
  W.npc('guard', -24.0, 11.75, Math.PI);
  // Выход из школы — выход из игры (у стеклянных дверей игра спросит, выйти ли).
  W.exit = { at: [-27, 12.3], r: 0.9 };

  // ---------------- Плакаты об ИИ ----------------
  // Картинки без текста и без подписей. Плакаты висят на северных стенах (их видно с камеры)
  // не ближе метра от дверей и ниже вывесок; прячутся вместе со стеной.
  const POS = IMG.posters;
  const poster = (img, x, z, { w = 0.8, h = 1.2, y = 1.45 } = {}) => W.onWall(W.picture(img, w, h, x, y, z + 0.11, 's', { frame: 0xffffff }), z);
  const sticker = (img, x, z, y, size = 0.42, ar = 1) => W.onWall(W.picture(img, size * ar, size, x, y, z + 0.1, 's', { frame: null, transparent: true }), z);
  // Холл.
  poster(POS.poster_rule_wide, -30.6, N, { w: 1.5, h: 1.0, y: 1.5 });
  poster(POS.poster_eyes, -26.1, N, { w: 0.7, h: 1.05, y: 1.5 });
  // Коридор, между дверями станций.
  poster(POS.poster_voice, -20.6, N);
  poster(POS.poster_learn, -17.9, N);
  poster(POS.poster_check, -13.0, N);
  sticker(POS.sticker_idea, -10.6, N, 1.9, 0.45, 0.7);
  poster(POS.poster_neurons, -7.6, N);
  poster(POS.poster_vision, -2.4, N);
  sticker(POS.sticker_owl, -0.4, N, 1.85, 0.5, 0.92);
  poster(POS.poster_privacy, 10.3, N);
  poster(POS.poster_fake, 13.0, N);
  poster(POS.poster_festival_wide, 19.6, N, { w: 1.5, h: 1.0, y: 1.5 });
  sticker(POS.sticker_shield, 22.9, N, 1.9, 0.45, 0.9);
  // В кабинетах.
  poster(POS.poster_chess, 2.0, -13);
  sticker(POS.sticker_star, 8.2, -13, 1.9, 0.42, 1.07);
  poster(POS.poster_robots, 18.6, -13);

  // ---------------- Живой мир (src/engine/life.js) ----------------
  const kid = (top, hair, style, bottom = 0x2f3b5c) => ({ top, hair, style, bottom });
  W.life = {
    balls: [[14, 8, 0xe5484d], [15.2, 9.2, 0x2f7fe0], [9, 7, 0xffc53d]],
    ballBounds: [6.3, 3.3, 17.7, 12.4],
    balloons: [[-31.4, -2.4], [-31.4, 2.4], [19, 12.2], [31.2, 12.2]],
    // Полосы коридора (z): пара учеников −2.3…−2.1, Шустрик −1.45 и +2.1, книги −0.6, ученики +0.1/+0.6, почта +1.35.
    shustrikRoute: [[-20, -1.45], [20, -1.45], [20, 2.1], [-20, 2.1]],
    students: [
      { look: kid(0x58b97a, 0x3a2418, 'pony'), path: [[-22, 0.1], [22, 0.1]], pauses: [0, 1], speed: 1.0 },
      { look: kid(0x9a6bd8, 0x6b4226, 'short'), path: [[21, 0.6], [-21, 0.6]], pauses: [0, 1], speed: 1.15 },
      { look: kid(0xf2b84b, 0x2a1d17, 'curly'), path: [[-18, -2.3], [-2, -2.3]], pauses: [0, 1], speed: 0.9 },
      { look: kid(0x4f8be0, 0x7a4a26, 'braids'), path: [[-17.3, -2.1], [-1.3, -2.1]], pauses: [0, 1], speed: 0.9 },
      { look: kid(0xe05a4f, 0x2a1d17, 'short'), path: [[-4.4, 4.5], [-4.4, 4.7]], pauses: [0, 1], speed: 0.3 },
      { look: kid(0x18b5b0, 0x6b4226, 'long'), path: [[-5.2, 4.6], [-5.2, 4.8]], pauses: [0, 1], speed: 0.3 },
    ],
    facts: {
      robot_word: [-31, 1.6], face_points: [-30.8, 9.6], voice_cloud: [-30, -6.5], neurons: [-12, -7.5],
      ai_artist: [-1.5, -8.5], bot_word: [8.6, -5.2], not_robot: [-6, 2.1], pin_4: [-12, 9.3],
      sms_code: [16.5, 5], factory_cv: [30, -6.5],
    },
    cameras: [[-27, S - 0.15, 2.35], [-6, S - 0.15, 2.35], [27.5, N - 0.05, 2.3], [28.5, S + 0.15, 2.9]],
    decoys: [
      { id: 'stand', x: -28, z: -2.1, y: 0.9, h: 1.1, w: 1.6, label: 'Человек · 41 %' },
      { id: 'backpack', x: -4.5, z: 2.45, y: 0, h: 0.6, w: 0.9, label: 'Собака · 38 %' },
      { id: 'signpost', x: 22.6, z: S - 0.55, y: 0, h: 1.4, w: 0.7, label: 'Человек · 44 %' },
      { id: 'owlscreen', x: 26, z: S + 0.12, y: 0.8, h: 1.9, w: 1.2, label: 'Человек · 61 %' },
    ],
    couriers: [
      {
        cargo: 'mail', color: 0x1db57a, label: 'Почта', title: 'Робот-доставщик почты',
        route: [[-25, 1.35], [9, 1.35], [12, 1.35], [12, 5.2]], corridor: [N, S],
        info: 'Возит письма, журналы и канцелярию по кабинетам. Камеры и датчики видят дорогу, а программа с ИИ узнаёт людей и объезжает их.\nА вот куда ехать и что везти, решает человек — завхоз школы.',
      },
      {
        cargo: 'books', color: 0x4f8be0, label: 'Книги', title: 'Робот-доставщик книг',
        route: [[-17.6, -4.8], [-15.5, -3.2], [-15.5, -0.6], [22, -0.6]], corridor: [N, S],
        info: 'Развозит книги из библиотеки по классам. ИИ помогает ему видеть людей и выбирать путь по коридору.\nКакие книги и в какой класс везти, решает библиотекарь.',
      },
    ],
  };

  // Облёт на титуле.
  W.center.set(0, 0, 0);
  W.orbitR = 34;
  W.orbitH = 28;

  // --- помощники ---
  // Терминал Совёнка: экран на стойке с картинкой.
  function owlTerminal(x, z, img, w = 1.3, hgt = 1.0) {
    item((W, g) => F.tvStand(W, g, { w, h: hgt, color: 0x3b3f5c }), x, z);
    W.box(w, hgt, 0.02, 0xcfe6ff, x, 1.15, z + 0.0, { shadow: false });
    W.picture(img, hgt * 0.85, hgt * 0.85, x, 1.15 + hgt / 2, z + 0.03, 's', { frame: null, transparent: true, glow: true });
  }
  // Камера наблюдения на стене + табличка «Ведётся видеонаблюдение».
  // На стенах коридора камера — «предмет на стене»: прячется, когда стена опускается.
  function wallCamera(x, z, rot, y = 2.35) {
    const g = W.item((g) => F.camera(W, g), x, z, rot, { block: false });
    g.position.y = y;
    if (Math.abs(Math.abs(z) - 3) < 0.3) { W.dynamic.add(g); W.onWall(g, z > 0 ? S : N); }
  }
}
