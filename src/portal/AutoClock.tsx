import { useState } from 'react'
import { ClockField } from './ClockField'

/**
 * A clock the desk works out by itself. It shows the derived time with an Edit button.
 * Once the owner edits it, the normal clock field appears with an Auto button to go back.
 * When there is no derived time (no pin, or the sun lookup failed) this is a plain clock field.
 */
export function AutoClock({
  label,
  value,
  auto,
  onChange,
}: {
  label: string
  value: string
  auto: string | null
  onChange: (next: string) => void
}) {
  const [editing, setEditing] = useState(false)

  if (!auto) return <ClockField label={label} value={value} onChange={onChange} />

  const manual = editing || (value !== '' && value !== auto)

  if (!manual) {
    return (
      <div className="auto-clock" title="Worked out from sunset and Fajr">
        <strong className="time">{auto}</strong>
        <span className="auto-tag">Auto</span>
        <button type="button" aria-label={`Edit ${label}`} onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
    )
  }

  return (
    <div className="auto-edit">
      <ClockField label={label} value={value} onChange={onChange} />
      <button
        type="button"
        className="auto-reset"
        title={`Use ${auto}`}
        aria-label={`Use the automatic ${label}, ${auto}`}
        onClick={() => {
          setEditing(false)
          onChange('')
        }}
      >
        Auto
      </button>
    </div>
  )
}
