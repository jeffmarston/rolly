<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import type { SessionRecord, SessionStatus, Stage } from '@shared/types'
import { STAGE_HINT, STAGE_LABEL, STAGE_ORDER, STATUS_LABEL, STATUS_ORDER } from '@shared/types'
import { release } from './terminals'
import { hydratePrs } from './prs'
import {
  dismiss,
  hydrateState,
  isCollapsed,
  isDismissed,
  restore,
  isOverridden,
  jiraFor,
  setJira,
  setStage,
  stageOf,
  toggleCollapsed
} from './stages'
import SessionRow from './components/SessionRow.vue'
import StatusDot from './components/StatusDot.vue'
import DetailPane from './components/DetailPane.vue'
import NewSessionDialog from './components/NewSessionDialog.vue'
import JiraDialog from './components/JiraDialog.vue'
import HooksDialog from './components/HooksDialog.vue'

const sessions = ref<SessionRecord[]>([])
/** Rows for sessions rolly just spawned, until the watcher sees their transcript. */
const provisional = ref<SessionRecord[]>([])
const liveIds = ref<string[]>([])
const selectedId = ref<string | null>(null)
const filter = ref('')
const now = ref(Date.now())
const showNew = ref(false)
const workspace = ref('')
const showJira = ref(false)
const showHooks = ref(false)
const hookInfo = ref<{ url: string; listening: boolean }>()

function ticketCreated(issue: { key: string; url: string }): void {
  if (selectedId.value) setJira(selectedId.value, issue)
  showJira.value = false
}

let stopUpdates: (() => void) | undefined
let stopPrs: (() => void) | undefined
let stopExits: (() => void) | undefined
let clock: ReturnType<typeof setInterval> | undefined

const rows = computed(() => {
  const known = new Set(sessions.value.map((session) => session.id))
  return [...provisional.value.filter((row) => !known.has(row.id)), ...sessions.value]
})

function isLive(id: string): boolean {
  return liveIds.value.includes(id)
}

/** Rolly's own workspace first, then every folder it has seen a session in. */
const folders = computed(() => [
  ...new Set(
    [workspace.value, ...rows.value.map((session) => session.cwd)].filter(
      (cwd): cwd is string => !!cwd
    )
  )
])

function track(id: string, cwd: string, title: string, gitBranch?: string): void {
  provisional.value.unshift({
    id,
    file: '',
    projectDir: '',
    cwd,
    gitBranch,
    title,
    messageCount: 0,
    stage: 'shape',
    edits: 0,
    pullRequestUrls: [],
    status: 'working',
    pullRequests: null,
    lastActivity: new Date().toISOString()
  })
  liveIds.value = [...liveIds.value, id]
  selectedId.value = id
}

async function startSession({ cwd, name }: { cwd: string; name: string }): Promise<void> {
  showNew.value = false
  track(await window.rolly.pty.start({ cwd, name }), cwd, name)
}

/** The transcript outlives the terminal, so closing is reversible: Open here resumes it. */
async function closeSession(): Promise<void> {
  const id = selectedId.value
  if (!id) return
  await window.rolly.pty.close(id)
  dismiss(id)
  selectedId.value = groups.value[0]?.rows[0]?.id ?? null
}

function restoreSession(): void {
  if (selectedId.value) restore(selectedId.value)
}

/** Resuming replays the prior turns into the pane, so an adopted session opens in context. */
async function adopt(): Promise<void> {
  const session = selected.value
  if (!session?.cwd || isLive(session.id)) return

  await window.rolly.pty.start({ cwd: session.cwd, resumeId: session.id })
  liveIds.value = [...liveIds.value, session.id]
}

const counts = computed(() =>
  STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABEL[status],
    count: rows.value.filter((session) => session.status === status).length
  }))
)

const visible = computed(() => {
  const needle = filter.value.trim().toLowerCase()
  if (!needle) return rows.value
  return rows.value.filter((session) =>
    [session.title, session.gitBranch, session.cwd, session.summary]
      .join(' ')
      .toLowerCase()
      .includes(needle)
  )
})

const groups = computed(() => {
  const open = visible.value.filter((session) => !isDismissed(session))
  const lifecycle = STAGE_ORDER.map((stage) => {
    const rows = open.filter((session) => stageOf(session) === stage).sort(byUrgency)
    return {
      key: stage as string,
      label: STAGE_LABEL[stage],
      hint: STAGE_HINT[stage],
      rows,
      waiting: rows.filter((session) => session.status === 'needs-you').length
    }
  })

  const closed = visible.value.filter(isDismissed).sort(byUrgency)
  return [
    ...lifecycle,
    { key: 'closed', label: 'Closed', hint: 'Closed by you — reopening brings it back', rows: closed, waiting: 0 }
  ].filter((group) => group.rows.length > 0)
})

/** Urgency cuts across the lifecycle axis, so it sorts within a stage rather than above it. */
function byUrgency(a: SessionRecord, b: SessionRecord): number {
  return rank(a) - rank(b)
}

function rank(session: SessionRecord): number {
  if (session.status === 'needs-you') return 0
  return session.status === 'done' ? 2 : 1
}

function changeStage(stage: Stage | null): void {
  if (selectedId.value) setStage(selectedId.value, stage)
}

const selected = computed(
  () => rows.value.find((session) => session.id === selectedId.value) ?? null
)

function applySessions(next: SessionRecord[]): void {
  sessions.value = next
  if (!selectedId.value && next.length) selectedId.value = next[0].id
}

onMounted(async () => {
  await hydrateState()
  stopPrs = await hydratePrs()
  workspace.value = await window.rolly.workspace()
  hookInfo.value = await window.rolly.hooks.info()
  stopUpdates = window.rolly.onUpdate(applySessions)
  stopExits = window.rolly.pty.onExit(({ id }) => {
    liveIds.value = liveIds.value.filter((live) => live !== id)
    // Let the pane unmount before the terminal behind it is disposed.
    void nextTick(() => release(id))
  })
  applySessions(await window.rolly.list())
  liveIds.value = await window.rolly.pty.alive()
  clock = setInterval(() => {
    now.value = Date.now()
    // The exit event is the fast path; this is the one that cannot drift.
    void window.rolly.pty.alive().then((ids) => (liveIds.value = ids))
  }, 15_000)
})

onUnmounted(() => {
  stopUpdates?.()
  stopExits?.()
  stopPrs?.()
  clearInterval(clock)
})
</script>

<template>
  <div class="shell">
    <aside class="rail">
      <header>
        <h2>Sessions</h2>
        <button type="button" @click="showNew = true">New session</button>
      </header>

      <ul class="counts">
        <li v-for="entry in counts" :key="entry.status">
          <StatusDot :status="entry.status as SessionStatus" />
          <strong>{{ entry.count }}</strong>
          <span>{{ entry.label }}</span>
        </li>
      </ul>

      <input v-model="filter" type="search" placeholder="Filter by title, branch or folder" />

      <div class="list">
        <section v-for="group in groups" :key="group.key">
          <button class="group" type="button" :title="group.hint" @click="toggleCollapsed(group.key)">
            <span class="chevron">{{ isCollapsed(group.key) ? '▸' : '▾' }}</span>
            <span class="label">{{ group.label }}</span>
            <span class="count">{{ group.rows.length }}</span>
            <span v-if="group.waiting" class="waiting">{{ group.waiting }} needs you</span>
          </button>

          <template v-if="!isCollapsed(group.key)">
            <SessionRow
              v-for="session in group.rows"
              :key="session.id"
              :session="session"
              :now="now"
              :selected="session.id === selectedId"
              :live="isLive(session.id)"
              @click="selectedId = session.id"
            />
          </template>
        </section>

        <p v-if="!visible.length" class="none">
          {{ rows.length ? 'No sessions match.' : 'No sessions found yet.' }}
        </p>
      </div>

      <footer>
        <span>Watching ~/.claude/projects</span>
        <button type="button" class="hooks" @click="showHooks = true">
          {{ hookInfo?.listening ? 'Exact status' : 'Status inferred' }}
        </button>
      </footer>
    </aside>

    <DetailPane
      :session="selected"
      :now="now"
      :live="selected ? isLive(selected.id) : false"
      :stage="selected ? stageOf(selected) : undefined"
      :stage-overridden="selected ? isOverridden(selected) : false"
      :jira="selected ? jiraFor(selected) : undefined"
      :dismissed="selected ? isDismissed(selected) : false"
      @adopt="adopt"
      @close="closeSession"
      @restore="restoreSession"
      @stage="changeStage"
      @create-jira="showJira = true"
    />

    <HooksDialog :open="showHooks" :info="hookInfo" @close="showHooks = false" />

    <JiraDialog
      :open="showJira"
      :session="selected"
      @close="showJira = false"
      @created="ticketCreated"
    />

    <NewSessionDialog
      :open="showNew"
      :workspace="workspace"
      :folders="folders"
      @start="startSession"
      @close="showNew = false"
    />
  </div>
</template>

<style lang="scss" scoped>
.shell {
  display: flex;
  height: 100%;
}

.rail {
  display: flex;
  width: 360px;
  flex: 0 0 360px;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background: var(--bg-rail);

  header {
    display: flex;
    align-items: center;
    padding: 22px 18px 16px;
    -webkit-app-region: drag;

    h2 {
      margin: 0;
      font-size: 18px;
    }

    button {
      margin-left: auto;
      padding: 7px 12px;
      -webkit-app-region: no-drag;
    }
  }
}

.counts {
  display: flex;
  margin: 0;
  padding: 0 18px 14px;
  gap: 14px;
  color: var(--text-dim);
  font-size: 12px;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    gap: 5px;
  }
}

input {
  margin: 0 18px 14px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);

  &::placeholder {
    color: var(--text-faint);
  }
  &:focus {
    border-color: var(--text-faint);
    outline: none;
  }
}

.list {
  overflow-y: auto;
  flex: 1;
  border-top: 1px solid var(--border);
}

.group {
  position: sticky;
  z-index: 1;
  top: 0;
  display: flex;
  align-items: center;
  width: 100%;
  padding: 7px 18px;
  border: 0;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
  background: var(--bg);
  color: var(--text-faint);
  gap: 7px;

  &:hover {
    color: var(--text-dim);
  }

  .chevron {
    width: 10px;
    font-size: 11px;
    line-height: 1;
  }

  .label {
    margin-right: auto;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .count {
    font-size: 11px;
  }

  /** A collapsed stage would otherwise hide the one session waiting on him. */
  .waiting {
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--banner);
    color: var(--needs-you);
    font-size: 11px;
  }
}

.none {
  padding: 28px 18px;
  color: var(--text-faint);
  text-align: center;
}

footer {
  display: flex;
  align-items: center;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
  color: var(--text-faint);
  font-size: 11px;
  gap: 8px;

  .hooks {
    margin-left: auto;
    padding: 3px 9px;
    border-radius: 6px;
    color: inherit;
    font-size: 11px;

    &:hover {
      color: var(--text-dim);
    }
  }
}
</style>
