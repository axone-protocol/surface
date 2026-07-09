<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";

import HeroCanvas from "./components/HeroCanvas.vue";
import { surfaceLaws } from "./surfaceLaws";
import { eventId, registryEvents, type RegistryEvent } from "./surfaceRegistry";

type RegisterEntry = RegistryEvent & {
  id: string;
};

const actorLines = ["For humans.", "For agents.", "For organisations.", "For any resource that acts."];

const maxVisibleLines = 7;
const defaultLaw = surfaceLaws[0]!;

const prefersReducedMotion = ref(false);
const activeLawId = ref(defaultLaw.id);
const activeActorIndex = ref(0);
const visibleCount = ref(0);
const sealedEntryIds = ref(new Set<string>());
const liveAnnouncement = ref("");
const pollingPulse = ref(false);
const registerListEl = ref<HTMLOListElement | null>(null);

let motionQuery: MediaQueryList | null = null;
let entryTimer: number | undefined;
let actorTimer: number | undefined;
let lawTimer: number | undefined;
let pollingTimer: number | undefined;
let motionChangeHandler: ((event: MediaQueryListEvent) => void) | null = null;

const activeLaw = computed(() => surfaceLaws.find((law) => law.id === activeLawId.value) ?? defaultLaw);
const activeActorLine = computed(() => actorLines[activeActorIndex.value]);
const fullLawText = computed(() => `${activeLaw.value.number} / ${activeLaw.value.title} - ${activeLaw.value.paraphrase}`);

function shortValue(value: string) {
  if (value.length <= 30) {
    return value;
  }

  return `${value.slice(0, 18)}...${value.slice(-8)}`;
}

function compactValue(value: string) {
  if (value.startsWith("did:pkh:")) {
    const didParts = value.split(":");
    return shortValue(didParts[didParts.length - 1] ?? value);
  }

  return shortValue(value);
}

function entryFromEvent(event: RegistryEvent): RegisterEntry {
  return {
    ...event,
    id: eventId(event),
  };
}

const registerEntries = computed(() =>
  registryEvents
    .map(entryFromEvent)
    .sort((left, right) => left.height - right.height || left.messageIndex - right.messageIndex),
);

const renderedEntries = computed(() => {
  const entries = registerEntries.value.slice(0, visibleCount.value);
  return entries.slice(Math.max(0, entries.length - maxVisibleLines));
});

const latestEntry = computed(() => renderedEntries.value[renderedEntries.value.length - 1] ?? null);
const latestSealed = computed(() => (latestEntry.value ? sealedEntryIds.value.has(latestEntry.value.id) : false));
const sealedCount = computed(() => sealedEntryIds.value.size);

function updateReducedMotion(event?: MediaQueryListEvent) {
  prefersReducedMotion.value = event?.matches ?? motionQuery?.matches ?? false;
}

function isEntrySealed(entry: RegisterEntry) {
  return sealedEntryIds.value.has(entry.id);
}

function sealEntry(entry: RegisterEntry) {
  if (sealedEntryIds.value.has(entry.id)) {
    return;
  }

  const nextSet = new Set(sealedEntryIds.value);
  nextSet.add(entry.id);
  sealedEntryIds.value = nextSet;
  liveAnnouncement.value = `Event ${entry.subject} recorded at height ${entry.height}.`;
}

function scrollRegisterToEnd(smooth: boolean) {
  nextTick(() => {
    const el = registerListEl.value;
    if (!el) {
      return;
    }

    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  });
}

function scheduleNextEntry(delay = 620) {
  window.clearTimeout(entryTimer);
  entryTimer = window.setTimeout(revealNextEntry, delay);
}

function revealNextEntry() {
  if (visibleCount.value >= registerEntries.value.length) {
    startPolling();
    return;
  }

  const nextEntry = registerEntries.value[visibleCount.value]!;
  visibleCount.value += 1;
  sealEntry(nextEntry);
  scrollRegisterToEnd(true);
  scheduleNextEntry(1180);
}

function rotateActorLine() {
  activeActorIndex.value = (activeActorIndex.value + 1) % actorLines.length;
}

function rotateLaw() {
  const currentIndex = surfaceLaws.findIndex((law) => law.id === activeLawId.value);
  const nextLaw = surfaceLaws[(currentIndex + 1) % surfaceLaws.length] ?? defaultLaw;
  activeLawId.value = nextLaw.id;
}

function startHeroRotation() {
  window.clearInterval(actorTimer);
  window.clearInterval(lawTimer);

  if (prefersReducedMotion.value) {
    return;
  }

  actorTimer = window.setInterval(rotateActorLine, 4600);
  lawTimer = window.setInterval(rotateLaw, 5200);
}

function startPolling() {
  window.clearInterval(pollingTimer);
  pollingPulse.value = false;
  pollingTimer = window.setInterval(() => {
    pollingPulse.value = true;
    window.setTimeout(() => {
      pollingPulse.value = false;
    }, prefersReducedMotion.value ? 220 : 760);
  }, prefersReducedMotion.value ? 5200 : 3400);
}

function resetRegisterPlayback() {
  window.clearTimeout(entryTimer);
  window.clearInterval(pollingTimer);
  sealedEntryIds.value = new Set();
  liveAnnouncement.value = "";
  pollingPulse.value = false;

  if (prefersReducedMotion.value) {
    visibleCount.value = registerEntries.value.length;
    sealedEntryIds.value = new Set(registerEntries.value.map((entry) => entry.id));
    activeActorIndex.value = 0;
    scrollRegisterToEnd(false);
    startPolling();
    return;
  }

  visibleCount.value = 0;
  scheduleNextEntry(520);
}

onMounted(() => {
  motionQuery = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  updateReducedMotion();
  motionChangeHandler = () => {
    updateReducedMotion();
    resetRegisterPlayback();
    startHeroRotation();
  };
  motionQuery?.addEventListener("change", motionChangeHandler);
  resetRegisterPlayback();
  startHeroRotation();
});

onBeforeUnmount(() => {
  window.clearTimeout(entryTimer);
  window.clearInterval(actorTimer);
  window.clearInterval(lawTimer);
  window.clearInterval(pollingTimer);
  if (motionChangeHandler) {
    motionQuery?.removeEventListener("change", motionChangeHandler);
  }
});
</script>

<template>
  <main class="surface-home" :class="{ 'is-reduced-motion': prefersReducedMotion }">
    <HeroCanvas
      :active-law-index="surfaceLaws.findIndex((law) => law.id === activeLaw.id)"
      :sealed-count="sealedCount"
      :polling-active="pollingPulse"
      :reduced-motion="prefersReducedMotion"
    />

    <section class="surface-document" aria-label="Axone Surface">
      <nav class="surface-bar" aria-label="Surface actions">
        <p class="surface-mark">AXONE / SURFACE</p>
        <button class="top-connect" type="button">Connect account <span aria-hidden="true">→</span></button>
      </nav>

      <header class="doctrine-hero">
        <Transition name="law-fade" mode="out-in">
          <p :key="activeLaw.id" class="law-line" aria-live="polite" aria-atomic="true">{{ fullLawText }}</p>
        </Transition>
        <h1>GOVERN ACT</h1>
        <p class="actor-line" aria-live="polite" aria-atomic="true">
          <span>{{ activeActorLine }}</span>
        </p>
        <p class="sr-only">For humans. For agents. For organisations. For any resource that acts.</p>
      </header>

      <section class="surface-bridge" aria-label="Surface state and actions">
        <p class="heartbeat">
          <span class="heartbeat-dot" aria-hidden="true" />
          <span><strong>8 217</strong> events on-chain</span>
        </p>

        <div class="surface-gestures">
          <a href="#event-stream-title">Enter the stream <span aria-hidden="true">→</span></a>
          <button type="button">Connect account <span aria-hidden="true">→</span></button>
        </div>
      </section>

      <section class="inscription-register" aria-labelledby="event-stream-title">
        <header class="register-head">
          <p id="event-stream-title">EVENT STREAM</p>
        </header>

        <ol ref="registerListEl" class="inscription-lines" aria-label="Cosmos tx events">
          <li
            v-for="entry in renderedEntries"
            :id="entry.id"
            :key="entry.id"
            class="inscription-row"
            :class="{
              'is-sealed': isEntrySealed(entry),
              'is-latest': latestEntry?.id === entry.id,
              'is-polling': latestEntry?.id === entry.id && pollingPulse,
            }"
          >
            <article>
              <span class="entry-mark">EVENT</span>
              <p class="entry-meta">
                <span><em>author</em><code :title="entry.author">{{ compactValue(entry.author) }}</code></span>
                <span v-if="entry.timestamp"><em>date</em><span>{{ entry.timestamp }}</span></span>
                <span><em>tx</em><code :title="entry.tx">{{ shortValue(entry.tx) }}</code></span>
                <span><em>height</em><span>{{ entry.height }}</span></span>
                <span><em>msg</em><span>{{ entry.messageIndex }}</span></span>
              </p>
              <p class="entry-subject">{{ entry.subject }}</p>
              <p class="entry-event">{{ entry.event }}</p>
            </article>
          </li>
        </ol>
        <p class="polling-status" :class="{ 'is-active': pollingPulse, 'is-idle': latestSealed }" aria-hidden="true">
          <span class="polling-dot" />
          <span class="polling-label">{{ pollingPulse ? "Reading event stream" : "Listening for new events" }}</span>
        </p>
      </section>
    </section>

    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ liveAnnouncement }}</p>
  </main>
</template>
