/** Mirrors MAX_PHOTOS in server/src/services/mosqueRequests.js. */
export const MAX_REQUEST_PHOTOS = 5

/** Mirrors MAX_PHOTO_BYTES on the server, with headroom for base64 overhead. */
const MAX_PHOTO_BYTES = 1_200_000

/** Long edge of the uploaded image. Plenty for a mosque photo on any phone. */
const MAX_EDGE = 1280

/** Each retry trades quality for size when a photo lands over the cap. */
const COMPRESSION_STEPS = [
  { edge: MAX_EDGE, compress: 0.6 },
  { edge: 1024, compress: 0.5 },
  { edge: 800, compress: 0.4 },
]

export type PickedPhoto = {
  /** Local file URI, used for the on-screen thumbnail. */
  uri: string
  /** `data:image/jpeg;base64,…` payload sent to the server. */
  dataUrl: string
  bytes: number
}

export class PhotoTooLargeError extends Error {
  constructor() {
    super('That photo is too large even after compression. Try a different one.')
    this.name = 'PhotoTooLargeError'
  }
}

export class PhotosUnavailableError extends Error {
  constructor() {
    super('Photo attachments need a newer app build. You can still submit without photos.')
    this.name = 'PhotosUnavailableError'
  }
}

type PhotoModules = {
  picker: typeof import('expo-image-picker')
  manipulator: typeof import('expo-image-manipulator')
}

/** `undefined` means not attempted yet; `null` means the build lacks the modules. */
let cachedModules: PhotoModules | null | undefined

/**
 * Loaded on demand rather than at import time. Both packages are native, so a
 * client built before they were added throws on require — keeping that failure
 * inside a button press means the rest of the form still works.
 */
async function loadPhotoModules(): Promise<PhotoModules> {
  if (cachedModules === undefined) {
    try {
      const [picker, manipulator] = await Promise.all([
        import('expo-image-picker'),
        import('expo-image-manipulator'),
      ])
      cachedModules = { picker, manipulator }
    } catch {
      cachedModules = null
    }
  }
  if (!cachedModules) throw new PhotosUnavailableError()
  return cachedModules
}

/** base64 encodes 3 bytes per 4 characters, minus the padding. */
function base64Bytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

/**
 * Shrinks a picked image until it fits the upload cap. Resizing happens on the
 * device so a 12MP camera photo never reaches the network at full size.
 */
async function compressToCap(
  manipulator: PhotoModules['manipulator'],
  uri: string,
): Promise<PickedPhoto> {
  let last: PickedPhoto | null = null

  for (const step of COMPRESSION_STEPS) {
    const rendered = await manipulator.ImageManipulator.manipulate(uri)
      .resize({ width: step.edge })
      .renderAsync()
    const result = await rendered.saveAsync({
      base64: true,
      compress: step.compress,
      format: manipulator.SaveFormat.JPEG,
    })
    if (!result.base64) continue

    last = {
      uri: result.uri,
      dataUrl: `data:image/jpeg;base64,${result.base64}`,
      bytes: base64Bytes(result.base64),
    }
    if (last.bytes <= MAX_PHOTO_BYTES) return last
  }

  if (!last || last.bytes > MAX_PHOTO_BYTES) throw new PhotoTooLargeError()
  return last
}

/**
 * Opens the photo library. Returns an empty array when the user cancels, and
 * throws with a readable message when permission is refused.
 */
export async function pickMosquePhotos(remainingSlots: number): Promise<PickedPhoto[]> {
  if (remainingSlots <= 0) return []
  const { picker, manipulator } = await loadPhotoModules()

  const permission = await picker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Photo library access is needed to attach photos.')
  }

  const result = await picker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: remainingSlots > 1,
    selectionLimit: remainingSlots,
    quality: 1,
  })
  if (result.canceled) return []

  const picked: PickedPhoto[] = []
  for (const asset of result.assets.slice(0, remainingSlots)) {
    picked.push(await compressToCap(manipulator, asset.uri))
  }
  return picked
}

/** Opens the camera for a single photo. Returns null when the user backs out. */
export async function captureMosquePhoto(): Promise<PickedPhoto | null> {
  const { picker, manipulator } = await loadPhotoModules()

  const permission = await picker.requestCameraPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Camera access is needed to take a photo.')
  }

  const result = await picker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
  if (result.canceled || !result.assets[0]) return null
  return compressToCap(manipulator, result.assets[0].uri)
}
