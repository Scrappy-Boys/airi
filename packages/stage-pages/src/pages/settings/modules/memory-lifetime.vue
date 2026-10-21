<script setup lang="ts">
import LifetimeMemoryView from './components/LifetimeMemoryView.vue'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { storeToRefs } from 'pinia'
import ModuleActionBar from './components/ModuleActionBar.vue'

const { activeCardId: moduleCardId } = storeToRefs(useAiriCardStore())

function applyModule() {
  return 'Memory settings applied'
}

function testModule() {
  if (!moduleCardId.value)
    throw new Error('No active character card, memory cannot be scoped')
  return 'Active character card found'
}
</script>

<template>
<div class="flex flex-col gap-4">
<ModuleActionBar :apply="applyModule" :test="testModule" />
  <div class="relative flex flex-col pb-12">
    <LifetimeMemoryView show-breadcrumb show-change-character />
  </div>
</div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: The Eternal Thread
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
