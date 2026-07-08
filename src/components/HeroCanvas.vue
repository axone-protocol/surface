<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
  activeLawIndex: number;
  sealedCount: number;
  pollingActive: boolean;
  reducedMotion: boolean;
}>();

const mount = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);

let animationFrame: number | undefined;
let resizeObserver: ResizeObserver | undefined;
let elapsed = 0;
let lastSealCount = 0;
let sealPulse = 0;
let lastFrameTime = 0;
let running = false;
let width = 0;
let height = 0;

function seededRandom(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function lawAccent(index: number): string {
  const accents = ["#ded8c6", "#c5a766", "#9b9f96", "#b8925b", "#d0ad65", "#aaa08d"];
  return accents[Math.max(0, index) % accents.length] ?? "#ded8c6";
}

function resizeCanvas() {
  const el = mount.value;
  const node = canvas.value;
  if (!el || !node) {
    return;
  }

  const rect = el.getBoundingClientRect();
  width = Math.max(1, Math.floor(rect.width));
  height = Math.max(1, Math.floor(rect.height));
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  node.width = Math.floor(width * ratio);
  node.height = Math.floor(height * ratio);
  node.style.width = `${width}px`;
  node.style.height = `${height}px`;

  const context = node.getContext("2d");
  if (context) {
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  draw();
}

function clear(context: CanvasRenderingContext2D) {
  context.fillStyle = "#070504";
  context.fillRect(0, 0, width, height);
}

function drawTexture(context: CanvasRenderingContext2D) {
  context.save();
  context.strokeStyle = "#ded8c6";
  context.lineWidth = 1;

  const lineCount = width < 700 ? 18 : 28;
  for (let index = 0; index < lineCount; index += 1) {
    const y = height * (0.08 + seededRandom(index + 8) * 0.84);
    const x = width * (0.04 + seededRandom(index + 22) * 0.82);
    const length = width * (0.04 + seededRandom(index + 31) * 0.16);
    context.globalAlpha = 0.018 + seededRandom(index + 44) * 0.036;
    context.strokeStyle = index % 7 === 0 ? "#c5a766" : "#ded8c6";
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(Math.min(width * 0.96, x + length), y);
    context.stroke();
  }

  for (let index = 0; index < 84; index += 1) {
    const x = seededRandom(index + 100) * width;
    const y = seededRandom(index + 200) * height;
    const radius = 0.7 + seededRandom(index + 400) * 1.2;
    context.globalAlpha = 0.018 + seededRandom(index + 300) * 0.026;
    context.fillStyle = "#ded8c6";
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawInscriptions(context: CanvasRenderingContext2D, time: number) {
  const accent = lawAccent(props.activeLawIndex);
  const selectedAccent = accent;
  const left = width * 0.09;
  const right = width * 0.91;
  const top = height * 0.08;
  const bottom = height * 0.9;
  const columns = width < 900 ? [0.08, 0.92] : [0.09, 0.91];

  context.save();
  context.lineWidth = 1;

  columns.forEach((ratio, index) => {
    const x = width * ratio;
    context.globalAlpha = index === 0 || index === columns.length - 1 ? 0.06 : 0.035;
    context.strokeStyle = "#ded8c6";
    context.beginPath();
    context.moveTo(x, top);
    context.lineTo(x, bottom);
    context.stroke();
  });

  for (let index = 0; index < 10; index += 1) {
    const y = top + ((bottom - top) / 9) * index;
    const drift = props.reducedMotion ? 0 : Math.sin(time * 0.16 + index * 1.7) * 1.8;
    context.globalAlpha = index % 3 === 0 ? 0.054 : 0.026;
    context.strokeStyle = index === props.activeLawIndex + 2 ? selectedAccent : "#ded8c6";
    context.beginPath();
    context.moveTo(left, y + drift);
    context.lineTo(right, y + drift);
    context.stroke();
  }

  for (let index = 0; index < 6; index += 1) {
    const y = height * (0.18 + index * 0.1);
    const x = width * (0.14 + seededRandom(index + 61) * 0.42);
    const widthFragment = width * (0.08 + seededRandom(index + 81) * 0.16);
    context.globalAlpha = 0.08;
    context.fillStyle = index === props.activeLawIndex ? selectedAccent : "#ded8c6";
    context.fillRect(x, y, widthFragment, 1);
    context.globalAlpha = 0.045;
    context.fillStyle = "#ded8c6";
    context.fillRect(x, y + 8, widthFragment * 0.48, 1);
  }

  context.restore();
}

function drawSeals(context: CanvasRenderingContext2D) {
  const accent = lawAccent(props.activeLawIndex);
  const centerX = width < 900 ? width * 0.78 : width * 0.74;
  const centerY = width < 900 ? height * 0.18 : height * 0.74;
  const pulse = props.reducedMotion ? 0 : sealPulse;
  const radius = 16 + Math.min(props.sealedCount, 8) * 2.4 + pulse * 10;

  context.save();
  context.lineWidth = 1;
  context.strokeStyle = accent;
  context.globalAlpha = 0.1 + pulse * 0.18;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.stroke();

  context.globalAlpha = 0.07 + pulse * 0.12;
  context.strokeStyle = "#ded8c6";
  context.beginPath();
  context.arc(centerX, centerY, radius * 0.58, 0, Math.PI * 2);
  context.stroke();

  context.globalAlpha = 0.08 + pulse * 0.14;
  context.strokeStyle = accent;
  context.beginPath();
  context.moveTo(centerX - radius * 0.72, centerY);
  context.lineTo(centerX + radius * 0.72, centerY);
  context.stroke();
  context.restore();
}

function drawCursor(context: CanvasRenderingContext2D, time: number) {
  const accent = lawAccent(props.activeLawIndex);
  const baseX = width < 900 ? width * 0.86 : width * 0.88;
  const baseY = width < 900 ? height * 0.72 : height * 0.82;
  const travel = props.pollingActive ? 18 : 0;
  const motion = props.reducedMotion ? travel : travel + Math.sin(time * 2.2) * (props.pollingActive ? 2 : 0.8);

  context.save();
  context.fillStyle = accent;
  context.globalAlpha = props.pollingActive ? 0.58 : 0.26;
  context.fillRect(baseX + motion, baseY, 2, 42);
  context.globalAlpha = props.pollingActive ? 0.3 : 0.12;
  context.fillRect(baseX + motion - 14, baseY + 20, 28, 1);
  context.restore();
}

function draw() {
  const node = canvas.value;
  const context = node?.getContext("2d");
  if (!node || !context) {
    return;
  }

  const time = props.reducedMotion ? 0 : elapsed;
  clear(context);
  drawTexture(context);
  drawInscriptions(context, time);
  drawSeals(context);
  drawCursor(context, time);
}

function stopAnimation() {
  if (animationFrame !== undefined) {
    window.cancelAnimationFrame(animationFrame);
  }

  animationFrame = undefined;
  running = false;
  lastFrameTime = 0;
}

function step(now: number) {
  if (!running) {
    return;
  }

  if (props.reducedMotion) {
    draw();
    stopAnimation();
    return;
  }

  if (!props.reducedMotion) {
    const deltaMs = lastFrameTime === 0 ? 16 : now - lastFrameTime;
    lastFrameTime = now;
    elapsed += deltaMs / 1000;
    sealPulse = Math.max(0, sealPulse - deltaMs / 800);
  }

  draw();
  animationFrame = window.requestAnimationFrame(step);
}

function startAnimation() {
  if (running || props.reducedMotion) {
    return;
  }

  running = true;
  lastFrameTime = 0;
  animationFrame = window.requestAnimationFrame(step);
}

watch(
  () => [props.activeLawIndex, props.sealedCount, props.pollingActive, props.reducedMotion] as const,
  () => {
    if (props.sealedCount !== lastSealCount) {
      lastSealCount = props.sealedCount;
      sealPulse = props.reducedMotion ? 0 : 1;
    }

    draw();

    if (props.reducedMotion) {
      stopAnimation();
      return;
    }

    startAnimation();
  },
);

onMounted(() => {
  const observer = window.ResizeObserver;
  if (observer) {
    resizeObserver = new observer(() => resizeCanvas());
  }
  if (mount.value) {
    resizeObserver?.observe(mount.value);
  }

  resizeCanvas();
  draw();
  startAnimation();
});

onBeforeUnmount(() => {
  stopAnimation();
  resizeObserver?.disconnect();
});
</script>

<template>
  <div ref="mount" class="surface-canvas" aria-hidden="true">
    <canvas ref="canvas" />
  </div>
</template>
