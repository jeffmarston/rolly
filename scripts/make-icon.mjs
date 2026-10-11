import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'

// Offscreen rendering needs this, and an icon render has no use for the GPU.
app.disableHardwareAcceleration()
import { iconSvg } from './icon-svg.mjs'

const SIZES = [16, 32, 64, 128, 256, 512, 1024]

/** macOS wants these exact names; each @2x is the next size up. */
const ICONSET = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024]
]

/**
 * Offscreen, because an on-screen window is clamped to the display and a 1024px
 * request came back 1024x1982. One capture, resized in-process: a window per
 * size races on loadURL.
 */
async function renderMaster(svg) {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true }
  })
  const page = `<style>html,body{margin:0;background:transparent}svg{display:block;width:1024px;height:1024px}</style>${svg}`
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`)
  await new Promise((resolve) => setTimeout(resolve, 600))
  const image = await win.capturePage()
  win.destroy()

  const { width, height } = image.getSize()
  if (width !== 1024 || height !== 1024) {
    throw new Error(`expected a 1024x1024 capture, got ${width}x${height}`)
  }
  return image
}

async function main() {
  const out = process.argv[2] ?? 'assets'
  await app.whenReady()

  const svg = iconSvg()
  mkdirSync(join(out, 'icon.iconset'), { recursive: true })
  writeFileSync(join(out, 'icon.svg'), svg)

  const master = await renderMaster(svg)
  const pngs = new Map(
    SIZES.map((size) => [
      size,
      (size === 1024 ? master : master.resize({ width: size, height: size, quality: 'best' })).toPNG()
    ])
  )
  console.log('rendered', SIZES.join(', '))

  writeFileSync(join(out, 'icon.png'), pngs.get(1024))
  for (const [name, size] of ICONSET) {
    writeFileSync(join(out, 'icon.iconset', name), pngs.get(size))
  }
  console.log('wrote icon.svg, icon.png and icon.iconset')
  app.quit()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
