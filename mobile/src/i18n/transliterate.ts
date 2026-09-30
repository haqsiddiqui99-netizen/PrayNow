/**
 * Rule-based Latin -> Indic/Arabic script transliteration for proper nouns.
 *
 * Mosque names and addresses are data, not UI copy, so they cannot live in the
 * translation dictionary. They are also almost entirely Arabic, Persian, Urdu
 * and Indic words that happen to be stored in Latin script, which means the
 * useful operation is transliteration (rendering the same word in the reader's
 * script) rather than translation. "Jama Masjid" should read जामा मस्जिद, not
 * "Friday Mosque".
 *
 * Accuracy is inherently approximate because Latin spelling of these names is
 * unstandardised and drops information the target scripts need (retroflexion,
 * vowel length, Arabic consonant identity). Frequent tokens are therefore
 * hand-corrected in `placeNames.ts`; this engine only handles the long tail.
 */

export type TargetScript = 'devanagari' | 'urdu' | 'arabic'

/** Latin sequence -> [independent form, dependent/matra form]. Longest first. */
const DEVANAGARI_VOWELS: ReadonlyArray<readonly [string, string, string]> = [
  ['aai', 'आई', 'ाई'],
  ['aa', 'आ', 'ा'],
  ['ai', 'ऐ', 'ै'],
  ['au', 'औ', 'ौ'],
  ['ay', 'ऐ', 'ै'],
  ['ee', 'ई', 'ी'],
  ['ei', 'ऐ', 'ै'],
  ['ey', 'ए', 'े'],
  ['ie', 'ई', 'ी'],
  ['ii', 'ई', 'ी'],
  ['oa', 'ओ', 'ो'],
  ['oi', 'ऑय', 'ॉय'],
  ['oo', 'ऊ', 'ू'],
  ['ou', 'औ', 'ौ'],
  ['oy', 'ऑय', 'ॉय'],
  ['uu', 'ऊ', 'ू'],
  ['a', 'अ', ''],
  ['e', 'ए', 'े'],
  ['i', 'इ', 'ि'],
  ['o', 'ओ', 'ो'],
  ['u', 'उ', 'ु'],
]

/**
 * Latin drops vowel length, but a trailing "a" in these names is almost always
 * long ("Mathura" is मथुरा, not मथुर), so the inherent vowel is wrong there.
 */
const DEVANAGARI_FINAL_VOWELS: Record<string, readonly [string, string]> = {
  a: ['आ', 'ा'],
}

const DEVANAGARI_CONSONANTS: ReadonlyArray<readonly [string, string]> = [
  ['chh', 'छ'],
  ['sch', 'श'],
  ['tch', 'च'],
  ['bh', 'भ'],
  ['ch', 'च'],
  ['ck', 'क'],
  ['dh', 'ध'],
  ['gh', 'घ'],
  ['jh', 'झ'],
  ['kh', 'ख'],
  ['kn', 'न'],
  ['ph', 'फ'],
  ['sh', 'श'],
  ['th', 'थ'],
  ['wh', 'व'],
  ['zh', 'झ'],
  ['b', 'ब'],
  ['c', 'क'],
  ['d', 'द'],
  ['f', 'फ़'],
  ['g', 'ग'],
  ['h', 'ह'],
  ['j', 'ज'],
  ['k', 'क'],
  ['l', 'ल'],
  ['m', 'म'],
  ['n', 'न'],
  ['p', 'प'],
  ['q', 'क़'],
  ['r', 'र'],
  ['s', 'स'],
  ['t', 'त'],
  ['v', 'व'],
  ['w', 'व'],
  ['x', 'क्स'],
  ['y', 'य'],
  ['z', 'ज़'],
]

const VIRAMA = '\u094d'

/**
 * Devanagari marks true consonant clusters with a virama, but a syllable-final
 * consonant keeps its inherent vowel and relies on schwa deletion instead.
 * Latin spelling does not distinguish the two. These letters are overwhelmingly
 * syllable-final in the names here ("Ahmed" is अहमद, not अह्मेद), so they are
 * excluded from clustering while genuine clusters like मस्जिद still form.
 */
const NO_VIRAMA_AFTER = new Set(['ह', 'म', 'न'])

/**
 * Arabic-script consonants. Urdu keeps the Indo-Aryan letters (پ چ گ ک ہ ی)
 * that Modern Standard Arabic lacks, so the two scripts differ on a handful of
 * sounds and are listed separately.
 */
const ARABIC_CONSONANTS: ReadonlyArray<readonly [string, string, string]> = [
  // [latin, urdu, arabic]
  ['chh', 'چھ', 'چ'],
  ['bh', 'بھ', 'ب'],
  ['ch', 'چ', 'تش'],
  ['ck', 'ک', 'ك'],
  ['dh', 'دھ', 'ذ'],
  ['gh', 'غ', 'غ'],
  ['jh', 'جھ', 'ج'],
  ['kh', 'خ', 'خ'],
  ['ph', 'ف', 'ف'],
  ['sh', 'ش', 'ش'],
  // Indic "th" is an aspirated t, so ت reads closer than the Arabic ث.
  ['th', 'تھ', 'ت'],
  ['zh', 'ژ', 'ج'],
  ['b', 'ب', 'ب'],
  ['c', 'ک', 'ك'],
  ['d', 'د', 'د'],
  ['f', 'ف', 'ف'],
  ['g', 'گ', 'غ'],
  ['h', 'ہ', 'ه'],
  ['j', 'ج', 'ج'],
  ['k', 'ک', 'ك'],
  ['l', 'ل', 'ل'],
  ['m', 'م', 'م'],
  ['n', 'ن', 'ن'],
  ['p', 'پ', 'ب'],
  ['q', 'ق', 'ق'],
  ['r', 'ر', 'ر'],
  ['s', 'س', 'س'],
  ['t', 'ت', 'ت'],
  ['v', 'و', 'ف'],
  ['w', 'و', 'و'],
  ['x', 'کس', 'كس'],
  ['y', 'ی', 'ي'],
  ['z', 'ز', 'ز'],
]

type VowelSlot = 'initial' | 'medial' | 'final'

/**
 * Arabic script writes long vowels and omits short ones, except word-initially
 * (where a carrier alif is required) and word-finally.
 */
const ARABIC_VOWELS: ReadonlyArray<readonly [string, Record<VowelSlot, string>]> = [
  ['aa', { initial: 'آ', medial: 'ا', final: 'ا' }],
  ['ai', { initial: 'ای', medial: 'ی', final: 'ی' }],
  ['au', { initial: 'او', medial: 'و', final: 'و' }],
  ['ay', { initial: 'ای', medial: 'ی', final: 'ے' }],
  ['ee', { initial: 'ای', medial: 'ی', final: 'ی' }],
  ['ei', { initial: 'ای', medial: 'ی', final: 'ی' }],
  ['ey', { initial: 'ای', medial: 'ی', final: 'ے' }],
  ['ie', { initial: 'ای', medial: 'ی', final: 'ی' }],
  ['ii', { initial: 'ای', medial: 'ی', final: 'ی' }],
  ['oa', { initial: 'او', medial: 'و', final: 'و' }],
  ['oo', { initial: 'او', medial: 'و', final: 'و' }],
  ['ou', { initial: 'او', medial: 'و', final: 'و' }],
  ['uu', { initial: 'او', medial: 'و', final: 'و' }],
  ['a', { initial: 'ا', medial: '', final: 'ہ' }],
  ['e', { initial: 'ا', medial: '', final: 'ے' }],
  ['i', { initial: 'ا', medial: '', final: 'ی' }],
  ['o', { initial: 'او', medial: 'و', final: 'و' }],
  ['u', { initial: 'ا', medial: '', final: 'و' }],
]

/** Arabic has no ے, and a final short vowel is carried by ا or ة. */
const ARABIC_FINAL_OVERRIDES: Record<string, string> = { 'ے': 'ا', 'ہ': 'ة' }

function matchLongest<T extends readonly [string, ...unknown[]]>(
  table: ReadonlyArray<T>,
  word: string,
  at: number,
): T | null {
  for (const entry of table) {
    if (word.startsWith(entry[0], at)) return entry
  }
  return null
}

function toDevanagari(word: string): string {
  let out = ''
  let index = 0
  // True when the previous glyph was a consonant still awaiting its vowel, so
  // a following consonant needs an explicit virama to form a cluster.
  let consonantPending = false

  while (index < word.length) {
    const vowel = matchLongest(DEVANAGARI_VOWELS, word, index)
    if (vowel) {
      const isFinal = index + vowel[0].length >= word.length
      const forms = (isFinal ? DEVANAGARI_FINAL_VOWELS[vowel[0]] : null) ?? [vowel[1], vowel[2]]
      out += consonantPending ? forms[1] : forms[0]
      consonantPending = false
      index += vowel[0].length
      continue
    }

    const doubled = word[index] === word[index + 1]
    const consonant = matchLongest(DEVANAGARI_CONSONANTS, word, index)
    if (consonant) {
      if (consonantPending && !NO_VIRAMA_AFTER.has(out.slice(-1))) out += VIRAMA
      out += consonant[1]
      consonantPending = true
      // Gemination: "allah" -> अल्लाह rather than अलाह.
      if (doubled && consonant[0].length === 1) index += 1
      index += consonant[0].length
      continue
    }

    out += word[index]
    consonantPending = false
    index += 1
  }

  return out
}

function toArabicScript(word: string, script: 'urdu' | 'arabic'): string {
  const consonantColumn = script === 'urdu' ? 1 : 2
  let out = ''
  let index = 0
  let atStart = true

  while (index < word.length) {
    const vowel = matchLongest(ARABIC_VOWELS, word, index)
    if (vowel) {
      const isFinal = index + vowel[0].length >= word.length
      const slot: VowelSlot = atStart ? 'initial' : isFinal ? 'final' : 'medial'
      let glyph = vowel[1][slot]
      if (script === 'arabic' && ARABIC_FINAL_OVERRIDES[glyph]) {
        glyph = ARABIC_FINAL_OVERRIDES[glyph]
      }
      out += glyph
      atStart = false
      index += vowel[0].length
      continue
    }

    const consonant = matchLongest(ARABIC_CONSONANTS, word, index)
    if (consonant) {
      out += consonant[consonantColumn]
      atStart = false
      // Arabic script marks gemination with shadda rather than a repeat.
      if (word[index] === word[index + 1] && consonant[0].length === 1) index += 1
      index += consonant[0].length
      continue
    }

    out += word[index]
    atStart = false
    index += 1
  }

  return out
}

/** Transliterate a single lowercase Latin word into `script`. */
export function transliterateWord(word: string, script: TargetScript): string {
  if (!word) return word
  const lower = word.toLowerCase()
  return script === 'devanagari' ? toDevanagari(lower) : toArabicScript(lower, script)
}
