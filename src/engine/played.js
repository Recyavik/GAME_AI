// Счётчик «в игру играли» на сайте игры: игра сообщает серверу, что игрок прошёл половину станций
// и что прошёл все. Каждая отметка — один раз за прохождение (флаги лежат в сохранении).
// Открыта с диска (file://) — ничего не отправляем: игра работает без интернета и без сервера.
// Нет сервера счётчика (файл выложен на обычный хостинг) — запрос молча не проходит.

// Сколько станций выполнено и какие отметки пора отправить.
export function playedMarks(sc, st) {
  const stations = st.filter((s) => sc.stages[s.i].station);
  const done = stations.filter((s) => s.done).length;
  const marks = [];
  if (stations.length && done >= Math.ceil(stations.length / 2)) marks.push('half');
  if (stations.length && done === stations.length) marks.push('done');
  return marks;
}

export function reportPlayed(sc, mark) {
  if (!/^https?:$/.test(location.protocol)) return;
  try {
    fetch('/api/played', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: sc.meta.slug, mark }),
      keepalive: true,
    }).catch(() => { /* нет сервера счётчика */ });
  } catch { /* нет fetch */ }
}
