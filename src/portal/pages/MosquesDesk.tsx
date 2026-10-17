import { useEffect, useMemo, useState } from 'react'
import { MOSQUE_FACILITY_OPTIONS, type JumaSession, type Mosque, type NightTimings, type PrayerName } from '../../types'
import { emptyMosqueForm, readImageFile, toggleFacility, updatePrayerTiming } from '../../utils/adminMosque'
import { getJumaSessions, toJumaTimingsPayload } from '../../utils/jumaTimings'
import { desk } from '../api'
import { AutoClock } from '../AutoClock'
import { ClockField } from '../ClockField'
import { mapsLink, parseCoordinates } from '../coords'
import { MapPicker } from '../MapPicker'
import { deriveNight, withDerivedNight, type SunTimes } from '../nightTimes'
import { recordIssues } from '../timeEntry'

function todayYmd() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

const SCHOOLS: Array<{ id: string; label: string; aliases: string[] }> = [
  { id: 'hanafi', label: 'Hanafi', aliases: ['hanafi', 'hanafee', 'deobandi', 'barelvi'] },
  { id: 'shafii', label: "Shafi'i", aliases: ['shafii', 'shafi', 'shafei', 'shafii'] },
  { id: 'maliki', label: 'Maliki', aliases: ['maliki', 'maleki'] },
  { id: 'hanbali', label: 'Hanbali', aliases: ['hanbali', 'hambali', 'ahle-hadees', 'ahlehadees'] },
  { id: 'jafri', label: 'Jafri', aliases: ['jafri', 'jafari', 'jafariyya', 'jafari', 'shia'] },
]

function normalizeType(value: string) {
  return value.trim().toLowerCase().replace(/['\u2019]/g, '').replace(/\s+/g, '-')
}

function schoolOf(sect: string) {
  const normalized = normalizeType(sect)
  if (!normalized) return null
  return SCHOOLS.find((school) => school.id === normalized || school.aliases.some((alias) => normalizeType(alias) === normalized)) ?? null
}

function typeLabel(sect: string) {
  const school = schoolOf(sect)
  if (school) return school.label
  const raw = sect.trim()
  return raw || 'Not set'
}

type DeskMosque = Mosque & { isActive?: boolean }

/** Older records only say "Parking". Offer it as both kinds so the owner can switch off the one that is missing. */
function splitLegacyParking(list: string[]) {
  const out: string[] = []
  for (const item of list) {
    const names = item.trim().toLowerCase() === 'parking' ? ['Two-wheeler parking', 'Four-wheeler parking'] : [item]
    for (const name of names) if (!out.includes(name)) out.push(name)
  }
  return out
}

function toForm(mosque?: Mosque): DeskMosque {
  const blank = emptyMosqueForm() as DeskMosque
  if (!mosque) return { ...blank, isActive: true }
  return {
    ...blank,
    ...mosque,
    isActive: (mosque as DeskMosque).isActive !== false,
    timings: mosque.timings || blank.timings,
    nightTimings: mosque.nightTimings || blank.nightTimings,
    imamDetails: mosque.imamDetails || blank.imamDetails,
    moazzinDetails: mosque.moazzinDetails || blank.moazzinDetails,
    facilities: splitLegacyParking(mosque.facilities || []),
    photos: mosque.photos || [],
    events: mosque.events || [],
  }
}

export function MosquesDesk() {
  const [mosques, setMosques] = useState<Mosque[]>([])
  const [nameQuery, setNameQuery] = useState('')
  const [city, setCity] = useState('all')
  const [school, setSchool] = useState('all')
  const [form, setForm] = useState<DeskMosque | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setMosques(await desk.mosques())
  }

  useEffect(() => {
    let live = true
    void load()
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : 'Could not load mosques')
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [])

  const cities = useMemo(
    () => [...new Set(mosques.map((mosque) => mosque.city).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [mosques],
  )

  const visible = useMemo(() => {
    const name = nameQuery.trim().toLowerCase()
    return mosques
      .filter((mosque) => {
        if (name && !mosque.name.toLowerCase().includes(name)) return false
        if (city !== 'all' && mosque.city !== city) return false
        if (school === 'unset') return !mosque.sect?.trim()
        if (school === 'other') return Boolean(mosque.sect?.trim()) && !schoolOf(mosque.sect)
        if (school !== 'all') return schoolOf(mosque.sect || '')?.id === school
        return true
      })
      .sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name))
  }, [city, mosques, nameQuery, school])

  const filtersOn = Boolean(nameQuery.trim()) || city !== 'all' || school !== 'all'

  const sessions = getJumaSessions(form?.jumaTimings)

  const setSessions = (next: JumaSession[]) => {
    if (!form) return
    setForm({ ...form, jumaTimings: toJumaTimingsPayload(next) })
  }

  const [sun, setSun] = useState<SunTimes | null>(null)
  const [sunState, setSunState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle')
  const [sunError, setSunError] = useState('')
  const [sunTry, setSunTry] = useState(0)
  const [nightKey, setNightKey] = useState(0)
  const [pinText, setPinText] = useState('')
  const [pinNote, setPinNote] = useState('')

  const pinLat = form ? Number(form.lat) : Number.NaN
  const pinLng = form ? Number(form.lng) : Number.NaN
  const formOpen = form !== null
  const formId = form?.id

  useEffect(() => {
    setPinText('')
    setPinNote('')
  }, [formId])
  const pinReady = Number.isFinite(pinLat) && Number.isFinite(pinLng) && !(pinLat === 0 && pinLng === 0)

  useEffect(() => {
    if (!formOpen || !pinReady) {
      setSun(null)
      setSunState('idle')
      return
    }
    let live = true
    setSunState('loading')
    const timer = window.setTimeout(() => {
      desk
        .sunTimes(pinLat, pinLng, todayYmd())
        .then((times) => {
          if (!live) return
          setSun(times)
          setSunState('ready')
          setSunError('')
        })
        .catch((err: unknown) => {
          if (!live) return
          setSun(null)
          setSunState('failed')
          setSunError(err instanceof Error ? err.message : 'Could not load sun times')
        })
    }, 500)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [formOpen, pinReady, pinLat, pinLng, sunTry])

  const derived = useMemo(() => (sun ? deriveNight(sun) : null), [sun])
  const night = withDerivedNight(form?.nightTimings, derived)

  /** What the owner has typed or saved, without any derived clocks mixed in. */
  const rawNight = withDerivedNight(form?.nightTimings, null)
  const editNight = (change: (current: NightTimings) => NightTimings) => {
    if (form) setForm({ ...form, nightTimings: change(rawNight) })
  }

  const clearNight = () => {
    if (!form) return
    setForm({
      ...form,
      nightTimings: { tahajjud: { start: '', end: '' }, sehri: { start: '', end: '' }, iftar: '' },
    })
    setNightKey((key) => key + 1)
  }

  const problems = form ? recordIssues({ ...form, nightTimings: night }, sessions) : []

  const save = async () => {
    if (!form) return
    const blocking = recordIssues({ ...form, nightTimings: night }, sessions)
    if (blocking.length) {
      setError(blocking[0])
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    const payload = {
      name: form.name,
      address: form.address,
      area: form.area,
      city: form.city,
      phone: form.phone,
      lat: Number(form.lat),
      lng: Number(form.lng),
      sect: form.sect,
      capacity: Number(form.capacity) || 0,
      imam: form.imamDetails?.name || form.imam,
      imamDetails: form.imamDetails,
      moazzinDetails: form.moazzinDetails,
      jumaTimings: form.jumaTimings,
      sermonLanguage: form.sermonLanguage,
      facilities: form.facilities,
      events: form.events,
      photos: form.photos,
      timings: form.timings,
      nightTimings: night,
      maghribOffsetMinutes: form.maghribOffsetMinutes ?? null,
      isActive: form.isActive !== false,
    }
    try {
      const exists = form.id && mosques.some((mosque) => mosque.id === form.id)
      if (exists) await desk.updateMosque(String(form.id), payload)
      else await desk.createMosque(payload)
      setForm(null)
      await load()
      setNotice('Saved. The phone shows this after a refresh.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (form) {
    return (
      <section>
        <header className="page-head">
          <div>
            <p className="eyebrow">Mosque record</p>
            <h2>{form.id ? form.name || 'Edit mosque' : 'New mosque'}</h2>
          </div>
          <button type="button" className="ghost dark" onClick={() => setForm(null)}>
            Back to the list
          </button>
        </header>
        {error ? <p className="error">{error}</p> : null}
        <form
          className="record"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <div className="record-grid">
            <section className="block">
              <div className="block-top">
                <h3>Place</h3>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={form.isActive !== false}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  <span>{form.isActive !== false ? "Shown in the app" : "Hidden from the app"}</span>
                </label>
              </div>
              <div className="fields dense">
                <label className="c5">
                  Name
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </label>
                <label className="c3">
                  City
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </label>
                <label className="c4">
                  Area
                  <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
                </label>
                <label className="c8">
                  Address
                  <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
                </label>
                <label className="c4">
                  Phone
                  <input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d+\s-]/g, "").slice(0, 18) })} />
                </label>
                <label className="c5">
                  Mosque type
                  <select
                    value={schoolOf(form.sect || "")?.id || (form.sect?.trim() ? "other" : "")}
                    onChange={(e) => {
                      const next = e.target.value
                      if (!next) setForm({ ...form, sect: "" })
                      else if (next === "other") setForm({ ...form, sect: schoolOf(form.sect || "") || !form.sect?.trim() ? "Other" : form.sect })
                      else setForm({ ...form, sect: SCHOOLS.find((item) => item.id === next)?.label || "" })
                    }}
                  >
                    <option value="">Not set</option>
                    {SCHOOLS.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="c3">
                  Capacity
                  <input inputMode="numeric" placeholder="0" value={form.capacity ? String(form.capacity) : ""} onChange={(e) => { const digits = e.target.value.replace(/\D/g, "").slice(0, 6); setForm({ ...form, capacity: digits ? Number(digits) : 0 }) }} />
                </label>
                {form.sect?.trim() && !schoolOf(form.sect) ? (
                  <label className="c4">
                    Other type
                    <input value={form.sect} onChange={(e) => setForm({ ...form, sect: e.target.value })} />
                  </label>
                ) : null}
              </div>
            </section>
            <section className="block">
              <div className="block-top">
                <h3>People</h3>
              </div>
              <div className="fields dense">
                <label className="c6">
                  Imam
                  <input
                    value={form.imamDetails?.name || ""}
                    onChange={(e) => setForm({ ...form, imam: e.target.value, imamDetails: { ...form.imamDetails, name: e.target.value } })}
                  />
                </label>
                <label className="c6">
                  Imam mobile
                  <input
                    value={form.imamDetails?.mobile || ""}
                    inputMode="tel" onChange={(e) => setForm({ ...form, imamDetails: { ...form.imamDetails, mobile: e.target.value.replace(/[^\d+\s-]/g, "").slice(0, 18) } })}
                  />
                </label>
                <label className="c6">
                  Moazzin
                  <input
                    value={form.moazzinDetails?.name || ""}
                    onChange={(e) => setForm({ ...form, moazzinDetails: { ...form.moazzinDetails, name: e.target.value } })}
                  />
                </label>
                <label className="c6">
                  Moazzin mobile
                  <input
                    value={form.moazzinDetails?.mobile || ""}
                    inputMode="tel" onChange={(e) => setForm({ ...form, moazzinDetails: { ...form.moazzinDetails, mobile: e.target.value.replace(/[^\d+\s-]/g, "").slice(0, 18) } })}
                  />
                </label>
                <label className="c12">
                  Khutbah language
                  <input value={form.sermonLanguage} onChange={(e) => setForm({ ...form, sermonLanguage: e.target.value })} />
                </label>
              </div>
            </section>
          </div>

          <section className="block">
            <div className="block-top">
              <h3>Location</h3>
              {pinReady ? (
                <a className="linkish" href={mapsLink({ lat: pinLat, lng: pinLng })} target="_blank" rel="noreferrer">
                  Open in Google Maps
                </a>
              ) : (
                <span className="muted">No pin yet</span>
              )}
            </div>
            <div className="location">
              <MapPicker
                lat={pinLat}
                lng={pinLng}
                hint={[form.name, form.area, form.city].filter(Boolean).join(", ")}
                onPick={(lat, lng) => {
                  setPinNote("")
                  setForm({ ...form, lat, lng })
                }}
              />
              <div className="location-side">
                <div className="fields dense">
                  <label className="c6">
                    Latitude
                    <input inputMode="decimal" value={String(form.lat ?? "")} onChange={(e) => { const raw = e.target.value.trim(); if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return; setForm({ ...form, lat: raw === "" || raw === "-" || raw === "." || raw === "-." ? 0 : Number(raw) }) }} />
                  </label>
                  <label className="c6">
                    Longitude
                    <input inputMode="decimal" value={String(form.lng ?? "")} onChange={(e) => { const raw = e.target.value.trim(); if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return; setForm({ ...form, lng: raw === "" || raw === "-" || raw === "." || raw === "-." ? 0 : Number(raw) }) }} />
                  </label>
                  <label className="c12">
                    Paste a Google Maps link or "lat, lng"
                    <input
                      value={pinText}
                      placeholder="23.0088, 72.5757"
                      onChange={(e) => {
                        const text = e.target.value
                        setPinText(text)
                        const found = parseCoordinates(text)
                        if (found) {
                          setForm({ ...form, lat: found.lat, lng: found.lng })
                          setPinNote(`Pin set to ${found.lat}, ${found.lng}.`)
                        } else {
                          setPinNote(text.trim() ? "No coordinates found in that text yet." : "")
                        }
                      }}
                    />
                  </label>
                </div>
                {pinNote ? <p className="muted fine">{pinNote}</p> : null}
                <p className="muted fine">In Google Maps, right-click a spot and click the numbers to copy them, then paste here.</p>
              </div>
            </div>
          </section>

          <section className="block">
            <div className="block-head">
              <h3>Prayer times</h3>
              <p className="muted">Hour, then minute (00 to 59). Click AM or PM, or press A or P.</p>
            </div>
            <div className="schedule-head">
              <span>Prayer</span>
              <span>Azan</span>
              <span>Jamat</span>
            </div>
            {PRAYERS.map((prayer) => (
              <div key={prayer} className="slot">
                <strong>{prayer}</strong>
                <ClockField
                  label={prayer + " azan"}
                  value={form.timings?.[prayer]?.azan || ""}
                  onChange={(next) =>
                    form.timings && setForm({ ...form, timings: updatePrayerTiming(form.timings, prayer, "azan", next) })
                  }
                />
                <ClockField
                  label={prayer + " jamat"}
                  value={form.timings?.[prayer]?.jamat || ""}
                  onChange={(next) =>
                    form.timings && setForm({ ...form, timings: updatePrayerTiming(form.timings, prayer, "jamat", next) })
                  }
                />
              </div>
            ))}
            <div className="slot">
              <strong>Sunset</strong>
              <label className="sunset-offset">
                <input
                  inputMode="numeric"
                  aria-label="Maghrib minutes after sunset"
                  placeholder="5"
                  value={form.maghribOffsetMinutes ?? ""}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 2)
                    setForm({
                      ...form,
                      maghribOffsetMinutes: digits === "" ? null : Math.min(45, Number(digits)),
                    })
                  }}
                />
                <span>min after sunset, Maghrib azan</span>
              </label>
            </div>

            <div className="schedule-head juma-head">
              <span>Juma</span>
              <span>Azan</span>
              <span>Khutbah</span>
              <span>Namaz</span>
            </div>
            {sessions.map((session, index) => (
              <div key={index} className="juma-block">
                <div className="slot juma-slot">
                  <strong>{sessions.length > 1 ? String(index + 1) : "Juma"}</strong>
                  <ClockField label="Juma azan" value={session.azan} onChange={(next) => setSessions(sessions.map((item, i) => (i === index ? { ...item, azan: next } : item)))} />
                  <ClockField label="Juma khutbah" value={session.khutba} onChange={(next) => setSessions(sessions.map((item, i) => (i === index ? { ...item, khutba: next } : item)))} />
                  <ClockField label="Juma namaz" value={session.namaz} onChange={(next) => setSessions(sessions.map((item, i) => (i === index ? { ...item, namaz: next } : item)))} />
                </div>
                {sessions.length > 1 ? (
                  <button type="button" className="linkish" onClick={() => setSessions(sessions.filter((_, i) => i !== index))}>Remove this session</button>
                ) : null}
              </div>
            ))}
            <button type="button" className="linkish" onClick={() => setSessions([...sessions, { azan: "", khutba: "", namaz: "" }])}>
              Add a Juma session
            </button>

            <div className="night-note">
              {sunState === 'ready' && sun ? (
                <p>
                  Worked out from Maghrib {sun.maghrib} today and Fajr {sun.fajrTomorrow} tomorrow. Tahajjud opens at midnight; the last third of the night is the best part.
                  {sun.source === 'calculated' ? ' Sunset and Fajr were calculated on the server.' : ''}
                </p>
              ) : sunState === 'loading' ? (
                <p>Working out the night from this pin...</p>
              ) : sunState === 'failed' ? (
                <p className="issue">
                  Could not work out sunset and Fajr ({sunError}). Enter these by hand or{' '}
                  <button type="button" className="linkish" onClick={() => setSunTry((n) => n + 1)}>
                    try again
                  </button>
                  .
                </p>
              ) : (
                <p>Set the map pin and these three fill in by themselves.</p>
              )}
              {derived ? (
                <button type="button" className="linkish" onClick={clearNight}>
                  Recalculate all
                </button>
              ) : null}
            </div>

            <div className="schedule-head night-head">
              <span>Night</span>
              <span>Starts</span>
              <span>Ends</span>
            </div>
            <div className="slot night-slot">
              <strong>Tahajjud</strong>
              <AutoClock
                key={`tahajjud-start-${nightKey}`}
                label="Tahajjud start"
                value={rawNight.tahajjud.start}
                auto={derived?.tahajjud.start ?? null}
                onChange={(next) => editNight((n) => ({ ...n, tahajjud: { ...n.tahajjud, start: next } }))}
              />
              <AutoClock
                key={`tahajjud-end-${nightKey}`}
                label="Tahajjud end"
                value={rawNight.tahajjud.end}
                auto={derived?.tahajjud.end ?? null}
                onChange={(next) => editNight((n) => ({ ...n, tahajjud: { ...n.tahajjud, end: next } }))}
              />
            </div>
            {derived ? (
              <div className="slot night-slot">
                <strong>Last ⅓</strong>
                <div className="auto-clock still" title="Last third of the night. Worked out, so it is not edited here.">
                  <strong className="time">{derived.lastThird}</strong>
                  <span className="auto-tag">Auto</span>
                </div>
                <div className="auto-clock still" title="Ends at Fajr">
                  <strong className="time">{derived.tahajjud.end}</strong>
                  <span className="auto-tag">Auto</span>
                </div>
              </div>
            ) : null}
            <div className="slot night-slot">
              <strong>Sehri</strong>
              <AutoClock
                key={`sehri-start-${nightKey}`}
                label="Sehri start"
                value={rawNight.sehri.start}
                auto={derived?.sehri.start ?? null}
                onChange={(next) => editNight((n) => ({ ...n, sehri: { ...n.sehri, start: next } }))}
              />
              <AutoClock
                key={`sehri-end-${nightKey}`}
                label="Sehri end"
                value={rawNight.sehri.end}
                auto={derived?.sehri.end ?? null}
                onChange={(next) => editNight((n) => ({ ...n, sehri: { ...n.sehri, end: next } }))}
              />
            </div>
            <div className="slot night-slot">
              <strong>Iftar</strong>
              <AutoClock
                key={`iftar-${nightKey}`}
                label="Iftar"
                value={rawNight.iftar ?? ''}
                auto={derived?.iftar ?? null}
                onChange={(next) => editNight((n) => ({ ...n, iftar: next }))}
              />
            </div>
          </section>

          <section className="block">
            <div className="block-head">
              <h3>Facilities</h3>
              <p className="muted">Turn on only what this mosque has.</p>
            </div>
            <div className="amenities">
              {MOSQUE_FACILITY_OPTIONS.map((facility) => {
                const on = form.facilities?.includes(facility) || false
                return (
                  <button
                    key={facility}
                    type="button"
                    className={on ? "amenity on" : "amenity"}
                    aria-pressed={on}
                    onClick={() => setForm({ ...form, facilities: toggleFacility(form.facilities || [], facility) })}
                  >
                    <span>{facility}</span>
                    <span className="track" aria-hidden="true"><span className="knob" /></span>
                  </button>
                )
              })}
            </div>
            <div className="photo-row">
              {form.photos?.map((url, index) => (
                <img key={url + String(index)} src={url} alt="" />
              ))}
              <label className="photo-pick">
                Add a photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ""
                    if (!file) return
                    void readImageFile(file)
                      .then((url) => setForm({ ...form, photos: [...(form.photos || []), url] }))
                      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not read the photo"))
                  }}
                />
              </label>
            </div>
          </section>

          <div className="save-bar">
            <span className={problems.length ? "issue" : "muted"}>
              {problems.length
                ? problems[0] + (problems.length > 1 ? " " + String(problems.length - 1) + " more to fix." : "")
                : "Ready to save. The phone updates after a refresh."}
            </span>
            <button type="submit" className="solid" disabled={saving || problems.length > 0}>{saving ? "Saving..." : "Save mosque"}</button>
          </div>
        </form>
      </section>
    )
  }

  return (
    <section>
      <header className="page-head">
        <div>
          <p className="eyebrow">Mosques</p>
          <h2>Records the app shows</h2>
        </div>
        <button type="button" className="solid" onClick={() => setForm(toForm())}>
          Add a mosque
        </button>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="ok">{notice}</p> : null}
      <div className="filters">
        <label>
          Name
          <input value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} placeholder="Mosque name" />
        </label>
        <label>
          City
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="all">All cities</option>
            {cities.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <div className="type-row">
          <span className="filter-label">Mosque type</span>
          <div className="type-picks">
            <button type="button" className={school === 'all' ? 'pick on' : 'pick'} onClick={() => setSchool('all')}>All</button>
            {SCHOOLS.map((item) => (
              <button key={item.id} type="button" className={school === item.id ? 'pick on' : 'pick'} onClick={() => setSchool(item.id)}>
                {item.label}
              </button>
            ))}
            <button type="button" className={school === 'other' ? 'pick on' : 'pick'} onClick={() => setSchool('other')}>Other</button>
            <button type="button" className={school === 'unset' ? 'pick on' : 'pick'} onClick={() => setSchool('unset')}>Not set</button>
          </div>
        </div>
      </div>
      <div className="result-line">
        <p className="muted">{loading ? 'Loading mosques...' : `Showing ${visible.length} of ${mosques.length}`}</p>
        {filtersOn ? (
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setNameQuery('')
              setCity('all')
              setSchool('all')
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>
      {!loading && visible.length === 0 ? <p className="muted">No mosque matches these filters.</p> : null}
      <div className="list">
        {visible.map((mosque) => {
          const active = (mosque as DeskMosque).isActive !== false
          const type = typeLabel(mosque.sect || '')
          return (
            <button key={mosque.id} type="button" className="list-item" onClick={() => setForm(toForm(mosque))}>
              <span>
                <strong>{mosque.name}</strong>
                <small>{[mosque.area, mosque.city].filter(Boolean).join(' - ') || 'No area'}</small>
              </span>
              <span className="row-meta">
                <span className={type === 'Not set' ? 'badge quiet' : 'badge'}>{type}</span>
                {!active ? <span className="badge quiet">Hidden</span> : null}
                <span className="muted">{mosque.timings?.Fajr?.azan ? `Fajr ${mosque.timings.Fajr.azan}` : 'No prayer times'}</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
