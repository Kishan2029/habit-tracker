import { useState, useRef, useEffect } from 'react';
import { uploadAvatar } from '../../api/userApi';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function AvatarUpload() {
  const { user, updateUser } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();

  // Revoke blob URL on cleanup to prevent memory leak
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const { data } = await uploadAvatar(formData);
      updateUser(data.data.user);
      toast.success('Avatar updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const avatarUrl = preview || user?.avatar?.url;

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-600 hover:border-indigo-400 transition group"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xl font-bold">
            {initials}
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">Click to change avatar</p>
    </div>
  );
}
