<script setup lang="ts">
const props = defineProps<{
  polling: boolean;
  loading: boolean;
  error?: string;
}>();
</script>

<template>
  <p class="chain-polling-status" :class="{ 'is-active': polling || loading, 'is-error': !!error }">
    <span class="chain-polling-dots" aria-hidden="true">
      <span class="chain-polling-dot chain-polling-dot-a" />
      <span class="chain-polling-dot chain-polling-dot-b" />
      <span class="chain-polling-dot chain-polling-dot-c" />
    </span>
    <span class="sr-only" v-if="error">{{ error }}</span>
    <span class="sr-only" v-else-if="loading">Listening to chain</span>
    <span class="sr-only" v-else-if="polling">Reading new events</span>
    <span class="sr-only" v-else>Chain register idle</span>
  </p>
</template>
