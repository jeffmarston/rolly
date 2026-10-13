import { SessionWatcher } from '../src/main/sessions/watcher'
const w = new SessionWatcher(); w.start()
setTimeout(() => {
  for (const s of w.snapshot()) {
    console.log(`${s.stage.padEnd(7)} ${String(s.edits).padStart(4)} edits  ${String(s.pullRequestUrls.length).padStart(2)} PRs  ${s.title.slice(0,46)}`)
  }
  void w.stop().then(() => process.exit(0))
}, 4000)
