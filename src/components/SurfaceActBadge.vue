<script setup lang="ts">
import { computed } from "vue";

import { surfaceActKindCategories, type SurfaceActKind } from "../domain/surface-act";

const props = defineProps<{
  kind: SurfaceActKind;
}>();

const label = computed(() => surfaceActKindCategories[props.kind]);
</script>

<template>
  <span class="surface-act-badge" :data-kind="kind">{{ label }}</span>
</template>
