import type { MaterialCommunityIcons } from '@expo/vector-icons'
import type { ComponentProps } from 'react'
import type { HalalCategory } from '@/src/services/api'
import type { TranslationKey } from '@/src/i18n/translations'

export type HalalIconName = ComponentProps<typeof MaterialCommunityIcons>['name']

export type HalalCategoryInfo = {
  id: HalalCategory
  icon: HalalIconName
  label: TranslationKey
  sub: TranslationKey
  /** Deep to light, used for tiles, card art and the detail hero. */
  colors: readonly [string, string]
  /** Sub-types the desk tags listings with; shown as filter chips when this category is open. */
  tags?: readonly HalalTagInfo[]
}

export type HalalTagInfo = {
  /** Stored lowercase in listing tags; must match CATEGORY_TAGS in the owner desk. */
  id: string
  icon: HalalIconName
  label: TranslationKey
}

const MEAT_TAGS: readonly HalalTagInfo[] = [
  { id: 'chicken', icon: 'food-drumstick', label: 'halal.tag.chicken' },
  { id: 'mutton', icon: 'sheep', label: 'halal.tag.mutton' },
  { id: 'beef', icon: 'cow', label: 'halal.tag.beef' },
  { id: 'fish', icon: 'fish', label: 'halal.tag.fish' },
  { id: 'other', icon: 'food-variant', label: 'halal.tag.other' },
]

export const HALAL_CATEGORIES: readonly HalalCategoryInfo[] = [
  { id: 'restaurant', icon: 'silverware-fork-knife', label: 'halal.cat.restaurant', sub: 'halal.catSub.restaurant', colors: ['#6E2416', '#C4572D'] },
  { id: 'meat', icon: 'food-steak', label: 'halal.cat.meat', sub: 'halal.catSub.meat', colors: ['#561821', '#A8343F'], tags: MEAT_TAGS },
  { id: 'perfume', icon: 'spray-bottle', label: 'halal.cat.perfume', sub: 'halal.catSub.perfume', colors: ['#38245A', '#8C5FB4'] },
  { id: 'bakery', icon: 'cupcake', label: 'halal.cat.bakery', sub: 'halal.catSub.bakery', colors: ['#6E401A', '#D39A48'] },
  { id: 'grocery', icon: 'basket', label: 'halal.cat.grocery', sub: 'halal.catSub.grocery', colors: ['#1B5235', '#3F9663'] },
  { id: 'cosmetics', icon: 'lipstick', label: 'halal.cat.cosmetics', sub: 'halal.catSub.cosmetics', colors: ['#6E2649', '#C96B95'] },
  { id: 'modest', icon: 'hanger', label: 'halal.cat.modest', sub: 'halal.catSub.modest', colors: ['#1B3556', '#4A7AAB'] },
  { id: 'books', icon: 'book-open-variant', label: 'halal.cat.books', sub: 'halal.catSub.books', colors: ['#28443A', '#6C9160'] },
  { id: 'travel', icon: 'airplane', label: 'halal.cat.travel', sub: 'halal.catSub.travel', colors: ['#103F52', '#2E90A9'] },
  { id: 'janazah', icon: 'leaf', label: 'halal.cat.janazah', sub: 'halal.catSub.janazah', colors: ['#34413F', '#7D928D'] },
]

const BY_ID = new Map(HALAL_CATEGORIES.map((item) => [item.id, item]))

export function halalCategory(id: HalalCategory): HalalCategoryInfo {
  return BY_ID.get(id) ?? HALAL_CATEGORIES[0]
}

const TAG_BY_ID = new Map(HALAL_CATEGORIES.flatMap((item) => item.tags ?? []).map((tag) => [tag.id, tag]))

export function halalTag(raw: string): HalalTagInfo | undefined {
  return TAG_BY_ID.get(raw.trim().toLowerCase())
}

/** Known sub-type tags first, so a meat shop's card leads with what it sells. */
export function sortHalalTags(tags: readonly string[]): string[] {
  return [...tags].sort((a, b) => Number(!halalTag(a)) - Number(!halalTag(b)))
}

export const HALAL_GOLD = '#E7D3A1'
