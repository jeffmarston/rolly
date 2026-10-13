import { join } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import { app } from 'electron'
import type { RollyState } from '@shared/types'

const DEFAULTS: RollyState = { stageOverrides: {}, collapsedGroups: {}, jiraKeys: {}, dismissed: {} }
const WRITE_DELAY = 250

let cache: RollyState | undefined
let pending: NodeJS.Timeout | undefined

function file(): string {
  return join(app.getPath('userData'), 'state.json')
}

export function readState(): RollyState {
  if (!cache) {
    try {
      cache = { ...DEFAULTS, ...(JSON.parse(readFileSync(file(), 'utf8')) as RollyState) }
    } catch {
      cache = { ...DEFAULTS }
    }
  }
  return cache
}

export function patchState(patch: Partial<RollyState>): RollyState {
  cache = { ...readState(), ...patch }
  clearTimeout(pending)
  pending = setTimeout(flushState, WRITE_DELAY)
  return cache
}

export function flushState(): void {
  clearTimeout(pending)
  if (!cache) return
  try {
    writeFileSync(file(), `${JSON.stringify(cache, null, 2)}\n`)
  } catch (error) {
    console.error('[state]', error)
  }
}
