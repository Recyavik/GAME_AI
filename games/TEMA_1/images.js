// Картинки темы (WebP, подготовлены командой npm run assets из исходников темы).
// В сборке встраиваются в HTML как data-URL, внешних запросов нет.
const all = import.meta.glob('./assets/**/*.webp', { eager: true, import: 'default' });

// group('owl') → { happy: url, normal: url, … } (префиксы owl_/icon_/draw_/art_/fact_/shield_/photo_ убираются)
function group(dir) {
  const out = {};
  for (const [path, url] of Object.entries(all)) {
    if (!path.startsWith(`./assets/${dir}/`)) continue;
    const name = path.split('/').pop().replace('.webp', '').replace(/^(owl|icon|draw|art|fact|shield|photo|eyes)_/, '');
    out[name] = url;
  }
  return out;
}

const draw = group('draw');

export const IMG = {
  portraits: group('portraits'),
  owl: group('owl'),
  icons: group('icons'),
  draw,
  art: group('art'),
  photos: group('photos'),
  chat: group('chat'),
  shields: group('shields'),
  facts: group('facts'),
  eyes: group('eyes'),
  posters: group('posters'), // плакаты об ИИ на стенах (poster_*, sticker_*)
  // Для «ИИ-художника»: ключ «кто_где» → картинка.
  drawMap: Object.fromEntries(Object.entries(draw).filter(([k]) => /^(cat|fox|owl)_/.test(k))),
};
