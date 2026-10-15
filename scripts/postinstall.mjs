import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const PTY = 'node_modules/node-pty'

/**
 * node-pty ships N-API prebuilds, which are ABI-stable across Node and Electron,
 * so Windows loads `prebuilds/win32-<arch>` as-is — and must, since rebuilding
 * from source would demand a Visual Studio install that nothing else here needs.
 */
function windows() {
  const prebuild = join(PTY, 'prebuilds', `win32-${process.arch}`, 'pty.node')
  if (existsSync(prebuild)) {
    console.log(`[postinstall] using node-pty prebuild ${prebuild}`)
    return 0
  }
  console.error(`[postinstall] no node-pty prebuild at ${prebuild} — ptys will not start`)
  return 1
}

/**
 * macOS and Linux build against the installed Electron, then restore the
 * executable bit on `spawn-helper`: node-pty shells out to it for every pty and
 * npm unpacks it without the bit, so every session would fail to start.
 */
function posix() {
  const rebuild = spawnSync('electron-rebuild', ['-f', '-w', 'node-pty'], {
    stdio: 'inherit',
    shell: true
  })
  if (rebuild.status !== 0) return rebuild.status ?? 1

  const helpers = [join(PTY, 'build/Release/spawn-helper')]
  try {
    for (const dir of readdirSync(join(PTY, 'prebuilds'))) {
      helpers.push(join(PTY, 'prebuilds', dir, 'spawn-helper'))
    }
  } catch {
    // No prebuilds shipped for this platform; the local build is the only helper.
  }

  for (const helper of helpers) {
    try {
      chmodSync(helper, 0o755)
    } catch {
      // Not every build layout has every helper — only the ones present matter.
    }
  }
  return 0
}

process.exit(process.platform === 'win32' ? windows() : posix())
