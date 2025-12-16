'use client'

interface DecaySliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

export function DecaySlider({ value, onChange, min = 1, max = 365 }: DecaySliderProps) {
  return (
    <div className="form-group">
      <label htmlFor="decay-slider">
        Search Half-Life: <span className="text-accent">{value}</span> days
      </label>
      <input
        id="decay-slider"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="range-slider"
      />
      <p className="form-helper">
        Controls how quickly older entries decay in search results. Lower values favor recent entries.
      </p>
    </div>
  )
}
