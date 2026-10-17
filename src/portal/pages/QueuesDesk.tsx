import { useEffect, useState } from 'react'
import { desk, type CorrectionRow, type MosqueRequestRow } from '../api'

type Queue = 'requests' | 'reports'

function timingLine(item: MosqueRequestRow) {
  const parts: string[] = []
  for (const name of ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]) {
    const slot = item.timings?.[name]
    const bits: string[] = []
    if (name === "Maghrib" && item.maghribOffsetMinutes != null) bits.push(`sunset +${item.maghribOffsetMinutes}m`)
    else if (slot?.azan) bits.push(slot.azan)
    if (slot?.jamat) bits.push(slot.jamat)
    if (bits.length) parts.push(`${name} ${bits.join(" / ")}`)
  }
  if (item.nightTimings?.sehriEnd) parts.push(`Sehri ${item.nightTimings.sehriEnd}`)
  if (item.nightTimings?.iftar) parts.push(`Iftar ${item.nightTimings.iftar}`)
  return parts.join(' | ')
}


export function QueuesDesk() {
  const [queue, setQueue] = useState<Queue>('requests')
  const [requestStatus, setRequestStatus] = useState('pending')
  const [reportStatus, setReportStatus] = useState('pending')
  const [requests, setRequests] = useState<MosqueRequestRow[]>([])
  const [reports, setReports] = useState<CorrectionRow[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState('')

  const load = async (which = queue, reqStatus = requestStatus, repStatus = reportStatus) => {
    if (which === 'requests') {
      const data = await desk.requests(reqStatus)
      setRequests(data.requests)
    } else {
      const data = await desk.corrections(repStatus)
      setReports(data.corrections)
    }
  }

  useEffect(() => {
    let live = true
    setLoading(true)
    void load()
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : 'Could not load the queue')
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [queue, requestStatus, reportStatus])

  const act = async (id: string, run: () => Promise<unknown>, done: string) => {
    setActing(id)
    setError('')
    setNotice('')
    try {
      await run()
      await load()
      setNotice(done)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that item')
    } finally {
      setActing('')
    }
  }

  return (
    <section>
      <header className="page-head">
        <div>
          <p className="eyebrow">Queues</p>
          <h2>Waiting on a decision</h2>
        </div>
      </header>
      <div className="seg">
        <button type="button" className={queue === 'requests' ? 'on' : ''} onClick={() => setQueue('requests')}>
          Add a mosque
        </button>
        <button type="button" className={queue === 'reports' ? 'on' : ''} onClick={() => setQueue('reports')}>
          Corrections
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="ok">{notice}</p> : null}
      {loading ? <p className="muted">Loadingâ¦</p> : null}

      {queue === 'requests' ? (
        <>
          <div className="seg slim">
            {['pending', 'approved', 'rejected', 'all'].map((status) => (
              <button key={status} type="button" className={requestStatus === status ? 'on' : ''} onClick={() => setRequestStatus(status)}>
                {status}
              </button>
            ))}
          </div>
          <div className="stack">
            {requests.length === 0 && !loading ? <p className="muted">Nothing in this queue.</p> : null}
            {requests.map((item) => (
              <article key={item.id} className="panel">
                <div className="row-head">
                  <h3>{item.name}</h3>
                  <span className="pill">{item.status}</span>
                </div>
                <p>{item.address}</p>
                <p className="muted">
                  {[item.area, item.city].filter(Boolean).join(' Â· ')}
                  {item.ownerName ? ` Â· ${item.ownerName}` : ''}
                  {item.ownerMobile ? ` Â· ${item.ownerMobile}` : ''}
                </p>
                {item.facilities?.length ? <p className="muted">{item.facilities.join(', ')}</p> : null}
                {timingLine(item) ? <p className="muted">{timingLine(item)}</p> : null}
                {item.notes ? <p>{item.notes}</p> : null}
                <p className="muted">Sent by {item.submittedByName || 'someone'} {item.submittedByMobile ? `Â· ${item.submittedByMobile}` : ''}</p>
                {item.status === 'pending' ? (
                  <div className="actions">
                    <input
                      value={notes[item.id] || ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="Note for the record"
                    />
                    <button
                      type="button"
                      className="solid slim"
                      disabled={acting === item.id}
                      onClick={() => void act(item.id, () => desk.approveRequest(item.id, notes[item.id] || ''), 'Mosque created. It stays hidden until you fill its times and turn it on.')}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="ghost dark slim"
                      disabled={acting === item.id}
                      onClick={() => void act(item.id, () => desk.rejectRequest(item.id, notes[item.id] || ''), 'Request rejected.')}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="seg slim">
            {['pending', 'fixed', 'dismissed'].map((status) => (
              <button key={status} type="button" className={reportStatus === status ? 'on' : ''} onClick={() => setReportStatus(status)}>
                {status}
              </button>
            ))}
          </div>
          <div className="stack">
            {reports.length === 0 && !loading ? <p className="muted">Nothing in this queue.</p> : null}
            {reports.map((item) => (
              <article key={item.id} className="panel">
                <div className="row-head">
                  <h3>{item.mosqueName}</h3>
                  <span className="pill">{item.status}</span>
                </div>
                <p>
                  {item.topic}
                  {item.prayer ? ` Â· ${item.prayer}` : ''}
                </p>
                {item.suggestion ? <p>{item.suggestion}</p> : null}
                {item.note ? <p className="muted">{item.note}</p> : null}
                <p className="muted">From {item.reporterName || 'a follower'}</p>
                {item.status === 'pending' ? (
                  <div className="actions">
                    <button
                      type="button"
                      className="solid slim"
                      disabled={acting === item.id}
                      onClick={() => void act(item.id, () => desk.resolveCorrection(item.id, 'fixed'), 'Marked fixed.')}
                    >
                      Mark fixed
                    </button>
                    <button
                      type="button"
                      className="ghost dark slim"
                      disabled={acting === item.id}
                      onClick={() => void act(item.id, () => desk.resolveCorrection(item.id, 'dismissed'), 'Dismissed.')}
                    >
                      Dismiss
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
