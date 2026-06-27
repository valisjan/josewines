import { useState } from 'react'
import { getScoreLabel } from '../types/wine'
import clsx from 'clsx'

interface Props {
  value: number | null
  onChange: (score: number | null) => void
}

export default function ScoreInput({ value, onChange }: Props) {
  const [inputVal, setInputVal] = useState(value?.toString() ?? '')
  const label = value ? getScoreLabel(value) : null

  const handleChange = (raw: string) => {
    setInputVal(raw)
    const n = parseInt(raw)
    if (!raw) { onChange(null); return }
    if (!isNaN(n) && n >= 50 && n <= 100) onChange(n)
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <input
          type="number"
          min={50}
          max={100}
          value={inputVal}
          onChange={e => handleChange(e.target.value)}
          placeholder="—"
          className="w-20 px-3 py-2 rounded-xl bg-wine-900/60 border border-wine-700/40 text-white text-center text-sm font-bold focus:outline-none focus:border-wine-500"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-wine-600 text-xs pointer-events-none">
          /100
        </span>
      </div>
      {label && (
        <span className={clsx('text-sm font-medium', label.color)}>{label.label}</span>
      )}
      {/* Quick picks */}
      <div className="flex gap-1.5 ml-auto">
        {[85, 90, 92, 95].map(n => (
          <button
            key={n}
            onClick={() => { onChange(n); setInputVal(n.toString()) }}
            className={clsx(
              'px-2 py-1 rounded-lg text-xs font-medium transition-colors',
              value === n
                ? 'bg-wine-600 text-white'
                : 'bg-wine-800/60 text-wine-400 hover:bg-wine-700/60'
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
