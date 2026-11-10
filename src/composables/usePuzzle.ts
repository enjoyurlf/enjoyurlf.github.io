import { computed, onScopeDispose, readonly, ref, shallowRef, watch } from 'vue'
import { createBlank, createPreset, DEFAULT_REGIONS, emptyMarks } from '../domain/preset'
import type { CellMark, Puzzle, Region, SolveResult } from '../domain/types'

export type EditTool = 'paint' | 'mine' | 'safe' | 'erase'
export type BoardView = 'certainty' | 'solution' | 'colors'
interface Snapshot { puzzle: Puzzle; regions: Region[] }
const STORAGE_KEY = 'color-mine-workbench-v1'
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export function validateSnapshot(data: unknown): Snapshot {
  if (!data || typeof data !== 'object') throw new Error('棋盘格式不正确。')
  const state = data as Snapshot
  const p = state.puzzle
  if (!p || !Number.isInteger(p.size) || p.size < 1 || p.size > 16) throw new Error('棋盘边长须为 1–16 的整数。')
  const palette = state.regions
  if (!Array.isArray(palette) || palette.length < 1 || palette.length > 32 || !palette.every(r => r && Number.isInteger(r.id) && r.id >= 0 && r.id <= 63 && typeof r.name === 'string' && r.name.length <= 20 && /^#[\da-f]{6}$/i.test(r.color))) throw new Error('颜色数据不正确。')
  const ids = new Set(palette.map(r => r.id))
  if (ids.size !== palette.length) throw new Error('颜色编号重复。')
  if (!Array.isArray(p.grid) || p.grid.length !== p.size || !p.grid.every(row => Array.isArray(row) && row.length === p.size && row.every(id => ids.has(id)))) throw new Error('色块矩阵不正确，或引用了不存在的颜色。')
  if (!Array.isArray(p.marks) || p.marks.length !== p.size || !p.marks.every(row => Array.isArray(row) && row.length === p.size && row.every(mark => ['unknown', 'mine', 'safe'].includes(mark)))) throw new Error('标记矩阵不正确。')
  return copy({ puzzle: p, regions: palette })
}
function initialState(): Snapshot {
  try {
    const text = localStorage.getItem(STORAGE_KEY)
    if (text) return validateSnapshot(JSON.parse(text))
  } catch { /* A malformed save never prevents opening the original puzzle. */ }
  return { puzzle: createPreset(), regions: copy(DEFAULT_REGIONS) }
}
function freshColor(id: number): string {
  const hue = (id * 137.508 + 25) % 360
  // A deterministic pastel palette; IDs, not RGB values, define regions.
  const chroma = 0.36
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1))
  const parts = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x]
  return '#' + parts.map(v => Math.round((v + 0.47) * 255).toString(16).padStart(2, '0')).join('')
}

export function usePuzzle() {
  const saved = initialState()
  const puzzle = ref<Puzzle>(saved.puzzle)
  const regions = ref<Region[]>(saved.regions)
  const tool = shallowRef<EditTool>('paint')
  const selectedRegion = shallowRef(saved.regions[0]!.id)
  const view = shallowRef<BoardView>('certainty')
  const autoSolve = shallowRef(true)
  const solving = shallowRef(false)
  const result = shallowRef<SolveResult | null>(null)
  const selectedSolution = shallowRef(0)
  const notice = shallowRef('')
  const saveWarning = shallowRef('')
  const history = shallowRef<Snapshot[]>([])
  const future = shallowRef<Snapshot[]>([])
  let strokeSaved = false
  let worker: Worker | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0

  const activeRegions = computed(() => {
    const ids = new Set(puzzle.value.grid.flat())
    return regions.value.filter(r => ids.has(r.id))
  })
  const regionCounts = computed(() => puzzle.value.grid.flat().reduce<Record<number, number>>((map, id) => {
    map[id] = (map[id] ?? 0) + 1
    return map
  }, {}))
  const canUndo = computed(() => history.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  const snapshot = (): Snapshot => copy({ puzzle: puzzle.value, regions: regions.value })
  function remember() {
    history.value = [...history.value.slice(-79), snapshot()]
    future.value = []
  }
  function ensureSelection() { if (!regions.value.some(r => r.id === selectedRegion.value)) selectedRegion.value = regions.value[0]!.id }
  function beginStroke() { strokeSaved = false }
  function endStroke() { strokeSaved = false }
  function cellAction(row: number, col: number) {
    if (tool.value === 'paint') {
      if (puzzle.value.grid[row]![col] === selectedRegion.value) return
      if (!strokeSaved) { remember(); strokeSaved = true }
      puzzle.value.grid[row]![col] = selectedRegion.value
    } else {
      const next: CellMark = tool.value === 'erase' ? 'unknown' : tool.value
      if (puzzle.value.marks[row]![col] === next) return
      if (!strokeSaved) { remember(); strokeSaved = true }
      puzzle.value.marks[row]![col] = next
    }
    notice.value = ''
  }
  function pickRegion(id: number) { selectedRegion.value = id; tool.value = 'paint' }
  function setRegionColor(id: number, color: string) {
    const region = regions.value.find(r => r.id === id)
    if (!region || !/^#[\da-f]{6}$/i.test(color) || region.color === color) return
    remember(); region.color = color
  }
  function addRegion() {
    if (regions.value.length >= 32) { notice.value = '调色盘最多支持 32 种颜色。'; return }
    let id = 0
    while (regions.value.some(r => r.id === id)) id++
    remember(); regions.value.push({ id, name: `颜色 ${id + 1}`, color: freshColor(id) })
    selectedRegion.value = id; tool.value = 'paint'
    notice.value = '已新增颜色。请涂到棋盘上，才会作为实际区域参与求解。'
  }
  function removeRegion(id: number) {
    if (regions.value.length <= 1) { notice.value = '至少保留一种颜色。'; return }
    const removed = regions.value.find(r => r.id === id)
    const target = regions.value.find(r => r.id === selectedRegion.value && r.id !== id) ?? regions.value.find(r => r.id !== id)
    if (!removed || !target) return
    const cells = regionCounts.value[id] ?? 0
    remember()
    puzzle.value.grid = puzzle.value.grid.map(row => row.map(value => value === id ? target.id : value))
    regions.value = regions.value.filter(r => r.id !== id); ensureSelection()
    notice.value = cells ? `已删除${removed.name}，其 ${cells} 格已合并到${target.name}。可撤销。` : `已删除未使用的${removed.name}。`
  }
  function undo() {
    const previous = history.value.at(-1)
    if (!previous) return
    future.value = [...future.value, snapshot()]; history.value = history.value.slice(0, -1)
    puzzle.value = copy(previous.puzzle); regions.value = copy(previous.regions); ensureSelection()
  }
  function redo() {
    const next = future.value.at(-1)
    if (!next) return
    history.value = [...history.value, snapshot()]; future.value = future.value.slice(0, -1)
    puzzle.value = copy(next.puzzle); regions.value = copy(next.regions); ensureSelection()
  }
  function resetPreset() {
    remember(); puzzle.value = createPreset(); regions.value = copy(DEFAULT_REGIONS)
    selectedRegion.value = 0; view.value = 'certainty'; notice.value = '已恢复图片中的 7 × 7 棋盘。'
  }
  function newBoard(size: number) {
    if (!Number.isInteger(size) || size < 1 || size > 16) { notice.value = '棋盘边长须为 1–16 的整数。'; return }
    remember()
    // Preserve existing swatches; add enough IDs for the new row-based board.
    for (let id = 0; id < size; id++) if (!regions.value.some(r => r.id === id)) regions.value.push({ id, name: `颜色 ${id + 1}`, color: freshColor(id) })
    regions.value = [...regions.value.filter(r => r.id < size), ...regions.value.filter(r => r.id >= size)].slice(0, 32)
    puzzle.value = createBlank(size); selectedRegion.value = regions.value[0]!.id
    notice.value = `已创建 ${size} × ${size} 棋盘，每行先填一种颜色，可继续涂色。`
  }
  function clearMarks() {
    if (!puzzle.value.marks.flat().some(m => m !== 'unknown')) return
    remember(); puzzle.value.marks = emptyMarks(puzzle.value.size); notice.value = '已清除手动标记，保留色块。'
  }
  function cancelWork() {
    generation++; worker?.terminate(); worker = undefined
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined; solving.value = false
  }
  function invalidate() {
    cancelWork(); result.value = null; selectedSolution.value = 0
  }
  function solve() {
    invalidate()
    const currentGeneration = generation
    solving.value = true
    try {
      worker = new Worker(new URL('../workers/solver.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<SolveResult>) => {
        if (generation !== currentGeneration) return
        result.value = event.data; solving.value = false
        worker?.terminate(); worker = undefined
      }
      worker.onerror = () => {
        if (generation !== currentGeneration) return
        solving.value = false; notice.value = '求解器启动失败，请刷新网页后重试。'
        worker?.terminate(); worker = undefined
      }
      worker.postMessage(copy(puzzle.value))
    } catch { solving.value = false; notice.value = '浏览器未能运行求解器，请通过本地 HTTP 服务打开网页。' }
  }
  watch(puzzle, (_value, _previous, onCleanup) => {
    invalidate()
    if (autoSolve.value) { solving.value = true; timer = setTimeout(solve, 160) }
    onCleanup(cancelWork)
  }, { deep: true, immediate: true })
  watch(autoSolve, enabled => { if (enabled) solve(); else cancelWork() })
  watch([puzzle, regions], () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot())); saveWarning.value = '' }
    catch { saveWarning.value = '浏览器存储不可用；本次编辑仍可用，请导出备份。' }
  }, { deep: true })
  function exportPuzzle() {
    const blob = new Blob([JSON.stringify({ version: 1, ...snapshot() }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = `color-puzzle-${puzzle.value.size}x${puzzle.value.size}.json`
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notice.value = '棋盘已导出为 JSON。'
  }
  async function importPuzzle(file: File) {
    try {
      if (file.size > 100_000) throw new Error('文件过大，请导入本页面导出的棋盘 JSON。')
      const data = JSON.parse(await file.text())
      if (data.version !== 1) throw new Error('不支持此棋盘文件版本。')
      const state = validateSnapshot(data)
      remember(); puzzle.value = state.puzzle; regions.value = state.regions
      ensureSelection(); notice.value = '棋盘导入成功。'
    } catch (error) { notice.value = error instanceof Error ? error.message : '导入失败，请检查 JSON 文件。' }
  }
  onScopeDispose(cancelWork)
  return {
    puzzle: readonly(puzzle), regions: readonly(regions), activeRegions, regionCounts,
    tool, selectedRegion, view, autoSolve, solving, result, selectedSolution, notice, saveWarning,
    canUndo, canRedo, beginStroke, endStroke, cellAction, pickRegion, setRegionColor, addRegion, removeRegion,
    undo, redo, resetPreset, newBoard, clearMarks, solve, exportPuzzle, importPuzzle,
  }
}
