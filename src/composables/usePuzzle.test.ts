import { effectScope, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { solvePuzzle } from '../domain/solver'
import { createBlank } from '../domain/preset'
import type { SolveResult } from '../domain/types'
import { usePuzzle, validateSnapshot } from './usePuzzle'
import { createPreset, DEFAULT_REGIONS } from '../domain/preset'

describe('棋盘编辑状态', () => {
  const scopes: ReturnType<typeof effectScope>[] = []
  function setup() {
    const scope = effectScope(); scopes.push(scope)
    const state = scope.run(usePuzzle)!
    state.autoSolve.value = false
    return state
  }
  beforeEach(() => localStorage.clear())
  afterEach(() => { scopes.forEach(scope => scope.stop()); scopes.length = 0; vi.useRealTimers(); vi.unstubAllGlobals() })
  it('一次拖动只记录一个撤销步骤，重做还原编辑', () => {
    const state = setup()
    state.pickRegion(6); state.beginStroke(); state.cellAction(0, 0); state.cellAction(0, 1); state.endStroke()
    expect(state.puzzle.value.grid[0]!.slice(0, 2)).toEqual([6, 6])
    state.undo(); expect(state.puzzle.value.grid[0]!.slice(0, 2)).toEqual([0, 0]); expect(state.canUndo.value).toBe(false)
    state.redo(); expect(state.puzzle.value.grid[0]!.slice(0, 2)).toEqual([6, 6])
  })
  it('添加未使用的颜色不改变实际区域数；删除用色会合并到选中色并可撤销', () => {
    const state = setup(); state.addRegion()
    expect(state.regions.value).toHaveLength(8); expect(state.activeRegions.value).toHaveLength(7)
    state.pickRegion(1); state.removeRegion(0)
    expect(state.regions.value).toHaveLength(7)
    expect(state.puzzle.value.grid.flat().includes(0)).toBe(false)
    expect(state.puzzle.value.grid[0]![0]).toBe(1)
    state.undo(); expect(state.puzzle.value.grid[0]![0]).toBe(0)
  })
  it('尺寸自定义和撤销，保留合法动态调色盘', () => {
    const state = setup(); state.newBoard(12)
    expect(state.puzzle.value.size).toBe(12)
    expect(state.activeRegions.value).toHaveLength(12)
    expect(state.puzzle.value.grid.flat()).toHaveLength(144)
    expect(() => validateSnapshot({ puzzle: state.puzzle.value, regions: state.regions.value })).not.toThrow()
    state.undo(); expect(state.puzzle.value.size).toBe(7)
    state.newBoard(1); expect(state.puzzle.value.grid).toEqual([[0]])
  })
  it('颜色上限及大小变更不会产生过大的调色盘', () => {
    const state = setup()
    for (let i = 0; i < 40; i++) state.addRegion()
    expect(state.regions.value).toHaveLength(32)
    for (let id = 0; id < 15; id++) state.removeRegion(id)
    state.newBoard(16)
    expect(state.regions.value.length).toBeLessThanOrEqual(32)
    expect(state.activeRegions.value).toHaveLength(16)
    expect(() => validateSnapshot({ puzzle: state.puzzle.value, regions: state.regions.value })).not.toThrow()
  })
  it('手动标记和擦除不改变颜色，清除标记可撤销', () => {
    const state = setup(); state.tool.value = 'mine'; state.beginStroke(); state.cellAction(0, 0); state.endStroke()
    expect(state.puzzle.value.marks[0]![0]).toBe('mine'); expect(state.puzzle.value.grid[0]![0]).toBe(0)
    state.clearMarks(); expect(state.puzzle.value.marks[0]![0]).toBe('unknown')
    state.undo(); expect(state.puzzle.value.marks[0]![0]).toBe('mine')
    state.tool.value = 'erase'; state.beginStroke(); state.cellAction(0, 0); state.endStroke()
    expect(state.puzzle.value.marks[0]![0]).toBe('unknown')
  })
  it('本地存储损坏时恢复原图；编辑后保存', async () => {
    localStorage.setItem('color-mine-workbench-v1', '{broken')
    const state = setup(); expect(state.puzzle.value.size).toBe(7)
    state.newBoard(4); await nextTick()
    expect(JSON.parse(localStorage.getItem('color-mine-workbench-v1')!).puzzle.size).toBe(4)
  })
  it('关闭自动求解取消防抖中的任务，不偷偷启动 Worker', async () => {
    vi.useFakeTimers()
    const construct = vi.fn()
    vi.stubGlobal('Worker', class { constructor() { construct() } })
    const state = setup()
    await nextTick()
    vi.advanceTimersByTime(500)
    expect(construct).not.toHaveBeenCalled()
    expect(state.solving.value).toBe(false)
    state.newBoard(4)
    await nextTick()
    vi.advanceTimersByTime(500)
    expect(construct).not.toHaveBeenCalled()
  })
  it('快速编辑取消旧 Worker，迟到的旧答案不会覆盖新棋盘', async () => {
    vi.useFakeTimers()
    const workers: FakeWorker[] = []
    class FakeWorker {
      onmessage: ((event: { data: SolveResult }) => void) | null = null
      onerror: (() => void) | null = null
      terminate = vi.fn()
      postMessage = vi.fn()
      constructor() { workers.push(this) }
    }
    vi.stubGlobal('Worker', FakeWorker)
    const state = setup(); await nextTick()
    state.autoSolve.value = true; await nextTick()
    expect(workers).toHaveLength(1)
    state.newBoard(4); await nextTick()
    expect(workers[0]!.terminate).toHaveBeenCalled()
    workers[0]!.onmessage?.({ data: solvePuzzle(createPreset()) })
    expect(state.result.value).toBeNull()
    vi.advanceTimersByTime(160)
    expect(workers).toHaveLength(2)
    workers[1]!.onmessage?.({ data: solvePuzzle(createBlank(4)) })
    expect(state.result.value?.total).toBe(2)
    workers[0]!.onmessage?.({ data: solvePuzzle(createPreset()) })
    expect(state.result.value?.total).toBe(2)
    state.autoSolve.value = false; await nextTick()
    expect(state.result.value?.total).toBe(2)
    expect(state.solving.value).toBe(false)
  })
  it('拒绝重复编号、未存在的区域以及恶意格式', () => {
    const state = { puzzle: createPreset(), regions: DEFAULT_REGIONS }
    expect(() => validateSnapshot(state)).not.toThrow()
    expect(() => validateSnapshot({ ...state, regions: [...DEFAULT_REGIONS, DEFAULT_REGIONS[0]] })).toThrow()
    expect(() => validateSnapshot({ ...state, regions: DEFAULT_REGIONS.slice(0, 6) })).toThrow()
    expect(() => validateSnapshot({ ...state, puzzle: { ...state.puzzle, size: 0 } })).toThrow()
  })
})
