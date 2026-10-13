import { PullRequestPoller } from '../src/main/prs'
import { SessionWatcher } from '../src/main/sessions/watcher'

const watcher = new SessionWatcher()
watcher.start()

setTimeout(() => {
  const urls = watcher.snapshot().flatMap((s) => s.pullRequestUrls)
  console.log('PR urls seen:', urls.length, '/ unique:', new Set(urls).size)
  const poller = new PullRequestPoller(() => urls)
  poller.on('states', (states) => {
    console.log(JSON.stringify(states, null, 2))
    poller.stop()
    void watcher.stop()
    process.exit(0)
  })
  poller.on('error', (e) => {
    console.error('poll error:', e)
    process.exit(1)
  })
  poller.start()
}, 12_000)
