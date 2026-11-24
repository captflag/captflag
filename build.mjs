// Generates the beach-themed profile skin SVGs into ./assets. No dependencies (Node 20+).
//   node build.mjs [login]   real data; needs GITHUB_TOKEN (login defaults to the repo owner)
//   node build.mjs --demo    fake data, for trying theme changes offline
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert';

// ---- edit this to reskin ----------------------------------------------------
const T = {
  tagline: 'AI Engineer', // empty = use your GitHub bio
  bg: '#fbeecb', bg2: '#f3d9a4', border: '#e0c48a', ink: '#17404d', muted: '#4a6c74', // sand cards, dark text
  a: '#0e8a94', b: '#155e75', // number gradient: lagoon teal -> deep sea
  text: '#fdf6e3', gold: '#ffd166', coral: '#ff7a59', // banner text and sprite accents
  sky: ['#1a2a5e', '#7d3f8f', '#f0705a', '#ffc66e'], // banner sky, top -> horizon
  sea: ['#2f8796', '#237588', '#196379', '#12526b', '#0d445d'], // banner wave bands, far -> near
  surf: ['#7fd6d6', '#35b3bd', '#1b93a6'], // card wave bands, far -> near
  sand: '#f6dfae', trunk: '#7a4a2b', leaf: ['#178055', '#2aa36b'], kayak: '#ff5a3c', beer: '#f6a821',
  // contribution islands: lagoon water, then sand -> grass as a day gets busier (busiest grow a palm)
  levels: ['#3dbfc6', '#fff3d1', '#e8bd72', '#6cc57f', '#2aa36b'],
};
// -----------------------------------------------------------------------------

const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const fmt = n => (n >= 1e4 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k' : n.toLocaleString('en-US'));
const shade = (hex, f) => '#' + hex.slice(1).match(/../g).map(h => Math.round(parseInt(h, 16) * f).toString(16).padStart(2, '0')).join('');

const frame = (w, h, body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${T.a}"/><stop offset="1" stop-color="${T.b}"/></linearGradient>
<linearGradient id="deep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.bg}"/><stop offset="1" stop-color="${T.bg2}"/></linearGradient>
<clipPath id="r"><rect width="${w}" height="${h}" rx="14"/></clipPath>${defs}</defs>
<style>
text{font-family:'Segoe UI',Ubuntu,'Helvetica Neue',Arial,sans-serif;fill:${T.ink}}
.m{font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',monospace}
.mu{fill:${T.muted}}.g{fill:url(#g)}.b{font-weight:800}
.cap{font-size:11px;letter-spacing:1.5px;fill:${T.muted}}
.in{animation:in .6s ease-out both}@keyframes in{from{opacity:0;transform:translateY(8px)}}
.rise{transform-box:fill-box;transform-origin:50% 100%;animation:rise .9s cubic-bezier(.2,.8,.3,1) both}@keyframes rise{from{transform:scaleY(0)}}
.wv{animation:wv 8s linear infinite}@keyframes wv{to{transform:translateX(-120px)}}
.sway{animation:sway 5s ease-in-out infinite alternate}@keyframes sway{from{transform:rotate(-3deg)}to{transform:rotate(4deg)}}
.bob{animation:bob 3s ease-in-out infinite alternate}@keyframes bob{from{transform:translateY(-1.5px) rotate(-2deg)}to{transform:translateY(1.5px) rotate(2deg)}}
.bub{animation:bub 2.4s ease-in infinite}@keyframes bub{from{opacity:.9}to{transform:translateY(-20px);opacity:0}}
.tw{animation:tw 3s ease-in-out infinite}@keyframes tw{50%{opacity:.2}}
@media(prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
<g clip-path="url(#r)"><rect width="${w}" height="${h}" fill="url(#deep)"/>${body}</g>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="14" fill="none" stroke="${T.border}"/>
</svg>`;

// ---- sprites (drawn around 0,0; `at` places them and optionally animates) -----
const at = (x, y, s, inner, cls = '') => `<g transform="translate(${x},${y}) scale(${s})"><g class="${cls}">${inner}</g></g>`;

// One 120px-period wave band filling down to the bottom of the card.
const wave = (W, H, y, amp, fill, dur, rev) =>
  `<path class="wv" style="animation-duration:${dur}s${rev ? ';animation-direction:reverse' : ''}" d="M0 ${y}q30 ${-amp * 2} 60 0${'t60 0'.repeat(Math.ceil(W / 60) + 2)}V${H}H0z" fill="${fill}"/>`;

const starPts = (R, r) => Array.from({ length: 10 }, (_, i) => { const a = Math.PI * i / 5, k = i % 2 ? r : R; return `${(k * Math.sin(a)).toFixed(1)},${(-k * Math.cos(a)).toFixed(1)}`; }).join(' ');
const LEAF = 'M0 0C10-16 30-16 44 6C30-4 14-3 0 0Z';
const CROWN = [[1, -95], [1, -62], [-1, -62], [1, -28], [-1, -28], [1, 8], [-1, 8]].map(([sx, r], i) =>
  `<path d="${LEAF}" transform="scale(${sx},1) rotate(${r})" fill="${T.leaf[i % 2]}"/>`).join('') +
  [[-4, 4], [4, 5], [0, 7]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#4a2c17"/>`).join('');
// Coconut palm: base at (x,y), trunk height h, crown pushed sideways by `lean`.
const palm = (x, y, h, lean, s = 1) =>
  `<path d="M${x} ${y}Q${x - lean} ${y - h / 2} ${x + lean} ${y - h}" stroke="${T.trunk}" stroke-width="${4.5 * s}" stroke-linecap="round" fill="none"/>` + at(x + lean, y - h, s, CROWN, 'sway');

const HULL = `<path d="M-52-4Q-28 7 0 7Q28 7 52-4Q28 0 0 0Q-28 0-52-4Z" fill="${T.kayak}"/>
<path d="M-40 2Q0 5 40 2" stroke="${T.gold}" stroke-width="1.5" fill="none"/><ellipse rx="9" ry="2.5" fill="#3a1f1a"/>`;
// Paddle through (0,y) at `deg`, 58px long.
const paddle = (y, deg) => `<g transform="translate(0,${y}) rotate(${deg})"><path d="M-27 0H27" stroke="#4a2c17" stroke-width="2" stroke-linecap="round"/><ellipse cx="-31" rx="6.5" ry="3.2" fill="${T.text}"/><ellipse cx="31" rx="6.5" ry="3.2" fill="${T.text}"/></g>`;
const KAYAK = HULL + paddle(-6, 21); // empty, paddle resting across
const PADDLER = `${HULL}<rect x="-4.5" y="-15" width="9" height="16" rx="3.5" fill="${T.gold}"/>
<path d="M-3.5-12.5L-10-11.5M3.5-12.5L10-5.5" stroke="#e8b48a" stroke-width="2.8" stroke-linecap="round"/>${paddle(-8.5, 16.5)}
<circle cy="-20" r="4.8" fill="#e8b48a"/><ellipse cy="-23" rx="8.5" ry="2" fill="${T.sand}"/><path d="M-4.8-23a4.8 4.8 0 0 1 9.6 0z" fill="${T.sand}"/><path d="M-4.8-23.6h9.6" stroke="${T.coral}" stroke-width="1.4"/>`;

// Beer bottle, origin at the bottom centre.
const BOTTLE = `<path d="M-6 0V-26Q-6-34-2.5-38V-48H2.5V-38Q6-34 6-26V0Z" fill="#8a4b1f"/>
<rect x="-3.2" y="-51" width="6.4" height="3.5" rx="1" fill="${T.gold}"/>
<rect x="-6" y="-21" width="12" height="11" fill="${T.text}"/><circle cy="-15.5" r="2.6" fill="${T.coral}"/>
<rect x="-4" y="-36" width="1.6" height="12" rx=".8" fill="#fff" opacity=".35"/>`;

// Beer mug, origin at the bottom centre.
const BEER = `<path d="M11-27h6a6 6 0 0 1 6 6v6a6 6 0 0 1-6 6h-6" fill="none" stroke="${T.text}" stroke-width="3.5"/>
<rect x="-12" y="-33" width="24" height="33" rx="3" fill="${T.beer}"/>
${[-8, -1.5, 5].map(x => `<rect x="${x}" y="-26" width="3" height="21" rx="1.5" fill="${T.gold}"/>`).join('')}
<circle class="bub" cx="-4" cy="-6" r="1.3" fill="#fff"/><circle class="bub" cx="3" cy="-9" r="1" fill="#fff" style="animation-delay:-1.2s"/>
<rect x="-12" y="-33" width="24" height="33" rx="3" fill="none" stroke="${T.text}" stroke-opacity=".75" stroke-width="1.5"/>
<g fill="#fffdf5"><circle cx="-10" cy="-35" r="5"/><circle cx="-3" cy="-38" r="6"/><circle cx="5" cy="-37" r="6"/><circle cx="11" cy="-34" r="4.5"/><rect x="-14" y="-36" width="29" height="6" rx="3"/><rect x="-9" y="-32" width="4" height="10" rx="2"/></g>`;
// -----------------------------------------------------------------------------

function banner(d) {
  const W = 840, H = 260, HZ = 150, SUN = 545;
  const line = ('~ ' + (T.tagline || d.bio || 'building things')).slice(0, 64);
  const cw = 8.4, steps = [...line].map((_, i) => ((i + 1) * cw).toFixed(1)), dur = (line.length * 0.07).toFixed(2);
  const glints = [46, 30, 38, 22, 30, 16, 22, 12].map((w, i) =>
    `<rect class="tw" x="${SUN - w / 2}" y="${157 + i * 11}" width="${w}" height="2" rx="1" style="animation-delay:-${(i * 0.7).toFixed(1)}s"/>`).join('');
  const gull = 'M0 0q4-5 8 0q4-5 8 0';
  return frame(W, H, `
<style>
.fly{animation:fly 46s linear infinite}@keyframes fly{from{transform:translateX(-40px)}to{transform:translateX(${W + 40}px)}}
.drift{animation:drift 14s ease-in-out infinite alternate}@keyframes drift{to{transform:translateX(26px)}}
.cur{animation:bl 1s steps(1) infinite}@keyframes bl{50%{opacity:0}}
text{fill:${T.text}}
</style>
<rect width="${W}" height="${HZ}" fill="url(#sky)"/>
<g fill="#ffd9c2" opacity=".35"><rect class="drift" x="250" y="122" width="150" height="6" rx="3"/><rect class="drift" x="440" y="58" width="100" height="5" rx="2.5" style="animation-delay:-6s"/><rect class="drift" x="330" y="88" width="70" height="4" rx="2"/></g>
<circle cx="${SUN}" cy="${HZ}" r="130" fill="url(#halo)"/>
<circle cx="${SUN}" cy="${HZ}" r="42" fill="url(#sun)" clip-path="url(#above)"/>
<g stroke="${T.text}" stroke-width="1.6" fill="none" stroke-linecap="round"><g transform="translate(0,16)"><path class="fly" d="${gull}"/></g><g transform="translate(0,26) scale(.7)"><path class="fly" d="${gull}" style="animation-delay:-3s"/></g></g>
<rect y="${HZ}" width="${W}" height="${H - HZ}" fill="url(#water)"/>
${wave(W, H, 161, 1.5, T.sea[0], 16)}
<path d="M575 184Q695 112 815 184Z" fill="${T.sand}"/><path d="M620 184Q725 132 815 184Z" fill="${shade(T.sand, 0.86)}"/>
${palm(764, 172, 34, 8, 0.7)}${palm(724, 164, 58, 16, 1.05)}${palm(688, 158, 86, -14, 1.35)}
${wave(W, H, 178, 2.5, T.sea[1], 11, true)}
${wave(W, H, 198, 3, T.sea[2], 9)}
<ellipse cx="400" cy="221" rx="60" ry="3" fill="${T.sea[1]}" opacity=".7"/>
${at(400, 213, 1, PADDLER, 'bob')}
${wave(W, H, 221, 4, T.sea[3], 7, true)}
${wave(W, H, 243, 5, T.sea[4], 5.5)}
<g fill="#ffe2a0" opacity=".75">${glints}</g>
<path d="M0 214Q120 200 215 236Q250 250 262 260H0Z" fill="url(#beach)"/>
<path class="tw" d="M0 214Q120 200 215 236Q250 250 262 260" stroke="#fffdf5" stroke-width="3" stroke-linecap="round" fill="none" style="animation-duration:4s"/>
<g transform="rotate(9 108 215)">${at(108, 217, 1, BOTTLE)}</g>
<g transform="rotate(-5 70 212)">${at(70, 214, 1, BEER)}</g>
<polygon points="${starPts(8.5, 3.5)}" transform="translate(160,242) rotate(14)" fill="${T.coral}"/>
<g filter="url(#sh)">
<text x="40" y="50" class="m" font-size="13" fill-opacity=".8">@${esc(d.login)}</text>
<text x="40" y="96" class="b" font-size="40">${esc(d.name)}</text>
<g clip-path="url(#type)"><text x="40" y="126" class="m" font-size="14" textLength="${(line.length * cw).toFixed(1)}">${esc(line)}</text></g>
<rect class="cur" x="40" y="114" width="8" height="15" fill="${T.gold}"><animate attributeName="x" begin=".6s" dur="${dur}s" fill="freeze" calcMode="discrete" values="40;${steps.map(s => +s + 42).join(';')}"/></rect>
</g>`, `
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${T.sky.map((c, i) => `<stop offset="${[0, 0.45, 0.8, 1][i]}" stop-color="${c}"/>`).join('')}</linearGradient>
<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9796c"/><stop offset=".18" stop-color="${T.sea[0]}"/></linearGradient>
<linearGradient id="beach" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.sand}"/><stop offset="1" stop-color="${shade(T.sand, 0.82)}"/></linearGradient>
<radialGradient id="halo"><stop offset="0" stop-color="#ffd98a" stop-opacity=".6"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
<linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c8"/><stop offset=".5" stop-color="#ffb347"/></linearGradient>
<clipPath id="above"><rect width="${W}" height="${HZ}"/></clipPath>
<clipPath id="type"><rect x="40" y="110" height="22" width="0"><animate attributeName="width" begin=".6s" dur="${dur}s" fill="freeze" calcMode="discrete" values="0;${steps.join(';')}"/></rect></clipPath>
<filter id="sh" x="-10%" y="-30%" width="120%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#1a1035" flood-opacity=".65"/></filter>`);
}

const title = t => `<rect x="24" y="24" width="3" height="14" fill="${T.coral}"/><text x="36" y="36" class="m cap">${t}</text>`;
// Surf along the bottom of a small card, with a sprite floating between the bands.
const surf = (H, sprite) => wave(412, H, H - 34, 3, T.surf[0], 10) + wave(412, H, H - 24, 3, T.surf[1], 8, true) + sprite + wave(412, H, H - 12, 3, T.surf[2], 6);

// One beach icon per stat, drawn around 0,0 to sit inside an 18px-radius badge.
const ICON = {
  Stars: `<polygon points="${starPts(12, 5)}" transform="rotate(12)" fill="${T.coral}"/><circle r="1.5" fill="${T.text}"/>`, // starfish
  Commits: `<g transform="rotate(-38) scale(.42)">${paddle(0, 0)}</g>`, // paddle strokes
  PRs: `<g transform="rotate(35) translate(0,12.5) scale(.48)">${BOTTLE}</g>`, // message in a bottle
  Issues: `<g fill="${T.kayak}" stroke="${T.kayak}" stroke-linecap="round"><path d="M-6 3l-5 4M-7 0l-6 1M6 3l5 4M7 0l6 1M-5-3l-4-5M5-3l4-5" stroke-width="1.8" fill="none"/><ellipse cy="1" rx="8" ry="5.5" stroke="none"/><circle cx="-10" cy="-9" r="3.2" stroke="none"/><circle cx="10" cy="-9" r="3.2" stroke="none"/></g><circle cx="-3" cy="-1" r="1.3" fill="#fff"/><circle cx="3" cy="-1" r="1.3" fill="#fff"/>`, // crab (bugs)
  Repos: `<g transform="translate(0,2)"><g fill="${T.sand}" stroke="${shade(T.sand, 0.7)}" stroke-linejoin="round"><rect x="-12" y="-3" width="7" height="13"/><rect x="5" y="-3" width="7" height="13"/><rect x="-6" y="-8" width="12" height="18"/></g><path d="M-2 10v-5a2 2 0 0 1 4 0v5z" fill="${T.trunk}"/><path d="M0-8v-7" stroke="${T.trunk}" stroke-width="1.2"/><path d="M0-15l6 2.5l-6 2.5z" fill="${T.coral}"/></g>`, // sandcastle
  Followers: `<path transform="translate(1,-3)" d="M-12 0q5-7 10 0q5-7 10 0M-2 9q3.5-5 7 0q3.5-5 7 0" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`, // seagulls
};

function stats(d) {
  const H = 220;
  const cells = Object.entries(d.stats).map(([label, n], i) => {
    const x = 24 + (i % 3) * 124, cy = 84 + Math.floor(i / 3) * 56;
    return `<g class="in" style="animation-delay:${i * 90}ms"><g transform="translate(${x + 18},${cy})"><circle r="18" fill="${T.surf[1]}" stroke="${T.surf[0]}" stroke-width="2"/>${ICON[label]}</g><text x="${x + 45}" y="${cy + 3}" class="b g" font-size="24">${fmt(n)}</text><text x="${x + 45}" y="${cy + 18}" class="cap" style="font-size:10px;letter-spacing:1px">${label.toUpperCase()}</text></g>`;
  }).join('');
  return frame(412, H, title('STATS') + surf(H, at(372, H - 8, 0.6, BEER, 'bob')) + cells);
}

// Bar chart drawn as surfboards stuck in the sand: board height = language share, tallest = biggest.
function langs(d) {
  const H = 220, BASE = 174, MAX = 96, W2 = 11, n = d.langs.length, slot = 364 / Math.max(n, 4), x0 = 206 - slot * n / 2;
  const boards = d.langs.map((l, i) => {
    // ponytail: boards under 8px are drawn at 8px so they stay visible; the printed % is exact.
    const cx = (x0 + slot * (i + 0.5)).toFixed(1), h = +Math.max(8,MAX * l.pct / d.langs[0].pct).toFixed(1);
    const name = l.name.length > 10 ? l.name.slice(0, 9) + '…' : l.name;
    return `<g transform="translate(${cx},${BASE})"><ellipse rx="15" ry="3" fill="${shade(T.bg2, 0.85)}"/>
<g class="rise" style="animation-delay:${i * 100}ms"><path d="M0 ${-h}C${W2} ${(-h * 0.72).toFixed(1)} ${W2} ${(-h * 0.25).toFixed(1)} ${W2 * 0.6} 0H${-W2 * 0.6}C${-W2} ${(-h * 0.25).toFixed(1)} ${-W2} ${(-h * 0.72).toFixed(1)} 0 ${-h}Z" fill="${l.color}" stroke="${T.ink}" stroke-opacity=".35"/>${h > 24 ? `<path d="M0 ${-h + 8}V-1" stroke="#fff" stroke-opacity=".55" stroke-width="1.5"/>` : ''}</g>
<g class="in" style="animation-delay:${400 + i * 100}ms"><text y="${-h - 7}" text-anchor="middle" class="b" font-size="12">${l.pct.toFixed(1)}%</text><text y="17" text-anchor="middle" font-size="11">${esc(name)}</text></g></g>`;
  }).join('');
  return frame(412, H, title('LANGUAGES') + wave(412, H, 201, 2.5, T.surf[1], 8, true) + wave(412, H, 210, 3, T.surf[2], 6)
    + (n ? boards : `<text x="24" y="100" class="mu" font-size="13">No public code yet</text>`));
}

function islands(d) {
  const W = 840, H = 340, ax = 13, ay = 2.5, dx = 7, dy = 6, s = 0.8, ox = 96, oy = 118;
  const X = (w, dd) => +(ox + w * ax - dd * dx).toFixed(1), Y = (w, dd, z = 0) => +(oy + w * ay + dd * dy - z).toFixed(1);
  const P = (w, dd, z) => `${X(w, dd)},${Y(w, dd, z)}`;
  const flat = d.weeks.flat(), nz = flat.filter(Boolean).sort((p, q) => p - q);
  const q = p => nz[Math.floor(p * (nz.length - 1))] ?? 1;
  const cuts = [q(0.25), q(0.5), q(0.75)], cap = q(0.95);
  let longest = 0, run = 0;
  for (const c of flat) longest = Math.max(longest, (run = c ? run + 1 : 0));
  let current = 0;
  for (let i = flat.length - 1; i >= 0; i--) { if (flat[i]) current++; else if (i < flat.length - 1) break; } // today may still be empty
  // Painter's order: week outer, day inner (later = nearer the viewer).
  const blocks = d.weeks.map((wk, w) => `<g class="in" style="animation-delay:${w * 18}ms">${wk.map((c, i) => {
    const lv = c ? 1 + cuts.filter(t => c > t).length : 0, h = c ? 5 + 50 * Math.min(1, c / cap) : 0;
    const col = lv ? T.levels[lv] : shade(T.levels[0], (w + i) % 2 ? 1 : 0.93);
    const top = `<polygon points="${P(w, i, h)} ${P(w + s, i, h)} ${P(w + s, i + s, h)} ${P(w, i + s, h)}" fill="${col}"/>`;
    if (!h) return top;
    const cx = X(w + s / 2, i + s / 2), cy = Y(w + s / 2, i + s / 2, h);
    const tree = lv < 4 ? '' : `<path d="M${cx} ${cy}q-2-8 1-15" stroke="${T.trunk}" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="${['q-6-6-11 2', 'q6-6 11 2', 'q-4-8-10-6', 'q4-8 10-6', 'v-8'].map(l => `M${cx + 1} ${cy - 15}${l}`).join('')}" stroke="#0f6b45" stroke-width="2.4" stroke-linecap="round" fill="none"/>`;
    return `<polygon points="${P(w, i + s, h)} ${P(w + s, i + s, h)} ${P(w + s, i + s)} ${P(w, i + s)}" fill="${shade(col, 0.72)}"/><polygon points="${P(w + s, i, h)} ${P(w + s, i + s, h)} ${P(w + s, i + s)} ${P(w + s, i)}" fill="${shade(col, 0.5)}"/>${top}${tree}`;
  }).join('')}</g>`).join('');
  const foot = [['CURRENT STREAK', current + 'd'], ['LONGEST STREAK', longest + 'd'], ['BEST DAY', fmt(nz.at(-1) ?? 0)]].map(([l, v], i) =>
    `<text x="${28 + i * 136}" y="290" class="b g" font-size="24">${v}</text><text x="${28 + i * 136}" y="308" class="cap">${l}</text>`).join('');
  return frame(W, H, `${blocks}
<ellipse cx="104" cy="238" rx="36" ry="3" fill="${shade(T.bg2, 0.85)}"/><g transform="rotate(-6 104 232)">${at(104, 232, 0.6, KAYAK)}</g>
<text x="${W - 28}" y="38" class="m cap" text-anchor="end">CONTRIBUTION ISLANDS</text>
<text x="${W - 28}" y="72" class="b g" font-size="30" text-anchor="end">${fmt(d.total)}</text>
<text x="${W - 28}" y="92" class="mu" font-size="12" text-anchor="end">contributions in the last year</text>${foot}`);
}

const QUERY = `query($login:String!){user(login:$login){
  name login bio followers{totalCount} pullRequests{totalCount} issues{totalCount}
  repositories(first:100,ownerAffiliations:OWNER,isFork:false,orderBy:{field:STARGAZERS,direction:DESC}){
    totalCount nodes{stargazerCount languages(first:10,orderBy:{field:SIZE,direction:DESC}){edges{size node{name color}}}}}
  contributionsCollection{totalCommitContributions contributionCalendar{totalContributions weeks{contributionDays{contributionCount}}}}}}`;

async function fetchData(login, token) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST', headers: { authorization: `bearer ${token}`, 'user-agent': 'profile-skin' },
    body: JSON.stringify({ query: QUERY, variables: { login } }),
  });
  const j = await res.json();
  if (!res.ok || j.errors || !j.data?.user) throw new Error(`GitHub API ${res.status}: ${JSON.stringify(j.errors ?? j.message ?? 'user not found')}`);
  const u = j.data.user, repos = u.repositories.nodes, bytes = {};
  // ponytail: stars and languages cover the 100 most-starred owned repos; paginate if you ever own more.
  for (const r of repos) for (const e of r.languages.edges) (bytes[e.node.name] ??= { name: e.node.name, color: e.node.color ?? T.muted, size: 0 }).size += e.size;
  const all = Object.values(bytes).sort((p, q) => q.size - p.size), sum = all.reduce((n, l) => n + l.size, 0);
  return {
    name: u.name || u.login, login: u.login, bio: u.bio ?? '',
    stats: {
      Stars: repos.reduce((n, r) => n + r.stargazerCount, 0), Commits: u.contributionsCollection.totalCommitContributions, PRs: u.pullRequests.totalCount,
      Issues: u.issues.totalCount, Repos: u.repositories.totalCount, Followers: u.followers.totalCount,
    },
    langs: all.slice(0, 6).map(l => ({ ...l, pct: 100 * l.size / sum })),
    total: u.contributionsCollection.contributionCalendar.totalContributions,
    weeks: u.contributionsCollection.contributionCalendar.weeks.map(w => w.contributionDays.map(x => x.contributionCount)),
  };
}

function demoData() {
  let seed = 42;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32); // seeded, so the demo is repeatable
  const weeks = Array.from({ length: 53 }, (_, w) => Array.from({ length: w === 52 ? 3 : 7 }, (_, i) =>
    rand() < (i % 6 ? 0.8 : 0.35) ? Math.ceil(rand() ** 2 * 18 * (0.4 + (w % 13) / 10)) : 0));
  return {
    name: 'Your Name', login: 'your-username', bio: 'shipping from the beach',
    stats: { Stars: 1284, Commits: 2310, PRs: 187, Issues: 64, Repos: 42, Followers: 356 },
    langs: [['Python', '#3572A5', 41.2], ['TypeScript', '#3178c6', 24.5], ['C#', '#178600', 14.1], ['HTML', '#e34c26', 9.8], ['GLSL', '#5686a5', 6.3], ['CSS', '#663399', 4.1]].map(([name, color, pct]) => ({ name, color, pct })),
    total: weeks.flat().reduce((p, q) => p + q, 0), weeks,
  };
}

const arg = process.argv[2];
const data = arg === '--demo' ? demoData() : await (() => {
  const login = arg || process.env.GITHUB_REPOSITORY_OWNER, token = process.env.GITHUB_TOKEN;
  if (!login || !token) throw new Error('Need GITHUB_TOKEN and a login (argument or GITHUB_REPOSITORY_OWNER). Use --demo for fake data.');
  return fetchData(login, token);
})();

mkdirSync('assets', { recursive: true });
for (const [name, svg] of Object.entries({ banner: banner(data), stats: stats(data), langs: langs(data), city: islands(data) })) {
  assert(svg.startsWith('<svg') && svg.endsWith('</svg>') && !/undefined|NaN/.test(svg), `${name}.svg came out malformed`);
  writeFileSync(`assets/${name}.svg`, svg);
  console.log(`assets/${name}.svg  ${(svg.length / 1024).toFixed(1)} KB`);
}
