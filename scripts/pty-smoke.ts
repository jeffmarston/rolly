import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { PtyManager } from '../src/main/pty/manager'
import { projectSlug, projectsRoot } from '../src/main/sessions/paths'

const cwd = process.argv[2]
const ptys = new PtyManager()

const id = ptys.start({ cwd, name: 'rolly-smoke' })
console.log('spawned session id:', id)

let seen = ''
ptys.on('data', (_id: string, data: string) => (seen += data))
ptys.on('exit', (_id: string, code: number) => console.log('!!! pty exited, code', code))
ptys.attach(id)

setTimeout(() => ptys.write(id, 'Reply with exactly: PTY-OK\r'), 6000)

const file = join(projectsRoot(), projectSlug(cwd), `${id}.jsonl`)

/** The transcript only lands once the turn completes, so poll rather than guess a deadline. */
const poll = setInterval(() => existsSync(file) && finish(), 2000)
setTimeout(finish, 90_000)

function finish(): void {
  clearInterval(poll)
  console.log('--- transcript at the id we chose:', existsSync(file))
  if (existsSync(file)) {
    const types = readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => { try { return JSON.parse(l).type } catch { return '?' } })
    console.log('--- line types:', [...new Set(types)].join(', '))
    console.log('--- name flag landed:', readFileSync(file, 'utf8').includes('rolly-smoke'))
  }
  console.log('--- transcript-saving warning present:', seen.includes('Transcript'))
  console.log('--- PTY-OK echoed back:', seen.includes('PTY-OK'))
  ptys.killAll()
  app.quit()
}

app.on('window-all-closed', () => app.quit())
