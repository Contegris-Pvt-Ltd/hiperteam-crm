import { useState, useRef } from 'react';
import { Camera, User, Building2 } from 'lucide-react';

interface AvatarUploadProps {
  currentUrl: string | null;
  onUpload: (file: File) => Promise<string>;
  name: string;
  type: 'contact' | 'account';
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'w-16 h-16 text-lg',
  md: 'w-24 h-24 text-2xl',
  lg: 'w-32 h-32 text-3xl',
};

export function AvatarUpload({ currentUrl, onUpload, name, type, size = 'md' }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreviewUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    try {
      const url = await onUpload(file);
      setPreviewUrl(url);
    } catch (error) {
      setPreviewUrl(currentUrl);
    } finally {
      setUploading(false);
    }
  };

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={`${sizes[size]} rounded-2xl flex items-center justify-center overflow-hidden transition-transform hover:scale-105 disabled:hover:scale-100 ${
          previewUrl
            ? ''
            : type === 'contact'
            ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
            : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
        }`}
      >
        {uploading ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : previewUrl ? (
          <img src={previewUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="font-bold">{initials || (type === 'contact' ? <User /> : <Building2 />)}</span>
        )}
      </button>

      <div className="absolute -bottom-1 -right-1 p-1.5 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-gray-200 dark:border-slate-700">
        <Camera className="w-4 h-4 text-gray-500 dark:text-slate-400" />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}