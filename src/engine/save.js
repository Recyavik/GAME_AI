// Сохранение для «Продолжить» после перезагрузки страницы.
// Хранится в localStorage браузера. Это удобство, а не обязательное условие: на школьных ПК данные
// браузера могут стирать — тогда игра просто начинается сначала. Любая ошибка хранилища молча игнорируется.
const key = (sc) => 'ai-quest:' + sc.meta.slug;
// «Подпись» сценария: если этапы поменялись (новая версия игры), старое сохранение не подходит.
const sign = (sc) => sc.stages.map((s, i) => s.id || i).join(',');

export function loadSave(sc) {
  try {
    const s = JSON.parse(localStorage.getItem(key(sc)) || 'null');
    return s && s.sign === sign(sc) ? s : null;
  } catch { return null; }
}

export function writeSave(sc, data) {
  try { localStorage.setItem(key(sc), JSON.stringify({ ...data, sign: sign(sc), at: Date.now() })); } catch { /* хранилище недоступно */ }
}

export function clearSave(sc) {
  try { localStorage.removeItem(key(sc)); } catch { /* хранилище недоступно */ }
}
