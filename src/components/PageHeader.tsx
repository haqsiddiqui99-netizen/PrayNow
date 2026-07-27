interface PageHeaderProps {
  title: string
  onBack?: () => void
}

export function PageHeader({ title, onBack }: PageHeaderProps) {
  return (
    <header className="page-header">
      {onBack && (
        <button className="back-btn" onClick={onBack} aria-label="Go back">
          ←
        </button>
      )}
      <h1>{title}</h1>
    </header>
  )
}
