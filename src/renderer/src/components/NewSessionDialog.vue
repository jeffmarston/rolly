<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { homeRelative } from '@/time'

const props = defineProps<{ open: boolean; folders: string[]; workspace: string }>()
const emit = defineEmits<{
  start: [payload: { cwd: string; name: string }]
  close: []
}>()

const cwd = ref('')
const name = ref('')
const nameField = ref<HTMLInputElement>()

const canStart = computed(() => !!cwd.value && !!name.value.trim())

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    cwd.value = props.folders[0] ?? ''
    name.value = ''
    await nextTick()
    nameField.value?.focus()
  }
)

async function browse(): Promise<void> {
  const picked = await window.rolly.pickFolder()
  if (picked) cwd.value = picked
}

function start(): void {
  if (!canStart.value) return
  emit('start', { cwd: cwd.value, name: name.value.trim() })
}
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
    <section class="dialog">
      <h2>New session</h2>

      <label for="session-name">Name</label>
      <input
        id="session-name"
        ref="nameField"
        v-model="name"
        placeholder="What is this session for?"
        @keydown.enter="start"
        @keydown.esc="emit('close')"
      />

      <label>Folder</label>
      <ul class="folders">
        <li v-for="folder in folders" :key="folder">
          <button type="button" :class="{ picked: folder === cwd }" @click="cwd = folder">
            {{ folder === workspace ? 'Rolly workspace' : homeRelative(folder) }}
            <span v-if="folder === workspace" class="note">no repo — read a repo's CLAUDE.md before editing it</span>
          </button>
        </li>
        <li v-if="cwd && !folders.includes(cwd)">
          <button type="button" class="picked" @click="browse">{{ homeRelative(cwd) }}</button>
        </li>
      </ul>
      <button type="button" class="browse" @click="browse">Choose another folder…</button>

      <footer>
        <button type="button" @click="emit('close')">Cancel</button>
        <button type="button" class="primary" :disabled="!canStart" @click="start">
          Start session
        </button>
      </footer>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.backdrop {
  position: fixed;
  display: grid;
  background: #00000088;
  inset: 0;
  place-items: center;
}

.dialog {
  display: flex;
  width: 480px;
  max-height: 80vh;
  flex-direction: column;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-rail);

  h2 {
    margin: 0 0 18px;
    font-size: 17px;
  }

  label {
    margin-bottom: 7px;
    color: var(--text-faint);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  input {
    margin-bottom: 18px;
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);

    &:focus {
      border-color: var(--working);
      outline: none;
    }
  }
}

.folders {
  overflow-y: auto;
  margin: 0 0 8px;
  padding: 0;
  list-style: none;

  button {
    display: block;
    width: 100%;
    padding: 8px 10px;
    border: 0;
    color: var(--text-dim);
    font-family: var(--mono);
    font-size: 12px;
    text-align: left;

    &:hover {
      background: var(--bg-hover);
    }
    &.picked {
      background: var(--bg-raised);
      color: var(--text);
    }

    .note {
      display: block;
      margin-top: 2px;
      color: var(--text-faint);
      font-family: var(--sans);
      font-size: 10px;
    }
  }
}

.browse {
  padding: 8px 10px;
  border: 0;
  color: var(--working);
  font-size: 12px;
  text-align: left;
}

footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
  gap: 10px;

  button {
    padding: 8px 16px;
  }

  .primary {
    border-color: var(--working);
    color: var(--working);
  }
}
</style>
