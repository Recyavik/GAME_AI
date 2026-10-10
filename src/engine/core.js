// Ядро: рендерер, сцена, свет с тенью, цикл кадра, ресайз.
import * as THREE from 'three';

const THEMES = {
  light: { sky: 0xf4ead9, fog: 0xf4ead9, hemiTop: 0xfff8ee, hemiBottom: 0xb8a68c, sun: 0xfff1dc },
  dark: { sky: 0x0b1020, fog: 0x0b1020, hemiTop: 0xdfe6ff, hemiBottom: 0x2a3150, sun: 0xffffff },
};

export function createCore(themeName = 'light') {
  const theme = THEMES[themeName] || THEMES.light;
  const canvas = document.getElementById('c');
  // Сглаживание нужно только на обычных экранах; на экранах с высокой плотностью точек оно лишняя нагрузка.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 1.25, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.sky);
  scene.fog = new THREE.Fog(theme.fog, 28, 70);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

  scene.add(new THREE.HemisphereLight(theme.hemiTop, theme.hemiBottom, 1.9));
  // Солнце: одна тень, ездит за игроком (см. followShadow).
  const sun = new THREE.DirectionalLight(theme.sun, 1.6);
  sun.position.set(-6, 14, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  const sc = sun.shadow.camera;
  sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 50;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const updaters = [];
  const onFrame = (fn) => updaters.push(fn);

  function followShadow(x, z) {
    // Шаг по сетке, чтобы тени не «дрожали».
    const sx = Math.round(x / 2) * 2;
    const sz = Math.round(z / 2) * 2;
    sun.position.set(sx - 6, 14, sz + 8);
    sun.target.position.set(sx, 0, sz);
  }

  function resize() {
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    // Не больше ~2560 точек по ширине кадра: на больших экранах и интерактивных досках иначе
    // видеокарта рисует огромную картинку и может не справиться.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5, 2560 / Math.max(1, w)));
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // Пауза отрисовки: пока открыто окно станции, сцена за ним стоит на месте —
  // видеокарта отдыхает (на слабых и очень больших экранах иначе браузер может «уронить» вкладку).
  let paused = () => false;
  const setPause = (fn) => { paused = fn; };

  // Если видеокарта сбросила 3D-контекст — не даём браузеру перезапускать страницу, ждём восстановления.
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); }, false);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (paused()) return;
    const t = clock.elapsedTime;
    for (const fn of updaters) fn(dt, t);
    renderer.render(scene, camera);
  });

  return { THREE, renderer, scene, camera, sun, theme, onFrame, followShadow, canvas, setPause };
}
