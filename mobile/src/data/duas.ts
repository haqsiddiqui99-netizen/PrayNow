import type { TranslationKey } from '@/src/i18n/translations'

export type DhikrId = 'subhanallah' | 'alhamdulillah' | 'allahuakbar' | 'tahlil' | 'istighfar' | 'salawat'

export type Dhikr = {
  id: DhikrId
  arabic: string
  target: number
  name: TranslationKey
  meaning: TranslationKey
}

/** The first three run in order after each salah (Sahih Muslim 597). */
export const AFTER_SALAH: DhikrId[] = ['subhanallah', 'alhamdulillah', 'allahuakbar']

export const DHIKR: Dhikr[] = [
  { id: 'subhanallah', arabic: 'سُبْحَانَ اللَّهِ', target: 33, name: 'dhikr.subhanallah', meaning: 'dhikr.subhanallahMeaning' },
  { id: 'alhamdulillah', arabic: 'الْحَمْدُ لِلَّهِ', target: 33, name: 'dhikr.alhamdulillah', meaning: 'dhikr.alhamdulillahMeaning' },
  { id: 'allahuakbar', arabic: 'اللَّهُ أَكْبَرُ', target: 34, name: 'dhikr.allahuakbar', meaning: 'dhikr.allahuakbarMeaning' },
  { id: 'tahlil', arabic: 'لَا إِلَهَ إِلَّا اللَّهُ', target: 100, name: 'dhikr.tahlil', meaning: 'dhikr.tahlilMeaning' },
  { id: 'istighfar', arabic: 'أَسْتَغْفِرُ اللَّهَ', target: 100, name: 'dhikr.istighfar', meaning: 'dhikr.istighfarMeaning' },
  { id: 'salawat', arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ', target: 100, name: 'dhikr.salawat', meaning: 'dhikr.salawatMeaning' },
]

export type DuaCategory = 'daily' | 'mosque' | 'ramadan' | 'quran'

export type DuaSource = { book: 'bukhari' | 'muslim' | 'abudawud' | 'tirmidhi' | 'quran'; ref: string }

export type Dua = {
  id: string
  category: DuaCategory
  arabic: string
  transliteration: string
  title: TranslationKey
  meaning: TranslationKey
  source: DuaSource
}

export const DUA_CATEGORIES: { id: DuaCategory; label: TranslationKey }[] = [
  { id: 'daily', label: 'duas.catDaily' },
  { id: 'mosque', label: 'duas.catMosque' },
  { id: 'ramadan', label: 'duas.catRamadan' },
  { id: 'quran', label: 'duas.catQuran' },
]

export const DUAS: Dua[] = [
  {
    id: 'wake',
    category: 'daily',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ',
    transliteration: "Alhamdu lillahil-ladhi ahyana ba'da ma amatana wa ilayhin-nushur",
    title: 'dua.wake',
    meaning: 'dua.wakeMeaning',
    source: { book: 'bukhari', ref: '6312' },
  },
  {
    id: 'sleep',
    category: 'daily',
    arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
    transliteration: 'Bismika Allahumma amutu wa ahya',
    title: 'dua.sleep',
    meaning: 'dua.sleepMeaning',
    source: { book: 'bukhari', ref: '6324' },
  },
  {
    id: 'eatStart',
    category: 'daily',
    arabic: 'بِسْمِ اللَّهِ',
    transliteration: 'Bismillah',
    title: 'dua.eatStart',
    meaning: 'dua.eatStartMeaning',
    source: { book: 'abudawud', ref: '3767' },
  },
  {
    id: 'eatEnd',
    category: 'daily',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ',
    transliteration: "Alhamdu lillahil-ladhi at'amani hadha wa razaqanihi min ghayri hawlin minni wa la quwwah",
    title: 'dua.eatEnd',
    meaning: 'dua.eatEndMeaning',
    source: { book: 'tirmidhi', ref: '3458' },
  },
  {
    id: 'leaveHome',
    category: 'daily',
    arabic: 'بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
    transliteration: "Bismillahi tawakkaltu 'alallah, wa la hawla wa la quwwata illa billah",
    title: 'dua.leaveHome',
    meaning: 'dua.leaveHomeMeaning',
    source: { book: 'abudawud', ref: '5095' },
  },
  {
    id: 'wudu',
    category: 'mosque',
    arabic: 'أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
    transliteration: "Ash-hadu an la ilaha illallahu wahdahu la sharika lah, wa ash-hadu anna Muhammadan 'abduhu wa rasuluh",
    title: 'dua.wudu',
    meaning: 'dua.wuduMeaning',
    source: { book: 'muslim', ref: '234' },
  },
  {
    id: 'enterMosque',
    category: 'mosque',
    arabic: 'اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ',
    transliteration: 'Allahumma-ftah li abwaba rahmatik',
    title: 'dua.enterMosque',
    meaning: 'dua.enterMosqueMeaning',
    source: { book: 'muslim', ref: '713' },
  },
  {
    id: 'leaveMosque',
    category: 'mosque',
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ',
    transliteration: "Allahumma inni as'aluka min fadlik",
    title: 'dua.leaveMosque',
    meaning: 'dua.leaveMosqueMeaning',
    source: { book: 'muslim', ref: '713' },
  },
  {
    id: 'iftar',
    category: 'ramadan',
    arabic: 'ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الْأَجْرُ إِنْ شَاءَ اللَّهُ',
    transliteration: "Dhahabaz-zama'u wabtallatil-'uruqu wa thabatal-ajru in sha Allah",
    title: 'dua.iftar',
    meaning: 'dua.iftarMeaning',
    source: { book: 'abudawud', ref: '2357' },
  },
  {
    id: 'qadr',
    category: 'ramadan',
    arabic: 'اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي',
    transliteration: "Allahumma innaka 'afuwwun tuhibbul-'afwa fa'fu 'anni",
    title: 'dua.qadr',
    meaning: 'dua.qadrMeaning',
    source: { book: 'tirmidhi', ref: '3513' },
  },
  {
    id: 'parents',
    category: 'quran',
    arabic: 'رَبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا',
    transliteration: 'Rabbir-hamhuma kama rabbayani saghira',
    title: 'dua.parents',
    meaning: 'dua.parentsMeaning',
    source: { book: 'quran', ref: '17:24' },
  },
  {
    id: 'bothWorlds',
    category: 'quran',
    arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
    transliteration: "Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan wa qina 'adhaban-nar",
    title: 'dua.bothWorlds',
    meaning: 'dua.bothWorldsMeaning',
    source: { book: 'quran', ref: '2:201' },
  },
]
