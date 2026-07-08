<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";

import HeroCanvas from "./components/HeroCanvas.vue";
import { surfaceLaws } from "./surfaceLaws";
import { isProtocolFact, registryItems, type RegistryItem } from "./surfaceRegistry";

type RegisterMode = "chain" | "surface";

type RegisterEntry = {
  id: string;
  mode: RegisterMode;
  source: "CHAIN" | "SURFACE";
  kind: string;
  title: string;
  verb: string;
  criticalValue: string;
  criticalHref: string;
  block: string;
  timestamp: string;
  lawId: string;
  inscription: string;
  referenceLine: string;
};

const actorLines = [
  "For humans.",
  "For agents.",
  "For organisations.",
  "For any resource that acts.",
];

const maxVisibleLines = 7;
const defaultLaw = surfaceLaws[0]!;

const prefersReducedMotion = ref(false);
const activeLawId = ref(defaultLaw.id);
const activeActorIndex = ref(0);
const visibleCount = ref(0);
const typedLengths = ref<Record<string, number>>({});
const sealedEntryIds = ref(new Set<string>());
const liveAnnouncement = ref("");
const pollingPulse = ref(false);
const registerListEl = ref<HTMLOListElement | null>(null);

let motionQuery: MediaQueryList | null = null;
let entryTimer: number | undefined;
let typeTimer: number | undefined;
let actorTimer: number | undefined;
let lawTimer: number | undefined;
let pollingTimer: number | undefined;
let motionChangeHandler: ((event: MediaQueryListEvent) => void) | null = null;

const activeLaw = computed(() => surfaceLaws.find((law) => law.id === activeLawId.value) ?? defaultLaw);
const activeActorLine = computed(() => actorLines[activeActorIndex.value]);
const fullLawText = computed(() => `${activeLaw.value.number} / ${activeLaw.value.title} - ${activeLaw.value.paraphrase}`);

function fullEntryText(entry: RegisterEntry) {
  return `${entry.inscription}\n${entry.referenceLine}\n${entry.timestamp}`;
}

function detailValue(item: RegistryItem, labels: string[]) {
  const labelsToFind = labels.map((label) => label.toLowerCase());
  return item.details.find((detail) => labelsToFind.includes(detail.label.toLowerCase()))?.value;
}

function firstCodeValue(item: RegistryItem) {
  return item.details.find((detail) => detail.code)?.value ?? item.title;
}

function shortValue(value: string) {
  if (value.length <= 30) {
    return value;
  }

  return `${value.slice(0, 18)}...${value.slice(-8)}`;
}

function compactReference(value: string) {
  const didParts = value.split(":");
  const lastPart = didParts[didParts.length - 1] ?? value;

  if (value.startsWith("did:pkh:")) {
    return shortValue(lastPart);
  }

  return shortValue(value);
}

function normalizeVerb(status: string) {
  const [, action] = status.split("/");
  return (action ?? status).trim().toLowerCase();
}

function eventType(item: RegistryItem) {
  if (isProtocolFact(item)) {
    return item.status;
  }

  return `${item.kind.replace("_", " ")} / INTERPRETED`;
}

function compactReferenceLine(item: RegistryItem, critical: string) {
  const subject = detailValue(item, ["type", "revision", "capability", "interpreted as"]);
  return [compactReference(critical), subject, `block ${item.block}`].filter(Boolean).join(" · ");
}

function interpretedBasis(item: RegistryItem) {
  return detailValue(item, ["basis"]) ?? item.relations.find((relation) => relation.basis)?.basis ?? item.summary;
}

function interpretedPolicy(item: RegistryItem) {
  return detailValue(item, ["policy"]) ?? item.relations.find((relation) => relation.policy)?.policy ?? "surface-recognition v1";
}

function criticalHref(entryId: string) {
  return `#${entryId}`;
}

function lawForItem(item: RegistryItem) {
  if (!isProtocolFact(item)) {
    return "law-ii";
  }

  if (item.kind === "VERDICT") {
    return "law-v";
  }

  if (item.kind === "GOVERNANCE") {
    return "law-vi";
  }

  if (item.kind === "CREDENTIAL") {
    return "law-iii";
  }

  return "law-i";
}

function entryFromItem(item: RegistryItem): RegisterEntry {
  if (isProtocolFact(item)) {
    const critical =
      detailValue(item, ["transaction", "case", "account", "authority", "subject", "issuer", "revision"]) ?? firstCodeValue(item);

    return {
      id: item.id,
      mode: "chain",
      source: "CHAIN",
      kind: item.kind.toLowerCase(),
      title: item.title,
      verb: normalizeVerb(item.status),
      criticalValue: critical,
      criticalHref: criticalHref(item.id),
      block: item.block,
      timestamp: item.timestamp,
      lawId: lawForItem(item),
      inscription: eventType(item),
      referenceLine: compactReferenceLine(item, critical),
    };
  }

  const policy = interpretedPolicy(item);

  return {
    id: item.id,
    mode: "surface",
    source: "SURFACE",
    kind: item.kind.toLowerCase().replace("_", " "),
    title: item.title,
    verb: "interpreted",
    criticalValue: policy,
    criticalHref: criticalHref(item.id),
    block: item.block,
    timestamp: item.timestamp,
    lawId: lawForItem(item),
    inscription: eventType(item),
    referenceLine: `${item.title} · ${policy} · block ${item.block}`,
  };
}

const registerEntries = computed(() =>
  registryItems
    .map(entryFromItem)
    .sort((left, right) => Number(left.block) - Number(right.block)),
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

function typedText(entry: RegisterEntry) {
  if (prefersReducedMotion.value) {
    return entry.inscription;
  }

  return entry.inscription.slice(0, typedLengths.value[entry.id] ?? 0);
}

function typedReference(entry: RegisterEntry) {
  if (prefersReducedMotion.value || isEntrySealed(entry)) {
    return entry.referenceLine;
  }

  const referenceStart = entry.inscription.length + 1;
  const currentLength = typedLengths.value[entry.id] ?? 0;

  if (currentLength <= referenceStart) {
    return "";
  }

  return entry.referenceLine.slice(0, Math.min(entry.referenceLine.length, currentLength - referenceStart));
}

function typedTimestamp(entry: RegisterEntry) {
  if (prefersReducedMotion.value || isEntrySealed(entry)) {
    return entry.timestamp;
  }

  const timestampStart = entry.inscription.length + entry.referenceLine.length + 2;
  const currentLength = typedLengths.value[entry.id] ?? 0;

  if (currentLength <= timestampStart) {
    return "";
  }

  return entry.timestamp.slice(0, currentLength - timestampStart);
}

function hasTypedReference(entry: RegisterEntry) {
  return typedReference(entry).length > 0;
}

function hasTypedTimestamp(entry: RegisterEntry) {
  return typedTimestamp(entry).length > 0;
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
  liveAnnouncement.value = `${entry.source}: ${entry.kind} ${entry.title} stabilized at block ${entry.block}.`;
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

function revealNextEntry() {
  if (visibleCount.value >= registerEntries.value.length) {
    startPolling();
    return;
  }

  const nextEntry = registerEntries.value[visibleCount.value]!;
  visibleCount.value += 1;

  if (prefersReducedMotion.value) {
    typedLengths.value = { ...typedLengths.value, [nextEntry.id]: fullEntryText(nextEntry).length };
    sealEntry(nextEntry);
    scrollRegisterToEnd(false);
    scheduleNextEntry(420);
    return;
  }

  typedLengths.value = { ...typedLengths.value, [nextEntry.id]: 0 };
  scrollRegisterToEnd(true);
  typeEntry(nextEntry);
}

function typeEntry(entry: RegisterEntry) {
  window.clearTimeout(typeTimer);

  const currentLength = typedLengths.value[entry.id] ?? 0;
  const targetLength = fullEntryText(entry).length;
  if (currentLength >= targetLength) {
    sealEntry(entry);
    scheduleNextEntry(1180);
    return;
  }

  const nextCharacter = fullEntryText(entry)[currentLength];
  typedLengths.value = {
    ...typedLengths.value,
    [entry.id]: Math.min(targetLength, currentLength + (nextCharacter === " " ? 2 : 1)),
  };
  scrollRegisterToEnd(false);
  typeTimer = window.setTimeout(() => typeEntry(entry), 24 + Math.random() * 34);
}

function scheduleNextEntry(delay = 620) {
  window.clearTimeout(entryTimer);
  entryTimer = window.setTimeout(revealNextEntry, delay);
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
    typedLengths.value = Object.fromEntries(registerEntries.value.map((entry) => [entry.id, fullEntryText(entry).length]));
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
  window.clearTimeout(typeTimer);
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
          <span><strong>8 217</strong> identities on-chain</span>
        </p>

        <div class="surface-gestures">
          <a href="#chain-register-title">Enter the surface <span aria-hidden="true">→</span></a>
          <button type="button">Connect account <span aria-hidden="true">→</span></button>
        </div>
      </section>

      <section class="inscription-register" aria-labelledby="chain-register-title">
        <header class="register-head">
          <p id="chain-register-title">CHAIN REGISTRY</p>
        </header>

        <ol ref="registerListEl" class="inscription-lines" aria-label="Fixture-backed writing registry">
          <li
            v-for="entry in renderedEntries"
            :id="entry.id"
            :key="entry.id"
            class="inscription-row"
            :class="[
              `is-${entry.mode}`,
              {
                'is-sealed': isEntrySealed(entry),
                'is-latest': latestEntry?.id === entry.id,
                'is-polling': latestEntry?.id === entry.id && pollingPulse,
              },
            ]"
          >
            <article>
              <span class="source-mark">{{ entry.source }}</span>
              <span class="line-body">{{ typedText(entry) }}</span>
              <a
                v-if="isEntrySealed(entry)"
                class="critical-link"
                :href="entry.criticalHref"
                :aria-label="`${entry.title}: ${entry.criticalValue}`"
              >
                {{ shortValue(entry.criticalValue) }}
              </a>
              <span v-if="hasTypedReference(entry)" class="reference-line">{{ typedReference(entry) }}</span>
              <span v-if="hasTypedTimestamp(entry)" class="line-time">
                {{ typedTimestamp(entry) }}
              </span>
            </article>
          </li>
        </ol>
        <p class="polling-status" :class="{ 'is-active': pollingPulse, 'is-idle': latestSealed }" aria-hidden="true">
          <span class="polling-dot" />
          <span class="polling-label">{{ pollingPulse ? "Reading chain state" : "Listening for new entries" }}</span>
        </p>
      </section>
    </section>

    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ liveAnnouncement }}</p>
  </main>
</template>
