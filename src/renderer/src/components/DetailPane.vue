<script setup lang="ts">
import type { SessionRecord } from '@shared/types'
import type { Stage } from '@shared/types'
import { STAGE_LABEL, STAGE_ORDER, STATUS_LABEL, modelName } from '@shared/types'
import { relativeTime } from '@/time'
import { computed, ref, watch } from 'vue'
import { sessionLinks } from '@shared/links'
import { PR_GLYPH, prStateOf } from '@/prs'
import TerminalView from './TerminalView.vue'
import ContextMeter from './ContextMeter.vue'
import SessionInfo from './SessionInfo.vue'

const props = defineProps<{
  session: SessionRecord | null
  now: number
  live?: boolean
  stage?: Stage
  stageOverridden?: boolean
  jira?: { key: string; url: string }
  dismissed?: boolean
  /** Board layout: the meta row folds into the header and details move to the side panel. */
  compact?: boolean
}>()
const emit = defineEmits<{
  adopt: []
  close: []
  restore: []
  stage: [stage: Stage | null]
  createJira: []
}>()

const links = computed(() => (props.session ? sessionLinks(props.session) : []))
const expanded = ref(false)
watch(() => props.session?.id, () => (expanded.value = false))

function openLink(url: string): void {
  void window.rolly.openExternal(url)
}

async function copyResume(): Promise<void> {
  if (props.session) await window.rolly.copyResume(props.session.id)
}
</script>

<template>
  <section v-if="session" class="detail" :class="{ compact }">
    <header v-if="!compact">
      <h1>{{ session.title }}</h1>
      <span class="badge" :class="session.status">{{
        session.statusReason ?? STATUS_LABEL[session.status]
      }}</span>

      <span v-if="!compact" class="stages" :title="stageOverridden ? 'Set by you' : 'Classified automatically'">
        <button
          v-for="option in STAGE_ORDER"
          :key="option"
          type="button"
          :class="{ picked: option === stage }"
          @click="emit('stage', option === stage && stageOverridden ? null : option)"
        >
          {{ STAGE_LABEL[option] }}
        </button>
        <span v-if="!stageOverridden" class="auto">auto</span>
      </span>
      <span v-if="compact && links.length" class="chips">
        <button
          v-for="link in links"
          :key="link.url"
          :class="prStateOf(link.url)"
          type="button"
          :title="link.url"
          @click="openLink(link.url)"
        >
          <span v-if="prStateOf(link.url)" class="glyph">{{ PR_GLYPH[prStateOf(link.url)!] }}</span>
          {{ link.label }}
        </button>
      </span>

      <div class="actions">
        <button type="button" @click="copyResume">Copy resume command</button>
        <button v-if="dismissed" type="button" @click="emit('restore')">Reopen</button>
        <button
          v-else
          type="button"
          class="close"
          :title="
            live
              ? 'Ends the terminal and clears the row. Reopen brings it back.'
              : 'Clears the row. Reopen brings it back.'
          "
          @click="emit('close')"
        >
          Close
        </button>
        <button v-if="!live && !dismissed" type="button" class="primary" @click="emit('adopt')">
          Open here
        </button>
      </div>
    </header>

    <dl v-if="!compact" class="meta">
      <div class="jira">
        <dt>Jira</dt>
        <dd>
          <button v-if="jira" class="ticket" type="button" :title="jira.url" @click="openLink(jira.url)">
            {{ jira.key }} ↗
          </button>
          <button v-else class="ticket create" type="button" @click="emit('createJira')">
            Create ticket
          </button>
        </dd>
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

    <div v-if="links.length && !compact" class="prs">
      <button
        v-for="link in links"
        :key="link.url"
        :class="prStateOf(link.url)"
        type="button"
        :title="link.url"
        @click="openLink(link.url)"
      >
        <span v-if="prStateOf(link.url)" class="glyph">{{ PR_GLYPH[prStateOf(link.url)!] }}</span>
        {{ link.label }}
        <span v-if="prStateOf(link.url)" class="state">{{ prStateOf(link.url) }}</span>
        ↗
      </button>
    </div>

    <div class="work">
      <div class="stack">
        <blockquote
          v-if="session.summary"
          class="ask"
          :class="{ expanded }"
          :title="expanded ? '' : 'Click to expand'"
          @click="expanded = !expanded"
        >
          <span class="who">You</span>
          <p>{{ session.summary }}</p>
        </blockquote>

        <TerminalView v-if="live" :key="session.id" :pty-id="session.id" />

        <div v-else class="placeholder">
          <p>Rolly isn't driving this session.</p>
          <p class="hint">
            Opening it here resumes it in a terminal, replaying what came before. If it's also open
            somewhere else, both stay usable — they share the one transcript.
          </p>
          <button type="button" class="primary" @click="emit('adopt')">Open here</button>
        </div>
      </div>

      <SessionInfo
        v-if="compact"
        :session="session"
        :now="now"
        :live="live"
        :dismissed="dismissed"
        :jira="jira"
        @adopt="emit('adopt')"
        @close="emit('close')"
        @restore="emit('restore')"
        @create-jira="emit('createJira')"
        @resume="copyResume"
      />
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

.stages {
  display: flex;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;

  button {
    padding: 3px 9px;
    border-radius: 6px;
    color: var(--text-faint);
    font-size: 11px;

    &:hover {
      color: var(--text);
    }
    &.picked {
      border-color: var(--working);
      color: var(--working);
    }
  }

  .auto {
    color: var(--text-faint);
    font-size: 10px;
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

  .close {
    color: var(--text-dim);

    &:hover {
      border-color: var(--danger);
      color: var(--danger);
    }
  }
}

.work {
  display: flex;
  overflow: hidden;
  flex: 1;
  min-height: 0;
}

.work > :first-child {
  min-width: 0;
  flex: 1;
}

/** The ask rides above the terminal, not above the info panel beside it. */
.stack {
  display: flex;
  overflow: hidden;
  flex-direction: column;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  button {
    padding: 3px 8px;
    border-color: transparent;
    border-radius: 6px;
    background: var(--bg-raised);
    color: var(--text-dim);
    font-family: var(--mono);
    font-size: 11px;

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

  .jira {
    min-width: 180px;
    flex: 1;
  }

  .ticket {
    padding: 3px 10px;
    border-radius: 7px;
    color: var(--text);
    font-family: var(--mono);
    font-size: 12px;

    &:hover {
      border-color: var(--text-faint);
    }
    &.create {
      color: var(--text-faint);
    }
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

.prs {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  padding: 11px 28px;
  border-bottom: 1px solid var(--border);
  gap: 8px;

  button {
    padding: 5px 11px;
    border-radius: 7px;
    color: var(--text-dim);
    font-family: var(--mono);
    font-size: 12px;

    &:hover {
      border-color: currentcolor;
    }

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
    }
  }

  .glyph {
    font-size: 10px;
  }

  .state {
    opacity: 0.65;
  }
}

.ask {
  display: flex;
  flex: 0 0 auto;
  margin: 0;
  padding: 12px 28px 13px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-rail);
  cursor: pointer;
  gap: 12px;

  &:hover {
    background: var(--bg-hover);
  }

  .who {
    padding-top: 1px;
    color: var(--text-faint);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  p {
    display: -webkit-box;
    overflow: hidden;
    margin: 0;
    color: var(--text-dim);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    white-space: pre-wrap;
  }

  &.expanded p {
    max-height: 30vh;
    overflow-y: auto;
    -webkit-line-clamp: unset;
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
