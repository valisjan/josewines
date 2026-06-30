import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Wine } from '../types/wine'
import WineCard from '../components/WineCard'
import AddWineModal from '../components/AddWineModal'
import clsx from 'clsx'

type SortKey = 'name' | 'purchase_date' | 'vintage_year' | 'personal_score' | 'price_per_bottle'
type PresenceFilter = 'all' | 'present' | 'absent'

export default function CellarPage() {
  const { user } = useAuth()
  const [wines, setWines] = useState<Wine[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('purchase_date')
  const [presence, setPresence] = useState<PresenceFilter>('present')
  const [showAddModal, setShowAddModal] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  const fetchWines = async () => {
    if (!user) return
    const { data } = await supabase
      .from('wines')
      .select('*')
      .eq('user_id', user.id)
      .order(sortBy, { ascending: sortBy === 'name' })
    setWines(data ?? [])
    setLoading(false)
  }

  const fetchPendingCount = async () => {
    if (!user) return
    const { count } = await supabase
      .from('pending_wines')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    setPendingCount(count ?? 0)
  }

  useEffect(() => {
    fetchWines()
    fetchPendingCount()
  }, [user, sortBy])

  const filtered = wines.filter(w => {
    const matchesSearch =
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.winery.toLowerCase().includes(search.toLowerCase()) ||
      (w.region ?? '').toLowerCase().includes(search.toLowerCase())

    const matchesPresence =
      presence === 'all' ||
      (presence === 'present' && w.units_remaining > 0) ||
      (presence === 'absent' && w.units_remaining === 0)

    return matchesSearch && matchesPresence
  })

  const totalBottles = wines.filter(w => w.units_remaining > 0).reduce((sum, w) => sum + w.units_remaining, 0)
  const totalValue = wines.filter(w => w.units_remaining > 0).reduce((sum, w) => sum + w.units_remaining * w.price_per_bottle, 0)
  const presentCount = wines.filter(w => w.units_remaining > 0).length
  const absentCount = wines.filter(w => w.units_remaining === 0).length

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto md:max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Mi Bodega</h1>
          <p className="text-wine-400 text-sm mt-0.5">
            {totalBottles} {totalBottles === 1 ? 'botella' : 'botellas'} · {totalValue.toFixed(0)} €
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-wine-700 hover:bg-wine-600 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Añadir</span>
        </button>
      </div>

      {pendingCount > 0 && (
        <Link
          to="/pendientes"
          className="flex items-center gap-3 mb-5 px-4 py-3 rounded-xl bg-gold-500/10 border border-gold-500/30 text-gold-400 text-sm font-medium hover:bg-gold-500/20 transition-colors"
        >
          <span className="w-6 h-6 rounded-full bg-gold-500 text-wine-950 text-xs font-bold flex items-center justify-center">
            {pendingCount}
          </span>
          {pendingCount === 1
            ? 'Tienes 1 vino pendiente de confirmar'
            : `Tienes ${pendingCount} vinos pendientes de confirmar`}
          <span className="ml-auto">→</span>
        </Link>
      )}

      {/* Presence filter tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-wine-900/40 rounded-xl border border-wine-800/40">
        {([
          { key: 'present', label: `En bodega (${presentCount})` },
          { key: 'absent',  label: `Histórico (${absentCount})` },
          { key: 'all',     label: 'Todos' },
        ] as { key: PresenceFilter; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPresence(key)}
            className={clsx(
              'flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors',
              presence === key
                ? 'bg-wine-700 text-white'
                : 'text-wine-500 hover:text-wine-300'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search + Sort */}
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wine-500" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar vino, bodega, región..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-wine-900/60 border border-wine-700/40 text-white placeholder-wine-500 text-sm focus:outline-none focus:border-wine-500"
          />
        </div>
        <div className="relative">
          <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wine-500 pointer-events-none" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="pl-9 pr-3 py-2.5 rounded-xl bg-wine-900/60 border border-wine-700/40 text-wine-300 text-sm focus:outline-none focus:border-wine-500 appearance-none cursor-pointer"
          >
            <option value="purchase_date">Compra</option>
            <option value="name">Nombre</option>
            <option value="vintage_year">Añada</option>
            <option value="personal_score">Puntuación</option>
            <option value="price_per_bottle">Precio</option>
          </select>
        </div>
      </div>

      {/* Wine list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-2xl bg-wine-900/40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-wine-500">
          {search
            ? 'Sin resultados para esa búsqueda.'
            : presence === 'absent'
            ? 'No hay vinos en el histórico todavía.'
            : 'Tu bodega está vacía. ¡Añade tu primer vino!'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(wine => (
            <WineCard key={wine.id} wine={wine} onUpdated={fetchWines} />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddWineModal
          onClose={() => setShowAddModal(false)}
          onSaved={wine => {
            setShowAddModal(false)
            setWines(prev => [wine, ...prev])
            fetchWines()
          }}
        />
      )}
    </div>
  )
}
