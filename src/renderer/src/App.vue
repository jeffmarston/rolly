<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import type { SessionRecord, SessionStatus } from '@shared/types'
import { STATUS_LABEL, STATUS_ORDER } from '@shared/types'
import { release } from './terminals'
import SessionRow from './components/SessionRow.vue'
import StatusDot from './components/StatusDot.vue'
import DetailPane from './components/DetailPane.vue'
import NewSessionDialog from './components/NewSessionDialog.vue'

const sessions = ref<SessionRecord[]>([])
/** Rows for sessions rolly just spawned, until the watcher sees their transcript. */
const provisional = ref<SessionRecord[]>([])
const liveIds = ref<string[]>([])
const selectedId = ref<string | null>(null)
const filter = ref('')
const now = ref(Date.now())
const showNew = ref(false)

let stopUpdates: (() => void) | undefined
let stopExits: (() => void) | undefined
let clock: ReturnType<typeof setInterval> | undefined

const rows = computed(() => {
  const known = new Set(sessions.value.map((session) => session.id))
  return [...provisional.value.filter((row) => !known.has(row.id)), ...sessions.value]
})

function isLive(id: string): boolean {
  return liveIds.value.includes(id)
}

/** Every folder rolly has seen a session in — the shortlist for starting another. */
const folders = computed(() => [
  ...new Set(rows.value.map((session) => session.cwd).filter((cwd): cwd is string => !!cwd))
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

const selected = computed(
  () => rows.value.find((session) => session.id === selectedId.value) ?? null
)

function applySessions(next: SessionRecord[]): void {
  sessions.value = next
  if (!selectedId.value && next.length) selectedId.value = next[0].id
}

onMounted(async () => {
  stopUpdates = window.rolly.onUpdate(applySessions)
  stopExits = window.rolly.pty.onExit(({ id }) => {
    liveIds.value = liveIds.value.filter((live) => live !== id)
    // Let the pane unmount before the terminal behind it is disposed.
    void nextTick(() => release(id))
  })
  applySessions(await window.rolly.list())
  liveIds.value = await window.rolly.pty.alive()
  clock = setInterval(() => (now.value = Date.now()), 15_000)
})

onUnmounted(() => {
  stopUpdates?.()
  stopExits?.()
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
        <SessionRow
          v-for="session in visible"
          :key="session.id"
          :session="session"
          :now="now"
          :selected="session.id === selectedId"
          :live="isLive(session.id)"
          @click="selectedId = session.id"
        />
        <p v-if="!visible.length" class="none">
          {{ rows.length ? 'No sessions match.' : 'No sessions found yet.' }}
        </p>
      </div>

      <footer>Watching ~/.claude/projects · status inferred until M4</footer>
    </aside>

    <DetailPane
      :session="selected"
      :now="now"
      :live="selected ? isLive(selected.id) : false"
      @adopt="adopt"
    />

    <NewSessionDialog
      :open="showNew"
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

.none {
  padding: 28px 18px;
  color: var(--text-faint);
  text-align: center;
}

footer {
  padding: 12px 18px;
  border-top: 1px solid var(--border);
  color: var(--text-faint);
  font-size: 11px;
}
</style>
