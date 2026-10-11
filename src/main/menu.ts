import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron'

/** macOS reads the first menu's name from the bundle, so packaging is what makes it stick. */
export function installMenu(): void {
  const mac = process.platform === 'darwin'

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
    { role: 'viewMenu' },
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
