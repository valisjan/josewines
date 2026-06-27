import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Trash2, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { PendingWine } from '../types/wine'
import ScoreInput from '../components/ScoreInput'
import clsx from 'clsx'

export default function PendingPage() {
  const { user } = useAuth()
  const [pending, setPending] = useState<PendingWine[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetch = async () => {
    if (!user) return
    const { data } = await supabase
      .from('pending_wines')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setPending((data ?? []).map(w => ({ ...w, selected: true })))
    setLoading(false)
  }

  useEffect(() => { fetch() }, [user])

  const toggle = (id: string) =>
    setPending(prev => prev.map(w => w.id === id ? { ...w, selected: !w.selected } : w))

  const updateScore = (id: string, score: number | null) =>
    setPending(prev => prev.map(w => w.id === id ? { ...w, personal_score: score } : w))

  const updateNotes = (id: string, notes: string) =>
    setPending(prev => prev.map(w => w.id === id ? { ...w, notes } : w))

  const dismiss = async (id: string) => {
    await supabase.from('pending_wines').delete().eq('id', id)
    setPending(prev => prev.filter(w => w.id !== id))
  }

  const confirmSelected = async () => {
    const toAdd = pending.filter(w => w.selected)
    if (!toAdd.length || !user) return
    setConfirming(true)

    const wines = toAdd.map(w => ({
      user_id: user.id,
      name: w.name,
      winery: w.winery,
      region: w.region,
      grape_variety: w.grape_variety,
      vintage_year: w.vintage_year,
      purchase_date: w.purchase_date,
      price_per_bottle: w.price_per_bottle,
      units_purchased: w.units_purchased,
      units_remaining: w.units_purchased,
      personal_score: w.personal_score ?? null,
      notes: w.notes ?? null,
      source_order_id: w.source_order_id,
      label_image_url: w.label_image_url ?? null,
    }))

    await supabase.from('wines').insert(wines)
    await supabase.from('pending_wines').delete().in('id', toAdd.map(w => w.id))

    setConfirming(false)
    fetch()
  }

  const selectedCount = pending.filter(w => w.selected).length

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-white">Pendientes</h1>
        <Link
          to="/importar"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-wine-800/60 hover:bg-wine-700/60 text-wine-300 text-xs font-medium transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Importar Bodeboca
        </Link>
      </div>
      <p className="text-wine-400 text-sm mb-6">
        Revisa los vinos detectados en tus emails. Selecciona cuáles añadir a tu bodega.
      </p>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-28 rounded-2xl bg-wine-900/40 animate-pulse" />)}
        </div>
      ) : pending.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="w-12 h-12 text-wine-700 mx-auto mb-3" />
          <p className="text-wine-400">Sin vinos pendientes de confirmar.</p>
          <p className="text-wine-600 text-sm mt-1">
            Reenvía un email de Bodeboca a tu dirección de importación para añadir vinos.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-6">
            {pending.map(wine => (
              <div
                key={wine.id}
                className={clsx(
                  'rounded-2xl border transition-colors',
                  wine.selected
                    ? 'bg-wine-900/60 border-wine-600/50'
                    : 'bg-wine-900/20 border-wine-800/30 opacity-60'
                )}
              >
                {/* Card header */}
                <div className="flex items-start gap-3 p-4">
                  <button
                    onClick={() => toggle(wine.id)}
                    className={clsx(
                      'w-5 h-5 mt-0.5 rounded-full border-2 flex-shrink-0 transition-colors',
                      wine.selected
                        ? 'bg-wine-500 border-wine-500'
                        : 'border-wine-600 bg-transparent'
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{wine.name}</p>
                    <p className="text-wine-400 text-xs mt-0.5">{wine.winery}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-wine-500">
                      {wine.vintage_year && <span>Añada {wine.vintage_year}</span>}
                      <span>{wine.price_per_bottle.toFixed(2)} € / botella</span>
                      <span>{wine.units_purchased} {wine.units_purchased === 1 ? 'botella' : 'botellas'}</span>
                      <span>Compra: {new Date(wine.purchase_date).toLocaleDateString('es-ES')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpanded(expanded === wine.id ? null : wine.id)}
                      className="text-wine-500 hover:text-wine-300 transition-colors"
                    >
                      {expanded === wine.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => dismiss(wine.id)}
                      className="text-wine-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded: score + notes */}
                {expanded === wine.id && (
                  <div className="px-4 pb-4 border-t border-wine-800/40 pt-3 space-y-3">
                    <div>
                      <label className="text-xs text-wine-400 font-medium mb-2 block">
                        Tu puntuación (opcional)
                      </label>
                      <ScoreInput
                        value={wine.personal_score ?? null}
                        onChange={score => updateScore(wine.id, score)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-wine-400 font-medium mb-1.5 block">
                        Notas (opcional)
                      </label>
                      <textarea
                        value={wine.notes ?? ''}
                        onChange={e => updateNotes(wine.id, e.target.value)}
                        placeholder="Añade tus impresiones..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-xl bg-wine-900/60 border border-wine-700/40 text-white placeholder-wine-600 text-sm focus:outline-none focus:border-wine-500 resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setPending(prev => prev.map(w => ({ ...w, selected: true })))}
              className="flex-1 py-3 rounded-xl border border-wine-700 text-wine-300 text-sm font-medium hover:bg-wine-900/50 transition-colors"
            >
              Seleccionar todos
            </button>
            <button
              onClick={confirmSelected}
              disabled={selectedCount === 0 || confirming}
              className="flex-1 py-3 rounded-xl bg-wine-700 hover:bg-wine-600 text-white text-sm font-semibold disabled:opacity-40 transition-colors"
            >
              {confirming
                ? 'Añadiendo...'
                : `Añadir ${selectedCount} ${selectedCount === 1 ? 'vino' : 'vinos'}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
