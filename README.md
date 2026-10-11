# rolly

A fleet view for Claude Code sessions. One rail showing every session across
every repo, sorted by who needs you.

```bash
npm run dev          # electron-vite, hot reload
npm run build        # production bundle into out/
npm start            # build + launch
npm run type-check   # vue-tsc over main, preload and renderer
```

## How it reads sessions

Claude Code appends a JSONL transcript per session under
`~/.claude/projects/<cwd-slug>/<sessionId>.jsonl`. Those lines already carry
`cwd`, `gitBranch`, `customTitle` and timestamps, so the rail needs no
instrumentation — `SessionWatcher` tails the tree and folds each line into a
record.

Transcripts reach tens of megabytes, so the indexer **indexes once and tails
forever**: a cold file is streamed a single time, then only bytes appended past
the stored offset are re-read. A half-written trailing line is never consumed,
so the cursor only ever advances past complete lines.

## Driving a session

`New session` takes a name and a folder — the folder list is every cwd rolly has
seen a session in — and spawns `claude` in an app-owned pty
(`pty/manager.ts`), rendered by xterm.js. Three things make that work:

- **The name is forced** with `--name`, so a row reads as something meaningful
  from the first frame instead of waiting for Claude to generate `ai-title`.
- **The session id is chosen up front** and passed as `--session-id`, so the pty
  and the transcript the watcher later finds are the same session. No heuristic
  correlation between what rolly spawned and what shows up in the rail.
- **The environment is sanitized.** A rolly launched from inside a Claude Code
  session inherits `CLAUDE_CODE_CHILD_SESSION`, which silently disables
  transcript saving in every child — the rail would go blind for exactly the
  sessions it started. `pty/env.ts` strips it.
- **The pty runs under a login shell**, because a GUI-launched Electron has a
  PATH without `claude` in it.

Terminals are cached per session in the renderer, so switching rows keeps
scrollback; main keeps a capped buffer so a window reload can restore a pane.

## Sessions outlive rolly

Quitting rolly sends its children a SIGTERM rather than holding them open: the
transcript on disk is the durable thing, not the process. A session comes back
through **Open here**, which resumes it — `claude --resume` replays the prior
turns into the pane, so an adopted session opens in context and needs no
separate read-only renderer.

**Opening a session that is already live elsewhere is fine.** Two `claude`
processes resumed onto one session append to a single transcript with no
corruption — turns interleave in timestamp order, nothing is malformed, and each
process picks up the other's turns. So there is no ownership check and no "is
this busy?" guess: `Open here` is unconditional, and it reads as taking the
session over because that is what it does.

Forking was built and then removed once that turned out to be unnecessary. If
it's ever wanted, `--fork-session --session-id <new>` does branch onto an id
rolly picks, so correlation survives a fork.

The one thing the pane does have to handle: **a folder rolly hasn't opened
before shows a trust prompt** as its first screen, answered in the terminal like
any other prompt.

## Model, effort and context

Every turn records its `model`, `effort`, `permissionMode` and a `usage` block,
so the header shows what a session is actually running on without asking the
process anything.

Context fullness is `input + cache_read + cache_creation` for the latest turn.
Transcripts don't record the window size — and the model id carries no `[1m]`
marker — so the limit is **inferred from the session's own peak**: the smallest
tier (200k, 1M) the peak fits inside. A session that has been past 200k is
provably on the larger window. The rail shows a chip only once a session passes
70%, amber to 90% and red beyond.

## Status is inferred, for now

`sessions/status.ts` guesses *working / needs-you / idle* from transcript shape
alone — recency, whose turn is last, and whether the reply trails off in a
question. That keeps M1 working with zero setup, at the cost of precision: an
abandoned session whose last reply happened to ask something still reads as
"needs you". M4 replaces the guess with hook events, and `done` stays unused
until then.

## Icon and packaging

The mark is generated, not hand-drawn: `scripts/icon-svg.mjs` draws four
logarithmic-spiral arms on a teal tile, and `npm run icon` renders it to
`assets/` as SVG, a 1024px PNG, an `.iconset` and an `.icns`.

The renderer captures **once** at 1024 in an off-screen Electron window and
downscales with `nativeImage.resize` — a window per size races on `loadURL` and
fails after the first capture. It also has to be bundled to CJS first, because
Electron won't take a bare `.mjs` as its entry point.

```bash
npm run icon       # regenerate every icon asset
npm run package    # unpacked Rolly.app into release/
npm run dist       # a dmg
```

**The app is only called "Rolly" when packaged.** macOS reads the menu-bar name
from the bundle's `CFBundleName`, so an `electron .` dev run says "Electron" no
matter what `app.setName` does. Everything that *can* be set at runtime — about
panel, dock icon, window title, userData path — is.

## Testing

`scripts/pty-smoke.ts` drives the real manager inside Electron — spawns a
session, types a prompt, and waits for the transcript to appear at the id it
chose:

```bash
npx esbuild scripts/pty-smoke.ts --bundle --platform=node --format=cjs \
  --external:electron --external:node-pty --alias:@shared=./src/shared \
  --outfile=scripts/pty-smoke.cjs
./node_modules/.bin/electron scripts/pty-smoke.cjs <a-trusted-folder>
```

`ROLLY_FOLDER=<path>` makes the New-session folder picker return that path
instead of opening a native dialog, which is what lets the UI be driven from a
harness.

## Roadmap

- **M1 — the rail is real.** ✅ watcher, indexer, session list.
- **M2 — the terminal.** ✅ xterm.js over an app-owned pty; "New session".
- **M3 — adopt.** ✅ "Open here" resumes any session into a pane, whether or not
  something else has it open.
- **M4 — hooks.** Localhost endpoint; exact status, plus PR counts via `gh`.
- **M5 — Windows.** Packaging, and `sessions/paths.ts` is the only file that
  should need to care.
