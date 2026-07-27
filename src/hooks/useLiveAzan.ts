import { useEffect, useState } from 'react'
import { MOSQUES } from '../data/mockData'
import type { LiveAzanFeed } from '../types/liveAzan'
import { api, isApiAvailable } from '../services/api'
import { buildLiveFeedsFromMosques } from '../utils/liveAzan'

export function useLiveAzan() {
  const [feeds, setFeeds] = useState<LiveAzanFeed[]>([])
  const [liveCount, setLiveCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fromApi, setFromApi] = useState(false)

  const refresh = async () => {
    try {
      if (await isApiAvailable()) {
        const data = await api.getLiveAzan()
        setFeeds(data.feeds)
        setLiveCount(data.liveCount)
        setFromApi(true)
        return
      }
      throw new Error('offline')
    } catch {
      const local = buildLiveFeedsFromMosques(MOSQUES)
      setFeeds(local)
      setLiveCount(local.filter((f) => f.status === 'live').length)
      setFromApi(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await refresh()
      if (!cancelled) setLoading(false)
    })()
    const interval = setInterval(() => { void refresh() }, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return { feeds, liveCount, loading, fromApi, refresh }
}
