export interface Wine {
  id: string
  user_id: string
  name: string
  winery: string
  region: string | null
  grape_variety: string | null
  vintage_year: number | null
  purchase_date: string
  price_per_bottle: number
  units_purchased: number
  units_remaining: number
  personal_score: number | null
  notes: string | null
  label_image_url: string | null
  optimal_drink_from: number | null
  optimal_drink_until: number | null
  source_order_id: string | null
  created_at: string
}

export interface PendingWine {
  id: string
  user_id: string
  name: string
  winery: string
  region: string | null
  grape_variety: string | null
  vintage_year: number | null
  purchase_date: string
  price_per_bottle: number
  units_purchased: number
  source_email_subject: string | null
  source_order_id: string | null
  raw_email_snippet: string | null
  label_image_url?: string | null
  created_at: string
  selected?: boolean
  personal_score?: number | null
  notes?: string | null
}

export interface Consumption {
  id: string
  wine_id: string
  date: string
  occasion: string | null
  notes: string | null
  created_at: string
}

export type ScoreLabel = {
  min: number
  max: number
  label: string
  color: string
}

export const SCORE_LABELS: ScoreLabel[] = [
  { min: 95, max: 100, label: 'Excepcional', color: 'text-yellow-400' },
  { min: 90, max: 94, label: 'Sobresaliente', color: 'text-green-400' },
  { min: 85, max: 89, label: 'Muy bueno', color: 'text-blue-400' },
  { min: 80, max: 84, label: 'Bueno', color: 'text-indigo-400' },
  { min: 70, max: 79, label: 'Correcto', color: 'text-gray-300' },
  { min: 0, max: 69, label: 'Básico', color: 'text-gray-400' },
]

export function getScoreLabel(score: number): ScoreLabel {
  return SCORE_LABELS.find(s => score >= s.min && score <= s.max) ?? SCORE_LABELS[SCORE_LABELS.length - 1]
}
