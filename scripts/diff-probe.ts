import { strict as assert } from 'node:assert'
import { changedFiles, fileVersions } from '../src/main/diff'

/** Runs the git plumbing behind the diff window against a real repo. */
async function main(): Promise<void> {
  const cwd = process.argv[2] ?? process.cwd()
  const files = await changedFiles(cwd)
  console.log(`${files.length} changed against HEAD in ${cwd}`)

  for (const file of files) {
    assert.match(file.status, /^[A-Z]$/, `status should be one letter, got ${file.status}`)
    assert.ok(file.path, 'every entry needs a path')
    assert.ok(file.from, 'every entry needs the path HEAD knows')
    console.log(`  ${file.status}  ${file.path}${file.from === file.path ? '' : `  (was ${file.from})`}`)
  }

  const first = files[0]
  if (!first) return console.log('nothing to read back')

  const { before, after } = await fileVersions(cwd, first)
  assert.equal(typeof before, 'string')
  assert.equal(typeof after, 'string')
  assert.notEqual(before, after, 'a changed file should differ from HEAD')
  console.log(`read ${first.path}: ${before.length} bytes at HEAD, ${after.length} on disk`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
