import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ScoreInput from './ScoreInput'

interface Props {
  onClose: () => void
  onSaved: () => void
}

export default function AddWineModal({ onClose, onSaved }: Props) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    winery: '',
    region: '',
    grape_variety: '',
    vintage_year: '',
    purchase_date: new Date().toISOString().split('T')[0],
    price_per_bottle: '',
    units_purchased: '1',
    personal_score: null as number | null,
    notes: '',
    optimal_drink_from: '',
    optimal_drink_until: '',
  })

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    const units = parseInt(form.units_purchased) || 1
    await supabase.from('wines').insert({
      user_id: user.id,
      name: form.name.trim(),
      winery: form.winery.trim(),
      region: form.region.trim() || null,
      grape_variety: form.grape_variety.trim() || null,
      vintage_year: form.vintage_year ? parseInt(form.vintage_year) : null,
      purchase_date: form.purchase_date,
      price_per_bottle: parseFloat(form.price_per_bottle) || 0,
      units_purchased: units,
      units_remaining: units,
      personal_score: form.personal_score,
      notes: form.notes.trim() || null,
      optimal_drink_from: form.optimal_drink_from ? parseInt(form.optimal_drink_from) : null,
      optimal_drink_until: form.optimal_drink_until ? parseInt(form.optimal_drink_until) : null,
    })

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-wine-950 border border-wine-800/50 rounded-t-3xl sm:rounded-2xl max-h-[90dvh] overflow-y-auto">
        <div className="sticky top-0 bg-wine-950 flex items-center justify-between px-5 pt-5 pb-4 border-b border-wine-800/40">
          <h2 className="text-lg font-bold text-white">Añadir vino</h2>
          <button onClick={onClose} className="text-wine-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <Field label="Nombre del vino *">
            <input
              required
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Vega Sicilia Único 2015"
              className={inputCls}
            />
          </Field>

          <Field label="Bodega *">
            <input
              required
              value={form.winery}
              onChange={e => set('winery', e.target.value)}
              placeholder="Vega Sicilia"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Región / DO">
              <input
                value={form.region}
                onChange={e => set('region', e.target.value)}
                placeholder="Ribera del Duero"
                className={inputCls}
              />
            </Field>
            <Field label="Uva">
              <input
                value={form.grape_variety}
                onChange={e => set('grape_variety', e.target.value)}
                placeholder="Tempranillo"
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Añada">
              <input
                type="number"
                min={1900}
                max={new Date().getFullYear()}
                value={form.vintage_year}
                onChange={e => set('vintage_year', e.target.value)}
                placeholder={String(new Date().getFullYear() - 1)}
                className={inputCls}
              />
            </Field>
            <Field label="Fecha de compra *">
              <input
                required
                type="date"
                value={form.purchase_date}
                onChange={e => set('purchase_date', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio / botella (€) *">
              <input
                required
                type="number"
                min={0}
                step={0.01}
                value={form.price_per_bottle}
                onChange={e => set('price_per_bottle', e.target.value)}
                placeholder="12.50"
                className={inputCls}
              />
            </Field>
            <Field label="Unidades">
              <input
                type="number"
                min={1}
                value={form.units_purchased}
                onChange={e => set('units_purchased', e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Beber entre (años)">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={2000}
                max={2060}
                value={form.optimal_drink_from}
                onChange={e => set('optimal_drink_from', e.target.value)}
                placeholder="2026"
                className={inputCls}
              />
              <span className="text-wine-500 flex-shrink-0">—</span>
              <input
                type="number"
                min={2000}
                max={2060}
                value={form.optimal_drink_until}
                onChange={e => set('optimal_drink_until', e.target.value)}
                placeholder="2032"
                className={inputCls}
              />
            </div>
          </Field>

          <Field label="Tu puntuación">
            <ScoreInput value={form.personal_score} onChange={s => setForm(p => ({ ...p, personal_score: s }))} />
          </Field>

          <Field label="Notas">
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Impresiones, maridajes, ocasión..."
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </Field>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-wine-700 hover:bg-wine-600 text-white font-semibold disabled:opacity-50 transition-colors mt-2"
          >
            {saving ? 'Guardando...' : 'Guardar en bodega'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-wine-900/60 border border-wine-700/40 text-white placeholder-wine-600 text-sm focus:outline-none focus:border-wine-500'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-wine-400 mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}
