import type { VoiceInfo } from '../../types'

import z from 'zod'

import { createChatProvider, createModelProvider, merge } from '@xsai-ext/providers/utils'

import { createOpenAICompatibleValidators } from '../../validators/openai-compatible'
import { defineProvider } from '../registry'

/**
 * ZZLive is a Python server that runs Zoey and Zane, two AI characters with their own memory.
 * Its `/v1/` routes speak the OpenAI format. They answer chat with a character's memory and
 * persona, speech with Kokoro, and transcription with Whisper.
 *
 * Source: https://github.com/Scrappy-Boys/ZZLive (`server/airi_routes.py`).
 */
export const ZZLIVE_CHAT_PROVIDER_ID = 'zzlive'
export const ZZLIVE_SPEECH_PROVIDER_ID = 'zzlive-speech'
export const ZZLIVE_TRANSCRIPTION_PROVIDER_ID = 'zzlive-transcription'
export const ZZLIVE_DEFAULT_BASE_URL = 'http://127.0.0.1:8080/v1/'
export const ZZLIVE_SPEECH_MODEL = 'kokoro'
export const ZZLIVE_TRANSCRIPTION_MODEL = 'whisper'
export const ZZLIVE_ICON = 'i-solar:users-group-two-rounded-bold-duotone'

export interface ZzliveConfig {
  apiKey?: string
  baseUrl?: string
}

/** Returns the base URL with the trailing slash that the OpenAI clients need. */
export function normalizeZzliveBaseUrl(baseUrl: string | undefined) {
  const value = baseUrl?.trim() || ZZLIVE_DEFAULT_BASE_URL
  return value.endsWith('/') ? value : `${value}/`
}

interface ZzliveVoice {
  id: string
  name: string
  kokoro_voice?: string
}

/** Reads the voices of the characters from `GET /v1/audio/voices`. */
export async function listZzliveVoices(config: ZzliveConfig, signal?: AbortSignal): Promise<VoiceInfo[]> {
  const response = await globalThis.fetch(`${normalizeZzliveBaseUrl(config.baseUrl)}audio/voices`, {
    headers: { Authorization: `Bearer ${config.apiKey?.trim() ?? ''}` },
    signal,
  })
  if (!response.ok)
    throw new Error(`ZZLive did not list its voices (${response.status}): ${(await response.text().catch(() => '')).slice(0, 200)}`)

  const body = await response.json() as { voices?: ZzliveVoice[] }
  return (body.voices ?? []).map(voice => ({
    id: voice.id,
    name: voice.name,
    provider: ZZLIVE_SPEECH_PROVIDER_ID,
    description: voice.kokoro_voice ? `Kokoro ${voice.kokoro_voice}` : undefined,
    compatibleModels: [ZZLIVE_SPEECH_MODEL],
    languages: [{ code: 'en', title: 'English' }],
  }))
}

const zzliveConfigSchema = z.object({
  apiKey: z
    .string('ZZLive key')
    .optional(),
  baseUrl: z
    .string('Base URL')
    .optional()
    .default(ZZLIVE_DEFAULT_BASE_URL),
})

export const providerZzlive = defineProvider<z.input<typeof zzliveConfigSchema>>({
  id: ZZLIVE_CHAT_PROVIDER_ID,
  order: -2,
  name: 'ZZLive',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.zzlive.title'),
  description: 'Zoey and Zane, with their own memory, on your own computer.',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.zzlive.description'),
  tasks: ['chat'],
  icon: ZZLIVE_ICON,

  createProviderConfig: ({ t }) => zzliveConfigSchema.extend({
    apiKey: zzliveConfigSchema.shape.apiKey.meta({
      labelLocalized: t('settings.pages.providers.provider.zzlive.fields.key.label'),
      descriptionLocalized: t('settings.pages.providers.provider.zzlive.fields.key.description'),
      placeholderLocalized: 'zz-...',
      type: 'password',
    }),
    baseUrl: zzliveConfigSchema.shape.baseUrl.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
      descriptionLocalized: t('settings.pages.providers.provider.zzlive.fields.base-url.description'),
      placeholderLocalized: ZZLIVE_DEFAULT_BASE_URL,
    }),
  }),
  createProvider(config) {
    const options = { apiKey: config.apiKey?.trim() ?? '', baseURL: normalizeZzliveBaseUrl(config.baseUrl) }
    return merge(
      createChatProvider(options),
      createModelProvider(options),
    )
  },

  validationRequiredWhen(config) {
    return !!config.apiKey?.trim()
  },
  validators: {
    ...createOpenAICompatibleValidators({
      checks: ['connectivity', 'model_list'],
      connectivityFailureReason: ({ errorMessage }) =>
        `ZZLive did not answer (${errorMessage}). Start it with start.bat on Windows or ./start.sh on a Mac, and check the key from http://127.0.0.1:8070.`,
    }),
  },
  business: () => ({
    pricing: 'free',
    deployment: 'local',
  }),
})
