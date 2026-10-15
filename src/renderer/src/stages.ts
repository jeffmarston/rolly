import { ref, toRaw } from 'vue'
import type { SessionRecord, Stage } from '@shared/types'

/** Classification is a heuristic, so a wrong call has to be correctable and stay corrected. */
const overrides = ref<Record<string, Stage>>({})
const collapsed = ref<Record<string, boolean>>({})
const jira = ref<Record<string, { key: string; url: string }>>({})
const dismissed = ref<Record<string, string>>({})
/** Days of silence that count as abandoned. Three is a long weekend. */
const sweepDays = ref(3)

export async function hydrateState(): Promise<void> {
  const state = await window.rolly.state.get()
  overrides.value = state.stageOverrides ?? {}
  collapsed.value = state.collapsedGroups ?? {}
  jira.value = state.jiraKeys ?? {}
  dismissed.value = state.dismissed ?? {}
  sweepDays.value = state.sweepDays ?? sweepDays.value
}

export { sweepDays }

export function setSweepDays(days: number): void {
  sweepDays.value = days
  void window.rolly.state.patch({ sweepDays: days })
}

/**
 * Closing a session hides its row; anything it does afterwards un-hides it, so
 * a session that wakes back up can never be silently missing from the fleet.
 */
export function isDismissed(session: SessionRecord): boolean {
  const at = dismissed.value[session.id]
  return !!at && Date.parse(session.lastActivity ?? '') <= Date.parse(at)
}

export function dismiss(id: string): void {
  dismissAll([id])
}

/** One write for the whole sweep: a hundred single dismissals is a hundred state patches. */
export function dismissAll(ids: string[]): void {
  const at = new Date().toISOString()
  dismissed.value = { ...dismissed.value, ...Object.fromEntries(ids.map((id) => [id, at])) }
  persistDismissed()
}

export function restore(id: string): void {
  const { [id]: _removed, ...rest } = dismissed.value
  dismissed.value = rest
  persistDismissed()
}

function persistDismissed(): void {
  // toRaw: a reactive proxy can't be structured-cloned, and invoke fails silently on one.
  void window.rolly.state.patch({ dismissed: toRaw(dismissed.value) })
}

export function jiraFor(session: SessionRecord): { key: string; url: string } | undefined {
  return jira.value[session.id]
}

/** The ticket rolly opened is recorded, never guessed from a branch name. */
export function setJira(id: string, issue: { key: string; url: string }): void {
  jira.value = { ...jira.value, [id]: issue }
}

export function stageOf(session: SessionRecord): Stage {
  return overrides.value[session.id] ?? session.stage
}

export function isOverridden(session: SessionRecord): boolean {
  return session.id in overrides.value
}

export function setStage(id: string, stage: Stage | null): void {
  if (stage) overrides.value = { ...overrides.value, [id]: stage }
  else {
    const { [id]: _removed, ...rest } = overrides.value
    overrides.value = rest
  }
  // toRaw: a reactive proxy can't be structured-cloned, and invoke fails silently on one.
  void window.rolly.state.patch({ stageOverrides: toRaw(overrides.value) })
}

export function isCollapsed(key: string): boolean {
  return collapsed.value[key] === true
}

export function toggleCollapsed(key: string): void {
  collapsed.value = { ...collapsed.value, [key]: !collapsed.value[key] }
  void window.rolly.state.patch({ collapsedGroups: toRaw(collapsed.value) })
}
