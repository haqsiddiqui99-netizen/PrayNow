import { useCallback, useEffect, useState } from 'react'
import type { PrayerName } from '../../types'
import { api } from '../../services/api'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

const CSV_TEMPLATE = `date,city,fajr_start,fajr_end,dhuhr_start,dhuhr_end,asr_start,asr_end,maghrib_start,maghrib_end,isha_start,isha_end,sunrise,fajr_namaz_end,zawal_start,zawal_end,tahajjud_start,tahajjud_end,sehri_start,sehri_end
2026-01-01,Delhi,5:35 AM,6:20 AM,12:20 PM,3:25 PM,3:25 PM,5:35 PM,5:35 PM,7:05 PM,7:05 PM,5:35 AM,6:55 AM,6:20 AM,11:25 AM,12:00 PM,12:40 AM,5:10 AM,4:00 AM,5:25 AM`

type CitySettings = {
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

type ScheduleRow = {
  prayer_name: PrayerName
  start_time: string
  end_time: string
}

export function AdminCityPanel({ onMessage }: { onMessage: (msg: string) => void }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyYear, setBusyYear] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())
  const [yearDaysLoaded, setYearDaysLoaded] = useState(0)
  const [settings, setSettings] = useState<CitySettings>({
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
  })
  const [schedule, setSchedule] = useState<ScheduleRow[]>(
    PRAYERS.map((prayer) => ({ prayer_name: prayer, start_time: '', end_time: '' })),
  )

  const refreshYearStats = useCallback(async (y: number) => {
    try {
      const data = await api.admin.getCityDays(y)
      setYearDaysLoaded(data.yearDaysLoaded)
    } catch {
      setYearDaysLoaded(0)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const data = await api.admin.getCitySettings()
        if (data.settings) {
          setSettings({
            city: String(data.settings.city || 'Delhi'),
            country: String(data.settings.country || 'India'),
            lat: Number(data.settings.lat ?? 28.6139),
            lng: Number(data.settings.lng ?? 77.209),
            zawal_start: String(data.settings.zawal_start || '11:20 AM'),
            zawal_end: String(data.settings.zawal_end || '11:55 AM'),
            sunrise: String(data.settings.sunrise || '5:45 AM'),
            fajr_namaz_end: String(data.settings.fajr_namaz_end || '5:40 AM'),
            tahajjud_start: String(data.settings.tahajjud_start || '12:30 AM'),
            tahajjud_end: String(data.settings.tahajjud_end || '4:40 AM'),
            sehri_start: String(data.settings.sehri_start || '3:10 AM'),
            sehri_end: String(data.settings.sehri_end || '4:50 AM'),
          })
        }
        if (data.schedule?.length) {
          setSchedule(
            PRAYERS.map((prayer) => {
              const row = data.schedule.find((item) => item.prayer_name === prayer)
              return {
                prayer_name: prayer,
                start_time: row?.start_time || '',
                end_time: row?.end_time || '',
              }
            }),
          )
        }
        await refreshYearStats(year)
      } catch (e) {
        onMessage(e instanceof Error ? e.message : 'Failed to load city settings')
      } finally {
        setLoading(false)
      }
    })()
  }, [onMessage, refreshYearStats, year])

  const save = async () => {
    setSaving(true)
    onMessage('')
    try {
      await api.admin.updateCitySettings({ settings, schedule })
      onMessage('City defaults saved (used as fallback + year generate template)')
    } catch (e) {
      onMessage(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const generateYear = async (source: 'aladhan' | 'defaults' = 'aladhan') => {
    setBusyYear(true)
    onMessage('')
    try {
      const city = settings.city?.trim() || 'Delhi'
      const res = await api.admin.generateCityYear(year, city, source)
      setYearDaysLoaded(res.upserted)
      const via =
        res.source === 'aladhan'
          ? `Aladhan (method ${res.method ?? 1}, ${res.lat}, ${res.lng})`
          : 'city defaults'
      onMessage(`Generated ${res.upserted} days for ${res.city} ${res.year} via ${via}`)
    } catch (e) {
      onMessage(e instanceof Error ? e.message : 'Generate failed')
    } finally {
      setBusyYear(false)
    }
  }

  const onCsvFile = async (file: File | null) => {
    if (!file) return
    setBusyYear(true)
    onMessage('')
    try {
      const csv = await file.text()
      const res = await api.admin.importCityDaysCsv(csv, settings.city)
      setYearDaysLoaded(res.yearDaysLoaded)
      onMessage(`Imported ${res.upserted} days for ${res.city} (${res.yearDaysLoaded} days in year)`)
    } catch (e) {
      onMessage(e instanceof Error ? e.message : 'CSV import failed')
    } finally {
      setBusyYear(false)
    }
  }

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'city-prayer-days-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <p className="admin-loading">Loading city schedule…</p>

  return (
    <div className="admin-form card">
      <h2>City Prayer Schedule</h2>
      <p className="admin-subtitle">
        Defaults + 365-day calendar. Home screen uses <strong>today’s</strong> row when loaded; otherwise these defaults.
      </p>

      <div className="admin-grid">
        <label>
          City
          <input value={settings.city} onChange={(e) => setSettings({ ...settings, city: e.target.value })} />
        </label>
        <label>
          Country
          <input value={settings.country} onChange={(e) => setSettings({ ...settings, country: e.target.value })} />
        </label>
        <label>
          Latitude
          <input
            type="number"
            step="0.0001"
            value={settings.lat}
            onChange={(e) => setSettings({ ...settings, lat: Number(e.target.value) })}
          />
        </label>
        <label>
          Longitude
          <input
            type="number"
            step="0.0001"
            value={settings.lng}
            onChange={(e) => setSettings({ ...settings, lng: Number(e.target.value) })}
          />
        </label>
        <label>
          Sunrise
          <input value={settings.sunrise} onChange={(e) => setSettings({ ...settings, sunrise: e.target.value })} />
        </label>
        <label>
          Fajr namaz end
          <input
            value={settings.fajr_namaz_end}
            onChange={(e) => setSettings({ ...settings, fajr_namaz_end: e.target.value })}
          />
        </label>
        <label>
          Zawal start
          <input
            value={settings.zawal_start}
            onChange={(e) => setSettings({ ...settings, zawal_start: e.target.value })}
          />
        </label>
        <label>
          Zawal end
          <input value={settings.zawal_end} onChange={(e) => setSettings({ ...settings, zawal_end: e.target.value })} />
        </label>
        <label>
          Tahajjud start
          <input
            value={settings.tahajjud_start}
            onChange={(e) => setSettings({ ...settings, tahajjud_start: e.target.value })}
          />
        </label>
        <label>
          Tahajjud end
          <input
            value={settings.tahajjud_end}
            onChange={(e) => setSettings({ ...settings, tahajjud_end: e.target.value })}
          />
        </label>
        <label>
          Sehri start
          <input
            value={settings.sehri_start}
            onChange={(e) => setSettings({ ...settings, sehri_start: e.target.value })}
          />
        </label>
        <label>
          Sehri end
          <input value={settings.sehri_end} onChange={(e) => setSettings({ ...settings, sehri_end: e.target.value })} />
        </label>
      </div>

      <h3>Default prayer windows</h3>
      <div className="admin-timing-grid">
        {schedule.map((row) => (
          <div key={row.prayer_name} className="admin-timing-row">
            <strong>{row.prayer_name}</strong>
            <label>
              Start
              <input
                value={row.start_time}
                onChange={(e) =>
                  setSchedule((prev) =>
                    prev.map((item) =>
                      item.prayer_name === row.prayer_name ? { ...item, start_time: e.target.value } : item,
                    ),
                  )
                }
              />
            </label>
            <label>
              End
              <input
                value={row.end_time}
                onChange={(e) =>
                  setSchedule((prev) =>
                    prev.map((item) =>
                      item.prayer_name === row.prayer_name ? { ...item, end_time: e.target.value } : item,
                    ),
                  )
                }
              />
            </label>
          </div>
        ))}
      </div>

      <button type="button" className="btn-accent" disabled={saving} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save city defaults'}
      </button>

      <h3 style={{ marginTop: 24 }}>365-day calendar</h3>
      <p className="admin-timings-note">
        Prefer <strong>Generate from Aladhan</strong> for Tier-1 cities (Delhi, Mumbai, Navi Mumbai, Thane, Hyderabad,
        Kolkata, Bengaluru, Chennai, Lucknow, Kanpur, Patna, Ahmedabad). CSV can still override months.
      </p>
      <div className="admin-grid">
        <label>
          Year
          <input
            type="number"
            value={year}
            onChange={(e) => {
              const y = Number(e.target.value) || new Date().getFullYear()
              setYear(y)
              void refreshYearStats(y)
            }}
          />
        </label>
        <label>
          Days loaded
          <input value={`${yearDaysLoaded} / ${year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365}`} readOnly />
        </label>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          className="btn-accent"
          disabled={busyYear}
          onClick={() => void generateYear('aladhan')}
        >
          {busyYear ? 'Working…' : `Generate ${year} from Aladhan`}
        </button>
        <button
          type="button"
          className="btn-outline"
          disabled={busyYear}
          onClick={() => void generateYear('defaults')}
        >
          {busyYear ? 'Working…' : `Generate ${year} from defaults`}
        </button>
        <button type="button" className="btn-outline" onClick={downloadTemplate}>
          Download CSV template
        </button>
        <label className="admin-upload-btn" style={{ margin: 0 }}>
          Import CSV
          <input
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              void onCsvFile(e.target.files?.[0] || null)
              e.target.value = ''
            }}
          />
        </label>
      </div>
    </div>
  )
}
