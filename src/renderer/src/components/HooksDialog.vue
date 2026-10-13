<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{ open: boolean; info?: { url: string; listening: boolean } }>()
const emit = defineEmits<{ close: [] }>()

const copied = ref(false)
watch(() => props.open, () => (copied.value = false))

const EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'Notification',
  'Stop',
  'StopFailure',
  'SessionEnd'
]

const snippet = computed(() => {
  const url = props.info?.url ?? ''
  const hooks = Object.fromEntries(
    EVENTS.map((event) => [event, [{ hooks: [{ type: 'http', url, timeout: 5 }] }]])
  )
  return JSON.stringify({ hooks }, null, 2)
})

async function copy(): Promise<void> {
  await navigator.clipboard.writeText(snippet.value)
  copied.value = true
}
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="emit('close')">
    <section class="sheet">
      <h2>Exact status</h2>
      <p class="lede">
        Without this, status is guessed from the shape of the transcript. With it, Claude Code
        reports every change — including the ones no transcript shows, like a permission prompt or
        a rate limit.
      </p>

      <dl class="state">
        <dt>Listener</dt>
        <dd :class="{ on: info?.listening }">
          {{ info?.listening ? 'Running on 127.0.0.1:7878' : 'Not running — port in use?' }}
        </dd>
      </dl>

      <p class="lede">
        Merge this into <code>~/.claude/settings.json</code>. It is safe to leave in place: when
        rolly is closed the connection is refused, which Claude Code treats as non-blocking and
        ignores.
      </p>

      <pre>{{ snippet }}</pre>

      <footer>
        <span v-if="copied" class="copied">Copied</span>
        <button type="button" @click="emit('close')">Close</button>
        <button type="button" class="primary" @click="copy">Copy config</button>
      </footer>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.backdrop {
  position: fixed;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  inset: 0;
  background: rgb(0 0 0 / 55%);
}

.sheet {
  display: flex;
  width: 620px;
  max-height: 80vh;
  flex-direction: column;
  padding: 24px 26px 20px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-rail);
  gap: 14px;

  h2 {
    margin: 0;
    font-size: 17px;
  }
}

.lede {
  margin: 0;
  color: var(--text-dim);
  line-height: 1.5;

  code {
    font-family: var(--mono);
    font-size: 12px;
  }
}

.state {
  display: flex;
  margin: 0;
  align-items: baseline;
  gap: 10px;

  dt {
    color: var(--text-faint);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  dd {
    margin: 0;
    color: var(--danger);
    font-family: var(--mono);
    font-size: 12px;

    &.on {
      color: var(--done);
    }
  }
}

pre {
  overflow: auto;
  max-height: 34vh;
  margin: 0;
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--bg);
  color: var(--text-dim);
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.5;
}

footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;

  button {
    padding: 8px 14px;
  }

  .primary {
    border-color: var(--working);
    color: var(--working);
  }
}

.copied {
  margin-right: auto;
  color: var(--done);
  font-size: 12px;
}
</style>
