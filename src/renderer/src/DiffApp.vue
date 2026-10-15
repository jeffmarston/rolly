<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, toRaw, watch } from 'vue'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import type { ChangedFile } from '@shared/types'

// Only the editor worker: it computes the diff. Highlighting runs on this thread.
self.MonacoEnvironment = { getWorker: () => new EditorWorker() }

const STATUS_LABEL: Record<string, string> = {
  M: 'modified',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  C: 'copied'
}

const cwd = decodeURIComponent(location.hash.replace('#diff:', ''))
const files = ref<ChangedFile[]>([])
const selected = ref<ChangedFile>()
const error = ref('')
const host = ref<HTMLElement>()
const editor = shallowRef<monaco.editor.IStandaloneDiffEditor>()

onMounted(async () => {
  editor.value = monaco.editor.createDiffEditor(host.value!, {
    theme: 'vs-dark',
    readOnly: true,
    automaticLayout: true,
    renderSideBySide: true,
    scrollBeyondLastLine: false,
    fontSize: 12
  })

  try {
    files.value = await window.rolly.diff.files(cwd)
    selected.value = files.value[0]
  } catch (cause) {
    error.value = String(cause)
  }
})

watch(selected, async (file) => {
  if (!file || !editor.value) return
  try {
    // toRaw: a reactive proxy can't be structured-cloned, and invoke rejects on one.
    const { before, after } = await window.rolly.diff.file(cwd, toRaw(file))
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
    error.value = String(cause)
  }
})

onBeforeUnmount(() => {
  editor.value?.dispose()
  monaco.editor.getModels().forEach((model) => model.dispose())
})
</script>

<template>
  <main class="diff">
    <aside>
      <h1>{{ cwd.split('/').pop() }}</h1>
      <p class="count">{{ files.length }} changed</p>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-else-if="!files.length" class="empty">Nothing changed against HEAD.</p>
      <button
        v-for="file in files"
        :key="file.path"
        type="button"
        class="file"
        :class="[{ on: file.path === selected?.path }, STATUS_LABEL[file.status]]"
        :title="file.path"
        @click="selected = file"
      >
        <span class="mark">{{ file.status }}</span>
        <span class="path">{{ file.path }}</span>
      </button>
    </aside>
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
  width: 280px;
  flex: 0 0 280px;
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
.error {
  margin: 0 4px 10px;
  color: var(--text-faint);
  font-size: 11px;
}

.error {
  color: var(--danger);
}

.file {
  display: flex;
  padding: 5px 7px;
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

  .path {
    overflow: hidden;
    direction: rtl;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.pane {
  flex: 1;
  min-width: 0;
}
</style>
