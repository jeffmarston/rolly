<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { SessionRecord } from '@shared/types'
import { draftTicket } from '@shared/ticket'

const props = defineProps<{ open: boolean; session: SessionRecord | null }>()
const emit = defineEmits<{ close: []; created: [issue: { key: string; url: string }] }>()

type Project = { key: string; name: string; issueTypes: string[] }

const needsCredentials = ref(false)
const busy = ref(false)
const error = ref('')

const site = ref('spn.atlassian.net')
const email = ref('')
const token = ref('')

const projects = ref<Project[]>([])
const project = ref('DEV')
const issueType = ref('Story')
const summary = ref('')
const description = ref('')
const firstField = ref<HTMLInputElement>()

const types = computed(
  () => projects.value.find((p) => p.key === project.value)?.issueTypes ?? ['Story', 'Task', 'Bug']
)

watch(
  () => props.open,
  async (open) => {
    if (!open || !props.session) return
    error.value = ''
    const draft = draftTicket(props.session)
    summary.value = draft.summary
    description.value = draft.description

    needsCredentials.value = !(await window.rolly.jira.hasCredentials())
    if (!needsCredentials.value) await loadProjects()
    await nextTick()
    firstField.value?.focus()
  }
)

async function loadProjects(): Promise<void> {
  try {
    projects.value = await window.rolly.jira.projects()
    if (!projects.value.some((p) => p.key === project.value)) {
      project.value = projects.value[0]?.key ?? ''
    }
    if (!types.value.includes(issueType.value)) issueType.value = types.value[0] ?? ''
  } catch (cause) {
    error.value = String(cause)
  }
}

async function connect(): Promise<void> {
  busy.value = true
  error.value = ''
  try {
    await window.rolly.jira.saveCredentials({
      site: site.value.trim(),
      email: email.value.trim(),
      token: token.value.trim()
    })
    token.value = ''
    needsCredentials.value = false
    await loadProjects()
  } catch (cause) {
    error.value = String(cause)
  } finally {
    busy.value = false
  }
}

async function create(): Promise<void> {
  if (!props.session) return
  busy.value = true
  error.value = ''
  try {
    const issue = await window.rolly.jira.create(props.session.id, {
      project: project.value,
      issueType: issueType.value,
      summary: summary.value.trim(),
      description: description.value.trim()
    })
    emit('created', issue)
  } catch (cause) {
    error.value = String(cause)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="emit('close')">
    <section class="dialog">
      <template v-if="needsCredentials">
        <h2>Connect Jira</h2>
        <p class="hint">
          Rolly needs an Atlassian API token to create tickets. Make one at
          <em>id.atlassian.com → Security → API tokens</em>. It's stored encrypted by your keychain,
          never in plain text.
        </p>

        <label for="jira-site">Site</label>
        <input id="jira-site" ref="firstField" v-model="site" spellcheck="false" />

        <label for="jira-email">Account email</label>
        <input id="jira-email" v-model="email" spellcheck="false" placeholder="you@company.com" />

        <label for="jira-token">API token</label>
        <input id="jira-token" v-model="token" type="password" @keydown.enter="connect" />

        <p v-if="error" class="error">{{ error }}</p>

        <footer>
          <button type="button" @click="emit('close')">Cancel</button>
          <button
            type="button"
            class="primary"
            :disabled="busy || !site || !email || !token"
            @click="connect"
          >
            {{ busy ? 'Checking…' : 'Connect' }}
          </button>
        </footer>
      </template>

      <template v-else>
        <h2>New ticket</h2>

        <div class="row">
          <div>
            <label for="jira-project">Project</label>
            <select id="jira-project" v-model="project">
              <option v-for="p in projects" :key="p.key" :value="p.key">
                {{ p.key }} — {{ p.name }}
              </option>
            </select>
          </div>
          <div>
            <label for="jira-type">Type</label>
            <select id="jira-type" v-model="issueType">
              <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
        </div>

        <label for="jira-summary">Summary</label>
        <input id="jira-summary" ref="firstField" v-model="summary" />

        <label for="jira-description">Description</label>
        <textarea id="jira-description" v-model="description" rows="9" />

        <p v-if="error" class="error">{{ error }}</p>

        <footer>
          <button type="button" @click="emit('close')">Cancel</button>
          <button
            type="button"
            class="primary"
            :disabled="busy || !summary.trim() || !project"
            @click="create"
          >
            {{ busy ? 'Creating…' : 'Create ticket' }}
          </button>
        </footer>
      </template>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.backdrop {
  position: fixed;
  display: grid;
  background: #00000088;
  inset: 0;
  place-items: center;
}

.dialog {
  display: flex;
  width: 560px;
  max-height: 86vh;
  flex-direction: column;
  overflow-y: auto;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-rail);

  h2 {
    margin: 0 0 14px;
    font-size: 17px;
  }

  .hint {
    margin: 0 0 18px;
    color: var(--text-dim);
    font-size: 12px;
    line-height: 1.5;
  }

  label {
    margin-bottom: 6px;
    color: var(--text-faint);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }


  input,
  select,
  textarea {
    margin-bottom: 16px;
    padding: 9px 11px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    box-shadow: inset 0 1px 3px rgb(0 0 0 / 45%);
    color: var(--text);
    font-family: inherit;

    &:focus {
      border-color: var(--working);
      outline: none;
    }
  }

  textarea {
    font-family: var(--mono);
    font-size: 12px;
    line-height: 1.5;
    resize: vertical;
  }
}

.row {
  display: flex;
  gap: 14px;

  > div {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
  }
}

.error {
  margin: 0 0 14px;
  color: var(--danger);
  font-size: 12px;
  word-break: break-word;
}

footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
  gap: 10px;

  button {
    padding: 8px 16px;
  }

  .primary {
    border-color: var(--working);
    color: var(--working);
  }
}
</style>
