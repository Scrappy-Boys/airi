<script setup lang="ts">
import { MessagingFriends } from '@proj-airi/stage-ui/components'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { storeToRefs } from 'pinia'
import ModuleActionBar from './components/ModuleActionBar.vue'

const { activeCardId: moduleCardId } = storeToRefs(useAiriCardStore())

function applyModule() {
  return 'Friends settings applied'
}

function testModule() {
  if (!moduleCardId.value)
    throw new Error('No active character card, friends cannot be scoped')
  return 'Active character card found'
}
</script>

<template>
<div class="flex flex-col gap-4">
<ModuleActionBar :apply="applyModule" :test="testModule" />
  <MessagingFriends />
</div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.messaging-friends.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>
