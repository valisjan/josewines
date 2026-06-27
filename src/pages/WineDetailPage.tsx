import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit3, Trash2, GlassWater } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Wine } from '../types/wine'
import { getScoreLabel } from '../types/wine'
import ScoreInput from '../components/ScoreInput'
import clsx from 'clsx'

export default function WineDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [wine, setWine] = useState<Wine | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Wine>>({})

  const fetchWine = async () => {
    const { data } = await supabase.from('wines').select('*').eq('id', id).single()
    setWine(data)
    setEditForm(data ?? {})
  }

  useEffect(() => { fetchWine() }, [id])

  const handleSave = async () => {
    if (!wine) return
    setSaving(true)
    await supabase.from('wines').update(editForm).eq('id', wine.id)
    setSaving(false)
    setEditing(false)
    fetchWine()
  }

  const handleDelete = async () => {
    if (!wine || !confirm(`¿Eliminar "${wine.name}" de tu bodega?`)) return
    await supabase.from('wines').delete().eq('id', wine.id)
    navigate('/')
  }

  const registerConsumption = async () => {
    if (!wine) return
    await supabase.from('consumptions').insert({ wine_id: wine.id, date: new Date().toISOString().split('T')[0] })
    const next = Math.max(0, wine.units_remaining - 1)
    await supabase.from('wines').update({ units_remaining: next }).eq('id', wine.id)
    fetchWine()
  }

  const set = (field: keyof Wine, value: unknown) =>
    setEditForm(prev => ({ ...prev, [field]: value }))

  if (!wine) return (
    <div className="flex items-center justify-center min-h-dvh">
      <div className="w-8 h-8 border-2 border-wine-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const scoreLabel = wine.personal_score ? getScoreLabel(wine.personal_score) : null

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="text-wine-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(!editing)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              editing ? 'bg-wine-700 text-white' : 'text-wine-400 hover:text-white'
            )}
          >
            <Edit3 className="w-4 h-4" />
            {editing ? 'Cancelar' : 'Editar'}
          </button>
          <button
            onClick={handleDelete}
            className="text-wine-600 hover:text-red-400 p-1.5 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Wine name & winery */}
      {editing ? (
        <div className="space-y-2 mb-5">
          <input
            value={editForm.name ?? ''}
            onChange={e => set('name', e.target.value)}
            className={inputCls + ' text-lg font-bold'}
          />
          <input
            value={editForm.winery ?? ''}
            onChange={e => set('winery', e.target.value)}
            className={inputCls}
          />
        </div>
      ) : (
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-white">{wine.name}</h1>
          <p className="text-wine-400 mt-0.5">{wine.winery}</p>
        </div>
      )}

      {/* Score badge */}
      {!editing && wine.personal_score && (
        <div className="flex items-center gap-3 mb-6">
          <div className="px-4 py-2 rounded-xl bg-wine-800/60 border border-wine-700/40">
            <span className={clsx('text-2xl font-bold', scoreLabel?.color)}>{wine.personal_score}</span>
            <span className="text-wine-500 text-sm">/100</span>
          </div>
          {scoreLabel && <span className={clsx('font-medium', scoreLabel.color)}>{scoreLabel.label}</span>}
        </div>
      )}
      {editing && (
        <div className="mb-5">
          <label className="text-xs text-wine-400 font-medium mb-2 block">Puntuación</label>
          <ScoreInput
            value={(editForm.personal_score as number | null) ?? null}
            onChange={s => set('personal_score', s)}
          />
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <DetailCard label="Añada">
          {editing
            ? <input type="number" value={editForm.vintage_year ?? ''} onChange={e => set('vintage_year', e.target.value ? parseInt(e.target.value) : null)} className={inputCls} />
            : <span className="text-white font-semibold">{wine.vintage_year ?? '—'}</span>
          }
        </DetailCard>
        <DetailCard label="Región">
          {editing
            ? <input value={editForm.region ?? ''} onChange={e => set('region', e.target.value || null)} className={inputCls} />
            : <span className="text-white font-semibold">{wine.region ?? '—'}</span>
          }
        </DetailCard>
        <DetailCard label="Precio / botella">
          {editing
            ? <input type="number" step="0.01" value={editForm.price_per_bottle ?? ''} onChange={e => set('price_per_bottle', parseFloat(e.target.value))} className={inputCls} />
            : <span className="text-white font-semibold">{wine.price_per_bottle.toFixed(2)} €</span>
          }
        </DetailCard>
        <DetailCard label="Botellas">
          <span className="text-white font-semibold">
            {wine.units_remaining} <span className="text-wine-500 text-sm font-normal">/ {wine.units_purchased}</span>
          </span>
        </DetailCard>
        <DetailCard label="Compra">
          <span className="text-white font-semibold">
            {new Date(wine.purchase_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </DetailCard>
        {(wine.optimal_drink_from || wine.optimal_drink_until) && (
          <DetailCard label="Beber entre">
            <span className="text-white font-semibold">
              {wine.optimal_drink_from}–{wine.optimal_drink_until}
            </span>
          </DetailCard>
        )}
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label className="text-xs text-wine-400 font-medium mb-2 block">Notas</label>
        {editing
          ? <textarea value={editForm.notes ?? ''} onChange={e => set('notes', e.target.value || null)} rows={3} className={`${inputCls} resize-none`} placeholder="Tus impresiones..." />
          : <p className="text-wine-300 text-sm leading-relaxed">{wine.notes || <span className="text-wine-600 italic">Sin notas</span>}</p>
        }
      </div>

      {/* Actions */}
      {editing ? (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-2xl bg-wine-700 hover:bg-wine-600 text-white font-semibold disabled:opacity-50 transition-colors"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      ) : (
        <button
          onClick={registerConsumption}
          disabled={wine.units_remaining === 0}
          className="w-full py-3.5 rounded-2xl bg-wine-900/60 border border-wine-700/50 hover:bg-wine-800/60 text-wine-300 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-colors"
        >
          <GlassWater className="w-4 h-4" />
          Registrar consumo (−1 botella)
        </button>
      )}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-xl bg-wine-900/60 border border-wine-700/40 text-white text-sm focus:outline-none focus:border-wine-500'

function DetailCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 rounded-xl bg-wine-900/40 border border-wine-800/40">
      <p className="text-wine-500 text-xs mb-1">{label}</p>
      {children}
    </div>
  )
}
