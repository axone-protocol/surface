<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

type SurfaceActLineRole = 'category' | 'meta' | 'title' | 'description'

const props = defineProps<{
  role: SurfaceActLineRole
  text: string
  reducedMotion: boolean
  typingActive: boolean
  cursorVisible: boolean
}>()

const emit = defineEmits<{
  'typing-complete': []
}>()

const typedLength = ref(0)
let typingTimer: number | undefined

const typedText = computed(() => props.text.slice(0, typedLength.value))

function stopTyping() {
  window.clearInterval(typingTimer)
  typingTimer = undefined
}

function startTyping() {
  stopTyping()

  if (props.reducedMotion || !props.typingActive) {
    typedLength.value = props.text.length
    return
  }

  typedLength.value = 1
  typingTimer = window.setInterval(() => {
    if (typedLength.value >= props.text.length) {
      typedLength.value = props.text.length
      stopTyping()
      emit('typing-complete')
      return
    }

    const nextCharacter = props.text[typedLength.value] ?? ''
    typedLength.value = Math.min(
      props.text.length,
      typedLength.value + (nextCharacter === ' ' ? 2 : 1),
    )
  }, 16)
}

watch(
  () => [props.text, props.reducedMotion, props.typingActive] as const,
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
  <p class="surface-act-line" :class="`surface-act-line-${role}`">
    {{ typedText }}<span v-if="cursorVisible" class="surface-act-cursor" aria-hidden="true" />
  </p>
</template>
