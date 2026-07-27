import { useEffect, useState } from 'react'
import type { JumaSession, Mosque, PersonContact, PrayerName } from '../../types'
import { MOSQUE_FACILITY_OPTIONS } from '../../types'
import { api, getAdminUser, setAdminToken, setAdminUser } from '../../services/api'
import {
  emptyMosqueForm,
  googleMapsUrl,
  parseMapsLocation,
  readImageFile,
  toggleFacility,
  updatePrayerTiming,
} from '../../utils/adminMosque'
import { getJumaSessions, toJumaTimingsPayload } from '../../utils/jumaTimings'
import { AdminUsersPanel } from './AdminUsersPanel'
import { AdminCityPanel } from './AdminCityPanel'
import { LiveAzanBroadcastPanel } from '../../components/LiveAzanBroadcastPanel'
import './AdminPages.css'

const PRAYERS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

interface AdminDashboardProps {
  onBack: () => void
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const user = getAdminUser()
  const isAdmin = user?.role === 'admin'
  const [mosques, setMosques] = useState<Mosque[]>([])
  const [selected, setSelected] = useState<Mosque | Partial<Mosque> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState<'mosques' | 'users' | 'city'>('mosques')
  const [announceTitle, setAnnounceTitle] = useState('')
  const [announceBody, setAnnounceBody] = useState('')
  const [announcing, setAnnouncing] = useState(false)
  const [mapsPaste, setMapsPaste] = useState('')
  const [mapsPasteError, setMapsPasteError] = useState('')
  const [cityOptions, setCityOptions] = useState<string[]>(['Kanpur', 'Delhi', 'Lucknow'])

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.admin.getMosques()
      setMosques(data)
      try {
        const cities = await api.getCities()
        const names = cities.map((c) => c.name).filter(Boolean)
        if (names.length) {
          setCityOptions([...new Set([...names, 'Kanpur', 'Delhi', 'Lucknow'])].sort())
        }
      } catch {
        /* optional */
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const logout = () => {
    setAdminToken(null)
    setAdminUser(null)
    onBack()
  }

  const save = async () => {
    if (!selected?.name || !selected.address) return
    setSaving(true)
    setMessage('')
    try {
      const payload = {
        name: selected.name,
        address: selected.address,
        area: selected.area,
        city: selected.city || 'Kanpur',
        phone: selected.phone,
        lat: selected.lat,
        lng: selected.lng,
        sect: selected.sect,
        capacity: selected.capacity,
        imam: selected.imamDetails?.name || selected.imam,
        imamDetails: selected.imamDetails,
        moazzinDetails: selected.moazzinDetails,
        jumaTimings: selected.jumaTimings,
        sermonLanguage: selected.sermonLanguage,
        facilities: selected.facilities,
        events: selected.events,
        photos: selected.photos,
        timings: selected.timings,
        nightTimings: selected.nightTimings,
      }
      if (selected.id && mosques.some((m) => m.id === selected.id)) {
        if (isAdmin) {
          await api.admin.updateMosque(selected.id, payload)
        } else {
          await api.admin.managerUpdateTimings(selected.id, payload)
        }
      } else if (isAdmin) {
        await api.admin.createMosque(payload)
      }
      setSelected(null)
      await load()
      setMessage('Saved successfully')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const updatePerson = (
    role: 'imamDetails' | 'moazzinDetails',
    field: keyof PersonContact,
    value: string,
  ) => {
    if (!selected) return
    const current = selected[role] || { name: '', mobile: '', photo: '' }
    const next = { ...current, [field]: value }
    setSelected({
      ...selected,
      [role]: next,
      ...(role === 'imamDetails' ? { imam: next.name } : {}),
    })
  }

  const handlePhotoUpload = async (
    files: FileList | null,
    target: 'imamDetails' | 'moazzinDetails' | 'mosque',
  ) => {
    if (!files?.[0] || !selected) return
    try {
      const dataUrl = await readImageFile(files[0])
      if (target === 'mosque') {
        setSelected({ ...selected, photos: [...(selected.photos || []), dataUrl] })
      } else {
        updatePerson(target, 'photo', dataUrl)
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Photo upload failed')
    }
  }

  const removeMosquePhoto = (index: number) => {
    if (!selected?.photos) return
    setSelected({ ...selected, photos: selected.photos.filter((_, i) => i !== index) })
  }

  const jumaSessions = getJumaSessions(selected?.jumaTimings)

  const setJumaSessions = (sessions: JumaSession[]) => {
    if (!selected) return
    setSelected({ ...selected, jumaTimings: toJumaTimingsPayload(sessions) })
  }

  const updateJumaSession = (index: number, field: keyof JumaSession, value: string) => {
    setJumaSessions(jumaSessions.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  return (
    <div className={`admin-page${selected ? ' admin-page--form' : ''}`}>
      <div className="admin-header">
        <button type="button" className="admin-back" onClick={onBack}>←</button>
        <div>
          <h1>{isAdmin ? 'Admin Panel' : 'Mosque Timings'}</h1>
          <p className="admin-subtitle">{user?.email} · {user?.role}</p>
        </div>
        <button type="button" className="admin-logout" onClick={logout}>Logout</button>
      </div>

      {message && <p className="admin-message">{message}</p>}

      {isAdmin && !selected && (
        <div className="admin-tabs">
          <button
            type="button"
            className={`admin-tab${tab === 'mosques' ? ' admin-tab--active' : ''}`}
            onClick={() => setTab('mosques')}
          >
            Mosques
          </button>
          <button
            type="button"
            className={`admin-tab${tab === 'users' ? ' admin-tab--active' : ''}`}
            onClick={() => setTab('users')}
          >
            Users
          </button>
          <button
            type="button"
            className={`admin-tab${tab === 'city' ? ' admin-tab--active' : ''}`}
            onClick={() => setTab('city')}
          >
            City schedule
          </button>
        </div>
      )}

      {!selected && isAdmin && tab === 'users' ? (
        <AdminUsersPanel mosques={mosques} onMessage={setMessage} />
      ) : !selected && isAdmin && tab === 'city' ? (
        <AdminCityPanel onMessage={setMessage} />
      ) : !selected ? (
        <>
          {isAdmin && (
            <button
              type="button"
              className="btn-accent admin-add-btn"
              onClick={() => {
                setMapsPaste('')
                setMapsPasteError('')
                setSelected(emptyMosqueForm())
              }}
            >
              + Add Mosque
            </button>
          )}
          {loading ? (
            <p className="admin-loading">Loading…</p>
          ) : (
            <div className="admin-list">
              {mosques.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="admin-list-item card"
                  onClick={() => {
                    setMapsPaste('')
                    setMapsPasteError('')
                    setSelected(m)
                  }}
                >
                  <strong>{m.name}</strong>
                  <span>{[m.area, m.city].filter(Boolean).join(' · ')}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
        <div className="admin-form-body">
        <div className="admin-form-scroll">
        <div className="admin-form card">
          <h2>{selected.id ? 'Edit Mosque' : 'New Mosque'}</h2>

          {selected.id && mosques.some((m) => m.id === selected.id) && (
            <LiveAzanBroadcastPanel
              mosqueId={selected.id}
              mosqueName={selected.name || 'this mosque'}
            />
          )}

          {selected.id && mosques.some((m) => m.id === selected.id) && (
            <>
              <div className="admin-section-title">Post announcement</div>
              <p className="admin-timings-note">
                Sends an in-app message (and push on mobile) to users who turned on notify for this mosque.
              </p>
              <label className="admin-field">
                <span>Title</span>
                <input
                  value={announceTitle}
                  onChange={(e) => setAnnounceTitle(e.target.value)}
                  placeholder="e.g. Juma sitting change"
                />
              </label>
              <label className="admin-field">
                <span>Message</span>
                <textarea
                  value={announceBody}
                  onChange={(e) => setAnnounceBody(e.target.value)}
                  placeholder="Short announcement for subscribers"
                  rows={3}
                />
              </label>
              <button
                type="button"
                className="btn-outline"
                disabled={announcing || !announceTitle.trim() || !announceBody.trim()}
                onClick={() => {
                  if (!selected.id) return
                  void (async () => {
                    setAnnouncing(true)
                    setMessage('')
                    try {
                      const res = await api.admin.postAnnouncement(selected.id!, {
                        title: announceTitle.trim(),
                        body: announceBody.trim(),
                      })
                      setAnnounceTitle('')
                      setAnnounceBody('')
                      setMessage(`Announcement sent to ${res.notified} subscriber${res.notified === 1 ? '' : 's'}`)
                    } catch (e) {
                      setMessage(e instanceof Error ? e.message : 'Announcement failed')
                    } finally {
                      setAnnouncing(false)
                    }
                  })()
                }}
              >
                {announcing ? 'Sending…' : 'Send announcement'}
              </button>
            </>
          )}

          <div className="admin-section-title">Daily Prayer Timings</div>
          <p className="admin-timings-note">
            Azan &amp; Jamat for Fajr–Isha. Tahajjud/Sehri are city-wide. Scroll the box below to see all rows.
          </p>
          <div className="admin-timings-panel" tabIndex={0}>
            <div className="admin-timing-scroll">
              <div className="admin-timing-header admin-timing-header--2 admin-timing-header--sticky">
                <span>Prayer</span>
                <span>Azan</span>
                <span>Jamat</span>
              </div>
              <div className="admin-timings-grid">
                {PRAYERS.map((p) => (
                  <div key={p} className="admin-timing-row admin-timing-row--2">
                    <span className="admin-prayer-label">{p}</span>
                    <input
                      placeholder="Azan"
                      value={selected.timings?.[p]?.azan || ''}
                      onChange={(e) => {
                        if (!selected.timings) return
                        const value = e.target.value
                        let next = updatePrayerTiming(selected.timings, p, 'azan', value)
                        next = updatePrayerTiming(next, p, 'start', value)
                        setSelected({ ...selected, timings: next })
                      }}
                    />
                    <input
                      placeholder="Jamat"
                      value={selected.timings?.[p]?.jamat || ''}
                      onChange={(e) => {
                        if (!selected.timings) return
                        setSelected({
                          ...selected,
                          timings: updatePrayerTiming(selected.timings, p, 'jamat', e.target.value),
                        })
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-section-title admin-section-title--in-panel">Juma (Friday)</div>
            <p className="admin-timings-note">
              Separate section — each sitting has Azan, Khutba, and Jamat.
            </p>
            <div className="admin-juma-section">
              <div className="admin-timing-header admin-timing-header--3">
                <span>Sitting</span>
                <span>Azan</span>
                <span>Khutba</span>
                <span>Jamat</span>
              </div>
              {jumaSessions.map((session, index) => (
                <div key={`juma-${index}`} className="admin-timing-row admin-timing-row--3 admin-timing-row--juma">
                  <span className="admin-prayer-label">
                    {jumaSessions.length > 1 ? `Juma ${index + 1}` : 'Juma'}
                  </span>
                  <input
                    placeholder="Azan"
                    value={session.azan}
                    onChange={(e) => updateJumaSession(index, 'azan', e.target.value)}
                  />
                  <input
                    placeholder="Khutba"
                    value={session.khutba}
                    onChange={(e) => updateJumaSession(index, 'khutba', e.target.value)}
                  />
                  <div className="admin-juma-jamat-cell">
                    <input
                      placeholder="Jamat"
                      value={session.namaz}
                      onChange={(e) => updateJumaSession(index, 'namaz', e.target.value)}
                    />
                    {jumaSessions.length > 1 ? (
                      <button
                        type="button"
                        className="admin-juma-remove"
                        onClick={() => setJumaSessions(jumaSessions.filter((_, i) => i !== index))}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="admin-add-juma"
                onClick={() => setJumaSessions([...jumaSessions, { azan: '', khutba: '', namaz: '' }])}
              >
                + Add another Juma sitting
              </button>
            </div>
          </div>

          {isAdmin && (
            <>
              <div className="admin-section-title">Basic Details</div>
              <label className="admin-field"><span>Mosque Name</span>
                <input value={selected.name || ''} onChange={(e) => setSelected({ ...selected, name: e.target.value })} />
              </label>
              <label className="admin-field"><span>Address</span>
                <input value={selected.address || ''} onChange={(e) => setSelected({ ...selected, address: e.target.value })} />
              </label>
              <label className="admin-field"><span>Area / Locality</span>
                <input value={selected.area || ''} onChange={(e) => setSelected({ ...selected, area: e.target.value })} />
              </label>
              <label className="admin-field"><span>City (anywhere in India)</span>
                <input
                  list="praynow-city-options"
                  value={selected.city || ''}
                  placeholder="e.g. Kanpur, Lucknow, Delhi"
                  onChange={(e) => setSelected({ ...selected, city: e.target.value })}
                />
                <datalist id="praynow-city-options">
                  {cityOptions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="admin-field"><span>Phone</span>
                <input value={selected.phone || ''} onChange={(e) => setSelected({ ...selected, phone: e.target.value })} />
              </label>
              <label className="admin-field"><span>Sect</span>
                <input value={selected.sect || ''} onChange={(e) => setSelected({ ...selected, sect: e.target.value })} />
              </label>
              <label className="admin-field"><span>Capacity (prayer space)</span>
                <input
                  type="number"
                  min={0}
                  value={selected.capacity ?? 500}
                  onChange={(e) => setSelected({ ...selected, capacity: Number(e.target.value) })}
                />
              </label>

              <div className="admin-section-title">Location (Google Maps)</div>
              <label className="admin-field">
                <span>Paste Google Maps link or lat,lng</span>
                <input
                  value={mapsPaste}
                  placeholder="https://maps.google.com/... or 26.4499, 80.3319"
                  onChange={(e) => {
                    setMapsPaste(e.target.value)
                    setMapsPasteError('')
                  }}
                />
              </label>
              <button
                type="button"
                className="btn-outline admin-map-apply"
                onClick={() => {
                  const parsed = parseMapsLocation(mapsPaste)
                  if (!parsed) {
                    setMapsPasteError('Could not read coordinates. Paste a Maps link with @lat,lng or type lat, lng.')
                    return
                  }
                  setSelected({ ...selected, lat: parsed.lat, lng: parsed.lng })
                  setMapsPasteError('')
                  setMessage(`Location set to ${parsed.lat.toFixed(5)}, ${parsed.lng.toFixed(5)}`)
                }}
              >
                Apply location
              </button>
              {mapsPasteError ? <p className="admin-inline-error">{mapsPasteError}</p> : null}
              <div className="admin-coords-row">
                <label className="admin-field"><span>Latitude</span>
                  <input
                    type="number"
                    step="any"
                    value={selected.lat ?? ''}
                    onChange={(e) => setSelected({ ...selected, lat: Number(e.target.value) })}
                  />
                </label>
                <label className="admin-field"><span>Longitude</span>
                  <input
                    type="number"
                    step="any"
                    value={selected.lng ?? ''}
                    onChange={(e) => setSelected({ ...selected, lng: Number(e.target.value) })}
                  />
                </label>
              </div>
              {selected.lat != null && selected.lng != null && (
                <a
                  className="admin-map-link"
                  href={googleMapsUrl(selected.lat, selected.lng)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Preview on Google Maps ↗
                </a>
              )}

              <PersonSection
                title="Imam"
                person={selected.imamDetails || { name: selected.imam || '', mobile: '', photo: '' }}
                onChange={(field, value) => updatePerson('imamDetails', field, value)}
                onPhoto={(files) => { void handlePhotoUpload(files, 'imamDetails') }}
              />

              <PersonSection
                title="Moazzin (Azan)"
                person={selected.moazzinDetails || { name: '', mobile: '', photo: '' }}
                onChange={(field, value) => updatePerson('moazzinDetails', field, value)}
                onPhoto={(files) => { void handlePhotoUpload(files, 'moazzinDetails') }}
              />

              <div className="admin-section-title">Facilities</div>
              <div className="admin-checklist">
                {MOSQUE_FACILITY_OPTIONS.map((facility) => (
                  <label key={facility} className="admin-check-item">
                    <input
                      type="checkbox"
                      checked={(selected.facilities || []).includes(facility)}
                      onChange={() => setSelected({
                        ...selected,
                        facilities: toggleFacility(selected.facilities || [], facility),
                      })}
                    />
                    {facility}
                  </label>
                ))}
              </div>

              <div className="admin-section-title">Mosque Photos</div>
              <label className="admin-upload-btn">
                + Upload Photo
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => { void handlePhotoUpload(e.target.files, 'mosque'); e.target.value = '' }}
                />
              </label>
              {(selected.photos || []).length > 0 && (
                <div className="admin-photo-grid">
                  {(selected.photos || []).map((photo, index) => (
                    <div key={`${photo.slice(0, 24)}-${index}`} className="admin-photo-thumb">
                      {photo.startsWith('data:') ? (
                        <img src={photo} alt={`Mosque ${index + 1}`} />
                      ) : (
                        <span className="admin-photo-emoji">{photo}</span>
                      )}
                      <button type="button" className="admin-photo-remove" onClick={() => removeMosquePhoto(index)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </div>
        </div>
          <div className="admin-form-actions admin-form-actions--dock">
            <button type="button" className="btn-outline" onClick={() => setSelected(null)}>Cancel</button>
            <button type="button" className="btn-accent" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
        </>
      )}
    </div>
  )
}

function PersonSection({
  title,
  person,
  onChange,
  onPhoto,
}: {
  title: string
  person: PersonContact
  onChange: (field: keyof PersonContact, value: string) => void
  onPhoto: (files: FileList | null) => void
}) {
  return (
    <>
      <div className="admin-section-title">{title}</div>
      <label className="admin-field"><span>Name</span>
        <input value={person.name} onChange={(e) => onChange('name', e.target.value)} />
      </label>
      <label className="admin-field"><span>Mobile No.</span>
        <input value={person.mobile} onChange={(e) => onChange('mobile', e.target.value)} placeholder="+91 …" />
      </label>
      <div className="admin-person-photo">
        {person.photo ? (
          <img src={person.photo} alt={title} className="admin-person-photo-img" />
        ) : (
          <div className="admin-person-photo-placeholder">No photo</div>
        )}
        <label className="admin-upload-btn admin-upload-btn--small">
          Upload Photo
          <input type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files)} />
        </label>
      </div>
    </>
  )
}
