import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Wine } from 'lucide-react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogle = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  const handlePasskey = async () => {
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPasskey()
      if (error) setError('No se encontró ninguna clave de acceso guardada.')
    } catch {
      setError('Tu dispositivo no soporta claves de acceso.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 bg-gradient-to-b from-[#1a0505] to-[#2d0a0a]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-wine-800/60 flex items-center justify-center mb-4 border border-wine-600/30">
            <Wine className="w-8 h-8 text-wine-300" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Mi Bodega</h1>
          <p className="text-wine-300 text-sm mt-1">Gestiona tu colección de vinos</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm disabled:opacity-50 active:scale-95 transition-all shadow-sm"
          >
            <GoogleIcon />
            {loading ? 'Redirigiendo...' : 'Continuar con Google'}
          </button>

          <button
            onClick={handlePasskey}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-wine-800/50 hover:bg-wine-700/50 border border-wine-700/40 text-white font-semibold text-sm disabled:opacity-50 active:scale-95 transition-all"
          >
            <span className="text-lg">👆</span>
            Touch ID / Face ID
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-xs text-center mt-4">{error}</p>
        )}

        <p className="text-wine-600 text-xs text-center mt-8">
          Solo tú puedes acceder a tu bodega.
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
      <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"/>
      <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
    </svg>
  )
}
