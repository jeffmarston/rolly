import { SessionWatcher } from '../src/main/sessions/watcher'
const w = new SessionWatcher(); w.start()
setTimeout(() => {
  for (const s of w.snapshot().slice(0, 8)) {
    console.log(`${s.status.padEnd(9)} ${s.title.slice(0, 30).padEnd(30)} ${(s.summary ?? '(none)').slice(0, 80)}`)
  }
  void w.stop().then(() => process.exit(0))
}, 4000)
