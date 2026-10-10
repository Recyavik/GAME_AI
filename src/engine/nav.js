// Проходимость и поиск пути.
// walk  — прямоугольники [x1,z1,x2,z2], где может стоять ЦЕНТР игрока (уже с учётом стен);
// block — препятствия [x1,z1,x2,z2]; к ним добавляется радиус игрока.
// Путь ищется A* по сетке 0,25 м и сглаживается «натягиванием нити».

export class Nav {
  constructor(walk, block, radius = 0.3, cell = 0.25) {
    this.walk = walk;
    this.block = block.map(([a, b, c, d]) => [Math.min(a, c) - radius, Math.min(b, d) - radius, Math.max(a, c) + radius, Math.max(b, d) + radius]);
    this.cell = cell;
    this.radius = radius;
    this.dyn = new Map(); // временные препятствия (закрытая дверь и т. п.): id → прямоугольник
    let x1 = Infinity, z1 = Infinity, x2 = -Infinity, z2 = -Infinity;
    for (const [a, b, c, d] of walk) {
      x1 = Math.min(x1, a, c); z1 = Math.min(z1, b, d);
      x2 = Math.max(x2, a, c); z2 = Math.max(z2, b, d);
    }
    this.ox = x1; this.oz = z1;
    this.w = Math.ceil((x2 - x1) / cell) + 1;
    this.h = Math.ceil((z2 - z1) / cell) + 1;
    this.grid = new Uint8Array(this.w * this.h);
    this.rebuild();
  }

  rebuild() {
    for (let j = 0; j < this.h; j++)
      for (let i = 0; i < this.w; i++)
        this.grid[j * this.w + i] = this.canStand(this.ox + i * this.cell, this.oz + j * this.cell) ? 1 : 0;
  }

  // Поставить/убрать временное препятствие (rect = [x1,z1,x2,z2] или null).
  // rebuild = false — когда ставим много препятствий подряд и пересобираем сетку один раз в конце.
  setBlock(id, rect, rebuild = true) {
    const r = this.radius;
    if (rect) this.dyn.set(id, [Math.min(rect[0], rect[2]) - r, Math.min(rect[1], rect[3]) - r, Math.max(rect[0], rect[2]) + r, Math.max(rect[1], rect[3]) + r]);
    else this.dyn.delete(id);
    if (rebuild) this.rebuild();
  }

  canStand(x, z) {
    let inWalk = false;
    for (const [a, b, c, d] of this.walk) {
      if (x >= Math.min(a, c) && x <= Math.max(a, c) && z >= Math.min(b, d) && z <= Math.max(b, d)) { inWalk = true; break; }
    }
    if (!inWalk) return false;
    for (const [a, b, c, d] of this.block) if (x > a && x < c && z > b && z < d) return false;
    for (const [a, b, c, d] of this.dyn.values()) if (x > a && x < c && z > b && z < d) return false;
    return true;
  }

  // Прямая свободна «с запасом»: проверяем саму линию и две параллельные в 6 см по бокам,
  // иначе линия может срезать угол косяка между точками проверки — и герой упрётся в дверях.
  lineFree(ax, az, bx, bz) {
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(L / 0.05);
    const ox = L ? (-(bz - az) / L) * 0.06 : 0, oz = L ? ((bx - ax) / L) * 0.06 : 0;
    for (let k = 1; k <= n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (!this.canStand(x, z) || !this.canStand(x + ox, z + oz) || !this.canStand(x - ox, z - oz)) return false;
    }
    return true;
  }

  // Центр ближайшей свободной клетки (куда точно можно встать).
  cellCenter(x, z) {
    const c = this.nearest(x, z);
    return c ? [this.ox + c[0] * this.cell, this.oz + c[1] * this.cell] : null;
  }

  _cell(x, z) {
    return [Math.round((x - this.ox) / this.cell), Math.round((z - this.oz) / this.cell)];
  }

  _free(i, j) {
    return i >= 0 && j >= 0 && i < this.w && j < this.h && this.grid[j * this.w + i] === 1;
  }

  // Ближайшая проходимая клетка (поиск кольцами).
  nearest(x, z) {
    const [ci, cj] = this._cell(x, z);
    if (this._free(ci, cj)) return [ci, cj];
    for (let r = 1; r < 60; r++) {
      let best = null, bd = Infinity;
      for (let dj = -r; dj <= r; dj++)
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          if (!this._free(ci + di, cj + dj)) continue;
          const d = di * di + dj * dj;
          if (d < bd) { bd = d; best = [ci + di, cj + dj]; }
        }
      if (best) return best;
    }
    return null;
  }

  path(from, to) {
    const s = this.nearest(from[0], from[1]);
    const g = this.nearest(to[0], to[1]);
    if (!s || !g) return null;
    const W = this.w, N = W * this.h;
    const gs = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new MinHeap();
    const si = s[1] * W + s[0], gi = g[1] * W + g[0];
    const hfun = (i, j) => {
      const dx = Math.abs(i - g[0]), dz = Math.abs(j - g[1]);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    gs[si] = 0;
    heap.push(si, hfun(s[0], s[1]));
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let found = false;
    while (heap.size) {
      const cur = heap.pop();
      if (cur === gi) { found = true; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const ci = cur % W, cj = (cur / W) | 0;
      for (const [di, dj, cost] of DIRS) {
        const ni = ci + di, nj = cj + dj;
        if (!this._free(ni, nj)) continue;
        if (di && dj && (!this._free(ci + di, cj) || !this._free(ci, cj + dj))) continue;
        const n = nj * W + ni;
        const ng = gs[cur] + cost;
        if (ng < gs[n]) {
          gs[n] = ng;
          came[n] = cur;
          heap.push(n, ng + hfun(ni, nj));
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let c = gi; c !== -1; c = came[c]) cells.push([this.ox + (c % W) * this.cell, this.oz + ((c / W) | 0) * this.cell]);
    cells.reverse();
    // Конечная точка — сама цель, если на ней можно стоять.
    if (this.canStand(to[0], to[1])) cells[cells.length - 1] = [to[0], to[1]];
    // Сглаживание: от текущей точки тянемся к самой дальней видимой.
    const out = [];
    let a = [from[0], from[1]];
    let k = 0;
    while (k < cells.length) {
      let far = k;
      for (let m = cells.length - 1; m > k; m--) {
        if (this.lineFree(a[0], a[1], cells[m][0], cells[m][1])) { far = m; break; }
      }
      a = cells[far];
      out.push(a);
      k = far + 1;
    }
    return out;
  }
}

class MinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(key, pri) {
    const k = this.k, p = this.p;
    k.push(key); p.push(pri);
    let i = k.length - 1;
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (p[up] <= p[i]) break;
      [k[up], k[i]] = [k[i], k[up]];
      [p[up], p[i]] = [p[i], p[up]];
      i = up;
    }
  }
  pop() {
    const k = this.k, p = this.p;
    const top = k[0];
    const lk = k.pop(), lp = p.pop();
    if (k.length) {
      k[0] = lk; p[0] = lp;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < k.length && p[l] < p[m]) m = l;
        if (r < k.length && p[r] < p[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [p[m], p[i]] = [p[i], p[m]];
        i = m;
      }
    }
    return top;
  }
}
