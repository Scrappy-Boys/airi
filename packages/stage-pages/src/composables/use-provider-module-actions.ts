import type { Ref } from 'vue'

import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'

/**
 * Apply / Test handlers for modules driven by a single active provider
 * (consciousness, speech, hearing, vision, system-one).
 *
 * Settings are already persisted as they change, so Apply re-activates the
 * module: it force re-validates the provider and reloads its model list.
 * Test only force re-validates, without touching the cached model list.
 */
export function useProviderModuleActions(activeProvider: Ref<string>) {
  const providersStore = useProvidersStore()

  async function validate() {
    const id = activeProvider.value
    if (!id)
      throw new Error('No provider selected')

    const ok = await providersStore.validateProvider(id, { force: true })
    if (!ok)
      throw new Error(`Provider "${id}" failed validation, check its credentials and endpoint`)
    return id
  }

  async function test() {
    const id = await validate()
    return `Provider "${id}" is reachable`
  }

  async function apply() {
    const id = await validate()
    if (providersStore.getProviderMetadata(id)?.capabilities.listModels)
      await providersStore.fetchModelsForProvider(id)
    return `Applied provider "${id}"`
  }

  return { apply, test }
}
