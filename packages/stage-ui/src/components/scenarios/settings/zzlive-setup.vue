<script setup lang="ts">
import type { ZzliveModelStatus, ZzlivePersona } from '../../../stores/zzlive'

import { errorMessageFrom } from '@moeru/std'
import { Button, Callout, Collapsible, FieldInput, Progress } from '@proj-airi/ui'
import { watchDebounced } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useZzliveStore, ZZLIVE_PERSONAS } from '../../../stores/zzlive'

const { t } = useI18n()
const zzlive = useZzliveStore()
const { launcherUrl, serverUrl, key, persona, status, phase, error, busy } = storeToRefs(zzlive)
const checkError = ref('')

const personaNames: Record<ZzlivePersona, string> = { zoey: 'Zoey', zane: 'Zane' }

const phaseLabel = computed(() => t(`settings.pages.modules.zzlive.phase.${phase.value}`))

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3)
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2)
    return `${Math.round(bytes / 1024 ** 2)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

function modelProgress(model: ZzliveModelStatus) {
  if (['present', 'done'].includes(model.state))
    return 100
  if (!model.total_bytes)
    return 0
  return Math.min(100, Math.round(model.done_bytes / model.total_bytes * 100))
}

function modelStateLabel(model: ZzliveModelStatus) {
  if (model.note)
    return model.note
  if (model.state === 'downloading' && model.total_bytes)
    return `${formatBytes(model.done_bytes)} / ${formatBytes(model.total_bytes)}`
  return t(`settings.pages.modules.zzlive.model-state.${model.state}`)
}

async function check() {
  checkError.value = ''
  try {
    await zzlive.checkSetup()
  }
  catch (caught) {
    checkError.value = errorMessageFrom(caught) ?? ''
  }
}

onMounted(() => {
  if (key.value.trim())
    void check()
})

watchDebounced(key, (value) => {
  if (value.trim())
    void check()
}, { debounce: 600 })
</script>

<template>
  <div :class="['flex flex-col gap-4 rounded-lg p-4', 'bg-neutral-50 dark:bg-neutral-900/50', 'border border-neutral-200/50 dark:border-neutral-800/50']">
    <div :class="['flex flex-col gap-1']">
      <h2 :class="['text-lg md:text-2xl']">
        {{ t('settings.pages.modules.zzlive.setup.title') }}
      </h2>
      <p :class="['text-sm text-neutral-500 dark:text-neutral-400']">
        {{ t('settings.pages.modules.zzlive.setup.description') }}
      </p>
    </div>

    <FieldInput
      v-model="key"
      type="password"
      :label="t('settings.pages.modules.zzlive.setup.key.label')"
      :description="t('settings.pages.modules.zzlive.setup.key.description')"
      placeholder="zz-..."
    />

    <div :class="['flex flex-col gap-2']">
      <span :class="['text-sm font-medium']">{{ t('settings.pages.modules.zzlive.setup.persona.label') }}</span>
      <div :class="['flex gap-2']" role="radiogroup">
        <Button
          v-for="item in ZZLIVE_PERSONAS"
          :key="item"
          role="radio"
          :aria-checked="persona === item"
          :variant="persona === item ? 'primary' : 'secondary'"
          size="sm"
          :label="personaNames[item]"
          @click="persona = item"
        />
      </div>
      <span :class="['text-xs text-neutral-500 dark:text-neutral-400']">{{ t('settings.pages.modules.zzlive.setup.persona.description') }}</span>
    </div>

    <div v-if="status" :class="['flex flex-col gap-3 rounded-lg p-3', 'bg-white/70 dark:bg-black/30']">
      <span :class="['text-sm font-medium']">{{ status.machine_label }}</span>
      <div v-for="model in status.models" :key="model.key" :class="['flex flex-col gap-1']">
        <div :class="['flex items-center justify-between gap-2 text-sm']">
          <span>{{ model.label }}</span>
          <span :class="['text-xs', model.state === 'failed' ? 'text-red-500' : 'text-neutral-500 dark:text-neutral-400']">{{ modelStateLabel(model) }}</span>
        </div>
        <Progress v-if="['waiting', 'downloading'].includes(model.state)" :progress="modelProgress(model)" />
        <span v-if="model.error" :class="['text-xs text-red-500']">{{ model.error }}</span>
      </div>
      <span v-if="status.missing_bytes > 0" :class="['text-xs text-neutral-500 dark:text-neutral-400']">
        {{ t('settings.pages.modules.zzlive.setup.download-size', { size: formatBytes(status.missing_bytes) }) }}
      </span>
    </div>

    <Callout v-if="checkError && !error" theme="orange" :label="t('settings.pages.modules.zzlive.setup.not-reached')">
      {{ checkError }}
    </Callout>
    <Callout v-if="error" theme="orange" :label="t('settings.pages.modules.zzlive.phase.error')">
      <span :class="['whitespace-pre-line']">{{ error }}</span>
    </Callout>
    <Callout v-else-if="phase === 'done'" theme="lime" :label="t('settings.pages.modules.zzlive.phase.done')">
      {{ t('settings.pages.modules.zzlive.setup.done', { name: personaNames[persona] }) }}
    </Callout>

    <div :class="['flex flex-wrap items-center gap-3']">
      <Button
        icon="i-solar:magic-stick-3-bold-duotone"
        :label="t('settings.pages.modules.zzlive.setup.apply')"
        :loading="busy"
        :disabled="busy || !key.trim()"
        @click="zzlive.runSetup()"
      />
      <Button variant="secondary" :label="t('settings.pages.modules.zzlive.setup.check')" :disabled="busy || !key.trim()" @click="check" />
      <span v-if="busy" :class="['text-sm text-neutral-500 dark:text-neutral-400']">{{ phaseLabel }}</span>
    </div>

    <Collapsible :label="t('settings.pages.modules.zzlive.setup.advanced')">
      <div :class="['flex flex-col gap-4 pt-2']">
        <FieldInput
          v-model="launcherUrl"
          :label="t('settings.pages.modules.zzlive.setup.launcher-url.label')"
          :description="t('settings.pages.modules.zzlive.setup.launcher-url.description')"
        />
        <FieldInput
          v-model="serverUrl"
          :label="t('settings.pages.modules.zzlive.setup.server-url.label')"
          :description="t('settings.pages.modules.zzlive.setup.server-url.description')"
        />
      </div>
    </Collapsible>
  </div>
</template>
