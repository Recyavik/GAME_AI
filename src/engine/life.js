// Живой мир: фоновые системы школы (сценарий v3, раздел 4.7–4.13). Всё необязательное:
// не блокирует прохождение и замирает во время диалогов и окон (update вызывается только,
// когда игрок свободно ходит).
//
// Мир (games/<slug>/world.js) задаёт W.life = {
//   balls: [[x, z, цвет]], ballBounds: [x1, z1, x2, z2],    — мячи, которые можно пинать
//   balloons: [[x, z]],                                     — связки шариков (один улетает от касания)
//   shustrikRoute: [[x, z], …],                             — маршрут робота без ИИ
//   students: [{ look, path: [[x, z], …], pauses: [k, …] }], — ученики-фон
//   facts: { id: [x, z] },                                  — голограммы «Знаешь ли ты?»
//   cameras: [[x, z, y]], decoys: [{ id, x, z, y, h, label }], — камеры с компьютерным зрением
//   couriers: [{ route: [[x, z], …], cargo: 'mail'|'books', color, label, title, info, say,
//                corridor: [z1, z2] — коридор, где объезжают игрока (иначе — ждут) }] — роботы-доставщики
// }
// Сценарий задаёт sc.life = { facts: [{ id, img, title, text }], notes: [...], robotInfo, cvIntro, … }.
import * as THREE from 'three';
import { h, rich, fmt } from './util.js';
import { makePerson, animatePerson } from './characters.js';
import { modal, toast, onEsc } from './modal.js';
import { sound } from './sound.js';

const SMILE = '<svg class="smile" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#ffc53d"/><circle cx="7" cy="8" r="1.4" fill="#5a3b00"/><circle cx="13" cy="8" r="1.4" fill="#5a3b00"/><path d="M6 12q4 4 8 0" stroke="#5a3b00" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';
const richS = (t) => rich(t).replace(/\{smile\}/g, SMILE);

export function createLife({ core, W, F, player, npcs, hud, progress, sc }) {
  const L = W.life || {};
  const D = sc.life || {};
  const scene = core.scene;
  const camera = core.camera;
  const layer = h('div', { class: 'life' });
  hud.root.append(layer);
  const v = new THREE.Vector3();
  const proj = (x, y, z) => {
    v.set(x, y, z).project(camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, ok: v.z > -1 && v.z < 1 };
  };
  const P = () => player.pos;
  const near = (x, z, r) => Math.hypot(P().x - x, P().z - z) < r;
  let pvx = 0, pvz = 0, lastX = P().x, lastZ = P().z;

  // ---------------- Мячи (спортзал) ----------------
  const BR = 0.25;
  const bb = L.ballBounds || [-1e9, -1e9, 1e9, 1e9];
  const balls = (L.balls || []).map(([x, z, c]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(BR, 18, 12), new THREE.MeshLambertMaterial({ color: c }));
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(BR * 1.002, 0.025, 6, 24), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    m.add(stripe);
    m.position.set(x, BR, z);
    m.castShadow = true;
    scene.add(m);
    return { m, vx: 0, vz: 0, touch: false };
  });
  function updBalls(dt) {
    const speed = Math.hypot(pvx, pvz);
    for (const b of balls) {
      const p = b.m.position;
      const dx = p.x - P().x, dz = p.z - P().z;
      const d = Math.hypot(dx, dz);
      if (d < 0.55 && d > 1e-4) {
        const nx = dx / d, nz = dz / d;
        const push = Math.max(2.2, speed * 1.5);
        b.vx = nx * push; b.vz = nz * push;
        p.x = P().x + nx * 0.56; p.z = P().z + nz * 0.56;
        if (!b.touch) sound.play('pop');
        b.touch = true;
      } else b.touch = false;
      p.x += b.vx * dt; p.z += b.vz * dt;
      const k = Math.exp(-1.1 * dt);
      b.vx *= k; b.vz *= k;
      if (p.x < bb[0] + BR) { p.x = bb[0] + BR; b.vx = Math.abs(b.vx) * 0.7; }
      if (p.x > bb[2] - BR) { p.x = bb[2] - BR; b.vx = -Math.abs(b.vx) * 0.7; }
      if (p.z < bb[1] + BR) { p.z = bb[1] + BR; b.vz = Math.abs(b.vz) * 0.7; }
      if (p.z > bb[3] - BR) { p.z = bb[3] - BR; b.vz = -Math.abs(b.vz) * 0.7; }
      b.m.rotation.z -= (b.vx * dt) / BR;
      b.m.rotation.x += (b.vz * dt) / BR;
    }
    // Мячи отскакивают друг от друга.
    for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], c = balls[j];
      const dx = c.m.position.x - a.m.position.x, dz = c.m.position.z - a.m.position.z;
      const d = Math.hypot(dx, dz);
      if (d < BR * 2 && d > 1e-4) {
        const nx = dx / d, nz = dz / d, o = (BR * 2 - d) / 2;
        a.m.position.x -= nx * o; a.m.position.z -= nz * o;
        c.m.position.x += nx * o; c.m.position.z += nz * o;
        const rel = (a.vx - c.vx) * nx + (a.vz - c.vz) * nz;
        if (rel > 0) { a.vx -= rel * nx; a.vz -= rel * nz; c.vx += rel * nx; c.vz += rel * nz; }
      }
    }
  }

  // ---------------- Шарики (улетают от касания) ----------------
  const BCOL = [0xe05a4f, 0x4f8be0, 0xf2b84b, 0x58b97a, 0x9a6bd8];
  const bunches = (L.balloons || []).map(([x, z], bi) => {
    const items = [0, 1, 2].map((i) => {
      const g = new THREE.Group();
      const home = new THREE.Vector3(x + (i - 1) * 0.22, 0, z + (i === 1 ? 0.08 : 0));
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), new THREE.MeshLambertMaterial({ color: BCOL[(i + bi) % BCOL.length] }));
      ball.scale.y = 1.15;
      ball.position.y = 1.7 + (i % 2) * 0.2;
      const str = new THREE.Mesh(new THREE.BoxGeometry(0.01, ball.position.y, 0.01), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      str.position.y = ball.position.y / 2;
      g.add(ball, str);
      g.position.copy(home);
      scene.add(g);
      return { g, home, flying: false, gone: 0, ph: Math.random() * 6 };
    });
    return { x, z, items, cool: 0 };
  });
  function updBalloons(dt) {
    for (const bu of bunches) {
      bu.cool -= dt;
      if (bu.cool <= 0 && near(bu.x, bu.z, 0.95)) {
        const it = bu.items.find((i) => !i.flying && !i.gone);
        if (it) { it.flying = true; bu.cool = 1.2; sound.play('whoosh'); }
      }
      for (const it of bu.items) {
        it.ph += dt;
        if (it.flying) {
          it.g.position.y += dt * 1.3;
          it.g.position.x += Math.sin(it.ph * 2) * dt * 0.3;
          if (it.g.position.y > 6) { it.flying = false; it.gone = 25; it.g.visible = false; }
        } else if (it.gone > 0) {
          it.gone -= dt;
          if (it.gone <= 0) { it.g.position.copy(it.home); it.g.visible = true; }
        } else {
          it.g.position.y = it.home.y + Math.sin(it.ph * 1.5) * 0.04;
          it.g.rotation.z = Math.sin(it.ph) * 0.05;
        }
      }
    }
  }

  // Шаг машины по полу: корпус смотрит по ходу движения; если надо повернуть сильно
  // (угол маршрута, разворот), машина сначала разворачивается на месте и только потом едет.
  // Возвращает пройденный путь (для колёс и щёток) или 0, если пока только поворачивалась.
  function drive(g, mx, mz, dt, turnRate = 2.6) {
    const d = Math.hypot(mx, mz);
    if (d < 1e-5) return 0;
    let diff = Math.atan2(mx, mz) - g.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) > 1.0) { g.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), turnRate * dt); return 0; }
    g.rotation.y += diff * Math.min(1, dt * 6);
    g.position.x += mx; g.position.z += mz;
    return d;
  }

  // ---------------- Шустрик: робот без ИИ, едет по программе ----------------
  let robo = null;
  if (L.shustrikRoute?.length > 1) {
    const g = new THREE.Group();
    F.shustrik(W, g);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffa21f }));
    beacon.position.y = 0.62;
    g.add(beacon);
    const [x0, z0] = L.shustrikRoute[0];
    g.position.set(x0, 0, z0);
    scene.add(g);
    const pin = h('button', { class: 'life-pin hidden', onclick: () => roboInfo() }, 'Шустрик');
    const bubble = h('div', { class: 'robo-bubble hidden' }, 'ПРЕПЯТСТВИЕ. ЖДУ');
    layer.append(pin, bubble);
    robo = { g, beacon, pin, bubble, k: 1, blocks: 0, was: false, beepT: 0, ph: 0 };
  }
  function roboInfo() {
    modal({
      title: 'Шустрик — робот без ИИ',
      body: progress.cards.has('robot')
        ? 'ПРОГРАММА №1: УБОРКА. ИИ: НЕТ.\nШустрик едет по заданной линии, не учится и не узнаёт людей. Застрял — просто ждёт.'
        : 'Шустрик едет по заданной линии, не учится и не узнаёт людей. Если на пути препятствие — он просто ждёт.',
    });
  }
  function updRobo(dt) {
    if (!robo) return;
    const r = robo, route = L.shustrikRoute;
    const p = r.g.position;
    const [tx, tz] = route[r.k];
    let fx = tx - p.x, fz = tz - p.z;
    const dl = Math.hypot(fx, fz);
    fx /= dl || 1; fz /= dl || 1;
    // Препятствие прямо по курсу — стоп (он не умеет объезжать).
    const dx = P().x - p.x, dz = P().z - p.z, d = Math.hypot(dx, dz);
    const blocked = d < 1.3 && (dx * fx + dz * fz) / (d || 1) > 0.55;
    r.ph += dt;
    if (blocked) {
      if (!r.was) {
        r.blocks++;
        sound.play('beep', 0.5);
        if (r.blocks === 3) {
          progress.achieve('robo');
          toast(fmt(D.roboLine || 'Он не обидится — у него нет чувств. Но уборку ты ему {сорвал|сорвала}!'), 'info', 4500);
        }
      }
      r.was = true;
      r.beepT -= dt;
      if (r.beepT <= 0) { r.beepT = 1.6; sound.play('beep', 0.4); }
      r.beacon.visible = Math.sin(r.ph * 14) > 0;
    } else {
      r.was = false;
      r.beacon.visible = Math.sin(r.ph * 4) > -0.3;
      const step = Math.min(1.2 * dt, dl);
      const went = dl < 0.05 ? 0 : drive(r.g, fx * step, fz * step, dt);
      if (dl < 0.05) r.k = (r.k + 1) % route.length;
      for (const { b, dir } of r.g.userData.brushes || []) b.rotation.y += dir * (went > 0 ? 14 : 3) * dt; // щётки крутятся
    }
    r.loop ||= sound.loop('brush');
    r.loop.set(blocked ? 0 : Math.max(0, 1 - d / 6));
    const q = proj(p.x, 0.95, p.z);
    const show = q.ok && d < 9;
    r.pin.classList.toggle('hidden', !show);
    r.bubble.classList.toggle('hidden', !(show && blocked));
    if (show) {
      r.pin.style.transform = `translate(${q.x}px, ${q.y}px) translate(-50%, -100%)`;
      r.bubble.style.transform = `translate(${q.x}px, ${q.y - 34}px) translate(-50%, -100%)`;
    }
  }

  // ---------------- Ученики-фон ----------------
  const studs = (L.students || []).filter((s) => s.path?.length > 1).map((s) => {
    const m = makePerson(s.look);
    m.position.set(s.path[0][0], 0, s.path[0][1]);
    scene.add(m);
    return { m, path: s.path, pauses: s.pauses || [], k: 1, wait: Math.random() * 2, speed: s.speed || 1.1 };
  });
  function updStuds(dt) {
    for (const s of studs) {
      const p = s.m.position;
      const [tx, tz] = s.path[s.k];
      let fx = tx - p.x, fz = tz - p.z;
      const dl = Math.hypot(fx, fz);
      let moving = false;
      if (s.wait > 0) s.wait -= dt;
      else if (dl < 0.05) {
        if (s.pauses.includes(s.k)) s.wait = 2 + Math.random() * 3;
        s.k = (s.k + 1) % s.path.length;
      } else {
        fx /= dl; fz /= dl;
        const dx = P().x - p.x, dz = P().z - p.z, d = Math.hypot(dx, dz);
        if (!(d < 0.9 && (dx * fx + dz * fz) / (d || 1) > 0.5)) {
          const step = Math.min(s.speed * dt, dl);
          p.x += fx * step; p.z += fz * step;
          moving = true;
          let dy = Math.atan2(fx, fz) - s.m.rotation.y;
          dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          s.m.rotation.y += dy * Math.min(1, dt * 6);
        }
      }
      s.m.userData.walking = moving;
      const close = Math.hypot(P().x - p.x, P().z - p.z) < 2.5;
      animatePerson(s.m, dt, close ? new THREE.Vector3(P().x, 1.3, P().z) : null);
    }
  }

  // ---------------- Голограммы-факты ----------------
  const cubeTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#7fe3ff'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.strokeRect(6, 6, 116, 116);
    g.fillStyle = '#1d4ed8'; g.font = '700 84px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('i', 64, 70);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const factMat = new THREE.MeshBasicMaterial({ map: cubeTex, transparent: true, opacity: 0.85 });
  const facts = (D.facts || []).filter((f) => L.facts?.[f.id]).map((f, i) => {
    const [x, z] = L.facts[f.id];
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), factMat);
    m.position.set(x, 1.3, z);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 24), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.02, z);
    scene.add(m, ring);
    return { f, m, ring, x, z, ph: i, taking: 0 };
  });
  function updFacts(dt) {
    for (const o of facts) {
      o.ph += dt;
      if (o.taking > 0) {
        o.taking -= dt;
        const s = Math.max(0.01, o.taking / 0.4);
        o.m.scale.setScalar(s * 1.6);
        o.m.position.y += dt * 2;
        if (o.taking <= 0) { o.m.visible = false; o.ring.visible = false; }
        continue;
      }
      if (!o.m.visible) continue;
      o.m.rotation.y += dt * 1.2;
      o.m.rotation.x = Math.sin(o.ph) * 0.3;
      o.m.position.y = 1.3 + Math.sin(o.ph * 2) * 0.08;
      if (!progress.facts.has(o.f.id) && near(o.x, o.z, 1.6)) {
        progress.giveFact(o.f.id);
        o.taking = 0.4;
        showFact(o.f);
      }
    }
  }
  let factCard = null;
  function showFact(f) {
    factCard?.remove();
    sound.play('ai', 0.7);
    const close = () => { card.classList.add('out'); setTimeout(() => card.remove(), 300); };
    const card = h('div', { class: 'fact-pop' },
      f.img && h('img', { src: f.img, alt: '' }),
      h('div', { class: 'fact-body' },
        h('div', { class: 'fact-kicker' }, `Знаешь ли ты? · ${progress.facts.size} из ${facts.length}`),
        h('b', {}, f.title),
        h('p', { html: rich(f.text) }),
        h('div', { class: 'fact-foot' }, 'Факт сохранён в блокноте → «Энциклопедия»', h('button', { class: 'btn small', onclick: close }, 'Понятно')),
      ),
    );
    layer.append(card);
    onEsc(card, close);
    factCard = card;
    setTimeout(() => { if (card.isConnected) close(); }, 14000);
  }

  // ---------------- Камеры с компьютерным зрением ----------------
  const cams = (L.cameras || []).map(([x, z, y]) => ({ x, z, y, cool: 0 }));
  let frames = null; // { until, list: [{ el, get: () => [x, y0, z, h] }] }
  const foundCv = new Set();
  let cvIntroShown = false;
  function updCams(dt) {
    for (const c of cams) {
      c.cool -= dt;
      if (c.cool <= 0 && !frames && near(c.x, c.z, 6)) {
        c.cool = 12;
        showFrames(c);
      }
    }
    if (!frames) return;
    if (performance.now() > frames.until) { frames.list.forEach((f) => f.el.remove()); frames = null; return; }
    for (const f of frames.list) {
      const [x, y0, z, hh] = f.get();
      const a = proj(x, y0, z), b = proj(x, y0 + hh, z);
      const vis = a.ok && b.ok;
      f.el.classList.toggle('hidden', !vis);
      if (!vis) continue;
      const H = Math.max(24, a.y - b.y), Wd = H * (f.w || 0.55);
      Object.assign(f.el.style, { left: a.x - Wd / 2 + 'px', top: b.y + 'px', width: Wd + 'px', height: H + 'px' });
    }
  }
  function showFrames(cam) {
    sound.play('scan', 0.45);
    const list = [];
    const add = (label, get, decoy, w) => {
      const el = h('div', { class: 'cv-frame' + (decoy ? ' decoy' : '') }, h('span', {}, label));
      el.addEventListener('click', () => {
        if (decoy) {
          if (!foundCv.has(decoy)) {
            foundCv.add(decoy);
            el.classList.add('caught');
            sound.play('good');
            toast('**Верно, камера ошиблась!** Она сравнивает формы и цвета — и может перепутать.', 'info', 4500);
            if (foundCv.size >= 2) progress.achieve('eye');
          }
        } else {
          sound.play('click');
          toast('Здесь камера права. Ищи рамку, где она ошиблась.', 'info', 2500);
        }
      });
      layer.append(el);
      list.push({ el, get, w });
    };
    const R = 8;
    add('Человек · 97 %', () => [P().x, 0, P().z, 1.55]);
    for (const m of Object.values(npcs)) {
      if (!m.visible || Math.hypot(m.position.x - P().x, m.position.z - P().z) > R) continue;
      const pct = 90 + Math.floor(Math.random() * 9);
      add(`Человек · ${pct} %`, () => [m.position.x, 0, m.position.z, m.userData.height + 0.2]);
    }
    for (const s of studs) {
      if (Math.hypot(s.m.position.x - P().x, s.m.position.z - P().z) > R) continue;
      add(`Человек · ${92 + Math.floor(Math.random() * 7)} %`, () => [s.m.position.x, 0, s.m.position.z, s.m.userData.height + 0.15]);
    }
    if (robo && Math.hypot(robo.g.position.x - P().x, robo.g.position.z - P().z) < R) add('Робот-уборщик · 95 %', () => [robo.g.position.x, 0, robo.g.position.z, 0.7], null, 1);
    for (const r of couriers) {
      if (Math.hypot(r.g.position.x - P().x, r.g.position.z - P().z) < R) add(`Робот-доставщик · ${93 + Math.floor(Math.random() * 6)} %`, () => [r.g.position.x, 0, r.g.position.z, 1.3], null, 0.9);
    }
    for (const dcy of L.decoys || []) {
      if (Math.hypot(dcy.x - cam.x, dcy.z - cam.z) > 9) continue;
      add(dcy.label, () => [dcy.x, dcy.y || 0, dcy.z, dcy.h || 0.6], dcy.id, dcy.w || 0.9);
    }
    frames = { until: performance.now() + 5000, list };
    if (!cvIntroShown) {
      cvIntroShown = true;
      toast(D.cvIntro || 'Камера с компьютерным зрением: рамки — то, что она «узнала». Найди её ошибки — нажми на рамку.', 'info', 6000);
    }
  }

  // ---------------- Роботы-доставщики (на колёсах, с компьютерным зрением) ----------------
  // Едут по маршруту туда-обратно. Игрока видят: в коридоре объезжают, в дверях — ждут.
  const couriers = (L.couriers || []).filter((c) => c.route?.length > 1).map((c) => {
    const g = new THREE.Group();
    F.courier(W, g, { color: c.color, cargo: c.cargo });
    const [x0, z0] = c.route[0];
    g.position.set(x0, 0, z0);
    scene.add(g);
    const pin = h('button', { class: 'life-pin hidden', onclick: () => modal({ title: c.title, body: fmt(c.info) }) }, c.label);
    const bubble = h('div', { class: 'robo-bubble ai hidden' }, c.say || 'ВИЖУ ЧЕЛОВЕКА. ОБЪЕЗЖАЮ');
    layer.append(pin, bubble);
    return { c, g, pin, bubble, k: 1, dir: 1, off: 0, wait: 0, saw: false, loop: null };
  });
  function updCouriers(dt) {
    for (const r of couriers) {
      const route = r.c.route, p = r.g.position;
      if (r.wait > 0) { r.wait -= dt; continue; }
      const [tx, tz] = route[r.k];
      const [px, pz] = route[r.k - r.dir] || route[r.k];
      // Точка на «осевой» линии маршрута (без бокового смещения).
      let fx = tx - px, fz = tz - pz;
      const L0 = Math.hypot(fx, fz) || 1;
      fx /= L0; fz /= L0;
      const nx = -fz, nz = fx; // нормаль — в сторону объезда
      const bx = p.x - nx * r.off, bz = p.z - nz * r.off;
      const dl = Math.hypot(tx - bx, tz - bz);
      // Игрок впереди?
      const dx = P().x - bx, dz = P().z - bz, d = Math.hypot(dx, dz);
      const ahead = d < 1.8 && (dx * fx + dz * fz) / (d || 1) > 0.3;
      const [cz1, cz2] = r.c.corridor || [-1e9, 1e9];
      const inCorr = Math.abs(fx) > 0.5 && bz > cz1 && bz < cz2; // участок вдоль коридора
      let want = 0;
      if (ahead && inCorr) {
        const side = dx * nx + dz * nz > 0 ? -1 : 1;
        want = side * 0.95;
        // Не прижиматься к стене.
        const zz = bz + nz * want;
        if (zz < cz1 + 0.55 || zz > cz2 - 0.55) want = -want;
      }
      if (ahead && !r.saw) { r.saw = true; sound.play('chime', 0.5); }
      if (!ahead && d > 2.5) r.saw = false;
      const stop = ahead && !inCorr;
      const speed = stop ? 0 : ahead ? 0.5 : 1.0;
      const step = Math.min(speed * dt, dl);
      // Объезд — плавный (боковой сдвиг медленнее хода), корпус поворачивается по ходу.
      const off = r.off + Math.sign(want - r.off) * Math.min(Math.abs(want - r.off), dt * 0.6);
      const nx2 = bx + fx * step + nx * off, nz2 = bz + fz * step + nz * off;
      const went = drive(r.g, nx2 - p.x, nz2 - p.z, dt);
      if (went > 0) {
        r.off = off; // пока разворачивается на месте — смещение не меняем
        for (const w of r.g.userData.wheels || []) w.rotation.x += went / 0.11; // колёса катятся
      }
      if (dl < 0.05) {
        if (r.k + r.dir < 0 || r.k + r.dir >= route.length) { r.dir = -r.dir; r.wait = 3; }
        r.k += r.dir;
      }
      // Гул мотора — только рядом и тихо.
      const dd = Math.hypot(P().x - p.x, P().z - p.z);
      r.loop ||= sound.loop('motor');
      r.loop.set(Math.max(0, 1 - dd / 7) * 0.8);
      const q = proj(p.x, 1.35, p.z);
      const show = q.ok && dd < 9;
      r.pin.classList.toggle('hidden', !show);
      r.bubble.classList.toggle('hidden', !(show && ahead));
      if (show) {
        r.pin.style.transform = `translate(${q.x}px, ${q.y}px) translate(-50%, -100%)`;
        r.bubble.style.transform = `translate(${q.x}px, ${q.y - 34}px) translate(-50%, -100%)`;
      }
    }
  }

  // ---------------- Телефон корреспондента: уведомления ----------------
  const notes = (D.notes || []).map((n) => ({ ...n, state: 'new' }));
  let phoneOn = false, nIdx = 0, freeT = 0, nextAt = 30, unread = 0;
  const badgeNum = h('b', { class: 'phone-num hidden' });
  const phoneBtn = h('button', { class: 'phone-btn hidden', title: 'Телефон корреспондента', onclick: () => openPhone() },
    h('span', { html: '<svg viewBox="0 0 24 24" width="44" height="44"><rect x="6" y="2" width="12" height="20" rx="2.5" fill="#30344a"/><rect x="7.5" y="4.5" width="9" height="14" rx="1" fill="#8fd3ff"/><circle cx="12" cy="20.2" r="0.9" fill="#fff"/></svg>' }),
    badgeNum,
  );
  hud.root.append(phoneBtn);
  const updBadge = () => {
    unread = notes.filter((n, i) => i < nIdx && n.state === 'new').length;
    badgeNum.textContent = String(unread);
    badgeNum.classList.toggle('hidden', !unread);
  };
  function enablePhone(quiet = false) {
    phoneOn = true;
    phoneBtn.classList.remove('hidden');
    if (!quiet) toast('**Телефон корреспондента** — слева внизу. Смотри, что приходит, и решай, что открывать.', 'info', 5500);
  }
  function updPhone(dt) {
    if (!phoneOn || nIdx >= notes.length) return;
    freeT += dt;
    if (freeT < nextAt) return;
    freeT = 0;
    nextAt = 50 + Math.random() * 25;
    const n = notes[nIdx++];
    updBadge();
    sound.play('ding');
    phoneBtn.classList.remove('bump'); void phoneBtn.offsetWidth; phoneBtn.classList.add('bump');
    const ban = h('button', { class: 'notif', onclick: () => { ban.remove(); openPhone(); } },
      h('span', { class: 'notif-from' }, n.from), h('span', { class: 'notif-text', html: richS(n.text) }));
    layer.append(ban);
    setTimeout(() => { ban.classList.add('out'); setTimeout(() => ban.remove(), 400); }, 6000);
  }
  function openPhone() {
    if (document.querySelector('.overlay')) return;
    const got = notes.slice(0, nIdx).reverse();
    const close = () => { wrap.remove(); sound.play('click'); };
    const row = (n) => {
      const fb = h('div', { class: 'fb' });
      const acts = h('div', { class: 'note-acts' });
      const ACT = [['open', 'Открыть'], ['delete', 'Удалить'], ['spam', 'Сообщить о спаме']];
      const draw = () => {
        acts.replaceChildren(...(n.state === 'new' ? ACT.map(([a, label]) => h('button', { class: 'btn small', onclick: () => answer(n, a, fb, draw) }, label)) : []));
        if (n.state === 'done') { fb.className = 'fb ok'; fb.innerHTML = '✓ ' + rich(n.why); }
      };
      draw();
      return h('div', { class: 'note' + (n.state === 'done' ? ' done' : '') }, h('div', { class: 'note-from' }, n.from), h('div', { class: 'note-text', html: richS(n.text) }), acts, fb);
    };
    const wrap = h('div', { class: 'overlay' },
      h('div', { class: 'modal wide phone-modal' },
        h('h2', {}, 'Телефон корреспондента'),
        got.length ? h('div', { class: 'note-list' }, got.map(row)) : h('p', {}, 'Пока сообщений нет.'),
        h('details', { class: 'spam-tips' }, h('summary', {}, 'Как узнать спам'),
          h('ul', {}, ['Ты не участвовал(а), а «выиграл(а)»', '«Срочно! Спеши!»', 'Просят пароль, код или данные карты', 'Незнакомый отправитель и странная ссылка', 'Файл «бесплатно» — скачай'].map((s) => h('li', {}, s)))),
        h('div', { class: 'modal-btns' }, h('button', { class: 'btn primary', onclick: close }, 'Закрыть')),
      ),
    );
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(); });
    document.getElementById('ui').append(wrap);
    onEsc(wrap, close);
    sound.play('open');
  }
  let spamClean = true;
  function answer(n, act, fb, redraw) {
    if (n.right.includes(act)) {
      n.state = 'done';
      sound.play('good');
      redraw();
      updBadge();
      if (notes.every((x) => x.state === 'done') && spamClean) progress.achieve('spam');
    } else {
      spamClean = false;
      sound.play('bad');
      fb.className = 'fb warn';
      fb.innerHTML = '<b>Подумай:</b> ' + rich(n.hints?.[act] || 'этот выбор здесь не подходит.');
    }
  }

  // ---------------- Кадр ----------------
  return {
    enablePhone,
    // Сохранение для «Продолжить»: телефон и сообщения, найденные ошибки камер, «помехи» Шустрику.
    save: () => ({ phoneOn, nIdx, notes: notes.map((n) => n.state), spamClean, cv: [...foundCv], robo: robo?.blocks || 0 }),
    load(s) {
      if (!s) return;
      if (s.phoneOn) enablePhone(true);
      nIdx = Math.min(s.nIdx || 0, notes.length);
      (s.notes || []).forEach((v, i) => { if (notes[i]) notes[i].state = v; });
      spamClean = s.spamClean !== false;
      (s.cv || []).forEach((id) => foundCv.add(id));
      if (robo) robo.blocks = s.robo || 0;
      updBadge();
      for (const o of facts) if (progress.facts.has(o.f.id)) { o.m.visible = false; o.ring.visible = false; }
    },
    update(dt, free) {
      const dx = P().x - lastX, dz = P().z - lastZ;
      if (dt > 0) { pvx = dx / dt; pvz = dz / dt; }
      lastX = P().x; lastZ = P().z;
      if (!free) {
        // Во время диалогов и окон — пауза; рамки камер прячем.
        if (frames) { frames.list.forEach((f) => f.el.remove()); frames = null; }
        robo?.pin.classList.add('hidden');
        robo?.bubble.classList.add('hidden');
        robo?.loop?.set(0);
        for (const r of couriers) { r.pin.classList.add('hidden'); r.bubble.classList.add('hidden'); r.loop?.set(0); }
        return;
      }
      updBalls(dt);
      updBalloons(dt);
      updRobo(dt);
      updStuds(dt);
      updFacts(dt);
      updCams(dt);
      updCouriers(dt);
      updPhone(dt);
    },
  };
}
