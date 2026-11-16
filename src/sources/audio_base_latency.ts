import { suppressUnhandledRejectionWarning } from '../utils/async'
import { isAndroid, isWebKit } from '../utils/browser'

export const enum SpecialFingerprint {
  /** The browser doesn't support AudioContext or baseLatency */
  NotSupported = -1,
  /** Entropy source is disabled because of console warnings */
  Disabled = -2,
  /** Weird case where `baseLatency` is not a float number but `Infinity` instead */
  NotFinite = -3,
}

export default function getAudioContextBaseLatency(): number {
  // The signal emits warning in Chrome and Firefox, therefore it is enabled on Safari where it doesn't produce warning
  // and on Android where it's less visible
  const isAllowedPlatform = isAndroid() || isWebKit()
  if (!isAllowedPlatform) {
    return SpecialFingerprint.Disabled
  }

  if (!window.AudioContext) {
    return SpecialFingerprint.NotSupported
  }

  const context = new AudioContext()
  try {
    const latency = context.baseLatency

    if (latency === null || latency === undefined) {
      return SpecialFingerprint.NotSupported
    }

    if (!isFinite(latency)) {
      return SpecialFingerprint.NotFinite
    }

    return latency
  } finally {
    releaseAudioContext(context)
  }
}

/**
 * Closes the audio context to release the audio thread it occupies.
 * A real-time `AudioContext` holds a hardware audio thread until closed; not closing it leaks the thread,
 * and browsers cap the number of concurrent audio contexts, so repeated leaks break audio fingerprinting
 * for the whole page.
 *
 * The release is fire-and-forget: `close()` returns a promise, but this entropy source must stay
 * synchronous, so the promise isn't awaited. A rejection of that promise (e.g. the browser refuses to
 * close the context) is suppressed instead of leaking as an unhandled rejection, and a synchronous
 * failure is swallowed too — a release problem must not break the fingerprint collection.
 */
function releaseAudioContext(context: AudioContext): void {
  try {
    // `close` may be absent on a mocked context (e.g. in tests)
    const closePromise = (context as Partial<AudioContext>).close?.()
    if (closePromise) {
      suppressUnhandledRejectionWarning(closePromise)
    }
  } catch {
    // See the function description
  }
}
