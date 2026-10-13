<script setup lang="ts">
import type { SessionRecord } from '@shared/types'
import { STATUS_LABEL } from '@shared/types'
import { computed } from 'vue'
import { contextShare } from '@shared/types'
import { sessionLinks } from '@shared/links'
import { PR_GLYPH, prStateOf } from '@/prs'
import { relativeTime } from '@/time'
import StatusDot from './StatusDot.vue'
import ContextMeter from './ContextMeter.vue'

const props = defineProps<{
  session: SessionRecord
  now: number
  selected: boolean
  live?: boolean
}>()

const links = computed(() => sessionLinks(props.session))

function open(url: string, event: MouseEvent): void {
  event.stopPropagation()
  void window.rolly.openExternal(url)
}
</script>

<template>
  <button class="row" :class="{ selected, waiting: session.status === 'needs-you' }" type="button">
    <StatusDot :status="session.status" />
    <div class="body">
      <div class="line">
        <span class="title">{{ session.title }}</span>
        <span v-if="live" class="live" title="Terminal attached">live</span>
        <span class="age">{{ relativeTime(session.lastActivity, now) }}</span>
      </div>
      <div class="line meta">
        <span class="status" :class="session.status">{{ STATUS_LABEL[session.status] }}</span>
        <ContextMeter v-if="(contextShare(session) ?? 0) >= 0.7" :session="session" compact />
        <span v-if="session.pullRequests !== null" class="prs">{{ session.pullRequests }} PR</span>
      </div>
      <p v-if="session.summary" class="summary">{{ session.summary }}</p>
      <div v-if="links.length" class="links">
        <button
          v-for="link in links.slice(0, 3)"
          :key="link.url"
          class="link"
          :class="[link.kind, prStateOf(link.url)]"
          type="button"
          :title="prStateOf(link.url) ? `${prStateOf(link.url)} — ${link.url}` : link.url"
          @click="open(link.url, $event)"
        >
          <span v-if="prStateOf(link.url)" class="glyph">{{ PR_GLYPH[prStateOf(link.url)!] }}</span>
          {{ link.label }}
        </button>
        <span v-if="links.length > 3" class="more">+{{ links.length - 3 }}</span>
      </div>
    </div>
  </button>
</template>

<style lang="scss" scoped>
.row {
  display: flex;
  gap: 12px;
  width: 100%;
  padding: 14px 18px;
  text-align: left;
  border: 0;
  border-bottom: 1px solid var(--border);
  border-radius: 0;

  &:hover {
    background: var(--bg-hover);
  }
  &.selected {
    background: var(--bg-raised);
  }
  /** Needs-you no longer has its own group, so the row carries the urgency itself. */
  &.waiting {
    box-shadow: inset 3px 0 0 var(--needs-you);
  }
}

.dot {
  margin-top: 5px;
}

.body {
  min-width: 0;
  flex: 1;
}

.line {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.title {
  overflow: hidden;
  flex: 1;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.live {
  padding: 1px 6px;
  border: 1px solid var(--working);
  border-radius: 999px;
  color: var(--working);
  font-size: 10px;
}

.age,
.prs {
  color: var(--text-faint);
  font-size: 12px;
}

.meta {
  margin-top: 3px;
  font-size: 12px;
}

.status {
  &.needs-you {
    color: var(--needs-you);
  }
  &.working {
    color: var(--working);
  }
  &.done {
    color: var(--done);
  }
  &.idle {
    color: var(--idle);
  }
}

.prs {
  margin-left: auto;
}

.summary {
  display: -webkit-box;
  overflow: hidden;
  margin: 6px 0 0;
  color: var(--text-dim);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.links {
  display: flex;
  flex-wrap: wrap;
  margin-top: 7px;
  gap: 6px;
}

.link {
  padding: 2px 7px;
  border-radius: 5px;
  font-family: var(--mono);
  font-size: 11px;

  &.pr {
    border-color: transparent;
    background: var(--bg-raised);
    color: var(--text-dim);
  }

  &.open {
    color: var(--done);
  }
  &.draft {
    color: var(--text-faint);
  }
  /** Merged and closed are done with: dimmed so open work reads first. */
  &.merged {
    color: var(--merged);
    opacity: 0.8;
  }
  &.closed {
    color: var(--danger);
    opacity: 0.8;
    text-decoration: line-through;
  }

  .glyph {
    margin-right: 1px;
    font-size: 9px;
  }

  &:hover {
    border-color: var(--text-faint);
  }
}

.more {
  align-self: center;
  color: var(--text-faint);
  font-size: 11px;
}
</style>
