<script setup lang="ts">
import { computed } from 'vue'
import { Sparkles, Check, Flag, ChevronLeft, ChevronRight, ArrowRight, ShieldCheck, AlertCircle, LoaderCircle, ListChecks } from 'lucide-vue-next'
import type { Region, SolveResult } from '../domain/types'
const props = defineProps<{
  result: SolveResult | null; solving: boolean; size: number; grid: readonly (readonly number[])[]
  regions: readonly Readonly<Region>[]; solutionIndex: number; previewing: boolean
}>()
const autoSolve = defineModel<boolean>('autoSolve', { required: true })
const emit = defineEmits<{ solve: []; preview: [index: number] }>()
const summary = computed(() => {
  if (props.solving) return { title: '正在进行逻辑推理', subtitle: '枚举满足全部约束的布局', tone: 'waiting' }
  if (!props.result) return { title: '等待开始求解', subtitle: '编辑棋盘后，点击下方按钮', tone: 'waiting' }
  const map = {
    unique: { title: '找到唯一答案', subtitle: '所有地雷位置均已确定', tone: 'success' },
    multiple: { title: `存在 ${props.result.total.toLocaleString()} 个解`, subtitle: '区分共同结论与方案预览', tone: 'multiple' },
    none: { title: '没有合法答案', subtitle: '色块或手动标记需要调整', tone: 'warning' },
    invalid: { title: '棋盘约束冲突', subtitle: '请先修正下方提示的问题', tone: 'warning' },
    limited: { title: '已达到搜索预算', subtitle: `已找到 ${props.result.total.toLocaleString()} 个方案，未穷尽`, tone: 'multiple' },
  }
  return map[props.result.status]
})
const placements = computed(() => {
  if (!props.result?.total) return []
  if (props.previewing) return props.result.solutions[props.solutionIndex]!.map((col, row) => ({ row, col }))
  if (!props.result.complete) return []
  return props.result.counts.flatMap((row, r) => row.flatMap((hits, c) => hits === props.result!.total ? [{ row: r, col: c }] : []))
})
const placementRows = computed(() => placements.value.map(({ row, col }) => {
  const region = props.regions.find(r => r.id === props.grid[row]![col])
  return { row, col, name: region?.name ?? '', color: region?.color ?? '#ddd' }
}))
const safeCount = computed(() => props.result?.complete && props.result.total ? props.result.counts.flat().filter(count => count === 0).length : 0)
const nodes = computed(() => props.result?.nodes.toLocaleString() ?? '—')
const exact = computed(() => !!props.result?.complete && props.result.total > 0)
</script>

<template>
  <aside class="results panel" aria-label="求解结果" aria-live="polite">
    <div class="panel-heading"><div><span class="eyebrow">LOGIC ENGINE</span><h2 class="panel-title">推理结果</h2></div><Sparkles :size="19" class="muted-icon" /></div>
    <div class="solve-summary" :class="summary.tone"><div class="summary-icon"><LoaderCircle v-if="solving" :size="22" class="spin" /><Check v-else-if="result?.status === 'unique'" :size="23" /><AlertCircle v-else-if="result?.status === 'none' || result?.status === 'invalid'" :size="22" /><Sparkles v-else :size="21" /></div><h3>{{ summary.title }}</h3><p>{{ summary.subtitle }}</p></div>
    <div class="result-metrics"><div><strong>{{ solving ? '…' : result ? (result.complete ? result.total : `${result.total}+`) : '—' }}</strong><span>合法方案</span></div><div><strong>{{ previewing && result?.total ? size : exact ? placements.length : '—' }}<small> / {{ size }}</small></strong><span>{{ previewing ? '方案中地雷' : '确定的地雷' }}</span></div></div>
    <div class="auto-row"><label for="auto-solve">编辑后自动求解</label><button id="auto-solve" class="switch" :class="{ enabled: autoSolve }" role="switch" :aria-checked="autoSolve" aria-label="编辑后自动求解" @click="autoSolve = !autoSolve"><span></span></button></div>
    <button class="solve-button" :disabled="solving" @click="emit('solve')"><LoaderCircle v-if="solving" :size="17" class="spin" /><Sparkles v-else :size="17" />{{ solving ? '正在求解' : '重新求解' }}<ArrowRight :size="16" class="solve-arrow" /></button>
    <div v-if="result?.issues.length && !solving" class="issues"><p v-for="issue in result.issues" :key="issue">{{ issue }}</p></div>
    <template v-if="result?.total && !solving">
      <div class="positions-heading"><h3><Flag :size="13" />{{ previewing ? '方案中的地雷' : '确定地雷位置' }}</h3><span>{{ placementRows.length }} 个</span></div>
      <div v-if="placementRows.length" class="positions"><div v-for="cell in placementRows" :key="cell.row" class="position"><span class="position-dot" :style="{ backgroundColor: cell.color }"></span><span class="position-coord">R{{ cell.row + 1 }} <span>·</span> C{{ cell.col + 1 }}</span><span class="position-color">{{ cell.name }}</span><Check v-if="!previewing" :size="12" class="position-check" /></div></div>
      <p v-else class="no-consensus">{{ result.complete ? '没有所有解共同的雷位。可预览不同方案，或添加已知标记继续推理。' : '搜索未穷尽，不能认定必然雷位。请查看已找到的方案。' }}</p>
      <div v-if="result.total > 1 || !result.complete || previewing" class="solution-nav"><button class="icon-button" :disabled="solutionIndex <= 0" aria-label="上一方案" @click="emit('preview', solutionIndex - 1)"><ChevronLeft :size="16" /></button><button class="preview-button" @click="emit('preview', solutionIndex)">预览方案 {{ solutionIndex + 1 }} / {{ result.total.toLocaleString() }}</button><button class="icon-button" :disabled="solutionIndex >= result.total - 1" aria-label="下一方案" @click="emit('preview', solutionIndex + 1)"><ChevronRight :size="16" /></button></div>
      <div v-if="exact" class="verification"><div class="verification-title"><ShieldCheck :size="14" />全约束验证通过</div><p><Check :size="11" />每色一雷 · 每行每列一雷</p><p><Check :size="11" />所有地雷八方向互不相邻</p><p><Check :size="11" />{{ safeCount }} 格在全部方案中安全</p></div>
    </template>
    <details class="explanation"><summary><ListChecks :size="13" />如何得出答案？</summary><p>按行选择一枚地雷，排除已使用的列、颜色及相邻行的斜邻格；手动标雷和排除也作为约束。回溯搜索枚举合法方案。</p><p>穷尽后，出现在全部方案中的格子才是“必定有雷”；从未出现的格子才是“必定安全”。多解时不会随意把一个方案当作唯一答案。</p><p>搜索上限：10,000 个解或 1,000,000 个节点。到达上限时仅展示部分方案，不宣称唯一解。</p></details>
    <div class="engine-footer"><span class="status-dot"></span>浏览器本地计算<span>{{ nodes }} 节点</span></div>
  </aside>
</template>

<style scoped>
.results { padding: 22px 18px 0; align-self: start; overflow: hidden; }.panel-heading { margin-bottom: 22px; }.solve-summary { background: #edf6ef; padding: 23px 12px 20px; border: 1px solid #deece0; border-radius: 11px; text-align: center; }.summary-icon { display: grid; place-items: center; width: 43px; height: 43px; border-radius: 50%; margin: 0 auto 12px; background: #dcefe0; color: #4b8964; }.solve-summary h3 { font-size: 15px; font-weight: 600; color: #3d6c50; margin: 0 0 7px; }.solve-summary p { color: #8aa18e; font-size: 10px; margin: 0; }.solve-summary.multiple { background: #f8f4e7; border-color: #eee6d0; }.multiple .summary-icon { background: #efe7cc; color: #aa8f42; }.multiple h3 { color: #967b35; }.multiple p { color: #b29e6b; }.solve-summary.warning { background: #fdf1ea; border-color: #f1e1d4; }.warning .summary-icon { background: #f4dfd1; color: #b77d55; }.warning h3 { color: #aa744b; }.warning p { color: #b3937e; }.solve-summary.waiting { background: #f6f8f4; border-color: var(--line); }.waiting .summary-icon { background: #e8eee4; color: #8d9d85; }.waiting h3, .waiting p { color: #8d9d85; }.result-metrics { display: grid; grid-template-columns: 1fr 1fr; margin: 18px 0 21px; }.result-metrics div { display: flex; flex-direction: column; gap: 7px; align-items: center; }.result-metrics div + div { border-left: 1px solid var(--line); }.result-metrics strong { font-family: var(--mono); font-size: 24px; font-weight: 500; color: #46584b; }.result-metrics small { font-size: 13px; color: #b0b9ad; }.result-metrics span { font-size: 10px; color: #929e90; }.auto-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }.auto-row label { font-size: 11px; color: #849282; }.switch { width: 30px; height: 17px; border: 0; border-radius: 15px; background: #d3dcd0; padding: 3px; transition: background .15s; }.switch span { display: block; background: #fff; width: 11px; height: 11px; border-radius: 50%; transition: transform .15s; }.switch.enabled { background: #548b76; }.switch.enabled span { transform: translateX(13px); }.solve-button { display: flex; align-items: center; gap: 8px; width: 100%; justify-content: center; border: 0; background: #4d7e68; color: #fff; border-radius: 8px; padding: 12px 13px; font-size: 12px; box-shadow: 0 3px 6px #4d7e6810; }.solve-button:hover { background: #406e5a; }.solve-arrow { margin-left: auto; }.solve-button > svg:first-child { margin-right: auto; }.positions-heading { display: flex; align-items: center; justify-content: space-between; margin: 26px 0 13px; }.positions-heading h3 { font-size: 11px; display: flex; align-items: center; gap: 6px; margin: 0; font-weight: 500; }.positions-heading > span { color: #a2ada0; font-size: 10px; }.positions { display: grid; gap: 5px; max-height: 345px; overflow-y: auto; scrollbar-width: thin; }.position { display: flex; align-items: center; gap: 9px; padding: 9px 8px; border-radius: 6px; background: #f9faf7; }.position-dot { width: 8px; height: 8px; border-radius: 3px; }.position-coord { font-family: var(--mono); font-size: 11px; color: #50634f; }.position-coord > span { color: #bac4b6; padding: 0 3px; }.position-color { font-size: 9px; color: #9aa794; margin-left: auto; }.position-check { color: #80a38b; }.verification { background: #f6f9f3; border: 1px dashed #dbe5d7; padding: 12px; margin-top: 18px; border-radius: 8px; }.verification-title { font-size: 11px; display: flex; gap: 6px; color: #69956a; margin-bottom: 10px; }.verification p { display: flex; gap: 6px; font-size: 9px; color: #94a48a; margin: 8px 0 0; }.engine-footer { display: flex; align-items: center; gap: 5px; font-size: 9px; color: #a3ada0; margin: 19px -18px 0; padding: 14px 16px; border-top: 1px solid var(--line); background: #fcfdfa; }.engine-footer > span:last-child { margin-left: auto; font-family: var(--mono); }.engine-footer .status-dot { width: 4px; height: 4px; background: #9db393; }.explanation { border-top: 1px solid var(--line); padding-top: 13px; margin-top: 20px; }.explanation summary { list-style: none; display: flex; align-items: center; gap: 7px; cursor: pointer; color: #95a28f; font-size: 10px; }.explanation p { color: #91a087; font-size: 10px; line-height: 1.8; margin: 12px 0; }.issues { color: #af8257; font-size: 11px; line-height: 1.8; padding: 10px 12px; margin-top: 16px; border-radius: 8px; background: #fff7eb; }.issues p { margin: 0 0 6px; }.issues p:last-child { margin-bottom: 0; }.no-consensus { font-size: 11px; color: #9caa93; line-height: 1.8; }.solution-nav { display: flex; justify-content: space-between; align-items: center; background: #f5f7f0; padding: 5px; margin-top: 15px; border-radius: 7px; }.preview-button { font-size: 9px; border: 0; background: transparent; color: #7c906e; }.spin { animation: spin 1s linear infinite; }@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 1180px) and (min-width: 721px) { .results { grid-column: 2; }.positions { grid-template-columns: repeat(2, 1fr); }.panel-heading { margin-bottom: 16px; }.solve-summary { padding: 16px; }.summary-icon { margin-bottom: 8px; }.result-metrics { margin-top: 16px; } }
@media (max-width: 720px) { .results { order: 3; padding: 20px 16px 0; }.positions { grid-template-columns: repeat(2, 1fr); }.position-coord { font-size: 10px; }.position { gap: 6px; padding: 9px 7px; } }
</style>
