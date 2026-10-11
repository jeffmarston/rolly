<script setup lang="ts">
import { computed } from 'vue'
import type { SessionRecord } from '@shared/types'
import { contextShare } from '@shared/types'

const props = defineProps<{ session: SessionRecord; compact?: boolean }>()

const share = computed(() => contextShare(props.session))
const level = computed(() => {
  const value = share.value ?? 0
  if (value >= 0.9) return 'critical'
  if (value >= 0.7) return 'high'
  return 'normal'
})

const percent = computed(() => (share.value === undefined ? '—' : `${Math.round(share.value * 100)}%`))
const detail = computed(() =>
  share.value === undefined
    ? 'No usage recorded yet'
    : `${compactTokens(props.session.contextTokens!)} of ${compactTokens(props.session.contextLimit!)} tokens`
)

function compactTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}
</script>

<template>
  <span v-if="compact" class="chip" :class="level" :title="detail">{{ percent }} full</span>

  <div v-else class="meter" :class="level" :title="detail">
    <span class="value">{{ percent }}</span>
    <span class="of">of {{ compactTokens(session.contextLimit ?? 0) }}</span>
    <span class="track"><span class="fill" :style="{ width: `${(share ?? 0) * 100}%` }" /></span>
  </div>
</template>

<style lang="scss" scoped>
.meter {
  display: grid;
  grid-template-columns: auto auto;
  width: 118px;
  column-gap: 6px;

  .value {
    font-family: var(--mono);
    font-size: 13px;
  }

  .of {
    align-self: baseline;
    color: var(--text-faint);
    font-size: 11px;
  }

  .track {
    overflow: hidden;
    width: 100%;
    height: 3px;
    grid-column: 1 / -1;
    margin-top: 7px;
    border-radius: 2px;
    background: var(--bg-raised);
  }

  .fill {
    display: block;
    height: 100%;
    background: var(--text-faint);
  }

  &.high .fill {
    background: var(--needs-you);
  }
  &.critical .fill {
    background: var(--danger);
  }
}

.chip {
  padding: 1px 6px;
  border: 1px solid var(--needs-you);
  border-radius: 999px;
  color: var(--needs-you);
  font-size: 10px;

  &.critical {
    border-color: var(--danger);
    color: var(--danger);
  }
}
</style>
