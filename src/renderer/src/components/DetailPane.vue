<script setup lang="ts">
import type { SessionRecord } from '@shared/types'
import { STATUS_LABEL, modelName } from '@shared/types'
import { relativeTime, homeRelative } from '@/time'
import TerminalView from './TerminalView.vue'
import ContextMeter from './ContextMeter.vue'

const props = defineProps<{ session: SessionRecord | null; now: number; live?: boolean }>()
const emit = defineEmits<{ adopt: [] }>()

async function copyResume(): Promise<void> {
  if (props.session) await window.rolly.copyResume(props.session.id)
}
</script>

<template>
  <section v-if="session" class="detail">
    <header>
      <h1>{{ session.title }}</h1>
      <span class="badge" :class="session.status">{{ STATUS_LABEL[session.status] }}</span>
      <div class="actions">
        <button type="button" @click="copyResume">Copy resume command</button>
        <button v-if="!live" type="button" class="primary" @click="emit('adopt')">
          Open here
        </button>
      </div>
    </header>

    <dl class="meta">
      <div>
        <dt>Branch</dt>
        <dd>{{ session.gitBranch ?? '—' }}</dd>
      </div>
      <div class="folder">
        <dt>Folder</dt>
        <dd>{{ homeRelative(session.cwd) }}</dd>
      </div>
      <div>
        <dt>Model</dt>
        <dd>
          {{ modelName(session.model) }}
          <span v-if="session.effort" class="muted">· {{ session.effort }}</span>
          <span v-if="session.permissionMode" class="muted">· {{ session.permissionMode }}</span>
        </dd>
      </div>
      <div>
        <dt>Context</dt>
        <dd><ContextMeter :session="session" /></dd>
      </div>
      <div>
        <dt>Last activity</dt>
        <dd>{{ relativeTime(session.lastActivity, now) }}</dd>
      </div>
    </dl>

    <TerminalView v-if="live" :key="session.id" :pty-id="session.id" />

    <div v-else class="placeholder">
      <p>Rolly isn't driving this session.</p>
      <p class="hint">
        Opening it here resumes it in a terminal, replaying what came before. If it's also open
        somewhere else, both stay usable — they share the one transcript.
      </p>
      <button type="button" class="primary" @click="emit('adopt')">Open here</button>
    </div>
  </section>

  <section v-else class="empty">
    <p>Select a session.</p>
  </section>
</template>

<style lang="scss" scoped>
.detail {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 22px 28px 18px;
  -webkit-app-region: drag;
}

h1 {
  margin: 0;
  font-size: 20px;
}

.badge {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;

  &.needs-you {
    background: var(--banner);
    color: var(--needs-you);
  }
  &.working {
    color: var(--working);
  }
  &.done {
    color: var(--done);
  }
  &.idle {
    color: var(--idle);
  }
}

.actions {
  display: flex;
  margin-left: auto;
  gap: 10px;
  -webkit-app-region: no-drag;

  button {
    padding: 8px 14px;
  }

  .primary {
    border-color: var(--working);
    color: var(--working);
  }
}

.meta {
  display: flex;
  gap: 42px;
  margin: 0;
  padding: 0 28px 20px;
  border-bottom: 1px solid var(--border);

  > div {
    min-width: 0;
  }

  .folder {
    flex: 1;
  }

  dt {
    white-space: nowrap;
    color: var(--text-faint);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .muted {
    margin-left: 4px;
    color: var(--text-faint);
  }

  dd {
    overflow: hidden;
    margin: 6px 0 0;
    font-family: var(--mono);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.placeholder {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-dim);

  .hint {
    margin: 0;
    color: var(--text-faint);
    font-size: 13px;
  }

  .hint {
    max-width: 48ch;
    text-align: center;
  }

  button {
    margin-top: 6px;
    padding: 8px 16px;
  }
}

.empty {
  display: grid;
  flex: 1;
  color: var(--text-faint);
  place-items: center;
}
</style>
