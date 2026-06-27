import { Link } from 'react-router-dom'
import { Wine, Minus, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Wine as WineType } from '../types/wine'
import { getScoreLabel } from '../types/wine'
import clsx from 'clsx'

interface Props {
  wine: WineType
  onUpdated: () => void
}

export default function WineCard({ wine, onUpdated }: Props) {
  const scoreLabel = wine.personal_score ? getScoreLabel(wine.personal_score) : null

  const updateUnits = async (delta: number) => {
    const next = Math.max(0, wine.units_remaining + delta)
    await supabase.from('wines').update({ units_remaining: next }).eq('id', wine.id)
    onUpdated()
  }

  return (
    <Link
      to={`/vino/${wine.id}`}
      className="flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-wine-900/40 border border-wine-800/40 hover:bg-wine-900/70 hover:border-wine-700/50 transition-colors group"
    >
      {/* Label thumbnail */}
      <div className="w-12 h-16 rounded-lg bg-wine-800/60 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {wine.label_image_url ? (
          <img src={wine.label_image_url} alt={wine.name} className="w-full h-full object-cover" />
        ) : (
          <Wine className="w-5 h-5 text-wine-600" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{wine.name}</p>
        <p className="text-wine-400 text-xs truncate">{wine.winery}{wine.region ? ` · ${wine.region}` : ''}</p>
        <div className="flex items-center gap-2 mt-1">
          {wine.vintage_year && (
            <span className="text-xs text-wine-500">{wine.vintage_year}</span>
          )}
          {scoreLabel && (
            <span className={clsx('text-xs font-medium', scoreLabel.color)}>
              {wine.personal_score}/100
            </span>
          )}
          <span className="text-xs text-wine-500">{wine.price_per_bottle.toFixed(2)} €</span>
        </div>
      </div>

      {/* Units control */}
      <div
        className="flex items-center gap-2 flex-shrink-0"
        onClick={e => e.preventDefault()}
      >
        <button
          onClick={e => { e.preventDefault(); updateUnits(-1) }}
          disabled={wine.units_remaining === 0}
          className="w-7 h-7 rounded-full bg-wine-800 hover:bg-wine-700 flex items-center justify-center disabled:opacity-30 transition-colors"
        >
          <Minus className="w-3 h-3 text-white" />
        </button>
        <span className="w-6 text-center text-white text-sm font-semibold">{wine.units_remaining}</span>
        <button
          onClick={e => { e.preventDefault(); updateUnits(1) }}
          className="w-7 h-7 rounded-full bg-wine-800 hover:bg-wine-700 flex items-center justify-center transition-colors"
        >
          <Plus className="w-3 h-3 text-white" />
        </button>
      </div>
    </Link>
  )
}
