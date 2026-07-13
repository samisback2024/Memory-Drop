// A small, original procedural avatar system — every face is built from
// SVG primitives combined by a seed, not sourced from anywhere. Ten
// category "silhouettes" (bear ears, cat ears, a donut shape, ...) share
// one consistent cute visual language (round faces, dot/sparkle eyes,
// blush, a simple smile) so the whole set reads as one coherent library
// rather than ten unrelated styles. Faces are deterministic: the same
// (categoryId, index) always renders the same face, so a chosen avatar
// looks the same every time it's regenerated for upload.

export interface AvatarCategory {
  id: string;
  label: string;
  emoji: string;
}

export const AVATAR_CATEGORIES: AvatarCategory[] = [
  { id: 'bears', label: 'Cuddly Bears', emoji: '🐻' },
  { id: 'cats', label: 'Cool Cats', emoji: '🐱' },
  { id: 'bunnies', label: 'Bunny Pals', emoji: '🐰' },
  { id: 'foxes', label: 'Fox Friends', emoji: '🦊' },
  { id: 'pandas', label: 'Panda Buddies', emoji: '🐼' },
  { id: 'puppies', label: 'Puppy Love', emoji: '🐶' },
  { id: 'sweets', label: 'Sweet Treats', emoji: '🍩' },
  { id: 'stars', label: 'Starry Night', emoji: '⭐' },
  { id: 'garden', label: 'Garden Friends', emoji: '🌸' },
  { id: 'ocean', label: 'Ocean Buddies', emoji: '🐠' },
];

export const FACES_PER_CATEGORY = 10;

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — same seed always produces the same face.
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let s = seed | 0;
  return function (): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(rnd: () => number, arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];

// ---------------------------------------------------------------------------
// Shared face features — every category draws from the same eye/mouth/
// blush vocabulary so the library feels like one product.
// ---------------------------------------------------------------------------
const EYE_STYLES = ['round', 'happy', 'sparkle', 'wink'] as const;
const MOUTH_STYLES = ['smile', 'small', 'kitten'] as const;

function drawEyes(style: (typeof EYE_STYLES)[number], cy: number, dx: number, color: string): string {
  const l = 50 - dx, r = 50 + dx;
  if (style === 'happy') {
    return `<path d="M ${l - 5} ${cy} Q ${l} ${cy - 7} ${l + 5} ${cy}" stroke="${color}" stroke-width="3.4" fill="none" stroke-linecap="round"/>` +
      `<path d="M ${r - 5} ${cy} Q ${r} ${cy - 7} ${r + 5} ${cy}" stroke="${color}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
  }
  if (style === 'wink') {
    return `<circle cx="${l}" cy="${cy}" r="3.6" fill="${color}"/><circle cx="${l}" cy="${cy - 1}" r="1.1" fill="#fff"/>` +
      `<path d="M ${r - 5} ${cy} Q ${r} ${cy - 6} ${r + 5} ${cy}" stroke="${color}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  }
  if (style === 'sparkle') {
    return `<circle cx="${l}" cy="${cy}" r="4" fill="${color}"/><circle cx="${l - 1.2}" cy="${cy - 1.4}" r="1.3" fill="#fff"/><circle cx="${l + 1.4}" cy="${cy + 1}" r="0.7" fill="#fff"/>` +
      `<circle cx="${r}" cy="${cy}" r="4" fill="${color}"/><circle cx="${r - 1.2}" cy="${cy - 1.4}" r="1.3" fill="#fff"/><circle cx="${r + 1.4}" cy="${cy + 1}" r="0.7" fill="#fff"/>`;
  }
  return `<ellipse cx="${l}" cy="${cy}" rx="3.4" ry="4.4" fill="${color}"/><circle cx="${l - 1}" cy="${cy - 1.4}" r="1" fill="#fff"/>` +
    `<ellipse cx="${r}" cy="${cy}" rx="3.4" ry="4.4" fill="${color}"/><circle cx="${r - 1}" cy="${cy - 1.4}" r="1" fill="#fff"/>`;
}

function drawMouth(style: (typeof MOUTH_STYLES)[number], cy: number, color: string): string {
  if (style === 'small') return `<ellipse cx="50" cy="${cy}" rx="3.2" ry="2.4" fill="${color}"/>`;
  if (style === 'kitten') return `<path d="M 44 ${cy - 2} Q 47 ${cy + 2} 50 ${cy - 2} Q 53 ${cy + 2} 56 ${cy - 2}" stroke="${color}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  return `<path d="M 42 ${cy - 3} Q 50 ${cy + 5} 58 ${cy - 3}" stroke="${color}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
}

function drawBlush(cx1: number, cx2: number, cy: number, color: string): string {
  return `<ellipse cx="${cx1}" cy="${cy}" rx="5" ry="3" fill="${color}" opacity="0.45"/><ellipse cx="${cx2}" cy="${cy}" rx="5" ry="3" fill="${color}" opacity="0.45"/>`;
}

interface FaceParams {
  rnd: () => number;
  base: string;
  ink: string;
  blush: string;
}

function buildFace(p: FaceParams, extra: string, headRadius = 32, eyeDx = 12, eyeCy = 50, mouthCy = 62, blushCy = 58): string {
  const eyeStyle = pick(p.rnd, EYE_STYLES);
  const mouthStyle = pick(p.rnd, MOUTH_STYLES);
  const showBlush = p.rnd() > 0.35;
  return `
    ${extra}
    <circle cx="50" cy="52" r="${headRadius}" fill="${p.base}"/>
    ${showBlush ? drawBlush(50 - eyeDx - 4, 50 + eyeDx + 4, blushCy, p.blush) : ''}
    ${drawEyes(eyeStyle, eyeCy, eyeDx, p.ink)}
    ${drawMouth(mouthStyle, mouthCy, p.ink)}
  `;
}

const svgWrap = (inner: string): string => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

// ---------------------------------------------------------------------------
// Category palettes — each a { base, blush } pair, ink is always a soft
// near-black so features stay legible on every base color.
// ---------------------------------------------------------------------------
const INK = '#3A2E28';

const PALETTES: Record<string, { base: string; blush: string; accent: string }[]> = {
  bears: [
    { base: '#D9A066', blush: '#E88B6B', accent: '#8B5A3C' },
    { base: '#C88A5E', blush: '#E8825F', accent: '#6B4530' },
    { base: '#E8C9A0', blush: '#E89B8A', accent: '#A9784F' },
    { base: '#B4784A', blush: '#E87B5F', accent: '#5C3B24' },
    { base: '#F0D9B5', blush: '#E8A98A', accent: '#C79A66' },
  ],
  cats: [
    { base: '#E8B84B', blush: '#E87B7B', accent: '#B4841F' },
    { base: '#8B8B93', blush: '#E88BA8', accent: '#5C5C63' },
    { base: '#F2E4CC', blush: '#E89B8A', accent: '#D4B483' },
    { base: '#4A4550', blush: '#C77BE8', accent: '#2E2A33' },
    { base: '#E88B5D', blush: '#E85D5D', accent: '#B4581F' },
  ],
  bunnies: [
    { base: '#F5E0E8', blush: '#E87BA8', accent: '#E0B8CC' },
    { base: '#E8E0F5', blush: '#B48BE8', accent: '#C7B8E0' },
    { base: '#FFF4E0', blush: '#E8B84B', accent: '#F0D9A8' },
    { base: '#E0F0EA', blush: '#7BC79E', accent: '#B8E0CC' },
    { base: '#F5F0E8', blush: '#D9A8E8', accent: '#E0D4B8' },
  ],
  foxes: [
    { base: '#E8824B', blush: '#E85D5D', accent: '#B4551F' },
    { base: '#D9692E', blush: '#E85D4B', accent: '#8B3E17' },
    { base: '#E89B5D', blush: '#E8735D', accent: '#B4671F' },
    { base: '#C7551F', blush: '#E8503A', accent: '#7A3312' },
    { base: '#F0A96B', blush: '#E8825D', accent: '#C7823E' },
  ],
  pandas: [
    { base: '#F5F5F0', blush: '#E87B9E', accent: '#2E2A2E' },
    { base: '#EDEDE5', blush: '#E88BA8', accent: '#3A353A' },
    { base: '#FFFDF7', blush: '#E85D8B', accent: '#242024' },
    { base: '#E8E4D9', blush: '#E89BA8', accent: '#4A454A' },
    { base: '#FAF8F2', blush: '#D97B9E', accent: '#332F33' },
  ],
  puppies: [
    { base: '#E8C99B', blush: '#E88B6B', accent: '#B49563' },
    { base: '#8B6B4A', blush: '#E87B5F', accent: '#5C4530' },
    { base: '#F0E0C7', blush: '#E89B7B', accent: '#C7A874' },
    { base: '#4A3A2E', blush: '#C77B5F', accent: '#2E241C' },
    { base: '#D9B48B', blush: '#E88B6B', accent: '#A9825C' },
  ],
  sweets: [
    { base: '#E8B8CC', blush: '#E87BA8', accent: '#F5DCE4' },
    { base: '#D9C4A8', blush: '#E8A85D', accent: '#8B6539' },
    { base: '#E8DCC9', blush: '#E8B84B', accent: '#F5E8D0' },
    { base: '#C9A8D9', blush: '#B47BE8', accent: '#E4D0F0' },
    { base: '#F0DCC4', blush: '#E88B7B', accent: '#D9B88B' },
  ],
  stars: [
    { base: '#F5D65B', blush: '#E8A85D', accent: '#2A2450' },
    { base: '#B8A8E8', blush: '#D97BE8', accent: '#241E45' },
    { base: '#7BC7E8', blush: '#E87BA8', accent: '#1E2E50' },
    { base: '#F0A9C9', blush: '#E85D9E', accent: '#3A1E45' },
    { base: '#A8E8C9', blush: '#7BE0A8', accent: '#1E4530' },
  ],
  garden: [
    { base: '#E8A9C4', blush: '#E85D8B', accent: '#7BC77B' },
    { base: '#F5E0A9', blush: '#E8A85D', accent: '#8BC77B' },
    { base: '#C9A9E8', blush: '#B47BE8', accent: '#7BC79E' },
    { base: '#A9D9E8', blush: '#5DB4E8', accent: '#7BC77B' },
    { base: '#F5C9A9', blush: '#E8825D', accent: '#8BC77B' },
  ],
  ocean: [
    { base: '#7BC7E8', blush: '#E87BA8', accent: '#3E8FB4' },
    { base: '#5DA8D9', blush: '#E89B7B', accent: '#2E6F94' },
    { base: '#A9E0D9', blush: '#E87B9E', accent: '#5CB4A8' },
    { base: '#4B8FB4', blush: '#F0A96B', accent: '#2A5C74' },
    { base: '#9BD9E0', blush: '#E88B7B', accent: '#4B9EAB' },
  ],
};

// ---------------------------------------------------------------------------
// Per-category silhouette — ears/topper/pattern drawn behind the shared
// buildFace() head, using that category's palette entry.
// ---------------------------------------------------------------------------
function silBears(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<circle cx="24" cy="26" r="10" fill="${c.base}"/><circle cx="24" cy="26" r="5" fill="${c.accent}"/>` +
    `<circle cx="76" cy="26" r="10" fill="${c.base}"/><circle cx="76" cy="26" r="5" fill="${c.accent}"/>`;
}
function silCats(rnd: () => number, c: { base: string; accent: string }): string {
  const whiskers = rnd() > 0.4
    ? `<line x1="8" y1="56" x2="24" y2="54" stroke="${c.accent}" stroke-width="1" opacity="0.6"/><line x1="8" y1="62" x2="24" y2="61" stroke="${c.accent}" stroke-width="1" opacity="0.6"/>` +
      `<line x1="92" y1="56" x2="76" y2="54" stroke="${c.accent}" stroke-width="1" opacity="0.6"/><line x1="92" y1="62" x2="76" y2="61" stroke="${c.accent}" stroke-width="1" opacity="0.6"/>`
    : '';
  return `<polygon points="20,32 28,10 38,30" fill="${c.base}"/><polygon points="62,30 72,10 80,32" fill="${c.base}"/>${whiskers}`;
}
function silBunnies(rnd: () => number, c: { base: string; accent: string }): string {
  const droopy = rnd() > 0.5;
  if (droopy) {
    return `<ellipse cx="30" cy="20" rx="7" ry="17" fill="${c.base}" transform="rotate(-18 30 20)"/><ellipse cx="70" cy="20" rx="7" ry="17" fill="${c.base}" transform="rotate(18 70 20)"/>`;
  }
  return `<ellipse cx="34" cy="14" rx="7" ry="20" fill="${c.base}"/><ellipse cx="34" cy="14" rx="3.4" ry="15" fill="${c.accent}" opacity="0.5"/>` +
    `<ellipse cx="66" cy="14" rx="7" ry="20" fill="${c.base}"/><ellipse cx="66" cy="14" rx="3.4" ry="15" fill="${c.accent}" opacity="0.5"/>`;
}
function silFoxes(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<polygon points="20,30 30,6 40,28" fill="${c.base}"/><polygon points="25,26 30,12 35,25" fill="${c.accent}"/>` +
    `<polygon points="60,28 70,6 80,30" fill="${c.base}"/><polygon points="65,25 70,12 75,26" fill="${c.accent}"/>`;
}
function silPandas(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<circle cx="24" cy="24" r="10" fill="${c.accent}"/><circle cx="76" cy="24" r="10" fill="${c.accent}"/>` +
    `<ellipse cx="41" cy="49" rx="7" ry="9" fill="${c.accent}" transform="rotate(-12 41 49)"/><ellipse cx="59" cy="49" rx="7" ry="9" fill="${c.accent}" transform="rotate(12 59 49)"/>`;
}
function silPuppies(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<ellipse cx="21" cy="34" rx="9" ry="18" fill="${c.accent}" transform="rotate(-16 21 34)"/><ellipse cx="79" cy="34" rx="9" ry="18" fill="${c.accent}" transform="rotate(16 79 34)"/>`;
}
function silSweets(rnd: () => number, c: { base: string; accent: string }): string {
  const kind = pick(rnd, ['donut', 'cupcake']);
  if (kind === 'donut') {
    return `<circle cx="50" cy="42" r="9" fill="#FCF8F0"/>` +
      `<circle cx="34" cy="34" r="2.4" fill="${c.accent}"/><circle cx="66" cy="34" r="2.4" fill="${c.accent}"/><circle cx="40" cy="26" r="2" fill="${c.accent}"/><circle cx="60" cy="26" r="2" fill="${c.accent}"/><circle cx="50" cy="22" r="2.2" fill="${c.accent}"/>`;
  }
  return `<path d="M 32 30 Q 50 8 68 30 Z" fill="#FCF8F0"/><circle cx="50" cy="14" r="3" fill="${c.accent}"/>`;
}
function silStars(_rnd: () => number, c: { base: string; accent: string }): string {
  const pts = [0, 72, 144, 216, 288].map((a, i) => {
    const r = i % 2 === 0 ? 40 : 18;
    const rad = (a - 90) * (Math.PI / 180);
    return `${50 + r * Math.cos(rad)},${52 + r * Math.sin(rad)}`;
  }).join(' ');
  return `<polygon points="${pts}" fill="${c.base}" opacity="0.28"/>`;
}
function silGarden(_rnd: () => number, c: { base: string; accent: string }): string {
  let petals = '';
  for (let i = 0; i < 6; i++) {
    const a = (i * 60) * (Math.PI / 180);
    const x = 50 + 34 * Math.cos(a), y = 52 + 34 * Math.sin(a);
    petals += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="9" ry="6" fill="${c.accent}" opacity="0.55" transform="rotate(${i * 60} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }
  return petals;
}
function silOcean(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<path d="M 16 46 Q 4 52 16 58 Q 10 52 16 46 Z" fill="${c.accent}"/><path d="M 84 46 Q 96 52 84 58 Q 90 52 84 46 Z" fill="${c.accent}"/>` +
    `<circle cx="20" cy="18" r="2.4" fill="${c.base}" opacity="0.6"/><circle cx="80" cy="14" r="1.8" fill="${c.base}" opacity="0.6"/><circle cx="72" cy="22" r="1.2" fill="${c.base}" opacity="0.6"/>`;
}

const SILHOUETTES: Record<string, (rnd: () => number, c: { base: string; accent: string }) => string> = {
  bears: silBears, cats: silCats, bunnies: silBunnies, foxes: silFoxes, pandas: silPandas,
  puppies: silPuppies, sweets: silSweets, stars: silStars, garden: silGarden, ocean: silOcean,
};

// A category index folded into the seed so the same face-index in two
// different categories never coincidentally rolls identical features.
function categorySeed(categoryId: string, index: number): number {
  let hash = 0;
  for (let i = 0; i < categoryId.length; i++) hash = (hash * 31 + categoryId.charCodeAt(i)) | 0;
  return (hash ^ (index * 7919)) >>> 0;
}

export function generateAvatarSvg(categoryId: string, index: number): string {
  const rnd = mulberry32(categorySeed(categoryId, index));
  const palettes = PALETTES[categoryId] ?? PALETTES.bears;
  const c = pick(rnd, palettes);
  const sil = SILHOUETTES[categoryId] ?? silBears;
  const extra = sil(rnd, c);
  return svgWrap(buildFace({ rnd, base: c.base, ink: INK, blush: c.blush }, extra));
}

export function getAvatarFaces(categoryId: string): { index: number; svg: string }[] {
  return Array.from({ length: FACES_PER_CATEGORY }, (_, i) => ({ index: i, svg: generateAvatarSvg(categoryId, i) }));
}

// ---------------------------------------------------------------------------
// Rasterize a generated face to a real PNG File — reuses the exact same
// upload pipeline every other avatar photo goes through (see
// AvatarUpload.tsx), so nothing downstream needs to know an avatar was
// generated rather than photographed.
// ---------------------------------------------------------------------------
export function svgToPngFile(svg: string, size: number, filename: string): Promise<File> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Canvas is not supported in this browser.')); return; }
      // Soft neutral backdrop — the generated faces don't fill the full
      // square, and PNG-with-transparency looks wrong composited onto
      // arbitrary page backgrounds elsewhere in the app.
      ctx.fillStyle = '#FAF7F2';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob(pngBlob => {
        if (!pngBlob) { reject(new Error('Could not generate an image from this avatar.')); return; }
        resolve(new File([pngBlob], filename, { type: 'image/png' }));
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not render this avatar.')); };
    img.src = url;
  });
}
