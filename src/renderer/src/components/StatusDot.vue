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
    background: radial-gradient(circle at 35% 30%, #f3c173, var(--needs-you));
    box-shadow: 0 0 9px 1px color-mix(in srgb, var(--needs-you) 70%, transparent);
  }
  &.working {
    background: radial-gradient(circle at 35% 30%, #8fc4ff, var(--working));
    box-shadow: 0 0 9px 1px color-mix(in srgb, var(--working) 70%, transparent);
  }
  &.done {
    background: radial-gradient(circle at 35% 30%, #7fe3b6, var(--done));
    box-shadow: 0 0 9px 1px color-mix(in srgb, var(--done) 60%, transparent);
  }
  &.idle {
    border: 1.5px solid var(--idle);
    box-shadow: inset 0 0 4px rgb(0 0 0 / 60%);
  }
}
</style>
