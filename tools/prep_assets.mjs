// Подготовка ассетов темы для веба: оригиналы (assets_N/) → games/TEMA_N/assets/ в WebP.
//   node tools/prep_assets.mjs assets_1 games/TEMA_1/assets
// Оригиналы не трогаем. Картинки встраиваются в итоговый HTML (base64),
// поэтому размер важен: уменьшаем до разумного и жмём WebP.
// Записи голоса (.mp3/.wav) → MP3 моно 48 кбит/с, тишина по краям срезана, громкость выровнена
// (нужен ffmpeg в PATH). Фоновые шумы (CUTS) — вырезается ровный кусок с плавным входом и выходом.
import sharp from 'sharp';
import { readdirSync, mkdirSync, statSync } from 'node:fs';
import { join, parse } from 'node:path';
import { execFileSync } from 'node:child_process';

const [, , src, dst] = process.argv;
if (!src || !dst) {
  console.error('Использование: node tools/prep_assets.mjs <assets_N> <games/TEMA_N/assets>');
  process.exit(1);
}

// Правила по подпапкам: максимальная сторона и качество.
// portraits/owl/icons — с прозрачностью; draw/art — без.
const RULES = {
  portraits: { size: 384, quality: 82 },
  owl: { size: 448, quality: 82 },
  icons: { size: 288, quality: 82 },
  draw: { size: 900, quality: 80 },
  art: { size: 1280, quality: 80 },
  photos: { size: 512, quality: 80 },
  chat: { size: 256, quality: 82 },
  shields: { size: 256, quality: 85 },
  facts: { size: 640, quality: 78 },
  // Зарядка для глаз: БЕЗ обрезки полей — координаты глаз/зрачков и пары кадров заданы относительно всего квадратного холста.
  // Плакаты на стенах: по стене они ~1 м — 640 пикселей по длинной стороне хватает; наклейки — маленькие.
  posters: { size: 640, quality: 76, sizes: { sticker_idea: 256, sticker_owl: 256, sticker_shield: 256, sticker_star: 256 } },
  eyes: { size: 512, quality: 82, trim: false, sizes: { eyes_iris: 256, eyes_star: 256, eyes_window: 1280, eyes_palms: 1280 } },
};
const DEFAULT = { size: 768, quality: 80 };
// Шумы для «Поймай ослышку»: имя файла → [начало (с), длина (с)].
const CUTS = {
  noise_canteen: [2, 5], // разговоры в столовой
  noise_break: [4.5, 5], // перемена
};

let total = 0;
// Папки на «_» (документы, служебное) пропускаем.
for (const group of readdirSync(src, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_'))) {
  const rule = RULES[group.name] || DEFAULT;
  const outDir = join(dst, group.name);
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(join(src, group.name)).filter((n) => /\.(png|jpe?g|webp)$/i.test(n))) {
    const out = join(outDir, parse(f).name + '.webp');
    const size = rule.sizes?.[parse(f).name] || rule.size;
    let img = sharp(join(src, group.name, f)).resize(size, size, { fit: 'inside', withoutEnlargement: true });
    // Прозрачные картинки обрезаем по содержимому, чтобы не возить пустые поля.
    const meta = await sharp(join(src, group.name, f)).metadata();
    if (meta.hasAlpha && rule.trim !== false) img = sharp(await sharp(join(src, group.name, f)).trim().toBuffer()).resize(size, size, { fit: 'inside', withoutEnlargement: true });
    await img.webp({ quality: rule.quality, alphaQuality: 90, effort: 6 }).toFile(out);
    const kb = statSync(out).size / 1024;
    total += kb;
    console.log(`${group.name}/${parse(f).name}.webp  ${kb.toFixed(0)} КБ`);
  }
  for (const f of readdirSync(join(src, group.name)).filter((n) => /\.(mp3|wav)$/i.test(n))) {
    const cut = CUTS[parse(f).name];
    const out = join(outDir, parse(f).name + '.mp3');
    const af = cut
      ? `atrim=${cut[0]}:${cut[0] + cut[1]},asetpts=PTS-STARTPTS,afade=t=in:d=0.3,afade=t=out:st=${cut[1] - 0.5}:d=0.5,loudnorm=I=-18:TP=-2`
      : 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-16:TP=-1.5';
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(src, group.name, f), '-af', af, '-ac', '1', '-ar', '32000', '-b:a', '48k', out]);
    const kb = statSync(out).size / 1024;
    total += kb;
    console.log(`${group.name}/${parse(f).name}.mp3  ${kb.toFixed(0)} КБ`);
  }
}
console.log(`Итого: ${(total / 1024).toFixed(2)} МБ (в HTML base64 будет ≈ ${(total * 1.34 / 1024).toFixed(2)} МБ)`);
