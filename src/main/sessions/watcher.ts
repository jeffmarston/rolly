import { EventEmitter } from 'node:events'
import type { Stats } from 'node:fs'
import chokidar, { type FSWatcher } from 'chokidar'
import type { SessionRecord } from '@shared/types'
import { SessionIndexer } from './indexer'
import { projectsRoot } from './paths'

const DEBOUNCE_MS = 200
/** Status is time-dependent, so the rail has to re-settle even when nothing is written. */
const TICK_MS = 10_000

export class SessionWatcher extends EventEmitter {
  private indexer = new SessionIndexer()
  private watcher?: FSWatcher
  private pending = new Set<string>()
  private flushTimer?: NodeJS.Timeout
  private tickTimer?: NodeJS.Timeout
  private ready = false

  start(): void {
    // chokidar dropped glob support in v4, so filter the tree by hand.
    this.watcher = chokidar.watch(projectsRoot(), {
      depth: 1,
      ignoreInitial: false,
      ignored: (path: string, stats?: Stats) => !!stats?.isFile() && !path.endsWith('.jsonl')
    })

    this.watcher
      .on('add', (file) => this.touch(file))
      .on('change', (file) => this.touch(file))
      .on('unlink', (file) => {
        this.indexer.forget(file)
        this.schedule()
      })
      .on('ready', () => {
        this.ready = true
        this.schedule()
      })
      .on('error', (error) => this.emit('error', error))

    this.tickTimer = setInterval(() => this.emitSnapshot(), TICK_MS)
  }

  async stop(): Promise<void> {
    clearInterval(this.tickTimer)
    clearTimeout(this.flushTimer)
    await this.watcher?.close()
  }

  snapshot(): SessionRecord[] {
    return this.indexer.snapshot()
  }

  private touch(file: string): void {
    this.pending.add(file)
    this.schedule()
  }

  /** Coalesce the burst of writes a live session produces into one pass. */
  private schedule(): void {
    clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => void this.flush(), DEBOUNCE_MS)
  }

  private async flush(): Promise<void> {
    const files = [...this.pending]
    this.pending.clear()

    for (const file of files) {
      try {
        await this.indexer.update(file)
      } catch (error) {
        this.emit('error', error)
      }
    }
    if (this.ready) this.emitSnapshot()
  }

  private emitSnapshot(): void {
    this.emit('sessions', this.indexer.snapshot())
  }
}
