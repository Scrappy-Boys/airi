<script setup lang="ts">
import type { TranscriptionProviderWithExtraOptions } from '@xsai-ext/providers/utils'

import {
  TranscriptionPlayground,
  TranscriptionProviderSettings,
} from '@proj-airi/stage-ui/components'
import { ZZLIVE_TRANSCRIPTION_MODEL, ZZLIVE_TRANSCRIPTION_PROVIDER_ID } from '@proj-airi/stage-ui/libs/providers/providers/zzlive'
import { useHearingStore } from '@proj-airi/stage-ui/stores/modules/hearing'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

const hearingStore = useHearingStore()
const providersStore = useProvidersStore()
const { providers } = storeToRefs(providersStore)

const providerId = ZZLIVE_TRANSCRIPTION_PROVIDER_ID
const apiKeyConfigured = computed(() => !!providers.value[providerId]?.apiKey)

async function handleGenerateTranscription(file: File) {
  const provider = await providersStore.getProviderInstance<TranscriptionProviderWithExtraOptions<string, any>>(providerId)
  if (!provider)
    throw new Error('Failed to initialize transcription provider')

  return await hearingStore.transcription(providerId, provider, ZZLIVE_TRANSCRIPTION_MODEL, file, 'json')
}
</script>

<template>
  <TranscriptionProviderSettings :provider-id="providerId" :default-model="ZZLIVE_TRANSCRIPTION_MODEL">
    <template #playground>
      <TranscriptionPlayground
        :generate-transcription="handleGenerateTranscription"
        :api-key-configured="apiKeyConfigured"
      />
    </template>
  </TranscriptionProviderSettings>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.providers.provider.zzlive.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.providers.provider.zzlive-transcription.description
  stageTransition:
    name: slide
</route>
