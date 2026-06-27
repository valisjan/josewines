import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit3, Trash2, GlassWater, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Wine, Consumption } from '../types/wine'
import { getScoreLabel } from '../types/wine'
import ScoreInput from '../components/ScoreInput'
import PhotoUpload from '../components/PhotoUpload'
import clsx from 'clsx'

export default function WineDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [wine, setWine] = useState<Wine | null>(null)
  const [consumptions, setConsumptions] = useState<Consumption[]>([])
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Wine>>({})
  const [showConsumeForm, setShowConsumeForm] = useState(false)
  const [consumeDate, setConsumeDate] = useState(new Date().toISOString().split('T')[0])
  const [consumeOccasion, setConsumeOccasion] = useState('')
  const [consumeNotes, setConsumeNotes] = useState('')

  const fetchWine = async () => {
    const { data } = await supabase.from('wines').select('*').eq('id', id).single()
    setWine(data)
    setEditForm(data ?? {})
  }

  const fetchConsumptions = async () => {
    const { data } = await supabase
      .from('consumptions')
      .select('*')
      .eq('wine_id', id)
      .order('date', { ascending: false })
    setConsumptions(data ?? [])
  }

  useEffect(() => {
    fetchWine()
    fetchConsumptions()
  }, [id])

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

  const handleConsume = async () => {
    if (!wine) return
    await supabase.from('consumptions').insert({
      wine_id: wine.id,
      date: consumeDate,
      occasion: consumeOccasion.trim() || null,
      notes: consumeNotes.trim() || null,
    })
    const next = Math.max(0, wine.units_remaining - 1)
    await supabase.from('wines').update({ units_remaining: next }).eq('id', wine.id)
    setShowConsumeForm(false)
    setConsumeOccasion('')
    setConsumeNotes('')
    fetchWine()
    fetchConsumptions()
  }

  const set = (field: keyof Wine, value: unknown) =>
    setEditForm(prev => ({ ...prev, [field]: value }))

  if (!wine) return (
    <div className="flex items-center justify-center min-h-dvh">
      <div className="w-8 h-8 border-2 border-wine-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const scoreLabel = wine.personal_score ? getScoreLabel(wine.personal_score) : null
  const isAbsent = wine.units_remaining === 0

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="text-wine-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditing(!editing); setShowConsumeForm(false) }}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              editing ? 'bg-wine-700 text-white' : 'text-wine-400 hover:text-white'
            )}
          >
            <Edit3 className="w-4 h-4" />
            {editing ? 'Cancelar' : 'Editar'}
          </button>
          <button onClick={handleDelete} className="text-wine-600 hover:text-red-400 p-1.5 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Photo + name */}
      <div className="flex gap-4 mb-5">
        {(wine.label_image_url || editing) && (
          <div className="flex-shrink-0">
            {editing ? (
              <PhotoUpload
                currentUrl={(editForm.label_image_url as string | null) ?? null}
                onUploaded={url => set('label_image_url', url)}
              />
            ) : wine.label_image_url ? (
              <img
                src={wine.label_image_url}
                alt={wine.name}
                className="w-20 h-28 rounded-xl object-cover border border-wine-800/40"
              />
            ) : null}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input value={editForm.name ?? ''} onChange={e => set('name', e.target.value)} className={inputCls + ' font-bold'} />
              <input value={editForm.winery ?? ''} onChange={e => set('winery', e.target.value)} className={inputCls} />
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2">
                <h1 className="text-2xl font-bold text-white leading-tight">{wine.name}</h1>
                {isAbsent && (
                  <span className="flex-shrink-0 mt-1 px-2 py-0.5 rounded-full bg-wine-900 border border-wine-700 text-wine-500 text-xs font-medium">
                    Agotado
                  </span>
                )}
              </div>
              <p className="text-wine-400 mt-0.5">{wine.winery}</p>
            </>
          )}
        </div>
      </div>

      {/* Score */}
      {!editing && wine.personal_score ? (
        <div className="flex items-center gap-3 mb-5">
          <div className="px-4 py-2 rounded-xl bg-wine-800/60 border border-wine-700/40">
            <span className={clsx('text-2xl font-bold', scoreLabel?.color)}>{wine.personal_score}</span>
            <span className="text-wine-500 text-sm">/100</span>
          </div>
          {scoreLabel && <span className={clsx('font-medium', scoreLabel.color)}>{scoreLabel.label}</span>}
        </div>
      ) : editing ? (
        <div className="mb-5">
          <label className="text-xs text-wine-400 font-medium mb-2 block">Puntuación</label>
          <ScoreInput
            value={(editForm.personal_score as number | null) ?? null}
            onChange={s => set('personal_score', s)}
          />
        </div>
      ) : null}

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <DetailCard label="Añada">
          {editing
            ? <input type="number" value={editForm.vintage_year ?? ''} onChange={e => set('vintage_year', e.target.value ? parseInt(e.target.value) : null)} className={inputCls} />
            : <span className="text-white font-semibold">{wine.vintage_year ?? '—'}</span>}
        </DetailCard>
        <DetailCard label="Región">
          {editing
            ? <input value={editForm.region ?? ''} onChange={e => set('region', e.target.value || null)} className={inputCls} />
            : <span className="text-white font-semibold">{wine.region ?? '—'}</span>}
        </DetailCard>
        <DetailCard label="Precio / botella">
          {editing
            ? <input type="number" step="0.01" value={editForm.price_per_bottle ?? ''} onChange={e => set('price_per_bottle', parseFloat(e.target.value))} className={inputCls} />
            : <span className="text-white font-semibold">{wine.price_per_bottle.toFixed(2)} €</span>}
        </DetailCard>
        <DetailCard label="Botellas">
          <span className="text-white font-semibold">
            {wine.units_remaining}
            <span className="text-wine-500 text-sm font-normal"> / {wine.units_purchased}</span>
          </span>
        </DetailCard>
        <DetailCard label="Compra">
          <span className="text-white font-semibold">
            {new Date(wine.purchase_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </DetailCard>
        {(wine.optimal_drink_from || wine.optimal_drink_until) && (
          <DetailCard label="Beber entre">
            <span className="text-white font-semibold">{wine.optimal_drink_from}–{wine.optimal_drink_until}</span>
          </DetailCard>
        )}
      </div>

      {/* Notes */}
      <div className="mb-5">
        <label className="text-xs text-wine-400 font-medium mb-2 block">Notas</label>
        {editing
          ? <textarea value={editForm.notes ?? ''} onChange={e => set('notes', e.target.value || null)} rows={3} className={`${inputCls} resize-none`} placeholder="Tus impresiones..." />
          : <p className="text-wine-300 text-sm leading-relaxed">{wine.notes || <span className="text-wine-600 italic">Sin notas</span>}</p>}
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
        <div className="space-y-2">
          {!showConsumeForm ? (
            <button
              onClick={() => setShowConsumeForm(true)}
              disabled={isAbsent}
              className="w-full py-3.5 rounded-2xl bg-wine-900/60 border border-wine-700/50 hover:bg-wine-800/60 text-wine-300 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-colors"
            >
              <GlassWater className="w-4 h-4" />
              Registrar consumo
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-wine-900/60 border border-wine-700/50 space-y-3">
              <p className="text-white text-sm font-semibold">¿Cuándo y cómo fue?</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-wine-500 mb-1 block">Fecha</label>
                  <input type="date" value={consumeDate} onChange={e => setConsumeDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-wine-500 mb-1 block">Ocasión</label>
                  <input value={consumeOccasion} onChange={e => setConsumeOccasion(e.target.value)} placeholder="Cena, regalo..." className={inputCls} />
                </div>
              </div>
              <textarea value={consumeNotes} onChange={e => setConsumeNotes(e.target.value)} placeholder="Notas de la degustación (opcional)..." rows={2} className={`${inputCls} resize-none`} />
              <div className="flex gap-2">
                <button onClick={() => setShowConsumeForm(false)} className="flex-1 py-2.5 rounded-xl border border-wine-700 text-wine-400 text-sm font-medium">
                  Cancelar
                </button>
                <button onClick={handleConsume} className="flex-1 py-2.5 rounded-xl bg-wine-700 hover:bg-wine-600 text-white text-sm font-semibold transition-colors">
                  Confirmar (−1 botella)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Consumption history */}
      {consumptions.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-wine-500" />
            <h2 className="text-sm font-semibold text-wine-300 uppercase tracking-wider">
              Historial ({consumptions.length})
            </h2>
          </div>
          <div className="relative">
            <div className="absolute left-3.5 top-0 bottom-0 w-px bg-wine-800/60" />
            <div className="space-y-4">
              {consumptions.map(c => (
                <div key={c.id} className="flex gap-4 relative">
                  <div className="w-7 h-7 rounded-full bg-wine-800 border border-wine-700 flex items-center justify-center flex-shrink-0 z-10">
                    <GlassWater className="w-3.5 h-3.5 text-wine-400" />
                  </div>
                  <div className="flex-1 pb-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-white text-sm font-medium">
                        {new Date(c.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                      {c.occasion && (
                        <span className="text-wine-500 text-xs">{c.occasion}</span>
                      )}
                    </div>
                    {c.notes && (
                      <p className="text-wine-400 text-sm mt-0.5 leading-relaxed">{c.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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
