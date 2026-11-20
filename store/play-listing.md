# PrayNow on Google Play

Everything to paste into Play Console for the first release.

## Store listing

**App name:** PrayNow

**Short description (80 characters max):**
Jamaat times for mosques near you, azan alerts, and live azan from your mosque.

**Full description:**

PrayNow helps you reach every jamaat on time.

See the azan and jamaat times of the mosques around you, sorted by distance, and get an alert before each prayer. When your mosque broadcasts, open the Azan tab and hear the azan live, wherever you are.

Mosque times
• Azan and jamaat times for every mosque in your city, kept up to date by each mosque's admin
• Sort by nearest, earliest or latest jamaat, and filter by facilities
• Juma sessions, Taraweeh, Tahajjud and Sehri times
• Directions to any mosque in one tap
• Suggest a correction when a time looks wrong

Live azan
• Hear the azan live from mosques that broadcast it
• Follow your mosques to get their alerts and announcements

Every day
• Today's prayer times with a countdown to the next prayer
• Sehri and Iftar times in Ramadan
• Qibla direction
• Quran reader that remembers your page
• Duas and tasbih
• Hijri calendar with reminders for Islamic dates
• Prayer tracker
• Zakat calculator
• Halal food and services near you
• Ask the in-app guide questions about Islam, by text or voice

Available in English, Hindi, Urdu and Arabic, with light and dark themes.

PrayNow is opening city by city. Qibla, Quran, duas, the calendar and Zakat work everywhere.

**Category:** Lifestyle
**Tags:** Religion, Prayer times
**Contact email:** required by Play. Use the support address you want shown publicly.
**Privacy policy URL:** https://praynow-production.up.railway.app/privacy/

## App content

**Account deletion URL:** https://praynow-production.up.railway.app/delete-account/
Users can also delete their account inside the app from the account menu.

**Ads:** No ads.

**App access:** Most features work without signing in. For review, give Google a normal user account (mobile number and password) and say that mosque admin tools need a mosque admin account. Do not give them the app owner account.

**Target audience:** 13 and over.

**Content rating questionnaire:** Reference, news or educational. No violence, sexual content, gambling, or purchases. Users can send text to mosque admins (corrections and requests), and the AI guide produces text answers.

## Data safety form

General answers:
- Does the app collect or share user data? **Yes.**
- Is all data encrypted in transit? **Yes** (HTTPS).
- Can users request deletion? **Yes**, in the app and at the deletion URL above.
- Shared with third parties: **No.** OpenAI, Agora, Open-Meteo, Firebase and Expo process data on PrayNow's behalf, so Play treats them as service providers.

| Data type | Collected | Required or optional | Why | Notes |
|---|---|---|---|---|
| Personal info: Name | Yes | Optional (only with an account) | Account management | |
| Personal info: Phone number | Yes | Optional (only with an account) | Account management | Used as the sign-in ID |
| Location: Approximate | Yes, processed ephemerally | Optional | App functionality | Rounded to about 1 km for weather. Not stored |
| Location: Precise | No | | | Used on the phone only, for nearby mosques and Qibla |
| Audio: Voice or sound recordings | Yes | Optional | App functionality | Spoken questions to the guide are transcribed and not kept. Mosque admins' azan recordings and announcements are stored |
| Photos | Yes | Optional | App functionality | Mosque photos users choose to submit |
| App activity: Other user-generated content | Yes | Optional | App functionality | Corrections, mosque requests, questions to the guide |
| App activity: Other actions | Yes | Optional | App functionality | Mosques you follow and reminder settings |
| Messages: Other in-app messages | Yes | Optional | App functionality | Notifications and announcements sent to you |
| Device or other IDs | Yes | Optional | App functionality | Push notification token |

Not collected: email, financial info, health, contacts, calendar, files, web history, installed apps, crash logs, diagnostics.

## Exact alarm permission

The app uses `SCHEDULE_EXACT_ALARM` so the azan and jamaat alerts ring at the exact minute. On Android 14 and newer the user grants this in settings ("Alarms & reminders"), and Play Console does not require a declaration for it. A declaration is only needed for `USE_EXACT_ALARM`, which PrayNow does not request.

If Play Console asks why the app needs exact alarms, use:

> PrayNow is a prayer-times app. Users set alerts for the azan and the congregational prayer (jamaat) at their mosque. These times are fixed to the minute, and an alert that arrives late makes the user miss the prayer. Exact alarms are scheduled only for prayer and jamaat times the user turned on, and the user can turn them off at any time.

## Screenshots

Play needs 2 to 8 phone screenshots, in PNG or JPEG, portrait 9:16 (for example 1080×1920). Take them on the phone with the release build, signed in as a normal user, in a city with mosques, during daylight with the light theme:

1. Home: prayer card with the countdown and the five times
2. Home scrolled to Nearby mosques
3. Mosques tab: the list (or map view)
4. A mosque's detail page with its jamaat times
5. Azan tab, ideally while a mosque is live
6. Qibla
7. Quran or Duas
8. More page

Also needed:
- **App icon:** 512×512 PNG. Export it from `mobile/assets/brand/icon.png`.
- **Feature graphic:** 1024×500 PNG or JPEG, showing the logo and the line "Never miss a jamaat".
