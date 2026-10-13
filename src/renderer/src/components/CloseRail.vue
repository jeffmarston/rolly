<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ count: number; dragging: boolean; open: boolean }>()
const emit = defineEmits<{ drop: [id: string]; toggle: [] }>()

const over = ref(false)

function receive(event: DragEvent): void {
  over.value = false
  const id = event.dataTransfer?.getData('text/plain')
  if (id) emit('drop', id)
}
</script>

<template>
  <button
    class="rail"
    :class="{ over, armed: dragging, open }"
    type="button"
    :title="open ? 'Hide closed sessions' : 'Show closed sessions'"
    @dragover.prevent="over = true"
    @dragleave="over = false"
    @drop.prevent="receive"
    @click="emit('toggle')"
  >
    <span class="label">{{ dragging ? 'Drop to close' : 'Closed' }}</span>
    <span class="count">{{ count }}</span>
  </button>
</template>

<style lang="scss" scoped>
.rail {
  display: flex;
  width: 46px;
  flex: 0 0 46px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
  border: 1px dashed var(--border);
  border-radius: 13px;
  background: transparent;
  color: var(--text-faint);
  gap: 12px;

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
}

.label {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  writing-mode: vertical-rl;
}

.count {
  font-size: 12px;
}
</style>
