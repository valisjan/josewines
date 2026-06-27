import { useRef, useState } from 'react'
import { Camera, Upload, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface Props {
  currentUrl: string | null
  onUploaded: (url: string | null) => void
}

export default function PhotoUpload({ currentUrl, onUploaded }: Props) {
  const { user } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl)

  const handleFile = async (file: File) => {
    if (!user) return
    setUploading(true)

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('wine-labels')
      .upload(path, file, { upsert: true })

    if (error) {
      console.error(error)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('wine-labels').getPublicUrl(path)
    setPreview(data.publicUrl)
    onUploaded(data.publicUrl)
    setUploading(false)
  }

  const handleRemove = () => {
    setPreview(null)
    onUploaded(null)
  }

  return (
    <div>
      {preview ? (
        <div className="relative w-24 h-32 rounded-xl overflow-hidden border border-wine-700/40">
          <img src={preview} alt="Etiqueta" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-wine-700/40 bg-wine-900/40 text-wine-400 hover:text-white hover:border-wine-600 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <div className="w-4 h-4 border-2 border-wine-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
          {uploading ? 'Subiendo...' : 'Foto de la etiqueta'}
          <Upload className="w-3.5 h-3.5 opacity-50" />
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}
