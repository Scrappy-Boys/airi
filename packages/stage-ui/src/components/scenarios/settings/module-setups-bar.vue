<script setup lang="ts">
import type { SavedModuleSetup, SetupModuleId } from '../../../stores/module-setups'

import { errorMessageFrom } from '@moeru/std'
import { Button, FieldInput } from '@proj-airi/ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useModuleSetupsStore } from '../../../stores/module-setups'

const props = defineProps<{
  module: SetupModuleId
}>()

const { t } = useI18n()
const moduleSetups = useModuleSetupsStore()

const name = ref('')
const error = ref('')
const applyingId = ref('')

const saved = computed(() => moduleSetups.list(props.module))
const applied = computed(() => moduleSetups.appliedSetup(props.module))
const canSave = computed(() => !!name.value.trim() && !!moduleSetups.currentSelection(props.module).provider)

function describe(setup: SavedModuleSetup) {
  return [setup.provider, setup.model, setup.voiceId].filter(Boolean).join(' · ')
}

async function apply(setup: SavedModuleSetup) {
  error.value = ''
  applyingId.value = setup.id
  try {
    await moduleSetups.apply(props.module, setup.id)
  }
  catch (caught) {
    error.value = errorMessageFrom(caught) ?? ''
  }
  finally {
    applyingId.value = ''
  }
}

function save() {
  error.value = ''
  try {
    moduleSetups.save(props.module, name.value)
    name.value = ''
  }
  catch (caught) {
    error.value = errorMessageFrom(caught) ?? ''
  }
}
</script>

<template>
  <div
    :class="['mb-4 flex flex-col gap-3 rounded-lg p-4', 'bg-neutral-50 dark:bg-neutral-900/50', 'border border-neutral-200/50 dark:border-neutral-800/50']"
    :data-testid="`module-setups-${props.module}`"
  >
    <div :class="['flex flex-col gap-1']">
      <h2 :class="['text-lg text-neutral-500 md:text-2xl dark:text-neutral-500']">
        {{ t('settings.pages.modules.saved-setups.title') }}
      </h2>
      <span :class="['text-sm text-neutral-400 dark:text-neutral-400']">
        {{ t('settings.pages.modules.saved-setups.description') }}
      </span>
    </div>

    <ul v-if="saved.length > 0" :class="['flex flex-col gap-2']">
      <li
        v-for="setup in saved"
        :key="setup.id"
        :class="[
          'flex items-center gap-3 rounded-lg px-3 py-2',
          applied?.id === setup.id
            ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
            : 'bg-neutral-50 dark:bg-neutral-900/50 border border-transparent',
        ]"
      >
        <div :class="['flex min-w-0 flex-1 flex-col']">
          <span :class="['text-sm font-medium']">{{ setup.name }}</span>
          <span :class="['truncate text-xs text-neutral-500 dark:text-neutral-400']">{{ describe(setup) }}</span>
        </div>
        <span v-if="applied?.id === setup.id" :class="['text-xs text-primary-600 font-medium dark:text-primary-300']">
          {{ t('settings.pages.modules.saved-setups.applied') }}
        </span>
        <Button
          v-else
          size="sm"
          :label="t('settings.pages.modules.saved-setups.apply')"
          :loading="applyingId === setup.id"
          :disabled="!!applyingId"
          @click="apply(setup)"
        />
        <button
          type="button"
          :aria-label="t('settings.pages.modules.saved-setups.remove')"
          :class="['rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700/60']"
          @click="moduleSetups.remove(props.module, setup.id)"
        >
          <div i-solar:trash-bin-trash-bold-duotone :class="['text-base']" />
        </button>
      </li>
    </ul>
    <span v-else :class="['text-sm text-neutral-500 dark:text-neutral-400']">
      {{ t('settings.pages.modules.saved-setups.empty') }}
    </span>

    <div :class="['flex items-end gap-2']">
      <FieldInput
        v-model="name"
        :class="['flex-1']"
        :label="t('settings.pages.modules.saved-setups.name.label')"
        :placeholder="t('settings.pages.modules.saved-setups.name.placeholder')"
        @keydown.enter="canSave && save()"
      />
      <Button
        variant="secondary"
        :label="t('settings.pages.modules.saved-setups.save')"
        :disabled="!canSave"
        @click="save"
      />
    </div>
    <span v-if="error" :class="['text-xs text-red-500']">{{ error }}</span>
  </div>
</template>
