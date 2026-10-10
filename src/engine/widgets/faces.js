// Лица, нарисованные кодом (SVG): точные координаты нужны для станции «Лица».
// faceSvg({ hair, hairStyle, skin, glasses, sweater, w }) → строка SVG (viewBox 400×480).
// Ключевые точки лица — FACE_POINTS (в тех же координатах).

export const FACE_POINTS = [
  { id: 'eyeL', label: 'глаз слева', x: 152, y: 228 },
  { id: 'eyeR', label: 'глаз справа', x: 248, y: 228 },
  { id: 'nose', label: 'кончик носа', x: 200, y: 290 },
  { id: 'mouthL', label: 'уголок рта слева', x: 164, y: 338 },
  { id: 'mouthR', label: 'уголок рта справа', x: 236, y: 338 },
];

export function faceSvg({ hair = '#2b1b14', hairStyle = 'long', skin = '#f3c9a8', glasses = false, sweater = '#19b8b0', eyes = '#3b2a20', closed = false } = {}) {
  const back = hairStyle === 'long'
    ? `<path d="M70 230 Q60 90 200 70 Q340 90 330 230 L345 470 L55 470 Z" fill="${hair}"/>`
    : hairStyle === 'bob'
      ? `<path d="M78 240 Q70 92 200 76 Q330 92 322 240 L330 360 L70 360 Z" fill="${hair}"/>`
      : `<path d="M86 210 Q90 90 200 80 Q310 90 314 210 Z" fill="${hair}"/>`;
  const eye = (x) => closed
    ? `<path d="M${x - 20} 228 q20 10 40 0" stroke="${eyes}" stroke-width="5" fill="none" stroke-linecap="round"/>`
    : `<ellipse cx="${x}" cy="228" rx="19" ry="15" fill="#fff"/><circle cx="${x}" cy="229" r="10" fill="${eyes}"/><circle cx="${x + 4}" cy="225" r="3.5" fill="#fff"/>`;
  return `<svg viewBox="0 0 400 480" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="480" fill="#e9f4ff"/>
    ${back}
    <path d="M90 470 Q100 400 200 392 Q300 400 310 470 Z" fill="${sweater}"/>
    <rect x="178" y="350" width="44" height="50" fill="${skin}"/>
    <ellipse cx="200" cy="255" rx="118" ry="140" fill="${skin}"/>
    <path d="M84 205 Q100 95 200 92 Q300 95 316 205 Q260 140 200 150 Q140 140 84 205 Z" fill="${hair}"/>
    <path d="M128 196 q24 -12 48 0" stroke="${hair}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M224 196 q24 -12 48 0" stroke="${hair}" stroke-width="7" fill="none" stroke-linecap="round"/>
    ${eye(152)}${eye(248)}
    <path d="M200 240 Q194 270 188 286 Q200 296 212 286" stroke="#c98d6d" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="128" cy="290" rx="20" ry="12" fill="#f5a8a0" opacity=".45"/>
    <ellipse cx="272" cy="290" rx="20" ry="12" fill="#f5a8a0" opacity=".45"/>
    <path d="M164 338 Q200 362 236 338 Q200 350 164 338 Z" fill="#d9576b"/>
    ${glasses ? '<g fill="none" stroke="#2b2b3b" stroke-width="5"><circle cx="152" cy="228" r="32"/><circle cx="248" cy="228" r="32"/><path d="M184 226 h32"/></g>' : ''}
  </svg>`;
}
