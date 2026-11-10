<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { Paintbrush, Flag, X, Eraser, Plus, RotateCcw, Undo2, Redo2, Info, Trash2 } from 'lucide-vue-next'
import type { Region } from '../domain/types'
import type { EditTool } from '../composables/usePuzzle'
const props = defineProps<{
  regions: readonly Readonly<Region>[]; counts: Record<number, number>; selectedRegion: number
  tool: EditTool; size: number; activeCount: number; canUndo: boolean; canRedo: boolean
}>()
const emit = defineEmits<{
  select: [id: number]; color: [id: number, color: string]; add: []; remove: [id: number]
  tool: [tool: EditTool]; resize: [size: number]; reset: []; undo: []; redo: []; clear: []
}>()
const draftSize = shallowRef(props.size)
watch(() => props.size, size => { draftSize.value = size })
const validSize = computed(() => Number.isInteger(draftSize.value) && draftSize.value >= 1 && draftSize.value <= 16)
const tools = [
  { id: 'paint' as const, label: '涂色', icon: Paintbrush },
  { id: 'mine' as const, label: '标雷', icon: Flag },
  { id: 'safe' as const, label: '排除', icon: X },
  { id: 'erase' as const, label: '擦除', icon: Eraser },
]
function updateColor(id: number, event: Event) { emit('color', id, (event.target as HTMLInputElement).value) }
</script>

<template>
  <aside class="editor panel" aria-label="棋盘编辑工具">
    <div class="panel-heading"><div><span class="eyebrow">EDITOR</span><h2 class="panel-title">编辑棋盘</h2></div><Paintbrush :size="19" class="muted-icon" /></div>
    <div class="size-section">
      <label class="section-label" for="board-size">棋盘大小 <span>方形棋盘 · 1–16</span></label>
      <div class="size-control"><input id="board-size" v-model.number="draftSize" type="number" min="1" max="16" step="1" aria-label="棋盘边长" /><span class="size-times">× {{ draftSize || '—' }}</span><button class="button small" :disabled="!validSize" @click="emit('resize', draftSize)">新建棋盘</button></div>
      <p class="tiny-hint">新建会重置色块与标记，支持撤销。</p>
    </div>
    <div class="section-top"><h3 class="section-label">操作工具</h3><button class="text-button" @click="emit('clear')">清除标记</button></div>
    <div class="tools" role="group" aria-label="编辑模式"><button v-for="item in tools" :key="item.id" class="tool" :class="{ active: tool === item.id }" :aria-pressed="tool === item.id" @click="emit('tool', item.id)"><component :is="item.icon" :size="17" /><span>{{ item.label }}</span></button></div>
    <div class="section-top palette-heading"><h3 class="section-label">区域颜色 <span class="palette-count">{{ regions.length }}</span></h3><button class="text-button add-color" :disabled="regions.length >= 32" @click="emit('add')"><Plus :size="13" /> 添加</button></div>
    <div class="palette" aria-label="颜色列表">
      <div v-for="(region, index) in regions" :key="region.id" class="swatch-row" :class="{ selected: selectedRegion === region.id }">
        <button class="swatch-select" :aria-label="`选择${region.name}`" :aria-pressed="selectedRegion === region.id" @click="emit('select', region.id)"><span class="swatch" :style="{ backgroundColor: region.color }"></span><span class="color-label"><strong>{{ region.name }}</strong><small>{{ counts[region.id] || 0 }} 格</small></span><span class="region-index">{{ String(index + 1).padStart(2, '0') }}</span></button>
        <label class="color-picker" :title="`调整${region.name}显示颜色`"><input type="color" :value="region.color" :aria-label="`调整${region.name}显示颜色`" @change="updateColor(region.id, $event)" /><span class="picker-dot" :style="{ backgroundColor: region.color }"></span></label>
        <button class="delete-color" :disabled="regions.length <= 1" :aria-label="`删除${region.name}`" :title="'删除后，格子合并到当前选择的其他颜色；可撤销'" @click="emit('remove', region.id)"><Trash2 :size="12" /></button>
      </div>
    </div>
    <div class="region-check" :class="{ mismatch: activeCount !== size }"><span class="status-dot"></span>已使用 {{ activeCount }} 色 <span class="region-check-target">需要 {{ size }} 色</span></div>
    <div class="editor-note"><Info :size="14" /><p>先选颜色，再点击或拖动涂色。右键格子可取色。每个编号是一种区域，调色不会合并区域。</p></div>
    <div class="editor-actions"><div class="history"><button class="icon-button" :disabled="!canUndo" title="撤销" aria-label="撤销" @click="emit('undo')"><Undo2 :size="17" /></button><button class="icon-button" :disabled="!canRedo" title="重做" aria-label="重做" @click="emit('redo')"><Redo2 :size="17" /></button></div><button class="text-button" @click="emit('reset')"><RotateCcw :size="14" /> 恢复原图</button></div>
  </aside>
</template>

<style scoped>
.editor { padding: 22px 18px 15px; align-self: start; }.panel-heading { margin-bottom: 24px; }.size-section { margin-bottom: 24px; }.section-label { display: flex; justify-content: space-between; align-items: center; margin: 0; font-size: 12px; font-weight: 600; }.section-label > span:not(.palette-count) { font-size: 10px; font-weight: 400; color: var(--muted); }.size-control { display: flex; gap: 8px; align-items: center; background: #f7f8f5; padding: 6px; border: 1px solid var(--line); border-radius: 9px; margin-top: 10px; }.size-control input { background: transparent; width: 51px; padding: 5px 2px 5px 7px; font-family: var(--mono); font-size: 14px; border: none; outline-color: var(--teal); }.size-times { font-size: 12px; color: var(--muted); font-family: var(--mono); margin-right: auto; }.small { font-size: 11px; padding: 8px 10px; white-space: nowrap; }.tiny-hint { margin: 7px 0 0; font-size: 10px; color: var(--muted); }.section-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }.text-button { font-size: 10px; }.tools { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }.tool { border: 1px solid var(--line); background: #fff; display: flex; flex-direction: column; gap: 7px; padding: 12px 4px 9px; border-radius: 9px; align-items: center; color: #7c8781; font-size: 10px; }.tool.active { color: var(--teal); background: var(--teal-soft); border-color: #aecdc2; }.palette-heading { margin-top: 26px; }.palette-count { background: #f0f2ed; color: var(--muted); font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 7px; }.palette { display: grid; gap: 5px; max-height: 390px; overflow-y: auto; scrollbar-width: thin; padding: 2px; margin: 0 -2px; }.swatch-row { display: flex; align-items: center; border: 1px solid transparent; border-radius: 9px; background: #f9faf7; padding-right: 7px; }.swatch-row.selected { background: #eff6f2; border-color: #a7caba; }.swatch-select { padding: 8px 8px; display: flex; align-items: center; flex: 1; min-width: 0; gap: 10px; background: transparent; border: none; text-align: left; }.swatch { height: 28px; width: 28px; border-radius: 7px; flex-shrink: 0; box-shadow: inset 0 0 0 1px #00000005; }.color-label { display: flex; flex-direction: column; gap: 3px; }.color-label strong { font-size: 11px; font-weight: 500; }.color-label small { color: var(--muted); font-size: 9px; }.region-index { font-family: var(--mono); color: #abb2ab; font-size: 10px; margin-left: auto; }.color-picker { position: relative; display: grid; place-items: center; width: 23px; height: 23px; cursor: pointer; }.color-picker input { opacity: 0; position: absolute; inset: 0; width: 100%; height: 100%; cursor: pointer; }.picker-dot { width: 10px; height: 10px; border-radius: 50%; outline: 1px solid #c6cec5; outline-offset: 3px; pointer-events: none; }.delete-color { width: 22px; height: 23px; background: transparent; color: #98a297; border: none; display: grid; place-items: center; padding: 0; }.delete-color:hover { color: #b96060; }.region-check { display: flex; gap: 7px; align-items: center; color: var(--teal); margin-top: 14px; font-size: 10px; }.region-check-target { margin-left: auto; color: var(--muted); }.mismatch { color: #b78236; }.mismatch .status-dot { background: #b78236; }.editor-note { display: flex; gap: 8px; color: #97a096; background: #f8f9f6; border-radius: 8px; padding: 11px; margin-top: 17px; }.editor-note svg { flex-shrink: 0; margin-top: 1px; }.editor-note p { font-size: 10px; line-height: 1.8; margin: 0; }.editor-actions { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--line); margin-top: 18px; padding-top: 13px; }.history { display: flex; gap: 5px; }
@media (max-width: 1050px) { .editor { padding: 18px 14px; }.swatch-select { gap: 7px; }.palette { max-height: 350px; } }
@media (max-width: 720px) { .palette { grid-template-columns: repeat(2, 1fr); max-height: 210px; }.editor { order: 2; }.panel-heading { margin-bottom: 16px; }.size-section { margin-bottom: 18px; }.swatch-select { padding: 7px 5px; }.color-label strong { font-size: 10px; }.region-index { display: none; }.swatch { width: 24px; height: 24px; }.palette-heading { margin-top: 20px; } }
</style>
