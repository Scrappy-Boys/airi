import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFacultyDefaultsStore } from './faculty-defaults'
import { useModuleSetupsStore } from './module-setups'
import { useConsciousnessStore } from './modules/consciousness'
import { useHearingStore } from './modules/hearing-store'
import { useSpeechStore } from './modules/speech'
import { useVisionStore } from './modules/vision'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'en-US' },
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}))

vi.mock('../libs/native-ai', () => ({
  NativeAI: {
    isNative: vi.fn(() => false),
    isModelCached: vi.fn(async () => true),
    downloadModel: vi.fn(async () => undefined),
  },
}))

// Onboarding off, so the stores reset a provider that does not exist, as they do for users.
vi.mock('./onboarding', () => ({
  useOnboardingStore: () => ({ needsOnboarding: false }),
}))

describe('saved module setups', () => {
  beforeEach(() => {
    // The saved setups, the ZZLive key, and the module choices are kept in localStorage.
    if (typeof localStorage !== 'undefined')
      localStorage.clear()
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves the current chat selection and marks it as applied', () => {
    const consciousness = useConsciousnessStore()
    const setups = useModuleSetupsStore()
    consciousness.activeProvider = 'openai'
    consciousness.activeModel = 'gpt-4o-mini'

    const saved = setups.save('consciousness', '  Cloud  ')

    expect(saved).toMatchObject({ name: 'Cloud', provider: 'openai', model: 'gpt-4o-mini' })
    expect(setups.list('consciousness')).toHaveLength(1)
    expect(setups.appliedSetup('consciousness')?.id).toBe(saved.id)

    consciousness.activeProvider = 'ollama'
    expect(setups.appliedSetup('consciousness')).toBeUndefined()
  })

  it('replaces a setup with the same name or the same preset', () => {
    const setups = useModuleSetupsStore()

    setups.save('vision', 'Local', { provider: 'ollama', model: 'llava' })
    setups.save('vision', 'Local', { provider: 'ollama', model: 'qwen2.5-vl' })
    setups.save('vision', 'ZZLive', { provider: 'a', model: 'one' }, 'zzlive')
    setups.save('vision', 'ZZLive renamed', { provider: 'a', model: 'two' }, 'zzlive')

    expect(setups.list('vision').map(setup => [setup.name, setup.model])).toEqual([
      ['Local', 'qwen2.5-vl'],
      ['ZZLive renamed', 'two'],
    ])
  })

  it('refuses a setup without a name or a provider', () => {
    const setups = useModuleSetupsStore()

    expect(() => setups.save('consciousness', '   ', { provider: 'openai', model: 'x' })).toThrow('name')
    expect(() => setups.save('consciousness', 'Empty', { provider: '', model: '' })).toThrow('provider')
  })

  it('applies a chat setup to the module and to the global default', async () => {
    const consciousness = useConsciousnessStore()
    const setups = useModuleSetupsStore()
    const saved = setups.save('consciousness', 'ZZLive', { provider: 'zzlive', model: 'zoey' })

    await setups.apply('consciousness', saved.id)
    await Promise.resolve()

    expect(consciousness.activeProvider).toBe('zzlive')
    expect(consciousness.activeModel).toBe('zoey')
    expect(useFacultyDefaultsStore().consciousness).toMatchObject({ primaryProvider: 'zzlive', primaryModel: 'zoey' })
    expect(setups.appliedSetup('consciousness')?.id).toBe(saved.id)
  })

  it('applies a speech setup with its voice', async () => {
    const speech = useSpeechStore()
    const setups = useModuleSetupsStore()
    const saved = setups.save('speech', 'Zoey', { provider: 'zzlive-speech', model: 'kokoro', voiceId: 'zoey' })

    expect(saved.voiceId).toBe('zoey')
    await setups.apply('speech', saved.id)
    await Promise.resolve()

    expect(speech.activeSpeechProvider).toBe('zzlive-speech')
    expect(speech.activeSpeechModel).toBe('kokoro')
    expect(speech.activeSpeechVoiceId).toBe('zoey')
    expect(useFacultyDefaultsStore().speech).toMatchObject({ primaryProvider: 'zzlive-speech', primaryModel: 'kokoro', primaryVoiceId: 'zoey' })
  })

  it('applies a hearing setup and clears the custom model name', async () => {
    const hearing = useHearingStore()
    const setups = useModuleSetupsStore()
    hearing.activeCustomModelName = 'old-custom-model'
    const saved = setups.save('hearing', 'ZZLive', { provider: 'zzlive-transcription', model: 'whisper' })

    await setups.apply('hearing', saved.id)
    await Promise.resolve()

    expect(hearing.activeTranscriptionProvider).toBe('zzlive-transcription')
    expect(hearing.activeTranscriptionModel).toBe('whisper')
    expect(hearing.activeCustomModelName).toBe('')
  })

  it('applies a vision setup to the module', async () => {
    const vision = useVisionStore()
    const setups = useModuleSetupsStore()
    const saved = setups.save('vision', 'Local', { provider: 'ollama', model: 'llava' })

    await setups.apply('vision', saved.id)

    expect(vision.activeProvider).toBe('ollama')
    expect(vision.activeModel).toBe('llava')
  })

  it('removes a setup, and refuses to apply a removed one', async () => {
    const setups = useModuleSetupsStore()
    const saved = setups.save('vision', 'Local', { provider: 'ollama', model: 'llava' })

    setups.remove('vision', saved.id)

    expect(setups.list('vision')).toEqual([])
    await expect(setups.apply('vision', saved.id)).rejects.toThrow('does not exist')
  })
})
