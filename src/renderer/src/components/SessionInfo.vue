<script setup lang="ts">
import { computed, nextTick, ref, toRaw, watch } from 'vue'
import type { SessionRecord } from '@shared/types'
import { STATUS_LABEL, modelName } from '@shared/types'
import { jiraIssues, sessionLinks } from '@shared/links'
import { PR_GLYPH, prStateOf } from '@/prs'
import { rename } from '@/stages'
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

/** The aliases `/model` takes. The transcript reports the full id back, so the line updates itself. */
const MODELS = ['opus', 'sonnet', 'fable', 'haiku']

/** What was asked for, until the session's next reply stamps the real id in the transcript. */
const asked = ref<{ alias: string; at: string }>()
const picking = ref(false)
const editing = ref(false)
const draftName = ref('')
const nameBox = ref<HTMLInputElement>()

/** Typing into a permission prompt would answer it, so the offer is gone while one is up. */
const canPick = computed(
  () => !!props.live && props.session.statusReason !== 'Waiting on permission'
)

/** The transcript records a model only when the session replies, so until then show the ask. */
const shownModel = computed(() => {
  const ask = asked.value
  const replied =
    props.session.lastRole === 'assistant' && (props.session.lastActivity ?? '') > (ask?.at ?? '')
  return !ask || replied ? modelName(props.session.model) : ask.alias
})

watch(
  () => props.session.id,
  () => {
    asked.value = undefined
    picking.value = false
    editing.value = false
  }
)

async function startEdit(): Promise<void> {
  draftName.value = props.session.title
  editing.value = true
  await nextTick()
  nameBox.value?.select()
}

function commit(): void {
  if (!editing.value) return
  editing.value = false
  rename(props.session, draftName.value)
}

/** Switching model is a command typed into the session; there is no other way to ask. */
function setModel(alias: string): void {
  picking.value = false
  if (!canPick.value) return
  window.rolly.pty.input(props.session.id, `/model ${alias}\r`)
  asked.value = { alias, at: props.session.lastActivity ?? new Date().toISOString() }
}

const links = computed(() => sessionLinks(props.session))

/** The ticket rolly opened, then any the session filed itself. */
const tickets = computed(() => {
  const filed = jiraIssues(props.session)
  const opened = props.jira
  return opened ? [opened, ...filed.filter((t) => t.key !== opened.key)] : filed
})

function open(url: string): void {
  void window.rolly.openExternal(url)
}

/** A session can work anywhere — a worktree, a sibling repo — so follow its edits, then its cwd. */
const diffDirs = computed(() =>
  [...props.session.workDirs, props.session.cwd].filter((dir): dir is string => !!dir)
)

function openDiff(): void {
  void window.rolly.diff.open({ id: props.session.id, dirs: toRaw(diffDirs.value) })
}
</script>

<template>
  <aside class="info">
    <h1 v-if="!editing">
      {{ session.title }}
      <button type="button" class="pencil" title="Rename session" @click="startEdit">✎</button>
    </h1>
    <input
      v-else
      ref="nameBox"
      v-model="draftName"
      class="rename"
      placeholder="Empty restores the original"
      @keyup.enter="commit"
      @keyup.escape="editing = false"
      @blur="commit"
    />
    <p class="state" :class="session.status">
      {{ session.statusReason ?? STATUS_LABEL[session.status] }}
      <span class="age">· {{ relativeTime(session.lastActivity, now) }}</span>
    </p>

    <section>
      <h2>Jira</h2>
      <button
        v-for="ticket in tickets"
        :key="ticket.key"
        class="ticket"
        type="button"
        :title="ticket.url"
        @click="open(ticket.url)"
      >
        {{ ticket.key }} ↗
      </button>
      <button
        v-if="!tickets.length"
        class="ticket create"
        type="button"
        @click="emit('createJira')"
      >
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

    <section class="model">
      <h2>Model</h2>
      <!-- Reads as the same line it always was; only a live session can act on a click. -->
      <button
        type="button"
        class="value"
        :class="{ pick: canPick }"
        :title="canPick ? 'Change model' : 'Only a running session can change model'"
        @click="picking = canPick && !picking"
      >
        <span :class="{ asked: shownModel !== modelName(session.model) }">{{ shownModel }}</span>
        <span v-if="session.effort" class="muted">{{ session.effort }}</span>
        <span v-if="session.permissionMode" class="muted">{{ session.permissionMode }}</span>
      </button>
      <template v-if="picking">
        <div class="scrim" @click="picking = false" />
        <menu class="menu">
          <li v-for="alias in MODELS" :key="alias">
            <button type="button" @click="setModel(alias)">{{ alias }}</button>
          </li>
        </menu>
      </template>
    </section>

    <section>
      <h2>Context</h2>
      <ContextMeter :session="session" />
    </section>

    <footer>
      <button v-if="diffDirs.length" type="button" @click="openDiff">Diff</button>
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

h1 .pencil {
  padding: 0 4px;
  border: 0;
  background: none;
  box-shadow: none;
  color: var(--text-faint);
  font-size: 12px;
  opacity: 0;

  &:hover {
    color: var(--text);
  }
}

.info:hover h1 .pencil {
  opacity: 1;
}

.rename {
  padding: 2px 6px;
  border: 1px solid var(--text-faint);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font-family: inherit;
  font-size: 16px;
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
  padding: 0;
  border: 0;
  background: none;
  box-shadow: none;
  color: var(--text);
  cursor: default;
  font-family: var(--mono);
  font-size: 12px;
  text-align: left;

  /* Asked for, not confirmed: the transcript stamps the real id on the next reply. */
  .asked {
    color: var(--working);
    font-style: italic;
  }

  &.pick {
    cursor: pointer;

    &:hover {
      color: var(--working);
    }
  }

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

.model {
  position: relative;
}

/* Catches the click that dismisses the menu without stealing the one that opens it. */
.scrim {
  position: fixed;
  z-index: 1;
  inset: 0;
}

.menu {
  position: absolute;
  z-index: 2;
  top: 100%;
  left: 0;
  display: flex;
  min-width: 120px;
  flex-direction: column;
  margin: 2px 0 0;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-raised);
  box-shadow: 0 10px 24px rgb(0 0 0 / 45%);
  gap: 1px;
  list-style: none;

  button {
    width: 100%;
    padding: 5px 8px;
    border: 0;
    border-radius: 5px;
    background: none;
    box-shadow: none;
    color: var(--text-dim);
    font-family: var(--mono);
    font-size: 12px;
    text-align: left;

    &:hover {
      background: var(--bg-hover);
      color: var(--text);
    }
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
