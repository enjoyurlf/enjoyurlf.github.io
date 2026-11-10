<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { Flag, X, Sparkles, MousePointer2, CircleDot, Eye, Grid2X2 } from 'lucide-vue-next'
import type { CellMark, Region, SolveResult } from '../domain/types'
import type { BoardView, EditTool } from '../composables/usePuzzle'
const props = defineProps<{
  puzzle: { readonly size: number; readonly grid: readonly (readonly number[])[]; readonly marks: readonly (readonly CellMark[])[] }
  regions: readonly Readonly<Region>[]; result: SolveResult | null; solving: boolean; tool: EditTool
  view: BoardView; solutionIndex: number; activeCount: number
}>()
const emit = defineEmits<{
  cell: [row: number, col: number]; pick: [id: number]; begin: []; end: []; view: [view: BoardView]
}>()
const dragging = shallowRef(false)
const lastCell = shallowRef('')
const regionMap = computed(() => new Map(props.regions.map(region => [region.id, region])))
const coordinates = computed(() => Array.from({ length: props.puzzle.size }, (_, index) => index + 1))
const cells = computed(() => props.puzzle.grid.flatMap((row, r) => row.map((regionId, c) => {
  const region = regionMap.value.get(regionId)
  const mark = props.puzzle.marks[r]![c]!
  let state: 'mine' | 'safe' | 'possible' | 'preview' | 'blank' = 'blank'
  if (mark === 'mine') state = 'mine'
  else if (mark === 'safe') state = 'safe'
  else if (props.view === 'solution' && props.result?.solutions[props.solutionIndex]?.[r] === c) state = 'preview'
  else if (props.view === 'certainty' && props.result && props.result.total > 0 && props.result.complete) {
    const hits = props.result.counts[r]![c]!
    state = hits === props.result.total ? 'mine' : hits === 0 ? 'safe' : 'possible'
  }
  const description = { mine: mark === 'mine' ? '手动标雷' : '必定有雷', safe: mark === 'safe' ? '手动排除' : '必定安全', possible: '可能有雷', preview: '方案中的地雷', blank: '未标记' }[state]
  return { r, c, regionId, color: region?.color ?? '#ddd', state, manual: mark !== 'unknown', label: `第${r + 1}行第${c + 1}列，${region?.name ?? '未知颜色'}，${description}` }
})))
const toolHint = computed(() => ({ paint: '点击或拖动格子涂色 · 右键取色', mine: '标记已知地雷 · 作为求解约束', safe: '排除已知安全格 · 作为求解约束', erase: '擦除手动标记 · 保留格子颜色' })[props.tool])
const statusText = computed(() => props.solving ? '正在推理…' : props.result?.status === 'unique' ? '已找到唯一解' : props.result?.status === 'multiple' ? '存在多个合法方案' : props.result?.status === 'limited' ? '仅显示部分方案' : props.result ? '请检查棋盘约束' : '等待求解')
const tabs = [ { id: 'certainty' as const, title: '推理结果', icon: Sparkles }, { id: 'colors' as const, title: '原始色块', icon: Grid2X2 }, { id: 'solution' as const, title: '方案预览', icon: Eye } ]
function act(r: number, c: number) {
  const key = `${r}-${c}`
  if (lastCell.value === key) return
  lastCell.value = key; emit('cell', r, c)
}
function start(event: PointerEvent, r: number, c: number) {
  if (event.button !== 0) return
  event.preventDefault(); dragging.value = true; lastCell.value = ''; emit('begin'); act(r, c)
}
function move(event: PointerEvent) {
  if (!dragging.value) return
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-cell]')
  if (target) act(Number(target.dataset.row), Number(target.dataset.col))
}
function stop() { if (dragging.value) { dragging.value = false; lastCell.value = ''; emit('end') } }
function keyboardClick(event: MouseEvent, r: number, c: number) {
  if (event.detail !== 0) return
  emit('begin'); emit('cell', r, c); emit('end')
}
function navigate(event: KeyboardEvent, r: number, c: number) {
  const direction = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[event.key]
  if (!direction) return
  event.preventDefault()
  const row = (r + direction[0]! + props.puzzle.size) % props.puzzle.size
  const col = (c + direction[1]! + props.puzzle.size) % props.puzzle.size
  const board = (event.currentTarget as HTMLElement).closest('.cell-grid')
  board?.querySelector<HTMLButtonElement>(`[data-row="${row}"][data-col="${col}"]`)?.focus()
}
onMounted(() => { window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop) })
onUnmounted(() => { window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop) })
</script>

<template>
  <section class="board-panel panel" aria-label="扫雷棋盘">
    <div class="board-heading"><div><span class="eyebrow">THE BOARD</span><h2 class="panel-title">你的逻辑画布 <span class="dimension">{{ puzzle.size }} × {{ puzzle.size }}</span></h2></div><span class="board-status" :class="{ resolved: result?.status === 'unique' && !solving }"><span class="status-dot"></span>{{ statusText }}</span></div>
    <div class="board-tabs" role="group" aria-label="棋盘显示模式"><button v-for="tab in tabs" :key="tab.id" :class="{ selected: view === tab.id }" :aria-pressed="view === tab.id" :disabled="tab.id === 'solution' && !result?.total" @click="emit('view', tab.id)"><component :is="tab.icon" :size="13" />{{ tab.title }}</button></div>
    <div class="canvas" :class="{ 'large-board': puzzle.size > 10 }" :style="{ '--size': puzzle.size }">
      <div class="column-coordinates"><span v-for="num in coordinates" :key="num">{{ num }}</span></div>
      <div class="row-coordinates"><span v-for="num in coordinates" :key="num">{{ num }}</span></div>
      <div class="cell-grid" @pointermove="move">
        <button v-for="cell in cells" :key="`${cell.r}-${cell.c}`" class="cell" :class="[cell.state, { manual: cell.manual }]" :style="{ backgroundColor: cell.color }" :aria-label="cell.label" :title="cell.label" :data-cell="true" :data-row="cell.r" :data-col="cell.c" :data-region="cell.regionId" :data-state="cell.state" @pointerdown="start($event, cell.r, cell.c)" @click="keyboardClick($event, cell.r, cell.c)" @keydown="navigate($event, cell.r, cell.c)" @contextmenu.prevent="emit('pick', cell.regionId)">
          <span v-if="cell.state === 'mine' || cell.state === 'preview'" class="mine-token"><Flag :size="21" :stroke-width="2" /></span>
          <X v-else-if="cell.state === 'safe'" class="safe-mark" :size="18" :stroke-width="1.8" />
          <span v-else-if="cell.state === 'possible'" class="possible-mark"></span>
          <span v-if="cell.manual" class="manual-dot"></span>
        </button>
      </div>
    </div>
    <div class="board-legend"><span><Flag :size="13" />{{ view === 'solution' ? '方案预览' : '必定有雷' }}</span><span><X :size="13" />必定安全</span><span><CircleDot :size="12" />可能有雷</span><span class="legend-manual"><i></i>手动标记</span></div>
    <div class="board-bottom"><span class="interaction-tip"><MousePointer2 :size="13" />{{ toolHint }}</span><span class="cell-total">{{ puzzle.size ** 2 }} CELLS</span></div>
    <p v-if="view === 'solution' && result?.total" class="preview-note">正在展示第 {{ solutionIndex + 1 }} 个合法方案；多解时，预览地雷不等于必定有雷。</p>
    <p v-else-if="result?.status === 'limited'" class="preview-note">搜索尚未穷尽。切换“方案预览”查看已找到的解，当前不显示确定性推断。</p>
  </section>
</template>

<style scoped>
.board-panel { padding: 24px 24px 0; align-self: start; min-width: 0; overflow: hidden; }.board-heading { display: flex; justify-content: space-between; gap: 10px; align-items: center; margin-bottom: 20px; }.dimension { margin-left: 7px; font-family: var(--mono); font-size: 11px; color: #9aa59b; font-weight: 400; }.board-status { font-size: 10px; display: flex; align-items: center; gap: 6px; color: #929e94; white-space: nowrap; }.board-status .status-dot { background: #b7bfb6; }.board-status.resolved { color: var(--teal); }.board-status.resolved .status-dot { background: var(--teal); }.board-tabs { display: flex; border-bottom: 1px solid var(--line); margin: 0 -24px; padding: 0 24px; gap: 23px; }.board-tabs button { border: 0; background: transparent; display: flex; gap: 6px; align-items: center; padding: 0 0 13px; color: #97a198; font-size: 11px; border-bottom: 2px solid transparent; margin-bottom: -1px; }.board-tabs button.selected { color: var(--teal); border-bottom-color: var(--teal); }.canvas { display: grid; grid-template-columns: 18px 1fr; grid-template-rows: 20px 1fr; gap: 7px; margin: 21px 0 22px -5px; }.column-coordinates { display: grid; grid-template-columns: repeat(var(--size), 1fr); grid-column: 2; align-items: center; }.row-coordinates { display: grid; grid-template-rows: repeat(var(--size), 1fr); align-items: center; }.column-coordinates span, .row-coordinates span { text-align: center; font-family: var(--mono); font-size: 10px; color: #a5ada2; }.cell-grid { display: grid; grid-template-columns: repeat(var(--size), minmax(0, 1fr)); gap: 6px; padding: 8px; background: #f6f7f2; border: 1px solid #eef0e9; border-radius: 14px; user-select: none; touch-action: none; }.cell { position: relative; aspect-ratio: 1; display: grid; place-items: center; border: 0; border-radius: 9px; padding: 0; transition: filter .15s, box-shadow .15s; touch-action: none; min-width: 0; }.cell:hover { filter: brightness(1.04); box-shadow: inset 0 0 0 2px #ffffffb0; }.cell:focus-visible { outline: 3px solid #294d44; outline-offset: 1px; z-index: 1; }.mine-token { background: #fffffff2; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; color: #294b42; box-shadow: 0 3px 7px #173e2820; }.preview .mine-token { outline: 2px dashed #ffffffb0; outline-offset: 3px; }.safe-mark { color: #fff; opacity: .47; }.possible-mark { width: 10px; height: 10px; border: 2px solid #ffffffe0; border-radius: 50%; }.manual-dot { position: absolute; right: 7px; bottom: 7px; width: 5px; height: 5px; background: #244d43; border-radius: 50%; outline: 1px solid #ffffffb0; }.manual .safe-mark { opacity: 1; }.board-legend { display: flex; gap: 17px; justify-content: center; margin: 0 0 24px; color: #869488; font-size: 10px; flex-wrap: wrap; }.board-legend span { display: flex; align-items: center; gap: 5px; }.legend-manual i { width: 5px; height: 5px; background: #244d43; border-radius: 50%; }.board-bottom { display: flex; align-items: center; justify-content: space-between; margin: 0 -24px; padding: 15px 20px; border-top: 1px solid var(--line); background: #fcfdfa; gap: 8px; }.interaction-tip { display: flex; align-items: center; gap: 7px; font-size: 10px; color: #9aa69c; }.cell-total { font-family: var(--mono); font-size: 9px; color: #a4afa3; letter-spacing: .07em; white-space: nowrap; }.preview-note { margin: 0 -24px; padding: 12px 24px; color: #b1813c; background: #fff8e9; font-size: 11px; line-height: 1.7; }.large-board .cell-grid { gap: 3px; padding: 5px; }.large-board .cell { border-radius: 4px; }.large-board .mine-token { width: 70%; height: 70%; }.large-board .mine-token svg { width: 65%; height: 65%; }.large-board .safe-mark { width: 55%; }.large-board .manual-dot { width: 3px; height: 3px; right: 3px; bottom: 3px; }
@media (max-width: 1100px) { .board-status { display: none; }.board-panel { padding: 22px 18px 0; }.board-tabs { gap: 20px; }.board-legend { gap: 12px; }.cell-grid { gap: 5px; }.mine-token { width: 30px; height: 30px; }.mine-token svg { width: 17px; } }
@media (max-width: 720px) { .board-panel { order: 1; padding: 20px 16px 0; }.canvas { margin-top: 17px; gap: 5px; margin-bottom: 18px; }.cell-grid { gap: 5px; padding: 6px; border-radius: 11px; }.cell { border-radius: 7px; }.mine-token { width: 28px; height: 28px; }.board-tabs { padding: 0 20px; gap: 24px; }.cell-total { display: none; }.board-legend { gap: 12px; font-size: 9px; margin-bottom: 20px; }.interaction-tip { font-size: 9px; } }
</style>
