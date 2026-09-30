/**
 * Localisation of mosque names, areas and addresses.
 *
 * These strings come from the database rather than the UI, so they cannot be
 * keyed into `translations.ts`. They are handled in two layers:
 *
 *  1. `PLACE_TOKENS` below — hand-checked forms for the vocabulary that
 *     actually recurs in the dataset. Place-*type* words ("road", "old",
 *     "market") are translated; proper nouns ("Nizamuddin", "Kanpur") are
 *     transliterated into the target script.
 *  2. `transliterate.ts` — a rule-based fallback so the long tail of rare
 *     locality names still renders in the reader's script instead of staying
 *     in Latin.
 *
 * Digits are never touched, so house numbers, PIN codes and sector numbers stay
 * legible. If localised columns (`name_hi`, `address_ur`, ...) are ever added to
 * the API, prefer those and let this stay as the fallback.
 */

import type { LanguageCode } from '@/src/i18n/translations'
import { transliterateWord, type TargetScript } from '@/src/i18n/transliterate'

/** Languages that need a script other than the stored Latin. */
type LocalizedLanguage = Exclude<LanguageCode, 'en'>

const SCRIPT_BY_LANGUAGE: Record<LocalizedLanguage, TargetScript> = {
  hi: 'devanagari',
  ur: 'urdu',
  ar: 'arabic',
}

/** Lowercase Latin token -> form per language. */
const PLACE_TOKENS: Record<string, Readonly<Record<LocalizedLanguage, string>>> = {
  // --- Mosque and shrine vocabulary -------------------------------------
  masjid: { hi: 'मस्जिद', ur: 'مسجد', ar: 'مسجد' },
  masijd: { hi: 'मस्जिद', ur: 'مسجد', ar: 'مسجد' },
  majid: { hi: 'मस्जिद', ur: 'مسجد', ar: 'مسجد' },
  mosque: { hi: 'मस्जिद', ur: 'مسجد', ar: 'مسجد' },
  jama: { hi: 'जामा', ur: 'جامع', ar: 'جامع' },
  jame: { hi: 'जामे', ur: 'جامع', ar: 'جامع' },
  jamia: { hi: 'जामिया', ur: 'جامعہ', ar: 'جامعة' },
  jamiya: { hi: 'जामिया', ur: 'جامعہ', ar: 'جامعة' },
  manazil: { hi: 'मंज़िल', ur: 'منازل', ar: 'منازل' },
  khairul: { hi: 'ख़ैरुल', ur: 'خیر ال', ar: 'خير ال' },
  mecca: { hi: 'मक्का', ur: 'مکہ', ar: 'مكة' },
  makkah: { hi: 'मक्का', ur: 'مکہ', ar: 'مكة' },
  charminar: { hi: 'चारमीनार', ur: 'چار مینار', ar: 'تشار مينار' },
  purana: { hi: 'पुराना', ur: 'پرانا', ar: 'بورانا' },
  mathura: { hi: 'मथुरा', ur: 'متھرا', ar: 'ماثورا' },
  dargah: { hi: 'दरगाह', ur: 'درگاہ', ar: 'ضريح' },
  darga: { hi: 'दरगाह', ur: 'درگاہ', ar: 'ضريح' },
  eidgah: { hi: 'ईदगाह', ur: 'عیدگاہ', ar: 'مصلى العيد' },
  tomb: { hi: 'मक़बरा', ur: 'مقبرہ', ar: 'مقبرة' },
  madarsa: { hi: 'मदरसा', ur: 'مدرسہ', ar: 'مدرسة' },
  markaz: { hi: 'मरकज़', ur: 'مرکز', ar: 'مركز' },
  minar: { hi: 'मीनार', ur: 'مینار', ar: 'منار' },
  khana: { hi: 'ख़ाना', ur: 'خانہ', ar: 'خانة' },
  uloom: { hi: 'उलूम', ur: 'علوم', ar: 'علوم' },
  anjuman: { hi: 'अंजुमन', ur: 'انجمن', ar: 'أنجمن' },
  qila: { hi: 'क़िला', ur: 'قلعہ', ar: 'قلعة' },
  mahal: { hi: 'महल', ur: 'محل', ar: 'محل' },
  hauz: { hi: 'हौज़', ur: 'حوض', ar: 'حوض' },
  sarai: { hi: 'सराय', ur: 'سرائے', ar: 'سراي' },

  // --- Honorifics, schools of thought, common name elements --------------
  hazrat: { hi: 'हज़रत', ur: 'حضرت', ar: 'حضرت' },
  hazrath: { hi: 'हज़रत', ur: 'حضرت', ar: 'حضرت' },
  shah: { hi: 'शाह', ur: 'شاہ', ar: 'شاه' },
  shahi: { hi: 'शाही', ur: 'شاہی', ar: 'شاهي' },
  syed: { hi: 'सैयद', ur: 'سید', ar: 'سيد' },
  sayyed: { hi: 'सैयद', ur: 'سید', ar: 'سيد' },
  haji: { hi: 'हाजी', ur: 'حاجی', ar: 'حاجي' },
  baba: { hi: 'बाबा', ur: 'بابا', ar: 'بابا' },
  khan: { hi: 'ख़ान', ur: 'خان', ar: 'خان' },
  peer: { hi: 'पीर', ur: 'پیر', ar: 'بير' },
  wali: { hi: 'वली', ur: 'ولی', ar: 'ولي' },
  auliya: { hi: 'औलिया', ur: 'اولیا', ar: 'أولياء' },
  begum: { hi: 'बेगम', ur: 'بیگم', ar: 'بيغم' },
  nawab: { hi: 'नवाब', ur: 'نواب', ar: 'نواب' },
  sultan: { hi: 'सुल्तान', ur: 'سلطان', ar: 'سلطان' },
  sunni: { hi: 'सुन्नी', ur: 'سنی', ar: 'سني' },
  shia: { hi: 'शिया', ur: 'شیعہ', ar: 'شيعة' },
  ahle: { hi: 'अहले', ur: 'اہلِ', ar: 'أهل' },
  hadees: { hi: 'हदीस', ur: 'حدیث', ar: 'حديث' },
  qadri: { hi: 'क़ादरी', ur: 'قادری', ar: 'قادري' },
  ismaili: { hi: 'इस्माइली', ur: 'اسماعیلی', ar: 'إسماعيلي' },
  bohra: { hi: 'बोहरा', ur: 'بوہرہ', ar: 'بهرة' },
  islamia: { hi: 'इस्लामिया', ur: 'اسلامیہ', ar: 'الإسلامية' },
  osmania: { hi: 'उस्मानिया', ur: 'عثمانیہ', ar: 'العثمانية' },
  mohammedia: { hi: 'मोहम्मदिया', ur: 'محمدیہ', ar: 'المحمدية' },
  mohammadia: { hi: 'मोहम्मदिया', ur: 'محمدیہ', ar: 'المحمدية' },
  al: { hi: 'अल', ur: 'ال', ar: 'ال' },
  ul: { hi: 'उल', ur: 'ال', ar: 'ال' },
  // Persian ezafe, as in "Masjid-e-Munawara".
  e: { hi: 'ए', ur: 'ے', ar: 'ـ' },
  abu: { hi: 'अबू', ur: 'ابو', ar: 'أبو' },
  abdul: { hi: 'अब्दुल', ur: 'عبدل', ar: 'عبد ال' },
  ali: { hi: 'अली', ur: 'علی', ar: 'علي' },
  umar: { hi: 'उमर', ur: 'عمر', ar: 'عمر' },
  bilal: { hi: 'बिलाल', ur: 'بلال', ar: 'بلال' },
  hussain: { hi: 'हुसैन', ur: 'حسین', ar: 'حسين' },
  anwar: { hi: 'अनवर', ur: 'انور', ar: 'أنور' },
  zakir: { hi: 'ज़ाकिर', ur: 'ذاکر', ar: 'ذاكر' },
  raza: { hi: 'रज़ा', ur: 'رضا', ar: 'رضا' },
  roshan: { hi: 'रोशन', ur: 'روشن', ar: 'روشن' },
  gharib: { hi: 'ग़रीब', ur: 'غریب', ar: 'غريب' },
  nawaz: { hi: 'नवाज़', ur: 'نواز', ar: 'نواز' },
  madina: { hi: 'मदीना', ur: 'مدینہ', ar: 'المدينة' },
  aqsa: { hi: 'अक़्सा', ur: 'اقصیٰ', ar: 'الأقصى' },
  quba: { hi: 'क़ुबा', ur: 'قبا', ar: 'قباء' },
  noor: { hi: 'नूर', ur: 'نور', ar: 'نور' },
  noori: { hi: 'नूरी', ur: 'نوری', ar: 'نوري' },
  noorani: { hi: 'नूरानी', ur: 'نورانی', ar: 'نوراني' },
  qutub: { hi: 'क़ुतुब', ur: 'قطب', ar: 'قطب' },
  turkman: { hi: 'तुर्कमान', ur: 'ترکمان', ar: 'تركمان' },
  chaman: { hi: 'चमन', ur: 'چمن', ar: 'شمن' },
  moti: { hi: 'मोती', ur: 'موتی', ar: 'موتي' },
  lal: { hi: 'लाल', ur: 'لال', ar: 'لال' },
  hari: { hi: 'हरी', ur: 'ہری', ar: 'هري' },
  talaq: { hi: 'तलाक़', ur: 'طلاق', ar: 'طلاق' },
  khas: { hi: 'ख़ास', ur: 'خاص', ar: 'خاص' },
  badi: { hi: 'बड़ी', ur: 'بڑی', ar: 'الكبير' },
  ek: { hi: 'एक', ur: 'ایک', ar: 'واحد' },

  // --- Address structure -------------------------------------------------
  road: { hi: 'रोड', ur: 'روڈ', ar: 'طريق' },
  rd: { hi: 'रोड', ur: 'روڈ', ar: 'طريق' },
  marg: { hi: 'मार्ग', ur: 'مارگ', ar: 'طريق' },
  street: { hi: 'स्ट्रीट', ur: 'اسٹریٹ', ar: 'شارع' },
  st: { hi: 'स्ट्रीट', ur: 'اسٹریٹ', ar: 'شارع' },
  lane: { hi: 'लेन', ur: 'لین', ar: 'حارة' },
  path: { hi: 'पथ', ur: 'پتھ', ar: 'مسار' },
  cross: { hi: 'क्रॉस', ur: 'کراس', ar: 'متقاطع' },
  nagar: { hi: 'नगर', ur: 'نگر', ar: 'ناغار' },
  colony: { hi: 'कॉलोनी', ur: 'کالونی', ar: 'مجمع' },
  block: { hi: 'ब्लॉक', ur: 'بلاک', ar: 'بلوك' },
  sector: { hi: 'सेक्टर', ur: 'سیکٹر', ar: 'قطاع' },
  phase: { hi: 'फेज़', ur: 'فیز', ar: 'مرحلة' },
  pocket: { hi: 'पॉकेट', ur: 'پاکٹ', ar: 'جيب' },
  layout: { hi: 'लेआउट', ur: 'لے آؤٹ', ar: 'مخطط' },
  ward: { hi: 'वार्ड', ur: 'وارڈ', ar: 'حي' },
  circle: { hi: 'सर्कल', ur: 'سرکل', ar: 'دائرة' },
  crossing: { hi: 'क्रॉसिंग', ur: 'کراسنگ', ar: 'تقاطع' },
  flyover: { hi: 'फ्लाईओवर', ur: 'فلائی اوور', ar: 'جسر' },
  bridge: { hi: 'पुल', ur: 'پل', ar: 'جسر' },
  stop: { hi: 'स्टॉप', ur: 'اسٹاپ', ar: 'موقف' },
  depot: { hi: 'डिपो', ur: 'ڈپو', ar: 'مستودع' },
  hospital: { hi: 'अस्पताल', ur: 'ہسپتال', ar: 'مستشفى' },
  school: { hi: 'स्कूल', ur: 'اسکول', ar: 'مدرسة' },
  college: { hi: 'कॉलेज', ur: 'کالج', ar: 'كلية' },
  university: { hi: 'विश्वविद्यालय', ur: 'یونیورسٹی', ar: 'جامعة' },
  court: { hi: 'कोर्ट', ur: 'کورٹ', ar: 'محكمة' },
  fort: { hi: 'क़िला', ur: 'قلعہ', ar: 'قلعة' },
  red: { hi: 'लाल', ur: 'لال', ar: 'أحمر' },
  mandi: { hi: 'मंडी', ur: 'منڈی', ar: 'سوق' },
  sadar: { hi: 'सदर', ur: 'صدر', ar: 'صدر' },
  mohalla: { hi: 'मोहल्ला', ur: 'محلہ', ar: 'محلة' },
  gali: { hi: 'गली', ur: 'گلی', ar: 'زقاق' },
  galli: { hi: 'गली', ur: 'گلی', ar: 'زقاق' },
  chawl: { hi: 'चाल', ur: 'چال', ar: 'تشاول' },
  wadi: { hi: 'वाडी', ur: 'واڑی', ar: 'وادي' },
  kothi: { hi: 'कोठी', ur: 'کوٹھی', ar: 'كوتي' },
  bhavan: { hi: 'भवन', ur: 'بھون', ar: 'بهافان' },
  tola: { hi: 'टोला', ur: 'ٹولہ', ar: 'تولا' },
  cantt: { hi: 'कैंट', ur: 'کینٹ', ar: 'ثكنة' },
  chungi: { hi: 'चुंगी', ur: 'چنگی', ar: 'تشنغي' },
  chauraha: { hi: 'चौराहा', ur: 'چوراہا', ar: 'تقاطع' },
  area: { hi: 'क्षेत्र', ur: 'علاقہ', ar: 'منطقة' },
  extension: { hi: 'एक्सटेंशन', ur: 'توسیع', ar: 'امتداد' },
  complex: { hi: 'कॉम्प्लेक्स', ur: 'کمپلیکس', ar: 'مجمع' },
  house: { hi: 'हाउस', ur: 'ہاؤس', ar: 'بيت' },
  shop: { hi: 'दुकान', ur: 'دکان', ar: 'متجر' },
  town: { hi: 'टाउन', ur: 'ٹاؤن', ar: 'بلدة' },
  village: { hi: 'गाँव', ur: 'گاؤں', ar: 'قرية' },
  gaon: { hi: 'गाँव', ur: 'گاؤں', ar: 'قرية' },
  city: { hi: 'शहर', ur: 'شہر', ar: 'مدينة' },
  place: { hi: 'प्लेस', ur: 'پلیس', ar: 'ساحة' },
  park: { hi: 'पार्क', ur: 'پارک', ar: 'حديقة' },
  garden: { hi: 'गार्डन', ur: 'گارڈن', ar: 'حديقة' },
  bagh: { hi: 'बाग़', ur: 'باغ', ar: 'باغ' },
  kunj: { hi: 'कुंज', ur: 'کنج', ar: 'كنج' },
  vihar: { hi: 'विहार', ur: 'وہار', ar: 'فيهار' },
  basti: { hi: 'बस्ती', ur: 'بستی', ar: 'بستي' },
  ganj: { hi: 'गंज', ur: 'گنج', ar: 'غانج' },
  pura: { hi: 'पुरा', ur: 'پورہ', ar: 'بورا' },
  puri: { hi: 'पुरी', ur: 'پوری', ar: 'بوري' },
  purwa: { hi: 'पुरवा', ur: 'پوروا', ar: 'بوروا' },
  chowk: { hi: 'चौक', ur: 'چوک', ar: 'ساحة' },
  maidan: { hi: 'मैदान', ur: 'میدان', ar: 'ميدان' },
  market: { hi: 'बाज़ार', ur: 'بازار', ar: 'سوق' },
  bazar: { hi: 'बाज़ार', ur: 'بازار', ar: 'سوق' },
  bazaar: { hi: 'बाज़ार', ur: 'بازار', ar: 'سوق' },
  bajar: { hi: 'बाज़ार', ur: 'بازار', ar: 'سوق' },
  gate: { hi: 'गेट', ur: 'گیٹ', ar: 'باب' },
  lines: { hi: 'लाइन्स', ur: 'لائنز', ar: 'خطوط' },
  cantonment: { hi: 'कैंटोनमेंट', ur: 'کینٹونمنٹ', ar: 'الثكنات' },
  parade: { hi: 'परेड', ur: 'پریڈ', ar: 'العرض' },
  railway: { hi: 'रेलवे', ur: 'ریلوے', ar: 'السكة الحديد' },
  rail: { hi: 'रेल', ur: 'ریل', ar: 'سكة' },
  metro: { hi: 'मेट्रो', ur: 'میٹرو', ar: 'مترو' },
  station: { hi: 'स्टेशन', ur: 'اسٹیشن', ar: 'محطة' },
  secretariat: { hi: 'सचिवालय', ur: 'سیکرٹریٹ', ar: 'الأمانة' },
  civil: { hi: 'सिविल', ur: 'سول', ar: 'المدني' },
  defence: { hi: 'डिफेंस', ur: 'ڈیفنس', ar: 'الدفاع' },
  central: { hi: 'सेंट्रल', ur: 'سنٹرل', ar: 'المركزي' },
  sub: { hi: 'सब', ur: 'سب', ar: 'فرعي' },
  near: { hi: 'निकट', ur: 'قریب', ar: 'قرب' },
  main: { hi: 'मुख्य', ur: 'مین', ar: 'الرئيسي' },
  old: { hi: 'पुराना', ur: 'پرانا', ar: 'القديم' },
  new: { hi: 'नया', ur: 'نیا', ar: 'الجديد' },
  green: { hi: 'ग्रीन', ur: 'گرین', ar: 'الأخضر' },
  west: { hi: 'पश्चिम', ur: 'مغربی', ar: 'الغربي' },
  east: { hi: 'पूर्व', ur: 'مشرقی', ar: 'الشرقي' },
  south: { hi: 'दक्षिण', ur: 'جنوبی', ar: 'الجنوبي' },
  north: { hi: 'उत्तर', ur: 'شمالی', ar: 'الشمالي' },
  no: { hi: 'नं', ur: 'نمبر', ar: 'رقم' },
  number: { hi: 'नंबर', ur: 'نمبر', ar: 'رقم' },
  of: { hi: 'का', ur: 'کا', ar: 'من' },
  and: { hi: 'और', ur: 'اور', ar: 'و' },
  ki: { hi: 'की', ur: 'کی', ar: 'لـ' },

  // --- Cities and states -------------------------------------------------
  delhi: { hi: 'दिल्ली', ur: 'دہلی', ar: 'دلهي' },
  mumbai: { hi: 'मुंबई', ur: 'ممبئی', ar: 'مومباي' },
  navi: { hi: 'नवी', ur: 'نوی', ar: 'نافي' },
  mumbra: { hi: 'मुंब्रा', ur: 'ممبرا', ar: 'مومبرا' },
  thane: { hi: 'ठाणे', ur: 'تھانے', ar: 'ثاني' },
  hyderabad: { hi: 'हैदराबाद', ur: 'حیدرآباد', ar: 'حيدر آباد' },
  hyderbad: { hi: 'हैदराबाद', ur: 'حیدرآباد', ar: 'حيدر آباد' },
  secunderabad: { hi: 'सिकंदराबाद', ur: 'سکندرآباد', ar: 'سيكندر آباد' },
  bengaluru: { hi: 'बेंगलुरु', ur: 'بینگلورو', ar: 'بنغالورو' },
  bangalore: { hi: 'बैंगलोर', ur: 'بنگلور', ar: 'بنغالور' },
  mysore: { hi: 'मैसूर', ur: 'میسور', ar: 'ميسور' },
  chennai: { hi: 'चेन्नई', ur: 'چنئی', ar: 'تشيناي' },
  kolkata: { hi: 'कोलकाता', ur: 'کولکاتہ', ar: 'كولكاتا' },
  kanpur: { hi: 'कानपुर', ur: 'کانپور', ar: 'كانبور' },
  lucknow: { hi: 'लखनऊ', ur: 'لکھنؤ', ar: 'لكناو' },
  ahmedabad: { hi: 'अहमदाबाद', ur: 'احمدآباد', ar: 'أحمد آباد' },
  patna: { hi: 'पटना', ur: 'پٹنہ', ar: 'باتنا' },
  banda: { hi: 'बांदा', ur: 'باندہ', ar: 'باندا' },
  uttar: { hi: 'उत्तर', ur: 'اتر', ar: 'أتر' },
  pradesh: { hi: 'प्रदेश', ur: 'پردیش', ar: 'براديش' },

  // --- Well-known localities --------------------------------------------
  nizamuddin: { hi: 'निज़ामुद्दीन', ur: 'نظام الدین', ar: 'نظام الدين' },
  okhla: { hi: 'ओखला', ur: 'اوکھلا', ar: 'أوخلا' },
  mehrauli: { hi: 'महरौली', ur: 'مہرولی', ar: 'مهرولي' },
  chandni: { hi: 'चाँदनी', ur: 'چاندنی', ar: 'تشاندني' },
  connaught: { hi: 'कनॉट', ur: 'کناٹ', ar: 'كونوت' },
  daryaganj: { hi: 'दरियागंज', ur: 'دریا گنج', ar: 'دريا غانج' },
  bhalswa: { hi: 'भलस्वा', ur: 'بھلسوا', ar: 'بهالسوا' },
  moth: { hi: 'मोठ', ur: 'موٹھ', ar: 'موث' },
  pragati: { hi: 'प्रगति', ur: 'پرگتی', ar: 'براغاتي' },
  maidaan: { hi: 'मैदान', ur: 'میدان', ar: 'ميدان' },
  kartavya: { hi: 'कर्तव्य', ur: 'کرتویہ', ar: 'كارتافيا' },
  sansad: { hi: 'संसद', ur: 'سنسد', ar: 'سانساد' },
  jajmau: { hi: 'जाजमऊ', ur: 'جاجمو', ar: 'جاجماو' },
  colonelganj: { hi: 'कर्नलगंज', ur: 'کرنل گنج', ar: 'كولونيل غانج' },
  mirpur: { hi: 'मीरपुर', ur: 'میرپور', ar: 'ميربور' },
  kakadeo: { hi: 'काकादेव', ur: 'کاکادیو', ar: 'كاكاديو' },
  kalyanpur: { hi: 'कल्याणपुर', ur: 'کلیان پور', ar: 'كاليانبور' },
  rawatpur: { hi: 'रावतपुर', ur: 'راوت پور', ar: 'راواتبور' },
  gwaltoli: { hi: 'ग्वालटोली', ur: 'گوال ٹولی', ar: 'غوالتولي' },
  patkapur: { hi: 'पटकापुर', ur: 'پٹکاپور', ar: 'باتكابور' },
  nawabganj: { hi: 'नवाबगंज', ur: 'نواب گنج', ar: 'نواب غانج' },
  mulganj: { hi: 'मूलगंज', ur: 'مول گنج', ar: 'مولغانج' },
  juhi: { hi: 'जूही', ur: 'جوہی', ar: 'جوهي' },
  kidwai: { hi: 'किदवई', ur: 'کدوائی', ar: 'كدواي' },
  shastri: { hi: 'शास्त्री', ur: 'شاستری', ar: 'شاستري' },
  malviya: { hi: 'मालवीय', ur: 'مالویہ', ar: 'مالفيا' },
  vijay: { hi: 'विजय', ur: 'وجے', ar: 'فيجاي' },
  kailash: { hi: 'कैलाश', ur: 'کیلاش', ar: 'كايلاش' },
  sangam: { hi: 'संगम', ur: 'سنگم', ar: 'سنغام' },
  param: { hi: 'परम', ur: 'پرم', ar: 'بارام' },
  gandhi: { hi: 'गांधी', ur: 'گاندھی', ar: 'غاندي' },
  hosahalli: { hi: 'होसहल्ली', ur: 'ہوسہلی', ar: 'هوساهالي' },
  padarayana: { hi: 'पदरायण', ur: 'پدرائنا', ar: 'بادارايانا' },
  hoodi: { hi: 'हूडी', ur: 'ہوڈی', ar: 'هودي' },
  hasmatpet: { hi: 'हसमतपेट', ur: 'حشمت پیٹ', ar: 'حشمت بيت' },
  permat: { hi: 'पेरमट', ur: 'پرمٹ', ar: 'بيرمات' },
  yashoda: { hi: 'यशोदा', ur: 'یشودا', ar: 'ياشودا' },
  shani: { hi: 'शनि', ur: 'شنی', ar: 'شني' },
}

/** Latin word runs; everything else (digits, punctuation, other scripts) is kept. */
const LATIN_WORD = /[A-Za-z][A-Za-z']*/g

/**
 * English ordinal suffixes ("7th Cross", "1st Main"). None of the target
 * languages suffix their numerals, and dropping the suffix avoids colliding with
 * the "st" -> Street and "rd" -> Road abbreviations.
 */
const ORDINAL_SUFFIXES = new Set(['st', 'nd', 'rd', 'th'])

// Search re-localises every mosque on each keystroke, and the same names render
// on every list scroll, so results are worth holding onto.
const cache = new Map<string, string>()

/**
 * Render a database-sourced place string in the active language's script.
 * Numbers are preserved verbatim so PIN codes and house numbers stay readable.
 */
export function localizePlaceName(text: string | null | undefined, language: LanguageCode): string {
  if (!text) return text ?? ''
  if (language === 'en') return text

  const cacheKey = `${language}\u0000${text}`
  const cached = cache.get(cacheKey)
  if (cached !== undefined) return cached

  const script = SCRIPT_BY_LANGUAGE[language]
  const localized = text.replace(LATIN_WORD, (token, offset: number) => {
    const lower = token.toLowerCase()
    if (ORDINAL_SUFFIXES.has(lower) && /\d$/.test(text.slice(0, offset))) return ''

    const curated = PLACE_TOKENS[lower]
    if (curated) return curated[language]
    // Lone letters are identifiers ("Block C", "J Road"), not words to convert.
    if (token.length === 1) return token
    return transliterateWord(token, script)
  })

  cache.set(cacheKey, localized)
  return localized
}
