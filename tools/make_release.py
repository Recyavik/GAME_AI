#!/usr/bin/env python3
"""Упаковка выпуска в releases/ai-quest-NNN.zip с НОВЫМ порядковым номером.

Использование:
    python tools/make_release.py                 # все dist/*.html + методички
    python tools/make_release.py l10-57-pass     # только указанные игры
    python tools/make_release.py --with файл.md  # добавить файл (задание, заметку) в папку «Задания/»
    python tools/make_release.py --check dist/x.html   # проверить файл на внешние ссылки

Правила выпуска:
- имя архива каждый раз новое: ai-quest-001.zip, -002, ...; старые не трогаем;
- имена файлов в zip пишутся в UTF-8 (python zipfile ставит флаг сам),
  поэтому русские названия не превращаются в «каракули»;
- после сборки архив открывается заново и сверяется с исходниками по md5.
"""
import hashlib
import re
import sys
import time
import zipfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
GAMES = ROOT / "games"
RELEASES = ROOT / "releases"
PREFIX = "ai-quest-"
FRESH_MINUTES = 30  # предупреждать, если сборка старше

EXTERNAL = re.compile(
    r"""(?:src|href)\s*=\s*["']https?://|url\(\s*["']?https?://|"""
    r"""fetch\(\s*["']https?://|import\s*\(\s*["']https?://"""
)


def md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def check_external(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    return sorted({m.group(0) for m in EXTERNAL.finditer(text)})


def next_name() -> Path:
    RELEASES.mkdir(exist_ok=True)
    nums = [int(m.group(1)) for p in RELEASES.glob(PREFIX + "*.zip")
            if (m := re.fullmatch(PREFIX + r"(\d{3,})\.zip", p.name))]
    n = max(nums, default=0) + 1
    path = RELEASES / f"{PREFIX}{n:03d}.zip"
    assert not path.exists(), f"{path.name} уже существует"
    return path


def collect(slugs: list[str]) -> list[tuple[Path, str]]:
    htmls = sorted(DIST.glob("*.html"))
    if slugs:
        htmls = [h for h in htmls if h.stem in slugs]
        missing = set(slugs) - {h.stem for h in htmls}
        if missing:
            sys.exit(f"Нет сборки для: {', '.join(sorted(missing))}. Сначала npm run build -- <slug>")
    if not htmls:
        sys.exit("В dist/ нет собранных игр. Сначала npm run build -- <slug>")
    files = []
    for h in htmls:
        files.append((h, f"{h.stem}/{h.name}"))
        teacher = GAMES / h.stem / "teacher.md"
        if teacher.exists():
            files.append((teacher, f"{h.stem}/Методичка_{h.stem}.md"))
    return files


def main() -> None:
    args = sys.argv[1:]
    if args[:1] == ["--check"]:
        bad = False
        for p in map(Path, args[1:]):
            ext = check_external(p)
            print(f"{p}: " + ("внешних ссылок нет" if not ext else "ВНЕШНИЕ ССЫЛКИ: " + ", ".join(ext)))
            bad |= bool(ext)
        sys.exit(1 if bad else 0)

    # --with файл — дополнительный файл в архив (папка «Задания/»), можно несколько раз.
    extra = []
    while "--with" in args:
        i = args.index("--with")
        extra.append(Path(args[i + 1]))
        del args[i:i + 2]
    files = collect(args)
    for e in extra:
        if not e.exists():
            sys.exit(f"Нет файла {e}")
        files.append((e, f"Задания/{e.name}"))
    now = time.time()
    problems = []
    for src, _ in files:
        if src.suffix == ".html":
            age = (now - src.stat().st_mtime) / 60
            if age > FRESH_MINUTES:
                problems.append(f"{src.name} собран {age:.0f} мин назад — пересоберите, если были правки")
            if ext := check_external(src):
                problems.append(f"{src.name}: внешние ссылки {ext}")

    out = next_name()
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    manifest = [f"Выпуск {out.name} · собран {stamp}", ""]
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for src, arc in files:
            z.write(src, arc)
            built = datetime.fromtimestamp(src.stat().st_mtime).strftime("%Y-%m-%d %H:%M")
            manifest.append(f"{arc}  ·  {src.stat().st_size // 1024} КБ  ·  {built}  ·  md5 {md5(src)[:8]}")
        z.writestr("СОСТАВ_ВЫПУСКА.txt", "\n".join(manifest) + "\n")

    # Проверка: открываем архив заново и сверяем каждый файл с исходником.
    with zipfile.ZipFile(out) as z:
        for src, arc in files:
            info = z.getinfo(arc)
            assert info.flag_bits & 0x800 or arc.isascii(), f"нет UTF-8 флага у {arc}"
            assert hashlib.md5(z.read(arc)).hexdigest() == md5(src), f"не совпадает {arc}"
        names = z.namelist()

    print("\n".join(manifest))
    print(f"\nАрхив: releases/{out.name}  ({out.stat().st_size // 1024} КБ, файлов: {len(names)})")
    print("Проверка содержимого: OK — в архиве именно эти свежие файлы.")
    if problems:
        print("\nВНИМАНИЕ:\n- " + "\n- ".join(problems))


if __name__ == "__main__":
    main()
