import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import type { Layout } from '@shared/types'
import { patchState, readState } from './state'

const LAYOUTS: { label: string; value: Layout }[] = [
  { label: 'Kanban', value: 'kanban' },
  { label: 'Simple', value: 'simple' }
]

/** macOS reads the first menu's name from the bundle, so packaging is what makes it stick. */
export function installMenu(onLayout: (layout: Layout) => void): void {
  const mac = process.platform === 'darwin'
  const current = readState().layout ?? 'kanban'

  const layoutStyle: MenuItemConstructorOptions = {
    label: 'Layout Style',
    submenu: LAYOUTS.map(({ label, value }) => ({
      label,
      type: 'radio',
      checked: value === current,
      click: () => {
        patchState({ layout: value })
        onLayout(value)
      }
    }))
  }

  const template: MenuItemConstructorOptions[] = [
    ...(mac
      ? ([
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ] as MenuItemConstructorOptions[])
      : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        layoutStyle,
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Claude Code docs',
          click: () => shell.openExternal('https://docs.claude.com/en/docs/claude-code')
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
