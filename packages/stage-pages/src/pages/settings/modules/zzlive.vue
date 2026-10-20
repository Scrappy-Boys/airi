<script setup lang="ts">
import { ModuleSetupsBar, ZzliveSetup } from '@proj-airi/stage-ui/components'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div :class="['w-full flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto']">
    <div :class="['flex flex-col gap-1']">
      <h1 :class="['text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2.5']">
        <div :class="['i-solar:users-group-two-rounded-bold-duotone text-primary-500 h-6 w-6 flex-shrink-0']" />
        <span>{{ t('settings.pages.modules.zzlive.title') }}</span>
      </h1>
      <p :class="['text-xs sm:text-sm text-neutral-500 dark:text-neutral-400']">
        {{ t('settings.pages.modules.zzlive.description') }}
      </p>
    </div>

    <ZzliveSetup />
    <p :class="['px-1 text-sm text-neutral-500 dark:text-neutral-400']">
      {{ t('settings.pages.modules.zzlive.switch-back') }}
    </p>
    <ModuleSetupsBar module="consciousness" />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.zzlive.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
