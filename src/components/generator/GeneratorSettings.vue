<script setup lang="ts">
import { Shuffle, SlidersHorizontal, LoaderCircle, Info } from 'lucide-vue-next'
const size = defineModel<number>('size', { required: true })
const colorCount = defineModel<number>('colorCount', { required: true })
defineProps<{ issue: string; error: string; busy: boolean; progress: number }>()
const emit = defineEmits<{ generate: []; cancel: [] }>()
</script>

<template>
  <aside class="settings panel">
    <div class="panel-heading"><div><span class="eyebrow">MAKE A PUZZLE</span><h2 class="panel-title">出题设置</h2></div><SlidersHorizontal :size="19" class="muted-icon" /></div>
    <form class="settings-form" @submit.prevent="emit('generate')">
      <label class="field-label" for="generator-size">棋盘边长 <span>1 或 4–16</span></label>
      <div class="size-input"><input id="generator-size" v-model.number="size" type="number" min="1" max="16" step="1" aria-label="随机棋盘边长" aria-describedby="generation-rule generation-issue" /><span>× {{ size || '—' }}</span></div>
      <label class="field-label" for="generator-colors">颜色数量 <span>实际区域数</span></label>
      <input id="generator-colors" v-model.number="colorCount" class="color-input" type="number" min="1" max="16" step="1" aria-label="随机颜色数量" aria-describedby="generation-rule generation-issue" />
      <p id="generation-rule" class="field-hint">每行、每列、每色各一雷，因此颜色数须等于边长。修改边长时，匹配的颜色数会同步调整。</p>
      <p id="generation-issue" class="issue" :role="issue ? 'alert' : undefined">{{ issue }}</p>
      <button type="submit" class="generate-button" :disabled="!!issue || busy"><LoaderCircle v-if="busy" :size="18" class="spin" /><Shuffle v-else :size="18" />{{ busy ? '正在生成…' : '生成随机地图' }}</button>
      <div v-if="busy" class="generation-progress" role="status"><progress :value="progress" max="100" aria-label="地图生成进度" /><span>正在生成色块并验证唯一解 · {{ progress }}%</span><button type="button" class="text-button" @click="emit('cancel')">取消生成</button></div>
      <p v-if="error" class="issue error" role="alert">{{ error }}</p>
    </form>
    <div class="settings-note"><Info :size="16" /><p>2×2 和 3×3 无法同时满足三条规则。每张生成成功的地图都已验证只有一个解，生成后答案自动隐藏。</p></div>
  </aside>
</template>

<style scoped>
.settings { padding: 24px; align-self: start; }
.settings-form { margin-top: 28px; }
.field-label { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; font-weight: 600; margin: 20px 0 10px; }
.field-label span { font-size: 10px; color: #8b9984; font-weight: 400; }
.size-input { display: flex; align-items: center; background: #f7f9f3; border: 1px solid #e2e8db; border-radius: 9px; padding-right: 16px; }
.size-input input { width: 60%; border: 0; background: transparent; padding: 12px 14px; font-family: var(--mono); }
.size-input span { color: #8b9984; margin-left: auto; font-family: var(--mono); }
.color-input { width: 100%; background: #f7f9f3; border: 1px solid #e2e8db; border-radius: 9px; padding: 12px 14px; font-family: var(--mono); }
.field-hint { line-height: 1.9; font-size: 11px; color: #819177; margin: 14px 0 0; }
.issue { color: #9b5d35; font-size: 12px; line-height: 1.8; margin: 12px 0; }
.issue:empty { display: none; }
.generate-button { display: flex; width: 100%; justify-content: center; align-items: center; gap: 9px; border: 0; border-radius: 9px; padding: 14px 12px; margin-top: 22px; background: #4b8067; color: #fff; font-size: 13px; box-shadow: 0 3px 10px #456b3f12; }
.generate-button:hover:not(:disabled) { background: #376b52; }
.generation-progress { display: flex; flex-direction: column; align-items: center; gap: 12px; margin-top: 16px; font-size: 10px; color: #7e9073; }
.generation-progress progress { width: 100%; height: 6px; accent-color: var(--teal); }
.settings-note { display: flex; gap: 9px; margin-top: 24px; padding: 14px; background: #f6f8f1; border-radius: 9px; }
.settings-note svg { flex-shrink: 0; margin-top: 3px; color: #92a183; }
.settings-note p { margin: 0; font-size: 11px; color: #87987c; line-height: 1.9; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 720px) { .settings { padding: 20px; }.settings-form { margin-top: 20px; } }
</style>
