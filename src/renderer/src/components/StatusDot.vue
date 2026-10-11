<script setup lang="ts">
import type { SessionStatus } from '@shared/types'

defineProps<{ status: SessionStatus }>()
</script>

<template>
  <span class="dot" :class="status" />
</template>

<style lang="scss" scoped>
.dot {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-radius: 50%;

  &.needs-you {
    background: var(--needs-you);
  }
  &.working {
    background: var(--working);
  }
  &.done {
    background: var(--done);
  }
  &.idle {
    border: 1.5px solid var(--idle);
  }
}
</style>
