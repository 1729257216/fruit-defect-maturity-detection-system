import { useCallback, useRef, useState } from 'react';
import { Upload, Image as ImageIcon, X } from 'lucide-react';

interface ImageUploadProps {
  onImageSelect: (file: File, dataUrl: string) => void;
  currentImage: string | null;
  onClear: () => void;
}

export function ImageUpload({ onImageSelect, currentImage, onClear }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      onImageSelect(file, reader.result as string);
    };
    reader.readAsDataURL(file);
  }, [onImageSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) handleFile(file);
        break;
      }
    }
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  if (currentImage) {
    return (
      <div className="relative rounded-xl overflow-hidden bg-gray-100 border-2 border-dashed border-mango-300 aspect-square group">
        <img
          src={currentImage}
          alt="Selected"
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <button
          onClick={onClear}
          className="absolute top-2 right-2 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all transform hover:scale-110"
        >
          <X className="w-4 h-4 text-gray-700" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`
        rounded-xl border-2 border-dashed
        flex flex-col items-center justify-center gap-2 py-6 px-4
        transition-all cursor-pointer text-xs
        ${isDragging
          ? 'border-mango-500 bg-mango-50 scale-105'
          : 'border-mango-200 hover:border-mango-400 hover:bg-mango-50/50'
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      onClick={() => fileInputRef.current?.click()}
    >
      <div className={`
        w-12 h-12 rounded-xl flex items-center justify-center
        transition-all ${isDragging ? 'bg-mango-200 scale-110' : 'bg-mango-100'}
      `}>
        {isDragging ? (
          <ImageIcon className="w-6 h-6 text-mango-600" />
        ) : (
          <Upload className="w-6 h-6 text-mango-500" />
        )}
      </div>

      <div className="text-center">
        <p className="font-semibold text-gray-700">
          {isDragging ? '释放以上传' : '拖拽图片到此'}
        </p>
        <p className="text-gray-500 mt-0.5">
          点击或粘贴截图
        </p>
      </div>

      <p className="text-mango-400 font-medium">
        JPG / PNG
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
