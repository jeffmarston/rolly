<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { acquire, type Pane } from '@/terminals'

const props = defineProps<{ ptyId: string }>()

const host = ref<HTMLDivElement>()
let pane: Pane | undefined
let observer: ResizeObserver | undefined

function reflow(): void {
  if (!pane || !host.value?.clientHeight) return
  pane.fit.fit()
  window.rolly.pty.resize(props.ptyId, pane.term.cols, pane.term.rows)
}

async function show(id: string): Promise<void> {
  pane = await acquire(id)
  // A late await can land after the view moved on; the latest id wins.
  if (id !== props.ptyId || !host.value) return
  host.value.appendChild(pane.element)
  reflow()
  pane.term.focus()
}

function detach(): void {
  pane?.element.remove()
  pane = undefined
}

onMounted(() => {
  observer = new ResizeObserver(() => reflow())
  if (host.value) observer.observe(host.value)
  void show(props.ptyId)
})

watch(
  () => props.ptyId,
  (id) => {
    detach()
    void show(id)
  }
)

onBeforeUnmount(() => {
  observer?.disconnect()
  detach()
})
</script>

<template>
  <div ref="host" class="terminal" />
</template>

<style lang="scss">
.terminal {
  overflow: hidden;
  min-height: 0;
  flex: 1;
  background: var(--bg);

  .pane,
  .xterm {
    height: 100%;
  }
}
</style>
