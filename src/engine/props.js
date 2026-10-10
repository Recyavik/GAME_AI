// Конструктор мира: комнаты, стены с проёмами, мебель, вывески, картинки на стенах.
// Игра (games/<slug>/world.js) вызывает методы WorldBuilder и описывает точки сценария.
//
// Система координат: X — вправо, Z — к камере (вниз по экрану), Y — вверх. 1 единица = 1 м.
// Стены, которые оказываются между камерой и игроком (южнее его), автоматически
// опускаются до плинтуса — получается «кукольный домик».
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat } from './characters.js';

const WALL_H = 2.7;
const WALL_T = 0.16;
const DOOR_H = 2.15;
const R = 0.3; // радиус игрока

const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 12);
const sph = new THREE.SphereGeometry(1, 12, 8);
const cone = new THREE.ConeGeometry(1, 1, 8);

export class WorldBuilder {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.dynamic = new THREE.Group(); // не объединяется (картинки, анимированное)
    scene.add(this.root, this.dynamic);
    this.walk = [];
    this.block = [];
    this.hWalls = []; // стены вдоль X: {g, z, x1, x2}
    this.vWalls = []; // стены вдоль Z: {g, x, z1, z2}
    this.wallItems = []; // предметы на стенах вдоль X: прячутся вместе со стеной
    this.points = {};
    this.spots = {};
    this.npcs = {};
    this.animated = [];
    this.start = [0, 0, 0];
    this.center = new THREE.Vector3();
  }

  // ---------- примитивы ----------
  mesh(geom, color, sx, sy, sz, x, y, z, { parent = this.root, rot = 0, shadow = true } = {}) {
    const m = new THREE.Mesh(geom, typeof color === 'number' ? mat(color) : color);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    m.rotation.y = rot;
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  // Коробка по центру основания: (x, y-низ, z).
  box(w, h, d, color, x = 0, y = 0, z = 0, o) { return this.mesh(box, color, w, h, d, x, y + h / 2, z, o); }
  cyl(r, h, color, x = 0, y = 0, z = 0, o) { return this.mesh(cyl, color, r, h, r, x, y + h / 2, z, o); }
  ball(r, color, x = 0, y = 0, z = 0, o) { return this.mesh(sph, color, r, r, r, x, y, z, o); }
  cone(r, h, color, x = 0, y = 0, z = 0, o) { return this.mesh(cone, color, r, h, r, x, y + h / 2, z, o); }

  // Группа-предмет: строим в локальных координатах, ставим в (x, z) с поворотом.
  // block: true — предмет становится препятствием (по габаритам).
  item(build, x, z, rot = 0, { block = true, pad = 0 } = {}) {
    const g = new THREE.Group();
    build(g);
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    this.root.add(g);
    if (block) this.blockOf(g, pad);
    return g;
  }

  blockOf(obj, pad = 0) {
    obj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(obj);
    this.block.push([b.min.x - pad, b.min.z - pad, b.max.x + pad, b.max.z + pad]);
  }
  blockRect(x1, z1, x2, z2) { this.block.push([x1, z1, x2, z2]); }
  walkRect(x1, z1, x2, z2) { this.walk.push([x1, z1, x2, z2]); }

  // ---------- комнаты ----------
  // room({ x:[x1,x2], z:[z1,z2], floor, wall, doors:[{side:'n'|'s'|'e'|'w', at, w}], sides:'nsew', name })
  // Стороны: n — z1 (дальняя), s — z2 (ближняя к камере), w — x1, e — x2.
  room({ x, z, floor = 0xe8dcc4, wall = 0xf6efe2, trim = 0xc9b79a, doors = [], sides = 'nsew', pattern = null, h = WALL_H }) {
    const [x1, x2] = x, [z1, z2] = z;
    const f = this.box(x2 - x1, 0.1, z2 - z1, floor, (x1 + x2) / 2, -0.1, (z1 + z2) / 2);
    f.castShadow = false;
    if (pattern) this.floorPattern(x1, z1, x2, z2, pattern);
    const m = WALL_T / 2 + R;
    this.walkRect(x1 + m, z1 + m, x2 - m, z2 - m);
    const ds = (side) => doors.filter((d) => d.side === side).map((d) => [d.at - (d.w ?? 1.6) / 2, d.at + (d.w ?? 1.6) / 2]);
    if (sides.includes('n')) this.wallX(z1, x1, x2, ds('n'), wall, trim, h);
    if (sides.includes('s')) this.wallX(z2, x1, x2, ds('s'), wall, trim, h);
    if (sides.includes('w')) this.wallZ(x1, z1, z2, ds('w'), wall, trim, h);
    if (sides.includes('e')) this.wallZ(x2, z1, z2, ds('e'), wall, trim, h);
    // Проёмы — проходимые перемычки между комнатами.
    for (const d of doors) {
      const w = d.w ?? 1.6;
      if (d.side === 'n' || d.side === 's') {
        const zz = d.side === 'n' ? z1 : z2;
        this.walkRect(d.at - w / 2 + R, zz - 0.8, d.at + w / 2 - R, zz + 0.8);
      } else {
        const xx = d.side === 'w' ? x1 : x2;
        this.walkRect(xx - 0.8, d.at - w / 2 + R, xx + 0.8, d.at + w / 2 - R);
      }
    }
  }

  floorPattern(x1, z1, x2, z2, { color, step = 1 }) {
    for (let xx = x1 + step; xx < x2 - 0.01; xx += step) {
      const l = this.box(0.03, 0.005, z2 - z1, color, xx, -0.05 + 0.001, (z1 + z2) / 2);
      l.castShadow = false;
    }
  }

  _segments(a, b, holes) {
    const segs = [];
    let cur = a;
    for (const [h1, h2] of holes.sort((p, q) => p[0] - q[0])) {
      if (h1 > cur) segs.push([cur, h1]);
      cur = Math.max(cur, h2);
    }
    if (cur < b) segs.push([cur, b]);
    return segs;
  }

  // Стена вдоль X на линии z. Над проёмами — перемычки (прячутся, когда стена опущена).
  wallX(z, x1, x2, holes, color, trim, H = WALL_H) {
    for (const [a, b] of this._segments(x1 - WALL_T / 2, x2 + WALL_T / 2, holes)) {
      const g = new THREE.Group();
      g.position.set((a + b) / 2, 0, z);
      this.mesh(box, color, b - a, H, WALL_T, 0, H / 2, 0, { parent: g });
      this.mesh(box, trim, b - a + 0.01, 0.14, WALL_T + 0.04, 0, 0.07, 0, { parent: g });
      this.scene.add(g);
      this.hWalls.push({ g, z, x1: a, x2: b, cur: 1 });
    }
    for (const [a, b] of holes) {
      const g = new THREE.Group();
      g.position.set((a + b) / 2, 0, z);
      this.mesh(box, color, b - a, H - DOOR_H, WALL_T, 0, DOOR_H + (H - DOOR_H) / 2, 0, { parent: g });
      this.mesh(box, trim, b - a, 0.08, WALL_T + 0.04, 0, DOOR_H, 0, { parent: g });
      this.scene.add(g);
      this.hWalls.push({ g, z, x1: a, x2: b, cur: 1, lintel: true });
    }
  }

  // Стена вдоль Z на линии x. Целиком южнее игрока — тоже опускается (не загораживает обзор).
  wallZ(x, z1, z2, holes, color, trim, H = WALL_H) {
    const seg = (a, b, y0, h, isLintel) => {
      const g = new THREE.Group();
      g.position.set(x, 0, (a + b) / 2);
      this.mesh(box, color, WALL_T, h, b - a, 0, y0 + h / 2, 0, { parent: g });
      this.mesh(box, trim, WALL_T + 0.04, isLintel ? 0.08 : 0.14, b - a + 0.01, 0, isLintel ? y0 : 0.07, 0, { parent: g });
      this.scene.add(g);
      this.vWalls.push({ g, x, z1: a, z2: b, cur: 1, lintel: isLintel });
    };
    for (const [a, b] of this._segments(z1 - WALL_T / 2, z2 + WALL_T / 2, holes)) seg(a, b, 0, H, false);
    for (const [a, b] of holes) seg(a, b, DOOR_H, H - DOOR_H, true);
  }

  // Опустить стены между камерой и игроком.
  // Опускаем стены между игроком и камерой. (cx, cz) — направление от игрока к камере (по полу, единичное);
  // по умолчанию камера с юга. Стена «мешает», если её ближайшая к игроку точка лежит в сторону камеры.
  updateWalls(px, pz, dt, cx = 0, cz = 1) {
    const k = Math.min(1, dt * 8);
    const apply = (w, low) => {
      w.cur += ((low ? 0.09 : 1) - w.cur) * k;
      if (w.lintel) w.g.visible = w.cur > 0.6;
      else w.g.scale.y = w.cur;
    };
    const front = (x, z, lat, gap = 0.2) => {
      const dx = x - px, dz = z - pz;
      return dx * cx + dz * cz > gap && Math.abs(dx * cz - dz * cx) < lat;
    };
    const cl = (v, a, b) => Math.max(a, Math.min(b, v));
    for (const w of this.hWalls) apply(w, front(cl(px, w.x1, w.x2), w.z, 7));
    for (const w of this.vWalls) apply(w, front(w.x, cl(pz, w.z1, w.z2), 12, 0.4));
    // Предмет на стене прячется вместе со своим участком стены.
    for (const it of this.wallItems) {
      if (it.wall === undefined) it.wall = this.hWalls.find((w) => !w.lintel && Math.abs(w.z - it.z) < 0.3 && it.x >= w.x1 - 0.05 && it.x <= w.x2 + 0.05) || null;
      it.obj.visible = it.wall ? it.wall.cur > 0.6 : !front(it.x, it.z, 9);
    }
  }

  // Повесить предмет на стену вдоль X (линия z): он скрывается, когда стена опускается.
  onWall(obj, z) {
    obj.updateMatrixWorld(true);
    const p = new THREE.Vector3();
    obj.getWorldPosition(p);
    this.wallItems.push({ obj, z, x: p.x });
    return obj;
  }

  // ---------- картинки и надписи ----------
  texture(url) {
    const t = new THREE.TextureLoader().load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  // Плоскость с картинкой. face — куда смотрит лицевая сторона: 's' (к камере), 'e', 'w'.
  picture(url, w, h, x, y, z, face = 's', { frame = 0x3b3f5c, glow = false, transparent = false } = {}) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = { s: 0, e: Math.PI / 2, w: -Math.PI / 2, n: Math.PI }[face];
    if (frame != null) this.mesh(box, frame, w + 0.12, h + 0.12, 0.05, 0, 0, -0.02, { parent: g, shadow: false });
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      glow
        ? new THREE.MeshBasicMaterial({ map: this.texture(url), toneMapped: false, transparent, alphaTest: transparent ? 0.05 : 0 })
        : new THREE.MeshLambertMaterial({ map: this.texture(url), transparent, alphaTest: transparent ? 0.05 : 0 }),
    );
    m.position.z = 0.012;
    g.add(m);
    this.dynamic.add(g);
    return g;
  }

  // Табличка с текстом (canvas → текстура).
  // Размер задаётся высотой таблички (hgt); ширина — по длине текста, но не больше maxW
  // (длинный текст уменьшается, чтобы табличка влезла между окнами/дверями).
  sign(text, x, y, z, face = 's', { hgt = 0.38, maxW = 3, bg = '#3b3f5c', fg = '#ffffff', font = 'Unbounded', size = 64 } = {}) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
    m.position.set(x, y, z);
    if (face === 'up') m.rotation.x = -Math.PI / 2; // надпись на полу (верх текста — на север)
    else m.rotation.y = { s: 0, e: Math.PI / 2, w: -Math.PI / 2, n: Math.PI }[face];
    this.dynamic.add(m);
    // Размер холста — по ширине текста; табличка масштабируется под холст.
    const draw = () => {
      ctx.font = `700 ${size}px ${font}, sans-serif`;
      c.width = Math.ceil(ctx.measureText(text).width + size * 1.2);
      c.height = Math.ceil(size * 1.7);
      ctx.fillStyle = bg;
      roundRect(ctx, 0, 0, c.width, c.height, size * 0.4);
      ctx.fill();
      ctx.font = `700 ${size}px ${font}, sans-serif`;
      ctx.fillStyle = fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, c.width / 2, c.height / 2 + size * 0.05);
      let hh = hgt;
      let w = (hh * c.width) / c.height;
      if (w > maxW) { hh *= maxW / w; w = maxW; }
      m.scale.set(w, hh, 1);
      t.dispose();
      t.needsUpdate = true;
    };
    draw();
    // Шрифт мог ещё не загрузиться (он шире запасного) — перерисуем и пересчитаем размер.
    document.fonts?.load(`700 ${size}px ${font}`).then(draw, () => {});
    return m;
  }

  // ---------- точки сценария ----------
  // point('board', { at:[x,z], stand:[x,z], label:'Доска', h: 1.6 })
  point(name, p) { this.points[name] = { h: 1.8, ...p }; }
  spot(id, x, z, y = 1.6) { this.spots[id] = [x, z, y]; }
  // NPC на месте (x, z). id@… — запасная позиция для stage.place. Препятствие ставит движок
  // там, где NPC стоит сейчас (nav.setBlock), чтобы на старом месте не оставалась «невидимая стена».
  npc(id, x, z, rot = 0) { this.npcs[id] = [x, z, rot]; }

  // Указатель на полу: небольшая бело-серая полупрозрачная стрелка, внутри серая надпись (не отвлекает). dir — куда показывает: 'r' (восток, +X),
  // 'l' (запад), 'd' (юг, к камере), 'u' (север). Стрелка всегда показывает в мир, а надпись
  // переворачивается, если камеру развернули (W.viewYaw), — чтобы не читать её вверх ногами.
  floorArrow(text, x, z, dir = 'r', { color = 'rgba(255, 255, 255, 0.5)', fg = '#7d8296', hgt = 0.3, font = '"Golos Text"', size = 56, weight = 600 } = {}) {
    const mk = () => {
      const c = document.createElement('canvas');
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      this.dynamic.add(m);
      return { c, t, m, ctx: c.getContext('2d') };
    };
    const shape = mk(), label = mk();
    const vertical = dir === 'u' || dir === 'd';
    const draw = () => {
      const g = label.ctx;
      g.font = `${weight} ${size}px ${font}, sans-serif`;
      const tw = Math.ceil(g.measureText(text).width);
      const bodyW = tw + size * 1.2, bodyH = size * 1.7, head = size * 1.1;
      // Стрелка: тело + треугольный наконечник.
      const S = shape.c, s = shape.ctx;
      S.width = vertical ? bodyW : bodyW + head;
      S.height = vertical ? bodyH + head : bodyH * 1.5; // у горизонтальной — запас под «крылья» наконечника
      const y0 = vertical ? 0 : bodyH * 0.25, y1 = y0 + bodyH;
      s.fillStyle = color;
      s.beginPath();
      if (dir === 'r') { s.moveTo(0, y0); s.lineTo(bodyW, y0); s.lineTo(bodyW, 0); s.lineTo(bodyW + head, S.height / 2); s.lineTo(bodyW, S.height); s.lineTo(bodyW, y1); s.lineTo(0, y1); }
      if (dir === 'l') { s.moveTo(S.width, y0); s.lineTo(head, y0); s.lineTo(head, 0); s.lineTo(0, S.height / 2); s.lineTo(head, S.height); s.lineTo(head, y1); s.lineTo(S.width, y1); }
      if (dir === 'd') { s.moveTo(0, 0); s.lineTo(bodyW, 0); s.lineTo(bodyW, bodyH); s.lineTo(bodyW / 2 + bodyH * 0.6, bodyH); s.lineTo(bodyW / 2, bodyH + head); s.lineTo(bodyW / 2 - bodyH * 0.6, bodyH); s.lineTo(0, bodyH); }
      if (dir === 'u') { s.moveTo(0, S.height); s.lineTo(bodyW, S.height); s.lineTo(bodyW, head); s.lineTo(bodyW / 2 + bodyH * 0.6, head); s.lineTo(bodyW / 2, 0); s.lineTo(bodyW / 2 - bodyH * 0.6, head); s.lineTo(0, head); }
      s.closePath();
      s.fill();
      // Надпись — отдельным слоем, по центру тела стрелки.
      label.c.width = bodyW;
      label.c.height = bodyH;
      g.font = `${weight} ${size}px ${font}, sans-serif`;
      g.fillStyle = fg;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, bodyW / 2, bodyH / 2 + size * 0.05);
      const k = hgt / bodyH; // метров на пиксель
      shape.m.scale.set(S.width * k, S.height * k, 1);
      label.m.scale.set(bodyW * k, bodyH * k, 1);
      // Центр тела стрелки (без наконечника) — там же надпись.
      const off = (head * k) / 2;
      shape.m.position.set(x + (dir === 'r' ? off : dir === 'l' ? -off : 0), 0.02, z + (dir === 'd' ? off : dir === 'u' ? -off : 0));
      label.m.position.set(x, 0.025, z);
      for (const o of [shape, label]) { o.t.dispose(); o.t.needsUpdate = true; }
    };
    draw();
    document.fonts?.load(`${weight} ${size}px ${font}`).then(draw, () => {});
    // Надпись «вверх ногами» не бывает: при развороте камеры больше чем на 90° — поворачиваем её.
    this.animated.push(() => { label.m.rotation.z = Math.abs(this.viewYaw || 0) > Math.PI / 2 ? Math.PI : 0; });
    return shape.m;
  }

  // ---------- оптимизация ----------
  // Объединить статичные меши root по материалам: сотни объектов → десятки вызовов отрисовки.
  bake() {
    this.root.updateMatrixWorld(true);
    const groups = new Map();
    const remove = [];
    this.root.traverse((o) => {
      if (!o.isMesh || o.material.map) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      const clean = new THREE.BufferGeometry();
      clean.setAttribute('position', g.getAttribute('position'));
      clean.setAttribute('normal', g.getAttribute('normal'));
      clean.applyMatrix4(o.matrixWorld);
      const key = o.material.uuid + (o.castShadow ? 's' : 'n');
      if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, list: [] });
      groups.get(key).list.push(clean);
      remove.push(o);
    });
    for (const o of remove) o.parent.remove(o);
    for (const { mat: m, cast, list } of groups.values()) {
      const merged = new THREE.Mesh(mergeGeometries(list), m);
      merged.castShadow = cast;
      merged.receiveShadow = true;
      this.root.add(merged);
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- мебель ----------
// Все функции строят предмет в группе g, «лицом» к +Z (к камере), основание на y = 0.
export const F = {
  desk(W, g, { color = 0xd9b98c, legs = 0x8a8fa8, w = 1.2, d = 0.6 } = {}) {
    W.box(w, 0.05, d, color, 0, 0.72, 0, { parent: g });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) W.box(0.05, 0.72, 0.05, legs, sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06), { parent: g });
  },
  chair(W, g, { color = 0x4fb8a0, legs = 0x8a8fa8 } = {}) {
    W.box(0.42, 0.04, 0.4, color, 0, 0.44, 0, { parent: g });
    W.box(0.42, 0.38, 0.04, color, 0, 0.5, -0.19, { parent: g });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) W.box(0.035, 0.44, 0.035, legs, sx * 0.18, 0, sz * 0.17, { parent: g });
  },
  // Парта со стулом (стул со стороны +Z).
  schoolDesk(W, g, o = {}) {
    F.desk(W, g, o);
    const c = new THREE.Group();
    c.position.z = 0.55;
    c.rotation.y = Math.PI;
    g.add(c);
    F.chair(W, c, o);
  },
  pc(W, g, { y = 0.77, screen = 0x2b3a67, body = 0x30344a } = {}) {
    W.box(0.5, 0.32, 0.04, body, 0, y + 0.12, 0, { parent: g });
    W.box(0.44, 0.26, 0.01, screen, 0, y + 0.15, 0.022, { parent: g, shadow: false });
    W.box(0.06, 0.12, 0.06, body, 0, y, 0, { parent: g });
    W.box(0.4, 0.02, 0.14, 0xdadde8, 0, y, 0.22, { parent: g });
  },
  board(W, g, { w = 2.6, color = 0x2f5d50, frame = 0xb08a5a } = {}) {
    W.box(w + 0.1, 1.2, 0.05, frame, 0, 0.9, 0, { parent: g });
    W.box(w, 1.1, 0.03, color, 0, 0.95, 0.02, { parent: g });
    W.box(w * 0.9, 0.04, 0.12, frame, 0, 0.88, 0.07, { parent: g });
  },
  shelf(W, g, { w = 1.6, h = 2.0, d = 0.4, color = 0xb88a5a, books = true } = {}) {
    W.box(w, h, 0.04, color, 0, 0, -d / 2 + 0.02, { parent: g });
    for (const sx of [-1, 1]) W.box(0.05, h, d, color, sx * (w / 2 - 0.025), 0, 0, { parent: g });
    const rows = Math.floor(h / 0.45);
    const BOOK = [0xe05a4f, 0x4f8be0, 0xf2b84b, 0x58b97a, 0x9a6bd8, 0xef7fb0, 0x38b6c9];
    for (let r = 0; r <= rows; r++) {
      const y = r * (h / rows) - (r === rows ? 0.04 : 0);
      W.box(w - 0.08, 0.04, d, color, 0, y, 0, { parent: g });
      if (books && r < rows) {
        let x = -w / 2 + 0.08;
        let i = r * 3;
        while (x < w / 2 - 0.12) {
          const bw = 0.05 + ((i * 37) % 5) * 0.012;
          const bh = 0.24 + ((i * 53) % 7) * 0.018;
          W.box(bw, bh, d * 0.7, BOOK[i % BOOK.length], x + bw / 2, y + 0.04, 0, { parent: g });
          x += bw + 0.008;
          i++;
        }
      }
    }
  },
  plant(W, g, { pot = 0xd9774b, leaf = 0x4caf6a, big = false } = {}) {
    const s = big ? 1.6 : 1;
    W.cyl(0.16 * s, 0.3 * s, pot, 0, 0, 0, { parent: g });
    W.ball(0.28 * s, leaf, 0, 0.55 * s, 0, { parent: g });
    W.ball(0.2 * s, leaf, 0.15 * s, 0.75 * s, 0.05, { parent: g });
    W.ball(0.18 * s, leaf, -0.13 * s, 0.8 * s, -0.05, { parent: g });
  },
  table(W, g, { w = 1.6, d = 0.8, color = 0xe8d2a8, legs = 0x8a8fa8, h = 0.74 } = {}) {
    W.box(w, 0.05, d, color, 0, h, 0, { parent: g });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) W.box(0.06, h, 0.06, legs, sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08), { parent: g });
  },
  bench(W, g, { w = 1.8, color = 0x7e9ad8 } = {}) {
    W.box(w, 0.08, 0.42, color, 0, 0.42, 0, { parent: g });
    W.box(w, 0.4, 0.06, color, 0, 0.5, -0.2, { parent: g });
    for (const sx of [-1, 1]) W.box(0.06, 0.42, 0.38, 0x5b6280, sx * (w / 2 - 0.1), 0, 0, { parent: g });
  },
  sofa(W, g, { w = 1.8, color = 0xf08a5d } = {}) {
    W.box(w, 0.4, 0.8, color, 0, 0, 0, { parent: g });
    W.box(w, 0.5, 0.2, color, 0, 0.4, -0.3, { parent: g });
    for (const sx of [-1, 1]) W.box(0.2, 0.3, 0.8, color, sx * (w / 2 - 0.1), 0.4, 0, { parent: g });
  },
  rug(W, g, { w = 3, d = 2, color = 0xf3c76b } = {}) {
    const m = W.box(w, 0.01, d, color, 0, 0, 0, { parent: g });
    m.castShadow = false;
  },
  window(W, g, { w = 1.6, h = 1.3, y = 0.9, frame = 0xffffff, glass = 0xbfe3ff } = {}) {
    W.box(w + 0.12, h + 0.12, 0.06, frame, 0, y, 0, { parent: g, shadow: false });
    W.box(w, h, 0.07, glass, 0, y + 0.06, 0, { parent: g, shadow: false });
    W.box(0.05, h, 0.08, frame, 0, y + 0.06, 0, { parent: g, shadow: false });
    W.box(w, 0.05, 0.08, frame, 0, y + 0.06 + h * 0.55, 0, { parent: g, shadow: false });
  },
  cabinet(W, g, { w = 1.0, h = 1.0, d = 0.5, color = 0xcfd6e6 } = {}) {
    W.box(w, h, d, color, 0, 0, 0, { parent: g });
    W.box(0.02, h * 0.8, 0.02, 0x8a8fa8, 0, h * 0.1, d / 2 + 0.01, { parent: g });
  },
  // Большой экран на стойке (картинку вешать отдельно через W.picture).
  tvStand(W, g, { w = 2.2, h = 1.3, color = 0x30344a } = {}) {
    W.box(0.12, 1.1, 0.12, color, 0, 0, -0.05, { parent: g });
    W.box(0.8, 0.06, 0.5, color, 0, 0, -0.05, { parent: g });
    W.box(w + 0.1, h + 0.1, 0.08, color, 0, 1.1, -0.06, { parent: g });
  },
  // Сцена актового зала.
  stage(W, g, { w = 8, d = 3, color = 0xb5793f, curtain = 0x8e2d4a } = {}) {
    W.box(w, 0.5, d, color, 0, 0, 0, { parent: g });
    for (const sx of [-1, 1]) W.box(1.0, 3.0, 0.2, curtain, sx * (w / 2 - 0.5), 0.5, -d / 2 + 0.2, { parent: g });
    W.box(w, 0.5, 0.2, curtain, 0, 3.0, -d / 2 + 0.2, { parent: g });
  },
  // Ряд кресел в зале.
  seats(W, g, { n = 6, color = 0x5a6fd6 } = {}) {
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 0.62;
      W.box(0.54, 0.1, 0.5, color, x, 0.4, 0, { parent: g });
      W.box(0.54, 0.55, 0.08, color, x, 0.45, -0.22, { parent: g });
      W.box(0.06, 0.4, 0.4, 0x5b6280, x - 0.27, 0, 0, { parent: g });
    }
    W.box(0.06, 0.4, 0.4, 0x5b6280, ((n - 1) / 2) * 0.62 + 0.27, 0, 0, { parent: g });
  },
  // Стенд/мольберт для картинки (картинку вешать отдельно).
  easel(W, g, { color = 0xb88a5a } = {}) {
    for (const sx of [-1, 1]) {
      const l = W.box(0.05, 1.7, 0.05, color, sx * 0.4, 0, 0, { parent: g });
      l.rotation.z = sx * -0.08;
    }
    W.box(0.05, 1.6, 0.05, color, 0, 0, -0.35, { parent: g }).rotation.x = 0.22;
    W.box(1.0, 0.05, 0.12, color, 0, 0.75, 0.04, { parent: g });
  },
  standBoard(W, g, { w = 1.6, h = 1.2, color = 0x6b7bd6 } = {}) {
    for (const sx of [-1, 1]) W.box(0.06, h + 0.9, 0.06, 0x8a8fa8, sx * (w / 2 + 0.05), 0, 0, { parent: g });
    W.box(w + 0.16, h + 0.16, 0.05, color, 0, 0.82, 0, { parent: g });
  },
  turnstile(W, g, { color = 0xcfd6e6 } = {}) {
    W.box(0.25, 1.0, 0.9, color, 0, 0, 0, { parent: g });
    W.box(0.18, 0.16, 0.12, 0x30344a, 0, 1.0, 0.3, { parent: g });
    W.ball(0.04, 0x3ad0ff, 0, 1.08, 0.37, { parent: g, shadow: false });
    W.box(0.6, 0.04, 0.04, 0x8a8fa8, 0.35, 0.85, 0, { parent: g });
  },
  microwave(W, g) {
    W.box(0.5, 0.3, 0.36, 0xeceff5, 0, 0, 0, { parent: g });
    W.box(0.3, 0.2, 0.01, 0x30344a, -0.05, 0.05, 0.185, { parent: g, shadow: false });
    W.box(0.08, 0.2, 0.01, 0x8a8fa8, 0.17, 0.05, 0.185, { parent: g, shadow: false });
  },
  speaker(W, g, { color = 0x6b5bd6 } = {}) {
    W.cyl(0.1, 0.24, color, 0, 0, 0, { parent: g });
    const ring = W.cyl(0.101, 0.02, 0x3ad0ff, 0, 0.24, 0, { parent: g, shadow: false });
    ring.material = new THREE.MeshBasicMaterial({ color: 0x3ad0ff });
  },
  bell(W, g, { color = 0xd94b4b } = {}) {
    W.box(0.2, 0.2, 0.08, 0xc9c9d6, 0, 0, 0, { parent: g });
    W.cyl(0.11, 0.08, color, 0, 0.06, 0.08, { parent: g }).rotation.x = Math.PI / 2;
  },
  toyRobot(W, g, { color = 0x4f8be0 } = {}) {
    W.box(0.3, 0.26, 0.26, color, 0, 0.06, 0, { parent: g });
    W.box(0.24, 0.18, 0.2, 0xeceff5, 0, 0.32, 0, { parent: g });
    for (const sx of [-1, 1]) {
      W.ball(0.035, 0x1d1d2b, sx * 0.06, 0.42, 0.1, { parent: g, shadow: false });
      W.cyl(0.05, 0.05, 0x30344a, sx * 0.16, 0, 0.06, { parent: g }).rotation.z = Math.PI / 2;
    }
    W.ball(0.04, 0xf5a524, 0, 0.53, 0, { parent: g });
  },
  armRobot(W, g, { color = 0xf08a3d } = {}) {
    W.cyl(0.28, 0.12, 0x4f8be0, 0, 0, 0, { parent: g });
    W.box(0.14, 0.6, 0.14, color, 0, 0.12, 0, { parent: g });
    const a = W.box(0.12, 0.55, 0.12, color, 0.18, 0.62, 0, { parent: g });
    a.rotation.z = -0.9;
    W.ball(0.08, 0x30344a, 0.42, 0.88, 0, { parent: g });
  },
  vacuum(W, g) {
    W.cyl(0.2, 0.08, 0xeceff5, 0, 0, 0, { parent: g });
    W.cyl(0.21, 0.02, 0x4f8be0, 0, 0.04, 0, { parent: g });
    W.ball(0.03, 0xe0603a, 0, 0.09, 0, { parent: g, shadow: false });
  },
  car(W, g, { color = 0xeceff5 } = {}) {
    W.box(0.7, 0.22, 0.4, color, 0, 0.08, 0, { parent: g });
    W.box(0.42, 0.18, 0.36, 0x9fd3ff, -0.02, 0.3, 0, { parent: g });
    W.cyl(0.06, 0.06, 0x30344a, -0.02, 0.48, 0, { parent: g });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) W.cyl(0.08, 0.06, 0x30344a, sx * 0.22, 0.04, sz * 0.2, { parent: g }).rotation.x = Math.PI / 2;
  },
  // Гирлянда флажков вдоль X (вешать на стену).
  bunting(W, x1, x2, y, z) {
    const COL = [0xe05a4f, 0x4f8be0, 0xf2b84b, 0x58b97a, 0x9a6bd8];
    const n = Math.max(2, Math.floor((x2 - x1) / 0.45));
    for (let i = 0; i < n; i++) {
      const x = x1 + (i + 0.5) * ((x2 - x1) / n);
      const c = W.cone(0.14, 0.3, COL[i % COL.length], x, y - 0.3, z, { shadow: false });
      c.rotation.x = Math.PI;
      c.position.y = y - 0.15;
      c.scale.z = 0.05;
    }
  },
  // Гирлянда, которая прячется вместе со стеной (для стен вдоль X, которые опускаются).
  buntingOnWall(W, x1, x2, y, z) {
    const g = new THREE.Group();
    const COL = [0xe05a4f, 0x4f8be0, 0xf2b84b, 0x58b97a, 0x9a6bd8];
    const n = Math.max(2, Math.floor((x2 - x1) / 0.45));
    for (let i = 0; i < n; i++) {
      const c = W.cone(0.14, 0.3, COL[i % COL.length], x1 + (i + 0.5) * ((x2 - x1) / n), y - 0.15, z, { parent: g, shadow: false });
      c.rotation.x = Math.PI;
      c.position.y = y - 0.15;
      c.scale.z = 0.05;
    }
    W.dynamic.add(g);
    // Длинную гирлянду режем на куски по 8 м, чтобы прятались только ближние к игроку.
    for (const ch of [...g.children]) {
      const piece = new THREE.Group();
      W.dynamic.add(piece);
      piece.add(ch);
      W.wallItems.push({ obj: piece, z, x: ch.position.x });
    }
    g.removeFromParent();
  },
  balloons(W, g) {
    const COL = [0xe05a4f, 0x4f8be0, 0xf2b84b];
    COL.forEach((c, i) => {
      const x = (i - 1) * 0.22;
      W.ball(0.18, c, x, 1.7 + (i % 2) * 0.2, 0, { parent: g });
      W.box(0.01, 1.5 + (i % 2) * 0.2, 0.01, 0xffffff, x, 0, 0, { parent: g, shadow: false });
    });
  },
  // Шустрик — робот-уборщик без ИИ: цилиндр на колёсиках, мигалка, щётки, глаза.
  shustrik(W, g) {
    W.cyl(0.32, 0.42, 0xf2f4fa, 0, 0.08, 0, { parent: g });
    W.cyl(0.33, 0.08, 0x2f7fe0, 0, 0.3, 0, { parent: g });
    W.cyl(0.08, 0.1, 0xff8a1f, 0, 0.5, 0, { parent: g });
    g.userData.brushes = [];
    for (const sx of [-1, 1]) {
      W.ball(0.07, 0xffffff, sx * 0.11, 0.38, 0.29, { parent: g, shadow: false });
      W.ball(0.035, 0x1d1d2b, sx * 0.11, 0.38, 0.35, { parent: g, shadow: false });
      // Щётка: диск с ворсинками (крутится, пока Шустрик едет).
      const b = new THREE.Group();
      b.position.set(sx * 0.18, 0, 0.18);
      g.add(b);
      W.cyl(0.13, 0.03, 0xf2b84b, 0, 0, 0, { parent: b });
      for (let i = 0; i < 4; i++) W.box(0.25, 0.012, 0.02, 0x8a5a1f, 0, 0.032, 0, { parent: b, shadow: false }).rotation.y = (i / 4) * Math.PI;
      g.userData.brushes.push({ b, dir: sx });
    }
  },
  // Робот-доставщик на колёсах: короб, экран-«лицо» с камерами, флажок, груз сверху.
  // cargo: 'mail' — конверты и карандаши, 'books' — стопка книг.
  courier(W, g, { color = 0x1db57a, cargo = 'mail' } = {}) {
    W.box(0.56, 0.5, 0.76, color, 0, 0.12, 0, { parent: g });
    W.box(0.58, 0.06, 0.78, 0xf2f4fa, 0, 0.62, 0, { parent: g });
    W.box(0.4, 0.2, 0.02, 0x1d2240, 0, 0.32, 0.385, { parent: g, shadow: false });
    for (const sx of [-1, 1]) {
      W.box(0.07, 0.05, 0.01, 0x7fe3ff, sx * 0.09, 0.4, 0.397, { parent: g, shadow: false });
      for (const sz of [-1, 1]) {
        const wh = new THREE.Group(); // колесо крутится вокруг оси X
        wh.position.set(sx * 0.3, 0.11, sz * 0.26);
        g.add(wh);
        W.cyl(0.11, 0.06, 0x30344a, 0, -0.03, 0, { parent: wh }).rotation.z = Math.PI / 2;
        W.box(0.065, 0.14, 0.03, 0xdfe5f5, 0, -0.07, 0, { parent: wh, shadow: false }); // спица — видно, что крутится
        (g.userData.wheels ||= []).push(wh);
      }
    }
    W.box(0.015, 0.7, 0.015, 0xdfe5f5, -0.22, 0.68, -0.32, { parent: g, shadow: false });
    W.box(0.16, 0.1, 0.01, 0xff8a1f, -0.14, 1.26, -0.32, { parent: g, shadow: false });
    if (cargo === 'books') {
      const COL = [0xe05a4f, 0x4f8be0, 0xf2b84b, 0x58b97a];
      COL.forEach((c, i) => W.box(0.36 - i * 0.02, 0.07, 0.48 - i * 0.03, c, 0.04, 0.68 + i * 0.07, 0.04, { parent: g }).rotation.y = (i % 2 ? 0.08 : -0.06));
    } else {
      for (let i = 0; i < 3; i++) W.box(0.34, 0.02, 0.24, i % 2 ? 0xfff4e2 : 0xffffff, 0.04, 0.68 + i * 0.02, 0.1, { parent: g }).rotation.y = i * 0.12;
      W.box(0.2, 0.12, 0.18, 0x7c6bff, 0.08, 0.68, -0.2, { parent: g });
      for (const [x, c] of [[0.04, 0xe05a4f], [0.08, 0xf2b84b], [0.12, 0x2f7fe0]]) W.cyl(0.012, 0.16, c, x, 0.8, -0.2, { parent: g, shadow: false });
    }
  },
  // Верстак (станок) для мастерской: толстая столешница, металлическое основание, тиски, полка снизу.
  workbench(W, g, { w = 3.2, d = 1.0, color = 0xb98d5c } = {}) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) W.box(0.08, 0.72, 0.08, 0x5b6280, sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1), { parent: g });
    W.box(w - 0.1, 0.04, d - 0.1, 0x8a8fa8, 0, 0.18, 0, { parent: g });
    W.box(w, 0.08, d, color, 0, 0.72, 0, { parent: g });
    W.box(w, 0.02, 0.06, 0x8a6a42, 0, 0.78, d / 2 - 0.03, { parent: g, shadow: false });
    // Тиски на правом краю.
    W.box(0.2, 0.12, 0.16, 0x3d5bd9, w / 2 - 0.16, 0.8, -d / 2 + 0.14, { parent: g });
    W.box(0.03, 0.03, 0.22, 0xdfe5f5, w / 2 - 0.16, 0.86, -d / 2 + 0.26, { parent: g, shadow: false });
  },
  // Мини-экспонаты для верстака (масштаб ~ игрушечный).
  phone(W, g) {
    W.box(0.09, 0.012, 0.17, 0x30344a, 0, 0, 0, { parent: g });
    W.box(0.08, 0.004, 0.15, 0x8fd3ff, 0, 0.012, 0, { parent: g, shadow: false });
  },
  calculator(W, g) {
    W.box(0.13, 0.025, 0.19, 0x5b6280, 0, 0, 0, { parent: g });
    W.box(0.1, 0.004, 0.04, 0xbfe8c0, 0, 0.025, -0.06, { parent: g, shadow: false });
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) W.box(0.024, 0.006, 0.024, 0xeceff5, -0.035 + i * 0.035, 0.025, -0.0 + j * 0.035, { parent: g, shadow: false });
  },
  alarmClock(W, g) {
    const body = W.cyl(0.08, 0.05, 0xe5484d, 0, 0.04, 0, { parent: g });
    body.rotation.x = Math.PI / 2;
    W.cyl(0.065, 0.005, 0xffffff, 0, 0.065, 0.028, { parent: g, shadow: false }).rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) W.ball(0.03, 0xf2b84b, sx * 0.055, 0.17, 0, { parent: g });
  },
  // ---------- Школьная обстановка и «живые» предметы ----------
  // Предмет с анимацией кладёт в g.userData.tick функцию (dt) — мир добавит её в W.animated
  // (и вынесет группу из объединяемой геометрии, см. live() в world.js).

  // Баки для раздельного сбора отходов: бумага, пластик, стекло, прочее (вдоль X, лицом к +Z).
  trashBins(W, g) {
    const BINS = [[0x2f7fe0, 0xffffff], [0xf2b84b, 0xffffff], [0x1db57a, 0xffffff], [0x8a8fa8, 0xffffff]];
    BINS.forEach(([c, ic], i) => {
      const x = (i - 1.5) * 0.52;
      W.box(0.44, 0.72, 0.44, c, x, 0, 0, { parent: g });
      W.box(0.48, 0.06, 0.48, 0x30344a, x, 0.72, 0, { parent: g });
      W.box(0.18, 0.04, 0.02, 0x30344a, x, 0.6, 0.23, { parent: g, shadow: false }); // щель
      // Значок вида отходов.
      if (i === 0) W.box(0.14, 0.18, 0.01, ic, x, 0.28, 0.225, { parent: g, shadow: false }); // лист бумаги
      if (i === 1) { W.cyl(0.04, 0.16, ic, x, 0.24, 0.23, { parent: g, shadow: false }); W.cyl(0.02, 0.05, ic, x, 0.4, 0.23, { parent: g, shadow: false }); } // бутылка
      if (i === 2) W.cyl(0.06, 0.15, ic, x, 0.26, 0.23, { parent: g, shadow: false }); // банка
      if (i === 3) W.ball(0.07, ic, x, 0.35, 0.23, { parent: g, shadow: false }); // комок
    });
  },
  // Настенные часы с идущими стрелками (реальное время). Лицом к +Z.
  clock(W, g, { r = 0.26 } = {}) {
    const rim = W.cyl(r + 0.03, 0.05, 0x30344a, 0, -0.025, 0, { parent: g, shadow: false });
    rim.rotation.x = Math.PI / 2;
    const face = W.cyl(r, 0.06, 0xffffff, 0, -0.03, 0.005, { parent: g, shadow: false });
    face.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const m = W.box(0.018, i % 3 ? 0.035 : 0.06, 0.01, 0x30344a, Math.sin(a) * r * 0.82, Math.cos(a) * r * 0.82 - 0.02, 0.04, { parent: g, shadow: false });
      m.rotation.z = -a;
    }
    const hand = (len, wid, col) => {
      const p = new THREE.Group();
      p.position.z = 0.05;
      g.add(p);
      W.box(wid, len, 0.01, col, 0, 0, 0, { parent: p, shadow: false });
      return p;
    };
    const hh = hand(r * 0.5, 0.03, 0x30344a), mh = hand(r * 0.75, 0.02, 0x30344a), sh = hand(r * 0.8, 0.008, 0xe5484d);
    g.userData.tick = () => {
      const d = new Date();
      const s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, hr = (d.getHours() % 12) + m / 60;
      sh.rotation.z = -(s / 60) * Math.PI * 2;
      mh.rotation.z = -(m / 60) * Math.PI * 2;
      hh.rotation.z = -(hr / 12) * Math.PI * 2;
    };
  },
  // Глобус на подставке (крутится). y — высота поверхности, на которой стоит.
  globe(W, g, { y = 0.77 } = {}) {
    W.cyl(0.09, 0.03, 0x8a6a42, 0, y, 0, { parent: g });
    W.box(0.02, 0.2, 0.02, 0xc9a77c, 0, y + 0.03, 0, { parent: g });
    const s = new THREE.Group();
    s.position.y = y + 0.32;
    s.rotation.z = 0.4;
    g.add(s);
    W.ball(0.16, 0x4f8be0, 0, 0, 0, { parent: s });
    for (const [a, b, r] of [[0.1, 0.05, 0.07], [-0.08, 0.08, 0.06], [0.02, -0.1, 0.08], [-0.1, -0.04, 0.05]]) W.ball(r, 0x58b97a, a, b, Math.sqrt(Math.max(0, 0.0256 - a * a - b * b)) * 0.9, { parent: s });
    g.userData.tick = (dt) => { s.rotation.y += dt * 0.6; };
  },
  // Аквариум на тумбе: рыбки плавают туда-сюда.
  aquarium(W, g, { w = 1.1 } = {}) {
    W.box(w, 0.7, 0.45, 0x8a6a42, 0, 0, 0, { parent: g });
    W.box(w, 0.04, 0.45, 0x30344a, 0, 1.24, 0, { parent: g });
    const water = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.5, 0.41), new THREE.MeshLambertMaterial({ color: 0x6fc6ff, transparent: true, opacity: 0.45 }));
    water.position.y = 0.97;
    g.add(water);
    W.box(w - 0.06, 0.05, 0.39, 0xf2d7a0, 0, 0.72, 0, { parent: g, shadow: false }); // песок
    for (const x of [-0.3, 0.25]) W.cone(0.04, 0.3, 0x2e9a5a, x, 0.75, -0.08, { parent: g, shadow: false }); // водоросли
    const fish = [0xff8a3d, 0xffc53d, 0xe5484d].map((c, i) => {
      const f = new THREE.Group();
      g.add(f);
      W.ball(0.045, c, 0, 0, 0, { parent: f, shadow: false }).scale.set(0.06, 0.04, 0.03);
      const tail = W.cone(0.03, 0.05, c, -0.06, -0.025, 0, { parent: f, shadow: false });
      tail.rotation.z = Math.PI / 2;
      return { f, ph: i * 2.1, y: 0.86 + i * 0.1, z: -0.1 + i * 0.1 };
    });
    g.userData.tick = (dt) => {
      for (const o of fish) {
        o.ph += dt * 0.7;
        const x = Math.sin(o.ph) * (w / 2 - 0.15);
        o.f.position.set(x, o.y + Math.sin(o.ph * 3) * 0.02, o.z);
        o.f.rotation.y = Math.cos(o.ph) > 0 ? 0 : Math.PI; // плывёт носом вперёд
      }
    };
  },
  // Серверная стойка: лампочки мигают.
  serverRack(W, g) {
    W.box(0.62, 2.0, 0.8, 0x2a2e42, 0, 0, 0, { parent: g });
    const leds = [];
    for (let r = 0; r < 8; r++) {
      W.box(0.54, 0.16, 0.02, 0x3b4058, 0, 0.2 + r * 0.22, 0.41, { parent: g, shadow: false });
      for (let k = 0; k < 3; k++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), new THREE.MeshBasicMaterial({ color: [0x3ad0ff, 0x58e07a, 0xffc53d][k] }));
        m.position.set(0.15 + k * 0.05, 0.28 + r * 0.22, 0.425);
        g.add(m);
        leds.push({ m, ph: Math.random() * 10, sp: 2 + Math.random() * 6 });
      }
    }
    g.userData.tick = (dt) => { for (const l of leds) { l.ph += dt * l.sp; l.m.visible = Math.sin(l.ph) > -0.2; } };
  },
  // 3D-принтер (на стол, y — высота стола): печатающая головка ездит.
  printer3d(W, g, { y = 0.77 } = {}) {
    W.box(0.5, 0.04, 0.5, 0x30344a, 0, y, 0, { parent: g });
    for (const sx of [-1, 1]) W.box(0.04, 0.55, 0.04, 0x5b6280, sx * 0.23, y + 0.04, -0.2, { parent: g });
    W.box(0.5, 0.04, 0.04, 0x5b6280, 0, y + 0.55, -0.2, { parent: g });
    W.box(0.3, 0.02, 0.3, 0x8a8fa8, 0, y + 0.05, 0.02, { parent: g });
    W.box(0.1, 0.08, 0.1, 0xff8a3d, -0.02, y + 0.07, 0.02, { parent: g }); // печатаемая деталь
    const head = W.box(0.1, 0.08, 0.1, 0xe5484d, 0, y + 0.4, 0, { parent: g });
    const rail = W.box(0.46, 0.03, 0.03, 0xdfe5f5, 0, y + 0.45, -0.02, { parent: g, shadow: false });
    let t = 0;
    g.userData.tick = (dt) => {
      t += dt;
      head.position.x = Math.sin(t * 2.2) * 0.12;
      head.position.z = Math.cos(t * 1.3) * 0.08;
      rail.position.z = head.position.z - 0.02;
    };
  },
  // Баскетбольный щит с кольцом (вешается на стену, лицом к +Z).
  basketHoop(W, g) {
    W.box(1.0, 0.65, 0.05, 0xffffff, 0, 1.95, 0, { parent: g });
    W.box(0.4, 0.3, 0.06, 0xe5484d, 0, 2.0, 0.005, { parent: g, shadow: false });
    W.box(0.36, 0.26, 0.07, 0xffffff, 0, 2.02, 0.005, { parent: g, shadow: false });
    W.box(0.04, 0.04, 0.22, 0xff8a1f, 0, 1.98, 0.13, { parent: g, shadow: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.015, 6, 20), mat(0xff8a1f));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 2.0, 0.42);
    g.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      W.box(0.01, 0.3, 0.01, 0xffffff, Math.sin(a) * 0.15, 1.7, 0.42 + Math.cos(a) * 0.15, { parent: g, shadow: false });
    }
  },
  mats(W, g, { color = 0x2f7fe0, n = 4 } = {}) {
    for (let i = 0; i < n; i++) W.box(1.0, 0.1, 1.6, i % 2 ? color : 0x5b8be8, (i % 2) * 0.03, i * 0.1, 0, { parent: g });
  },
  sportCone(W, g, { color = 0xff8a1f } = {}) {
    W.box(0.24, 0.02, 0.24, color, 0, 0, 0, { parent: g });
    W.cone(0.09, 0.28, color, 0, 0.02, 0, { parent: g });
  },
  // Кулер с водой: в бутыли поднимаются пузырьки.
  waterCooler(W, g) {
    W.box(0.34, 0.95, 0.34, 0xeceff5, 0, 0, 0, { parent: g });
    W.box(0.06, 0.06, 0.04, 0x2f7fe0, -0.06, 0.75, 0.18, { parent: g, shadow: false });
    W.box(0.06, 0.06, 0.04, 0xe5484d, 0.06, 0.75, 0.18, { parent: g, shadow: false });
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.42, 14), new THREE.MeshLambertMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.55 }));
    bottle.position.y = 1.16;
    g.add(bottle);
    const bubble = W.ball(0.025, 0xffffff, 0, 1.0, 0, { parent: g, shadow: false });
    let t = Math.random() * 3;
    g.userData.tick = (dt) => { t += dt; const k = (t % 3) / 3; bubble.position.y = 0.97 + k * 0.38; bubble.visible = k < 0.95; };
  },
  // Раздача в столовой: стойка, стекло, подносы, кастрюли.
  servingCounter(W, g, { w = 4 } = {}) {
    W.box(w, 0.9, 0.6, 0xdfe5f5, 0, 0, 0, { parent: g });
    W.box(w, 0.04, 0.66, 0x8a8fa8, 0, 0.9, 0, { parent: g });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.35, 0.02), new THREE.MeshLambertMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.45 }));
    glass.position.set(0, 1.25, 0.1);
    g.add(glass);
    for (let i = 0; i < 4; i++) W.cyl(0.14, 0.18, 0xc9ced9, -w / 2 + 0.5 + i * ((w - 1) / 3), 0.94, -0.12, { parent: g });
    for (let i = 0; i < 5; i++) W.box(0.36, 0.02, 0.26, [0xe05a4f, 0x4f8be0, 0xf2b84b, 0x58b97a, 0x9a6bd8][i], w / 2 - 0.3, 0.94 + i * 0.025, 0.15, { parent: g, shadow: false });
  },
  // Медицинские весы с ростомером.
  medScale(W, g) {
    W.box(0.45, 0.06, 0.45, 0xeceff5, 0, 0, 0, { parent: g });
    W.box(0.05, 1.8, 0.05, 0xdfe5f5, 0, 0.06, -0.2, { parent: g });
    W.box(0.22, 0.03, 0.12, 0xdfe5f5, 0, 1.6, -0.12, { parent: g });
    W.box(0.16, 0.1, 0.04, 0x30344a, 0, 0.06, 0.2, { parent: g });
  },
  sink(W, g) {
    W.box(0.6, 0.8, 0.45, 0xeceff5, 0, 0, 0, { parent: g });
    W.box(0.44, 0.04, 0.32, 0xbfc6d6, 0, 0.8, 0.02, { parent: g, shadow: false });
    W.box(0.03, 0.18, 0.03, 0xdfe5f5, 0, 0.8, -0.16, { parent: g });
    W.box(0.03, 0.03, 0.12, 0xdfe5f5, 0, 0.96, -0.11, { parent: g });
    W.box(0.45, 0.6, 0.02, 0xcfe6ff, 0, 1.1, -0.21, { parent: g, shadow: false }); // зеркало
  },
  speakerBox(W, g) {
    W.box(0.4, 1.0, 0.36, 0x30344a, 0, 0, 0, { parent: g });
    for (const [y, r] of [[0.32, 0.13], [0.72, 0.08]]) {
      const c = W.cyl(r, 0.02, 0x8a8fa8, 0, y, 0.18, { parent: g, shadow: false });
      c.rotation.x = Math.PI / 2;
    }
  },
  micStand(W, g) {
    W.cyl(0.14, 0.03, 0x30344a, 0, 0, 0, { parent: g });
    W.box(0.025, 1.45, 0.025, 0x8a8fa8, 0, 0.03, 0, { parent: g });
    W.ball(0.05, 0x30344a, 0, 1.52, 0.05, { parent: g });
  },
  armchair(W, g, { color = 0x7c6bff } = {}) {
    W.box(0.8, 0.42, 0.75, color, 0, 0, 0, { parent: g });
    W.box(0.8, 0.55, 0.16, color, 0, 0.42, -0.3, { parent: g });
    for (const sx of [-1, 1]) W.box(0.14, 0.25, 0.75, color, sx * 0.33, 0.42, 0, { parent: g });
  },
  bookCart(W, g) {
    W.box(0.9, 0.05, 0.45, 0x8a6a42, 0, 0.15, 0, { parent: g });
    W.box(0.9, 0.05, 0.45, 0x8a6a42, 0, 0.55, 0, { parent: g });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      W.box(0.04, 0.6, 0.04, 0x5b6280, sx * 0.42, 0.05, sz * 0.2, { parent: g });
      W.ball(0.05, 0x30344a, sx * 0.4, 0.05, sz * 0.2, { parent: g });
    }
    const COL = [0xe05a4f, 0x4f8be0, 0xf2b84b, 0x58b97a, 0x9a6bd8];
    for (let i = 0; i < 7; i++) W.box(0.06, 0.24, 0.3, COL[i % 5], -0.35 + i * 0.11, 0.6, 0, { parent: g });
  },
  // Перфорированная панель с инструментами (на стену, лицом к +Z).
  toolBoard(W, g, { w = 1.6 } = {}) {
    W.box(w, 0.9, 0.03, 0xc9a77c, 0, 1.1, 0, { parent: g });
    const TOOLS = [[0.5, 0.06, 0xe5484d], [0.35, 0.04, 0x30344a], [0.45, 0.05, 0x2f7fe0], [0.3, 0.08, 0xf2b84b], [0.4, 0.04, 0x8a8fa8]];
    TOOLS.forEach(([h, wd, c], i) => W.box(wd, h, 0.03, c, -w / 2 + 0.25 + i * ((w - 0.5) / 4), 1.25, 0.03, { parent: g, shadow: false }));
  },
  // Полка с настольными играми и наградами (лицом к +Z): только плоские и угловатые предметы.
  // Снизу — медали на ленточках и грамоты, посередине — ракетки для настольного тенниса и мячик,
  // сверху — коробки настольных игр, кубик-головоломка и шашечная доска.
  gameShelf(W, g, { w = 1.4 } = {}) {
    const h = 1.6, d = 0.4;
    F.shelf(W, g, { w, h, d, books: false, color: 0x8a6a42 });
    const row = (r) => r * (h / 3) + 0.04;
    const front = d / 2 - 0.06;
    // Медали: лента-«галочка» и плоский диск.
    [-0.45, -0.2].forEach((x, i) => {
      const y = row(0);
      for (const sx of [-1, 1]) W.box(0.035, 0.16, 0.01, i ? 0x2f7fe0 : 0xe5484d, x + sx * 0.025, y + 0.12, front, { parent: g, shadow: false }).rotation.z = sx * 0.25;
      const m = W.cyl(0.055, 0.015, i ? 0xc0c4d0 : 0xf2c14b, x, y + 0.06, front + 0.01, { parent: g, shadow: false });
      m.rotation.x = Math.PI / 2;
    });
    // Грамоты в рамках.
    [0.12, 0.42].forEach((x) => {
      const y = row(0);
      W.box(0.26, 0.2, 0.02, 0x30344a, x, y, front - 0.04, { parent: g }).rotation.x = -0.12;
      W.box(0.22, 0.16, 0.01, 0xfff4e2, x, y + 0.02, front - 0.025, { parent: g, shadow: false }).rotation.x = -0.12;
    });
    // Ракетки для настольного тенниса (стоят, прислонены) и мячик.
    [[-0.32, 0xe5484d], [-0.05, 0x2f7fe0]].forEach(([x, c]) => {
      const y = row(1);
      W.box(0.035, 0.1, 0.02, 0xc9a77c, x, y, front - 0.02, { parent: g });
      const head = W.cyl(0.085, 0.02, c, x, y + 0.17, front - 0.02, { parent: g });
      head.rotation.x = Math.PI / 2;
    });
    W.ball(0.022, 0xffffff, 0.12, row(1) + 0.022, front, { parent: g, shadow: false });
    W.box(0.3, 0.06, 0.24, 0x58b97a, 0.38, row(1), 0, { parent: g }); // коробка с теннисным набором
    // Коробки настольных игр стопкой.
    [0x9a6bd8, 0xf2b84b, 0x4f8be0].forEach((c, k) => W.box(0.34, 0.06, 0.26, c, -0.38 + (k % 2) * 0.02, row(2) + k * 0.06, 0, { parent: g }));
    // Кубик-головоломка: разноцветные квадраты на лицевой стороне.
    const cx = 0.0, cy = row(2);
    W.box(0.12, 0.12, 0.12, 0x1d1d2b, cx, cy, 0.02, { parent: g });
    const CC = [0xe5484d, 0x2f7fe0, 0xffc53d, 0x1db57a, 0xffffff, 0xff8a1f];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) W.box(0.034, 0.034, 0.005, CC[(i * 3 + j) % 6], cx - 0.04 + i * 0.04, cy + 0.023 + j * 0.04, 0.082, { parent: g, shadow: false });
    // Шашечная доска, прислонённая к стенке полки.
    const bx = 0.38, by = row(2);
    const board = new THREE.Group();
    board.position.set(bx, by, -0.08);
    board.rotation.x = -0.18;
    g.add(board);
    W.box(0.32, 0.32, 0.02, 0x8a6a42, 0, 0, 0, { parent: board });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) W.box(0.07, 0.07, 0.005, (i + j) % 2 ? 0x30344a : 0xf5efe0, -0.105 + i * 0.07, 0.055 + j * 0.07, 0.012, { parent: board, shadow: false });
  },
  beanBag(W, g, { color = 0xff7a59 } = {}) {
    W.ball(0.42, color, 0, 0.3, 0, { parent: g }).scale.set(0.42, 0.3, 0.42);
  },
  lockers(W, g, { n = 4, color = 0x4f8be0 } = {}) {
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 0.46;
      W.box(0.44, 1.8, 0.45, i % 2 ? color : 0x6fa0f0, x, 0, 0, { parent: g });
      W.box(0.03, 0.12, 0.02, 0xdfe5f5, x + 0.14, 1.0, 0.235, { parent: g, shadow: false });
      for (let k = 0; k < 3; k++) W.box(0.26, 0.015, 0.02, 0x30344a, x, 1.5 + k * 0.05, 0.235, { parent: g, shadow: false });
    }
  },
  // Стол с голограммой: светящийся круг и медленно вращающаяся фигура над ним.
  holoTable(W, g) {
    W.cyl(0.55, 0.8, 0x30344a, 0, 0, 0, { parent: g });
    const glow = new THREE.MeshBasicMaterial({ color: 0x3ad0ff, transparent: true, opacity: 0.6 });
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.02, 32), glow);
    disk.position.y = 0.81;
    g.add(disk);
    const holo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, wireframe: true, transparent: true, opacity: 0.85 }));
    holo.position.y = 1.25;
    g.add(holo);
    let t = 0;
    g.userData.tick = (dt) => { t += dt; holo.rotation.y += dt * 0.8; holo.rotation.x += dt * 0.3; holo.position.y = 1.25 + Math.sin(t * 1.5) * 0.04; glow.opacity = 0.45 + Math.sin(t * 3) * 0.15; };
  },
  // Проектор на подставке и экран на стене задаются отдельно: projector — на стол (y — высота стола).
  projector(W, g, { y = 0.77 } = {}) {
    W.box(0.3, 0.1, 0.24, 0xeceff5, 0, y, 0, { parent: g });
    const lens = W.cyl(0.04, 0.03, 0x30344a, 0.06, y + 0.05, 0.12, { parent: g, shadow: false });
    lens.rotation.x = Math.PI / 2;
  },
  // Настенный экран для проектора (лицом к +Z): белое полотно в чёрной рамке, сверху короб.
  projScreen(W, g, { w = 2.0, h = 1.2 } = {}) {
    W.box(w + 0.1, 0.1, 0.1, 0x30344a, 0, 2.25, 0, { parent: g });
    W.box(w, h, 0.02, 0xffffff, 0, 2.25 - h, 0.02, { parent: g });
    W.box(w, 0.03, 0.03, 0x30344a, 0, 2.25 - h - 0.02, 0.03, { parent: g, shadow: false });
  },
  // Стеллаж с тетрадями и папками (лицом к +Z).
  notebookShelf(W, g, { w = 1.2, h = 1.6 } = {}) {
    F.shelf(W, g, { w, h, books: false, color: 0xd9b98c });
    const COL = [0x4f8be0, 0xe05a4f, 0x58b97a, 0xf2b84b, 0x9a6bd8];
    const rows = Math.floor(h / 0.45);
    for (let r = 0; r < rows; r++) {
      const y = r * (h / rows) + 0.04;
      for (let s = 0; s < 3; s++) {
        const x = -w / 2 + 0.22 + s * ((w - 0.44) / 2);
        const n = 4 + ((r + s) % 3) * 2;
        for (let k = 0; k < n; k++) W.box(0.26, 0.012, 0.2, COL[(r + s + k) % 5], x + (k % 2) * 0.01, y + k * 0.014, 0, { parent: g, shadow: false });
      }
    }
  },
  // Пробковая доска (классный уголок, объявления): цветные листки и кнопки. Лицом к +Z.
  corkBoard(W, g, { w = 1.4, h = 0.9, y = 1.05 } = {}) {
    W.box(w + 0.08, h + 0.08, 0.04, 0x8a6a42, 0, y, 0, { parent: g });
    W.box(w, h, 0.02, 0xd9a066, 0, y + 0.04, 0.02, { parent: g, shadow: false });
    const PAPER = [0xffffff, 0xfff1a8, 0xcfe6ff, 0xffd6e0, 0xd6f5d6];
    let i = 0;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
      const px = -w / 2 + 0.2 + c * ((w - 0.4) / 3), py = y + 0.22 + r * 0.36;
      const p = W.box(0.24, 0.26, 0.01, PAPER[i % 5], px, py, 0.035, { parent: g, shadow: false });
      p.rotation.z = ((i * 37) % 7 - 3) * 0.02;
      W.ball(0.015, [0xe5484d, 0x2f7fe0, 0x1db57a][i % 3], px, py + 0.24, 0.045, { parent: g, shadow: false });
      i++;
    }
  },
  // Скульптура на подставке (кабинет ИЗО).
  bust(W, g) {
    W.box(0.4, 1.0, 0.4, 0xeceff5, 0, 0, 0, { parent: g });
    W.box(0.3, 0.14, 0.2, 0xdfe2ea, 0, 1.0, 0, { parent: g });
    W.ball(0.14, 0xdfe2ea, 0, 1.3, 0, { parent: g });
  },
  // Горшок с цветами (на полку, шкаф, подоконник). color — цвет цветков.
  flowerPot(W, g, { color = 0xef7fb0, pot = 0xd9774b } = {}) {
    W.cyl(0.08, 0.13, pot, 0, 0, 0, { parent: g });
    W.ball(0.09, 0x4caf6a, 0, 0.19, 0, { parent: g, shadow: false });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      W.ball(0.035, color, Math.sin(a) * 0.07, 0.25 + (i % 2) * 0.03, Math.cos(a) * 0.07, { parent: g, shadow: false });
    }
    W.ball(0.03, 0xffd84a, 0, 0.29, 0, { parent: g, shadow: false });
  },
  // Ящики (мастерская, склад).
  crates(W, g) {
    W.box(0.6, 0.45, 0.5, 0xc9a77c, 0, 0, 0, { parent: g });
    W.box(0.5, 0.4, 0.45, 0xb98d5c, 0.05, 0.45, 0.02, { parent: g });
    W.box(0.45, 0.35, 0.4, 0xd9b98c, 0.62, 0, 0.05, { parent: g });
  },
  // Камера наблюдения на стене (кронштейн + корпус).
  camera(W, g) {
    W.box(0.08, 0.08, 0.3, 0x8a8fa8, 0, 0, 0.1, { parent: g });
    W.box(0.18, 0.16, 0.34, 0xeceff5, 0, -0.05, 0.3, { parent: g });
    W.cyl(0.05, 0.03, 0x1d1d2b, 0, -0.05, 0.48, { parent: g }).rotation.x = Math.PI / 2;
  },
  chessTable(W, g) {
    F.table(W, g, { w: 1.0, d: 1.0, color: 0xd9b98c });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const m = W.box(0.16, 0.012, 0.16, (i + j) % 2 ? 0x30344a : 0xf5efe0, -0.24 + i * 0.16, 0.77, -0.24 + j * 0.16, { parent: g, shadow: false });
      m.castShadow = false;
    }
  },
  wallBars(W, g, { w = 1.2 } = {}) {
    for (const sx of [-1, 1]) W.box(0.06, 2.4, 0.06, 0xb88a5a, sx * w / 2, 0, 0, { parent: g });
    for (let y = 0.25; y < 2.4; y += 0.3) W.box(w, 0.04, 0.04, 0xd9b98c, 0, y, 0, { parent: g });
  },
  coatRack(W, g, { w = 2.4 } = {}) {
    for (const sx of [-1, 1]) W.box(0.05, 1.7, 0.05, 0x8a8fa8, sx * w / 2, 0, 0, { parent: g });
    W.box(w, 0.04, 0.04, 0x8a8fa8, 0, 1.65, 0, { parent: g });
    const COL = [0x3d5bd9, 0xe5484d, 0x1db57a, 0xffc53d, 0x7c4dff, 0x30344a];
    for (let i = 0; i < 6; i++) W.box(0.3, 0.9, 0.18, COL[i], -w / 2 + 0.3 + i * (w - 0.6) / 5, 0.72, 0, { parent: g });
  },
  couch(W, g, { color = 0xeaf2ff } = {}) {
    W.box(1.9, 0.5, 0.75, color, 0, 0, 0, { parent: g });
    W.box(0.5, 0.2, 0.7, 0xffffff, -0.65, 0.5, 0, { parent: g });
  },
  juiceMachine(W, g) {
    W.box(0.9, 1.8, 0.6, 0xff7a59, 0, 0, 0, { parent: g });
    W.box(0.6, 0.8, 0.02, 0xbfe3ff, -0.05, 0.85, 0.31, { parent: g, shadow: false });
    for (let i = 0; i < 4; i++) W.box(0.1, 0.06, 0.02, [0xffc53d, 0x1db57a, 0xe5484d, 0x7c4dff][i], 0.33, 1.4 - i * 0.12, 0.31, { parent: g, shadow: false });
    W.box(0.3, 0.16, 0.08, 0x30344a, -0.05, 0.25, 0.32, { parent: g });
  },
  // Стол радиоузла: пульт, микрофон, колонка.
  radioDesk(W, g) {
    F.desk(W, g, { w: 1.8, d: 0.8, color: 0x5b6280 });
    W.box(0.8, 0.08, 0.4, 0x30344a, -0.3, 0.77, 0, { parent: g });
    for (let i = 0; i < 6; i++) W.box(0.04, 0.05, 0.12, 0xffc53d, -0.6 + i * 0.12, 0.85, 0, { parent: g, shadow: false });
    W.cyl(0.02, 0.35, 0x8a8fa8, 0.25, 0.77, 0.1, { parent: g });
    W.ball(0.05, 0x30344a, 0.25, 1.14, 0.1, { parent: g });
    W.cyl(0.12, 0.28, 0xe8ebf5, 0.65, 0.77, 0, { parent: g });
    W.cyl(0.121, 0.05, 0x7c6bff, 0.65, 1.0, 0, { parent: g });
  },
  // Табличка-«раскладушка» на полу (видна камере, которая смотрит с юга).
  signStand(W, g) {
    for (const sx of [-1, 1]) W.box(0.04, 1.25, 0.04, 0x8a8fa8, sx * 0.35, 0, 0, { parent: g });
  },
  lamp(W, g, { color = 0x7cc8a8 } = {}) {
    W.cyl(0.1, 0.03, color, 0, 0.77, 0, { parent: g });
    W.box(0.03, 0.35, 0.03, color, 0, 0.77, 0, { parent: g });
    W.cone(0.12, 0.14, color, 0, 1.08, 0.05, { parent: g });
  },
};
