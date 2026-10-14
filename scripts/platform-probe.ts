import { launch, which } from '../src/main/platform'
import { projectSlug, cwdFromProjectDir } from '../src/main/sessions/paths'

console.log('--- resolution on this machine')
for (const tool of ['claude', 'gh', 'definitely-not-a-real-binary']) {
  console.log(`  which ${tool}: ${which(tool) ?? '(not found)'}`)
}

console.log('--- launch')
for (const argv of [
  ['claude', '--session-id', 'abc', '--name', "a b 'c' \"d\""],
  ['gh', 'api', 'graphql', '-f', 'query={ p0: repository(owner: "o", name: "r") }'],
  ['definitely-not-a-real-binary', 'x y']
]) {
  console.log(`  ${JSON.stringify(argv)}\n    -> ${JSON.stringify(launch(argv))}`)
}

console.log('--- cwd slugs, both directions')
for (const cwd of [
  'C:\\Repo\\rolly',
  'C:\\Users\\cash\\AppData\\Roaming\\Rolly\\workspace',
  'D:\\work\\a b\\c',
  '/Users/jeff/repo/spin',
  '/home/jeff/x'
]) {
  const slug = projectSlug(cwd)
  const back = cwdFromProjectDir(slug)
  console.log(`  ${cwd}\n    -> ${slug}\n    -> ${back}  roundtrip=${back === cwd}`)
}
