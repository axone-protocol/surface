<script setup lang="ts">
defineProps<{
  heading: string
  hasFooter?: boolean
}>()
</script>

<template>
  <div class="surface-dropdown" role="menu">
    <div class="surface-dropdown-heading">{{ heading }}</div>
    <div class="surface-dropdown-body">
      <slot />
    </div>
    <div v-if="hasFooter && $slots.footer" class="surface-dropdown-footer">
      <slot name="footer" />
    </div>
  </div>
</template>
