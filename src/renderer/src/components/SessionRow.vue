<script setup lang="ts">
import type { SessionRecord } from '@shared/types'
import { STATUS_LABEL } from '@shared/types'
import { contextShare } from '@shared/types'
import { relativeTime } from '@/time'
import StatusDot from './StatusDot.vue'
import ContextMeter from './ContextMeter.vue'

defineProps<{ session: SessionRecord; now: number; selected: boolean; live?: boolean }>()
</script>

<template>
  <button class="row" :class="{ selected }" type="button">
    <StatusDot :status="session.status" />
    <div class="body">
      <div class="line">
        <span class="title">{{ session.title }}</span>
        <span v-if="live" class="live" title="Terminal attached">live</span>
        <span class="age">{{ relativeTime(session.lastActivity, now) }}</span>
      </div>
      <div class="line meta">
        <span class="status" :class="session.status">{{ STATUS_LABEL[session.status] }}</span>
        <span v-if="session.gitBranch" class="branch">{{ session.gitBranch }}</span>
        <ContextMeter v-if="(contextShare(session) ?? 0) >= 0.7" :session="session" compact />
        <span v-if="session.pullRequests !== null" class="prs">{{ session.pullRequests }} PR</span>
      </div>
      <p v-if="session.summary" class="summary">{{ session.summary }}</p>
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

.branch {
  overflow: hidden;
  color: var(--text-faint);
  font-family: var(--mono);
  text-overflow: ellipsis;
  white-space: nowrap;

  &::before {
    content: '· ';
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
</style>
