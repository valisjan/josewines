import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Trash2, ChevronDown, ChevronUp, Download, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { proxyImg } from '../lib/proxyImg'
import { useAuth } from '../context/AuthContext'
import type { PendingWine } from '../types/wine'
import ScoreInput from '../components/ScoreInput'
import clsx from 'clsx'

export default function PendingPage() {
  const { user } = useAuth()
  const [pending, setPending] = useState<PendingWine[]>([])
  const [cellar, setCellar] = useState<{ id: string; name: string; units_remaining: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchAll = async () => {
    if (!user) return
    const [{ data: pendingData }, { data: cellarData }] = await Promise.all([
      supabase.from('pending_wines').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('wines').select('id, name, units_remaining').eq('user_id', user.id),
    ])
    setPending((pendingData ?? []).map(w => ({ ...w, selected: true })))
    setCellar(cellarData ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [user])

  // Returns units_remaining for a wine already in the cellar, or null if not found
  const cellarUnits = (pendingName: string): number | null => {
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
    const pn = norm(pendingName)
    const match = cellar.find(w => {
      const cn = norm(w.name)
      return cn === pn || cn.includes(pn) || pn.includes(cn)
    })
    return match ? match.units_remaining : null
  }

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

  const confirmSelected = async (asHistory = false) => {
    const toAdd = pending.filter(w => w.selected && matchesSearch(w))
    if (!toAdd.length || !user) return
    setConfirming(true)

    try {
      // POST/body operations can use larger batches; URL-based (.in filter) must stay small
      const BATCH_BODY = 100
      const BATCH_URL = 20

      // Avoid duplicates: skip source_order_ids already in wines table
      const sourceIds = toAdd.map(w => w.source_order_id).filter(Boolean) as string[]
      const existingIds = new Set<string>()
      for (let i = 0; i < sourceIds.length; i += BATCH_URL) {
        const { data } = await supabase
          .from('wines').select('source_order_id').eq('user_id', user.id)
          .in('source_order_id', sourceIds.slice(i, i + BATCH_URL))
        data?.forEach(w => { if (w.source_order_id) existingIds.add(w.source_order_id) })
      }

      const toInsert = toAdd
        .filter(w => !w.source_order_id || !existingIds.has(w.source_order_id))
        .map(w => ({
          user_id: user.id,
          name: w.name,
          winery: w.winery,
          region: w.region,
          grape_variety: w.grape_variety,
          vintage_year: w.vintage_year,
          purchase_date: w.purchase_date,
          price_per_bottle: w.price_per_bottle,
          units_purchased: w.units_purchased,
          units_remaining: asHistory ? 0 : w.units_purchased,
          personal_score: w.personal_score ?? null,
          notes: w.notes ?? null,
          source_order_id: w.source_order_id,
          label_image_url: w.label_image_url ?? null,
        }))

      // Insert in batches (POST body — no URL limit)
      for (let i = 0; i < toInsert.length; i += BATCH_BODY)
        await supabase.from('wines').insert(toInsert.slice(i, i + BATCH_BODY))

      // Delete from pending in small batches (.in() uses URL params — strict limit)
      const ids = toAdd.map(w => w.id)
      for (let i = 0; i < ids.length; i += BATCH_URL)
        await supabase.from('pending_wines').delete().eq('user_id', user.id).in('id', ids.slice(i, i + BATCH_URL))

    } finally {
      setConfirming(false)
      fetchAll()
    }
  }

  const matchesSearch = (w: PendingWine) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      w.name.toLowerCase().includes(q) ||
      w.winery.toLowerCase().includes(q) ||
      (w.region ?? '').toLowerCase().includes(q)
    )
  }

  const filtered = pending.filter(matchesSearch)
  const selectedCount = filtered.filter(w => w.selected).length

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
      <p className="text-wine-400 text-sm mb-4">
        Revisa los vinos detectados. Selecciona cuáles añadir a tu bodega.
      </p>

      {/* Search */}
      {pending.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wine-500" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, bodega, región..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-wine-900/60 border border-wine-700/40 text-white placeholder-wine-500 text-sm focus:outline-none focus:border-wine-500"
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-28 rounded-2xl bg-wine-900/40 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="w-12 h-12 text-wine-700 mx-auto mb-3" />
          <p className="text-wine-400">
            {search ? 'Sin resultados para esa búsqueda.' : 'Sin vinos pendientes de confirmar.'}
          </p>
          {!search && (
            <p className="text-wine-600 text-sm mt-1">
              Usa el bookmarklet en Bodeboca para importar vinos.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap mb-4">
            <button
              onClick={() => setPending(prev => prev.map(w => ({ ...w, selected: true })))}
              className="w-full py-2.5 rounded-xl border border-wine-700 text-wine-300 text-sm font-medium hover:bg-wine-900/50 transition-colors"
            >
              Seleccionar todos ({filtered.length})
            </button>
            <button
              onClick={() => confirmSelected(true)}
              disabled={selectedCount === 0 || confirming}
              className="flex-1 py-3 rounded-xl bg-wine-900 hover:bg-wine-800 border border-wine-700 text-wine-300 text-sm font-semibold disabled:opacity-40 transition-colors"
            >
              {confirming ? '...' : `📜 Al histórico (${selectedCount})`}
            </button>
            <button
              onClick={() => confirmSelected(false)}
              disabled={selectedCount === 0 || confirming}
              className="flex-1 py-3 rounded-xl bg-wine-700 hover:bg-wine-600 text-white text-sm font-semibold disabled:opacity-40 transition-colors"
            >
              {confirming ? 'Añadiendo...' : `🍾 A la bodega (${selectedCount})`}
            </button>
          </div>

          <div className="space-y-3 mb-6">
            {filtered.map(wine => {
              const units = cellarUnits(wine.name)
              return (
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

                    {/* Label thumbnail */}
                    <div className="w-10 h-14 rounded-lg bg-wine-800/60 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {proxyImg(wine.label_image_url)
                        ? <img src={proxyImg(wine.label_image_url)!} alt={wine.name} className="w-full h-full object-cover" />
                        : <span className="text-wine-600 text-lg">🍷</span>
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <p className="text-white font-semibold text-sm">{wine.name}</p>
                        {units !== null && (
                          <span className={clsx(
                            'text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0',
                            units > 0
                              ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/40'
                              : 'bg-wine-800/50 text-wine-400 border border-wine-700/40'
                          )}>
                            {units > 0 ? `${units} en bodega` : 'Agotado'}
                          </span>
                        )}
                      </div>
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
              )
            })}
          </div>

        </>
      )}
    </div>
  )
}
