<script setup lang="ts">
import { computed } from 'vue'
import type { SessionRecord } from '@shared/types'
import { STATUS_LABEL, modelName } from '@shared/types'
import { sessionLinks } from '@shared/links'
import { PR_GLYPH, prStateOf } from '@/prs'
import { relativeTime } from '@/time'
import ContextMeter from './ContextMeter.vue'

const props = defineProps<{
  session: SessionRecord
  now: number
  live?: boolean
  dismissed?: boolean
  jira?: { key: string; url: string }
}>()
const emit = defineEmits<{ adopt: []; close: []; restore: []; createJira: []; resume: [] }>()

const links = computed(() => sessionLinks(props.session))

function open(url: string): void {
  void window.rolly.openExternal(url)
}
</script>

<template>
  <aside class="info">
    <h1>{{ session.title }}</h1>
    <p class="state" :class="session.status">
      {{ session.statusReason ?? STATUS_LABEL[session.status] }}
      <span class="age">· {{ relativeTime(session.lastActivity, now) }}</span>
    </p>

    <section>
      <h2>Jira</h2>
      <button v-if="jira" class="ticket" type="button" :title="jira.url" @click="open(jira.url)">
        {{ jira.key }} ↗
      </button>
      <button v-else class="ticket create" type="button" @click="emit('createJira')">
        Create ticket
      </button>
    </section>

    <section v-if="links.length">
      <h2>Pull requests</h2>
      <button
        v-for="link in links"
        :key="link.url"
        class="pr"
        :class="prStateOf(link.url)"
        type="button"
        :title="link.url"
        @click="open(link.url)"
      >
        <span v-if="prStateOf(link.url)" class="glyph">{{ PR_GLYPH[prStateOf(link.url)!] }}</span>
        {{ link.label }}
      </button>
    </section>

    <section>
      <h2>Model</h2>
      <p class="value">
        {{ modelName(session.model) }}
        <span v-if="session.effort" class="muted">{{ session.effort }}</span>
        <span v-if="session.permissionMode" class="muted">{{ session.permissionMode }}</span>
      </p>
    </section>

    <section>
      <h2>Context</h2>
      <ContextMeter :session="session" />
    </section>

    <footer>
      <button type="button" @click="emit('resume')">Copy resume command</button>
      <button v-if="dismissed" type="button" @click="emit('restore')">Reopen</button>
      <button v-else type="button" class="danger" @click="emit('close')">Close session</button>
    </footer>
  </aside>
</template>

<style lang="scss" scoped>
.info {
  display: flex;
  overflow-y: auto;
  width: 250px;
  flex: 0 0 250px;
  flex-direction: column;
  padding: 16px 18px 14px;
  border-left: 1px solid var(--border);
  background: linear-gradient(195deg, #1c1c20 0%, #141416 100%);
  box-shadow: inset 1px 0 0 rgb(255 255 255 / 5%), -10px 0 24px rgb(0 0 0 / 35%);
  gap: 18px;

  h1 {
    margin: 0;
    font-size: 16px;
    line-height: 1.3;
  }
}

.state {
  margin: -12px 0 0;
  font-size: 12px;

  &.needs-you {
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

  .age {
    color: var(--text-faint);
  }
}

section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

h2 {
  margin: 0;
  color: var(--text-faint);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.value {
  margin: 0;
  font-family: var(--mono);
  font-size: 12px;

  .muted {
    color: var(--text-faint);

    &::before {
      content: '· ';
    }
  }
}

.ticket,
.pr {
  max-width: 100%;
  padding: 4px 9px;
  overflow: hidden;
  border-color: rgb(255 255 255 / 6%);
  border-radius: 6px;
  background: linear-gradient(180deg, #26262b 0%, #1d1d21 100%);
  box-shadow: var(--edge), var(--lift-1);
  color: var(--text-dim);
  font-family: var(--mono);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    border-color: var(--text-faint);
  }
}

.pr {
  &.open {
    color: var(--done);
  }
  &.draft {
    color: var(--text-faint);
  }
  &.merged {
    color: var(--merged);
  }
  &.closed {
    color: var(--danger);
    text-decoration: line-through;
  }

  .glyph {
    font-size: 9px;
  }
}

footer {
  display: flex;
  margin-top: auto;
  padding-top: 14px;
  flex-direction: column;
  gap: 7px;

  button {
    padding: 7px 10px;
  }

  .danger:hover {
    border-color: var(--danger);
    color: var(--danger);
  }
}
</style>
