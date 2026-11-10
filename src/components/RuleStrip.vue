<script setup lang="ts">
import { Grid2X2, Rows3, Scan } from 'lucide-vue-next'
const rules = [
  { title: '每种颜色，恰好一雷', text: '同色格子共同组成一个区域', icon: Grid2X2, style: 'color' },
  { title: '每行每列，恰好一雷', text: 'N × N 棋盘共放置 N 枚地雷', icon: Rows3, style: 'row' },
  { title: '地雷之间，不能相邻', text: '上下、左右、斜角均不能接触', icon: Scan, style: 'neighbor' },
]
</script>

<template>
  <section class="rules" aria-label="图片中的三条规则">
    <article v-for="(rule, index) in rules" :key="rule.style" class="rule-card">
      <div class="rule-icon" :class="rule.style"><component :is="rule.icon" :size="23" :stroke-width="1.7" /></div>
      <div><h2 class="rule-title">{{ rule.title }}</h2><p class="rule-text">{{ rule.text }}</p></div>
      <span class="rule-number">0{{ index + 1 }}</span>
    </article>
  </section>
</template>

<style scoped>
.rules { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 26px 0; }
.rule-card { display: flex; gap: 13px; align-items: center; padding: 18px; background: #fff; border: 1px solid var(--line); border-radius: 14px; position: relative; }
.rule-icon { width: 46px; height: 46px; display: grid; place-items: center; flex-shrink: 0; border-radius: 12px; }
.color { background: #e9f3f0; color: #4a8879; }.row { background: #fbf1d8; color: #b58c35; }.neighbor { background: #f2ebf6; color: #9474ac; }
.rule-title { font-size: 14px; margin: 0 0 6px; font-weight: 600; }.rule-text { margin: 0; font-size: 11px; color: var(--muted); }
.rule-number { margin-left: auto; align-self: flex-start; font-size: 10px; font-family: var(--mono); color: #c9cec8; }
@media (max-width: 850px) { .rule-number { display: none; }.rule-card { padding: 13px; gap: 10px; }.rule-title { font-size: 12px; }.rule-icon { width: 36px; height: 36px; }.rule-text { font-size: 10px; } }
@media (max-width: 600px) { .rules { grid-template-columns: 1fr; gap: 8px; margin: 18px 0; }.rule-card { padding: 10px 14px; }.rule-text { display: none; }.rule-title { margin: 0; } }
</style>
