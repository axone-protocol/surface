import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

import {
  dedupeSurfaceActs,
  mapTxToSurfaceActs,
  moduleContractAddresses,
  moduleAdministratorsFromInstallations,
  sortSurfaceActs,
} from '../domain/surface-act-mapper'
import {
  fetchExecuteContractTxs,
  fetchInstantiateContract2Txs,
  resolveModuleAdministrators,
  resolveTransactionEntries,
} from '../infra/axone-tx-api'
import type { SurfaceAct } from '../domain/surface-act'
import type { CosmosTxResponse } from '../infra/axone-event-extractor'

type UseSurfaceActsState = {
  acts: Ref<SurfaceAct[]>
  loading: Ref<boolean>
  error: Ref<string | undefined>
  polling: Ref<boolean>
}

const pollIntervalMs = 15000
const registerActWindowSize = 5

function normalizeActs(current: SurfaceAct[], incoming: SurfaceAct[]) {
  return sortSurfaceActs(dedupeSurfaceActs([...incoming, ...current])).slice(
    0,
    registerActWindowSize,
  )
}

function attachEntries(acts: SurfaceAct[], entriesByTxHash: Map<string, string>) {
  return acts.flatMap((act) => {
    const entryPrefix = entriesByTxHash.get(act.txhash)
    return entryPrefix ? [{ ...act, entry: `${entryPrefix}.${act.msgIndex}` }] : []
  })
}

function retainedTransactionResponses(acts: SurfaceAct[], txs: CosmosTxResponse[]) {
  const unverifiedHashes = new Set(acts.filter((act) => !act.entry).map((act) => act.txhash))
  return txs.filter((tx) => unverifiedHashes.has(tx.txhash ?? ''))
}

function mergeAndNormalizeActs(
  current: SurfaceAct[],
  incoming: SurfaceAct[],
  entriesByTxHash: Map<string, string>,
) {
  return normalizeActs(current, attachEntries(incoming, entriesByTxHash))
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unable to read the chain register.'
}

export function useSurfaceActs(): UseSurfaceActsState {
  const acts = ref<SurfaceAct[]>([])
  const loading = ref(true)
  const error = ref<string | undefined>()
  const polling = ref(false)

  let pollTimer: number | undefined
  let active = true
  let inFlight = false

  async function sync(initial = false) {
    if (!active || inFlight) {
      return
    }

    inFlight = true
    loading.value = initial && acts.value.length === 0
    polling.value = !initial

    try {
      const [instantiateTxs, executeTxs] = await Promise.all([
        fetchInstantiateContract2Txs(),
        fetchExecuteContractTxs(),
      ])

      const txResponses = [...instantiateTxs.txResponses, ...executeTxs.txResponses]
      const installedModuleAdministrators = moduleAdministratorsFromInstallations(txResponses)
      const unresolvedModuleAddresses = moduleContractAddresses(txResponses).filter(
        (address) => !installedModuleAdministrators.has(address),
      )
      const queriedModuleAdministrators =
        await resolveModuleAdministrators(unresolvedModuleAddresses)
      const moduleAdministrators = new Map([
        ...installedModuleAdministrators,
        ...queriedModuleAdministrators,
      ])
      const incomingActs = txResponses.flatMap((tx) => mapTxToSurfaceActs(tx, moduleAdministrators))
      const retainedActs = normalizeActs(acts.value, incomingActs)
      const retainedTxResponses = retainedTransactionResponses(retainedActs, txResponses)
      const entriesByTxHash = await resolveTransactionEntries(retainedTxResponses)
      if (retainedTxResponses.length > 0 && entriesByTxHash.size === 0) {
        throw new Error('Chain register temporarily unavailable.')
      }
      const currentActs = mergeAndNormalizeActs(acts.value, incomingActs, entriesByTxHash)
      acts.value = currentActs
      error.value = undefined
    } catch (caught) {
      error.value = normalizeError(caught)
    } finally {
      inFlight = false
      loading.value = false
      polling.value = false
      if (active) {
        pollTimer = window.setTimeout(() => {
          void sync()
        }, pollIntervalMs)
      }
    }
  }

  onMounted(() => {
    void sync(true)
  })

  onBeforeUnmount(() => {
    active = false
    window.clearTimeout(pollTimer)
  })

  return {
    acts,
    loading,
    error,
    polling,
  }
}
