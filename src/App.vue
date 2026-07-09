<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import HeroCanvas from "./components/HeroCanvas.vue";
import { networks, type Network } from "./networks";
import { surfaceLaws } from "./surfaceLaws";
import { eventId, registryEvents, type RegistryEvent } from "./surfaceRegistry";

type RegisterEntry = RegistryEvent & {
  id: string;
};

type EntryDisplayLine = {
  key: "mark" | "author" | "date" | "tx" | "height" | "message" | "subject" | "event";
  value: string;
  label?: string;
};

const actorLines = ["For humans.", "For agents.", "For organisations.", "For any resource that acts."];

const maxVisibleLines = 3;
const defaultLaw = surfaceLaws[0]!;

const prefersReducedMotion = ref(false);
const activeLawId = ref(defaultLaw.id);
const activeActorIndex = ref(0);
const selectedNetworkKey = ref<Network["key"]>("testnet");
const networkMenuOpen = ref(false);
const visibleCount = ref(0);
const typedLengths = ref<Record<string, number>>({});
const sealedEntryIds = ref(new Set<string>());
const liveAnnouncement = ref("");
const pollingPulse = ref(false);
const surfaceActionsEl = ref<HTMLElement | null>(null);

let motionQuery: MediaQueryList | null = null;
let entryTimer: number | undefined;
let typeTimer: number | undefined;
let actorTimer: number | undefined;
let lawTimer: number | undefined;
let pollingTimer: number | undefined;
let motionChangeHandler: ((event: MediaQueryListEvent) => void) | null = null;
let documentClickHandler: ((event: MouseEvent) => void) | null = null;
let documentKeydownHandler: ((event: KeyboardEvent) => void) | null = null;

const activeLaw = computed(() => surfaceLaws.find((law) => law.id === activeLawId.value) ?? defaultLaw);
const activeActorLine = computed(() => actorLines[activeActorIndex.value]);
const fullLawText = computed(() => `${activeLaw.value.number} / ${activeLaw.value.title} - ${activeLaw.value.paraphrase}`);
const selectedNetwork = computed(
  () => networks.find((network) => network.key === selectedNetworkKey.value) ?? networks[0]!,
);

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

function entryDisplayLines(entry: RegisterEntry): EntryDisplayLine[] {
  const lines: EntryDisplayLine[] = [
    { key: "mark", value: "EVENT" },
    { key: "author", label: "author", value: compactValue(entry.author) },
  ];

  if (entry.timestamp) {
    lines.push({ key: "date", label: "date", value: entry.timestamp });
  }

  lines.push(
    { key: "tx", label: "tx", value: shortValue(entry.tx) },
    { key: "height", label: "height", value: String(entry.height) },
    { key: "message", label: "msg", value: String(entry.messageIndex) },
    { key: "subject", value: entry.subject },
    { key: "event", value: entry.event },
  );

  return lines;
}

function displayLineText(line: EntryDisplayLine) {
  return line.label ? `${line.label} ${line.value}` : line.value;
}

function fullEntryText(entry: RegisterEntry) {
  return entryDisplayLines(entry).map(displayLineText).join("\n");
}

function currentTypedLength(entry: RegisterEntry) {
  if (prefersReducedMotion.value || isEntrySealed(entry)) {
    return fullEntryText(entry).length;
  }

  return typedLengths.value[entry.id] ?? 0;
}

function typedLine(entry: RegisterEntry, key: EntryDisplayLine["key"]) {
  const lines = entryDisplayLines(entry);
  const lineIndex = lines.findIndex((line) => line.key === key);
  if (lineIndex < 0) {
    return "";
  }

  const previousLength = lines
    .slice(0, lineIndex)
    .reduce((sum, line, index) => sum + displayLineText(line).length + (index === 0 ? 0 : 1), 0);
  const lineStart = previousLength + (lineIndex === 0 ? 0 : 1);
  const typedLength = currentTypedLength(entry);

  if (typedLength <= lineStart) {
    return "";
  }

  const text = displayLineText(lines[lineIndex]!);
  return text.slice(0, Math.min(text.length, typedLength - lineStart));
}

function typedValue(entry: RegisterEntry, key: EntryDisplayLine["key"]) {
  const line = entryDisplayLines(entry).find((candidate) => candidate.key === key);
  const text = typedLine(entry, key);

  if (!line?.label) {
    return text;
  }

  const prefix = `${line.label} `;
  if (text.length <= prefix.length) {
    return "";
  }

  return text.slice(prefix.length);
}

function hasTypedLine(entry: RegisterEntry, key: EntryDisplayLine["key"]) {
  return typedLine(entry, key).length > 0;
}

function selectNetwork(networkKey: Network["key"]) {
  const network = networks.find((entry) => entry.key === networkKey);
  if (!network || !network.selectable) {
    return;
  }

  selectedNetworkKey.value = network.key;
  networkMenuOpen.value = false;
}

function toggleNetworkMenu() {
  networkMenuOpen.value = !networkMenuOpen.value;
}

function closeNetworkMenu() {
  networkMenuOpen.value = false;
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

function scheduleNextEntry(delay = 620) {
  window.clearTimeout(entryTimer);
  entryTimer = window.setTimeout(revealNextEntry, delay);
}

function typeEntry(entry: RegisterEntry) {
  window.clearTimeout(typeTimer);

  const targetLength = fullEntryText(entry).length;
  const currentLength = typedLengths.value[entry.id] ?? 0;

  if (currentLength >= targetLength) {
    sealEntry(entry);
    scheduleNextEntry(860);
    return;
  }

  const nextCharacter = fullEntryText(entry)[currentLength] ?? "";
  const step = nextCharacter === " " || nextCharacter === "\n" ? 2 : 1;
  typedLengths.value = {
    ...typedLengths.value,
    [entry.id]: Math.min(targetLength, currentLength + step),
  };
  typeTimer = window.setTimeout(() => typeEntry(entry), 18 + Math.round(Math.random() * 24));
}

function revealNextEntry() {
  if (visibleCount.value >= registerEntries.value.length) {
    startPolling();
    return;
  }

  const nextEntry = registerEntries.value[visibleCount.value]!;
  visibleCount.value += 1;

  if (prefersReducedMotion.value) {
    typedLengths.value = {
      ...typedLengths.value,
      [nextEntry.id]: fullEntryText(nextEntry).length,
    };
    sealEntry(nextEntry);
    scheduleNextEntry(620);
    return;
  }

  typedLengths.value = {
    ...typedLengths.value,
    [nextEntry.id]: 0,
  };
  typeEntry(nextEntry);
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
  window.clearTimeout(typeTimer);
  window.clearInterval(pollingTimer);
  typedLengths.value = {};
  sealedEntryIds.value = new Set();
  liveAnnouncement.value = "";
  pollingPulse.value = false;

  if (prefersReducedMotion.value) {
    visibleCount.value = registerEntries.value.length;
    typedLengths.value = Object.fromEntries(
      registerEntries.value.map((entry) => [entry.id, fullEntryText(entry).length]),
    );
    sealedEntryIds.value = new Set(registerEntries.value.map((entry) => entry.id));
    activeActorIndex.value = 0;
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
  documentClickHandler = (event) => {
    const target = event.target as Node | null;
    const root = surfaceActionsEl.value;
    if (networkMenuOpen.value && root && target && !root.contains(target)) {
      closeNetworkMenu();
    }
  };
  documentKeydownHandler = (event) => {
    if (event.key === "Escape") {
      closeNetworkMenu();
    }
  };
  document.addEventListener("click", documentClickHandler);
  document.addEventListener("keydown", documentKeydownHandler);
  resetRegisterPlayback();
  startHeroRotation();
});

onBeforeUnmount(() => {
  window.clearTimeout(entryTimer);
  window.clearTimeout(typeTimer);
  window.clearInterval(actorTimer);
  window.clearInterval(lawTimer);
  window.clearInterval(pollingTimer);
  if (motionChangeHandler) {
    motionQuery?.removeEventListener("change", motionChangeHandler);
  }
  if (documentClickHandler) {
    document.removeEventListener("click", documentClickHandler);
  }
  if (documentKeydownHandler) {
    document.removeEventListener("keydown", documentKeydownHandler);
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
        <div ref="surfaceActionsEl" class="surface-actions">
          <button class="top-connect" type="button">Connect account</button>
          <span class="surface-actions-divider" aria-hidden="true">|</span>
          <button
            class="network-trigger"
            type="button"
            aria-haspopup="menu"
            :aria-expanded="networkMenuOpen"
            aria-controls="network-menu"
            @click="toggleNetworkMenu"
          >
            <span class="network-live-dot" aria-hidden="true" />
            <span>{{ selectedNetwork.displayName }}</span>
          </button>
          <div v-if="networkMenuOpen" id="network-menu" class="network-menu" role="menu" aria-label="Network selection">
            <button
              v-for="network in networks"
              :key="network.key"
              type="button"
              class="network-option"
              :class="{
                'is-active': selectedNetwork.key === network.key,
                'is-disabled': !network.selectable,
              }"
              role="menuitemradio"
              :aria-checked="selectedNetwork.key === network.key"
              :aria-disabled="!network.selectable"
              :disabled="!network.selectable"
              @click="selectNetwork(network.key)"
            >
              <span class="network-option-name">{{ network.displayName }}</span>
              <span class="network-option-state">
                <span class="network-option-chain">{{ network.chainId.toUpperCase() }}</span>
                <span v-if="!network.selectable" class="network-option-soon">soon</span>
              </span>
            </button>
          </div>
        </div>
      </nav>

      <header class="doctrine-hero">
        <Transition name="law-fade" mode="out-in">
          <p :key="activeLaw.id" class="law-line" :aria-label="fullLawText" aria-live="polite" aria-atomic="true">
            <span>{{ activeLaw.number }} / {{ activeLaw.title }}</span>
            <span class="law-separator" aria-hidden="true">-</span>
            <span class="law-paraphrase">{{ activeLaw.paraphrase }}</span>
          </p>
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
          <span><strong>8 217</strong> events on {{ selectedNetwork.chainId }}</span>
        </p>

        <div class="surface-gestures">
          <a href="#event-stream-title">Enter the stream <span aria-hidden="true">→</span></a>
          <button type="button">Connect account <span aria-hidden="true">{{ selectedNetwork.displayName }}</span></button>
        </div>
      </section>

      <section class="inscription-register" aria-labelledby="event-stream-title">
        <header class="register-head">
          <p id="event-stream-title">EVENT STREAM</p>
          <span>{{ selectedNetwork.displayName }}</span>
        </header>

        <TransitionGroup tag="ol" name="stream-line" class="inscription-lines" aria-label="Cosmos tx events">
          <li
            v-for="entry in renderedEntries"
            :id="entry.id"
            :key="entry.id"
            :data-height="entry.height"
            class="inscription-row"
            :class="{
              'is-sealed': isEntrySealed(entry),
              'is-latest': latestEntry?.id === entry.id,
              'is-polling': latestEntry?.id === entry.id && pollingPulse,
            }"
          >
            <article>
              <span class="entry-mark">{{ typedLine(entry, "mark") }}</span>
              <p class="entry-meta">
                <span v-if="hasTypedLine(entry, 'author')">
                  <em>author</em><code :title="entry.author">{{ typedValue(entry, "author") }}</code>
                </span>
                <span v-if="entry.timestamp && hasTypedLine(entry, 'date')">
                  <em>date</em><span>{{ typedValue(entry, "date") }}</span>
                </span>
                <span v-if="hasTypedLine(entry, 'tx')">
                  <em>tx</em><code :title="entry.tx">{{ typedValue(entry, "tx") }}</code>
                </span>
                <span v-if="hasTypedLine(entry, 'height')">
                  <em>height</em><span>{{ typedValue(entry, "height") }}</span>
                </span>
                <span v-if="hasTypedLine(entry, 'message')">
                  <em>msg</em><span>{{ typedValue(entry, "message") }}</span>
                </span>
              </p>
              <p v-if="hasTypedLine(entry, 'subject')" class="entry-subject">{{ typedLine(entry, "subject") }}</p>
              <p v-if="hasTypedLine(entry, 'event')" class="entry-event">{{ typedLine(entry, "event") }}</p>
            </article>
          </li>
        </TransitionGroup>
        <p class="polling-status" :class="{ 'is-active': pollingPulse, 'is-idle': latestSealed }" aria-hidden="true">
          <span class="polling-dot" />
          <span class="polling-label">{{ pollingPulse ? "Reading event stream" : "Listening for new events" }}</span>
        </p>
      </section>
    </section>

    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ liveAnnouncement }}</p>
  </main>
</template>
