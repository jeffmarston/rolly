import { strict as assert } from 'node:assert'
import { app, Menu } from 'electron'
import { installMenu } from '../src/main/menu'

/** The View menu is hand-rolled now, so check it still carries the stock roles too. */
app.whenReady().then(() => {
  let reported: string | undefined
  installMenu((layout) => (reported = layout))

  const view = Menu.getApplicationMenu()?.items.find((item) => item.label === 'View')
  assert.ok(view, 'View menu is missing')

  const roles = view.submenu?.items.map((item) => item.role).filter(Boolean)
  assert.ok(roles?.includes('reload'), 'View lost the stock roles')
  assert.ok(roles?.includes('togglefullscreen'), 'View lost fullscreen')

  const style = view.submenu?.items.find((item) => item.label === 'Layout Style')
  assert.ok(style, 'Layout Style submenu is missing')

  const options = style.submenu?.items ?? []
  assert.deepEqual(
    options.map((item) => item.label),
    ['Kanban', 'Simple']
  )
  assert.ok(
    options.every((item) => item.type === 'radio'),
    'both options should be radios'
  )
  assert.equal(options[0].checked, true, 'Kanban is the default')

  options[1].click()
  assert.equal(reported, 'simple', 'picking Simple should report it')

  console.log('menu ok: View keeps its roles, Layout Style offers Kanban (checked) and Simple')
  app.exit(0)
})
