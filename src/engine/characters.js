// Низкополигональные персонажи из примитивов + анимация ходьбы и поворот головы.
//
// look = {
//   adult: false,          // рост 1,75 вместо 1,45
//   skin: 0xf2c9a5, hair: 0x4a2c1a, style: 'short'|'long'|'pony'|'braids'|'bun'|'curly'|'bob',
//   top: 0x…, sleeves: 0x… (по умолчанию = top), bottom: 0x…, shoes: 0x…,
//   vest: 0x… (жилет поверх), apron: 0x…, coat: true (длинный верх), dress: true,
//   hat: { type: 'cap'|'beret', color }, glasses: 0x…, goggles: true, beard: 0x…, mustache: 0x…,
//   headphones: 0x…, backpack: 0x…, badge: true,
// }
import * as THREE from 'three';

const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 14, 10),
  half: new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  torus: new THREE.TorusGeometry(1, 0.22, 6, 14),
};
const mats = new Map();
export function mat(color) {
  if (!mats.has(color)) mats.set(color, new THREE.MeshLambertMaterial({ color }));
  return mats.get(color);
}

function part(g, color, sx, sy, sz, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo[g], mat(color));
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}

export function makePerson(look = {}) {
  const L = {
    skin: 0xf2c9a5, hair: 0x4a2c1a, style: 'short', top: 0x4f7cff, bottom: 0x2f3b5c, shoes: 0x2a2a2a,
    ...look,
  };
  const s = L.adult ? 1.2 : 1;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const legH = 0.62 * s, torsoH = 0.5 * s, headR = 0.17 * (L.adult ? 1.08 : 1.12);
  const hipY = legH;
  const sleeves = L.sleeves ?? L.top;

  // Ноги (пивот в бедре).
  const legs = [-1, 1].map((side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.1 * s, hipY, 0);
    part('box', L.dress ? L.skin : L.bottom, 0.13 * s, legH, 0.15 * s, 0, -legH / 2, 0, g);
    part('box', L.shoes, 0.14 * s, 0.08, 0.24 * s, 0, -legH + 0.04, 0.04, g);
    body.add(g);
    return g;
  });

  // Туловище.
  const torso = new THREE.Group();
  torso.position.y = hipY;
  body.add(torso);
  const tw = 0.42 * s, td = 0.24 * s;
  part('box', L.top, tw, torsoH, td, 0, torsoH / 2, 0, torso);
  if (L.dress) part('cyl', L.top, 0.27 * s, 0.34 * s, 0.2 * s, 0, -0.1 * s, 0, torso);
  if (L.coat) part('box', L.top, tw * 1.02, 0.36 * s, td * 1.05, 0, -0.16 * s, 0, torso);
  if (!L.dress && !L.coat) part('box', L.bottom, tw * 0.98, 0.1 * s, td * 0.98, 0, 0, 0, torso);
  if (L.vest) part('box', L.vest, tw * 1.04, torsoH * 0.85, td * 1.08, 0, torsoH * 0.47, 0, torso);
  if (L.apron) part('box', L.apron, tw * 0.8, torsoH * 1.4, 0.02, 0, torsoH * 0.35, td / 2 + 0.01, torso);
  if (L.badge) {
    part('box', 0xffffff, 0.08 * s, 0.1 * s, 0.01, 0.08 * s, torsoH * 0.45, td / 2 + 0.02, torso);
    part('box', 0x2f6bff, 0.012, 0.18 * s, 0.01, 0.08 * s, torsoH * 0.7, td / 2 + 0.015, torso);
  }
  if (L.backpack) part('box', L.backpack, tw * 0.75, torsoH * 0.8, 0.14 * s, 0, torsoH * 0.5, -td / 2 - 0.07 * s, torso);

  // Руки (пивот в плече).
  const arms = [-1, 1].map((side) => {
    const g = new THREE.Group();
    g.position.set(side * (tw / 2 + 0.06 * s), hipY + torsoH * 0.95, 0);
    part('box', sleeves, 0.11 * s, 0.46 * s, 0.13 * s, 0, -0.23 * s, 0, g);
    part('sphere', L.skin, 0.06 * s, 0.06 * s, 0.06 * s, 0, -0.5 * s, 0, g);
    body.add(g);
    return g;
  });

  // Голова.
  const head = new THREE.Group();
  head.position.y = hipY + torsoH + 0.05 * s;
  body.add(head);
  part('cyl', L.skin, 0.06 * s, 0.08, 0.06 * s, 0, 0.02, 0, head);
  const hy = headR + 0.05;
  part('sphere', L.skin, headR, headR * 1.05, headR, 0, hy, 0, head);
  for (const side of [-1, 1]) {
    part('sphere', 0x1d1d2b, 0.024, 0.03, 0.02, side * 0.065, hy + 0.01, headR * 0.93, head);
    part('sphere', L.skin, 0.03, 0.04, 0.03, side * headR * 0.98, hy, 0, head); // уши
  }
  part('sphere', 0xe9a28a, 0.03, 0.022, 0.02, 0, hy - 0.06, headR * 0.92, head); // рот/нос
  hair(head, L, headR, hy);
  if (L.glasses) {
    for (const side of [-1, 1]) {
      const r = part('torus', L.glasses, 0.045, 0.045, 0.045, side * 0.066, hy + 0.01, headR * 0.98, head);
      r.castShadow = false;
    }
    part('box', L.glasses, 0.04, 0.008, 0.008, 0, hy + 0.02, headR * 1.0, head);
  }
  if (L.goggles) {
    // Защитные очки подняты на лоб.
    part('box', 0x8fd6ff, headR * 1.5, 0.07, 0.04, 0, hy + headR * 0.62, headR * 0.86, head);
    part('box', 0x3355aa, headR * 1.65, 0.025, 0.03, 0, hy + headR * 0.62, headR * 0.8, head);
  }
  if (L.beard) part('sphere', L.beard, headR * 0.82, headR * 0.6, headR * 0.6, 0, hy - headR * 0.5, headR * 0.45, head);
  if (L.mustache) part('box', L.mustache, 0.12, 0.025, 0.03, 0, hy - 0.045, headR * 0.96, head);
  if (L.headphones) {
    for (const side of [-1, 1]) part('cyl', L.headphones, 0.06, 0.04, 0.06, side * 0.1, hy - 0.22, 0.05, head).rotation.z = Math.PI / 2;
    part('torus', L.headphones, 0.1, 0.1, 0.12, 0, hy - 0.22, 0.05, head).rotation.x = Math.PI / 2;
  }
  if (L.hat?.type === 'cap') {
    part('half', L.hat.color, headR * 1.08, headR * 0.75, headR * 1.08, 0, hy + 0.04, 0, head);
    part('box', L.hat.color, headR * 1.5, 0.02, headR * 1.1, 0, hy + 0.05, -headR * 1.0, head); // козырёк назад
  } else if (L.hat?.type === 'beret') {
    const b = part('sphere', L.hat.color, headR * 1.15, headR * 0.35, headR * 1.15, -0.03, hy + headR * 0.85, 0, head);
    b.rotation.z = 0.25;
  }

  root.userData = { legs, arms, head, body, phase: Math.random() * 6, walking: false, height: hipY + torsoH + 0.4 };
  root.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });
  return root;
}

function hair(head, L, r, hy) {
  const c = L.hair;
  if (L.style === 'bald') return;
  // Основная «шапка» волос.
  part('half', c, r * 1.08, r * 1.16, r * 1.09, 0, hy + 0.005, -0.01, head);
  part('sphere', c, r * 1.06, r * 1.0, r * 0.92, 0, hy + 0.03, -0.04, head);
  switch (L.style) {
    case 'long':
      part('box', c, r * 2.1, r * 2.6, r * 0.7, 0, hy - r * 0.9, -r * 0.55, head);
      break;
    case 'pony':
      part('sphere', c, r * 0.4, r * 0.4, r * 0.4, 0, hy + r * 0.5, -r * 1.05, head);
      part('cyl', c, r * 0.28, r * 1.6, r * 0.28, 0, hy - r * 0.4, -r * 1.25, head);
      if (L.scrunchie) part('torus', L.scrunchie, r * 0.25, r * 0.25, r * 0.25, 0, hy + r * 0.4, -r * 1.1, head);
      break;
    case 'braids':
      for (const side of [-1, 1]) {
        part('cyl', c, r * 0.22, r * 1.9, r * 0.22, side * r * 0.95, hy - r * 1.0, -r * 0.1, head);
        if (L.scrunchie) part('sphere', L.scrunchie, r * 0.16, r * 0.16, r * 0.16, side * r * 0.95, hy - r * 1.9, -r * 0.1, head);
      }
      break;
    case 'bun':
      part('sphere', c, r * 0.48, r * 0.42, r * 0.48, 0, hy + r * 1.0, -r * 0.3, head);
      break;
    case 'curly':
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        part('sphere', c, r * 0.36, r * 0.36, r * 0.36, Math.cos(a) * r * 0.8, hy + r * 0.55 + Math.sin(i * 1.7) * 0.03, Math.sin(a) * r * 0.75 - 0.03, head);
      }
      break;
    case 'bob':
      part('box', c, r * 2.12, r * 1.2, r * 1.6, 0, hy - r * 0.35, -r * 0.35, head);
      break;
    default:
      break;
  }
}

// Анимация: ходьба/покой и поворот головы к цели (мировые координаты).
const tmp = new THREE.Vector3();
export function animatePerson(p, dt, lookAtWorld = null) {
  const u = p.userData;
  u.phase += dt * (u.walking ? 9 : 2);
  const sw = u.walking ? Math.sin(u.phase) * 0.6 : 0;
  u.legs[0].rotation.x = sw;
  u.legs[1].rotation.x = -sw;
  u.arms[0].rotation.x = -sw * 0.8;
  u.arms[1].rotation.x = sw * 0.8;
  u.body.position.y = u.walking ? Math.abs(Math.sin(u.phase)) * 0.04 : Math.sin(u.phase) * 0.006;
  let want = 0;
  if (lookAtWorld) {
    tmp.copy(lookAtWorld);
    p.worldToLocal(tmp);
    want = Math.max(-1.0, Math.min(1.0, Math.atan2(tmp.x, tmp.z)));
  }
  u.head.rotation.y += (want - u.head.rotation.y) * Math.min(1, dt * 6);
}
