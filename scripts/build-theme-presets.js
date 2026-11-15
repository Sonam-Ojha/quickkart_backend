/**
 * Builds the festival theme art packs served at /theme-presets/… :
 *   public/theme-presets/<festival>/{header,decoration,page,section,banner}.webp + animation.json
 *   public/theme-presets/icons/<name>.webp   (tile icons shared by all festivals)
 *
 * Everything is drawn as SVG here and rasterised with sharp, so the packs can
 * be regenerated / tweaked without any design tool:
 *   node scripts/build-theme-presets.js
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../public/theme-presets');
let seed = 1;
const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
const pick = (a) => a[Math.floor(rnd() * a.length)];

const svg = (w, h, body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;
const save = async (file, w, h, body, defs, quality = 90) => {
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(svg(w, h, body, defs))).webp({ quality, alphaQuality: 100 }).toFile(file);
};

// ── Shared drawing pieces ──────────────────────────────────────

const glow = (id, color, op = 0.5) =>
  `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

const rangoli = (cx, cy, r, col, op) => {
  let g = `<g transform="translate(${cx} ${cy})" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="${Math.max(1.6, r / 38)}">`;
  g += `<circle r="${r * 0.16}"/><circle r="${r * 0.3}" stroke-dasharray="${r / 18} ${r / 24}"/>`;
  for (let i = 0; i < 12; i++) g += `<ellipse cy="${-r * 0.55}" rx="${r * 0.1}" ry="${r * 0.21}" transform="rotate(${i * 30})"/>`;
  for (let i = 0; i < 12; i++) g += `<path d="M0 ${-r * 0.78} l${r * 0.06} ${r * 0.09} l${-r * 0.06} ${r * 0.09} l${-r * 0.06} ${-r * 0.09}z" transform="rotate(${i * 30 + 15})"/>`;
  for (let i = 0; i < 24; i++) g += `<circle cy="${-r * 0.93}" r="${r * 0.028}" fill="${col}" fill-opacity="${op}" stroke="none" transform="rotate(${i * 15})"/>`;
  return g + '</g>';
};

// Diya: clay lamp with a glowing flame
const diya = (x, y, s = 1, flameGlow = true) => `<g transform="translate(${x} ${y}) scale(${s})">
  ${flameGlow ? `<circle cy="-34" r="34" fill="url(#flameGlow)"/>` : ''}
  <path d="M0 -58 C9 -44 9 -34 0 -28 C-9 -34 -9 -44 0 -58Z" fill="#FDE047"/>
  <path d="M0 -50 C4 -42 4 -36 0 -32 C-4 -36 -4 -42 0 -50Z" fill="#FFFFFF" fill-opacity="0.85"/>
  <path d="M-42 -24 Q0 26 42 -24 Q30 -14 0 -14 Q-30 -14 -42 -24Z" fill="#B45309"/>
  <path d="M-42 -24 Q0 -10 42 -24 Q30 -30 0 -30 Q-30 -30 -42 -24Z" fill="#D97706"/>
  <path d="M-30 -12 Q0 14 30 -12" fill="none" stroke="#FBBF24" stroke-width="3"/>
  <circle cx="-14" cy="-4" r="2.6" fill="#FDE68A"/><circle cx="0" cy="0" r="2.6" fill="#FDE68A"/><circle cx="14" cy="-4" r="2.6" fill="#FDE68A"/></g>`;

// Kandil: hanging star lantern
const kandil = (x, y, s, c1, c2, len = 60) => `<g transform="translate(${x} ${y})">
  <line x1="0" y1="${-len}" x2="0" y2="0" stroke="#FCD34D" stroke-width="2" stroke-opacity="0.8"/>
  <g transform="scale(${s})">
    <circle cy="40" r="46" fill="url(#lampGlow)"/>
    <path d="M0 0 L22 18 L34 40 L22 62 L0 80 L-22 62 L-34 40 L-22 18Z" fill="${c1}"/>
    <path d="M0 0 L22 18 L0 40 L-22 18Z" fill="${c2}"/><path d="M0 80 L22 62 L0 40 L-22 62Z" fill="${c2}"/>
    <circle cy="40" r="9" fill="#FEF3C7"/>
    ${[-16, -8, 0, 8, 16].map(dx => `<line x1="${dx}" y1="80" x2="${dx * 1.1}" y2="${104 + Math.abs(dx) * -0.6}" stroke="${c1}" stroke-width="2.4"/>`).join('')}
  </g></g>`;

const star5 = (x, y, r, fill, op = 1) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
    d += `${i ? 'L' : 'M'}${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`;
  }
  return `<path d="${d}Z" fill="${fill}" fill-opacity="${op}"/>`;
};
const flake = (x, y, r, col, op) => `<g transform="translate(${x} ${y})" stroke="${col}" stroke-opacity="${op}" stroke-width="${Math.max(1.4, r / 6)}" stroke-linecap="round">
  ${[0, 60, 120].map(a => `<g transform="rotate(${a})"><line x1="${-r}" x2="${r}"/><line x1="${r * 0.55}" y1="0" x2="${r * 0.8}" y2="${-r * 0.22}"/><line x1="${r * 0.55}" y1="0" x2="${r * 0.8}" y2="${r * 0.22}"/><line x1="${-r * 0.55}" y1="0" x2="${-r * 0.8}" y2="${-r * 0.22}"/><line x1="${-r * 0.55}" y1="0" x2="${-r * 0.8}" y2="${r * 0.22}"/></g>`).join('')}</g>`;
const burstArt = (x, y, r, col, op = 0.9) => {
  let g = `<g transform="translate(${x} ${y})" stroke="${col}" stroke-opacity="${op}" stroke-width="3" stroke-linecap="round">`;
  for (let i = 0; i < 16; i++) g += `<line y1="${-r * 0.35}" y2="${-r}" transform="rotate(${i * 22.5})"/>`;
  for (let i = 0; i < 16; i++) g += `<circle cy="${-r * 1.12}" r="3" fill="${col}" stroke="none" transform="rotate(${i * 22.5 + 11})"/>`;
  return g + '</g>';
};
// Soft powder splash: smooth closed curve through jittered points + splatter.
const blob = (x, y, r, col, op) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, rr = r * (0.78 + rnd() * 0.32);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = `M${mid(pts[9], pts[0]).map(v => v.toFixed(1)).join(' ')}`;
  for (let i = 0; i < 10; i++) {
    const p = pts[i], m = mid(p, pts[(i + 1) % 10]);
    d += ` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  let g = `<path d="${d}Z" fill="${col}" fill-opacity="${op}"/>`;
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, dist = r * (1.05 + rnd() * 0.5);
    g += `<circle cx="${(x + Math.cos(a) * dist).toFixed(1)}" cy="${(y + Math.sin(a) * dist).toFixed(1)}" r="${(2 + rnd() * r * 0.07).toFixed(1)}" fill="${col}" fill-opacity="${op}"/>`;
  }
  return g;
};
const crescent = (x, y, r, col, bg) => `<g transform="translate(${x} ${y})"><circle r="${r}" fill="${col}"/><circle cx="${r * 0.38}" cy="${-r * 0.18}" r="${r * 0.86}" fill="${bg}"/></g>`;
const fanoos = (x, y, s, col, len = 50) => `<g transform="translate(${x} ${y})">
  <line y1="${-len}" y2="0" stroke="#FCD34D" stroke-width="2"/>
  <g transform="scale(${s})"><circle cy="44" r="44" fill="url(#lampGlow)"/>
  <path d="M-10 0 h20 l6 12 h-32z" fill="#CA8A04"/><path d="M-22 12 h44 l-6 58 h-32z" fill="${col}"/>
  <path d="M-14 20 h28 l-4 42 h-20z" fill="#FEF3C7" fill-opacity="0.85"/><path d="M-16 70 h32 l-8 12 h-16z" fill="#CA8A04"/></g></g>`;
const tree = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M0 -120 L50 -40 H25 L65 30 H-65 L-25 -40 H-50Z" fill="#15803D"/><rect x="-10" y="30" width="20" height="24" fill="#92400E"/>
  ${star5(0, -124, 16, '#FACC15')}${[[-20, -50, '#DC2626'], [18, -30, '#FACC15'], [-35, 10, '#FACC15'], [30, 15, '#DC2626'], [0, -10, '#60A5FA']].map(([cx, cy, c]) => `<circle cx="${cx}" cy="${cy}" r="7" fill="${c}"/>`).join('')}</g>`;

// ── Tile icons (shared) ────────────────────────────────────────
const ICON = 360;
const iconBg = (c1, c2) => `<rect width="${ICON}" height="${ICON}" rx="80" fill="url(#ibg)"/>` + '';
const icons = {
  diya: { bg: ['#FEF3C7', '#FDE68A'], art: `<g transform="translate(180 250) scale(2.4)">${diya(0, 0, 1)}</g>` },
  lights: { bg: ['#EDE9FE', '#DDD6FE'], art: (() => {
    let g = '<path d="M30 110 Q180 200 330 110" fill="none" stroke="#334155" stroke-width="5"/><path d="M30 200 Q180 290 330 200" fill="none" stroke="#334155" stroke-width="5"/>';
    const cols = ['#F59E0B', '#EF4444', '#22C55E', '#3B82F6', '#EC4899'];
    for (const [yy, dy] of [[110, 90], [200, 90]]) for (let i = 1; i < 8; i++) {
      const t = i / 8, x = 30 + 300 * t, y = yy + 4 * dy * t * (1 - t) + 14, c = cols[(i + yy) % 5];
      g += `<circle cx="${x}" cy="${y + 14}" r="26" fill="${c}" fill-opacity="0.25"/><rect x="${x - 6}" y="${y - 6}" width="12" height="10" fill="#475569"/><ellipse cx="${x}" cy="${y + 14}" rx="11" ry="15" fill="${c}"/>`;
    }
    return g;
  })() },
  rangoli: { bg: ['#FCE7F3', '#FBCFE8'], art: `${rangoli(180, 180, 140, '#DB2777', 0.9)}<circle cx="180" cy="180" r="22" fill="#F59E0B"/>${[0, 90, 180, 270].map(a => `<ellipse cx="180" cy="95" rx="18" ry="34" fill="#7C3AED" transform="rotate(${a} 180 180)"/>`).join('')}` },
  sweets: { bg: ['#FFEDD5', '#FED7AA'], art: `<rect x="70" y="170" width="220" height="110" rx="14" fill="#DC2626"/><rect x="70" y="160" width="220" height="30" rx="10" fill="#B91C1C"/><path d="M80 175 h200" stroke="#FACC15" stroke-width="5"/>
    ${[[120, 140], [180, 128], [240, 140], [150, 98], [210, 98]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="34" fill="#F59E0B"/><circle cx="${x - 10}" cy="${y - 10}" r="9" fill="#FDE68A"/>${[0, 1, 2, 3, 4].map(k => `<circle cx="${x - 16 + k * 8}" cy="${y + 8 - (k % 2) * 10}" r="3" fill="#B45309"/>`).join('')}`).join('')}` },
  gift: { bg: ['#DCFCE7', '#BBF7D0'], art: `<rect x="80" y="160" width="200" height="130" rx="12" fill="#7C3AED"/><rect x="66" y="128" width="228" height="46" rx="10" fill="#8B5CF6"/>
    <rect x="166" y="128" width="28" height="162" fill="#FACC15"/><path d="M180 128 C140 70 90 90 120 128Z" fill="#FACC15"/><path d="M180 128 C220 70 270 90 240 128Z" fill="#FACC15"/>` },
  pooja: { bg: ['#FEF9C3', '#FEF08A'], art: `<ellipse cx="180" cy="230" rx="140" ry="44" fill="#CA8A04"/><ellipse cx="180" cy="220" rx="128" ry="36" fill="#FACC15"/>
    <g transform="translate(180 222) scale(1.1)">${diya(0, 0, 1, false)}</g><circle cx="95" cy="214" r="18" fill="#DC2626"/><circle cx="265" cy="214" r="18" fill="#F97316"/>
    ${[0, 1, 2, 3, 4, 5].map(i => `<circle cx="${120 + i * 24}" cy="250" r="8" fill="#F59E0B"/>`).join('')}` },
  colors: { bg: ['#FCE7F3', '#F5D0FE'], art: [[110, 150, '#EC4899'], [250, 150, '#22C55E'], [110, 260, '#F59E0B'], [250, 260, '#3B82F6']].map(([x, y, c]) =>
    `<ellipse cx="${x}" cy="${y + 26}" rx="58" ry="18" fill="#000" fill-opacity="0.08"/><path d="M${x - 58} ${y} Q${x} ${y + 70} ${x + 58} ${y}Z" fill="#E5E7EB"/><ellipse cx="${x}" cy="${y}" rx="58" ry="16" fill="${c}"/><path d="M${x - 40} ${y - 4} Q${x} ${y - 52} ${x + 40} ${y - 4}Z" fill="${c}"/>`).join('') },
  pichkari: { bg: ['#E0F2FE', '#BAE6FD'], art: `<rect x="70" y="150" width="180" height="56" rx="20" fill="#F97316"/><rect x="250" y="168" width="70" height="20" rx="8" fill="#FACC15"/><rect x="30" y="160" width="46" height="36" rx="8" fill="#16A34A"/>
    <rect x="16" y="140" width="16" height="76" rx="6" fill="#15803D"/>${[0, 1, 2, 3, 4, 5].map(i => `<circle cx="${330 + (i % 2) * 8}" cy="${178 - 40 + i * 16}" r="${6 - Math.abs(i - 2.5)}" fill="#EC4899"/>`).join('')}` },
  balloons: { bg: ['#EDE9FE', '#E0E7FF'], art: [[120, 140, '#EF4444'], [190, 110, '#8B5CF6'], [255, 150, '#F59E0B']].map(([x, y, c]) =>
    `<path d="M${x} ${y + 62} Q${x - 10} ${y + 120} ${180} 320" fill="none" stroke="#475569" stroke-width="3"/><ellipse cx="${x}" cy="${y}" rx="48" ry="60" fill="${c}"/><ellipse cx="${x - 16}" cy="${y - 20}" rx="10" ry="16" fill="#fff" fill-opacity="0.5"/><path d="M${x - 8} ${y + 64} h16 l-8 -10z" fill="${c}"/>`).join('') },
  cake: { bg: ['#FCE7F3', '#FBCFE8'], art: `<rect x="80" y="170" width="200" height="110" rx="16" fill="#92400E"/><rect x="80" y="170" width="200" height="34" rx="16" fill="#FDF2F8"/>
    <path d="M80 200 q20 20 40 0 q20 20 40 0 q20 20 40 0 q20 20 40 0 q20 20 40 0" fill="#FDF2F8"/><rect x="60" y="275" width="240" height="18" rx="9" fill="#E5E7EB"/>
    ${[130, 180, 230].map(x => `<rect x="${x - 6}" y="120" width="12" height="50" rx="4" fill="#60A5FA"/><path d="M${x} 96 c8 10 8 18 0 24 c-8 -6 -8 -14 0 -24z" fill="#F59E0B"/>`).join('')}<circle cx="180" cy="186" r="12" fill="#DC2626"/>` },
  drinks: { bg: ['#ECFEFF', '#CFFAFE'], art: `<path d="M90 110 h80 l-12 170 h-56z" fill="#FDE68A" fill-opacity="0.9"/><path d="M190 110 h80 l-12 170 h-56z" fill="#F472B6" fill-opacity="0.85"/>
    <path d="M90 110 h80 M190 110 h80" stroke="#94A3B8" stroke-width="4"/><circle cx="252" cy="104" r="22" fill="#84CC16"/><line x1="140" y1="70" x2="128" y2="200" stroke="#EF4444" stroke-width="7"/>` },
  snacks: { bg: ['#FEF3C7', '#FDE68A'], art: `<path d="M100 80 h160 l-14 30 l14 30 v120 l-14 20 l14 20 h-160 l14 -20 l-14 -20 v-120 l14 -30z" fill="#DC2626"/><circle cx="180" cy="180" r="50" fill="#FACC15"/>
    <path d="M150 180 q30 -40 60 0 q-30 40 -60 0z" fill="#F59E0B"/><rect x="120" y="96" width="120" height="22" rx="6" fill="#FEF3C7"/>` },
  tree: { bg: ['#DCFCE7', '#BBF7D0'], art: `<g transform="translate(180 250) scale(1.45)">${tree(0, 0, 1)}</g>` },
  ornament: { bg: ['#FEE2E2', '#FECACA'], art: `<line x1="180" y1="40" x2="180" y2="110" stroke="#94A3B8" stroke-width="4"/><rect x="160" y="100" width="40" height="26" rx="6" fill="#FACC15"/>
    <circle cx="180" cy="210" r="92" fill="#DC2626"/><path d="M92 190 Q180 230 268 190" fill="none" stroke="#FACC15" stroke-width="10"/><path d="M98 236 Q180 270 262 236" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-dasharray="12 10"/><ellipse cx="146" cy="166" rx="16" ry="24" fill="#fff" fill-opacity="0.45"/>` },
  flag: { bg: ['#FFF7ED', '#FFEDD5'], art: `<rect x="78" y="60" width="10" height="250" rx="5" fill="#64748B"/><path d="M88 70 h200 v50 h-200z" fill="#FF9933"/><path d="M88 120 h200 v50 h-200z" fill="#FFFFFF" stroke="#E5E7EB"/><path d="M88 170 h200 v50 h-200z" fill="#138808"/>
    <circle cx="188" cy="145" r="18" fill="none" stroke="#000080" stroke-width="3"/>${[...Array(12)].map((_, i) => `<line x1="188" y1="145" x2="188" y2="128" stroke="#000080" stroke-width="1.5" transform="rotate(${i * 30} 188 145)"/>`).join('')}` },
  dates: { bg: ['#FEF3C7', '#FDE68A'], art: `<ellipse cx="180" cy="250" rx="130" ry="40" fill="#A16207"/><path d="M50 240 Q180 330 310 240" fill="#CA8A04"/>
    ${[[120, 220], [170, 205], [220, 215], [145, 240], [200, 238], [255, 232]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="30" ry="16" fill="${i % 2 ? '#7C2D12' : '#92400E'}" transform="rotate(${-20 + i * 9} ${x} ${y})"/>`).join('')}` },
  sewaiyan: { bg: ['#FFFBEB', '#FEF3C7'], art: `<path d="M60 170 Q180 320 300 170Z" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="4"/><ellipse cx="180" cy="170" rx="120" ry="26" fill="#FDE68A"/>
    ${[...Array(14)].map((_, i) => `<path d="M${90 + i * 13} 162 q8 12 16 0" fill="none" stroke="#D97706" stroke-width="3"/>`).join('')}${[[150, 160], [200, 158], [175, 150]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="5" fill="#16A34A"/>`).join('')}` },
  lantern: { bg: ['#ECFDF5', '#D1FAE5'], art: `<g transform="translate(180 90) scale(2.2)">${fanoos(0, 0, 1, '#047857', 20)}</g>` },
  moon: { bg: ['#1E1B4B', '#312E81'], art: `<circle cx="170" cy="170" r="100" fill="#FDE68A"/><circle cx="210" cy="150" r="88" fill="#312E81"/>${star5(250, 230, 22, '#FDE68A')}${star5(110, 90, 12, '#FDE68A')}` },
  dandiya: { bg: ['#FFE4E6', '#FECDD3'], art: `<g transform="rotate(-30 180 180)"><rect x="168" y="40" width="24" height="280" rx="12" fill="#DC2626"/>${[70, 120, 170, 220, 270].map(y => `<rect x="166" y="${y}" width="28" height="10" fill="#FACC15"/>`).join('')}</g>
    <g transform="rotate(30 180 180)"><rect x="168" y="40" width="24" height="280" rx="12" fill="#16A34A"/>${[70, 120, 170, 220, 270].map(y => `<rect x="166" y="${y}" width="28" height="10" fill="#FACC15"/>`).join('')}</g>` },
  marigold: { bg: ['#FFEDD5', '#FED7AA'], art: [[130, 150], [230, 150], [180, 230]].map(([x, y]) =>
    `<g transform="translate(${x} ${y})">${[...Array(16)].map((_, i) => `<ellipse cy="-36" rx="16" ry="26" fill="${i % 2 ? '#F59E0B' : '#EA580C'}" transform="rotate(${i * 22.5})"/>`).join('')}<circle r="22" fill="#FACC15"/></g>`).join('') },
  fruits: { bg: ['#DCFCE7', '#BBF7D0'], art: `<circle cx="140" cy="200" r="70" fill="#EF4444"/><path d="M140 130 q10 -30 34 -36" stroke="#78350F" stroke-width="7" fill="none"/><ellipse cx="180" cy="104" rx="26" ry="12" fill="#22C55E" transform="rotate(-20 180 104)"/>
    <circle cx="240" cy="230" r="58" fill="#F97316"/><circle cx="222" cy="214" r="10" fill="#FDBA74"/>` },
  sparkles: { bg: ['#1E1B4B', '#312E81'], art: `${burstArt(130, 140, 70, '#FACC15')}${burstArt(240, 220, 56, '#F472B6')}${star5(260, 100, 18, '#fff')}${star5(100, 270, 12, '#fff')}` },
};

const ICON_DEFS = (bg) => `<linearGradient id="ibg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient>
  ${glow('flameGlow', '#FBBF24', 0.6)}${glow('lampGlow', '#FDE68A', 0.45)}`;

// ── Festivals ──────────────────────────────────────────────────
// Each: palette + header art + decoration + page pattern + section banner + Lottie.

const confettiLayer = (cols, W, H) => {
  let g = '';
  for (let i = 0; i < 70; i++) g += `<rect x="${rnd() * W}" y="${rnd() * H}" width="${6 + rnd() * 8}" height="${3 + rnd() * 4}" rx="1.5" fill="${pick(cols)}" fill-opacity="${(0.35 + rnd() * 0.45).toFixed(2)}" transform="rotate(${rnd() * 180} ${rnd() * W} ${rnd() * H})"/>`;
  return g;
};
const dots = (n, W, H, col, rMax = 2.5, op = [0.25, 0.6]) => {
  let g = '';
  for (let i = 0; i < n; i++) g += `<circle cx="${rnd() * W}" cy="${rnd() * H}" r="${1 + rnd() * rMax}" fill="${col}" fill-opacity="${(op[0] + rnd() * (op[1] - op[0])).toFixed(2)}"/>`;
  return g;
};

const FESTIVALS = {
  diwali: {
    bg: ['#4A1405', '#7C2D12'], tint: '#FEF3C7', motif: '#D97706',
    header: (W, H) => `${rangoli(W * 0.5, H * 0.1, 120, '#FCD34D', 0.13)}${rangoli(W * 0.12, H * 0.95, 170, '#FCD34D', 0.12)}
      <rect width="${W}" height="${H}" fill="url(#hglow)"/>${dots(70, W, H, '#FDE68A')}
      ${kandil(W * 0.74, 70, 1.15, '#EA580C', '#FACC15', 70)}${kandil(W * 0.86, 40, 0.85, '#DB2777', '#FDE68A', 40)}${kandil(W * 0.95, 90, 1.0, '#7C3AED', '#FACC15', 90)}
      ${diya(W * 0.7, H * 0.93, 1.15)}${diya(W * 0.8, H * 0.96, 1.35)}${diya(W * 0.91, H * 0.93, 1.15)}`,
    glow: ['#FBBF24', 0.4, 0.82, 0.5],
    deco: (W) => {
      let d = `<rect width="${W}" height="10" fill="#B45309"/>`;
      for (let x = 10; x < W; x += 22) d += `<circle cx="${x}" cy="14" r="11" fill="url(#mg)"/>`;
      for (let x = 32; x < W; x += 66) d += `<path d="M${x} 20 q-9 18 0 34 q9 -16 0 -34z" fill="#15803D"/>`;
      for (let k = 0; k < 9; k++) {
        const x = 66 + k * 133, len = 46 + (k % 2) * 34;
        for (let y = 30; y < len; y += 15) d += `<circle cx="${x}" cy="${y}" r="7.5" fill="url(#mg)"/>`;
        d += `<path d="M${x} ${len + 2} l-8 0 l8 22 l8 -22z" fill="#FACC15"/><circle cx="${x}" cy="${len + 26}" r="5" fill="#B45309"/>`;
      }
      return d;
    },
    pattern: (W, H) => { let p = ''; for (let i = 0; i < 9; i++) p += rangoli(rnd() * W, rnd() * H, 50 + rnd() * 70, '#D97706', 0.15); return p + dots(50, W, H, '#F59E0B', 2, [0.15, 0.3]); },
    banner: (W, H) => `${diya(W * 0.62, H * 0.86, 2.2)}${diya(W * 0.8, H * 0.9, 2.6)}${diya(W * 0.95, H * 0.86, 2.0)}
      ${kandil(W * 0.72, 30, 1.1, '#EA580C', '#FACC15', 30)}${kandil(W * 0.9, 10, 0.9, '#DB2777', '#FDE68A', 10)}${rangoli(W * 0.84, H * 0.5, 150, '#D97706', 0.18)}`,
    bannerBg: ['#FFEDD5', '#FED7AA'], anim: 'sparks',
  },
  holi: {
    bg: ['#831843', '#BE185D'], tint: '#FCE7F3', motif: '#DB2777',
    header: (W, H) => `${[['#F59E0B', 0.55], ['#22C55E', 0.5], ['#3B82F6', 0.5], ['#A855F7', 0.5], ['#FACC15', 0.55], ['#06B6D4', 0.45]].map(([c, o], i) =>
      blob(W * (0.58 + (i % 3) * 0.15), H * (0.28 + Math.floor(i / 3) * 0.46), 62 + rnd() * 26, c, Math.min(0.92, o + 0.35))).join('')}${dots(180, W, H, '#FFFFFF', 3, [0.15, 0.5])}`,
    glow: ['#F472B6', 0.25, 0.8, 0.5],
    deco: (W) => {
      let d = `<path d="M0 8 Q${W / 2} 40 ${W} 8" fill="none" stroke="#475569" stroke-width="3"/>`;
      const cols = ['#EC4899', '#F59E0B', '#22C55E', '#3B82F6', '#A855F7', '#FACC15'];
      for (let i = 0; i < 22; i++) { const x = 20 + i * (W - 40) / 21, t = x / W, y = 8 + 4 * 32 * t * (1 - t); d += `<path d="M${x - 18} ${y} h36 l-18 40z" fill="${cols[i % 6]}"/>`; }
      return d;
    },
    pattern: (W, H) => { let p = ''; for (let i = 0; i < 26; i++) p += blob(rnd() * W, rnd() * H, 20 + rnd() * 40, pick(['#F472B6', '#FBBF24', '#4ADE80', '#60A5FA', '#C084FC']), 0.16); return p; },
    banner: (W, H) => `${[['#EC4899', 0.75], ['#F59E0B', 0.75], ['#22C55E', 0.7], ['#3B82F6', 0.7]].map(([c, o], i) => blob(W * (0.62 + i * 0.1), H * (0.35 + (i % 2) * 0.3), 80, c, o)).join('')}${dots(80, W, H, '#FFFFFF', 4, [0.3, 0.7])}`,
    bannerBg: ['#FCE7F3', '#FBCFE8'], anim: 'powder',
  },
  newyear: {
    bg: ['#0B0A2E', '#1E1B4B'], tint: '#EDE9FE', motif: '#7C3AED',
    header: (W, H) => `${burstArt(W * 0.72, H * 0.35, 80, '#FACC15', 0.85)}${burstArt(W * 0.9, H * 0.55, 60, '#F472B6', 0.85)}${burstArt(W * 0.55, H * 0.2, 46, '#60A5FA', 0.7)}
      ${confettiLayer(['#FACC15', '#F472B6', '#60A5FA', '#34D399', '#FFFFFF'], W, H)}${dots(60, W, H, '#FFFFFF', 2, [0.3, 0.8])}`,
    glow: ['#8B5CF6', 0.35, 0.8, 0.45],
    deco: (W) => {
      let d = '';
      for (let i = 0; i < 12; i++) { const x = 40 + i * (W - 80) / 11, len = 30 + (i % 3) * 30; d += `<line x1="${x}" y1="0" x2="${x}" y2="${len}" stroke="#E2E8F0" stroke-width="2"/>${star5(x, len + 14, 16, i % 2 ? '#FACC15' : '#E5E7EB')}`; }
      for (let i = 0; i < 6; i++) { const x = 90 + i * 200; d += `<path d="M${x} 0 q20 30 0 60 q-20 30 0 60" fill="none" stroke="${pick(['#F472B6', '#60A5FA', '#FACC15'])}" stroke-width="6"/>`; }
      return d;
    },
    pattern: (W, H) => confettiLayer(['#A78BFA', '#F9A8D4', '#FCD34D', '#93C5FD'], W, H).replace(/fill-opacity="[\d.]+"/g, 'fill-opacity="0.28"'),
    banner: (W, H) => `${burstArt(W * 0.7, H * 0.4, 90, '#7C3AED', 0.8)}${burstArt(W * 0.9, H * 0.6, 70, '#DB2777', 0.8)}${confettiLayer(['#7C3AED', '#DB2777', '#F59E0B', '#2563EB'], W, H)}`,
    bannerBg: ['#EDE9FE', '#DDD6FE'], anim: 'fireworks',
  },
  christmas: {
    bg: ['#052E16', '#14532D'], tint: '#DCFCE7', motif: '#16A34A',
    header: (W, H) => `${[...Array(60)].map(() => flake(rnd() * W, rnd() * H, 6 + rnd() * 12, '#FFFFFF', (0.1 + rnd() * 0.2).toFixed(2))).join('')}
      ${tree(W * 0.82, H * 0.86, 1.25)}${tree(W * 0.94, H * 0.9, 0.85)}${star5(W * 0.6, H * 0.2, 10, '#FDE68A', 0.8)}${dots(40, W, H, '#FFFFFF', 2, [0.3, 0.7])}`,
    glow: ['#FDE68A', 0.25, 0.85, 0.3],
    deco: (W) => {
      let d = '';
      const sw = W / 5, cols = ['#DC2626', '#F59E0B', '#FFFFFF', '#FACC15'];
      for (let k = 0; k < 5; k++) {
        const x0 = k * sw, x1 = x0 + sw, mid = x0 + sw / 2;
        d += `<path d="M${x0} 6 Q${mid} 70 ${x1} 6" fill="none" stroke="#14532D" stroke-width="14" stroke-linecap="round"/>`;
        for (let j = 1; j < 8; j++) { const t = j / 8, x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * mid + t * t * x1, y = 2 * (1 - t) * t * 64 + 6; d += `<circle cx="${x}" cy="${y + 7}" r="5" fill="${cols[(j + k) % 4]}"/>`; }
        if (k < 4) d += `<line x1="${x1}" y1="6" x2="${x1}" y2="${40 + (k % 2) * 30}" stroke="#FDE68A" stroke-width="2"/><circle cx="${x1}" cy="${58 + (k % 2) * 30}" r="20" fill="${k % 2 ? '#DC2626' : '#F59E0B'}"/>`;
      }
      return d;
    },
    pattern: (W, H) => [...Array(40)].map(() => flake(rnd() * W, rnd() * H, 8 + rnd() * 14, '#22C55E', 0.18)).join(''),
    banner: (W, H) => `${tree(W * 0.72, H * 0.92, 1.5)}${tree(W * 0.9, H * 0.95, 1.1)}${[...Array(25)].map(() => flake(W * 0.5 + rnd() * W * 0.5, rnd() * H, 6 + rnd() * 8, '#16A34A', 0.3)).join('')}`,
    bannerBg: ['#DCFCE7', '#BBF7D0'], anim: 'snow',
  },
  independence: {
    bg: ['#C2410C', '#EA580C'], tint: '#FFEDD5', motif: '#EA580C',
    header: (W, H) => `<path d="M${W * 0.45} ${H} C${W * 0.6} ${H * 0.55} ${W * 0.8} ${H * 0.75} ${W} ${H * 0.3} V${H} Z" fill="#FFFFFF" fill-opacity="0.95"/>
      <path d="M${W * 0.55} ${H} C${W * 0.7} ${H * 0.75} ${W * 0.85} ${H * 0.9} ${W} ${H * 0.6} V${H} Z" fill="#138808"/>
      <g transform="translate(${W * 0.86} ${H * 0.62})"><circle r="40" fill="none" stroke="#000080" stroke-width="5" stroke-opacity="0.85"/>${[...Array(24)].map((_, i) => `<line y2="-38" stroke="#000080" stroke-width="2" stroke-opacity="0.85" transform="rotate(${i * 15})"/>`).join('')}</g>${dots(50, W * 0.6, H, '#FFFFFF', 2.5, [0.2, 0.5])}`,
    glow: ['#FFFFFF', 0.2, 0.3, 0.3],
    deco: (W) => { let d = `<path d="M0 6 Q${W / 2} 36 ${W} 6" fill="none" stroke="#475569" stroke-width="3"/>`; const c = ['#FF9933', '#FFFFFF', '#138808']; for (let i = 0; i < 24; i++) { const x = 20 + i * (W - 40) / 23, t = x / W, y = 6 + 4 * 30 * t * (1 - t); d += `<path d="M${x - 16} ${y} h32 l-16 36z" fill="${c[i % 3]}" stroke="#E5E7EB" stroke-width="1"/>`; } return d; },
    pattern: (W, H) => { let p = ''; for (let i = 0; i < 40; i++) p += `<ellipse cx="${rnd() * W}" cy="${rnd() * H}" rx="10" ry="5" fill="${pick(['#FF9933', '#138808'])}" fill-opacity="0.18" transform="rotate(${rnd() * 180})"/>`; return p; },
    banner: (W, H) => `<path d="M${W * 0.5} ${H} C${W * 0.65} ${H * 0.4} ${W * 0.8} ${H * 0.7} ${W} ${H * 0.2} V${H}Z" fill="#FF9933" fill-opacity="0.85"/><path d="M${W * 0.58} ${H} C${W * 0.72} ${H * 0.6} ${W * 0.85} ${H * 0.85} ${W} ${H * 0.5} V${H}Z" fill="#FFFFFF"/><path d="M${W * 0.66} ${H} C${W * 0.78} ${H * 0.8} ${W * 0.9} ${H * 0.95} ${W} ${H * 0.78} V${H}Z" fill="#138808"/>`,
    bannerBg: ['#FFF7ED', '#FFEDD5'], anim: 'petals',
  },
  eid: {
    bg: ['#022C22', '#065F46'], tint: '#ECFDF5', motif: '#059669',
    header: (W, H) => `${crescent(W * 0.78, H * 0.4, 70, '#FDE68A', '#05402F')}${star5(W * 0.66, H * 0.2, 12, '#FDE68A')}${star5(W * 0.92, H * 0.18, 9, '#FDE68A')}
      ${fanoos(W * 0.88, 60, 1.0, '#CA8A04', 60)}${fanoos(W * 0.6, 40, 0.75, '#047857', 40)}${dots(70, W, H, '#FDE68A', 2, [0.2, 0.6])}`,
    glow: ['#FDE68A', 0.25, 0.78, 0.4],
    deco: (W) => { let d = `<path d="M0 4 Q${W / 2} 30 ${W} 4" fill="none" stroke="#CA8A04" stroke-width="3"/>`; for (let i = 0; i < 9; i++) { const x = 66 + i * 133; d += i % 2 ? fanoos(x, 26, 0.5, '#047857', 20) : `<line x1="${x}" y1="10" x2="${x}" y2="40" stroke="#FCD34D" stroke-width="2"/>${star5(x, 52, 13, '#FACC15')}`; } return d; },
    pattern: (W, H) => { let p = ''; for (let i = 0; i < 30; i++) p += star5(rnd() * W, rnd() * H, 6 + rnd() * 10, '#059669', 0.16); return p; },
    banner: (W, H) => `${crescent(W * 0.82, H * 0.45, 90, '#CA8A04', '#DDF7EA')}${fanoos(W * 0.66, 10, 1.1, '#047857', 10)}${star5(W * 0.95, H * 0.2, 16, '#CA8A04')}`,
    bannerBg: ['#ECFDF5', '#D1FAE5'], anim: 'twinkle',
  },
  navratri: {
    bg: ['#7F1D1D', '#B91C1C'], tint: '#FEF2F2', motif: '#DC2626',
    header: (W, H) => `${rangoli(W * 0.82, H * 0.5, 170, '#FCD34D', 0.2)}${rangoli(W * 0.15, H * 0.9, 120, '#FCD34D', 0.12)}
      <g transform="translate(${W * 0.72} ${H * 0.58}) rotate(-35)"><rect x="-12" y="-130" width="24" height="260" rx="12" fill="#FACC15"/>${[-90, -40, 10, 60, 110].map(y => `<rect x="-13" y="${y}" width="26" height="9" fill="#DC2626"/>`).join('')}</g><g transform="translate(${W * 0.78} ${H * 0.58}) rotate(35)"><rect x="-12" y="-130" width="24" height="260" rx="12" fill="#22C55E"/>${[-90, -40, 10, 60, 110].map(y => `<rect x="-13" y="${y}" width="26" height="9" fill="#FACC15"/>`).join('')}</g>${dots(60, W, H, '#FDE68A')}`,
    glow: ['#F59E0B', 0.3, 0.8, 0.45],
    deco: (W) => { let d = `<rect width="${W}" height="10" fill="#B45309"/>`; for (let x = 10; x < W; x += 22) d += `<circle cx="${x}" cy="14" r="11" fill="url(#mg)"/>`; for (let k = 0; k < 9; k++) { const x = 66 + k * 133; d += `<line x1="${x}" y1="20" x2="${x}" y2="50" stroke="#FCD34D" stroke-width="2"/><path d="M${x - 12} 50 h24 l-4 22 h-16z" fill="#CA8A04"/><circle cx="${x}" cy="76" r="4" fill="#CA8A04"/>`; } return d; },
    pattern: (W, H) => { let p = ''; for (let i = 0; i < 8; i++) p += rangoli(rnd() * W, rnd() * H, 50 + rnd() * 60, '#DC2626', 0.14); return p; },
    banner: (W, H) => `${rangoli(W * 0.82, H * 0.5, 140, '#DC2626', 0.25)}<g transform="translate(${W * 0.66} ${H * 0.55}) rotate(-35)"><rect x="-9" y="-80" width="18" height="160" rx="9" fill="#DC2626"/></g><g transform="translate(${W * 0.7} ${H * 0.55}) rotate(35)"><rect x="-9" y="-80" width="18" height="160" rx="9" fill="#16A34A"/></g>`,
    bannerBg: ['#FFF1F2', '#FFE4E6'], anim: 'petals',
  },
};

// ── Lottie animations ──────────────────────────────────────────
const lin = { i: { x: [1], y: [1] }, o: { x: [0], y: [0] } };
const ellipse = (size, rgb) => [{ ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [size, size] } }, { ty: 'fl', c: { a: 0, k: [...rgb, 1] }, o: { a: 0, k: 100 }, r: 1 }];
const rect = (w, h, rgb) => [{ ty: 'rc', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [w, h] }, r: { a: 0, k: 1 } }, { ty: 'fl', c: { a: 0, k: [...rgb, 1] }, o: { a: 0, k: 100 }, r: 1 }];
const tr0 = () => ({ ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } });
const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

// Particles travelling across the canvas in a seamless loop (dir: 1 = down, -1 = up).
const drift = (n, shapes, { w, h, op, dir = 1, spin = false, wobble = 0, opacity = [55, 95] }) => {
  const layers = [];
  for (let i = 0; i < n; i++) {
    const x = Math.round(rnd() * w), total = h + 30, ys = Math.round(-10 + rnd() * (h + 20));
    const end = dir > 0 ? h + 15 : -15, start = dir > 0 ? -15 : h + 15;
    const t1 = Math.max(1, Math.round((Math.abs(end - ys) / total) * op));
    const dx = Math.round((rnd() - 0.5) * 2 * wobble);
    layers.push({ ddd: 0, ty: 4, sr: 1, ao: 0, ip: 0, op, st: 0, bm: 0,
      ks: { o: { a: 0, k: Math.round(opacity[0] + rnd() * (opacity[1] - opacity[0])) },
        r: spin ? { a: 1, k: [{ t: 0, s: [0], ...lin }, { t: op, s: [360 * (rnd() > 0.5 ? 1 : -1)] }] } : { a: 0, k: 0 },
        p: { a: 1, k: [{ t: 0, s: [x, ys, 0], ...lin }, { t: t1, s: [x + dx, end, 0], h: 1 }, { t: Math.min(op - 1, t1 + 1), s: [x - dx, start, 0], ...lin }, { t: op, s: [x, ys, 0] }] },
        a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
      shapes: [{ ty: 'gr', it: [...shapes(i), tr0()] }] });
  }
  return layers;
};
const bursts = (list, op) => list.map(([cx, cy, start, color, R = 55, n = 14]) => {
  const groups = [];
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2;
    groups.push({ ty: 'gr', it: [...ellipse(4.5, hex(color)), { ty: 'tr', a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 },
      p: { a: 1, k: [{ t: start, s: [0, 0], i: { x: [0.2], y: [1] }, o: { x: [0.3], y: [0] } }, { t: start + 26, s: [Math.cos(a) * R, Math.sin(a) * R + 8] }] } }] });
  }
  groups.push({ ty: 'gr', it: [...ellipse(9, [1, 1, 0.9]), tr0()] });
  return { ddd: 0, ty: 4, sr: 1, ao: 0, ip: 0, op, st: 0, bm: 0,
    ks: { o: { a: 1, k: [{ t: 0, s: [0], h: 1 }, { t: start, s: [100], ...lin }, { t: start + 30, s: [0], h: 1 }, { t: op, s: [0] }] },
      r: { a: 0, k: 0 }, p: { a: 0, k: [cx, cy, 0] }, a: { a: 0, k: [0, 0, 0] },
      s: { a: 1, k: [{ t: start, s: [55, 55, 100], ...lin }, { t: start + 26, s: [100, 100, 100] }] } }, shapes: groups };
});
const lottie = (kind) => {
  const w = 400, h = 200, op = 90;
  let layers = [];
  const gold = ['#FDE047', '#FBBF24', '#FFF7CC'].map(hex);
  if (kind === 'sparks') layers = [...drift(26, i => ellipse(2 + (i % 3), gold[i % 3]), { w, h, op, dir: -1, wobble: 10 }), ...bursts([[300, 55, 6, '#FBBF24'], [95, 75, 48, '#FB923C']], op)];
  if (kind === 'snow') layers = drift(36, i => ellipse(3 + (i % 4) * 1.4, [1, 1, 1]), { w, h, op, dir: 1, wobble: 14 });
  if (kind === 'fireworks') layers = [...bursts([[300, 60, 2, '#FACC15', 60, 16], [110, 80, 30, '#F472B6', 52], [220, 50, 58, '#60A5FA', 56]], op),
    ...drift(30, i => rect(6, 3, hex(['#FACC15', '#F472B6', '#60A5FA', '#34D399'][i % 4])), { w, h, op, dir: 1, spin: true, wobble: 20 })];
  if (kind === 'powder') layers = drift(34, i => ellipse(4 + (i % 4) * 2, hex(['#EC4899', '#F59E0B', '#22C55E', '#3B82F6', '#A855F7'][i % 5])), { w, h, op, dir: -1, wobble: 26, opacity: [35, 70] });
  if (kind === 'petals') layers = drift(26, i => [{ ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [10, 5] } }, { ty: 'fl', c: { a: 0, k: [...hex(['#F97316', '#FACC15', '#22C55E', '#EF4444'][i % 4]), 1] }, o: { a: 0, k: 100 }, r: 1 }], { w, h, op, dir: 1, spin: true, wobble: 24 });
  if (kind === 'twinkle') layers = Array.from({ length: 22 }, (_, i) => {
    const t0 = Math.round(rnd() * 60);
    return { ddd: 0, ty: 4, sr: 1, ao: 0, ip: 0, op, st: 0, bm: 0,
      ks: { o: { a: 1, k: [{ t: 0, s: [10], ...lin }, { t: t0, s: [10], ...lin }, { t: t0 + 12, s: [100], ...lin }, { t: Math.min(op, t0 + 26), s: [10] }] },
        r: { a: 0, k: 0 }, p: { a: 0, k: [Math.round(rnd() * w), Math.round(rnd() * h), 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
      shapes: [{ ty: 'gr', it: [{ ty: 'sr', sy: 1, d: 1, pt: { a: 0, k: 4 }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 0 }, ir: { a: 0, k: 1.5 }, is: { a: 0, k: 0 }, or: { a: 0, k: 4 + (i % 3) * 2 }, os: { a: 0, k: 0 } },
        { ty: 'fl', c: { a: 0, k: [1, 0.9, 0.55, 1] }, o: { a: 0, k: 100 }, r: 1 }, tr0()] }] };
  });
  layers.forEach((l, i) => { l.ind = i + 1; l.nm = `l${i + 1}`; });
  return { v: '5.7.4', fr: 30, ip: 0, op, w, h, nm: kind, ddd: 0, assets: [], layers };
};

// ── Build ──────────────────────────────────────────────────────
(async () => {
  for (const [name, ic] of Object.entries(icons)) {
    seed = name.length * 97;
    await save(`${OUT}/icons/${name}.webp`, ICON, ICON, iconBg() + ic.art, ICON_DEFS(ic.bg), 92);
  }
  for (const [key, f] of Object.entries(FESTIVALS)) {
    seed = key.length * 131 + 7;
    const dir = `${OUT}/${key}`;
    const [gc, go, gx, gy] = f.glow;
    const common = `${glow('flameGlow', '#FBBF24', 0.6)}${glow('lampGlow', '#FDE68A', 0.45)}
      <radialGradient id="mg"><stop offset="0" stop-color="#FDE047"/><stop offset="0.6" stop-color="#F59E0B"/><stop offset="1" stop-color="#EA580C"/></radialGradient>`;
    // Header (wide, sits behind ETA + location + search)
    // ~2.1:1 like a phone header, so cover-cropping keeps the right-side art.
    const HW = 1200, HH = 560;
    await save(`${dir}/header.webp`, HW, HH,
      `<rect width="${HW}" height="${HH}" fill="url(#hbg)"/><rect width="${HW}" height="${HH}" fill="url(#hglow)"/>${f.header(HW, HH)}`,
      `${common}<linearGradient id="hbg" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${f.bg[0]}"/><stop offset="1" stop-color="${f.bg[1]}"/></linearGradient>
       <radialGradient id="hglow" cx="${gx}" cy="${gy}" r="0.5"><stop offset="0" stop-color="${gc}" stop-opacity="${go}"/><stop offset="1" stop-color="${gc}" stop-opacity="0"/></radialGradient>`, 88);
    await save(`${dir}/decoration.webp`, 1200, 170, f.deco(1200), common, 92);
    await save(`${dir}/page.webp`, 1600, 700, `<rect width="1600" height="700" fill="${f.tint}"/>${f.pattern(1600, 700)}`, common, 82);
    await save(`${dir}/section.webp`, 1600, 700, `<rect width="1600" height="700" fill="${f.tint}"/>${f.pattern(1600, 700)}`, common, 82);
    // Section banner: art on the right, calm left side for the title
    const BW = 1200, BH = 420;
    await save(`${dir}/banner.webp`, BW, BH, `<rect width="${BW}" height="${BH}" fill="url(#bbg)"/>${f.banner(BW, BH)}`,
      `${common}<linearGradient id="bbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${f.bannerBg[0]}"/><stop offset="1" stop-color="${f.bannerBg[1]}"/></linearGradient>`, 90);
    await fs.promises.writeFile(`${dir}/animation.json`, JSON.stringify(lottie(f.anim)));
    console.log('built', key);
  }
})().catch(e => { console.error(e); process.exit(1); });
