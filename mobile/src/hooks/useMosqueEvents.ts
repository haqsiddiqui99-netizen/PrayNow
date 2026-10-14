import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLanguage } from '@/src/context/LanguageContext'
import type { MosqueEvent } from '@/src/services/api'
import {
  cachedMosqueEvents,
  eventsForMosque,
  loadEventReminders,
  loadMosqueEvents,
  mosqueEventsStamp,
  setEventReminder,
  subscribeMosqueEvents,
  syncEventReminders,
  type EventReminderText,
  type SavedEventReminder,
} from '@/src/services/mosqueEvents'
import { sameDay } from '@/src/utils/hijriCalendar'

export function localeOf(language: string) {
  return language === 'hi' ? 'hi-IN' : language === 'ur' ? 'ur-PK' : language === 'ar' ? 'ar' : 'en-US'
}

/** "Today, 7:30 PM" / "Thu 16 Oct, 7:30 PM" in the app language. */
export function useEventWhen() {
  const { t, language, digits } = useLanguage()
  return useCallback(
    (date: Date) => {
      const locale = localeOf(language)
      const time = date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const day = sameDay(date, new Date())
        ? t('cal.today')
        : sameDay(date, tomorrow)
          ? t('cal.tomorrow')
          : date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
      return digits(`${day}, ${time}`)
    },
    [t, language, digits],
  )
}

export function useEventReminderText(): EventReminderText {
  const { t } = useLanguage()
  const when = useEventWhen()
  return useMemo(
    () => ({
      title: (event, lead) => t('mevent.remindTitle', { title: event, lead }),
      body: (mosque, at) => t('mevent.remindBody', { mosque, when: at }),
      when,
    }),
    [t, when],
  )
}

let reminders: Record<string, SavedEventReminder> | null = null
const reminderListeners = new Set<(next: Record<string, SavedEventReminder>) => void>()
let syncedStamp = 0

function publishReminders(next: Record<string, SavedEventReminder>) {
  reminders = next
  reminderListeners.forEach((listener) => listener(next))
}

/** Upcoming events for a mosque plus the user's reminder choices, shared across cards. */
export function useMosqueEvents(mosqueId: string) {
  const text = useEventReminderText()
  const [events, setEvents] = useState<MosqueEvent[]>(cachedMosqueEvents)
  const [saved, setSaved] = useState<Record<string, SavedEventReminder>>(() => reminders ?? {})

  useEffect(() => {
    const offEvents = subscribeMosqueEvents((list) => {
      setEvents(list)
      const stamp = mosqueEventsStamp()
      if (stamp !== syncedStamp) {
        syncedStamp = stamp
        void syncEventReminders(text, list)
      }
    })
    reminderListeners.add(setSaved)
    if (!reminders) void loadEventReminders().then(publishReminders)
    void loadMosqueEvents().then(setEvents)
    return () => {
      offEvents()
      reminderListeners.delete(setSaved)
    }
  }, [text])

  const upcoming = useMemo(() => eventsForMosque(events, mosqueId), [events, mosqueId])

  const toggle = useCallback(
    async (event: MosqueEvent, mosqueName: string) => {
      const on = !saved[event.id]
      const { store, result } = await setEventReminder(event, mosqueName, on, text)
      publishReminders(store)
      return { on, result }
    },
    [saved, text],
  )

  return { upcoming, reminding: (id: string) => Boolean(saved[id]), toggle }
}
