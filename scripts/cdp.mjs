/** Drive the running Rolly over the Chrome DevTools Protocol — see README "Driving the UI". */
import { writeFileSync } from 'node:fs'

const targets = await (await fetch('http://localhost:9444/json')).json()
const page = targets.find((t) => t.type === 'page')
if (!page) throw new Error('no page target')

const ws = new WebSocket(page.webSocketDebuggerUrl)
let next = 1
const waiting = new Map()

function send(method, params = {}) {
  const id = next++
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve, reject) => waiting.set(id, { resolve, reject }))
}

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  const pending = waiting.get(msg.id)
  if (!pending) return
  waiting.delete(msg.id)
  if (msg.error) pending.reject(new Error(JSON.stringify(msg.error)))
  else pending.resolve(msg.result)
})

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}

await new Promise((resolve) => ws.addEventListener('open', resolve))

for (const expression of process.argv.slice(3)) {
  console.log(JSON.stringify(await evaluate(expression), null, 2))
}

const shot = process.argv[2]
if (shot && shot !== '-') {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(shot, Buffer.from(data, 'base64'))
  console.log('screenshot ->', shot)
}

ws.close()
