<script setup lang="ts">
import { ref } from 'vue'
import type { SessionRecord } from '@shared/types'

defineProps<{
  label: string
  hint: string
  rows: SessionRecord[]
  waiting: number
  accent: string
}>()
const emit = defineEmits<{ drop: [id: string] }>()

const over = ref(false)

function receive(event: DragEvent): void {
  over.value = false
  const id = event.dataTransfer?.getData('text/plain')
  if (id) emit('drop', id)
}
</script>

<template>
  <section
    class="column"
    :class="{ over }"
    :title="hint"
    @dragover.prevent="over = true"
    @dragleave="over = false"
    @drop.prevent="receive"
  >
    <header>
      <span class="dot" :style="{ background: accent, boxShadow: `0 0 10px 1px ${accent}` }" />
      <h2>{{ label }}</h2>
      <span class="count">{{ rows.length }}</span>
      <span v-if="waiting" class="waiting">{{ waiting }} needs you</span>
    </header>

    <div class="cards">
      <slot />
      <p v-if="!rows.length" class="none">{{ over ? 'Drop here' : 'Nothing here' }}</p>
    </div>

  </section>
</template>

<style lang="scss" scoped>
.column {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  padding: 12px 12px 8px;
  border: 1px solid var(--border);
  border-radius: 13px;
  /* Recessed: the well the cards sit in, so the cards read as on top of it. */
  background: linear-gradient(180deg, #141417 0%, #17171a 100%);
  box-shadow:
    inset 0 1px 3px rgb(0 0 0 / 55%),
    0 1px 0 rgb(255 255 255 / 4%);
  transition:
    border-color 120ms ease,
    box-shadow 120ms ease;

  &.over {
    border-color: var(--working);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--working) 10%, #141417) 0%,
      color-mix(in srgb, var(--working) 4%, #17171a) 100%
    );
    box-shadow:
      inset 0 1px 3px rgb(0 0 0 / 40%),
      0 0 0 1px color-mix(in srgb, var(--working) 35%, transparent),
      0 0 22px color-mix(in srgb, var(--working) 18%, transparent);
  }
}

header {
  display: flex;
  align-items: center;
  padding: 0 2px 10px;
  gap: 8px;

  h2 {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .count {
    color: var(--text-faint);
    font-size: 11px;
  }

  .waiting {
    margin-left: auto;
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--banner);
    color: var(--needs-you);
    font-size: 11px;
  }
}

.cards {
  display: flex;
  overflow-y: auto;
  flex: 1;
  flex-direction: column;
  gap: 7px;
}

.none {
  margin: 0;
  padding: 18px 0;
  color: var(--text-faint);
  font-size: 12px;
  text-align: center;
}
</style>
