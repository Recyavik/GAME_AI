// Исполнитель сценария: собирает мир, показывает титул и ведёт игрока по этапам.
// Сценарий — данные (games/<slug>/scenario.js), мир — games/<slug>/world.js.
//
// Этап: { title, task, goal, station: N, place?, flow: [шаги] }. Шаги flow (по порядку, после прихода к goal):
//   { say: [[кто, текст], …] }              — диалог;
//   { station: { kind, steps|widget+data, card?, shield? } } — окно станции; card — карточка правды по завершении;
//   { goal: 'точка', task?: 'текст' }         — дойти до другой точки;
//   { place: { id: 'позиция@…' } }           — переставить NPC;
//   { act: 'имя' }                            — действие мира (W.actions[имя]) или движка (achieve:… / toast:…).
//
// Гибкие цели: по умолчанию этапы идут по порядку, но игрок может прийти к любой доступной станции
// (или выбрать её в списке «Станции», клавиша Q) — она запустится. Вышел из задания посреди станции —
// станция «начата» и продолжится с этого же места, когда игрок вернётся.
// Доступность: stage.requires = ['id', …] (id этапов, которые нужно выполнить раньше), lockedHint — почему закрыто.
// stage.place применяется один раз, когда этап становится доступным.
import * as THREE from 'three';
import { createCore } from './core.js';
import { CameraRig } from './camera.js';
import { WorldBuilder, F } from './props.js';
import { Nav } from './nav.js';
import { makePerson, animatePerson } from './characters.js';
import { Player } from './player.js';
import { Hud } from './hud.js';
import { Dialog } from './dialog.js';
import { Progress } from './findings.js';
import { runStation } from './stations.js';
import { showFinale, closeGame } from './finale.js';
import { sound } from './sound.js';
import { toast, onEsc, modal } from './modal.js';
import { showTitle } from './title.js';
import { createLife } from './life.js';
import { createEyes } from './eyes.js';
import { setHero, sleep, h } from './util.js';
import { loadSave, writeSave, clearSave } from './save.js';

export async function start(sc, buildWorld) {
  const theme = sc.meta.theme || 'light';
  document.body.classList.add('theme-' + theme);
  if (sc.meta.accent) document.documentElement.style.setProperty('--accent', sc.meta.accent);
  if (sc.meta.accent2) document.documentElement.style.setProperty('--accent2', sc.meta.accent2);
  document.title = sc.meta.title;

  const core = createCore(theme);
  const W = new WorldBuilder(core.scene);
  W.actions = {};
  buildWorld(W, F, sc);
  W.bake();
  const nav = new Nav(W.walk, W.block);
  W.nav = nav;
  W.onNav?.(nav);

  // NPC.
  const cast = { ...sc.cast };
  const npcs = {};
  for (const [id, [x, z, rot]] of Object.entries(W.npcs)) {
    if (id.includes('@')) continue; // запасные позиции для place
    const c = cast[id];
    if (!c?.look) continue;
    const m = makePerson(c.look);
    m.position.set(x, 0, z);
    m.rotation.y = rot;
    m.userData.homeYaw = rot;
    m.userData.faceYaw = null;
    core.scene.add(m);
    npcs[id] = m;
    blockNpc(id, false);
  }
  nav.rebuild();
  // Препятствие там, где NPC стоит сейчас: игрок и автопилот обходят его, а не проходят насквозь.
  function blockNpc(id, rebuild = true) {
    const m = npcs[id];
    const { x, z } = m.position;
    nav.setBlock('npc:' + id, m.visible ? [x - 0.2, z - 0.2, x + 0.2, z + 0.2] : null, rebuild);
  }
  const applyPlace = (place) => {
    for (const [id, key] of Object.entries(place || {})) {
      const p = W.npcs[key], m = npcs[id];
      if (!p || !m) { console.warn('place: нет', id, key); continue; }
      m.position.set(p[0], 0, p[1]);
      m.rotation.y = m.userData.homeYaw = p[2];
      m.visible = true;
      blockNpc(id);
    }
  };

  // Сцена замирает, пока открыто любое окно (через полсекунды — чтобы успела доиграть анимация).
  let stationSince = 0;
  core.setPause(() => {
    // Любое окно поверх сцены (станция, финал, тест, блокнот, листовка) — сцена замирает.
    if (!document.querySelector('.overlay')) { stationSince = 0; return false; }
    if (!stationSince) stationSince = performance.now();
    return performance.now() - stationSince > 500;
  });

  const rig = new CameraRig(core.camera);
  rig.orbit(W.center, W.orbitR || 16, W.orbitH || 11);
  rig.snap();

  const progress = new Progress(sc);
  const dialog = new Dialog(cast);
  const state = {};
  let hero = null;
  let player = null;
  let stageLocked = true;
  let goalPoint = null; // текущая цель (для автопилота и метки)
  let arriveFn = null; // ждём прихода: (индекс этапа) => void
  let candidates = []; // [{ i, pt, locked, hint }] — точки, приход к которым что-то запускает
  const disarmed = new Set(); // этапы, из которых только что вышли: сначала нужно отойти
  let lockToastAt = 0;
  let started = false;
  let life = null; // живой мир (фоновые системы)
  let eyes = { open() {}, running: false }; // зарядка для глаз (создаётся после титула)
  // Статус этапов.
  const st = sc.stages.map((s, i) => ({ i, id: s.id || 's' + (i + 1), done: false, resume: null, prepped: false }));
  let target = null; // выбранная игроком цель (индекс этапа) или null — «по порядку»
  const actsLog = []; // выполненные действия мира (шлюз, телефон…) — чтобы повторить их при «Продолжить»
  let saving = false; // сохраняем, пока идёт игра (после финала — нет)
  let exitArmed = true, exitAsking = false; // окно «Выйти из игры?» у дверей школы

  // Общий контекст для виджетов станций.
  const ctx = {
    progress, state, sc,
    get hero() { return hero; },
    onBadge: (card) => hud.showBadge(hero, card),
  };

  const actions = {
    auto: () => autopilot(),
    notebook: (tab) => { if (!document.querySelector('.overlay')) progress.notebook(tab); },
    sound: () => hud.setSound(sound.toggle()),
    fullscreen: () => toggleFullscreen(),
    stations: () => { if (!document.querySelector('.overlay') && started) openStations(); },
    eyes: () => { if (started) eyes.open(); },
  };
  const hud = new Hud({ camera: core.camera, progress, actions, scenario: sc });
  progress.onChange = (what) => {
    hud.refresh(what);
    for (const s of sc.rumors) hud.markSpot(s.id, progress.rumorState(s.id).done);
    save();
  };

  // Листовки Гоши (значки «?») в мире.
  const mark = sc.meta.spotMark || '?';
  for (const s of sc.rumors) {
    const p = W.spots[s.id];
    if (!p) { console.warn('Нет позиции для листовки', s.id); continue; }
    hud.addSpot(s.id, new THREE.Vector3(p[0], p[2], p[1]), mark, async () => {
      if (document.querySelector('.overlay') || dialog.active || !started) return;
      player.stop();
      await progress.askRumor(s.id);
    });
  }
  for (const [id, m] of Object.entries(npcs)) hud.addLabel(id, cast[id].name, m);

  // Говорящий NPC поворачивается к игроку.
  dialog.onSpeaker = (id) => {
    const m = npcs[id];
    if (m && player) m.userData.faceYaw = Math.atan2(player.pos.x - m.position.x, player.pos.z - m.position.z);
  };

  function autopilot() {
    if (!player || stageLocked || document.querySelector('.overlay')) return;
    if (!goalPoint) { toast('Сейчас цели нет — продолжай диалог.'); return; }
    // «Идти к цели» — явное желание: станция, из которой вышли, снова запустится, даже если игрок рядом.
    const cur = currentTarget();
    if (cur != null) disarmed.delete(cur);
    if (!player.goTo(goalPoint.stand[0], goalPoint.stand[1])) toast('Не получается проложить путь к цели.');
    sound.play('click');
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  // ---------- ввод ----------
  // Никакого системного перетаскивания и контекстного меню: браузеры (например, Яндекс с «разделённым
  // экраном» и жестами) открывают по ним новые вкладки. Наше перетаскивание карточек — на pointer-событиях.
  document.addEventListener('dragstart', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  let down = null;
  // Поворот локации: зажать колёсико или правую кнопку мыши и вести мышь влево-вправо.
  let turn = null;
  core.canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 1 || e.button === 2) {
      turn = e.clientX;
      core.canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      return;
    }
    down = [e.clientX, e.clientY];
  });
  core.canvas.addEventListener('pointermove', (e) => {
    if (turn == null) return;
    if (!(e.buttons & 6)) { turn = null; return; } // кнопку отпустили вне окна
    rig.addYaw(-(e.clientX - turn) * 0.006);
    turn = e.clientX;
  });
  core.canvas.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }); // без автопрокрутки
  core.canvas.addEventListener('pointercancel', () => { turn = null; down = null; });
  core.canvas.addEventListener('lostpointercapture', () => { turn = null; });
  core.canvas.addEventListener('pointerup', (e) => {
    if (turn != null && (e.button === 1 || e.button === 2)) { turn = null; return; }
    if (e.button !== 0) return;
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 10) return;
    down = null;
    if (!player || player.locked) return;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), core.camera);
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) {
      if (player.goTo(hit.x, hit.z)) sound.play('click');
    }
  });
  core.canvas.addEventListener('wheel', (e) => { rig.addZoom(e.deltaY > 0 ? 0.08 : -0.08); e.preventDefault(); }, { passive: false });
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyF') { toggleFullscreen(); return; }
    if (!started) return;
    if (e.code === 'KeyM') actions.sound();
    if (e.code === 'KeyE' && !eyes.running) { actions.eyes(); return; }
    if (document.querySelector('.overlay')) return;
    if (e.code === 'KeyG') actions.auto();
    if (e.code === 'KeyB') actions.notebook();
    if (e.code === 'KeyQ') actions.stations();
  });

  // ---------- кадр ----------
  core.onFrame((dt) => {
    if (player) {
      player.locked = stageLocked || dialog.active || !!document.querySelector('.overlay');
      player.camYaw = rig.yaw;
      player.update(dt);
      W.updateWalls(player.pos.x, player.pos.z, dt, ...rig.dirFrom(player.pos.x, player.pos.z));
      W.viewYaw = rig.yaw; // для надписей на полу (не вверх ногами)
      checkExit();
      core.followShadow(player.pos.x, player.pos.z);
      if (arriveFn && !player.locked) {
        const p = player.pos;
        for (const c of candidates) {
          const dStand = Math.hypot(p.x - c.pt.stand[0], p.z - c.pt.stand[1]);
          const dAt = Math.hypot(p.x - c.pt.at[0], p.z - c.pt.at[1]);
          if (disarmed.has(c.i)) { if (dStand > 2.2 && dAt > 2.2) disarmed.delete(c.i); continue; }
          if (dStand < 0.7 || dAt < (c.pt.reach ?? 1.4)) {
            if (c.locked) {
              if (performance.now() - lockToastAt > 6000) { lockToastAt = performance.now(); toast(c.hint, 'info', 4500); }
              continue;
            }
            const f = arriveFn; arriveFn = null; f(c.i);
            break;
          }
        }
      }
    }
    for (const m of Object.values(npcs)) {
      const u = m.userData;
      const near = player && Math.hypot(player.pos.x - m.position.x, player.pos.z - m.position.z) < 3.2;
      const want = u.faceYaw ?? u.homeYaw;
      let d = want - m.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      m.rotation.y += d * Math.min(1, dt * 4);
      animatePerson(m, dt, near ? new THREE.Vector3(player.pos.x, 1.3, player.pos.z) : null);
    }
    life?.update(dt, !!player && !player.locked && !dialog.active && !document.querySelector('.overlay'));
    for (const fn of W.animated) fn(dt);
    rig.update(dt);
    hud.update(player ? player.pos : W.center, !player || player.locked);
  });

  // ---------- титул ----------
  // Сохранённая игра — титул предложит «Продолжить».
  const saved = loadSave(sc);
  const savedHero = saved && sc.heroes.find((x) => x.id === saved.hero);
  let summary = null;
  if (savedHero) {
    const tmp = new Progress(sc);
    tmp.load(saved.progress);
    summary = { hero: savedHero, done: saved.st.filter((s) => s.done).length, total: sc.stages.length, score: tmp.score };
  }
  const choice = await showTitle(sc, summary);
  sound.unlock();
  hero = choice.hero;
  if (!choice.resume) clearSave(sc);
  setHero({ name: hero.name, female: !!hero.female });
  cast.me = { name: hero.name, portrait: hero.portrait };
  const model = makePerson(hero.look);
  core.scene.add(model);
  player = new Player({ model, nav, scene: core.scene });
  player.teleport(W.start[0], W.start[1], W.start[2] ?? Math.PI);
  rig.follow(model);
  life = createLife({ core, W, F, player, npcs, hud, progress, sc });
  // Зарядка для глаз: напоминание через 20 минут игры (не во время диалога или окна).
  eyes = createEyes({
    isBusy: () => dialog.active || !!document.querySelector('.overlay'),
    art: sc.eyes?.art,
    onComplete: () => { progress.achieve('eyes'); if (sc.eyes?.bonus) progress.giveBonus('eyes', sc.eyes.bonus, 'зарядка для глаз'); },
    onTick: (min) => hud.setEyesTimer(min),
  });
  // Отладка (только с #debug в адресе): тесты переносят героя и осматривают мир.
  if (location.hash === '#debug') window.__dbg = { player, rig, nav, W };
  started = true;
  hud.show();
  hud.setSound(sound.on);
  await sleep(500);
  if (choice.resume) {
    await restore(saved);
    toast('**Продолжаем** с того места, где остановились.', 'info', 4000);
  } else {
    if (sc.meta.startToast) setTimeout(() => toast(sc.meta.startToast, 'info', 5000), 1500);
    hud.setTarget(sc.stages[0], 0, sc.stages.length, sc.stages[0].task, false);
    if (sc.intro?.length) await dialog.play(sc.intro);
  }
  saving = true;
  save();
  setInterval(save, 5000); // место героя
  addEventListener('pagehide', save);

  // ---------- этапы ----------

  for (;;) {
    prepAvailable();
    if (st.every((s) => s.done)) break;
    refreshTargets();
    const i = await new Promise((r) => { arriveFn = r; });
    candidates = [];
    hud.setGoal(null);
    hud.setPins([]);
    const stage = sc.stages[i];
    const r0 = st[i].resume;
    await arriveAt(W.points[r0?.goal || stage.goal]);
    const res = await runStage(i);
    if (res === 'done') {
      st[i].done = true;
      st[i].resume = null;
      if (target === i) target = null;
      const doneN = st.filter((s) => s.done).length;
      if (doneN < st.length) toast(`Станция выполнена! Готово ${doneN} из ${st.length}.`, 'info', 3000);
    }
    save();
    for (const m of Object.values(npcs)) m.userData.faceYaw = null;
    rig.follow(model);
    stageLocked = false;
  }

  // ---------- финал ----------
  // Игра пройдена: «Продолжить» больше не нужно, «Пройти ещё раз» начнёт с нуля.
  saving = false;
  clearSave(sc);
  hud.setGoal(null);
  stageLocked = true;
  await sleep(600);
  showFinale(sc, progress, hero, ctx);

  // ---------- цели ----------
  function available(i) { return (sc.stages[i].requires || []).every((id) => st.find((s) => s.id === id)?.done); }
  function entry(i) { return W.points[st[i].resume?.goal || sc.stages[i].goal]; }
  function currentTarget() {
    if (target != null && !st[target].done && available(target)) return target;
    return st.find((s) => !s.done && available(s.i))?.i ?? null;
  }
  function pinText(i) { return sc.stages[i].pin ?? (sc.stages[i].station ? String(sc.stages[i].station) : '★'); }

  // Этап стал доступен впервые — ставим NPC на места (stage.place).
  function prepAvailable() {
    for (const s of st) if (!s.prepped && !s.done && available(s.i)) { s.prepped = true; applyPlace(sc.stages[s.i].place); }
  }

  // Метка текущей цели, номера других станций, карточка цели, список точек прихода.
  function refreshTargets() {
    const cur = currentTarget();
    goalPoint = cur != null ? entry(cur) : null;
    const stage = cur != null ? sc.stages[cur] : null;
    hud.setTarget(stage, st.filter((s) => s.done).length, st.length, st[cur]?.resume?.task || stage?.task, !!st[cur]?.resume);
    hud.setGoal(goalPoint ? { pos: new THREE.Vector3(goalPoint.at[0], goalPoint.h, goalPoint.at[1]), label: goalPoint.label || stage.title } : null);
    candidates = [];
    const pins = [];
    for (const s of st) {
      if (s.done) continue;
      const pt = entry(s.i);
      if (!pt) continue;
      const locked = !available(s.i);
      candidates.push({ i: s.i, pt, locked, hint: sc.stages[s.i].lockedHint || 'Эта станция пока закрыта.' });
      if (s.i !== cur) pins.push({ pos: new THREE.Vector3(pt.at[0], pt.h - 0.3, pt.at[1]), text: pinText(s.i), locked, started: !!s.resume });
    }
    hud.setPins(pins);
    rig.follow(model);
    stageLocked = false;
  }

  // Список станций: статус каждой и выбор цели.
  function openStations() {
    const cur = currentTarget();
    const close = () => { wrap.remove(); sound.play('click'); };
    const rows = sc.stages.map((s, i) => {
      const S = st[i];
      const state = S.done ? ['done', '✓ выполнено'] : !available(i) ? ['locked', 'закрыто: ' + (s.lockedHint || '')]
        : i === cur ? ['cur', '★ текущая цель' + (S.resume ? ' · начата, продолжится с того же места' : '')]
          : S.resume ? ['started', '◐ начата — продолжится с того же места'] : ['open', 'доступна'];
      const pick = !S.done && available(i) && i !== cur
        ? h('button', { class: 'btn small primary', onclick: () => { target = i; disarmed.delete(i); close(); toast(`Новая цель: ${s.title}`, 'info', 2500); if (arriveFn) refreshTargets(); } }, 'Сделать целью')
        : null;
      return h('div', { class: 'stn-row ' + state[0] },
        h('span', { class: 'stn-pin' }, pinText(i)),
        h('div', { class: 'stn-main' }, h('b', {}, s.title), h('span', { class: 'stn-state' }, state[1])),
        pick,
      );
    });
    const wrap = h('div', { class: 'overlay' },
      h('div', { class: 'modal wide stations-modal' },
        h('h2', {}, 'Станции фестиваля'),
        h('p', { class: 'w-intro' }, 'Можно идти по порядку или выбрать другую станцию — или просто подойти к ней. Начатая станция продолжится с того же места.'),
        h('div', { class: 'stn-list' }, rows),
        h('div', { class: 'modal-btns' }, h('button', { class: 'btn primary', onclick: close }, 'Закрыть')),
      ),
    );
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(); });
    document.getElementById('ui').append(wrap);
    onEsc(wrap, close);
    sound.play('open');
  }

  // Подойти к точке: герой встаёт на место разговора, кинокадр.
  async function arriveAt(pt) {
    if (Math.hypot(player.pos.x - pt.stand[0], player.pos.z - pt.stand[1]) > 0.5 && player.goTo(pt.stand[0], pt.stand[1], false)) {
      await new Promise((r) => {
        const t0 = performance.now();
        const iv = setInterval(() => {
          if (!player.path.length || performance.now() - t0 > 5000) { clearInterval(iv); r(); }
        }, 100);
      });
    }
    stageLocked = true;
    player.stop();
    player.faceTo(pt.at[0], pt.at[1]);
    cineTo(pt);
    sound.play('open');
    await sleep(450);
  }

  // Реплики с условием (третий элемент): { ifNotDone: 'id' } — только если станция ещё не пройдена;
  // { ifDone: 'id' }; { ifRestDone: true } — пройдены все станции, кроме финала и текущей; { ifRestNotDone: true }.
  // Так подсказки «куда идти дальше» и «всё собрано» не врут при свободном порядке.
  function linesFor(lines, cur) {
    const isDone = (id) => st.find((s) => s.id === id)?.done;
    const restDone = () => st.every((s) => s.done || s.i === cur || sc.stages[s.i].id === 'final');
    return lines.filter((l) => {
      const c = Array.isArray(l) ? l[2] : null;
      if (!c) return true;
      if (c.ifNotDone && isDone(c.ifNotDone)) return false;
      if (c.ifDone && !isDone(c.ifDone)) return false;
      if (c.ifRestDone && !restDone()) return false;
      if (c.ifRestNotDone && restDone()) return false;
      return true;
    });
  }

  // Выполнить этап с места продолжения. Возвращает 'done' или 'paused'.
  async function runStage(i) {
    const stage = sc.stages[i];
    const S = st[i];
    const flow = stage.flow || [];
    hud.setTarget(stage, st.filter((s) => s.done).length, st.length, S.resume?.task || stage.task, false);
    for (let k = S.resume?.k || 0; k < flow.length; k++) {
      const it = flow[k];
      if (it.say) {
        await dialog.play(linesFor(it.say, i));
      } else if (it.goal) {
        // Следующая точка этапа: этап «начат», игрок идёт туда (или занимается другой станцией).
        if (!W.points[it.goal]) throw new Error(`Нет точки «${it.goal}» в world.js`);
        S.resume = { k: k + 1, goal: it.goal, task: it.task };
        target = i;
        return 'paused';
      } else if (it.place) {
        applyPlace(it.place);
      } else if (it.act) {
        await doAct(it.act);
      } else if (it.station) {
        const sd = { title: `Станция ${stage.station} · ${stage.stationName || stage.title}`, ...it.station };
        // Разминка: данные карточек — общие с «Было — стало» (sc.warmup).
        if (it.station.warmup) sd.data = { ...sc.warmup, ...it.station.data };
        const r = await runStation(sd, ctx);
        if (r.result === 'exit') {
          S.resume = { k, goal: S.resume?.goal, task: S.resume?.task || stage.task };
          disarmed.add(i);
          toast('Станция начата — её можно закончить позже. Продолжить — G, другая станция — Q.', 'info', 5000);
          return 'paused';
        }
        if (it.station.card) progress.giveCard(it.station.card);
        if (it.station.warmup) progress.before = state.before;
        await sleep(300);
      }
    }
    return 'done';
  }

  async function doAct(name, replay = false) {
    if (name.startsWith('achieve:')) return replay || progress.achieve(name.slice(8));
    if (name.startsWith('toast:')) return replay || toast(name.slice(6), 'info', 4500);
    if (!replay) actsLog.push(name);
    if (name === 'phone') return life?.enablePhone(replay);
    if (name.startsWith('hide:')) { const id = name.slice(5), m = npcs[id]; if (m) { m.visible = false; blockNpc(id); } return; }
    const fn = W.actions[name];
    if (!fn) { console.warn('Нет действия', name); return; }
    await fn({ npcs, player, nav, ctx, sleep });
  }

  // ---------- выход из школы = выход из игры ----------
  // W.exit = { at: [x, z], r } — у входных дверей предлагаем выйти из игры (игра сохраняется).
  function checkExit() {
    const e = W.exit;
    if (!e || !started || player.locked || exitAsking) return;
    const d = Math.hypot(player.pos.x - e.at[0], player.pos.z - e.at[1]);
    if (d > e.r + 1) exitArmed = true;
    if (d > e.r || !exitArmed) return;
    exitArmed = false;
    exitAsking = true;
    player.stop();
    modal({
      title: 'Выйти из игры?',
      body: 'Это выход из школы. Игра сохранится — в следующий раз можно будет продолжить с этого места.',
      buttons: [{ text: 'Остаться', value: false, primary: true }, { text: 'Выйти из игры', value: true }],
    }).then((v) => {
      exitAsking = false;
      if (v) { save(); closeGame(); }
    });
  }

  // ---------- сохранение ----------
  function save() {
    if (!saving) return;
    writeSave(sc, {
      hero: hero.id,
      st: st.map((s) => ({ done: s.done, resume: s.resume, prepped: s.prepped })),
      target,
      progress: progress.toJSON(),
      state,
      docs: hud.docs || [],
      acts: actsLog,
      npcs: Object.fromEntries(Object.entries(npcs).map(([id, m]) => [id, [m.position.x, m.position.z, m.userData.homeYaw, m.visible]])),
      life: life?.save(),
      eyes: eyes.save?.(),
      pos: [player.pos.x, player.pos.z, player.yaw],
    });
  }

  // «Продолжить»: возвращаем прогресс, станции, документы, мир (шлюз, телефон, NPC) и место героя.
  async function restore(s) {
    progress.load(s.progress);
    Object.assign(state, s.state || {});
    s.st.forEach((x, i) => { if (st[i]) Object.assign(st[i], x); });
    target = s.target ?? null;
    for (const name of s.acts || []) { actsLog.push(name); await doAct(name, true); }
    for (const [id, [x, z, yaw, vis]] of Object.entries(s.npcs || {})) {
      const m = npcs[id];
      if (!m) continue;
      m.position.set(x, 0, z);
      m.rotation.y = m.userData.homeYaw = yaw;
      m.visible = vis;
      blockNpc(id, false);
    }
    nav.rebuild();
    for (const card of s.docs || []) hud.showBadge(hero, card);
    life?.load(s.life);
    eyes.load?.(s.eyes);
    progress.onChange?.();
    if (s.pos && nav.canStand(s.pos[0], s.pos[1])) player.teleport(s.pos[0], s.pos[1], s.pos[2]);
  }

  function cineTo(pt) {
    const at = new THREE.Vector3(pt.at[0], 0, pt.at[1]);
    const st = new THREE.Vector3(pt.stand[0], 0, pt.stand[1]);
    if (pt.cam) {
      rig.cine(new THREE.Vector3(...pt.cam), new THREE.Vector3(...(pt.look || [pt.at[0], 1.1, pt.at[1]])));
      return;
    }
    const dir = st.clone().sub(at).setY(0);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize();
    // Камера всегда «со стороны зрителя» (+Z), чтобы не упираться в стены.
    if (dir.z < 0.3) { dir.z = 0.6; dir.normalize(); }
    const mid = at.clone().lerp(st, 0.5);
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    const from = mid.clone().addScaledVector(dir, 5.2).addScaledVector(side, 1.6).setY(4.6);
    rig.cine(from, mid.setY(0.9));
  }
}
