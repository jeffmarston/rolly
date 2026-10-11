import { app } from 'electron'
import { PtyManager } from '../src/main/pty/manager'

const [, , cwd, resumeId] = process.argv
// Separate managers: one rolly-like owner, one standing in for another terminal.
const first = new PtyManager()
const second = new PtyManager()
const seen: Record<string, string> = { a: '', b: '' }

const a = first.start({ cwd, resumeId })
const b = second.start({ cwd, resumeId })
first.attach(a)
second.attach(b)
first.on('data', (_id: string, data: string) => (seen.a += data))
second.on('data', (_id: string, data: string) => (seen.b += data))

// Both land on the trust prompt first.
setTimeout(() => { first.write(a, '\r'); second.write(b, '\r') }, 6000)
setTimeout(() => first.write(a, 'Reply with exactly: FROM-A\r'), 14000)
setTimeout(() => second.write(b, 'Reply with exactly: FROM-B\r'), 18000)

setTimeout(() => {
  console.log('A saw FROM-A reply:', seen.a.includes('FROM-A'))
  console.log('B saw FROM-B reply:', seen.b.includes('FROM-B'))
  console.log('A ever saw FROM-B:', seen.a.includes('FROM-B'))
  first.killAll('SIGTERM')
  second.killAll('SIGTERM')
  setTimeout(() => app.quit(), 1500)
}, 75000)

app.on('window-all-closed', () => app.quit())
