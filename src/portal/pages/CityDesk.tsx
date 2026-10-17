import { useEffect, useState } from 'react'
import type { PrayerName } from '../../types'
import { desk } from '../api'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

type Settings = {
  city: string
  country: string
  lat: number
  lng: number
  zawal_start: string
  zawal_end: string
  sunrise: string
  fajr_namaz_end: string
  tahajjud_start: string
  tahajjud_end: string
  sehri_start: string
  sehri_end: string
}

type ScheduleRow = { prayer_name: PrayerName; start_time: string; end_time: string }

const EMPTY: Settings = {
  city: 'Delhi',
  country: 'India',
  lat: 28.6139,
  lng: 77.209,
  zawal_start: '11:20 AM',
  zawal_end: '11:55 AM',
  sunrise: '5:45 AM',
  fajr_namaz_end: '5:40 AM',
  tahajjud_start: '12:30 AM',
  tahajjud_end: '4:40 AM',
  sehri_start: '3:10 AM',
  sehri_end: '4:50 AM',
}

export function CityDesk() {
  const [settings, setSettings] = useState<Settings>(EMPTY)
  const [schedule, setSchedule] = useState<ScheduleRow[]>(PRAYERS.map((prayer) => ({ prayer_name: prayer, start_time: '', end_time: '' })))
  const [year, setYear] = useState(new Date().getFullYear())
  const [loaded, setLoaded] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let live = true
    void desk
      .citySettings()
      .then(async (data) => {
        if (!live) return
        if (data.settings) {
          setSettings({
            city: String(data.settings.city || EMPTY.city),
            country: String(data.settings.country || EMPTY.country),
            lat: Number(data.settings.lat ?? EMPTY.lat),
            lng: Number(data.settings.lng ?? EMPTY.lng),
            zawal_start: String(data.settings.zawal_start || EMPTY.zawal_start),
            zawal_end: String(data.settings.zawal_end || EMPTY.zawal_end),
            sunrise: String(data.settings.sunrise || EMPTY.sunrise),
            fajr_namaz_end: String(data.settings.fajr_namaz_end || EMPTY.fajr_namaz_end),
            tahajjud_start: String(data.settings.tahajjud_start || EMPTY.tahajjud_start),
            tahajjud_end: String(data.settings.tahajjud_end || EMPTY.tahajjud_end),
            sehri_start: String(data.settings.sehri_start || EMPTY.sehri_start),
            sehri_end: String(data.settings.sehri_end || EMPTY.sehri_end),
          })
        }
        if (data.schedule?.length) {
          setSchedule(
            PRAYERS.map((prayer) => {
              const row = data.schedule.find((item) => item.prayer_name === prayer)
              return { prayer_name: prayer, start_time: row?.start_time || '', end_time: row?.end_time || '' }
            }),
          )
        }
        const days = await desk.cityDays(year)
        if (live) setLoaded(days.yearDaysLoaded)
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : 'Could not load the city')
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [year])

  const setField = (key: keyof Settings, value: string) => {
    setSettings((current) => ({
      ...current,
      [key]: key === 'lat' || key === 'lng' ? Number(value) : value,
    }))
  }

  if (loading) return <p className="muted">Loading the city schedule…</p>

  return (
    <section>
      <header className="page-head">
        <div>
          <p className="eyebrow">City times</p>
          <h2>What the home screen uses</h2>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="ok">{notice}</p> : null}
      <form
        className="panel stack"
        onSubmit={(event) => {
          event.preventDefault()
          setSaving(true)
          setError('')
          void desk
            .saveCity({ settings, schedule })
            .then(() => setNotice('City times saved.'))
            .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Save failed'))
            .finally(() => setSaving(false))
        }}
      >
        <div className="form-grid">
          <label>
            City
            <input value={settings.city} onChange={(e) => setField('city', e.target.value)} />
          </label>
          <label>
            Country
            <input value={settings.country} onChange={(e) => setField('country', e.target.value)} />
          </label>
          <label>
            Latitude
            <input value={String(settings.lat)} onChange={(e) => setField('lat', e.target.value)} />
          </label>
          <label>
            Longitude
            <input value={String(settings.lng)} onChange={(e) => setField('lng', e.target.value)} />
          </label>
          {(
            [
              ['sunrise', 'Sunrise'],
              ['fajr_namaz_end', 'Fajr ends'],
              ['zawal_start', 'Zawal starts'],
              ['zawal_end', 'Zawal ends'],
              ['tahajjud_start', 'Tahajjud starts'],
              ['tahajjud_end', 'Tahajjud ends'],
              ['sehri_start', 'Sehri starts'],
              ['sehri_end', 'Sehri ends'],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input value={settings[key]} onChange={(e) => setField(key, e.target.value)} />
            </label>
          ))}
        </div>
        <h3>Prayer windows</h3>
        <div className="time-table">
          <div className="time-head">
            <span>Prayer</span>
            <span>Starts</span>
            <span>Ends</span>
          </div>
          {schedule.map((row) => (
            <div key={row.prayer_name} className="time-row">
              <strong>{row.prayer_name}</strong>
              <input
                value={row.start_time}
                onChange={(e) =>
                  setSchedule((rows) => rows.map((item) => (item.prayer_name === row.prayer_name ? { ...item, start_time: e.target.value } : item)))
                }
              />
              <input
                value={row.end_time}
                onChange={(e) =>
                  setSchedule((rows) => rows.map((item) => (item.prayer_name === row.prayer_name ? { ...item, end_time: e.target.value } : item)))
                }
              />
            </div>
          ))}
        </div>
        <button type="submit" className="solid" disabled={saving}>
          {saving ? 'Saving…' : 'Save city times'}
        </button>
      </form>

      <div className="panel stack year">
        <h3>Year calendar</h3>
        <p className="muted">{loaded} days are stored for {year}.</p>
        <label>
          Year
          <input value={String(year)} onChange={(e) => setYear(Number(e.target.value) || year)} />
        </label>
        <div className="actions">
          <button
            type="button"
            className="solid slim"
            onClick={() => {
              setError('')
              void desk
                .generateYear(year, settings.city, 'aladhan')
                .then((res) => {
                  setLoaded(res.upserted)
                  setNotice(`Generated ${res.upserted} days for ${res.city}.`)
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Generate failed'))
            }}
          >
            Generate from Aladhan
          </button>
          <button
            type="button"
            className="ghost dark slim"
            onClick={() => {
              setError('')
              void desk
                .generateYear(year, settings.city, 'defaults')
                .then((res) => {
                  setLoaded(res.upserted)
                  setNotice(`Generated ${res.upserted} days from the saved defaults.`)
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Generate failed'))
            }}
          >
            Generate from these defaults
          </button>
        </div>
        <label>
          Import a CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              setError('')
              void file
                .text()
                .then((csv) => desk.importCsv(csv, settings.city))
                .then((res) => {
                  setLoaded(res.yearDaysLoaded)
                  setNotice(`Imported ${res.upserted} days for ${res.city}.`)
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Import failed'))
            }}
          />
        </label>
      </div>
    </section>
  )
}
