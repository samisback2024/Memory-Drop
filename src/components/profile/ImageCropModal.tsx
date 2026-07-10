import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ZoomIn } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { loadImageFromFile, renderCroppedImage, blobToFile, type CropRect } from '../../lib/image';

interface ImageCropModalProps {
  file: File;
  title: string;
  aspect: number;
  shape: 'circle' | 'rect';
  outputWidth: number;
  outputHeight: number;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

interface Offset {
  x: number;
  y: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

// Pan/zoom-over-a-fixed-viewport crop, the same technique cropper libraries
// use internally — implemented directly rather than adding a dependency.
// The viewport is a real responsive element (sized by CSS, not a hardcoded
// pixel constant), so the same code produces a correct crop rectangle on a
// phone or a desktop window; geometry is read from getBoundingClientRect()
// at interaction time rather than cached.
export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  file, title, aspect, shape, outputWidth, outputHeight, onCancel, onConfirm,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const dragState = useRef<{ startX: number; startY: number; startOffset: Offset } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadImageFromFile(file)
      .then(img => { if (!cancelled) setImage(img); })
      .catch(() => { if (!cancelled) setError('Could not read that image file.'); });
    return () => { cancelled = true; };
  }, [file]);

  const baseScale = useCallback((): number => {
    if (!image || !containerRef.current) return 1;
    const rect = containerRef.current.getBoundingClientRect();
    return Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
  }, [image]);

  const clampOffset = useCallback((next: Offset, currentZoom: number): Offset => {
    if (!image || !containerRef.current) return next;
    const rect = containerRef.current.getBoundingClientRect();
    const scale = baseScale() * currentZoom;
    const displayedW = image.naturalWidth * scale;
    const displayedH = image.naturalHeight * scale;
    const minX = Math.min(0, rect.width - displayedW);
    const minY = Math.min(0, rect.height - displayedH);
    return {
      x: Math.min(0, Math.max(minX, next.x)),
      y: Math.min(0, Math.max(minY, next.y)),
    };
  }, [image, baseScale]);

  useEffect(() => {
    setOffset(prev => clampOffset(prev, zoom));
    // Re-clamp whenever the image loads or zoom changes so a zoom-out never
    // leaves a gap at the edge of the viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, zoom]);

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, startOffset: offset };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setOffset(clampOffset(
      { x: dragState.current.startOffset.x + dx, y: dragState.current.startOffset.y + dy },
      zoom,
    ));
  };

  const handlePointerUp = () => { dragState.current = null; };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = 12;
    if (e.key === 'ArrowLeft') setOffset(o => clampOffset({ x: o.x + step, y: o.y }, zoom));
    else if (e.key === 'ArrowRight') setOffset(o => clampOffset({ x: o.x - step, y: o.y }, zoom));
    else if (e.key === 'ArrowUp') setOffset(o => clampOffset({ x: o.x, y: o.y + step }, zoom));
    else if (e.key === 'ArrowDown') setOffset(o => clampOffset({ x: o.x, y: o.y - step }, zoom));
    else return;
    e.preventDefault();
  };

  const handleConfirm = async () => {
    if (!image || !containerRef.current) return;
    setProcessing(true);
    setError(null);
    try {
      const rect = containerRef.current.getBoundingClientRect();
      const scale = baseScale() * zoom;
      const source: CropRect = {
        x: -offset.x / scale,
        y: -offset.y / scale,
        width: rect.width / scale,
        height: rect.height / scale,
      };
      const blob = await renderCroppedImage(image, source, outputWidth, outputHeight);
      onConfirm(blobToFile(blob, file.name.replace(/\.[^.]+$/, '.jpg')));
    } catch {
      setError('Could not process that image. Try a different file.');
      setProcessing(false);
    }
  };

  const scale = baseScale() * zoom;
  const displayedW = image ? image.naturalWidth * scale : 0;
  const displayedH = image ? image.naturalHeight * scale : 0;

  return (
    <Modal isOpen onClose={onCancel} title={title} size="md">
      <div className="flex flex-col gap-4">
        <div
          ref={containerRef}
          role="slider"
          aria-label="Drag to reposition, use arrow keys to nudge"
          aria-valuemin={MIN_ZOOM}
          aria-valuemax={MAX_ZOOM}
          aria-valuenow={zoom}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
          className={[
            'relative w-full overflow-hidden bg-gray-100 dark:bg-gray-800 touch-none select-none cursor-grab active:cursor-grabbing',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500',
            shape === 'circle' ? 'rounded-full' : 'rounded-2xl',
          ].join(' ')}
          style={{ aspectRatio: String(aspect) }}
        >
          {image && (
            <img
              src={image.src}
              alt=""
              draggable={false}
              className="absolute top-0 left-0 max-w-none pointer-events-none"
              style={{
                width: displayedW,
                height: displayedH,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          <ZoomIn size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="w-full accent-purple-600"
          />
        </div>

        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

        <div className="flex gap-3">
          <Button type="button" variant="primary" fullWidth loading={processing} onClick={handleConfirm} disabled={!image}>
            Save
          </Button>
          <Button type="button" variant="outline" fullWidth onClick={onCancel} disabled={processing}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
