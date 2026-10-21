<script setup lang="ts">
import { MessagingDiscord } from '@proj-airi/stage-ui/components'
import { useDiscordStore } from '@proj-airi/stage-ui/stores/modules/discord'
import ModuleActionBar from './components/ModuleActionBar.vue'

const discordStore = useDiscordStore()

async function applyModule() {
  if (!discordStore.configured)
    throw new Error('Discord bot token is not configured')
  if (discordStore.enabled)
    await discordStore.startService()
  return discordStore.enabled ? 'Discord service (re)started' : 'Discord settings saved (module is disabled)'
}

async function testModule() {
  if (!discordStore.configured)
    throw new Error('Discord bot token is not configured')
  await discordStore.refreshStatus()
  if (!discordStore.isConnected)
    throw new Error('Discord service is not connected')
  return 'Discord service is connected'
}
</script>

<template>
<div class="flex flex-col gap-4">
<ModuleActionBar :apply="applyModule" :test="testModule" />
  <MessagingDiscord />
</div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.messaging-discord.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>
