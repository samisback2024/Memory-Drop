// Canvas-based crop + compress pipeline shared by avatar and cover photo
// uploads. No cropper dependency: ImageCropModal computes the visible
// source rectangle (pan/zoom over a fixed viewport, the same math
// well-known crop libraries use internally), and this file just renders
// that rectangle down to a fixed-size, compressed output — which is also
// where the "image compression" requirement is satisfied: every upload is
// re-encoded at a capped pixel size and JPEG quality regardless of how
// large the source file was.
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const loadImageFromFile = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image file.'));
    img.src = url;
  });
};

const OUTPUT_QUALITY = 0.85;

export const renderCroppedImage = (
  image: HTMLImageElement,
  source: CropRect,
  outputWidth: number,
  outputHeight: number,
): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas is not supported in this browser.'));

  ctx.drawImage(
    image,
    source.x, source.y, source.width, source.height,
    0, 0, outputWidth, outputHeight,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Could not process that image.'))),
      'image/jpeg',
      OUTPUT_QUALITY,
    );
  });
};

export const blobToFile = (blob: Blob, filename: string): File =>
  new File([blob], filename, { type: blob.type });

// Feed photos don't go through ImageCropModal — unlike avatar/cover, a
// social feed is expected to preserve whatever aspect ratio the photo was
// taken in. This still compresses (downscale + re-encode), just without
// forcing a fixed output rectangle.
export const compressImageFile = async (file: File, maxDimension = 1600, quality = 0.85): Promise<File> => {
  const image = await loadImageFromFile(file);
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const outputWidth = Math.round(image.naturalWidth * scale);
  const outputHeight = Math.round(image.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(image, 0, 0, outputWidth, outputHeight);

  return new Promise(resolve => {
    canvas.toBlob(
      blob => resolve(blob ? blobToFile(blob, file.name.replace(/\.[^.]+$/, '.jpg')) : file),
      'image/jpeg',
      quality,
    );
  });
};
