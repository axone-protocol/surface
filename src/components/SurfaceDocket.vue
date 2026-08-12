<script setup lang="ts">
import SurfaceReference from './SurfaceReference.vue'
import type {
  DocketSessionEntry,
  IdentityDocketEntry,
  IdentityDocketSituation,
  SurfaceDocketEntry,
} from '../domain/surface-docket'
import type { SurfaceReference as SurfaceReferenceModel } from '../domain/surface-reference'
import { shortenHash, shortenWalletAddress } from '../lib/shorten'
import { formatSurfaceTimestamp } from '../lib/surface-time'

defineProps<{
  entries: SurfaceDocketEntry[]
}>()

const situationLabels: Record<IdentityDocketSituation, string> = {
  'signature-declined': 'SIGNATURE DECLINED',
  'submission-not-sent': 'SUBMISSION NOT SENT',
  'transaction-submitted': 'TRANSACTION SUBMITTED',
  'transaction-executed': 'TRANSACTION EXECUTED',
  'transaction-failed': 'TRANSACTION FAILED',
  'transaction-unresolved': 'TRANSACTION UNRESOLVED',
  'public-record-observed': 'PUBLIC RECORD OBSERVED',
}

function situationDetail(entry: IdentityDocketEntry) {
  switch (entry.situation) {
    case 'signature-declined':
    case 'submission-not-sent':
      return 'NO TRANSACTION SUBMITTED'
    case 'transaction-unresolved':
      return 'NO RESULT OBSERVED'
    case 'transaction-failed':
      return failureSummary(entry.error)
    default:
      return undefined
  }
}

function failureSummary(error?: string) {
  if (!error) {
    return 'Transaction execution failed.'
  }

  const contractValidation = error.match(/(?:name|description) too short[^:;.]*/i)?.[0]
  if (contractValidation) {
    return `${contractValidation.charAt(0).toUpperCase()}${contractValidation.slice(1)}.`
  }

  return error.length > 150 ? `${error.slice(0, 147).trimEnd()}…` : error
}

function transactionReference(entry: IdentityDocketEntry): SurfaceReferenceModel | undefined {
  if (!entry.transactionHash) {
    return undefined
  }

  return {
    designation: 'Transaction hash',
    value: entry.transactionHash,
    display: shortenHash(entry.transactionHash),
    link: {
      href: `${entry.explorer}/tx/${entry.transactionHash}`,
      label: 'OPEN IN EXPLORER',
    },
  }
}

function blockReference(entry: IdentityDocketEntry): SurfaceReferenceModel | undefined {
  if (!entry.height) {
    return undefined
  }

  return {
    designation: 'Block height',
    value: entry.height,
    display: `BLOCK ${entry.height}`,
    link: {
      href: `${entry.explorer}/block/${entry.height}`,
      label: 'OPEN IN EXPLORER',
    },
  }
}

function controllerReference(
  controller: string | undefined,
  explorer?: string,
): SurfaceReferenceModel | undefined {
  if (!controller) {
    return undefined
  }

  return {
    designation: 'Wallet address',
    value: controller,
    display: shortenWalletAddress(controller),
    link: explorer
      ? {
          href: `${explorer}/account/${controller}`,
          label: 'OPEN IN EXPLORER',
        }
      : undefined,
  }
}

function networkReference(chainId: string, explorer?: string): SurfaceReferenceModel {
  return {
    designation: 'Network ID',
    value: chainId,
    display: chainId,
    link: explorer
      ? {
          href: explorer,
          label: 'OPEN IN EXPLORER',
        }
      : undefined,
  }
}

function sessionLabel(entry: DocketSessionEntry) {
  if (entry.event === 'connected') {
    return 'CONTROLLER CONNECTED'
  }
  if (entry.event === 'disconnected') {
    return 'CONTROLLER DISCONNECTED'
  }
  return 'CONTROLLER CHANGED'
}
</script>

<template>
  <section class="surface-docket" aria-labelledby="surface-docket-title">
    <header class="surface-docket-head">
      <h2 id="surface-docket-title">DOCKET</h2>
    </header>

    <div class="surface-docket-register">
      <div class="surface-docket-columns" aria-hidden="true">
        <span>TIME</span>
        <span>ACTIVITY</span>
        <span>SITUATION</span>
      </div>

      <div v-if="entries.length === 0" class="surface-docket-empty">
        <p>NO ACTIVITY</p>
      </div>

      <template v-else v-for="entry in entries" :key="entry.id">
        <article
          v-if="entry.type === 'identity-creation'"
          class="surface-docket-entry"
          :class="`is-${entry.situation}`"
        >
          <time :datetime="entry.occurredAt">{{ formatSurfaceTimestamp(entry.occurredAt) }}</time>

          <div class="surface-docket-request">
            <p class="surface-docket-kind">IDENTITY CREATION</p>
            <h3>{{ entry.name }}</h3>
            <p class="surface-docket-description">{{ entry.description }}</p>
            <p class="surface-docket-context">
              <SurfaceReference
                :reference="controllerReference(entry.controller, entry.explorer)!"
              />
              <span aria-hidden="true">·</span>
              <SurfaceReference :reference="networkReference(entry.chainId, entry.explorer)" />
            </p>
          </div>

          <div class="surface-docket-situation">
            <p class="surface-docket-status">
              {{ situationLabels[entry.situation] }}
            </p>
            <p v-if="situationDetail(entry)">{{ situationDetail(entry) }}</p>
            <div
              v-if="transactionReference(entry) || blockReference(entry)"
              class="surface-docket-situation-facts"
            >
              <SurfaceReference
                v-if="transactionReference(entry)"
                :reference="transactionReference(entry)!"
              />
              <SurfaceReference v-if="blockReference(entry)" :reference="blockReference(entry)!" />
            </div>
            <details v-if="entry.error" class="surface-docket-error-detail">
              <summary>INSPECT FAILURE</summary>
              <code>{{ entry.error }}</code>
            </details>
          </div>
        </article>

        <div v-else class="surface-docket-session" :class="`is-${entry.event}`">
          <time :datetime="entry.occurredAt">{{ formatSurfaceTimestamp(entry.occurredAt) }}</time>
          <p>{{ sessionLabel(entry) }}</p>
          <div class="surface-docket-session-context">
            <template v-if="entry.event === 'controller-changed'">
              <SurfaceReference
                v-if="controllerReference(entry.previousController)"
                :reference="controllerReference(entry.previousController)!"
              />
              <span aria-hidden="true">→</span>
            </template>
            <SurfaceReference
              v-if="controllerReference(entry.controller ?? entry.previousController)"
              :reference="controllerReference(entry.controller ?? entry.previousController)!"
            />
            <span aria-hidden="true">·</span>
            <SurfaceReference :reference="networkReference(entry.chainId, entry.explorer)" />
          </div>
        </div>
      </template>
    </div>
  </section>
</template>
