interface MosqueFacilitiesLineProps {
  facilities: string[]
  className?: string
  max?: number
}

export function MosqueFacilitiesLine({ facilities, className = '', max }: MosqueFacilitiesLineProps) {
  if (!facilities.length) return null

  const shown = max ? facilities.slice(0, max) : facilities
  const extra = max ? Math.max(0, facilities.length - max) : 0

  return (
    <div className={`mosque-facilities-line${className ? ` ${className}` : ''}`}>
      {shown.map((f) => (
        <span key={f} className="facility-pill">{f}</span>
      ))}
      {extra > 0 && (
        <span className="facility-pill facility-pill--more">+{extra}</span>
      )}
    </div>
  )
}
