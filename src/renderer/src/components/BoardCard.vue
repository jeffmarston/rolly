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
    <div class="body">
      <div class="line">
        <span class="title">{{ session.title }}</span>
        <span v-if="live" class="live" title="Terminal attached">live</span>
        <span v-if="(contextShare(session) ?? 0) >= 0.9" class="full">full</span>
        <span class="age">{{ relativeTime(session.lastActivity, now) }}</span>
      </div>
      <p v-if="session.summary" class="ask" :title="session.summary">{{ session.summary }}</p>
    </div>
  </article>
</template>

<style lang="scss" scoped>
.card {
  display: flex;
  align-items: flex-start;
  padding: 10px 13px 11px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background:
    var(--sheen),
    linear-gradient(180deg, #232327 0%, #1b1b1e 100%);
  box-shadow: var(--edge), var(--lift-1);
  cursor: grab;
  gap: 10px;
  transition:
    transform 110ms ease,
    box-shadow 110ms ease,
    border-color 110ms ease;

  &:active {
    cursor: grabbing;
    box-shadow: inset 0 2px 6px rgb(0 0 0 / 50%);
    transform: translateY(1px) scale(0.997);
  }
  &:hover {
    border-color: var(--text-faint);
    box-shadow: var(--edge-strong), var(--lift-2);
    transform: translateY(-1px);
  }
  &.selected {
    border-color: var(--working);
    box-shadow:
      var(--edge-strong),
      var(--lift-2),
      0 0 0 1px color-mix(in srgb, var(--working) 45%, transparent),
      0 0 18px color-mix(in srgb, var(--working) 22%, transparent);
  }
  &.waiting {
    border-color: color-mix(in srgb, var(--needs-you) 45%, var(--border));
    background:
      var(--sheen),
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--needs-you) 13%, #232327) 0%,
        color-mix(in srgb, var(--needs-you) 5%, #1b1b1e) 100%
      );
    box-shadow:
      var(--edge-strong),
      var(--lift-1),
      0 0 16px color-mix(in srgb, var(--needs-you) 14%, transparent);
  }
}

:deep(.dot) {
  margin-top: 6px;
}

.body {
  min-width: 0;
  flex: 1;
}

.line {
  display: flex;
  align-items: baseline;
  gap: 9px;
}

.title {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/** The last thing he asked for — what the session is actually about. */
.ask {
  overflow: hidden;
  margin: 3px 0 0;
  color: var(--text-faint);
  font-size: 12px;
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
