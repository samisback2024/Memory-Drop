// Phase 10c — client-side share preview card generator. Pure canvas, no
// new dependency: draws a branded 1080x1080 image (gradient background,
// cover photo if one loads cleanly, mood emoji, title/caption, wordmark)
// and hands back a downloadable PNG blob. If the cover image is hosted
// somewhere that doesn't send CORS headers, the canvas becomes "tainted"
// and toBlob() would throw — caught and treated as "no cover image"
// rather than failing the whole card, since Supabase Storage's public
// buckets already send permissive CORS headers in practice, but this
// isn't guaranteed for every possible media URL.
export interface SharePreviewInput {
  title: string | null;
  caption: string | null;
  moodEmoji: string | null;
  coverUrl: string | null;
  username: string;
}

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = url;
  });

const drawCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) => {
  const scale = Math.max(dw / img.width, dh / img.height);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
};

const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
};

export async function generateSharePreview(opts: SharePreviewInput): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const gradient = ctx.createLinearGradient(0, 0, 1080, 1080);
  gradient.addColorStop(0, '#7c3aed');
  gradient.addColorStop(1, '#3b82f6');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1080);

  let hasCover = false;
  if (opts.coverUrl) {
    try {
      const img = await loadImage(opts.coverUrl);
      drawCover(ctx, img, 80, 80, 920, 560);
      hasCover = true;
    } catch {
      hasCover = false;
    }
  }

  const textTop = hasCover ? 700 : 320;

  if (opts.moodEmoji) {
    ctx.font = '96px sans-serif';
    ctx.fillText(opts.moodEmoji, 80, textTop);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = '600 48px system-ui, sans-serif';
  wrapText(ctx, opts.title || opts.caption || 'A memory on Memory Drop', 80, textTop + (opts.moodEmoji ? 100 : 0), 920, 58, 3);

  ctx.font = '600 38px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Memory Drop', 80, 990);
  ctx.font = '400 28px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(`@${opts.username}`, 80, 1030);

  try {
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  } catch {
    return null;
  }
}

export const buildQrCodeUrl = (targetUrl: string, size = 240): string =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(targetUrl)}`;
