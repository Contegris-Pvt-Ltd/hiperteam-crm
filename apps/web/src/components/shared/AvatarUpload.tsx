import { useState, useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';

interface AvatarUploadProps {
  currentUrl: string | null | undefined;
  onUpload: (file: File) => Promise<string>;
  name: string;
  type: 'contact' | 'account';
  size?: 'sm' | 'md' | 'lg';
}

export function AvatarUpload({ currentUrl, onUpload, name, type, size = 'md' }: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const gradients = {
    contact: 'from-blue-500 to-indigo-600',
    account: 'from-emerald-500 to-teal-600',
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview immediately
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    setUploading(true);
    try {
      const url = await onUpload(file);
      setPreview(url);
    } catch (error) {
      console.error('Upload failed:', error);
      setPreview(currentUrl ?? null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={handleClick}
        disabled={uploading}
        className={`${sizeClasses[size]} rounded-${type === 'contact' ? 'full' : '2xl'} overflow-hidden relative focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
      >
        {preview ? (
          <img
            src={preview}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradients[type]} flex items-center justify-center text-white font-semibold ${textSizes[size]}`}>
            {getInitials(name)}
          </div>
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {uploading ? (
            <Loader2 className={`${iconSizes[size]} text-white animate-spin`} />
          ) : (
            <Camera className={`${iconSizes[size]} text-white`} />
          )}
        </div>
      </button>

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