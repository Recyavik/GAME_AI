// Камера: follow (сверху-сзади за игроком), cine (кинокадр на станции), orbit (облёт на титуле).
import * as THREE from 'three';
import { clamp } from './util.js';

const OFFSET = new THREE.Vector3(0, 6.6, 6.8);

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'orbit';
    this.zoom = 1;
    this.obj = null;
    this.curPos = new THREE.Vector3(0, 10, 10);
    this.curLook = new THREE.Vector3();
    this.wantPos = new THREE.Vector3();
    this.wantLook = new THREE.Vector3();
    this.orbitC = new THREE.Vector3();
    this.orbitR = 14;
    this.orbitH = 9;
    this.angle = 0.6;
    this.yaw = 0; // поворот камеры вокруг игрока (0 — с юга)
  }

  follow(obj) { this.mode = 'follow'; this.obj = obj; }

  cine(from, look) {
    this.mode = 'cine';
    this.wantPos.copy(from);
    this.wantLook.copy(look);
  }

  orbit(center, r = 14, h = 9) {
    this.mode = 'orbit';
    this.orbitC.copy(center);
    this.orbitR = r;
    this.orbitH = h;
  }

  addZoom(d) { this.zoom = clamp(this.zoom + d, 0.6, 1.5); }
  addYaw(d) { this.yaw = Math.atan2(Math.sin(this.yaw + d), Math.cos(this.yaw + d)); }
  // Направление от точки (x, z) к камере по полу — для опускания стен (и в крупном плане станции).
  dirFrom(x, z) {
    const dx = this.camera.position.x - x, dz = this.camera.position.z - z;
    const d = Math.hypot(dx, dz);
    return d > 0.01 ? [dx / d, dz / d] : [Math.sin(this.yaw), Math.cos(this.yaw)];
  }

  // Направление «вперёд» для клавиатуры (камера в follow смотрит вдоль −Z).
  _targets(dt) {
    if (this.mode === 'follow' && this.obj) {
      const p = this.obj.position;
      this.wantLook.set(p.x, p.y + 1.0, p.z);
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      this.wantPos.set(p.x + OFFSET.z * s * this.zoom, this.wantLook.y + OFFSET.y * this.zoom, p.z + OFFSET.z * c * this.zoom);
    } else if (this.mode === 'orbit') {
      this.angle += dt * 0.07;
      const c = this.orbitC;
      this.wantPos.set(c.x + Math.cos(this.angle) * this.orbitR, c.y + this.orbitH, c.z + Math.sin(this.angle) * this.orbitR);
      this.wantLook.copy(c);
    }
  }

  snap() {
    this._targets(0);
    this.curPos.copy(this.wantPos);
    this.curLook.copy(this.wantLook);
  }

  update(dt) {
    this._targets(dt);
    const speed = this.mode === 'orbit' ? 20 : this.mode === 'cine' ? 2.6 : 4.5;
    const k = 1 - Math.exp(-dt * speed);
    this.curPos.lerp(this.wantPos, k);
    this.curLook.lerp(this.wantLook, k);
    this.camera.position.copy(this.curPos);
    this.camera.lookAt(this.curLook);
  }
}
