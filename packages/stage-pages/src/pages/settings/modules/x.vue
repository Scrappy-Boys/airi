<script setup lang="ts">
import { X } from '@proj-airi/stage-ui/components'
import { useTwitterStore } from '@proj-airi/stage-ui/stores/modules/twitter'
import ModuleActionBar from './components/ModuleActionBar.vue'

const twitterStore = useTwitterStore()

function applyModule() {
  twitterStore.saveSettings()
  return 'X (Twitter) settings applied'
}

function testModule() {
  if (!twitterStore.configured)
    throw new Error('API key, API secret, access token and access token secret are all required')
  return 'Credentials are filled in (not verified against the X API)'
}
</script>

<template>
<div class="flex flex-col gap-4">
<ModuleActionBar :apply="applyModule" :test="testModule" />
  <X />
</div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.x.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>
