import { spawnSync } from 'node:child_process'

/**
 * The `.icns` is only read when packaging for macOS, and `iconutil` only exists
 * there. Windows and Linux take `assets/icon.png` directly — electron-builder
 * derives the `.ico` it needs from it — so there is nothing to do but say so.
 */
if (process.platform !== 'darwin') {
  console.log(`[icon] skipping icon.icns on ${process.platform}; icon.png is what this platform uses`)
  process.exit(0)
}

const result = spawnSync(
  'iconutil',
  ['-c', 'icns', 'assets/icon.iconset', '-o', 'assets/icon.icns'],
  { stdio: 'inherit' }
)
process.exit(result.status ?? 1)
