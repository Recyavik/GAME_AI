// Точка входа. Игра выбирается псевдонимом @game → games/<slug> (см. vite.config.js),
// поэтому в сборку попадает только одна тема со своими картинками.
// Шрифты: только кириллица и латиница (меньше вес файла).
import '@fontsource/unbounded/cyrillic-700.css';
import '@fontsource/unbounded/latin-700.css';
import '@fontsource/golos-text/cyrillic-400.css';
import '@fontsource/golos-text/latin-400.css';
import '@fontsource/golos-text/cyrillic-500.css';
import '@fontsource/golos-text/latin-500.css';
import '@fontsource/golos-text/cyrillic-600.css';
import '@fontsource/golos-text/latin-600.css';
import './styles/base.css';
import './styles/widgets.css';
import { start } from './engine/runner.js';
import scenario from '@game/scenario.js';
import world from '@game/world.js';

start(scenario, world);
