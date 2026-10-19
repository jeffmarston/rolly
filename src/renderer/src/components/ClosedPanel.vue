<script setup lang="ts">
import type { SessionRecord } from '@shared/types'
import { ref } from 'vue'
import BoardCard from './BoardCard.vue'

defineProps<{
  rows: SessionRecord[]
  now: number
  selectedId: string | null
  live: (id: string) => boolean
  open: boolean
}>()
const emit = defineEmits<{
  pick: [session: SessionRecord]
  drag: [id: string]
  close: [id: string]
  restore: [id: string]
  hide: []
}>()

const over = ref(false)

function receive(event: DragEvent): void {
  over.value = false
  const id = event.dataTransfer?.getData('text/plain')
  if (id) emit('close', id)
}
</script>

<template>
  <!-- Overlays the detail pane rather than pushing it: pushing would resize the pty. -->
  <aside
    class="closed"
    :class="{ open, over }"
    @dragover.prevent="over = true"
    @dragleave="over = false"
    @drop.prevent="receive"
  >
    <header>
      <h2>Closed</h2>
      <span class="count">{{ rows.length }}</span>
      <button type="button" class="hide" title="Hide closed sessions" @click="emit('hide')">
        ✕
      </button>
    </header>
    <p class="hint">Drag one back to the list, or reopen it here.</p>

    <div class="cards">
      <div v-for="session in rows" :key="session.id" class="row">
        <BoardCard
          :session="session"
          :now="now"
          :selected="session.id === selectedId"
          :live="live(session.id)"
          @pick="emit('pick', session)"
          @drag="emit('drag', $event)"
        />
        <button type="button" class="reopen" @click.stop="emit('restore', session.id)">
          Reopen
        </button>
      </div>
      <p v-if="!rows.length" class="none">Nothing closed.</p>
    </div>
  </aside>
</template>

<style lang="scss" scoped>
.closed {
  position: absolute;
  /* Under the sidebar, so it reads as sliding out from behind it. */
  z-index: 1;
  top: 0;
  bottom: 0;
  left: 0;
  display: flex;
  width: 300px;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background: linear-gradient(195deg, #141418 0%, #101012 100%);
  box-shadow: 14px 0 28px rgb(0 0 0 / 45%);
  transform: translateX(-100%);
  transition: transform 160ms ease;
  visibility: hidden;

  &.open {
    transform: translateX(0);
    visibility: visible;
  }

  /* The whole panel is the target, so the whole panel answers. */
  &.over::after {
    position: absolute;
    border: 1px solid var(--danger);
    border-radius: 11px;
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    content: '';
    inset: 0;
    pointer-events: none;
  }
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

  .hide {
    margin-left: auto;
    padding: 1px 6px 2px;
    border-color: transparent;
    background: none;
    box-shadow: none;
    color: var(--text-faint);
    font-size: 11px;

    &:hover {
      color: var(--text);
    }
  }
}

.hint,
.none {
  margin: 4px 14px 0;
  color: var(--text-faint);
  font-size: 11px;
}

.cards {
  display: flex;
  overflow-y: auto;
  flex: 1;
  flex-direction: column;
  padding: 10px 12px 12px;
  gap: 7px;
}

.row {
  position: relative;

  /** Nothing is running in here, so it reads quieter than the live list beside it. */
  .card {
    opacity: 0.5;
    filter: grayscale(0.8);
  }

  &:hover .card {
    opacity: 0.85;
  }

  .reopen {
    position: absolute;
    top: 7px;
    right: 7px;
    padding: 2px 7px;
    border-radius: 6px;
    font-size: 10px;
    opacity: 0;
  }

  &:hover .reopen {
    opacity: 1;
  }
}
</style>
