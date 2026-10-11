/** Transcripts don't record the window, so infer it: the smallest tier the peak fits in. */
const TIERS = [200_000, 1_000_000]

export function inferContextLimit(peak: number): number {
  return TIERS.find((tier) => peak <= tier) ?? TIERS[TIERS.length - 1]
}

export function contextTotal(usage: Record<string, unknown>): number {
  const field = (key: string): number => (typeof usage[key] === 'number' ? (usage[key] as number) : 0)
  return field('input_tokens') + field('cache_read_input_tokens') + field('cache_creation_input_tokens')
}
