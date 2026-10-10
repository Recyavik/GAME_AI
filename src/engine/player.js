// Игрок: ходьба по клику (путь A*), WASD/стрелки, автопилот, скольжение вдоль препятствий.
import * as THREE from 'three';
import { animatePerson } from './characters.js';
import { sound } from './sound.js';

const SPEED = 3.2;

export class Player {
  constructor({ model, nav, scene }) {
    this.model = model;
    this.nav = nav;
    this.path = [];
    this.keys = new Set();
    this.locked = true;
    this.stepT = 0;
    this.yaw = 0;
    // Кольцо-метка точки клика.
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.32, 24),
      new THREE.MeshBasicMaterial({ color: 0x7c4dff, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.ring.visible = false;
    scene.add(this.ring);

    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  get pos() { return this.model.position; }

  teleport(x, z, yaw = this.yaw) {
    this.model.position.set(x, 0, z);
    this.yaw = yaw;
    this.model.rotation.y = yaw;
    this.path = [];
  }

  goTo(x, z, showRing = true) {
    const p = this.nav.path([this.pos.x, this.pos.z], [x, z]);
    if (!p || !p.length) return false;
    this.path = p;
    this.goal = [x, z];
    this.replans = 0;
    if (showRing) {
      const end = p[p.length - 1];
      this.ring.position.set(end[0], 0.02, end[1]);
      this.ring.visible = true;
    }
    return true;
  }

  stop() { this.path = []; this.ring.visible = false; }

  // Шаг к точке пути упёрся (угол косяка, NPC встал рядом): сначала в центр ближайшей
  // свободной клетки, оттуда — новый путь к той же цели. Путь не бросаем молча.
  _unstick() {
    const goal = this.goal;
    const c = this.nav.cellCenter(this.pos.x, this.pos.z);
    if (!goal || !c || this.replans++ > 6) { this.path.shift(); return; }
    const rest = this.nav.path(c, goal);
    this.path = rest ? [c, ...rest] : [c];
  }

  faceTo(x, z) { this.yaw = Math.atan2(x - this.pos.x, z - this.pos.z); }

  _move(dx, dz) {
    const n = this.nav, p = this.pos;
    if (n.canStand(p.x + dx, p.z + dz)) { p.x += dx; p.z += dz; return true; }
    if (dx && n.canStand(p.x + dx, p.z)) { p.x += dx; return true; }
    if (dz && n.canStand(p.x, p.z + dz)) { p.z += dz; return true; }
    return false;
  }

  update(dt, lookAt = null) {
    let moving = false;
    if (!this.locked) {
      const k = this.keys;
      const mx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      const mz = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
      if (mx || mz) {
        this.stop();
        const l = Math.hypot(mx, mz);
        // Клавиши — относительно камеры (её можно повернуть).
        const s = Math.sin(this.camYaw || 0), c = Math.cos(this.camYaw || 0);
        const wx = (mx * c + mz * s) / l, wz = (mz * c - mx * s) / l;
        const dx = wx * SPEED * dt, dz = wz * SPEED * dt;
        if (this._move(dx, dz)) { moving = true; this.yaw = Math.atan2(wx, wz); }
      } else if (this.path.length) {
        const [tx, tz] = this.path[0];
        const dx = tx - this.pos.x, dz = tz - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.05) {
          this.path.shift();
          if (!this.path.length) this.ring.visible = false;
        } else {
          const s = Math.min(SPEED * dt, d);
          if (this._move((dx / d) * s, (dz / d) * s)) {
            moving = true;
            this.yaw = Math.atan2(dx, dz);
          } else this._unstick();
        }
      }
    }
    // Плавный поворот тела.
    let dy = this.yaw - this.model.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.model.rotation.y += dy * Math.min(1, dt * 12);
    this.model.userData.walking = moving;
    animatePerson(this.model, dt, lookAt);
    if (moving) {
      this.stepT -= dt;
      if (this.stepT <= 0) { sound.play('step'); this.stepT = 0.33; }
    }
    if (this.ring.visible) this.ring.rotation.z += dt * 2;
    return moving;
  }
}
