<script setup lang="ts">
import type { SessionRecord } from '@shared/types'
import { contextShare } from '@shared/types'
import { relativeTime } from '@/time'
import StatusDot from './StatusDot.vue'

const props = defineProps<{
  session: SessionRecord
  now: number
  selected: boolean
  live?: boolean
}>()
const emit = defineEmits<{ pick: []; drag: [id: string] }>()

function start(event: DragEvent): void {
  event.dataTransfer?.setData('text/plain', props.session.id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  emit('drag', props.session.id)
}
</script>

<template>
  <article
    class="card"
    :class="{ selected, waiting: session.status === 'needs-you' }"
    draggable="true"
    @dragstart="start"
    @dragend="emit('drag', '')"
    @click="emit('pick')"
  >
    <StatusDot :status="session.status" />
    <span class="title">{{ session.title }}</span>
    <span v-if="live" class="live" title="Terminal attached">live</span>
    <span v-if="(contextShare(session) ?? 0) >= 0.9" class="full">full</span>
    <span class="age">{{ relativeTime(session.lastActivity, now) }}</span>
  </article>
</template>

<style lang="scss" scoped>
.card {
  display: flex;
  align-items: center;
  padding: 11px 13px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--bg-raised);
  cursor: grab;
  gap: 9px;

  &:active {
    cursor: grabbing;
  }
  &:hover {
    border-color: var(--text-faint);
  }
  &.selected {
    border-color: var(--working);
  }
  &.waiting {
    border-color: color-mix(in srgb, var(--needs-you) 45%, var(--border));
    background: color-mix(in srgb, var(--needs-you) 7%, var(--bg-raised));
  }
}

.title {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.age {
  color: var(--text-faint);
  font-size: 12px;
}

.live {
  padding: 1px 6px;
  border: 1px solid var(--working);
  border-radius: 999px;
  color: var(--working);
  font-size: 10px;
}

.full {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--banner);
  color: var(--danger);
  font-size: 10px;
}
</style>
