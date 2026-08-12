import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

import {
  docketEntryTimestamp,
  type DocketSessionEntry,
  type IdentityDocketEntry,
  type NewIdentityDocketEntry,
  type SurfaceDocketEntry,
} from '../domain/surface-docket'
import type { SurfaceAct } from '../domain/surface-act'
import type { WalletProviderId } from '../domain/wallet-connection'
import { fetchIdentityTransactionResult } from '../infra/identity-transaction-api'
import { networks, type Network } from '../networks'

const observationIntervalMs = 5_000
const unresolvedAfterMs = 5 * 60_000
const unresolvedAfterFailures = 3

export type DocketSessionContext = {
  provider: WalletProviderId
  controller: string
  chainId: string
}

function docketId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `docket-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function networkForChain(chainId: string): Network | undefined {
  return networks.find((network) => network.chainId === chainId)
}

function eventFrom(
  entry: IdentityDocketEntry,
  update: Pick<NewIdentityDocketEntry, 'situation' | 'height' | 'error'>,
): NewIdentityDocketEntry {
  return {
    name: entry.name,
    description: entry.description,
    controller: entry.controller,
    provider: entry.provider,
    networkKey: entry.networkKey,
    chainId: entry.chainId,
    explorer: entry.explorer,
    transactionHash: entry.transactionHash,
    ...update,
  }
}

export function useSurfaceDocket(acts: Readonly<Ref<SurfaceAct[]>>) {
  const entries = ref<SurfaceDocketEntry[]>([])
  const observing = new Set<string>()
  const observationFailures = new Map<string, number>()
  let observationTimer: number | undefined
  let observationAbortController: AbortController | undefined

  const orderedEntries = computed(() =>
    [...entries.value].sort(
      (left, right) =>
        Date.parse(docketEntryTimestamp(right)) - Date.parse(docketEntryTimestamp(left)),
    ),
  )

  function appendIdentityEvent(
    event: Omit<NewIdentityDocketEntry, 'situation'> & {
      situation: NewIdentityDocketEntry['situation']
    },
  ): IdentityDocketEntry {
    const entry: IdentityDocketEntry = {
      ...event,
      id: docketId(),
      type: 'identity-creation',
      occurredAt: new Date().toISOString(),
    }
    entries.value = [...entries.value, entry]
    return entry
  }

  function hasSituation(transactionHash: string, situation: IdentityDocketEntry['situation']) {
    return entries.value.some(
      (entry) =>
        entry.type === 'identity-creation' &&
        entry.transactionHash === transactionHash &&
        entry.situation === situation,
    )
  }

  function recordSessionTransition(
    previous: DocketSessionContext | undefined,
    current: DocketSessionContext | undefined,
  ) {
    if (!previous && !current) {
      return
    }

    const context = current ?? previous!
    const network = networkForChain(context.chainId)
    const occurredAt = new Date().toISOString()
    let entry: DocketSessionEntry

    if (!previous && current) {
      entry = {
        id: docketId(),
        type: 'session',
        occurredAt,
        event: 'connected',
        provider: current.provider,
        controller: current.controller,
        chainId: current.chainId,
        explorer: network?.explorer,
      }
    } else if (previous && !current) {
      entry = {
        id: docketId(),
        type: 'session',
        occurredAt,
        event: 'disconnected',
        provider: previous.provider,
        previousController: previous.controller,
        chainId: previous.chainId,
        explorer: network?.explorer,
      }
    } else {
      if (
        previous!.controller === current!.controller &&
        previous!.provider === current!.provider &&
        previous!.chainId === current!.chainId
      ) {
        return
      }
      entry = {
        id: docketId(),
        type: 'session',
        occurredAt,
        event: 'controller-changed',
        provider: current!.provider,
        controller: current!.controller,
        previousController: previous!.controller,
        chainId: current!.chainId,
        explorer: network?.explorer,
      }
    }

    entries.value = [...entries.value, entry]
  }

  async function observeSubmittedTransaction(id: string) {
    const entry = entries.value.find(
      (candidate): candidate is IdentityDocketEntry =>
        candidate.type === 'identity-creation' &&
        candidate.id === id &&
        candidate.situation === 'transaction-submitted',
    )
    if (!entry?.transactionHash || observing.has(id)) {
      return
    }

    const network = networkForChain(entry.chainId)
    if (!network?.api) {
      if (!hasSituation(entry.transactionHash, 'transaction-unresolved')) {
        appendIdentityEvent(
          eventFrom(entry, {
            situation: 'transaction-unresolved',
            error: 'Transaction observation is unavailable for this network.',
          }),
        )
      }
      return
    }

    observing.add(id)
    try {
      const result = await fetchIdentityTransactionResult(
        network.api,
        entry.transactionHash,
        observationAbortController?.signal,
      )

      if (result.status === 'pending') {
        if (
          Date.now() - Date.parse(entry.occurredAt) >= unresolvedAfterMs &&
          !hasSituation(entry.transactionHash, 'transaction-unresolved')
        ) {
          appendIdentityEvent(
            eventFrom(entry, {
              situation: 'transaction-unresolved',
              error: 'Surface could not confirm the transaction result.',
            }),
          )
        }
      } else if (result.status === 'succeeded') {
        if (!hasSituation(entry.transactionHash, 'transaction-executed')) {
          appendIdentityEvent(
            eventFrom(entry, { situation: 'transaction-executed', height: result.height }),
          )
        }
      } else if (!hasSituation(entry.transactionHash, 'transaction-failed')) {
        appendIdentityEvent(
          eventFrom(entry, {
            situation: 'transaction-failed',
            height: result.height,
            error: result.error,
          }),
        )
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      const failures = (observationFailures.get(id) ?? 0) + 1
      observationFailures.set(id, failures)
      if (
        failures >= unresolvedAfterFailures &&
        !hasSituation(entry.transactionHash, 'transaction-unresolved')
      ) {
        appendIdentityEvent(
          eventFrom(entry, {
            situation: 'transaction-unresolved',
            error: 'Surface could not confirm the transaction result.',
          }),
        )
      }
    } finally {
      observing.delete(id)
    }
  }

  async function observeSubmittedTransactions() {
    const submittedIds = entries.value.flatMap((entry) =>
      entry.type === 'identity-creation' &&
      entry.situation === 'transaction-submitted' &&
      entry.transactionHash &&
      !(
        [
          'transaction-executed',
          'transaction-failed',
          'transaction-unresolved',
          'public-record-observed',
        ] satisfies IdentityDocketEntry['situation'][]
      ).some((situation) => hasSituation(entry.transactionHash!, situation))
        ? [entry.id]
        : [],
    )
    await Promise.allSettled(submittedIds.map(observeSubmittedTransaction))
  }

  watch(
    acts,
    (nextActs) => {
      const recordedByHash = new Map(
        nextActs.map((act) => [act.txhash.toUpperCase(), act.timestamp] as const),
      )
      for (const entry of entries.value) {
        if (
          entry.type !== 'identity-creation' ||
          entry.situation !== 'transaction-submitted' ||
          !entry.transactionHash
        ) {
          continue
        }
        if (
          recordedByHash.has(entry.transactionHash.toUpperCase()) &&
          !hasSituation(entry.transactionHash, 'public-record-observed')
        ) {
          appendIdentityEvent(eventFrom(entry, { situation: 'public-record-observed' }))
        }
      }
    },
    { immediate: true },
  )

  onMounted(() => {
    observationAbortController = new AbortController()
    observationTimer = window.setInterval(
      () => void observeSubmittedTransactions(),
      observationIntervalMs,
    )
  })

  onBeforeUnmount(() => {
    window.clearInterval(observationTimer)
    observationAbortController?.abort()
  })

  return {
    entries: orderedEntries,
    appendIdentityEvent,
    recordSessionTransition,
    observeSubmittedTransaction,
  }
}
