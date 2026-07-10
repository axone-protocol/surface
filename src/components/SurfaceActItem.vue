<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import SurfaceActBadge from './SurfaceActBadge.vue'
import type { SurfaceAct } from '../domain/surface-act'

type ActLineKey = 'signer' | 'date' | 'tx' | 'height' | 'msg' | 'title' | 'description'

type ActLine = {
  key: ActLineKey
  value: string
  label?: string
}

const props = defineProps<{
  act: SurfaceAct
  reducedMotion: boolean
  typingActive: boolean
}>()

const emit = defineEmits<{
  'typing-complete': []
}>()

const typedLength = ref(0)
let typingTimer: number | undefined

const lines = computed<ActLine[]>(() => [
  { key: 'signer', label: 'signer', value: compactValue(props.act.signer ?? '-') },
  { key: 'date', label: 'date', value: compactDate(props.act.timestamp) },
  { key: 'tx', label: 'tx', value: shortValue(props.act.txhash) },
  { key: 'height', label: 'height', value: String(props.act.height) },
  { key: 'msg', label: 'msg', value: String(props.act.msgIndex) },
  { key: 'title', value: props.act.title },
  { key: 'description', value: props.act.description },
])

const fullText = computed(() => lines.value.map(displayLineText).join('\n'))

function shortValue(value: string) {
  if (value.length <= 24) {
    return value
  }

  return `${value.slice(0, 12)}...${value.slice(-6)}`
}

function compactValue(value: string) {
  if (value.startsWith('did:pkh:')) {
    const didParts = value.split(':')
    return shortValue(didParts[didParts.length - 1] ?? value)
  }

  return shortValue(value)
}

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

function displayLineText(line: ActLine) {
  return line.label ? `${line.label} ${line.value}` : line.value
}

function typedLine(key: ActLineKey) {
  const lineIndex = lines.value.findIndex((line) => line.key === key)
  if (lineIndex < 0) {
    return ''
  }

  const lineStart =
    lines.value
      .slice(0, lineIndex)
      .reduce((sum, line, index) => sum + displayLineText(line).length + (index === 0 ? 0 : 1), 0) +
    (lineIndex === 0 ? 0 : 1)

  if (typedLength.value <= lineStart) {
    return ''
  }

  const text = displayLineText(lines.value[lineIndex]!)
  return text.slice(0, Math.min(text.length, typedLength.value - lineStart))
}

function typedValue(key: ActLineKey) {
  const line = lines.value.find((candidate) => candidate.key === key)
  const text = typedLine(key)

  if (!line?.label) {
    return text
  }

  const prefix = `${line.label} `
  if (text.length <= prefix.length) {
    return ''
  }

  return text.slice(prefix.length)
}

function hasTypedLine(key: ActLineKey) {
  return typedLine(key).length > 0
}

function stopTyping() {
  window.clearInterval(typingTimer)
  typingTimer = undefined
}

function startTyping() {
  stopTyping()

  if (props.reducedMotion || !props.typingActive) {
    typedLength.value = fullText.value.length
    return
  }

  typedLength.value = 1
  typingTimer = window.setInterval(() => {
    if (typedLength.value >= fullText.value.length) {
      typedLength.value = fullText.value.length
      stopTyping()
      emit('typing-complete')
      return
    }

    const nextCharacter = fullText.value[typedLength.value] ?? ''
    typedLength.value = Math.min(
      fullText.value.length,
      typedLength.value + (nextCharacter === ' ' ? 2 : 1),
    )
  }, 16)
}

watch(
  () => [props.act.id, props.reducedMotion, props.typingActive] as const,
  () => {
    startTyping()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopTyping()
})
</script>

<template>
  <article class="surface-act-item" :data-kind="act.kind">
    <SurfaceActBadge :kind="act.kind" />

    <p class="surface-act-item-meta">
      <span v-if="hasTypedLine('signer')">
        <em>SIGNER</em><code :title="act.signer">{{ typedValue('signer') }}</code>
      </span>
      <span v-if="hasTypedLine('date')">
        <em>DATE</em><span>{{ typedValue('date') }}</span>
      </span>
      <span v-if="hasTypedLine('tx')">
        <em>TX</em><code :title="act.txhash">{{ typedValue('tx') }}</code>
      </span>
      <span v-if="hasTypedLine('height')">
        <em>HEIGHT</em><span>{{ typedValue('height') }}</span>
      </span>
      <span v-if="hasTypedLine('msg')">
        <em>MSG</em><span>{{ typedValue('msg') }}</span>
      </span>
    </p>

    <p v-if="hasTypedLine('title')" class="surface-act-item-title">{{ typedLine('title') }}</p>
    <p v-if="hasTypedLine('description')" class="surface-act-item-description">
      {{ typedLine('description') }}
    </p>
  </article>
</template>
