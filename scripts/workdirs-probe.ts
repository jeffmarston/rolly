import { strict as assert } from 'node:assert'
import { homedir } from 'node:os'
import { bashDirs } from '../src/main/sessions/stage'

const home = homedir()
const cwd = '/work/space'

/** The shapes a session actually types, from a real transcript that defeated the old cwd-only guess. */
const cases: [string, Record<string, number>][] = [
  ['cd ~/repo/api && git status', { [`${home}/repo/api`]: 1 }],
  ['git status', {}],
  ['cd ../sibling && ls', { '/work/sibling': 1 }],
  [
    'cd ~/repo/api && git worktree add -q -b fix-123 ../api-fix-123 && cd ../api-fix-123 && sed -i "" s/a/b/ x.cs',
    { [`${home}/repo/api`]: 1, [`${home}/repo/api-fix-123`]: 11 }
  ],
  [
    'cd ~/a && git worktree add -q ../b origin/main -B main',
    { [`${home}/a`]: 1, [`${home}/b`]: 10 }
  ]
]

for (const [command, expected] of cases) {
  assert.deepEqual(Object.fromEntries(bashDirs(command, cwd)), expected, command)
}

// A relative path with no cwd to resolve against is a guess, not a directory.
assert.deepEqual(Object.fromEntries(bashDirs('cd ../sibling && ls', '')), {})

console.log(`workdirs ok: ${cases.length + 1} commands resolved`)
