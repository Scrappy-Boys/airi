// Speech (Kokoro) and transcription (Whisper) on the ZZLive server. The chat side of ZZLive is a
// defineProvider in libs/providers/providers/zzlive.
import type { ModelInfo, ProviderMetadata } from '../types'

import { createOpenAI } from '@xsai-ext/providers/create'

import {
  listZzliveVoices,
  ZZLIVE_DEFAULT_BASE_URL,
  ZZLIVE_ICON,
  ZZLIVE_SPEECH_MODEL,
  ZZLIVE_SPEECH_PROVIDER_ID,
  ZZLIVE_TRANSCRIPTION_MODEL,
  ZZLIVE_TRANSCRIPTION_PROVIDER_ID,
} from '../../../libs/providers/providers/zzlive'
import { logWarn } from '../helpers'
import { buildOpenAICompatibleProvider } from '../openai-compatible-builder'

function singleModel(id: string, name: string, provider: string, description: string): ModelInfo[] {
  return [{ id, name, provider, description, contextLength: 0, deprecated: false }]
}

function zzliveConfig(config: Record<string, unknown>) {
  return {
    apiKey: typeof config.apiKey === 'string' ? config.apiKey : '',
    baseUrl: typeof config.baseUrl === 'string' ? config.baseUrl : '',
  }
}

export const zzliveMetadata: Record<string, ProviderMetadata> = {
  [ZZLIVE_SPEECH_PROVIDER_ID]: buildOpenAICompatibleProvider({
    id: ZZLIVE_SPEECH_PROVIDER_ID,
    order: -2,
    name: 'ZZLive',
    nameKey: 'settings.pages.providers.provider.zzlive.title',
    descriptionKey: 'settings.pages.providers.provider.zzlive-speech.description',
    icon: ZZLIVE_ICON,
    description: 'Kokoro, with the voices of Zoey and Zane.',
    category: 'speech',
    pricing: 'free',
    deployment: 'local',
    tasks: ['text-to-speech'],
    defaultBaseUrl: ZZLIVE_DEFAULT_BASE_URL,
    creator: createOpenAI,
    validation: ['model_list'],
    capabilities: {
      listModels: async () => singleModel(ZZLIVE_SPEECH_MODEL, 'Kokoro', ZZLIVE_SPEECH_PROVIDER_ID, 'Kokoro on the ZZLive server'),
      listVoices: async (config: Record<string, unknown>) => {
        try {
          return await listZzliveVoices(zzliveConfig(config))
        }
        catch (error) {
          logWarn('Failed to fetch ZZLive voices:', error)
          return []
        }
      },
    },
  }),
  [ZZLIVE_TRANSCRIPTION_PROVIDER_ID]: buildOpenAICompatibleProvider({
    id: ZZLIVE_TRANSCRIPTION_PROVIDER_ID,
    order: -2,
    name: 'ZZLive',
    nameKey: 'settings.pages.providers.provider.zzlive.title',
    descriptionKey: 'settings.pages.providers.provider.zzlive-transcription.description',
    icon: ZZLIVE_ICON,
    description: 'Whisper on the ZZLive server.',
    category: 'transcription',
    pricing: 'free',
    deployment: 'local',
    tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'],
    defaultBaseUrl: ZZLIVE_DEFAULT_BASE_URL,
    creator: createOpenAI,
    validation: ['model_list'],
    capabilities: {
      listModels: async () => singleModel(ZZLIVE_TRANSCRIPTION_MODEL, 'Whisper', ZZLIVE_TRANSCRIPTION_PROVIDER_ID, 'Whisper on the ZZLive server'),
    },
  }),
}
