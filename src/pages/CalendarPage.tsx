import { ISLAMIC_CALENDAR } from '../data/mockData'
import { PageHeader } from '../components/PageHeader'
import './CalendarPage.css'

interface CalendarPageProps {
  onBack: () => void
}

export function CalendarPage({ onBack }: CalendarPageProps) {
  return (
    <div className="calendar-page fade-in">
      <PageHeader title="Islamic Calendar" onBack={onBack} />

      <div className="calendar-body">
        <div className="calendar-today card">
          <div className="cal-label">Today</div>
          <div className="cal-hijri">{ISLAMIC_CALENDAR.hijriDate}</div>
          <div className="cal-gregorian">{ISLAMIC_CALENDAR.gregorianDate}</div>
        </div>

        <div className="section">
          <div className="section-title">Upcoming Events</div>
          {ISLAMIC_CALENDAR.upcomingEvents.map((event) => (
            <div key={event.name} className="event-card card">
              <div className="event-name">{event.name}</div>
              <div className="event-date">{event.date}</div>
              <div className="event-days">{event.daysAway} days away</div>
            </div>
          ))}
        </div>

        <div className="month-grid card">
          <div className="section-title" style={{ padding: '12px 12px 0' }}>Muharram 1448</div>
          <div className="days-header">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <span key={i} className="day-header">{d}</span>
            ))}
          </div>
          <div className="days-grid">
            {Array.from({ length: 30 }, (_, i) => (
              <span
                key={i}
                className={`day-cell ${i + 1 === 14 ? 'today' : ''}`}
              >
                {i + 1}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
