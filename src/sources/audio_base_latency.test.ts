import { getBrowserVersion, isAndroid, isGecko, isWebKit } from '../../tests/utils'

import getAudioBaseLatency, { SpecialFingerprint } from './audio_base_latency'

describe('Sources', () => {
  describe('audioBaseLatency', () => {
    it("doesn't fail", () => {
      const result = getAudioBaseLatency()
      const isAllowedPlatform = isAndroid() || isWebKit()
      if (!isAllowedPlatform) {
        expect(result).toBe(SpecialFingerprint.Disabled)
        return
      }

      if (!hasBaseLatencySupport()) {
        expect(result).toBe(SpecialFingerprint.NotSupported)
        return
      }

      if (isGecko()) {
        expect(result).toBe(0)
      } else {
        expect(result).toBeGreaterThan(0)
      }
    })

    it('returns a stable value', () => {
      const first = getAudioBaseLatency()
      const second = getAudioBaseLatency()
      expect(second).toBe(first)
    })

    it('handles Infinity case correctly', () => {
      const isAllowedPlatform = isAndroid() || isWebKit()
      if (!isAllowedPlatform || !hasBaseLatencySupport()) {
        return
      }

      const OriginalAudioContext = window.AudioContext

      class MockAudioContext {
        get baseLatency() {
          return Infinity
        }
      }

      window.AudioContext = MockAudioContext as typeof window.AudioContext

      try {
        const result = getAudioBaseLatency()
        expect(result).toBe(SpecialFingerprint.NotFinite)
      } finally {
        window.AudioContext = OriginalAudioContext
      }
    })

    it('releases every audio context it creates', () => {
      const isAllowedPlatform = isAndroid() || isWebKit()
      if (!isAllowedPlatform || !hasBaseLatencySupport()) {
        return
      }

      const OriginalAudioContext = window.AudioContext
      let constructedCount = 0
      let closedCount = 0

      class MockAudioContext {
        constructor() {
          constructedCount++
        }
        get baseLatency() {
          return 0.01
        }
        close() {
          closedCount++
          return Promise.resolve()
        }
      }

      window.AudioContext = MockAudioContext as unknown as typeof window.AudioContext

      try {
        const first = getAudioBaseLatency()
        const second = getAudioBaseLatency()
        expect(first).toBe(0.01)
        expect(second).toBe(0.01)
        expect(constructedCount).toBe(2)
        expect(closedCount).toBe(constructedCount)
      } finally {
        window.AudioContext = OriginalAudioContext
      }
    })

    it("doesn't create an audio context when the source is disabled", () => {
      const isAllowedPlatform = isAndroid() || isWebKit()
      if (isAllowedPlatform) {
        return
      }

      const OriginalAudioContext = window.AudioContext
      let constructedCount = 0

      class MockAudioContext {
        constructor() {
          constructedCount++
        }
        get baseLatency() {
          return 0.01
        }
      }

      window.AudioContext = MockAudioContext as unknown as typeof window.AudioContext

      try {
        const result = getAudioBaseLatency()
        expect(result).toBe(SpecialFingerprint.Disabled)
        expect(constructedCount).toBe(0)
      } finally {
        window.AudioContext = OriginalAudioContext
      }
    })

    it('keeps the returned value when the context release rejects', () => {
      const isAllowedPlatform = isAndroid() || isWebKit()
      if (!isAllowedPlatform || !hasBaseLatencySupport()) {
        return
      }

      const OriginalAudioContext = window.AudioContext

      class MockAudioContext {
        get baseLatency() {
          return 0.02
        }
        close() {
          return Promise.reject(new Error('Release failed'))
        }
      }

      window.AudioContext = MockAudioContext as unknown as typeof window.AudioContext

      try {
        const result = getAudioBaseLatency()
        expect(result).toBe(0.02)
      } finally {
        window.AudioContext = OriginalAudioContext
      }
    })
  })
})

function hasBaseLatencySupport() {
  if (isWebKit()) {
    const { major, minor } = getBrowserVersion() || { major: 0, minor: 0 }
    if (major < 14) {
      return false
    } else if (major === 14) {
      return minor >= 1
    }
  }
  return true
}
