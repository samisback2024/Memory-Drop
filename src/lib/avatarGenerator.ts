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
  { id: 'koalas', label: 'Koala Cuddles', emoji: '🐨' },
  { id: 'penguins', label: 'Penguin Waddle', emoji: '🐧' },
  { id: 'owls', label: 'Night Owls', emoji: '🦉' },
  { id: 'hedgehogs', label: 'Prickly Pals', emoji: '🦔' },
  { id: 'raccoons', label: 'Raccoon Rascals', emoji: '🦝' },
  { id: 'deer', label: 'Forest Fawns', emoji: '🦌' },
  { id: 'lions', label: 'Little Lions', emoji: '🦁' },
  { id: 'tigers', label: 'Tiger Cubs', emoji: '🐯' },
  { id: 'elephants', label: 'Gentle Giants', emoji: '🐘' },
  { id: 'monkeys', label: 'Monkey Business', emoji: '🐵' },
  { id: 'sheep', label: 'Wooly Sheep', emoji: '🐑' },
  { id: 'cows', label: 'Moo Crew', emoji: '🐮' },
  { id: 'pigs', label: 'Piglet Squad', emoji: '🐷' },
  { id: 'chickens', label: 'Chirpy Chicks', emoji: '🐥' },
  { id: 'ducks', label: 'Duck Pond', emoji: '🦆' },
  { id: 'frogs', label: 'Lily Pad Frogs', emoji: '🐸' },
  { id: 'turtles', label: 'Turtle Trail', emoji: '🐢' },
  { id: 'dragons', label: 'Baby Dragons', emoji: '🐲' },
  { id: 'unicorns', label: 'Unicorn Dreams', emoji: '🦄' },
  { id: 'dinosaurs', label: 'Dino Pals', emoji: '🦕' },
  { id: 'robots', label: 'Robo Friends', emoji: '🤖' },
  { id: 'aliens', label: 'Space Aliens', emoji: '👽' },
  { id: 'ghosts', label: 'Friendly Ghosts', emoji: '👻' },
  { id: 'pumpkins', label: 'Pumpkin Patch', emoji: '🎃' },
  { id: 'clouds', label: 'Cloud Nine', emoji: '☁️' },
  { id: 'rainbows', label: 'Rainbow Bright', emoji: '🌈' },
  { id: 'moons', label: 'Moonlit', emoji: '🌙' },
  { id: 'planets', label: 'Planet Hoppers', emoji: '🪐' },
  { id: 'cacti', label: 'Desert Cacti', emoji: '🌵' },
  { id: 'mushrooms', label: 'Mushroom Grove', emoji: '🍄' },
  { id: 'strawberries', label: 'Berry Sweet', emoji: '🍓' },
  { id: 'cookies', label: 'Cookie Jar', emoji: '🍪' },
  { id: 'icecream', label: 'Ice Cream Social', emoji: '🍦' },
  { id: 'bees', label: 'Busy Bees', emoji: '🐝' },
  { id: 'butterflies', label: 'Butterfly Garden', emoji: '🦋' },
  { id: 'ladybugs', label: 'Lucky Ladybugs', emoji: '🐞' },
  { id: 'snails', label: 'Snail Trail', emoji: '🐌' },
  { id: 'crabs', label: 'Beach Crabs', emoji: '🦀' },
  { id: 'jellyfish', label: 'Jellyfish Drift', emoji: '🎐' },
  { id: 'narwhals', label: 'Narwhal Bay', emoji: '🐋' },
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
  koalas: [
    { base: '#B8B8BE', blush: '#E88BA8', accent: '#8B8B94' },
    { base: '#D0D0D6', blush: '#E87B9E', accent: '#9E9EA6' },
    { base: '#9E9EA8', blush: '#E89BAB', accent: '#6B6B75' },
    { base: '#E4E4E8', blush: '#E85D8B', accent: '#B4B4BC' },
    { base: '#C4C4CC', blush: '#E8A8B8', accent: '#84848E' },
  ],
  penguins: [
    { base: '#F5F5F0', blush: '#F0A65D', accent: '#2E2E38' },
    { base: '#FFFDF7', blush: '#E8925D', accent: '#242430' },
    { base: '#EDEDE8', blush: '#F0B45D', accent: '#3A3A46' },
    { base: '#F0EFE5', blush: '#E87B5D', accent: '#1E1E28' },
    { base: '#FAF8F0', blush: '#F0A040', accent: '#2A2A36' },
  ],
  owls: [
    { base: '#C9A374', blush: '#E8A85D', accent: '#8B6539' },
    { base: '#B48B5D', blush: '#E8925D', accent: '#6B4A28' },
    { base: '#D9BC94', blush: '#E8B87B', accent: '#A97F4B' },
    { base: '#8B6F4E', blush: '#E88B5D', accent: '#553D22' },
    { base: '#E0C9A4', blush: '#E8C48B', accent: '#B4966B' },
  ],
  hedgehogs: [
    { base: '#D9B896', blush: '#E88B7B', accent: '#8B6B47' },
    { base: '#C4A17E', blush: '#E87B6B', accent: '#6B4F30' },
    { base: '#E8D0B0', blush: '#E89B7B', accent: '#A9835C' },
    { base: '#B4906A', blush: '#E8735D', accent: '#5C4127' },
    { base: '#F0E0C4', blush: '#E8A78B', accent: '#C7A277' },
  ],
  raccoons: [
    { base: '#8B8B85', blush: '#E88B9E', accent: '#2E2E2E' },
    { base: '#A5A59C', blush: '#E87B9E', accent: '#3A3A3A' },
    { base: '#727268', blush: '#E89BA8', accent: '#232323' },
    { base: '#B8B8AE', blush: '#E85D8B', accent: '#454545' },
    { base: '#9E9E92', blush: '#E8A8B4', accent: '#282828' },
  ],
  deer: [
    { base: '#D9A874', blush: '#E88B6B', accent: '#8B6339' },
    { base: '#C4915D', blush: '#E87B5D', accent: '#6B4A28' },
    { base: '#E8C296', blush: '#E89B7B', accent: '#A97F52' },
    { base: '#B47F4E', blush: '#E8735D', accent: '#553D22' },
    { base: '#F0D9B4', blush: '#E8A98B', accent: '#C79A66' },
  ],
  lions: [
    { base: '#F0C25D', blush: '#E8825D', accent: '#B4841F' },
    { base: '#E8A93E', blush: '#E8725D', accent: '#A96E1A' },
    { base: '#F5D488', blush: '#E89373', accent: '#C79433' },
    { base: '#D99424', blush: '#E86B5D', accent: '#8F5F14' },
    { base: '#F5C466', blush: '#E88A5D', accent: '#BF8A26' },
  ],
  tigers: [
    { base: '#F0A03E', blush: '#E85D5D', accent: '#2E2420' },
    { base: '#E88B24', blush: '#E8525D', accent: '#241C18' },
    { base: '#F5B45D', blush: '#E8735D', accent: '#332822' },
    { base: '#D97A1A', blush: '#E8465D', accent: '#1E1712' },
    { base: '#F5C088', blush: '#E88A6B', accent: '#3E322A' },
  ],
  elephants: [
    { base: '#B4BCC7', blush: '#E88BA8', accent: '#7E8894' },
    { base: '#9EA8B4', blush: '#E87B9E', accent: '#68727E' },
    { base: '#C9D0D9', blush: '#E89BAB', accent: '#93A0AB' },
    { base: '#8891A0', blush: '#E85D8B', accent: '#565F6B' },
    { base: '#D4DAE0', blush: '#E8A8B8', accent: '#A8B2BC' },
  ],
  monkeys: [
    { base: '#C4915D', blush: '#E8825D', accent: '#8B5A33' },
    { base: '#B47F4E', blush: '#E8735D', accent: '#6B4527' },
    { base: '#D9A874', blush: '#E8927B', accent: '#A97544' },
    { base: '#A56F3E', blush: '#E86B5D', accent: '#5C3B1E' },
    { base: '#E8C296', blush: '#E8A18B', accent: '#C79A66' },
  ],
  sheep: [
    { base: '#F5F0E4', blush: '#E8A89E', accent: '#4A4038' },
    { base: '#EDE7D6', blush: '#E8988B', accent: '#3A322C' },
    { base: '#FFFBF0', blush: '#E8B8A8', accent: '#544A40' },
    { base: '#E0D8C4', blush: '#E8877B', accent: '#2E2822' },
    { base: '#F5EFE0', blush: '#E8A895', accent: '#443C34' },
  ],
  cows: [
    { base: '#F5F0EA', blush: '#E88B9E', accent: '#4A3A2E' },
    { base: '#EDE5DC', blush: '#E87B9E', accent: '#3A2C22' },
    { base: '#FFF8F0', blush: '#E89BAB', accent: '#554438' },
    { base: '#E0D4C7', blush: '#E85D8B', accent: '#2E2318' },
    { base: '#F5EAE0', blush: '#E8A8B4', accent: '#443628' },
  ],
  pigs: [
    { base: '#F0B8C4', blush: '#E85D7B', accent: '#C4788A' },
    { base: '#E89EAF', blush: '#E8506E', accent: '#B4657A' },
    { base: '#F5CAD4', blush: '#E8748E', accent: '#D998A8' },
    { base: '#D98599', blush: '#E8425D', accent: '#A9556A' },
    { base: '#F0C4D0', blush: '#E88AA0', accent: '#C48094' },
  ],
  chickens: [
    { base: '#F5E0A0', blush: '#E85D5D', accent: '#E8925D' },
    { base: '#F0D488', blush: '#E8525D', accent: '#E8825D' },
    { base: '#FFEAB4', blush: '#E8737B', accent: '#F0A06B' },
    { base: '#E8C96B', blush: '#E8465D', accent: '#D9762E' },
    { base: '#F5DC98', blush: '#E88A7B', accent: '#E89050' },
  ],
  ducks: [
    { base: '#F5D65B', blush: '#E8925D', accent: '#E8862E' },
    { base: '#F0C43E', blush: '#E8825D', accent: '#D9741F' },
    { base: '#FFE07B', blush: '#E8A273', accent: '#F0964A' },
    { base: '#D9B424', blush: '#E8725D', accent: '#BF6417' },
    { base: '#F5D888', blush: '#E8A26B', accent: '#E87E38' },
  ],
  frogs: [
    { base: '#8BC77B', blush: '#E87B9E', accent: '#5C9450' },
    { base: '#7BB468', blush: '#E86B8E', accent: '#4C8040' },
    { base: '#A0D992', blush: '#E88BA8', accent: '#6EA560' },
    { base: '#68A055', blush: '#E85D7B', accent: '#3E6E32' },
    { base: '#B4E0A5', blush: '#E89BB4', accent: '#7EB86E' },
  ],
  turtles: [
    { base: '#8BB47B', blush: '#E8A85D', accent: '#4A7A3E' },
    { base: '#7BA068', blush: '#E8925D', accent: '#3E6432' },
    { base: '#A0C792', blush: '#E8B87B', accent: '#5C9450' },
    { base: '#689055', blush: '#E8825D', accent: '#2E5024' },
    { base: '#B4D4A5', blush: '#E8C48B', accent: '#6EA55E' },
  ],
  dragons: [
    { base: '#7BC79E', blush: '#E85D8B', accent: '#3E8F5F' },
    { base: '#5DA87F', blush: '#E8527B', accent: '#2E7048' },
    { base: '#96D9B4', blush: '#E86B9E', accent: '#57A472' },
    { base: '#4B8F68', blush: '#E8456B', accent: '#245C38' },
    { base: '#A9E0C4', blush: '#E87BAB', accent: '#69B486' },
  ],
  unicorns: [
    { base: '#F5E0F0', blush: '#E87BA8', accent: '#D9A8E8' },
    { base: '#E0E8F5', blush: '#B48BE8', accent: '#A8C4E8' },
    { base: '#FFF0F5', blush: '#E85D9E', accent: '#F0C4E0' },
    { base: '#E8D9F5', blush: '#D97BE8', accent: '#C9A8E8' },
    { base: '#F0E8FF', blush: '#8BA8E8', accent: '#B8C9F0' },
  ],
  dinosaurs: [
    { base: '#7BB48B', blush: '#E8A85D', accent: '#3E7A50' },
    { base: '#5D9E6F', blush: '#E8925D', accent: '#2E6438' },
    { base: '#96D0A4', blush: '#E8B87B', accent: '#5C9E6E' },
    { base: '#4A8459', blush: '#E8825D', accent: '#245030' },
    { base: '#A9E0B8', blush: '#E8C48B', accent: '#6EAB7E' },
  ],
  robots: [
    { base: '#A8B4C4', blush: '#E85D8B', accent: '#5D7BE8' },
    { base: '#8B98AB', blush: '#E8527B', accent: '#4A68D9' },
    { base: '#C4CDD9', blush: '#E86B9E', accent: '#7B94F0' },
    { base: '#727F94', blush: '#E8456B', accent: '#3552B4' },
    { base: '#D0D8E0', blush: '#E87BAB', accent: '#94A9F5' },
  ],
  aliens: [
    { base: '#A8E0A0', blush: '#E87BA8', accent: '#5DB454' },
    { base: '#8BD97E', blush: '#E86B9E', accent: '#4A9E40' },
    { base: '#C4F0BC', blush: '#E88BB4', accent: '#7EC774' },
    { base: '#6EC461', blush: '#E85D8B', accent: '#3E8434' },
    { base: '#B4E8AB', blush: '#E89BC0', accent: '#6EBC63' },
  ],
  ghosts: [
    { base: '#F0EEF8', blush: '#B48BE8', accent: '#D0C4E8' },
    { base: '#E8E4F5', blush: '#A87BE8', accent: '#C4B4E0' },
    { base: '#FAF8FF', blush: '#C49EE8', accent: '#DED4F0' },
    { base: '#DED8F0', blush: '#9E6FE8', accent: '#B8A4D9' },
    { base: '#F5F2FA', blush: '#BB94E8', accent: '#D4C4EE' },
  ],
  pumpkins: [
    { base: '#F0964A', blush: '#E85D5D', accent: '#8B6539' },
    { base: '#E8822E', blush: '#E8525D', accent: '#6B4A28' },
    { base: '#F5A96B', blush: '#E8737B', accent: '#A97F52' },
    { base: '#D9711A', blush: '#E8465D', accent: '#553D22' },
    { base: '#F5B888', blush: '#E88A7B', accent: '#5C4127' },
  ],
  clouds: [
    { base: '#F0F4FA', blush: '#E8A8C4', accent: '#B4C4D9' },
    { base: '#E4EBF5', blush: '#E898B8', accent: '#9AAFCC' },
    { base: '#FAFCFF', blush: '#E8B8CE', accent: '#C4D4E8' },
    { base: '#D8E2F0', blush: '#E88AAB', accent: '#849DBF' },
    { base: '#F0F2FA', blush: '#E8A0BE', accent: '#AABEDA' },
  ],
  rainbows: [
    { base: '#F5D65B', blush: '#E85D8B', accent: '#7BC7E8' },
    { base: '#E8A93E', blush: '#E8527B', accent: '#5DA8D9' },
    { base: '#F0C46B', blush: '#E86B9E', accent: '#8BC7E8' },
    { base: '#D99424', blush: '#E8456B', accent: '#4B8FB4' },
    { base: '#F5D084', blush: '#E87BAB', accent: '#9BD9E0' },
  ],
  moons: [
    { base: '#D9D4E8', blush: '#E8B85D', accent: '#8B84A5' },
    { base: '#C4BEDA', blush: '#E8A83E', accent: '#726B8F' },
    { base: '#E8E4F0', blush: '#E8C46B', accent: '#A49DBC' },
    { base: '#AFA8C7', blush: '#E89924', accent: '#5C5578' },
    { base: '#DED8EE', blush: '#E8B888', accent: '#948CB0' },
  ],
  planets: [
    { base: '#B48BE8', blush: '#E8825D', accent: '#7BC7E8' },
    { base: '#9E6FE8', blush: '#E8725D', accent: '#5DA8D9' },
    { base: '#C4A8F0', blush: '#E89373', accent: '#8BC7E8' },
    { base: '#8A5CD9', blush: '#E86B5D', accent: '#4B8FB4' },
    { base: '#D0BCF5', blush: '#E88A5D', accent: '#9BD9E0' },
  ],
  cacti: [
    { base: '#7BB47E', blush: '#E87B9E', accent: '#E8A85D' },
    { base: '#5D9E60', blush: '#E86B8E', accent: '#E8925D' },
    { base: '#96D098', blush: '#E88BA8', accent: '#E8B87B' },
    { base: '#4A8448', blush: '#E85D7B', accent: '#E8825D' },
    { base: '#A9E0AB', blush: '#E89BB4', accent: '#F0C48B' },
  ],
  mushrooms: [
    { base: '#E8825D', blush: '#E85D5D', accent: '#FCF8F0' },
    { base: '#D96E4B', blush: '#E8525D', accent: '#F0EAD9' },
    { base: '#F09B7B', blush: '#E8737B', accent: '#FFFDF7' },
    { base: '#C7593A', blush: '#E8465D', accent: '#E8DEC7' },
    { base: '#F0A98B', blush: '#E88A7B', accent: '#F5F0E4' },
  ],
  strawberries: [
    { base: '#E85D6B', blush: '#E8465D', accent: '#7BC77B' },
    { base: '#D9495A', blush: '#E83E52', accent: '#68A055' },
    { base: '#F07685', blush: '#E85A6B', accent: '#8BD992' },
    { base: '#C7384A', blush: '#D9324A', accent: '#549040' },
    { base: '#F08A97', blush: '#E86E7E', accent: '#9EE0A0' },
  ],
  cookies: [
    { base: '#D9A874', blush: '#E8825D', accent: '#5C3A24' },
    { base: '#C4915D', blush: '#E8725D', accent: '#4A2E1A' },
    { base: '#E8C296', blush: '#E8927B', accent: '#6B4530' },
    { base: '#B47F4E', blush: '#E8635D', accent: '#3A2414' },
    { base: '#F0D9B4', blush: '#E8A08B', accent: '#7C5238' },
  ],
  icecream: [
    { base: '#F5C9D4', blush: '#E85D8B', accent: '#D9A874' },
    { base: '#F0AFC0', blush: '#E8527B', accent: '#C4915D' },
    { base: '#FADCE4', blush: '#E8749E', accent: '#E8C296' },
    { base: '#E895A9', blush: '#E8456B', accent: '#B47F4E' },
    { base: '#F5C0D0', blush: '#E88AAB', accent: '#F0D9B4' },
  ],
  bees: [
    { base: '#F5D65B', blush: '#E8825D', accent: '#2E2A22' },
    { base: '#F0C43E', blush: '#E8725D', accent: '#232018' },
    { base: '#FFE07B', blush: '#E8937B', accent: '#332E24' },
    { base: '#D9B424', blush: '#E8635D', accent: '#1C1912' },
    { base: '#F5D888', blush: '#E8A28B', accent: '#403A2E' },
  ],
  butterflies: [
    { base: '#E88BC4', blush: '#B48BE8', accent: '#7BC7E8' },
    { base: '#D975B4', blush: '#9E6FE8', accent: '#5DA8D9' },
    { base: '#F0A0D4', blush: '#C4A8F0', accent: '#8BC7E8' },
    { base: '#C7609E', blush: '#8A5CD9', accent: '#4B8FB4' },
    { base: '#F0B4DC', blush: '#D0BCF5', accent: '#9BD9E0' },
  ],
  ladybugs: [
    { base: '#E8465D', blush: '#F5D65B', accent: '#2A2420' },
    { base: '#D9384A', blush: '#F0C43E', accent: '#201C18' },
    { base: '#F06678', blush: '#FFE07B', accent: '#332C26' },
    { base: '#C72E40', blush: '#D9B424', accent: '#181512' },
    { base: '#F0808F', blush: '#F5D888', accent: '#3E362E' },
  ],
  snails: [
    { base: '#D9A874', blush: '#E87B9E', accent: '#8B5A33' },
    { base: '#C4915D', blush: '#E86B8E', accent: '#6B4527' },
    { base: '#E8C296', blush: '#E88BA8', accent: '#A97544' },
    { base: '#B47F4E', blush: '#E85D7B', accent: '#5C3B1E' },
    { base: '#F0D9B4', blush: '#E89BB4', accent: '#C79A66' },
  ],
  crabs: [
    { base: '#E8825D', blush: '#E85D5D', accent: '#B4551F' },
    { base: '#D9692E', blush: '#E8525D', accent: '#8B3E17' },
    { base: '#F09B7B', blush: '#E8737B', accent: '#C7823E' },
    { base: '#C7551F', blush: '#E8465D', accent: '#7A3312' },
    { base: '#F0A96B', blush: '#E88A7B', accent: '#D9915A' },
  ],
  jellyfish: [
    { base: '#E8A8E0', blush: '#B48BE8', accent: '#8B5AB4' },
    { base: '#D98BD9', blush: '#9E6FE8', accent: '#704894' },
    { base: '#F0C4EE', blush: '#C4A8F0', accent: '#A575D0' },
    { base: '#C767C7', blush: '#8A5CD9', accent: '#5C3880' },
    { base: '#F0D0EE', blush: '#D0BCF5', accent: '#B58AE0' },
  ],
  narwhals: [
    { base: '#8BABE8', blush: '#E87BA8', accent: '#E8D65B' },
    { base: '#6D91D9', blush: '#E86B9E', accent: '#E8C43E' },
    { base: '#A5C0F0', blush: '#E88BB4', accent: '#F0DC7B' },
    { base: '#5679C7', blush: '#E85D8B', accent: '#D9B424' },
    { base: '#B0CBF5', blush: '#E89BC0', accent: '#F0E088' },
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

// A handful of "spots near the rim" markings reused across a few
// categories below (cookies, cows, ladybugs, ...) — small circles
// placed right at the head's own radius so roughly half of each pokes
// out past the opaque head fill and stays visible, the same trick that
// makes any peripheral silhouette element visible at all (buildFace
// draws the head circle on top of `extra`, so only what extends past
// its edge survives).
function rimSpots(cx: number, cy: number, count: number, color: string, r = 3): string {
  let out = '';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.3;
    const x = cx + 31 * Math.cos(a), y = cy + 31 * Math.sin(a);
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${color}"/>`;
  }
  return out;
}

function silKoalas(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<circle cx="18" cy="34" r="13" fill="${c.base}"/><circle cx="18" cy="34" r="6" fill="${c.accent}"/>` +
    `<circle cx="82" cy="34" r="13" fill="${c.base}"/><circle cx="82" cy="34" r="6" fill="${c.accent}"/>`;
}
function silPenguins(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<path d="M 14 46 Q -2 58 10 76 Q 14 60 14 46 Z" fill="${c.accent}"/>` +
    `<path d="M 86 46 Q 102 58 90 76 Q 86 60 86 46 Z" fill="${c.accent}"/>`;
}
function silOwls(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<polygon points="18,28 28,4 34,26" fill="${c.base}"/><polygon points="66,26 72,4 82,28" fill="${c.base}"/>` +
    `<circle cx="38" cy="50" r="14" fill="none" stroke="${c.accent}" stroke-width="2.4" opacity="0.5"/><circle cx="62" cy="50" r="14" fill="none" stroke="${c.accent}" stroke-width="2.4" opacity="0.5"/>`;
}
function silHedgehogs(_rnd: () => number, c: { base: string; accent: string }): string {
  let spikes = '';
  for (let i = 0; i < 7; i++) {
    const a = (-160 + i * 26) * (Math.PI / 180);
    const x1 = 50 + 30 * Math.cos(a), y1 = 52 + 30 * Math.sin(a);
    const x2 = 50 + 44 * Math.cos(a), y2 = 52 + 44 * Math.sin(a);
    const x3 = 50 + 30 * Math.cos(a + 0.15), y3 = 52 + 30 * Math.sin(a + 0.15);
    spikes += `<polygon points="${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${x3.toFixed(1)},${y3.toFixed(1)}" fill="${c.accent}"/>`;
  }
  return spikes;
}
function silRaccoons(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<circle cx="22" cy="24" r="10" fill="${c.base}"/><circle cx="78" cy="24" r="10" fill="${c.base}"/>` +
    `<path d="M 90 60 Q 104 66 92 78 Q 100 66 90 60 Z" fill="${c.accent}"/>`;
}
function silDeer(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<path d="M 30 24 Q 24 4 14 8 M 30 24 Q 34 10 26 2" stroke="${c.accent}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<path d="M 70 24 Q 76 4 86 8 M 70 24 Q 66 10 74 2" stroke="${c.accent}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
}
function silLions(_rnd: () => number, c: { base: string; accent: string }): string {
  let mane = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = 50 + 38 * Math.cos(a), y = 52 + 38 * Math.sin(a);
    mane += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="10" ry="7" fill="${c.accent}" opacity="0.85" transform="rotate(${(a * 180) / Math.PI} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }
  return mane;
}
function silTigers(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<circle cx="22" cy="26" r="9" fill="${c.base}"/><circle cx="22" cy="26" r="4" fill="${c.accent}"/>` +
    `<circle cx="78" cy="26" r="9" fill="${c.base}"/><circle cx="78" cy="26" r="4" fill="${c.accent}"/>${rimSpots(50, 52, 5, c.accent, 2.2)}`;
}
function silElephants(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<ellipse cx="10" cy="50" rx="13" ry="19" fill="${c.base}"/><ellipse cx="10" cy="50" rx="7" ry="12" fill="${c.accent}" opacity="0.4"/>` +
    `<ellipse cx="90" cy="50" rx="13" ry="19" fill="${c.base}"/><ellipse cx="90" cy="50" rx="7" ry="12" fill="${c.accent}" opacity="0.4"/>` +
    `<path d="M 50 78 Q 46 92 52 96" stroke="${c.accent}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
}
function silMonkeys(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<circle cx="16" cy="46" r="9" fill="${c.base}"/><circle cx="16" cy="46" r="5" fill="${c.accent}"/>` +
    `<circle cx="84" cy="46" r="9" fill="${c.base}"/><circle cx="84" cy="46" r="5" fill="${c.accent}"/>`;
}
function silSheep(_rnd: () => number, c: { base: string; accent: string }): string {
  let wool = '';
  const pts: [number, number][] = [[26, 14], [42, 6], [58, 6], [74, 14], [16, 30], [84, 30]];
  for (const [x, y] of pts) wool += `<circle cx="${x}" cy="${y}" r="11" fill="${c.base}"/>`;
  return wool;
}
function silCows(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<polygon points="34,18 40,2 46,18" fill="${c.accent}"/><polygon points="54,18 60,2 66,18" fill="${c.accent}"/>` +
    `<ellipse cx="16" cy="42" rx="8" ry="11" fill="${c.base}"/><ellipse cx="84" cy="42" rx="8" ry="11" fill="${c.base}"/>${rimSpots(50, 52, 4, c.accent, 3.4)}`;
}
function silPigs(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<polygon points="18,22 30,8 34,26" fill="${c.base}"/><polygon points="66,26 70,8 82,22" fill="${c.base}"/>` +
    `<path d="M 92 62 Q 100 62 98 70 Q 96 64 92 62 Z" fill="${c.accent}"/>`;
}
function silChickens(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<path d="M 40 16 Q 44 2 48 16 Q 52 2 56 16 Q 60 2 64 16" fill="${c.accent}"/>` +
    `<path d="M 50 80 L 44 90 L 56 90 Z" fill="${c.accent}" opacity="0.9"/>`;
}
function silDucks(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<ellipse cx="50" cy="8" rx="10" ry="6" fill="${c.accent}"/><ellipse cx="12" cy="52" rx="9" ry="14" fill="${c.base}" transform="rotate(-20 12 52)"/><ellipse cx="88" cy="52" rx="9" ry="14" fill="${c.base}" transform="rotate(20 88 52)"/>`;
}
function silFrogs(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<circle cx="34" cy="18" r="11" fill="${c.base}"/><circle cx="66" cy="18" r="11" fill="${c.base}"/>`;
}
function silTurtles(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<path d="M 20 66 Q 50 92 80 66 Q 82 84 50 88 Q 18 84 20 66 Z" fill="${c.accent}"/>${rimSpots(50, 70, 4, c.base, 2.6)}`;
}
function silDragons(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<path d="M 30 22 Q 24 4 32 2 Q 30 14 36 20" fill="${c.accent}"/><path d="M 70 22 Q 76 4 68 2 Q 70 14 64 20" fill="${c.accent}"/>` +
    `<path d="M 10 50 Q -4 46 2 62 Q 6 52 10 50 Z" fill="${c.base}"/><path d="M 90 50 Q 104 46 98 62 Q 94 52 90 50 Z" fill="${c.base}"/>`;
}
function silUnicorns(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<polygon points="46,4 54,4 51,26" fill="${c.accent}"/>` +
    `<path d="M 16 34 Q 4 40 12 52 Q 8 40 16 34 Z" fill="${c.base}"/><path d="M 20 24 Q 6 26 10 40 Q 10 28 20 24 Z" fill="${c.accent}" opacity="0.8"/>`;
}
function silDinosaurs(_rnd: () => number, c: { base: string; accent: string }): string {
  let plates = '';
  const xs = [30, 42, 58, 70];
  for (const x of xs) plates += `<polygon points="${x - 6},20 ${x},2 ${x + 6},20" fill="${c.accent}"/>`;
  return plates;
}
function silRobots(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<line x1="50" y1="18" x2="50" y2="2" stroke="${c.accent}" stroke-width="2.6"/><circle cx="50" cy="0" r="4.4" fill="${c.accent}"/>` +
    `<rect x="10" y="42" width="9" height="18" rx="2" fill="${c.accent}"/><rect x="81" y="42" width="9" height="18" rx="2" fill="${c.accent}"/>`;
}
function silAliens(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<line x1="38" y1="16" x2="30" y2="0" stroke="${c.accent}" stroke-width="2.4"/><circle cx="30" cy="-2" r="3.6" fill="${c.accent}"/>` +
    `<line x1="62" y1="16" x2="70" y2="0" stroke="${c.accent}" stroke-width="2.4"/><circle cx="70" cy="-2" r="3.6" fill="${c.accent}"/>`;
}
function silGhosts(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<path d="M 18 55 L 18 88 Q 26 96 34 88 Q 42 96 50 88 Q 58 96 66 88 Q 74 96 82 88 L 82 55 Z" fill="${c.base}"/>`;
}
function silPumpkins(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<rect x="46" y="0" width="8" height="12" rx="2" fill="${c.accent}"/><path d="M 54 6 Q 66 2 66 12 Q 60 8 54 10 Z" fill="${c.accent}" opacity="0.85"/>`;
}
function silClouds(_rnd: () => number, c: { base: string; accent: string }): string {
  let puffs = '';
  const pts: [number, number][] = [[14, 46], [86, 46], [24, 22], [76, 22], [50, 14]];
  for (const [x, y] of pts) puffs += `<circle cx="${x}" cy="${y}" r="14" fill="${c.base}"/>`;
  return puffs;
}
function silRainbows(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<path d="M 6 40 A 44 44 0 0 1 94 40" stroke="${c.accent}" stroke-width="7" fill="none" opacity="0.8"/>` +
    `<path d="M 16 40 A 34 34 0 0 1 84 40" stroke="${c.base}" stroke-width="6" fill="none" opacity="0.7"/>`;
}
function silMoons(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<circle cx="76" cy="18" r="2.6" fill="${c.accent}"/><circle cx="86" cy="30" r="1.6" fill="${c.accent}"/><circle cx="16" cy="24" r="2" fill="${c.accent}"/>`;
}
function silPlanets(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<ellipse cx="50" cy="56" rx="46" ry="9" fill="none" stroke="${c.accent}" stroke-width="4" opacity="0.85" transform="rotate(-10 50 56)"/>`;
}
function silCacti(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<path d="M 12 68 Q 2 68 2 54 Q 2 46 10 46 L 14 46" stroke="${c.base}" stroke-width="9" fill="none" stroke-linecap="round"/>` +
    `<path d="M 88 68 Q 98 68 98 54 Q 98 46 90 46 L 86 46" stroke="${c.base}" stroke-width="9" fill="none" stroke-linecap="round"/>` +
    `<circle cx="50" cy="6" r="6" fill="${c.accent}"/>`;
}
function silMushrooms(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<ellipse cx="50" cy="14" rx="44" ry="20" fill="${c.base}"/>${rimSpots(50, 14, 4, c.accent, 3)}`;
}
function silStrawberries(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<path d="M 50 10 L 40 -2 L 50 4 L 60 -2 Z" fill="${c.accent}"/><ellipse cx="50" cy="6" rx="14" ry="6" fill="${c.accent}"/>`;
}
function silCookies(_rnd: () => number, c: { base: string; accent: string }): string {
  return rimSpots(50, 52, 7, c.accent, 3.2);
}
function silIcecream(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<path d="M 30 88 L 50 96 L 70 88 Z" fill="${c.accent}"/>` +
    `<path d="M 30 22 Q 20 4 38 4 Q 42 -6 56 2 Q 72 -2 70 16 Q 84 20 74 32 Q 50 20 30 22 Z" fill="${c.base}"/>`;
}
function silBees(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<ellipse cx="26" cy="26" rx="14" ry="10" fill="${c.accent}" opacity="0.35" transform="rotate(-18 26 26)"/>` +
    `<ellipse cx="74" cy="26" rx="14" ry="10" fill="${c.accent}" opacity="0.35" transform="rotate(18 74 26)"/>` +
    `<line x1="42" y1="16" x2="36" y2="2" stroke="${c.accent}" stroke-width="2"/><circle cx="36" cy="0" r="2.6" fill="${c.accent}"/>` +
    `<line x1="58" y1="16" x2="64" y2="2" stroke="${c.accent}" stroke-width="2"/><circle cx="64" cy="0" r="2.6" fill="${c.accent}"/>`;
}
function silButterflies(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<ellipse cx="10" cy="40" rx="16" ry="22" fill="${c.base}" opacity="0.9" transform="rotate(-14 10 40)"/>` +
    `<ellipse cx="90" cy="40" rx="16" ry="22" fill="${c.base}" opacity="0.9" transform="rotate(14 90 40)"/>` +
    `<ellipse cx="10" cy="40" rx="7" ry="10" fill="${c.accent}" opacity="0.7" transform="rotate(-14 10 40)"/><ellipse cx="90" cy="40" rx="7" ry="10" fill="${c.accent}" opacity="0.7" transform="rotate(14 90 40)"/>`;
}
function silLadybugs(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<line x1="44" y1="14" x2="38" y2="0" stroke="${c.accent}" stroke-width="2"/><circle cx="38" cy="-2" r="2.2" fill="${c.accent}"/>` +
    `<line x1="56" y1="14" x2="62" y2="0" stroke="${c.accent}" stroke-width="2"/><circle cx="62" cy="-2" r="2.2" fill="${c.accent}"/>${rimSpots(50, 55, 6, c.accent, 3)}`;
}
function silSnails(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<circle cx="84" cy="56" r="17" fill="none" stroke="${c.accent}" stroke-width="4"/><circle cx="84" cy="56" r="10" fill="none" stroke="${c.accent}" stroke-width="3.2"/><circle cx="84" cy="56" r="4" fill="${c.accent}"/>` +
    `<line x1="30" y1="30" x2="24" y2="14" stroke="${c.base}" stroke-width="2.4"/><circle cx="24" cy="12" r="2.6" fill="${c.base}"/>`;
}
function silCrabs(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<path d="M 8 44 Q -6 40 -2 54 Q 4 60 12 52 Z" fill="${c.base}"/><path d="M 92 44 Q 106 40 102 54 Q 96 60 88 52 Z" fill="${c.base}"/>` +
    `<line x1="34" y1="22" x2="30" y2="6" stroke="${c.accent}" stroke-width="2.4"/><circle cx="30" cy="4" r="3" fill="${c.accent}"/>` +
    `<line x1="66" y1="22" x2="70" y2="6" stroke="${c.accent}" stroke-width="2.4"/><circle cx="70" cy="4" r="3" fill="${c.accent}"/>`;
}
function silJellyfish(_rnd: () => number, c: { base: string; accent: string }): string {
  let tentacles = '';
  const xs = [26, 38, 50, 62, 74];
  for (const x of xs) tentacles += `<path d="M ${x} 78 Q ${x - 5} 92 ${x} 100" stroke="${c.base}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.75"/>`;
  return tentacles;
}
function silNarwhals(_rnd: () => number, c: { base: string; accent: string }): string {
  return `<path d="M 48 24 L 40 -20 L 56 24 Z" fill="${c.accent}"/>` +
    `<line x1="44" y1="18" x2="52" y2="-4" stroke="${c.base}" stroke-width="1.4" opacity="0.5"/><line x1="47" y1="18" x2="55" y2="-6" stroke="${c.base}" stroke-width="1.4" opacity="0.5"/>`;
}

const SILHOUETTES: Record<string, (rnd: () => number, c: { base: string; accent: string }) => string> = {
  bears: silBears, cats: silCats, bunnies: silBunnies, foxes: silFoxes, pandas: silPandas,
  puppies: silPuppies, sweets: silSweets, stars: silStars, garden: silGarden, ocean: silOcean,
  koalas: silKoalas, penguins: silPenguins, owls: silOwls, hedgehogs: silHedgehogs, raccoons: silRaccoons,
  deer: silDeer, lions: silLions, tigers: silTigers, elephants: silElephants, monkeys: silMonkeys,
  sheep: silSheep, cows: silCows, pigs: silPigs, chickens: silChickens, ducks: silDucks,
  frogs: silFrogs, turtles: silTurtles, dragons: silDragons, unicorns: silUnicorns, dinosaurs: silDinosaurs,
  robots: silRobots, aliens: silAliens, ghosts: silGhosts, pumpkins: silPumpkins, clouds: silClouds,
  rainbows: silRainbows, moons: silMoons, planets: silPlanets, cacti: silCacti, mushrooms: silMushrooms,
  strawberries: silStrawberries, cookies: silCookies, icecream: silIcecream, bees: silBees, butterflies: silButterflies,
  ladybugs: silLadybugs, snails: silSnails, crabs: silCrabs, jellyfish: silJellyfish, narwhals: silNarwhals,
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
