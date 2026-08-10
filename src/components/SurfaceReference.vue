<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { SurfaceReference as SurfaceReferenceModel } from '../domain/surface-reference'

const props = defineProps<{
  reference: SurfaceReferenceModel
  evidence?: boolean
}>()

let surfaceCount = 0

const isOpen = ref(false)
const isMobile = ref(false)
const copyState = ref<'idle' | 'copying' | 'copied'>('idle')
const rootEl = ref<HTMLElement | null>(null)
const triggerEl = ref<HTMLButtonElement | null>(null)
const surfaceEl = ref<HTMLElement | null>(null)
const closeButtonEl = ref<HTMLButtonElement | null>(null)
const panelStyle = ref<Record<string, string>>({})
const panelPlacement = ref<'above' | 'below'>('below')
const surfaceId = `surface-reference-${surfaceCount++}`
let copiedTimer: number | undefined
let mediaQuery: MediaQueryList | undefined
let positioningFrame: number | undefined

const resolvedLink = computed(() => {
  if (!props.reference.link) {
    return undefined
  }

  try {
    return new URL(props.reference.link.href, window.location.href)
  } catch {
    return undefined
  }
})
const isExternalLink = computed(() => resolvedLink.value?.origin !== window.location.origin)
const exhibitDesignation = computed(() =>
  props.reference.designation === 'Transaction hash' ? 'TX HASH' : props.reference.designation,
)

function clearCopiedTimer() {
  window.clearTimeout(copiedTimer)
  copiedTimer = undefined
}

function close() {
  if (!isOpen.value) {
    return
  }

  isOpen.value = false
  clearCopiedTimer()
  copyState.value = 'idle'
  void nextTick(() => triggerEl.value?.focus())
}

function open() {
  isOpen.value = true
}

function toggle() {
  if (isOpen.value) {
    close()
  } else {
    open()
  }
}

async function copyValue() {
  if (copyState.value !== 'idle') {
    return
  }

  copyState.value = 'copying'
  try {
    await navigator.clipboard.writeText(props.reference.value)
  } catch {
    copyState.value = 'idle'
    return
  }

  copyState.value = 'copied'
  copiedTimer = window.setTimeout(() => {
    copiedTimer = undefined
    copyState.value = 'idle'
  }, 1000)
}

function positionPanel() {
  const trigger = triggerEl.value
  const panel = surfaceEl.value
  if (!trigger || !panel || isMobile.value) {
    return
  }

  const triggerRect = trigger.getBoundingClientRect()
  const panelRect = panel.getBoundingClientRect()
  const gutter = 12
  const below = window.innerHeight - triggerRect.bottom - gutter
  const above = triggerRect.top - gutter
  const fitsBelow = panelRect.height <= below
  const fitsAbove = panelRect.height <= above
  const placement = fitsBelow || !fitsAbove ? 'below' : 'above'
  const top =
    placement === 'below'
      ? triggerRect.bottom + gutter
      : triggerRect.top - gutter - panelRect.height
  const maxHeight = Math.max(96, Math.max(below, above))
  const left = Math.min(
    Math.max(gutter, triggerRect.left),
    Math.max(gutter, window.innerWidth - panelRect.width - gutter),
  )

  panelPlacement.value = placement
  panelStyle.value = {
    left: `${left}px`,
    top: `${Math.max(gutter, top)}px`,
    maxHeight: `${maxHeight}px`,
  }
}

function schedulePanelPosition() {
  if (!isOpen.value || isMobile.value) {
    return
  }

  if (typeof window.requestAnimationFrame !== 'function') {
    positionPanel()
    return
  }

  if (positioningFrame !== undefined) {
    return
  }

  positioningFrame = window.requestAnimationFrame(() => {
    positioningFrame = undefined
    positionPanel()
  })
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (isOpen.value && event.key === 'Escape') {
    event.preventDefault()
    close()
  }
}

function handleDocumentClick(event: MouseEvent) {
  if (!isOpen.value) {
    return
  }

  const target = event.target as Node | null
  if (target && (rootEl.value?.contains(target) || surfaceEl.value?.contains(target))) {
    return
  }

  close()
}

function trapSheetFocus(event: KeyboardEvent) {
  if (!isMobile.value || event.key !== 'Tab') {
    return
  }

  const focusable = Array.from(
    surfaceEl.value?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') ?? [],
  )
  if (focusable.length === 0) {
    return
  }

  const activeIndex = focusable.indexOf(document.activeElement as HTMLElement)
  if (event.shiftKey && (activeIndex <= 0 || activeIndex === -1)) {
    event.preventDefault()
    focusable[focusable.length - 1]?.focus()
  } else if (!event.shiftKey && (activeIndex === focusable.length - 1 || activeIndex === -1)) {
    event.preventDefault()
    focusable[0]?.focus()
  }
}

function updateMobileMode() {
  isMobile.value = mediaQuery?.matches ?? false
}

watch([isOpen, isMobile], async ([open]) => {
  if (!open) {
    return
  }

  await nextTick()
  if (isMobile.value) {
    closeButtonEl.value?.focus()
  } else {
    positionPanel()
  }
})

onMounted(() => {
  if (typeof window.matchMedia === 'function') {
    mediaQuery = window.matchMedia('(max-width: 760px)')
    updateMobileMode()
    mediaQuery.addEventListener('change', updateMobileMode)
  }
  document.addEventListener('keydown', handleDocumentKeydown)
  document.addEventListener('click', handleDocumentClick)
  window.addEventListener('resize', schedulePanelPosition)
  document.addEventListener('scroll', schedulePanelPosition, true)
})

onBeforeUnmount(() => {
  clearCopiedTimer()
  window.cancelAnimationFrame(positioningFrame ?? 0)
  mediaQuery?.removeEventListener('change', updateMobileMode)
  document.removeEventListener('keydown', handleDocumentKeydown)
  document.removeEventListener('click', handleDocumentClick)
  window.removeEventListener('resize', schedulePanelPosition)
  document.removeEventListener('scroll', schedulePanelPosition, true)
})
</script>

<template>
  <span ref="rootEl" class="surface-reference">
    <button
      ref="triggerEl"
      class="surface-reference-trigger"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      :aria-controls="surfaceId"
      :aria-label="`Inspect ${reference.designation}: ${reference.value}`"
      @click="toggle"
    >
      <span class="surface-reference-trigger-text">{{ reference.display }}</span>
    </button>
  </span>

  <Teleport to="body">
    <Transition name="surface-reference-popover">
      <section
        v-if="isOpen && !isMobile"
        :id="surfaceId"
        ref="surfaceEl"
        class="surface-reference-panel"
        :class="`surface-reference-panel--${panelPlacement}`"
        role="dialog"
        :aria-label="`Inspect ${reference.designation}`"
        :style="panelStyle"
      >
        <div class="surface-reference-header">
          <p class="surface-reference-label">
            {{ evidence ? `Exhibit · ${exhibitDesignation}` : reference.designation }}
          </p>
          <p v-if="evidence" class="surface-reference-verification">
            <svg aria-hidden="true" viewBox="0 0 16 16">
              <path
                d="M8.2 1.4C11.8 1.1 14.5 3.6 14.6 7.9c.1 4.2-2.7 6.7-6.5 6.8C4.2 14.8 1.3 12.3 1.4 8 1.5 4 4.5 1.7 8.2 1.4Z"
              />
              <path d="m5.2 8.1 2.1 1.9L11 5.8" />
            </svg>
            <span>Verified</span>
          </p>
        </div>
        <code class="surface-reference-value">{{ reference.value }}</code>
        <div
          class="surface-reference-actions"
          :class="{ 'surface-reference-actions--single': !resolvedLink }"
        >
          <button
            class="surface-reference-action"
            type="button"
            :disabled="copyState === 'copying'"
            @click="copyValue"
          >
            {{ copyState === 'copied' ? 'Copied' : 'Copy' }}
          </button>
          <a
            v-if="resolvedLink && reference.link"
            class="surface-reference-action"
            :href="resolvedLink.href"
            :target="isExternalLink ? '_blank' : undefined"
            :rel="isExternalLink ? 'noopener noreferrer' : undefined"
            @click="close"
          >
            {{ reference.link.label }}
          </a>
        </div>
      </section>
    </Transition>
  </Teleport>

  <Teleport to="body">
    <div v-if="isOpen && isMobile" class="surface-reference-backdrop" @click.self="close">
      <section
        :id="surfaceId"
        ref="surfaceEl"
        class="surface-reference-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="`Inspect ${reference.designation}`"
        @keydown="trapSheetFocus"
      >
        <div class="surface-reference-sheet-heading">
          <div class="surface-reference-header">
            <p class="surface-reference-label">
              {{ evidence ? `Exhibit · ${exhibitDesignation}` : reference.designation }}
            </p>
            <p v-if="evidence" class="surface-reference-verification">
              <svg aria-hidden="true" viewBox="0 0 16 16">
                <path
                  d="M8.2 1.4C11.8 1.1 14.5 3.6 14.6 7.9c.1 4.2-2.7 6.7-6.5 6.8C4.2 14.8 1.3 12.3 1.4 8 1.5 4 4.5 1.7 8.2 1.4Z"
                />
                <path d="m5.2 8.1 2.1 1.9L11 5.8" />
              </svg>
              <span>Verified</span>
            </p>
          </div>
          <button ref="closeButtonEl" class="surface-reference-close" type="button" @click="close">
            Close
          </button>
        </div>
        <code class="surface-reference-value">{{ reference.value }}</code>
        <div
          class="surface-reference-actions"
          :class="{ 'surface-reference-actions--single': !resolvedLink }"
        >
          <button
            class="surface-reference-action"
            type="button"
            :disabled="copyState === 'copying'"
            @click="copyValue"
          >
            {{ copyState === 'copied' ? 'Copied' : 'Copy' }}
          </button>
          <a
            v-if="resolvedLink && reference.link"
            class="surface-reference-action"
            :href="resolvedLink.href"
            :target="isExternalLink ? '_blank' : undefined"
            :rel="isExternalLink ? 'noopener noreferrer' : undefined"
            @click="close"
          >
            {{ reference.link.label }}
          </a>
        </div>
      </section>
    </div>
  </Teleport>
</template>
