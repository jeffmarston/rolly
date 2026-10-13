import { ref } from 'vue'
import type { PrState } from '@shared/types'

const states = ref<Record<string, PrState>>({})

export const PR_GLYPH: Record<PrState, string> = {
  open: '●',
  draft: '◌',
  merged: '✓',
  closed: '✕'
}

export async function hydratePrs(): Promise<() => void> {
  states.value = await window.rolly.prs.list()
  return window.rolly.prs.onUpdate((next) => (states.value = next))
}

/** Undefined until the first poll lands, so chips render unstyled rather than wrong. */
export function prStateOf(url: string): PrState | undefined {
  return states.value[url]
}
