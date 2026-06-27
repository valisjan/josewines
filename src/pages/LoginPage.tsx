import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Wine } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'sent'>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setStep('sent')
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

        {step === 'sent' ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-900/40 border border-green-600/30 flex items-center justify-center mx-auto">
              <span className="text-2xl">✉️</span>
            </div>
            <p className="text-white font-medium">Revisa tu correo</p>
            <p className="text-wine-300 text-sm">
              Te hemos enviado un enlace mágico a <strong className="text-white">{email}</strong>.
              Ábrelo para acceder.
            </p>
            <button
              onClick={() => setStep('email')}
              className="text-wine-400 text-sm underline underline-offset-2"
            >
              Usar otro correo
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={handlePasskey}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-white text-wine-950 font-semibold text-sm disabled:opacity-50 active:scale-95 transition-transform"
            >
              <span className="text-lg">👆</span>
              Acceder con Touch ID / Face ID
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-wine-800" />
              <span className="text-wine-500 text-xs">o por email</span>
              <div className="flex-1 h-px bg-wine-800" />
            </div>

            <form onSubmit={handleMagicLink} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full px-4 py-3.5 rounded-2xl bg-wine-900/50 border border-wine-700/50 text-white placeholder-wine-500 text-sm focus:outline-none focus:border-wine-500 focus:ring-1 focus:ring-wine-500"
              />
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3.5 px-4 rounded-2xl bg-wine-700 hover:bg-wine-600 text-white font-semibold text-sm disabled:opacity-50 active:scale-95 transition-all"
              >
                {loading ? 'Enviando...' : 'Enviar enlace mágico'}
              </button>
            </form>

            {error && (
              <p className="text-red-400 text-xs text-center">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
