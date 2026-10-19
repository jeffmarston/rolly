<script setup lang="ts">
import type { SessionRecord } from '@shared/types'
import { ref } from 'vue'
import BoardCard from './BoardCard.vue'

defineProps<{
  rows: SessionRecord[]
  closedCount: number
  now: number
  selectedId: string | null
  live: (id: string) => boolean
  dragging: boolean
  showClosed: boolean
}>()
const emit = defineEmits<{
  pick: [session: SessionRecord]
  drag: [id: string]
  close: [id: string]
  restore: [id: string]
  toggleClosed: []
}>()

const overTarget = ref(false)
const overList = ref(false)

function dropToRestore(event: DragEvent): void {
  overList.value = false
  const id = event.dataTransfer?.getData('text/plain')
  if (id) emit('restore', id)
}

function dropToClose(event: DragEvent): void {
  overTarget.value = false
  const id = event.dataTransfer?.getData('text/plain')
  if (id) emit('close', id)
}
</script>

<template>
  <aside class="list">
    <header>
      <h2>Sessions</h2>
      <span class="count">{{ rows.length }}</span>
    </header>

    <!-- The inverse of dropping onto Closed: drag one back here and it comes back. -->
    <div
      class="cards"
      :class="{ over: overList }"
      @dragover.prevent="overList = true"
      @dragleave="overList = false"
      @drop.prevent="dropToRestore"
    >
      <BoardCard
        v-for="session in rows"
        :key="session.id"
        :session="session"
        :now="now"
        :selected="session.id === selectedId"
        :live="live(session.id)"
        @pick="emit('pick', session)"
        @drag="emit('drag', $event)"
      />
      <p v-if="!rows.length" class="none">No open sessions.</p>
    </div>

    <button
      type="button"
      class="target"
      :class="{ over: overTarget, armed: dragging, open: showClosed }"
      :title="showClosed ? 'Hide closed sessions' : 'Show closed sessions'"
      @dragover.prevent="overTarget = true"
      @dragleave="overTarget = false"
      @drop.prevent="dropToClose"
      @click="emit('toggleClosed')"
    >
      <span>{{ dragging ? 'Drop to close' : 'Closed' }}</span>
      <span class="count">{{ closedCount }}</span>
    </button>
  </aside>
</template>

<style lang="scss" scoped>
.list {
  position: relative;
  z-index: 2;
  display: flex;
  width: 320px;
  flex: 0 0 320px;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background: linear-gradient(195deg, #1a1a1e 0%, #141416 100%);
}

header {
  display: flex;
  align-items: center;
  padding: 14px 14px 0;
  gap: 8px;

  h2 {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .count {
    color: var(--text-faint);
    font-size: 11px;
  }
}

.cards {
  display: flex;
  overflow-y: auto;
  flex: 1;
  flex-direction: column;
  padding: 12px;
  border: 1px solid transparent;
  border-radius: 11px;
  gap: 7px;

  &.over {
    border-color: var(--done);
    background: color-mix(in srgb, var(--done) 7%, transparent);
  }
}

.none {
  margin: 0;
  padding: 18px 2px;
  color: var(--text-faint);
  font-size: 11px;
}

.target {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 12px 12px;
  padding: 11px 13px;
  border: 1px dashed var(--border);
  border-radius: 11px;
  background: transparent;
  color: var(--text-faint);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;

  &.armed {
    border-color: var(--text-faint);
    color: var(--text-dim);
  }
  &.over {
    border-color: var(--danger);
    border-style: solid;
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    color: var(--danger);
  }
  &.open {
    border-style: solid;
    color: var(--text-dim);
  }

  .count {
    letter-spacing: normal;
  }
}
</style>
