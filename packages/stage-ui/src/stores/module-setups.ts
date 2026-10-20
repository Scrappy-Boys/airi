import { useLocalStorage } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'

import { useFacultyDefaultsStore } from './faculty-defaults'
import { useConsciousnessStore } from './modules/consciousness'
import { useHearingStore } from './modules/hearing-store'
import { useSpeechStore } from './modules/speech'
import { useVisionStore } from './modules/vision'

/** Modules whose provider and model selection can be saved and applied again. */
export type SetupModuleId = 'consciousness' | 'speech' | 'hearing' | 'vision'

/** One module selection. Only speech uses `voiceId`. */
export interface ModuleSelection {
  provider: string
  model: string
  voiceId?: string
}

/** A named module selection that the user saved, or that a preset such as ZZLive wrote. */
export interface SavedModuleSetup extends ModuleSelection {
  id: string
  name: string
  /** Set when a preset owns this setup. Applying the preset again replaces it. */
  preset?: string
  savedAt: string
}

export type SavedModuleSetups = Record<SetupModuleId, SavedModuleSetup[]>

export const SETUP_MODULE_IDS: readonly SetupModuleId[] = ['consciousness', 'speech', 'hearing', 'vision']

function emptySetups(): SavedModuleSetups {
  return { consciousness: [], speech: [], hearing: [], vision: [] }
}

/** Returns true when two selections choose the same provider, model, and voice. */
export function isSameSelection(module: SetupModuleId, a: ModuleSelection, b: ModuleSelection) {
  return a.provider === b.provider
    && a.model === b.model
    && (module !== 'speech' || (a.voiceId ?? '') === (b.voiceId ?? ''))
}

/**
 * Keeps named setups for each module, so the user can switch between them with one Apply button.
 * For example, a user can keep "ZZLive" and "Cloud" setups for chat and switch at any time.
 *
 * Saved setups stay in this device only. Applying a setup writes the module store, the same way
 * the module settings pages do, and the primary choice of the global faculty defaults.
 *
 * NOTICE: A character card that names its own provider for a module still applies that
 * provider when the card is activated (`airi-card.ts#syncCardState`). Cards without their own
 * module choice keep the applied setup.
 */
export const useModuleSetupsStore = defineStore('module-setups', () => {
  const setups = useLocalStorage<SavedModuleSetups>('settings/module-setups', emptySetups(), { mergeDefaults: true })

  function currentSelection(module: SetupModuleId): ModuleSelection {
    switch (module) {
      case 'consciousness': {
        const store = useConsciousnessStore()
        return { provider: store.activeProvider, model: store.activeModel }
      }
      case 'speech': {
        const store = useSpeechStore()
        return { provider: store.activeSpeechProvider, model: store.activeSpeechModel, voiceId: store.activeSpeechVoiceId }
      }
      case 'hearing': {
        const store = useHearingStore()
        return { provider: store.activeTranscriptionProvider, model: store.activeTranscriptionModel }
      }
      case 'vision': {
        const store = useVisionStore()
        return { provider: store.activeProvider, model: store.activeModel }
      }
    }
  }

  function list(module: SetupModuleId) {
    return setups.value[module] ?? []
  }

  /** Returns the saved setup that matches the current selection of the module. */
  function appliedSetup(module: SetupModuleId) {
    const current = currentSelection(module)
    return list(module).find(setup => isSameSelection(module, setup, current))
  }

  /** Saves a selection under a name. A setup with the same name or preset is replaced. */
  function save(module: SetupModuleId, name: string, selection: ModuleSelection = currentSelection(module), preset?: string) {
    const trimmed = name.trim()
    if (!trimmed)
      throw new Error('A saved setup needs a name.')
    if (!selection.provider)
      throw new Error('Choose a provider before you save this setup.')

    const others = list(module).filter(setup => setup.name !== trimmed && (!preset || setup.preset !== preset))
    const setup: SavedModuleSetup = {
      id: nanoid(),
      name: trimmed,
      provider: selection.provider,
      model: selection.model,
      ...(module === 'speech' ? { voiceId: selection.voiceId ?? '' } : {}),
      ...(preset ? { preset } : {}),
      savedAt: new Date().toISOString(),
    }
    setups.value = { ...setups.value, [module]: [...others, setup] }
    return setup
  }

  function remove(module: SetupModuleId, id: string) {
    setups.value = { ...setups.value, [module]: list(module).filter(setup => setup.id !== id) }
  }

  /** Writes a selection to the module store and to the global faculty defaults. */
  async function applySelection(module: SetupModuleId, selection: ModuleSelection) {
    // The faculty defaults also write the legacy localStorage keys, so they go before the stores.
    useFacultyDefaultsStore().setPrimary(module, selection.provider, selection.model, module === 'speech' ? selection.voiceId ?? '' : undefined)

    // Each store loads the models (and voices) of a new provider by itself when the provider changes.
    switch (module) {
      case 'consciousness': {
        const store = useConsciousnessStore()
        store.activeProvider = selection.provider
        store.activeModel = selection.model
        break
      }
      case 'speech': {
        const store = useSpeechStore()
        store.activeSpeechProvider = selection.provider
        store.activeSpeechModel = selection.model
        store.activeSpeechVoiceId = selection.voiceId ?? ''
        break
      }
      case 'hearing': {
        const store = useHearingStore()
        store.activeTranscriptionProvider = selection.provider
        store.activeTranscriptionModel = selection.model
        store.activeCustomModelName = ''
        break
      }
      case 'vision': {
        const store = useVisionStore()
        store.activeProvider = selection.provider
        store.activeModel = selection.model
        break
      }
    }
  }

  async function apply(module: SetupModuleId, id: string) {
    const setup = list(module).find(item => item.id === id)
    if (!setup)
      throw new Error('That saved setup does not exist any more.')
    await applySelection(module, setup)
    return setup
  }

  function resetState() {
    setups.value = emptySetups()
  }

  return {
    setups,
    list,
    currentSelection,
    appliedSetup,
    save,
    remove,
    apply,
    applySelection,
    resetState,
  }
})
