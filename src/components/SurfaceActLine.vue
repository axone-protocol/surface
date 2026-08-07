<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import {
  type SurfaceAssertionPart,
  type SurfaceReference as SurfaceReferenceModel,
} from '../domain/surface-reference'
import { surfaceActKindCategories, type SurfaceAct } from '../domain/surface-act'
import { shortenHash, shortenIdentifier } from '../lib/shorten'
import SurfaceReference from './SurfaceReference.vue'

const props = defineProps<{
  act: SurfaceAct
  reducedMotion: boolean
  typingActive: boolean
  cursorVisible: boolean
  explorer: string
}>()

const emit = defineEmits<{
  'typing-complete': []
}>()

type TypedAssertionPart = SurfaceAssertionPart | { type: 'partial-reference'; value: string }

const typedLength = ref(0)
let typingTimer: number | undefined

const assertionText = computed(() =>
  props.act.assertion
    .map((part) => (part.type === 'text' ? part.value : part.reference.display))
    .join(''),
)
const typedAssertionParts = computed<TypedAssertionPart[]>(() => {
  let remainingLength = typedLength.value
  const parts: TypedAssertionPart[] = []

  for (const part of props.act.assertion) {
    const value = part.type === 'text' ? part.value : part.reference.display
    const typedValue = value.slice(0, Math.max(0, remainingLength))
    remainingLength -= value.length

    if (!typedValue) {
      continue
    }

    if (part.type === 'reference') {
      parts.push(
        typedValue === value
          ? { type: 'reference', reference: part.reference }
          : { type: 'partial-reference', value: typedValue },
      )
    } else {
      parts.push({ type: 'text', value: typedValue })
    }
  }

  return parts
})
const entryParts = computed(() => {
  const entry = props.act.entry ?? '—'
  const match = entry.match(/^(.*)(\.\d+\.\d+)$/)
  return match ? { prefix: match[1], suffix: match[2] } : { prefix: entry, suffix: '' }
})
const transactionReference = computed<SurfaceReferenceModel>(() => ({
  designation: 'Transaction hash',
  value: props.act.txhash,
  display: shortenHash(props.act.txhash),
  link: {
    href: `${props.explorer}/tx/${props.act.txhash}`,
    label: 'OPEN IN EXPLORER',
  },
}))

function compactDate(value: string) {
  const normalized = value.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d{3})?)?(?:Z| UTC)?$/,
  )
  if (normalized) {
    const [, date, hour, minute] = normalized
    return `${date} ${hour}:${minute} UTC`
  }

  return value.replace('.000Z', ' UTC').replace('T', ' ').replace(/Z$/, ' UTC')
}

function stopTyping() {
  window.clearInterval(typingTimer)
  typingTimer = undefined
}

function startTyping() {
  stopTyping()

  if (props.reducedMotion || !props.typingActive) {
    typedLength.value = assertionText.value.length
    return
  }

  typedLength.value = 1
  typingTimer = window.setInterval(() => {
    if (typedLength.value >= assertionText.value.length) {
      typedLength.value = assertionText.value.length
      stopTyping()
      emit('typing-complete')
      return
    }

    const nextCharacter = assertionText.value[typedLength.value] ?? ''
    typedLength.value = Math.min(
      assertionText.value.length,
      typedLength.value + (nextCharacter === ' ' ? 2 : 1),
    )
  }, 16)
}

watch(
  () => [props.act.id, assertionText.value, props.reducedMotion, props.typingActive] as const,
  () => {
    startTyping()
  },
  { immediate: true },
)

onBeforeUnmount(stopTyping)
</script>

<template>
  <article class="surface-act-record">
    <div class="surface-act-entry">
      <p>{{ entryParts.prefix }}</p>
      <p v-if="entryParts.suffix" class="surface-act-entry-suffix">{{ entryParts.suffix }}</p>
    </div>

    <div class="surface-act-assertion">
      <p
        class="surface-act-category"
        :class="`surface-act-category--${surfaceActKindCategories[act.kind].toLowerCase()}`"
      >
        {{ surfaceActKindCategories[act.kind] }}
      </p>
      <p class="surface-act-inscription">
        <template v-for="(part, index) in typedAssertionParts" :key="index">
          <SurfaceReference v-if="part.type === 'reference'" :reference="part.reference" />
          <span v-else-if="part.type === 'partial-reference'" class="surface-act-identifier">
            {{ part.value }}
          </span>
          <template v-else>{{ part.value }}</template>
        </template>
        <span v-if="cursorVisible" class="surface-act-cursor" aria-hidden="true" />
      </p>
    </div>

    <dl class="surface-act-proof">
      <div class="surface-act-proof-row surface-act-tx-row">
        <dt>tx</dt>
        <dd class="surface-act-tx">
          <SurfaceReference :reference="transactionReference" evidence />
        </dd>
      </div>
      <div>
        <dt>recorded</dt>
        <dd>{{ compactDate(act.timestamp) }}</dd>
      </div>
      <div v-if="act.kind === 'governance.decision.recorded' && act.payload.decision_id">
        <dt>decision</dt>
        <dd>n° {{ act.payload.decision_id }}</dd>
      </div>
      <div v-if="act.payload.constitution_revision && act.payload.constitution_hash">
        <dt>constitution</dt>
        <dd>
          r. {{ act.payload.constitution_revision }} ·
          <SurfaceReference
            :reference="{
              designation: 'Constitution hash',
              value: act.payload.constitution_hash,
              display: shortenHash(act.payload.constitution_hash),
            }"
            evidence
          />
        </dd>
      </div>
      <div
        v-if="
          (act.kind === 'credential.issued' || act.kind === 'credential.revoked') &&
          act.payload.identifier
        "
      >
        <dt>credential</dt>
        <dd>
          <SurfaceReference
            :reference="{
              designation: 'Credential identifier',
              value: act.payload.identifier,
              display: shortenIdentifier(act.payload.identifier),
            }"
            evidence
          />
        </dd>
      </div>
      <div v-if="act.kind === 'governance.decision.recorded' && act.payload.verdict">
        <dt>verdict</dt>
        <dd>{{ act.payload.verdict }}</dd>
      </div>
    </dl>
  </article>
</template>
