import React, { useRef, useState } from 'react';
import { Image, Video, Mic, X, Upload } from 'lucide-react';

interface MediaFile {
  file: File;
  preview: string;
  type: 'photo' | 'video' | 'audio';
}

interface MediaUploadProps {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
}

const getMediaType = (file: File): 'photo' | 'video' | 'audio' => {
  if (file.type.startsWith('video')) return 'video';
  if (file.type.startsWith('audio')) return 'audio';
  return 'photo';
};

export const MediaUpload: React.FC<MediaUploadProps> = ({
  files,
  onChange,
  maxFiles = 5,
}) => {
  const [previews, setPreviews] = useState<MediaFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const arr = Array.from(newFiles).slice(0, maxFiles - files.length);
    const newPreviews: MediaFile[] = arr.map(file => ({
      file,
      preview: file.type.startsWith('audio') ? '' : URL.createObjectURL(file),
      type: getMediaType(file),
    }));
    setPreviews(prev => [...prev, ...newPreviews]);
    onChange([...files, ...arr]);
  };

  const removeFile = (index: number) => {
    const updated = [...previews];
    if (updated[index].preview) URL.revokeObjectURL(updated[index].preview);
    updated.splice(index, 1);
    setPreviews(updated);
    onChange(updated.map(p => p.file));
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium text-gray-700">Media (optional)</label>

      {/* Upload area */}
      {files.length < maxFiles && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-colors ${
            dragging ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300'
          }`}
        >
          <Upload size={24} className="text-gray-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">Drop files here or click to upload</p>
            <p className="text-xs text-gray-400 mt-1">Photos, videos, or audio files</p>
          </div>
          <div className="flex items-center gap-4 text-gray-400">
            <span className="flex items-center gap-1 text-xs"><Image size={14} /> Photo</span>
            <span className="flex items-center gap-1 text-xs"><Video size={14} /> Video</span>
            <span className="flex items-center gap-1 text-xs"><Mic size={14} /> Audio</span>
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*"
        className="hidden"
        onChange={e => addFiles(e.target.files)}
      />

      {/* Previews */}
      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {previews.map((item, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
              {item.type === 'photo' && (
                <img src={item.preview} alt="" className="w-full h-full object-cover" />
              )}
              {item.type === 'video' && (
                <video src={item.preview} className="w-full h-full object-cover" />
              )}
              {item.type === 'audio' && (
                <div className="flex items-center justify-center h-full bg-purple-100">
                  <Mic size={24} className="text-purple-500" />
                </div>
              )}
              <div className="absolute top-1 left-1">
                <span className="text-xs bg-black/60 text-white rounded-md px-1.5 py-0.5 capitalize">{item.type}</span>
              </div>
              <button
                onClick={e => { e.stopPropagation(); removeFile(i); }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <X size={10} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
