<script setup lang="ts">
import { Application, Graphics } from 'pixi.js'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  activeLawIndex: number
  sealedCount: number
  pollingActive: boolean
  reducedMotion: boolean
}>()

const mount = ref<HTMLDivElement | null>(null)

let animationFrame: number | undefined
let resizeObserver: ResizeObserver | undefined
let application: Application | undefined
let background: Graphics | undefined
let texture: Graphics | undefined
let inscriptions: Graphics | undefined
let seals: Graphics | undefined
let cursor: Graphics | undefined
let elapsed = 0
let lastSealCount = 0
let sealPulse = 0
let lastFrameTime = 0
let running = false
let width = 0
let height = 0
let destroyed = false

function seededRandom(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function lawAccent(index: number): string {
  const accents = ['#ded8c6', '#c5a766', '#9b9f96', '#b8925b', '#d0ad65', '#aaa08d']
  return accents[Math.max(0, index) % accents.length] ?? '#ded8c6'
}

function resizeRenderer() {
  const el = mount.value
  if (!el || !application) {
    return
  }

  const rect = el.getBoundingClientRect()
  width = Math.max(1, Math.floor(rect.width))
  height = Math.max(1, Math.floor(rect.height))
  application.renderer.resize(width, height)

  draw()
}

function drawBackground() {
  background?.clear().rect(0, 0, width, height).fill('#070504')
}

function drawTexture() {
  texture?.clear()
  if (!texture) {
    return
  }

  const lineCount = width < 700 ? 18 : 28
  for (let index = 0; index < lineCount; index += 1) {
    const y = height * (0.08 + seededRandom(index + 8) * 0.84)
    const x = width * (0.04 + seededRandom(index + 22) * 0.82)
    const length = width * (0.04 + seededRandom(index + 31) * 0.16)
    texture
      .moveTo(x, y)
      .lineTo(Math.min(width * 0.96, x + length), y)
      .stroke({
        color: index % 7 === 0 ? '#c5a766' : '#ded8c6',
        alpha: 0.018 + seededRandom(index + 44) * 0.036,
        width: 1,
      })
  }

  for (let index = 0; index < 84; index += 1) {
    const x = seededRandom(index + 100) * width
    const y = seededRandom(index + 200) * height
    const radius = 0.7 + seededRandom(index + 400) * 1.2
    texture.circle(x, y, radius).fill({
      color: '#ded8c6',
      alpha: 0.018 + seededRandom(index + 300) * 0.026,
    })
  }
}

function drawInscriptions(time: number) {
  const graphics = inscriptions
  if (!graphics) {
    return
  }
  graphics.clear()

  const accent = lawAccent(props.activeLawIndex)
  const selectedAccent = accent
  const left = width * 0.09
  const right = width * 0.91
  const top = height * 0.08
  const bottom = height * 0.9
  const columns = width < 900 ? [0.08, 0.92] : [0.09, 0.91]

  columns.forEach((ratio, index) => {
    const x = width * ratio
    graphics
      .moveTo(x, top)
      .lineTo(x, bottom)
      .stroke({
        color: '#ded8c6',
        alpha: index === 0 || index === columns.length - 1 ? 0.06 : 0.035,
        width: 1,
      })
  })

  for (let index = 0; index < 10; index += 1) {
    const y = top + ((bottom - top) / 9) * index
    const drift = props.reducedMotion ? 0 : Math.sin(time * 0.16 + index * 1.7) * 1.8
    graphics
      .moveTo(left, y + drift)
      .lineTo(right, y + drift)
      .stroke({
        color: index === props.activeLawIndex + 2 ? selectedAccent : '#ded8c6',
        alpha: index % 3 === 0 ? 0.054 : 0.026,
        width: 1,
      })
  }

  for (let index = 0; index < 6; index += 1) {
    const y = height * (0.18 + index * 0.1)
    const x = width * (0.14 + seededRandom(index + 61) * 0.42)
    const widthFragment = width * (0.08 + seededRandom(index + 81) * 0.16)
    graphics.rect(x, y, widthFragment, 1).fill({
      color: index === props.activeLawIndex ? selectedAccent : '#ded8c6',
      alpha: 0.08,
    })
    graphics.rect(x, y + 8, widthFragment * 0.48, 1).fill({ color: '#ded8c6', alpha: 0.045 })
  }
}

function drawSeals() {
  seals?.clear()
  if (!seals) {
    return
  }

  const accent = lawAccent(props.activeLawIndex)
  const centerX = width < 900 ? width * 0.78 : width * 0.74
  const centerY = width < 900 ? height * 0.18 : height * 0.74
  const pulse = props.reducedMotion ? 0 : sealPulse
  const radius = 16 + Math.min(props.sealedCount, 8) * 2.4 + pulse * 10

  seals.circle(centerX, centerY, radius).stroke({
    color: accent,
    alpha: 0.1 + pulse * 0.18,
    width: 1,
  })
  seals.circle(centerX, centerY, radius * 0.58).stroke({
    color: '#ded8c6',
    alpha: 0.07 + pulse * 0.12,
    width: 1,
  })
  seals
    .moveTo(centerX - radius * 0.72, centerY)
    .lineTo(centerX + radius * 0.72, centerY)
    .stroke({
      color: accent,
      alpha: 0.08 + pulse * 0.14,
      width: 1,
    })
}

function drawCursor(time: number) {
  cursor?.clear()
  if (!cursor) {
    return
  }

  const accent = lawAccent(props.activeLawIndex)
  const baseX = width < 900 ? width * 0.86 : width * 0.88
  const baseY = width < 900 ? height * 0.72 : height * 0.82
  const travel = props.pollingActive ? 18 : 0
  const motion = props.reducedMotion
    ? travel
    : travel + Math.sin(time * 2.2) * (props.pollingActive ? 2 : 0.8)

  cursor.rect(baseX + motion, baseY, 2, 42).fill({
    color: accent,
    alpha: props.pollingActive ? 0.58 : 0.26,
  })
  cursor.rect(baseX + motion - 14, baseY + 20, 28, 1).fill({
    color: accent,
    alpha: props.pollingActive ? 0.3 : 0.12,
  })
}

function draw() {
  if (!application || !background || !texture || !inscriptions || !seals || !cursor) {
    return
  }

  const time = props.reducedMotion ? 0 : elapsed
  drawBackground()
  drawTexture()
  drawInscriptions(time)
  drawSeals()
  drawCursor(time)
}

function stopAnimation() {
  if (animationFrame !== undefined) {
    window.cancelAnimationFrame(animationFrame)
  }

  animationFrame = undefined
  running = false
  lastFrameTime = 0
}

function step(now: number) {
  if (!running) {
    return
  }

  if (props.reducedMotion) {
    draw()
    stopAnimation()
    return
  }

  if (!props.reducedMotion) {
    const deltaMs = lastFrameTime === 0 ? 16 : now - lastFrameTime
    lastFrameTime = now
    elapsed += deltaMs / 1000
    sealPulse = Math.max(0, sealPulse - deltaMs / 800)
  }

  draw()
  animationFrame = window.requestAnimationFrame(step)
}

function startAnimation() {
  if (running || props.reducedMotion) {
    return
  }

  running = true
  lastFrameTime = 0
  animationFrame = window.requestAnimationFrame(step)
}

watch(
  () =>
    [props.activeLawIndex, props.sealedCount, props.pollingActive, props.reducedMotion] as const,
  () => {
    if (props.sealedCount !== lastSealCount) {
      lastSealCount = props.sealedCount
      sealPulse = props.reducedMotion ? 0 : 1
    }

    draw()

    if (props.reducedMotion) {
      stopAnimation()
      return
    }

    startAnimation()
  },
)

onMounted(async () => {
  const renderer = new Application()
  await renderer.init({
    antialias: true,
    autoDensity: true,
    backgroundAlpha: 0,
    height: 1,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    width: 1,
  })

  if (destroyed || !mount.value) {
    renderer.destroy()
    return
  }

  application = renderer
  background = new Graphics()
  texture = new Graphics()
  inscriptions = new Graphics()
  seals = new Graphics()
  cursor = new Graphics()
  application.stage.addChild(background, texture, inscriptions, seals, cursor)
  application.canvas.setAttribute('aria-hidden', 'true')
  mount.value.append(application.canvas)

  const observer = window.ResizeObserver
  if (observer) {
    resizeObserver = new observer(() => resizeRenderer())
  }
  if (mount.value) {
    resizeObserver?.observe(mount.value)
  }

  resizeRenderer()
  draw()
  startAnimation()
})

onBeforeUnmount(() => {
  destroyed = true
  stopAnimation()
  resizeObserver?.disconnect()
  application?.destroy()
  application = undefined
  background = undefined
  texture = undefined
  inscriptions = undefined
  seals = undefined
  cursor = undefined
})
</script>

<template>
  <div ref="mount" class="surface-canvas" aria-hidden="true" />
</template>
