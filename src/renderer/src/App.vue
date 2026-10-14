<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import type { SessionRecord, Stage } from '@shared/types'
import { STAGE_HINT, STAGE_LABEL, STAGE_ORDER } from '@shared/types'
import { release } from './terminals'
import { homeRelative } from './time'
import { hydratePrs } from './prs'
import {
  dismiss,
  hydrateState,
  isDismissed,
  restore,
  isOverridden,
  jiraFor,
  setJira,
  setStage,
  stageOf
} from './stages'
import BoardCard from './components/BoardCard.vue'
import BoardColumn from './components/BoardColumn.vue'
import CloseRail from './components/CloseRail.vue'
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
const dragging = ref('')
/** Clicking a card spawns a claude, so cap how many can be awake at once. */
const MAX_LIVE = 6
/** Least recently focused first; eviction starts from the front. */
const focusOrder = ref<string[]>([])
const showClosed = ref(false)

const STAGE_ACCENT: Record<Stage, string> = {
  shape: '#a371f7',
  build: '#4a9eff',
  verify: '#3ecf8e'
}

/** Dropping a card pins the stage: the board is a statement, not a suggestion. */
function moveTo(id: string, stage: Stage): void {
  dragging.value = ''
  setStage(id, stage)
  selectedId.value = id
}

async function closeById(id: string): Promise<void> {
  dragging.value = ''
  await window.rolly.pty.close(id)
  dismiss(id)
  if (selectedId.value === id) selectedId.value = lifecycle.value[0]?.rows[0]?.id ?? null
}
const projectsRoot = ref('')

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
  selectedId.value = lifecycle.value[0]?.rows[0]?.id ?? null
}

function restoreSession(): void {
  if (selectedId.value) restore(selectedId.value)
}

/** Resuming replays the prior turns into the pane, so an adopted session opens in context. */
async function adopt(id?: string): Promise<void> {
  const session = rows.value.find((row) => row.id === (id ?? selectedId.value))
  if (!session?.cwd || isLive(session.id)) return

  await sleepExcess(session.id)
  await window.rolly.pty.start({ cwd: session.cwd, resumeId: session.id })
  liveIds.value = [...liveIds.value, session.id]
}

/**
 * Closes the stalest terminals to stay under the cap. A session mid-turn is
 * never evicted — going over is cheaper than killing work.
 */
async function sleepExcess(incoming: string): Promise<void> {
  const live = liveIds.value.filter((id) => id !== incoming)
  const excess = live.length + 1 - MAX_LIVE
  if (excess <= 0) return

  const stalest = live
    .filter((id) => rows.value.find((row) => row.id === id)?.status !== 'working')
    .sort((a, b) => focusOrder.value.indexOf(a) - focusOrder.value.indexOf(b))

  for (const id of stalest.slice(0, excess)) await window.rolly.pty.close(id)
}

/** Picking a card opens it — a closed one stays closed until it is reopened. */
function pick(session: SessionRecord): void {
  selectedId.value = session.id
  focusOrder.value = [...focusOrder.value.filter((id) => id !== session.id), session.id]
  if (!isDismissed(session)) void adopt(session.id)
}

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

const lifecycle = computed(() => {
  const open = visible.value.filter((session) => !isDismissed(session))
  return STAGE_ORDER.map((stage) => {
    const rows = open.filter((session) => stageOf(session) === stage).sort(byUrgency)
    return {
      stage,
      label: STAGE_LABEL[stage],
      hint: STAGE_HINT[stage],
      accent: STAGE_ACCENT[stage],
      rows,
      waiting: rows.filter((session) => session.status === 'needs-you').length
    }
  })
})

const closed = computed(() => visible.value.filter(isDismissed).sort(byUrgency))


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
  projectsRoot.value = await window.rolly.projectsRoot()
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
    <header class="top">
      <h1>Rolly</h1>
      <input v-model="filter" type="search" placeholder="Filter by title, branch or folder" />
      <button type="button" class="new" @click="showNew = true">New session</button>
    </header>

    <div class="board">
      <BoardColumn
        v-for="column in lifecycle"
        :key="column.stage"
        :label="column.label"
        :hint="column.hint"
        :rows="column.rows"
        :waiting="column.waiting"
        :accent="column.accent"
        @drop="moveTo($event, column.stage)"
      >
        <BoardCard
          v-for="session in column.rows"
          :key="session.id"
          :session="session"
          :now="now"
          :selected="session.id === selectedId"
          :live="isLive(session.id)"
          @pick="pick(session)"
          @drag="dragging = $event"
        />
      </BoardColumn>

      <section v-if="showClosed" class="shelf">
        <header>
          <h2>Closed</h2>
          <span class="count">{{ closed.length }}</span>
        </header>
        <div class="cards">
          <BoardCard
            v-for="session in closed"
            :key="session.id"
            :session="session"
            :now="now"
            :selected="session.id === selectedId"
            :live="isLive(session.id)"
            @pick="selectedId = session.id"
            @drag="dragging = $event"
          />
          <p v-if="!closed.length" class="none">Nothing closed.</p>
        </div>
      </section>

      <CloseRail
        :count="closed.length"
        :dragging="!!dragging"
        :open="showClosed"
        @drop="closeById"
        @toggle="showClosed = !showClosed"
      />
    </div>

    <div class="tie" />

    <DetailPane
      compact
      :session="selected"
      :now="now"
      :live="selected ? isLive(selected.id) : false"
      :stage="selected ? stageOf(selected) : undefined"
      :stage-overridden="selected ? isOverridden(selected) : false"
      :jira="selected ? jiraFor(selected) : undefined"
      :dismissed="selected ? isDismissed(selected) : false"
      @adopt="adopt()"
      @close="closeSession"
      @restore="restoreSession"
      @stage="changeStage"
      @create-jira="showJira = true"
    />

    <footer class="status">
      <span>
        {{ visible.length }} of {{ rows.length }} sessions · {{ liveIds.length }}/{{ MAX_LIVE }}
        awake · watching {{ homeRelative(projectsRoot) }}
      </span>
      <button type="button" class="hooks" @click="showHooks = true">
        {{ hookInfo?.listening ? 'Exact status' : 'Status inferred' }}
      </button>
    </footer>

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
  flex-direction: column;
}

.top {
  display: flex;
  align-items: center;
  padding: 14px 18px;
  background: linear-gradient(180deg, #1a1a1e 0%, rgb(18 18 21 / 0%) 100%);
  gap: 18px;
  -webkit-app-region: drag;

  h1 {
    margin: 0 0 0 68px;
    font-size: 16px;
  }

  input,
  .new {
    -webkit-app-region: no-drag;
  }

  input {
    width: 280px;
    margin-left: auto;
    padding: 7px 11px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: linear-gradient(180deg, #121215 0%, #17171a 100%);
    box-shadow: inset 0 1px 3px rgb(0 0 0 / 55%);

    &::placeholder {
      color: var(--text-faint);
    }
    &:focus {
      border-color: var(--text-faint);
      outline: none;
    }
  }

  .new {
    padding: 7px 12px;
  }
}


.board {
  display: flex;
  min-height: 190px;
  max-height: 38vh;
  flex: 0 0 auto;
  padding: 0 18px 14px;
  gap: 12px;
}

.shelf {
  display: flex;
  width: 260px;
  flex: 0 0 260px;
  flex-direction: column;
  padding: 12px 12px 8px;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: var(--bg);

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

    .count {
      color: var(--text-faint);
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
}

/** Splits the board from the terminal below it. */
.tie {
  height: 2px;
  flex: 0 0 auto;
  background: rgb(22 59 68);
  box-shadow: 0 0 14px 1px rgb(22 59 68);
}

.status {
  display: flex;
  align-items: center;
  padding: 9px 18px;
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
