// Записанные голоса темы (MP3, подготовлены из assets_1_1/voice: моно, выровнена громкость).
// В сборке встраиваются в HTML как data-URL, внешних запросов нет.
const all = import.meta.glob('./assets/voice/*.mp3', { eager: true, import: 'default' });

export const VOICE = Object.fromEntries(Object.entries(all).map(([p, url]) => [p.split('/').pop().replace('.mp3', ''), url]));
