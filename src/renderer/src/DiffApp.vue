<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, toRaw, watch } from 'vue'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import type { ChangedFile, DiffScope } from '@shared/types'

// Only the editor worker: it computes the diff. Highlighting runs on this thread.
self.MonacoEnvironment = { getWorker: () => new EditorWorker() }

const STATUS_LABEL: Record<string, string> = {
  M: 'modified',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  C: 'copied'
}

const target: { id: string; dirs: string[] } = JSON.parse(
  decodeURIComponent(location.hash.replace('#diff:', ''))
)
const dirs = target.dirs
/** A pty to type into, and no permission prompt that would eat the keystrokes. */
const askable = ref(false)
const ASK_POLL_MS = 4000
const ASK_HINT = 'Reference this line in the session — select lines first to send a range'
/** The list is narrow by default; a deep tree needs room, so the width is draggable and kept. */
const MIN_WIDTH = 180
const MAX_WIDTH = 620
const width = ref(280)
const collapsed = ref(new Set<string>())
const scope = shallowRef<DiffScope>()
const files = ref<ChangedFile[]>([])
/** Fixed at the first load: re-scoping to one repo would otherwise forget the others. */
const candidates = ref<DiffScope['roots']>([])
const selected = ref<ChangedFile>()
const error = ref('')
const host = ref<HTMLElement>()
const editor = shallowRef<monaco.editor.IStandaloneDiffEditor>()
let asking: ReturnType<typeof setInterval> | undefined

onMounted(async () => {
  width.value = (await window.rolly.state.get()).diffWidth ?? width.value

  editor.value = monaco.editor.createDiffEditor(host.value!, {
    theme: 'vs-dark',
    readOnly: true,
    automaticLayout: true,
    renderSideBySide: true,
    scrollBeyondLastLine: false,
    glyphMargin: true,
    fontSize: 12
  })

  // Only the modified side can be referenced, so only it pays for a glyph margin.
  editor.value.getOriginalEditor().updateOptions({ glyphMargin: false })
  watchAsking()
  armAskGlyph(editor.value.getModifiedEditor())

  await load(dirs)
  candidates.value = scope.value?.roots ?? []
})

async function load(where: string[]): Promise<void> {
  try {
    scope.value = await window.rolly.diff.files(where)
    files.value = scope.value.files
    document.title = `Diff — ${scope.value.root.split('/').pop()}`
    selected.value = files.value[0]
    error.value = ''
  } catch (cause) {
    error.value = message(cause)
  }
}

watch(selected, async (file) => {
  if (!file || !editor.value || !scope.value) return
  try {
    // toRaw: a reactive proxy can't be structured-cloned, and invoke rejects on one.
    const { root, base } = scope.value
    const { before, after } = await window.rolly.diff.file({ root, base }, toRaw(file))
    const previous = editor.value.getModel()
    // The Uri is what tells monaco the language, so there is no extension map to keep.
    editor.value.setModel({
      original: monaco.editor.createModel(before, undefined, monaco.Uri.file(`before/${file.from}`)),
      modified: monaco.editor.createModel(after, undefined, monaco.Uri.file(`after/${file.path}`))
    })
    // Models are not disposed with the editor, so a long session would leak every file opened.
    previous?.original.dispose()
    previous?.modified.dispose()
  } catch (cause) {
    error.value = message(cause)
  }
})

/** Files under the folder they live in: a flat column of long paths reads as noise. */
const folders = computed(() => {
  const groups = new Map<string, ChangedFile[]>()
  for (const file of files.value) {
    const cut = file.path.lastIndexOf('/')
    const dir = cut < 0 ? '' : file.path.slice(0, cut)
    groups.set(dir, [...(groups.get(dir) ?? []), file])
  }
  return [...groups]
})

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

function toggle(dir: string): void {
  const next = new Set(collapsed.value)
  if (!next.delete(dir)) next.add(dir)
  collapsed.value = next
}

/** The grip is a sibling of the list, so only the list resizes and monaco relayouts itself. */
function startDrag(event: MouseEvent): void {
  event.preventDefault()
  const from = event.clientX
  const start = width.value

  const move = (moved: MouseEvent): void => {
    width.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, start + moved.clientX - from))
  }
  const up = (): void => {
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
    void window.rolly.state.patch({ diffWidth: width.value })
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}

/** An IPC rejection arrives wrapped in its handler's name, which is noise to read. */
function message(cause: unknown): string {
  return String(cause).replace(/^Error: Error invoking remote method '[^']+': Error: /, '')
}

/**
 * The glyph follows the pointer rather than sitting on every line: a column of
 * question marks reads as noise, one under the cursor reads as an offer.
 */
function armAskGlyph(pane: monaco.editor.ICodeEditor): void {
  const glyph = pane.createDecorationsCollection()
  const clear = (): void => glyph.clear()

  pane.onMouseMove((event) => {
    const line = askable.value ? event.target.position?.lineNumber : undefined
    if (!line) return clear()
    glyph.set([
      {
        range: new monaco.Range(line, 1, line, 1),
        options: {
          glyphMarginClassName: 'ask codicon codicon-link',
          glyphMarginHoverMessage: { value: ASK_HINT }
        }
      }
    ])
  })
  pane.onMouseLeave(clear)
  pane.onMouseDown((event) => {
    if (event.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return
    const line = event.target.position?.lineNumber
    if (line) void ask(pane, line)
  })
}

/** A reference, not a question: the composer is left open so the question is yours. */
async function ask(pane: monaco.editor.ICodeEditor, line: number): Promise<void> {
  const file = selected.value
  if (!file || !scope.value || !askable.value) return

  const picked = pane.getSelection()
  const span =
    picked && !picked.isEmpty() && picked.startLineNumber !== picked.endLineNumber
      ? `${picked.startLineNumber}-${picked.endLineNumber}`
      : String(line)

  window.rolly.pty.input(target.id, `${scope.value.root}/${file.path}:${span} `)
  await window.rolly.diff.focusSession(target.id)
}

/** Typing into a permission prompt would answer it, so the offer disappears while one is up. */
function watchAsking(): void {
  const check = async (): Promise<void> => {
    const [live, sessions] = await Promise.all([window.rolly.pty.alive(), window.rolly.list()])
    const session = sessions.find((row) => row.id === target.id)
    // A session rolly has no row for is one it knows nothing about — including whether
    // claude is sitting on a prompt that reads single keys, where typing answers it.
    askable.value =
      live.includes(target.id) && !!session && session.statusReason !== 'Waiting on permission'
  }
  void check()
  asking = setInterval(() => void check(), ASK_POLL_MS)
}

onBeforeUnmount(() => {
  clearInterval(asking)
  editor.value?.dispose()
  monaco.editor.getModels().forEach((model) => model.dispose())
})
</script>

<template>
  <main class="diff">
    <aside :style="{ width: `${width}px`, flex: `0 0 ${width}px` }">
      <h1>{{ (scope?.root ?? dirs[0] ?? '').split('/').pop() }}</h1>
      <!-- A session that moved between repos leaves rolly guessing which one you meant. -->
      <select
        v-if="candidates.length > 1"
        class="repo"
        :value="scope?.root"
        title="Repos this session worked in"
        @change="load([($event.target as HTMLSelectElement).value])"
      >
        <option v-for="repo in candidates" :key="repo.root" :value="repo.root">
          {{ repo.root.split('/').pop() }} — {{ repo.files }} changed
        </option>
      </select>
      <p class="count">{{ files.length }} changed</p>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-else-if="!files.length" class="empty">Nothing changed since the branch point.</p>
      <p v-if="files.length" class="hint">
        {{
          askable
            ? 'Click the link icon in the gutter to reference a line.'
            : 'Open the session in rolly to reference a line.'
        }}
      </p>
      <template v-for="[dir, group] in folders" :key="dir">
        <button type="button" class="dir" @click="toggle(dir)">
          <span class="twist">{{ collapsed.has(dir) ? '▸' : '▾' }}</span>
          <!-- The rtl trick ellipsises from the left; the marks stop it reordering a leading dot. -->
          <span class="path">&#x200e;{{ dir || '/' }}&#x200e;</span>
          <span class="n">{{ group.length }}</span>
        </button>
        <button
          v-for="file in group"
          v-show="!collapsed.has(dir)"
          :key="file.path"
          type="button"
          class="file"
          :class="[{ on: file.path === selected?.path }, STATUS_LABEL[file.status]]"
          :title="file.path"
          @click="selected = file"
        >
          <span class="mark">{{ file.status }}</span>
          <span class="name">{{ basename(file.path) }}</span>
        </button>
      </template>
    </aside>
    <div class="grip" title="Drag to resize" @mousedown="startDrag" />
    <div ref="host" class="pane" />
  </main>
</template>

<style lang="scss" scoped>
.diff {
  display: flex;
  height: 100vh;
}

aside {
  display: flex;
  overflow-y: auto;
  flex-direction: column;
  padding: 14px 10px;
  border-right: 1px solid var(--border);
  background: linear-gradient(195deg, #1c1c20 0%, #141416 100%);
  gap: 2px;

  h1 {
    margin: 0 4px;
    font-size: 14px;
  }
}

.count,
.empty,
.error,
.hint {
  margin: 0 4px 10px;
  color: var(--text-faint);
  font-size: 11px;
}

.error {
  color: var(--danger);
}

.repo {
  margin: 6px 4px 0;
  padding: 3px 5px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-raised);
  color: var(--text-dim);
  font-size: 11px;
}

.grip {
  width: 5px;
  flex: 0 0 5px;
  margin-left: -3px;
  cursor: col-resize;

  &:hover {
    background: var(--working);
  }
}

.dir {
  display: flex;
  align-items: center;
  padding: 7px 7px 3px;
  border: 0;
  background: none;
  color: var(--text-faint);
  font-family: var(--mono);
  font-size: 10px;
  gap: 5px;
  text-align: left;

  .twist {
    width: 7px;
    flex: 0 0 7px;
  }

  .n {
    margin-left: auto;
  }
}

.file {
  display: flex;
  padding: 5px 7px 5px 19px;
  border: 0;
  border-radius: 5px;
  background: none;
  color: var(--text-dim);
  font-family: var(--mono);
  font-size: 11px;
  gap: 8px;
  text-align: left;

  &:hover {
    background: rgb(255 255 255 / 5%);
  }

  &.on {
    background: rgb(255 255 255 / 9%);
    color: var(--text);
  }

  .mark {
    width: 9px;
    flex: 0 0 9px;
    color: var(--text-faint);
  }

  &.added .mark {
    color: var(--done);
  }
  &.deleted .mark {
    color: var(--danger);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

/* Truncate a folder from the left: the leaf is what tells it apart. */
.dir .path {
  overflow: hidden;
  direction: rtl;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pane {
  flex: 1;
  min-width: 0;
}
</style>

<!-- Monaco renders glyph decorations as widgets of its own, out of reach of scoped styles. -->
<style lang="scss">
.monaco-editor .glyph-margin-widgets .ask {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4a9eff;
  cursor: pointer;
  font-size: 13px;
  opacity: 0.65;

  &:hover {
    opacity: 1;
  }
}
</style>
