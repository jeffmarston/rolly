import { SessionWatcher } from '../src/main/sessions/watcher'
const w = new SessionWatcher(); w.start()
setTimeout(() => {
  for (const s of w.snapshot()) {
    if (!s.title.toLowerCase().includes('leagueapp')) continue
    console.log('title      ', s.title)
    console.log('stage      ', s.stage, '| edits', s.edits)
    console.log('prUrls     ', s.pullRequestUrls)
  }
  void w.stop().then(() => process.exit(0))
}, 4000)
