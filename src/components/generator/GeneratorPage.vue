<script setup lang="ts">
import { onMounted } from 'vue'
import { Sparkles } from 'lucide-vue-next'
import RuleStrip from '../RuleStrip.vue'
import GeneratorSettings from './GeneratorSettings.vue'
import GeneratedBoard from './GeneratedBoard.vue'
import { useGenerator } from '../../composables/useGenerator'
const { size, colorCount, issue, generated, busy, revealed, progress, error, generate, cancel, toggleAnswer, downloadPuzzle } = useGenerator()
onMounted(generate)
</script>

<template>
  <main class="generator-page">
    <section class="generator-hero"><div class="hero-kicker"><Sparkles :size="13" /> A NEW CHALLENGE, EVERY TIME</div><h1>随机一张，<span>只有一个答案。</span></h1><p>选择大小与颜色数量，生成属于你的色块扫雷。先独立推理，再揭晓唯一解。</p></section>
    <RuleStrip />
    <div class="generator-layout">
      <GeneratorSettings v-model:size="size" v-model:color-count="colorCount" :issue="issue" :error="error" :busy="busy" :progress="progress" @generate="generate" @cancel="cancel" />
      <GeneratedBoard :generated="generated" :revealed="revealed" :busy="busy" @toggle-answer="toggleAnswer" @download="downloadPuzzle" />
    </div>
    <footer class="generator-footer"><span>全部在浏览器中生成 · 出题成功即已验证唯一解</span><a href="#/editor">想修改这张题目？导出后到编辑页导入 →</a></footer>
  </main>
</template>

<style scoped>
.generator-page { max-width: 1240px; margin: auto; padding: 38px 34px 24px; }
.hero-kicker { display: flex; gap: 7px; align-items: center; font-family: var(--mono); font-size: 9px; letter-spacing: .12em; color: #8f9f82; }
.generator-hero h1 { font-size: 33px; font-weight: 550; letter-spacing: -.035em; color: #405241; margin: 14px 0 12px; }
.generator-hero h1 span { color: #668972; }
.generator-hero p { font-size: 12px; color: #8c9c80; line-height: 1.9; margin: 0; }
.generator-layout { display: grid; grid-template-columns: 285px minmax(0, 1fr); align-items: start; gap: 22px; }
.generator-footer { display: flex; flex-wrap: wrap; gap: 14px; justify-content: space-between; margin-top: 24px; color: #94a389; font-size: 10px; line-height: 1.8; }
.generator-footer a { color: #71896b; text-decoration: none; }
@media (max-width: 950px) { .generator-layout { grid-template-columns: 245px minmax(0, 1fr); gap: 16px; }.generator-page { padding: 30px 22px 20px; } }
@media (max-width: 720px) { .generator-page { padding: 26px 16px 20px; }.generator-hero h1 { font-size: 27px; }.generator-layout { grid-template-columns: minmax(0, 1fr); }.generator-hero p { font-size: 11px; }.generator-footer { font-size: 9px; } }
</style>
