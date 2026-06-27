import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Wine } from '../types/wine'
import clsx from 'clsx'

interface RegionStat { region: string; count: number; value: number }

export default function StatsPage() {
  const { user } = useAuth()
  const [wines, setWines] = useState<Wine[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('wines').select('*').eq('user_id', user.id).then(({ data }) => {
      setWines(data ?? [])
      setLoading(false)
    })
  }, [user])

  if (loading) return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-wine-900/40 animate-pulse" />)}
    </div>
  )

  const totalBottles = wines.reduce((s, w) => s + w.units_remaining, 0)
  const totalValue = wines.reduce((s, w) => s + w.units_remaining * w.price_per_bottle, 0)
  const totalSpent = wines.reduce((s, w) => s + w.units_purchased * w.price_per_bottle, 0)
  const consumed = wines.reduce((s, w) => s + (w.units_purchased - w.units_remaining), 0)

  const scored = wines.filter(w => w.personal_score)
  const avgScore = scored.length ? scored.reduce((s, w) => s + (w.personal_score ?? 0), 0) / scored.length : null
  const topWine = scored.length ? scored.reduce((a, b) => (a.personal_score ?? 0) > (b.personal_score ?? 0) ? a : b) : null

  const byRegion: RegionStat[] = Object.values(
    wines.reduce((acc: Record<string, RegionStat>, w) => {
      const key = w.region ?? 'Sin región'
      if (!acc[key]) acc[key] = { region: key, count: 0, value: 0 }
      acc[key].count += w.units_remaining
      acc[key].value += w.units_remaining * w.price_per_bottle
      return acc
    }, {})
  ).sort((a, b) => b.count - a.count)

  const maxCount = byRegion[0]?.count ?? 1

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Estadísticas</h1>

      {wines.length === 0 ? (
        <p className="text-wine-500 text-center py-12">Añade vinos para ver estadísticas.</p>
      ) : (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Botellas en bodega" value={totalBottles.toString()} />
            <StatCard label="Valor actual" value={`${totalValue.toFixed(0)} €`} />
            <StatCard label="Total gastado" value={`${totalSpent.toFixed(0)} €`} />
            <StatCard label="Botellas bebidas" value={consumed.toString()} />
            {avgScore && <StatCard label="Puntuación media" value={`${avgScore.toFixed(1)}/100`} highlight />}
            <StatCard label="Referencias distintas" value={wines.length.toString()} />
          </div>

          {/* Top wine */}
          {topWine && (
            <div className="px-4 py-3.5 rounded-2xl bg-gold-500/10 border border-gold-500/25">
              <p className="text-gold-500 text-xs font-semibold uppercase tracking-wider mb-1">Mejor valorado</p>
              <p className="text-white font-bold">{topWine.name}</p>
              <p className="text-wine-400 text-sm">{topWine.winery} · {topWine.personal_score}/100</p>
            </div>
          )}

          {/* By region */}
          {byRegion.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-wine-300 uppercase tracking-wider">Por región</h2>
              <div className="space-y-2">
                {byRegion.map(r => (
                  <div key={r.region} className="px-4 py-3 rounded-xl bg-wine-900/40 border border-wine-800/40">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white text-sm font-medium">{r.region}</span>
                      <span className="text-wine-400 text-xs">{r.count} bot. · {r.value.toFixed(0)} €</span>
                    </div>
                    <div className="h-1.5 bg-wine-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-wine-500 rounded-full transition-all"
                        style={{ width: `${(r.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={clsx(
      'px-4 py-3.5 rounded-2xl border',
      highlight ? 'bg-wine-700/30 border-wine-600/40' : 'bg-wine-900/40 border-wine-800/40'
    )}>
      <p className="text-wine-500 text-xs mb-1">{label}</p>
      <p className={clsx('text-xl font-bold', highlight ? 'text-wine-300' : 'text-white')}>{value}</p>
    </div>
  )
}
