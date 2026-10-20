import type { SetupModuleId } from './module-setups'

import { errorMessageFrom } from '@moeru/std'
import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  normalizeZzliveBaseUrl,
  ZZLIVE_CHAT_PROVIDER_ID,
  ZZLIVE_DEFAULT_BASE_URL,
  ZZLIVE_SPEECH_MODEL,
  ZZLIVE_SPEECH_PROVIDER_ID,
  ZZLIVE_TRANSCRIPTION_MODEL,
  ZZLIVE_TRANSCRIPTION_PROVIDER_ID,
} from '../libs/providers/providers/zzlive'
import { useModuleSetupsStore } from './module-setups'
import { useProvidersStore } from './providers'

export const ZZLIVE_PRESET = 'zzlive'
export const ZZLIVE_PRESET_NAME = 'ZZLive'
export const ZZLIVE_DEFAULT_LAUNCHER_URL = 'http://127.0.0.1:8070'
export const ZZLIVE_PERSONAS = ['zoey', 'zane'] as const
export type ZzlivePersona = typeof ZZLIVE_PERSONAS[number]

const POLL_MS = 1000
/** vLLM compiles GPU kernels on its first start, so the launcher waits up to 25 minutes too. */
const SERVER_START_TIMEOUT_MS = 25 * 60 * 1000

/** One model in the launcher setup report (`GET /airi/setup`, `server/model_setup.py`). */
export interface ZzliveModelStatus {
  key: 'chat' | 'memory' | 'hearing' | 'speech'
  label: string
  repo: string
  target: string
  note: string
  state: 'present' | 'missing' | 'waiting' | 'downloading' | 'done' | 'failed'
  total_bytes: number
  done_bytes: number
  error: string
}

/** The launcher setup report. */
export interface ZzliveSetupStatus {
  machine: 'nvidia' | 'mac' | 'cpu'
  machine_label: string
  models: ZzliveModelStatus[]
  running: boolean
  ready: boolean
  missing_bytes: number
  server: { state: 'stopped' | 'starting' | 'running' | 'stopping' | 'missing', running: boolean, note: string }
}

export type ZzliveSetupPhase = 'idle' | 'checking' | 'downloading' | 'starting' | 'applying' | 'done' | 'error'

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Sets every AIRI module to ZZLive with one button.
 *
 * ZZLive has two servers on the computer of the user. The launcher (port 8070) reports and
 * downloads the models, and it starts the model server. The model server (port 8080) answers
 * chat, speech, and transcription in the OpenAI format. Both servers need the AIRI key of ZZLive.
 */
export const useZzliveStore = defineStore('zzlive', () => {
  const launcherUrl = useLocalStorage('settings/zzlive/launcher-url', ZZLIVE_DEFAULT_LAUNCHER_URL)
  const serverUrl = useLocalStorage('settings/zzlive/server-url', ZZLIVE_DEFAULT_BASE_URL)
  const key = useLocalStorage('settings/zzlive/key', '')
  const persona = useLocalStorage<ZzlivePersona>('settings/zzlive/persona', 'zoey')

  const status = ref<ZzliveSetupStatus | null>(null)
  const phase = ref<ZzliveSetupPhase>('idle')
  const error = ref('')

  const busy = computed(() => ['checking', 'downloading', 'starting', 'applying'].includes(phase.value))
  const missingModels = computed(() => status.value?.models.filter(model => !['present', 'done'].includes(model.state) && !model.note) ?? [])

  function headers(): Record<string, string> {
    return { 'Authorization': `Bearer ${key.value.trim()}`, 'Content-Type': 'application/json' }
  }

  async function launcher<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response
    try {
      response = await globalThis.fetch(`${launcherUrl.value.replace(/\/+$/, '')}${path}`, { ...init, headers: headers() })
    }
    catch {
      throw new Error('ZZLive is not running. Start it with start.bat on Windows or ./start.sh on a Mac, then try again.')
    }
    if (response.status === 401)
      throw new Error('The key is wrong. Copy it from the ZZLive page at http://127.0.0.1:8070.')
    const body = await response.json().catch(() => ({})) as T & { error?: string | { message?: string } }
    if (!response.ok) {
      const message = typeof body.error === 'string' ? body.error : body.error?.message
      throw new Error(message || `The ZZLive launcher answered ${response.status}.`)
    }
    return body
  }

  async function checkSetup() {
    status.value = await launcher<ZzliveSetupStatus>('/airi/setup')
    return status.value
  }

  /** Downloads the missing models and waits until the launcher finishes. */
  async function downloadModels() {
    status.value = await launcher<ZzliveSetupStatus>('/airi/setup/download', { method: 'POST', body: '{}' })
    while (status.value.running) {
      await delay(POLL_MS)
      await checkSetup()
    }
    const failed = status.value.models.filter(model => model.state === 'failed')
    if (failed.length > 0)
      throw new Error(failed.map(model => `${model.label}: ${model.error}`).join('\n'))
  }

  /** Returns true when the model server answers with the key. */
  async function serverAnswers() {
    try {
      const response = await globalThis.fetch(`${normalizeZzliveBaseUrl(serverUrl.value)}models`, { headers: headers() })
      if (response.status === 401)
        throw new Error('The model server does not accept this key. Copy the key again from http://127.0.0.1:8070.')
      return response.ok
    }
    catch (caught) {
      if (caught instanceof Error && caught.message.includes('key'))
        throw caught
      return false
    }
  }

  async function startServer() {
    if (await serverAnswers())
      return
    await launcher('/airi/start', { method: 'POST', body: '{}' })
    const deadline = Date.now() + SERVER_START_TIMEOUT_MS
    // The launcher reports a model server that stopped by itself, so a crash does not wait 25 minutes.
    // Until the launcher has started it once, its state can still show an earlier stop.
    let seenStarting = false
    while (Date.now() < deadline) {
      if (await serverAnswers())
        return
      const server = (await checkSetup()).server
      if (server.running || server.state === 'starting')
        seenStarting = true
      else if (seenStarting && server.state === 'stopped')
        throw new Error(`The ZZLive model server stopped${server.note ? ` (${server.note})` : ''}. The launcher page at http://127.0.0.1:8070 shows its log.`)
      await delay(POLL_MS * 2)
    }
    throw new Error('The ZZLive model server did not start. The launcher page at http://127.0.0.1:8070 shows its log.')
  }

  /** Configures the three ZZLive providers with the address and key of this setup. */
  function configureProviders() {
    const providersStore = useProvidersStore()
    const config = { baseUrl: normalizeZzliveBaseUrl(serverUrl.value), apiKey: key.value.trim() }
    for (const providerId of [ZZLIVE_CHAT_PROVIDER_ID, ZZLIVE_SPEECH_PROVIDER_ID, ZZLIVE_TRANSCRIPTION_PROVIDER_ID]) {
      providersStore.initializeProvider(providerId)
      providersStore.providers[providerId] = { ...providersStore.providers[providerId], ...config }
      // The setup has already reached the server with this key, so validation is not repeated.
      // This also adds the provider to the configured list of the settings pages.
      providersStore.forceProviderConfigured(providerId)
    }
  }

  /** The ZZLive selection for each module. Vision is not part of ZZLive. */
  function presetSelections(): Partial<Record<SetupModuleId, { provider: string, model: string, voiceId?: string }>> {
    return {
      consciousness: { provider: ZZLIVE_CHAT_PROVIDER_ID, model: persona.value },
      speech: { provider: ZZLIVE_SPEECH_PROVIDER_ID, model: ZZLIVE_SPEECH_MODEL, voiceId: persona.value },
      hearing: { provider: ZZLIVE_TRANSCRIPTION_PROVIDER_ID, model: ZZLIVE_TRANSCRIPTION_MODEL },
    }
  }

  /**
   * Saves the current selection of each module as "Before ZZLive" (only the first time), saves
   * the ZZLive selection as "ZZLive", and applies it.
   */
  async function applyPreset() {
    const moduleSetups = useModuleSetupsStore()
    configureProviders()
    for (const [module, selection] of Object.entries(presetSelections()) as Array<[SetupModuleId, { provider: string, model: string, voiceId?: string }]>) {
      const current = moduleSetups.currentSelection(module)
      const hasBackup = moduleSetups.list(module).some(setup => setup.preset === 'before-zzlive')
      if (!hasBackup && current.provider && current.provider !== selection.provider && current.provider !== 'speech-noop')
        moduleSetups.save(module, 'Before ZZLive', current, 'before-zzlive')
      moduleSetups.save(module, ZZLIVE_PRESET_NAME, selection, ZZLIVE_PRESET)
      await moduleSetups.applySelection(module, selection)
    }
  }

  /** The one-button setup: check, download the missing models, start ZZLive, and apply it. */
  async function runSetup() {
    error.value = ''
    try {
      if (!key.value.trim())
        throw new Error('Paste the AIRI key from the ZZLive page at http://127.0.0.1:8070 first.')
      phase.value = 'checking'
      await checkSetup()
      if (missingModels.value.length > 0) {
        phase.value = 'downloading'
        await downloadModels()
      }
      phase.value = 'starting'
      await startServer()
      phase.value = 'applying'
      await applyPreset()
      phase.value = 'done'
    }
    catch (caught) {
      error.value = errorMessageFrom(caught) ?? 'The ZZLive setup failed.'
      phase.value = 'error'
    }
  }

  return {
    launcherUrl,
    serverUrl,
    key,
    persona,
    status,
    phase,
    error,
    busy,
    missingModels,
    checkSetup,
    downloadModels,
    startServer,
    configureProviders,
    presetSelections,
    applyPreset,
    runSetup,
  }
})
