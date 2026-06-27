import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, CheckCircle2, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ImportPage() {
  const navigate = useNavigate()
  const [token, setToken] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const generateToken = async () => {
    setGenerating(true)
    const { data: { session } } = await supabase.auth.getSession()
    setToken(session?.access_token ?? null)
    setGenerating(false)
  }

  const bookmarkletPageUrl = token ? `/bookmarklet.html?token=${token}` : ''

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-wine-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-white">Importar de Bodeboca</h1>
      </div>

      <p className="text-wine-400 text-sm mb-6 leading-relaxed">
        Importa todo tu historial de pedidos de Bodeboca automáticamente.
        El bookmarklet recorre todas las páginas de pedidos y los manda aquí
        para que los confirmes.
      </p>

      {/* Step 1 */}
      <div className="space-y-4">
        <Step number={1} title="Genera tu enlace de importación">
          <button
            onClick={generateToken}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-wine-700 hover:bg-wine-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            {token ? 'Regenerar enlace' : 'Generar enlace'}
          </button>
          {token && (
            <p className="text-green-400 text-xs mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Enlace listo · válido mientras tengas sesión abierta
            </p>
          )}
        </Step>

        {token && (
          <>
            <Step number={2} title="Abre la página del bookmarklet">
              <p className="text-wine-400 text-xs mb-3 leading-relaxed">
                Se abrirá una página especial (sin React) donde podrás arrastrar el enlace a tus favoritos sin problemas.
              </p>
              <a
                href={bookmarkletPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-wine-700 hover:bg-wine-600 text-white text-sm font-semibold transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir página del bookmarklet
              </a>
            </Step>

            <Step number={3} title="Sigue las instrucciones de esa página">
              <p className="text-wine-400 text-xs leading-relaxed">
                Arrastra el enlace a favoritos → ve a bodeboca.com/mi-bodega → haz clic en el favorito.
              </p>
            </Step>

            <div className="px-4 py-3 rounded-xl bg-gold-500/10 border border-gold-500/25 text-gold-400 text-xs leading-relaxed">
              ⚠️ El enlace caduca en 2 horas y es de un solo uso. Si lo necesitas de nuevo, genera uno nuevo.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="w-7 h-7 rounded-full bg-wine-700 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-white text-xs font-bold">{number}</span>
      </div>
      <div className="flex-1">
        <p className="text-white font-semibold text-sm mb-3">{title}</p>
        {children}
      </div>
    </div>
  )
}

