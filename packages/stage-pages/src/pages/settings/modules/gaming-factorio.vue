<script setup lang="ts">
import { GamingFactorio } from '@proj-airi/stage-ui/components'
import { useFactorioStore } from '@proj-airi/stage-ui/stores/modules/gaming-factorio'
import ModuleActionBar from './components/ModuleActionBar.vue'

const factorioStore = useFactorioStore()

function applyModule() {
  factorioStore.saveSettings()
  return 'Factorio settings applied'
}

function testModule() {
  if (!factorioStore.configured)
    throw new Error('Server address, port and username are required')
  return 'Configuration is complete (no live game-server probe for this module)'
}
</script>

<template>
<div class="flex flex-col gap-4">
<ModuleActionBar :apply="applyModule" :test="testModule" />
  <GamingFactorio />
</div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.gaming-factorio.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>
