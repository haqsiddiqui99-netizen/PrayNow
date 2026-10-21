import { Linking } from 'react-native'
import { showToast } from '@/src/components/AppToast'
import type { HalalListing } from '@/src/services/api'

/** wa.me needs the country code. Ten-digit numbers are Indian mobiles in this app. */
function whatsappDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  return digits
}

async function open(url: string, failText: string) {
  try {
    await Linking.openURL(url)
  } catch {
    showToast(failText, 'information-circle-outline')
  }
}

export function callListing(listing: HalalListing, failText: string) {
  const number = listing.phone || listing.whatsapp
  return open(`tel:${number}`, failText)
}

export function whatsappListing(listing: HalalListing, message: string, failText: string) {
  const number = whatsappDigits(listing.whatsapp || listing.phone)
  return open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, failText)
}

export function directionsToListing(listing: HalalListing, failText: string) {
  const destination =
    listing.lat != null && listing.lng != null
      ? `${listing.lat},${listing.lng}`
      : [listing.name, listing.address || listing.area, listing.city].filter(Boolean).join(', ')
  return open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`, failText)
}

export function openListingWebsite(listing: HalalListing, failText: string) {
  if (!listing.website.startsWith('https://')) return Promise.resolve()
  return open(listing.website, failText)
}
