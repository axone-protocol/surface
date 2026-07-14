import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

import {
  dedupeSurfaceActs,
  mapTxToSurfaceActs,
  sortSurfaceActs,
} from '../domain/surface-act-mapper'
import {
  fetchExecuteContractTxs,
  fetchInstantiateContract2Txs,
  resolveTransactionEntries,
} from '../infra/axone-tx-api'
import type { SurfaceAct } from '../domain/surface-act'
import type { CosmosTxResponse } from '../infra/axone-event-extractor'

type UseSurfaceActsState = {
  acts: Ref<SurfaceAct[]>
  loading: Ref<boolean>
  error: Ref<string | undefined>
  lastSync: Ref<Date | undefined>
  polling: Ref<boolean>
  total: Ref<number | undefined>
}

const pollIntervalMs = 15000
const registerActWindowSize = 5

function mergeAndNormalizeActs(
  current: SurfaceAct[],
  txs: CosmosTxResponse[],
  entriesByTxHash: Map<string, string>,
) {
  const incomingActs = txs.flatMap((tx) => {
    const entryPrefix = entriesByTxHash.get(tx.txhash ?? '')
    if (!entryPrefix) {
      return []
    }

    return mapTxToSurfaceActs(tx).map((act) => ({
      ...act,
      entry: `${entryPrefix}.${act.msgIndex}`,
    }))
  })
  return sortSurfaceActs(dedupeSurfaceActs([...incomingActs, ...current])).slice(
    0,
    registerActWindowSize,
  )
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
  const lastSync = ref<Date | undefined>()
  const polling = ref(false)
  const total = ref<number | undefined>()

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
      const entriesByTxHash = await resolveTransactionEntries(txResponses)
      if (txResponses.length > 0 && entriesByTxHash.size === 0) {
        throw new Error('Chain register temporarily unavailable.')
      }
      const currentActs = mergeAndNormalizeActs(acts.value, txResponses, entriesByTxHash)
      acts.value = currentActs
      total.value = (instantiateTxs.total || 0) + (executeTxs.total || 0)
      lastSync.value = new Date()
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
    lastSync,
    polling,
    total,
  }
}
