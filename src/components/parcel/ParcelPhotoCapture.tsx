import React, { useRef, useState, useCallback } from 'react'
import { Camera, ImagePlus, X, ZoomIn, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'

interface Props {
  photos: string[]         // Public URLs already uploaded
  onChange: (urls: string[]) => void
  maxPhotos?: number
  disabled?: boolean
}

export default function ParcelPhotoCapture({ photos, onChange, maxPhotos = 3, disabled = false }: Props) {
  const { user } = useAuthStore()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const canAdd = photos.length < maxPhotos && !disabled

  async function uploadFile(file: File): Promise<string | null> {
    if (!user) return null
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('parcel-photos')
      .upload(path, file, { contentType: file.type, upsert: false })

    if (uploadError) throw new Error(uploadError.message)

    const { data } = supabase.storage.from('parcel-photos').getPublicUrl(path)
    return data.publicUrl
  }

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError(null)
    setUploading(true)

    try {
      const remaining = maxPhotos - photos.length
      const toProcess = Array.from(files).slice(0, remaining)
      const newUrls: string[] = []

      for (const file of toProcess) {
        if (file.size > 10 * 1024 * 1024) {
          setError('Image trop lourde (max 10 Mo)')
          continue
        }
        const url = await uploadFile(file)
        if (url) newUrls.push(url)
      }

      if (newUrls.length > 0) {
        onChange([...photos, ...newUrls])
      }
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de l\'upload')
    } finally {
      setUploading(false)
      // Reset inputs so same file can be selected again
      if (cameraInputRef.current) cameraInputRef.current.value = ''
      if (galleryInputRef.current) galleryInputRef.current.value = ''
    }
  }, [photos, maxPhotos, onChange, user])

  async function removePhoto(url: string) {
    // Extract path from public URL
    try {
      const urlObj = new URL(url)
      const parts = urlObj.pathname.split('/parcel-photos/')
      if (parts[1]) {
        await supabase.storage.from('parcel-photos').remove([decodeURIComponent(parts[1])])
      }
    } catch {
      // Best effort delete — continue regardless
    }
    onChange(photos.filter(p => p !== url))
  }

  return (
    <div className="space-y-3">
      {/* Label */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Photo(s) du courrier
          <span className="ml-1 font-normal" style={{ color: 'var(--text-muted)' }}>
            ({photos.length}/{maxPhotos})
          </span>
        </label>
        {photos.length > 0 && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Appuyer pour agrandir
          </span>
        )}
      </div>

      {/* Photos grid + Add buttons */}
      <div className="flex flex-wrap gap-3">
        {/* Existing photos */}
        {photos.map((url, idx) => (
          <div
            key={url}
            className="relative rounded-xl overflow-hidden flex-shrink-0 group"
            style={{ width: 88, height: 88, border: '2px solid var(--border)' }}
          >
            <img
              src={url}
              alt={`Photo courrier ${idx + 1}`}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setLightbox(url)}
            />
            {/* Overlay zoom icon */}
            <div
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
              onClick={() => setLightbox(url)}
            >
              <ZoomIn className="w-5 h-5 text-white" />
            </div>
            {/* Remove button */}
            {!disabled && (
              <button
                type="button"
                onClick={() => removePhoto(url)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-md z-10"
                style={{ backgroundColor: '#AF3029' }}
                title="Supprimer"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            )}
          </div>
        ))}

        {/* Add buttons — shown when under limit */}
        {canAdd && !uploading && (
          <>
            {/* Camera capture (mobile: opens camera directly) */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed transition-colors flex-shrink-0"
              style={{
                width: 88,
                height: 88,
                borderColor: '#0B7439',
                backgroundColor: '#f0faf4',
                color: '#0B7439',
              }}
              title="Prendre une photo"
            >
              <Camera className="w-5 h-5" />
              <span style={{ fontSize: 10, fontWeight: 600 }}>Caméra</span>
            </button>

            {/* Gallery picker */}
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed transition-colors flex-shrink-0"
              style={{
                width: 88,
                height: 88,
                borderColor: 'var(--border)',
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--text-muted)',
              }}
              title="Choisir depuis la galerie"
            >
              <ImagePlus className="w-5 h-5" />
              <span style={{ fontSize: 10, fontWeight: 600 }}>Galerie</span>
            </button>
          </>
        )}

        {/* Uploading spinner */}
        {uploading && (
          <div
            className="flex flex-col items-center justify-center gap-1 rounded-xl flex-shrink-0"
            style={{
              width: 88,
              height: 88,
              backgroundColor: 'var(--bg-subtle)',
              border: '2px solid var(--border)',
            }}
          >
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#0B7439' }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Upload...</span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#f8d7d5', border: '1px solid #AF3029' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#AF3029' }} />
          <p className="text-xs" style={{ color: '#AF3029' }}>{error}</p>
          <button type="button" onClick={() => setError(null)} className="ml-auto">
            <X className="w-3.5 h-3.5" style={{ color: '#AF3029' }} />
          </button>
        </div>
      )}

      {/* Hidden inputs */}
      {/* Camera — capture="environment" opens rear camera on mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      {/* Gallery — no capture attribute, lets user pick from gallery */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center z-10"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            onClick={() => setLightbox(null)}
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={lightbox}
            alt="Photo courrier"
            className="max-w-full max-h-full rounded-xl object-contain"
            style={{ maxWidth: '90vw', maxHeight: '85vh', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
