<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'

import type { ConnectedWallet } from '../composables/useWalletConnection'
import { isIdentityRequestComplete } from '../domain/identity-request'
import { shortenWalletAddress } from '../lib/shorten'
import type { Network } from '../networks'
import { surfaceLaws } from '../surfaceLaws'

const props = defineProps<{
  walletConnection: ConnectedWallet | null
  walletTriggerDisabled: boolean
  network: Network
  reducedMotion: boolean
  requestWalletConnection: () => void
  sendIdentityRequest: (input: { name: string; description: string }) => Promise<string | null>
}>()

const actorLines = [
  'For humans.',
  'For agents.',
  'For organisations.',
  'For any resource in scope.',
]
const defaultLaw = surfaceLaws[0]!
const activeLawId = ref(defaultLaw.id)
const activeActorIndex = ref(0)
const identityName = ref('')
const identityDescription = ref('')
const identityRequestState = ref<'idle' | 'submitting' | 'submitted' | 'error'>('idle')
const identityRequestComposing = ref(false)
const identityRequestError = ref<string | null>(null)
let actorTimer: number | undefined
let lawTimer: number | undefined

const activeLaw = computed(
  () => surfaceLaws.find((law) => law.id === activeLawId.value) ?? defaultLaw,
)
const activeActorLine = computed(() => actorLines[activeActorIndex.value] ?? actorLines[0])
const immediateMotionTransition = { duration: 0 }
const lawMotionTransition = { duration: 0.5, ease: 'easeInOut' }
const actorMotionTransition = { duration: 0.26, ease: 'easeInOut' }
const lawTransition = computed(() =>
  props.reducedMotion ? immediateMotionTransition : lawMotionTransition,
)
const actorTransition = computed(() =>
  props.reducedMotion ? immediateMotionTransition : actorMotionTransition,
)
const identityRequestReady = computed(() =>
  isIdentityRequestComplete({ name: identityName.value, description: identityDescription.value }),
)
const identityRequestSubmitting = computed(() => identityRequestState.value === 'submitting')
const identityRequestConfigured = computed(
  () =>
    props.network.abstractAccountCodeId !== null &&
    props.network.abstractAccountAdmin !== null &&
    props.network.api !== null,
)

function clearIdentityRequestDraft() {
  identityName.value = ''
  identityDescription.value = ''
}

function clearIdentityRequest() {
  clearIdentityRequestDraft()
  identityRequestState.value = 'idle'
  identityRequestComposing.value = false
  identityRequestError.value = null
}

function beginIdentityRequest() {
  if (props.walletConnection) {
    identityRequestComposing.value = true
  }
}

function beginAnotherIdentityRequest() {
  clearIdentityRequestDraft()
  identityRequestState.value = 'idle'
  identityRequestComposing.value = true
  identityRequestError.value = null
}

async function submitIdentityRequest() {
  if (
    !props.walletConnection ||
    !identityRequestReady.value ||
    !identityRequestConfigured.value ||
    identityRequestSubmitting.value
  ) {
    return
  }

  identityRequestState.value = 'submitting'
  identityRequestError.value = null
  const error = await props.sendIdentityRequest({
    name: identityName.value.trim(),
    description: identityDescription.value.trim(),
  })

  if (error) {
    identityRequestError.value = error
    identityRequestState.value = 'error'
    return
  }

  identityRequestState.value = 'submitted'
}

function rotateActorLine() {
  activeActorIndex.value = (activeActorIndex.value + 1) % actorLines.length
}

function rotateLaw() {
  const currentIndex = surfaceLaws.findIndex((law) => law.id === activeLawId.value)
  const nextLaw = surfaceLaws[(currentIndex + 1) % surfaceLaws.length] ?? defaultLaw
  activeLawId.value = nextLaw.id
}

function startHeroRotation() {
  window.clearInterval(actorTimer)
  window.clearInterval(lawTimer)

  if (props.reducedMotion) {
    return
  }

  actorTimer = window.setInterval(rotateActorLine, 4600)
  lawTimer = window.setInterval(rotateLaw, 5200)
}

watch(() => props.reducedMotion, startHeroRotation)
watch(
  () => [props.walletConnection?.address, props.walletConnection?.chainId, props.network.key],
  clearIdentityRequest,
)

onMounted(startHeroRotation)

onBeforeUnmount(() => {
  window.clearInterval(actorTimer)
  window.clearInterval(lawTimer)
})
</script>

<template>
  <header class="doctrine-hero">
    <p
      class="law-line"
      :aria-label="`${activeLaw.number} / ${activeLaw.title} - ${activeLaw.paraphrase}`"
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="wait" :initial="false">
        <motion.span
          :key="activeLaw.id"
          class="law-statement"
          :initial="{ opacity: 0, filter: 'blur(2px)' }"
          :animate="{ opacity: 1, filter: 'blur(0px)' }"
          :exit="{ opacity: 0, filter: 'blur(2px)' }"
          :transition="lawTransition"
        >
          <span class="law-number">{{ activeLaw.number }}</span>
          <span class="law-content">
            <span class="law-title">{{ activeLaw.title }}</span>
            <span class="law-separator" aria-hidden="true">—</span>
            <span class="law-paraphrase">{{ activeLaw.paraphrase }}</span>
          </span>
        </motion.span>
      </AnimatePresence>
      <span class="law-rule" aria-hidden="true"></span>
    </p>
    <h1 id="surface-home-title">GOVERN<br /><span class="act">ACT</span></h1>
    <p class="actor-line" aria-live="polite" aria-atomic="true">
      <AnimatePresence mode="wait" :initial="false">
        <motion.span
          :key="activeActorIndex"
          :initial="{ opacity: 0, y: '0.3em' }"
          :animate="{ opacity: 1, y: 0 }"
          :exit="{ opacity: 0, y: '-0.24em' }"
          :transition="actorTransition"
        >
          {{ activeActorLine }}
        </motion.span>
      </AnimatePresence>
    </p>
  </header>
  <section class="identity-request" aria-labelledby="identity-request-title">
    <div class="identity-request-heading">
      <p class="identity-request-kicker">IDENTITY REQUEST</p>
      <h2 id="identity-request-title">Establish an identity.</h2>
    </div>

    <div v-if="!identityRequestComposing" class="identity-request-connect">
      <button
        class="identity-request-connect-action"
        type="button"
        :disabled="walletTriggerDisabled"
        @click="walletConnection ? beginIdentityRequest() : requestWalletConnection()"
      >
        {{ walletConnection ? 'NEW IDENTITY REQUEST' : 'CONNECT WALLET' }}
      </button>
    </div>

    <form
      v-else-if="walletConnection"
      class="identity-request-form"
      @submit.prevent="submitIdentityRequest"
    >
      <p class="identity-request-controller">
        CONTROLLER <code>{{ shortenWalletAddress(walletConnection.address) }}</code>
      </p>
      <label>
        <span>NAME · REQUIRED</span>
        <input
          v-model="identityName"
          name="identity-name"
          autocomplete="off"
          required
          :disabled="identityRequestSubmitting || identityRequestState === 'submitted'"
        />
      </label>
      <label>
        <span>DESCRIPTION · REQUIRED</span>
        <textarea
          v-model="identityDescription"
          name="identity-description"
          rows="3"
          required
          :disabled="identityRequestSubmitting || identityRequestState === 'submitted'"
        />
      </label>
      <p v-if="!identityRequestConfigured" class="identity-request-error" role="alert">
        Identity creation is not available on the selected network.
      </p>
      <button
        v-if="identityRequestState === 'submitted'"
        class="identity-request-submit"
        type="button"
        @click="beginAnotherIdentityRequest"
      >
        NEW IDENTITY REQUEST
      </button>
      <button
        v-else
        class="identity-request-submit"
        type="submit"
        :disabled="!identityRequestReady || !identityRequestConfigured || identityRequestSubmitting"
      >
        {{ identityRequestSubmitting ? 'AWAITING SIGNATURE' : 'SIGN REQUEST' }}
      </button>
      <p
        v-if="identityRequestSubmitting"
        class="identity-request-status is-pending"
        role="status"
        aria-live="polite"
      >
        <span aria-hidden="true"></span> Awaiting wallet signature.
      </p>
      <div
        v-if="identityRequestState === 'submitted'"
        class="identity-request-status"
        role="status"
        aria-live="polite"
      >
        <p class="identity-request-status-label">REQUEST ADDED TO DOCKET</p>
      </div>
      <p v-else-if="identityRequestError" class="identity-request-error" role="alert">
        {{ identityRequestError }}
      </p>
    </form>
  </section>
</template>
