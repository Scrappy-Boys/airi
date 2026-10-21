<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

/**
 * Result a handler may return. A plain string is treated as a success message;
 * throw (or return `{ ok: false }`) to report a failure.
 */
export type ModuleActionResult = string | void | { ok: boolean, message?: string }

const props = defineProps<{
  /** Persist + activate the module with its current settings. Hidden when omitted. */
  apply?: () => Promise<ModuleActionResult> | ModuleActionResult
  /** Run a real connectivity / health check. Hidden when omitted. */
  test?: () => Promise<ModuleActionResult> | ModuleActionResult
  disabled?: boolean
}>()

type Kind = 'apply' | 'test'

const busy = ref<Kind | null>(null)
const status = ref<{ kind: Kind, ok: boolean, message: string } | null>(null)

async function run(kind: Kind) {
  const handler = props[kind]
  if (!handler || busy.value)
    return

  busy.value = kind
  status.value = null
  try {
    const result = await handler()
    const ok = typeof result === 'object' && result !== null ? result.ok : true
    const message = typeof result === 'string'
      ? result
      : (typeof result === 'object' && result !== null && result.message)
          || (kind === 'apply' ? 'Applied' : 'Test passed')
    status.value = { kind, ok, message }
    if (kind === 'apply' && ok)
      toast.success(message)
  }
  catch (err) {
    status.value = { kind, ok: false, message: err instanceof Error ? err.message : String(err) }
  }
  finally {
    busy.value = null
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-3 rounded-xl bg-neutral-100 px-4 py-3 dark:bg-[rgba(0,0,0,0.3)]">
    <Button
      v-if="apply"
      label="Apply"
      icon="i-solar:check-circle-bold"
      :loading="busy === 'apply'"
      :disabled="disabled || busy !== null"
      @click="run('apply')"
    />
    <Button
      v-if="test"
      label="Test"
      icon="i-solar:play-circle-bold"
      variant="secondary"
      :loading="busy === 'test'"
      :disabled="disabled || busy !== null"
      @click="run('test')"
    />

    <div
      v-if="status"
      class="flex items-center gap-1.5 text-sm"
      :class="status.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'"
    >
      <div :class="status.ok ? 'i-solar:check-circle-bold' : 'i-solar:danger-circle-bold'" />
      <span>{{ status.message }}</span>
    </div>
  </div>
</template>
