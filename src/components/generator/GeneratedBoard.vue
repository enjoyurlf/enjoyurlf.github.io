<script setup lang="ts">
import { computed } from 'vue'
import { Eye, EyeOff, Flag, Download, ShieldCheck, Grid2X2 } from 'lucide-vue-next'
import type { GeneratedPuzzle } from '../../domain/generator'
const props = defineProps<{ generated: GeneratedPuzzle | null; revealed: boolean; busy: boolean }>()
const emit = defineEmits<{ toggleAnswer: []; download: [] }>()
const coordinates = computed(() => Array.from({ length: props.generated?.puzzle.size ?? 0 }, (_, i) => i + 1))
const regionMap = computed(() => new Map(props.generated?.regions.map(region => [region.id, region]) ?? []))
const cells = computed(() => props.generated?.puzzle.grid.flatMap((row, r) => row.map((id, c) => {
  const region = regionMap.value.get(id)
  const mine = props.revealed && props.generated!.solution[r] === c
  return { r, c, id, color: region?.color, mine, label: `第${r + 1}行第${c + 1}列，${region?.name ?? '区域'}${props.revealed ? mine ? '，地雷' : '，安全' : ''}` }
})) ?? [])
// Coordinates are not rendered into the hidden-answer view.
const answer = computed(() => props.revealed && props.generated ? props.generated.solution.map((col, row) => ({ row: row + 1, col: col + 1 })) : [])
const boardStyle = computed(() => ({ gridTemplateColumns: `repeat(${props.generated?.puzzle.size ?? 1}, minmax(0, 1fr))` }))
</script>

<template>
  <section class="generated-panel panel" aria-label="随机地图" :aria-busy="busy">
    <div class="board-heading"><div><span class="eyebrow">ONE PUZZLE, ONE ANSWER</span><h2 class="panel-title">{{ generated ? `${generated.puzzle.size} × ${generated.puzzle.size} 随机地图` : '你的下一张逻辑地图' }}</h2></div><span v-if="generated" class="verified"><ShieldCheck :size="14" />已验证唯一解</span></div>
    <template v-if="generated">
      <div class="board-toolbar"><p class="answer-state" role="status">{{ revealed ? '答案已显示 · 旗帜即为地雷位置' : '答案已隐藏 · 先试着自己推理' }}</p><div class="board-actions"><button class="button answer-toggle" :aria-pressed="revealed" @click="emit('toggleAnswer')"><EyeOff v-if="revealed" :size="16" /><Eye v-else :size="16" />{{ revealed ? '隐藏答案' : '查看答案' }}</button><button class="button download" aria-label="导出随机棋盘" title="导出题目，不附带答案" @click="emit('download')"><Download :size="16" /><span>导出题目</span></button></div></div>
      <div class="board-canvas" :style="{ maxWidth: `${Math.max(240, generated.puzzle.size * 96)}px` }">
        <div></div><div class="column-labels" :style="boardStyle"><span v-for="col in coordinates" :key="col">{{ col }}</span></div>
        <div class="row-labels" :style="{ gridTemplateRows: `repeat(${generated.puzzle.size}, 1fr)` }"><span v-for="row in coordinates" :key="row">{{ row }}</span></div>
        <div class="generated-grid" :class="{ dense: generated.puzzle.size > 10 }" :style="boardStyle" role="group" :aria-label="`${generated.puzzle.size}阶色块棋盘`">
          <div v-for="cell in cells" :key="`${cell.r}-${cell.c}`" class="generated-cell" :style="{ backgroundColor: cell.color }" :data-generated-row="cell.r" :data-generated-col="cell.c" :data-region="cell.id" :data-answer="cell.mine ? 'mine' : undefined" role="img" :aria-label="cell.label"><span v-if="cell.mine" class="mine-token"><Flag aria-hidden="true" /></span></div>
        </div>
      </div>
      <div class="board-caption"><span><Grid2X2 :size="13" />{{ generated.regions.length }} 种颜色 · {{ generated.puzzle.size }} 枚地雷</span><span>每色一雷 · 每行每列一雷 · 八方向不相邻</span></div>
      <div v-if="revealed" class="answer-panel"><h3><Flag :size="16" />唯一解坐标 <span>行、列从 1 开始</span></h3><div class="answer-coordinates"><span v-for="position in answer" :key="position.row" data-answer-coordinate>R{{ position.row }} <i>·</i> C{{ position.col }}</span></div></div>
    </template>
    <div v-else class="empty-board"><div class="empty-pattern" aria-hidden="true"><span v-for="i in 16" :key="i"></span></div><h3>{{ busy ? '正在创造一张新地图' : '设置参数，生成你的谜题' }}</h3><p>{{ busy ? '随机安排雷位，生成色块，并逐步检验唯一性。' : '点击“生成随机地图”，即可得到唯一解的色块谜题。' }}</p></div>
  </section>
</template>

<style scoped>
.generated-panel { padding: 26px 28px 0; min-width: 0; overflow: hidden; }
.board-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.verified { color: #52846a; background: #edf6ed; padding: 7px 9px; border-radius: 6px; font-size: 10px; display: flex; gap: 5px; align-items: center; white-space: nowrap; }
.board-toolbar { margin: 23px 0 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 15px; border-bottom: 1px solid var(--line); }
.answer-state { font-size: 11px; color: #88997e; margin: 0; line-height: 1.8; }
.board-actions { display: flex; gap: 7px; flex-shrink: 0; }
.board-actions .button { font-size: 12px; padding: 9px 11px; }
.answer-toggle { color: #426f56; background: #eef5ec; border-color: #d2e1cb; }
.board-canvas { display: grid; grid-template-columns: 18px minmax(0, 1fr); grid-template-rows: 24px auto; gap: 5px; margin: 20px auto; }
.column-labels { display: grid; align-items: center; padding: 0 8px; gap: 5px; text-align: center; }
.row-labels { display: grid; align-items: center; text-align: center; padding: 8px 0; gap: 5px; }
.column-labels span, .row-labels span { font-family: var(--mono); font-size: 10px; color: #8d9c84; }
.generated-grid { display: grid; gap: 5px; padding: 8px; background: #f3f6ef; border: 1px solid var(--line); border-radius: 14px; aspect-ratio: 1; }
.generated-cell { display: grid; place-items: center; border-radius: 8px; min-width: 0; min-height: 0; }
.mine-token { width: 46%; height: 46%; min-width: 12px; min-height: 12px; max-width: 38px; max-height: 38px; display: grid; place-items: center; border-radius: 50%; color: #345d4c; background: #fffffff2; box-shadow: 0 2px 5px #173d2512; }
.mine-token svg { width: 57%; height: 57%; }
.board-caption { display: flex; justify-content: space-between; gap: 12px; margin: 24px 0; color: #8c9b84; font-size: 10px; line-height: 1.8; }
.board-caption span:first-child { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.answer-panel { margin: 0 -28px; padding: 20px 28px; border-top: 1px solid var(--line); background: #fafcf7; }
.answer-panel h3 { font-size: 12px; display: flex; align-items: center; gap: 7px; font-weight: 500; margin: 0 0 14px; }
.answer-panel h3 > span { margin-left: auto; color: #94a289; font-size: 10px; }
.answer-coordinates { display: flex; flex-wrap: wrap; gap: 8px; }
.answer-coordinates > span { font-family: var(--mono); color: #577b60; border: 1px solid #e3ebdc; padding: 8px 12px; background: white; border-radius: 6px; font-size: 12px; }
.answer-coordinates i { color: #b7c4ae; font-style: normal; }
.empty-board { min-height: 420px; padding: 70px 15px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.empty-pattern { display: grid; grid-template-columns: repeat(4, 1fr); width: 125px; gap: 5px; transform: rotate(-8deg); margin-bottom: 25px; }
.empty-pattern span { aspect-ratio: 1; border-radius: 5px; background: #c4daca; }.empty-pattern span:nth-child(3n) { background: #f0dca8; }.empty-pattern span:nth-child(4n) { background: #d5c8e5; }
.empty-board h3 { font-weight: 500; font-size: 17px; margin: 15px 0 0; }.empty-board p { font-size: 12px; color: #91a087; line-height: 1.8; }
@media (max-width: 850px) { .board-toolbar { flex-wrap: wrap; }.generated-panel { padding: 22px 18px 0; }.answer-panel { margin: 0 -18px; padding: 20px 18px; }.board-caption { flex-wrap: wrap; }.verified { font-size: 9px; } }
@media (max-width: 720px) { .generated-panel { padding: 20px 14px 0; }.board-toolbar { margin-top: 18px; }.board-actions { margin-left: auto; }.generated-grid { gap: 4px; padding: 5px; border-radius: 10px; }.generated-cell { border-radius: 5px; }.generated-grid.dense { gap: 2px; padding: 3px; }.dense .generated-cell { border-radius: 2px; }.column-labels { padding: 0 5px; gap: 4px; }.row-labels { padding: 5px 0; gap: 4px; }.column-labels span, .row-labels span { font-size: 8px; }.board-canvas { grid-template-columns: 12px minmax(0, 1fr); gap: 3px; }.answer-panel { margin: 0 -14px; padding: 18px 14px; }.board-heading .panel-title { font-size: 15px; }.download span { display: none; }.empty-board { min-height: 330px; }.answer-coordinates > span { font-size: 10px; padding: 7px 10px; } }
</style>
