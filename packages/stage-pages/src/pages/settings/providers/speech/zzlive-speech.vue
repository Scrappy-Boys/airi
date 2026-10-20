<script setup lang="ts">
import type { SpeechProviderWithExtraOptions } from '@xsai-ext/providers/utils'

import {
  SpeechPlayground,
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { ZZLIVE_SPEECH_MODEL, ZZLIVE_SPEECH_PROVIDER_ID } from '@proj-airi/stage-ui/libs/providers/providers/zzlive'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const speechStore = useSpeechStore()
const providersStore = useProvidersStore()
const { providers } = storeToRefs(providersStore)

const providerId = ZZLIVE_SPEECH_PROVIDER_ID
const apiKeyConfigured = computed(() => !!providers.value[providerId]?.apiKey)
const availableVoices = computed(() => speechStore.availableVoices[providerId] || [])

async function handleGenerateSpeech(input: string, voiceId: string, _useSSML: boolean) {
  const provider = await providersStore.getProviderInstance(providerId) as SpeechProviderWithExtraOptions<string>
  if (!provider)
    throw new Error('Failed to initialize speech provider')

  return await speechStore.speech(provider, ZZLIVE_SPEECH_MODEL, input, voiceId, providersStore.getProviderConfig(providerId))
}

// The voices are the characters of the ZZLive server, so they load once the key is there.
watch(apiKeyConfigured, async (configured) => {
  if (configured)
    await speechStore.loadVoicesForProvider(providerId)
}, { immediate: true })
</script>

<template>
  <SpeechProviderSettings :provider-id="providerId" :default-model="ZZLIVE_SPEECH_MODEL">
    <template #playground>
      <SpeechPlayground
        :available-voices="availableVoices"
        :generate-speech="handleGenerateSpeech"
        :api-key-configured="apiKeyConfigured"
        :default-text="t('settings.pages.providers.provider.zzlive-speech.playground-text')"
      />
    </template>
  </SpeechProviderSettings>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.providers.provider.zzlive.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.providers.provider.zzlive-speech.description
  stageTransition:
    name: slide
</route>
