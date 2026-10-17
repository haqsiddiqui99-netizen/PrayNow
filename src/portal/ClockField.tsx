import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { clockBroken } from './timeEntry'

type Period = 'AM' | 'PM'

function assumedPeriod(label: string): Period {
  return /fajr|tahajjud|sehri/i.test(label) ? 'AM' : 'PM'
}

function partsOf(value: string): { hour: string; minute: string; period: Period } | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 1 || hour > 12 || minute > 59) return null
  return { hour: String(hour), minute: match[2], period: match[3].toUpperCase() as Period }
}

/** Hours are 1 to 12. A second digit stays only when the pair is still a real hour. */
function hourDigits(text: string) {
  const digits = text.replace(/\D/g, '').slice(0, 2)
  if (!digits || digits[0] === '0') return ''
  if (digits.length === 1) return digits
  return Number(digits) <= 12 ? digits : digits[0]
}

/** Minutes are 00 to 59, so the first digit can only be 0 to 5. */
function minuteDigits(text: string) {
  const digits = text.replace(/\D/g, '').slice(0, 2)
  if (!digits || Number(digits[0]) > 5) return ''
  if (digits.length === 1) return digits
  return Number(digits) <= 59 ? digits : digits[0]
}

export function ClockField({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (next: string) => void
  label: string
}) {
  const parsed = partsOf(value)
  const broken = clockBroken(value)
  const [hour, setHour] = useState(parsed?.hour ?? '')
  const [minute, setMinute] = useState(parsed?.minute ?? '')
  const [period, setPeriod] = useState<Period>(parsed?.period ?? assumedPeriod(label))
  const minuteRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const next = partsOf(value)
    setHour(next?.hour ?? '')
    setMinute(next?.minute ?? '')
    if (next) setPeriod(next.period)
  }, [value])

  const revert = () => {
    const saved = partsOf(value)
    setHour(saved?.hour ?? '')
    setMinute(saved?.minute ?? '')
  }

  /** Writes a clock only when it is real. Anything else falls back to the saved time. */
  const finish = (nextHour: string, nextMinute: string, nextPeriod: Period) => {
    const h = hourDigits(nextHour)
    const m = minuteDigits(nextMinute)
    setHour(h)
    setMinute(m)
    if (!h && !m) {
      if (value) onChange('')
      return
    }
    const hourNumber = Number(h)
    const minuteNumber = m === '' ? NaN : Number(m)
    if (hourNumber >= 1 && hourNumber <= 12 && minuteNumber >= 0 && minuteNumber <= 59) {
      const ready = `${hourNumber}:${String(minuteNumber).padStart(2, '0')} ${nextPeriod}`
      if (ready !== value) onChange(ready)
      return
    }
    revert()
  }

  const flip = (next: Period) => {
    setPeriod(next)
    finish(hour, minute, next)
  }

  const periodKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    const key = event.key.toLowerCase()
    if (key !== 'a' && key !== 'p') return
    event.preventDefault()
    flip(key === 'a' ? 'AM' : 'PM')
  }

  /** Selects what is already typed so the next digits replace it. */
  const pick = (event: FocusEvent<HTMLInputElement>) => {
    const box = event.target
    requestAnimationFrame(() => box.select())
  }

  const empty = !hour && !minute
  const classes = ['clock', broken ? 'bad' : '', empty ? 'empty' : ''].filter(Boolean).join(' ')

  return (
    <div className={classes} title={broken ? `${value} is not a time` : 'Hour 1 to 12, minute 00 to 59'}>
      <input
        className="clock-hour"
        inputMode="numeric"
        autoComplete="off"
        aria-label={`${label} hour`}
        placeholder="5"
        value={hour}
        onChange={(event) => {
          const next = hourDigits(event.target.value)
          setHour(next)
          if (next.length === 2 || (next.length === 1 && Number(next) > 1)) minuteRef.current?.focus()
        }}
        onFocus={pick}
        onBlur={() => finish(hour, minute, period)}
        onKeyDown={periodKeys}
      />
      <span className="clock-colon">:</span>
      <input
        ref={minuteRef}
        className="clock-minute"
        inputMode="numeric"
        autoComplete="off"
        aria-label={`${label} minute`}
        placeholder="00"
        value={minute}
        onChange={(event) => {
          const next = minuteDigits(event.target.value)
          setMinute(next)
          if (next.length === 2) finish(hour, next, period)
        }}
        onFocus={pick}
        onBlur={() => finish(hour, minute, period)}
        onKeyDown={periodKeys}
      />
      <div className="ampm" role="group" aria-label={`${label} AM or PM`}>
        {(['AM', 'PM'] as Period[]).map((option) => (
          <button
            key={option}
            type="button"
            className={option === period ? 'on' : ''}
            aria-pressed={option === period}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => flip(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
