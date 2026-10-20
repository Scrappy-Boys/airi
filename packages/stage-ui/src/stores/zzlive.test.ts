import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFacultyDefaultsStore } from './faculty-defaults'
import { useModuleSetupsStore } from './module-setups'
import { useConsciousnessStore } from './modules/consciousness'
import { useHearingStore } from './modules/hearing-store'
import { useSpeechStore } from './modules/speech'
import { useProvidersStore } from './providers'
import { useZzliveStore } from './zzlive'

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

const KEY = 'zz-test-key-0123456789'

function model(key: string, state: string, extra: Record<string, unknown> = {}) {
  return { key, label: key, repo: `repo/${key}`, target: 'Models', note: '', state, total_bytes: 100, done_bytes: 0, error: '', ...extra }
}

function setupStatus(state: string, running = false, failed = false, server = { state: 'stopped', running: false, note: '' }) {
  return {
    machine: 'nvidia',
    machine_label: 'Windows or Linux with an NVIDIA card',
    models: [
      model('chat', failed ? 'failed' : state, failed ? { error: 'The download stopped.' } : {}),
      model('memory', 'present'),
      model('hearing', 'present'),
      model('speech', 'present'),
    ],
    running,
    ready: state !== 'missing',
    missing_bytes: state === 'missing' ? 100 : 0,
    server,
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/**
 * A fake ZZLive: the launcher on port 8070 and the model server on port 8080.
 * The chat model is missing until the download finishes, and the model server
 * answers only after the launcher starts it.
 */
function fakeZzlive(options: { launcherStatus?: number, failDownload?: boolean, serverCrashes?: boolean } = {}) {
  const calls: string[] = []
  let downloaded = false
  let downloadPolls = 0
  let started = false
  // A crash at the launcher's own start leaves a note from before AIRI pressed Start.
  let server = { state: 'stopped', running: false, note: 'stopped by itself (exit code 1)' }
  let serverPolls = 0

  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    calls.push(`${method} ${url.port}${url.pathname}`)

    if (headers.get('Authorization') !== `Bearer ${KEY}`)
      return json({ error: { message: 'wrong key', type: 'invalid_api_key' } }, 401)

    if (url.port === '8070') {
      if (options.launcherStatus)
        return json({ error: 'launcher failed' }, options.launcherStatus)
      if (url.pathname === '/airi/setup/download' && method === 'POST') {
        downloaded = true
        return json(setupStatus('downloading', true))
      }
      if (url.pathname === '/airi/setup') {
        if (started && options.serverCrashes && ++serverPolls > 1)
          server = { state: 'stopped', running: false, note: 'stopped by itself (exit code 1)' }
        if (!downloaded)
          return json(setupStatus('missing', false, false, server))
        downloadPolls += 1
        return json(setupStatus('done', false, options.failDownload, server))
      }
      if (url.pathname === '/airi/start' && method === 'POST') {
        started = true
        server = { state: 'starting', running: false, note: '' }
        return json({ ok: true, server })
      }
    }

    if (url.port === '8080') {
      if (!started || options.serverCrashes)
        throw new TypeError('fetch failed')
      if (url.pathname === '/v1/models')
        return json({ object: 'list', data: ['zoey', 'zoey:typed', 'zane', 'zane:typed'].map(id => ({ id, object: 'model', owned_by: 'zzlive' })) })
      if (url.pathname === '/v1/audio/voices')
        return json({ voices: [{ id: 'zoey', name: 'Zoey', kokoro_voice: 'af_heart' }, { id: 'zane', name: 'Zane', kokoro_voice: 'am_michael' }] })
    }

    return json({ error: 'not found' }, 404)
  })

  return { fetch, calls, downloadPolls: () => downloadPolls }
}

describe('the ZZLive setup', () => {
  beforeEach(() => {
    // The saved setups, the ZZLive key, and the module choices are kept in localStorage.
    if (typeof localStorage !== 'undefined')
      localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('downloads the missing models, starts ZZLive, and sets chat, speech, and hearing to it', async () => {
    const fake = fakeZzlive()
    vi.stubGlobal('fetch', fake.fetch)
    const consciousness = useConsciousnessStore()
    const speech = useSpeechStore()
    const hearing = useHearingStore()
    const providers = useProvidersStore()
    const setups = useModuleSetupsStore()
    const zzlive = useZzliveStore()
    consciousness.activeProvider = 'openai'
    consciousness.activeModel = 'gpt-4o-mini'
    zzlive.key = KEY
    zzlive.persona = 'zane'

    await zzlive.runSetup()

    expect(zzlive.error).toBe('')
    expect(zzlive.phase).toBe('done')
    expect(fake.calls).toContain('POST 8070/airi/setup/download')
    expect(fake.calls).toContain('POST 8070/airi/start')
    expect(fake.downloadPolls()).toBeGreaterThan(0)

    expect(consciousness.activeProvider).toBe('zzlive')
    expect(consciousness.activeModel).toBe('zane')
    expect(speech.activeSpeechProvider).toBe('zzlive-speech')
    expect(speech.activeSpeechModel).toBe('kokoro')
    expect(speech.activeSpeechVoiceId).toBe('zane')
    expect(hearing.activeTranscriptionProvider).toBe('zzlive-transcription')
    expect(hearing.activeTranscriptionModel).toBe('whisper')
    expect(useFacultyDefaultsStore().consciousness).toMatchObject({ primaryProvider: 'zzlive', primaryModel: 'zane' })

    for (const providerId of ['zzlive', 'zzlive-speech', 'zzlive-transcription']) {
      expect(providers.getProviderConfig(providerId)).toMatchObject({ apiKey: KEY, baseUrl: 'http://127.0.0.1:8080/v1/' })
      expect(providers.providerRuntimeState[providerId]?.isConfigured).toBe(true)
      expect(providers.addedProviders[providerId]).toBe(true)
    }

    expect(setups.list('consciousness').map(setup => [setup.name, setup.provider, setup.model])).toEqual([
      ['Before ZZLive', 'openai', 'gpt-4o-mini'],
      ['ZZLive', 'zzlive', 'zane'],
    ])
    expect(setups.appliedSetup('consciousness')?.preset).toBe('zzlive')
  }, 20_000)

  it('keeps the first "Before ZZLive" setup when the setup runs again', async () => {
    vi.stubGlobal('fetch', fakeZzlive().fetch)
    const consciousness = useConsciousnessStore()
    const setups = useModuleSetupsStore()
    const zzlive = useZzliveStore()
    consciousness.activeProvider = 'openai'
    consciousness.activeModel = 'gpt-4o-mini'
    zzlive.key = KEY

    await zzlive.runSetup()
    zzlive.persona = 'zane'
    await zzlive.runSetup()

    expect(setups.list('consciousness').map(setup => [setup.name, setup.provider, setup.model])).toEqual([
      ['Before ZZLive', 'openai', 'gpt-4o-mini'],
      ['ZZLive', 'zzlive', 'zane'],
    ])

    const before = setups.list('consciousness').find(setup => setup.preset === 'before-zzlive')!
    await setups.apply('consciousness', before.id)
    expect(consciousness.activeProvider).toBe('openai')
    expect(consciousness.activeModel).toBe('gpt-4o-mini')
  }, 20_000)

  it('asks for the key before it calls ZZLive', async () => {
    const fake = fakeZzlive()
    vi.stubGlobal('fetch', fake.fetch)
    const zzlive = useZzliveStore()

    await zzlive.runSetup()

    expect(zzlive.phase).toBe('error')
    expect(zzlive.error).toContain('key')
    expect(fake.calls).toEqual([])
  })

  it('says the key is wrong when the launcher refuses it', async () => {
    vi.stubGlobal('fetch', fakeZzlive().fetch)
    const zzlive = useZzliveStore()
    zzlive.key = 'zz-some-other-key-000000'

    await zzlive.runSetup()

    expect(zzlive.phase).toBe('error')
    expect(zzlive.error).toContain('The key is wrong')
    expect(useConsciousnessStore().activeProvider).not.toBe('zzlive')
  })

  it('says how to start ZZLive when the launcher does not answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed')
    }))
    const zzlive = useZzliveStore()
    zzlive.key = KEY

    await zzlive.runSetup()

    expect(zzlive.phase).toBe('error')
    expect(zzlive.error).toContain('start.bat')
  })

  it('stops when the model server stops by itself, instead of waiting for it', async () => {
    vi.stubGlobal('fetch', fakeZzlive({ serverCrashes: true }).fetch)
    const consciousness = useConsciousnessStore()
    const zzlive = useZzliveStore()
    consciousness.activeProvider = 'openai'
    zzlive.key = KEY

    await zzlive.runSetup()

    expect(zzlive.phase).toBe('error')
    expect(zzlive.error).toContain('model server stopped (stopped by itself (exit code 1))')
    expect(consciousness.activeProvider).toBe('openai')
  }, 20_000)

  it('stops with the model that failed to download, and changes no module', async () => {
    vi.stubGlobal('fetch', fakeZzlive({ failDownload: true }).fetch)
    const consciousness = useConsciousnessStore()
    const zzlive = useZzliveStore()
    consciousness.activeProvider = 'openai'
    zzlive.key = KEY

    await zzlive.runSetup()

    expect(zzlive.phase).toBe('error')
    expect(zzlive.error).toBe('chat: The download stopped.')
    expect(consciousness.activeProvider).toBe('openai')
  }, 20_000)
})
