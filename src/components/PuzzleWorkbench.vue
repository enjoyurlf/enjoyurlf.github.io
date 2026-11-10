<script setup lang="ts">
import { Download, Upload, ArrowUpRight, CircleHelp, Check, X } from 'lucide-vue-next'
import { onMounted, onUnmounted, useTemplateRef } from 'vue'
import ColorEditor from './ColorEditor.vue'
import PuzzleBoard from './PuzzleBoard.vue'
import SolvePanel from './SolvePanel.vue'
import RuleStrip from './RuleStrip.vue'
import { usePuzzle } from '../composables/usePuzzle'
const {
  puzzle, regions, activeRegions, regionCounts, tool, selectedRegion, view, autoSolve,
  solving, result, selectedSolution, notice, saveWarning, canUndo, canRedo,
  beginStroke, endStroke, cellAction, pickRegion, setRegionColor, addRegion, removeRegion,
  undo, redo, resetPreset, newBoard, clearMarks, solve, exportPuzzle, importPuzzle,
} = usePuzzle()
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
function preview(index: number) { selectedSolution.value = index; view.value = 'solution' }
function loadFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void importPuzzle(file)
  input.value = ''
}
function shortcut(event: KeyboardEvent) {
  if ((event.target as HTMLElement)?.closest('input, textarea, [contenteditable]')) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault(); if (event.shiftKey) redo(); else undo()
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo() }
}
onMounted(() => window.addEventListener('keydown', shortcut))
onUnmounted(() => window.removeEventListener('keydown', shortcut))
</script>

<template>
  <div class="app-shell">
    <main class="workspace">
      <section class="hero"><div><div class="hero-kicker"><span></span>COLOR REGIONS, LOGICAL SOLUTIONS</div><h1>让颜色，<span>给出答案。</span></h1><p>将图片里的色块变成可编辑棋盘，让三条简单规则找到每一枚地雷。</p></div><div class="file-actions"><button class="button import-button" @click="fileInput?.click()"><Upload :size="14" />导入棋盘</button><button class="button export-button" @click="exportPuzzle"><Download :size="14" />导出棋盘<ArrowUpRight :size="13" /></button><input ref="fileInput" class="visually-hidden" type="file" accept=".json,application/json" aria-label="导入棋盘 JSON" @change="loadFile" /></div></section>
      <RuleStrip />
      <div v-if="notice || saveWarning" class="notice" role="status"><Check :size="15" /><span>{{ saveWarning || notice }}</span><button v-if="notice && !saveWarning" class="icon-button" aria-label="关闭提示" @click="notice = ''"><X :size="14" /></button></div>
      <div class="workbench">
        <ColorEditor :regions="regions" :counts="regionCounts" :selected-region="selectedRegion" :tool="tool" :size="puzzle.size" :active-count="activeRegions.length" :can-undo="canUndo" :can-redo="canRedo" @select="pickRegion" @color="setRegionColor" @add="addRegion" @remove="removeRegion" @tool="tool = $event" @resize="newBoard" @reset="resetPreset" @undo="undo" @redo="redo" @clear="clearMarks" />
        <PuzzleBoard :puzzle="puzzle" :regions="regions" :result="result" :solving="solving" :tool="tool" :view="view" :solution-index="selectedSolution" :active-count="activeRegions.length" @cell="cellAction" @pick="pickRegion" @begin="beginStroke" @end="endStroke" @view="view = $event" />
        <SolvePanel v-model:auto-solve="autoSolve" :result="result" :solving="solving" :size="puzzle.size" :grid="puzzle.grid" :regions="regions" :solution-index="selectedSolution" :previewing="view === 'solution'" @solve="solve" @preview="preview" />
      </div>
      <footer class="workspace-footer"><p><CircleHelp :size="13" />这是“每区一雷”的逻辑谜题，而非传统数字扫雷。相邻包括对角线。</p><span>颜色可编辑 <i>·</i> 逻辑可验证 <i>·</i> 进度自动保存</span></footer>
    </main>
  </div>
</template>

<style scoped>
.topbar { height: 74px; border-bottom: 1px solid #e9ece4; background: #fdfdfaf2; }.topbar-inner { max-width: 1320px; margin: auto; height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 34px; }.brand { display: flex; align-items: center; gap: 12px; color: #3d5142; font-size: 16px; font-weight: 650; text-decoration: none; }.brand-logo { width: 34px; height: 34px; background: #e7efe5; color: #65896a; display: grid; place-items: center; border-radius: 9px; }.brand-divider { margin: 0 14px; color: #b6beb0; font-weight: 300; }.brand-sub { font-family: var(--mono); font-size: 10px; color: #97a18e; letter-spacing: .14em; font-weight: 400; }.topbar-meta { display: flex; align-items: center; gap: 22px; }.local-badge { display: flex; align-items: center; gap: 6px; font-size: 10px; color: #92a18d; }.version { font-family: var(--mono); font-size: 9px; color: #a5afa1; padding: 5px 8px; border: 1px solid #e2e8dc; border-radius: 4px; }.workspace { max-width: 1320px; margin: auto; padding: 38px 34px 20px; }.hero { display: flex; align-items: center; justify-content: space-between; gap: 20px; }.hero-kicker { display: flex; align-items: center; gap: 7px; font-size: 9px; font-family: var(--mono); letter-spacing: .14em; color: #9ba78f; }.hero-kicker > span { width: 5px; height: 5px; background: #a4b69a; border-radius: 50%; }.hero h1 { font-size: 34px; line-height: 1.25; font-weight: 550; letter-spacing: -.04em; color: #405241; margin: 13px 0 11px; }.hero h1 span { color: #668972; }.hero p { margin: 0; font-size: 12px; color: #98a28f; line-height: 1.8; }.file-actions { display: flex; align-items: center; gap: 10px; align-self: flex-end; margin-bottom: 3px; }.import-button, .export-button { font-size: 11px; padding: 11px 13px; }.export-button { background: #edf2e8; border-color: #e0e7d7; color: #718464; }.workbench { display: grid; grid-template-columns: 258px minmax(0, 1fr) 254px; gap: 18px; align-items: start; }.notice { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 20; width: max-content; max-width: min(650px, calc(100vw - 32px)); display: flex; gap: 9px; align-items: center; background: #eef4e9; border: 1px solid #dfe8d7; color: #547442; border-radius: 9px; padding: 10px 13px; font-size: 11px; margin: 0; line-height: 1.7; box-shadow: 0 6px 24px #30462720; }.notice > .icon-button { margin-left: auto; flex-shrink: 0; }.workspace-footer { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 23px 0 10px; color: #a1ac99; }.workspace-footer p { margin: 0; display: flex; align-items: center; gap: 6px; font-size: 10px; }.workspace-footer > span { font-size: 9px; white-space: nowrap; }.workspace-footer i { font-style: normal; padding: 0 8px; color: #bac4b3; }
@media (max-width: 1180px) { .workbench { grid-template-columns: 260px minmax(0, 1fr); }.workbench > :first-child { grid-row: span 2; }.workspace { max-width: 970px; }.workspace-footer > span { display: none; } }
@media (max-width: 850px) { .workspace { padding: 28px 22px 16px; }.topbar-inner { padding: 0 22px; }.workbench { grid-template-columns: 235px minmax(0, 1fr); gap: 14px; }.hero h1 { font-size: 28px; }.hero p { font-size: 11px; max-width: 360px; }.file-actions { gap: 6px; }.import-button, .export-button { padding: 9px; font-size: 10px; }.import-button > svg, .export-button > svg:last-child { display: none; } }
@media (max-width: 720px) { .topbar { height: 62px; }.topbar-inner { padding: 0 18px; }.brand { font-size: 14px; gap: 9px; }.brand-divider { margin: 0 8px; }.brand-sub { font-size: 8px; }.version { display: none; }.local-badge { font-size: 9px; }.local-badge svg { display: none; }.workspace { padding: 25px 16px 15px; }.hero { display: block; }.hero h1 { font-size: 30px; margin: 12px 0 10px; }.hero p { max-width: none; font-size: 11px; }.hero-kicker { font-size: 8px; }.file-actions { margin-top: 17px; justify-content: flex-end; }.import-button, .export-button { padding: 9px 12px; }.workbench { display: flex; flex-direction: column; gap: 15px; }.workbench > * { width: 100%; }.workspace-footer { padding-top: 20px; }.workspace-footer p { line-height: 1.8; font-size: 9px; align-items: flex-start; }.workspace-footer p svg { flex-shrink: 0; margin-top: 2px; } }
</style>
