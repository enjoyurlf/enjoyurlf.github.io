import { afterEach, describe, expect, it, vi } from 'vitest'
import { generatePuzzle, generationIssue } from './generator'
import type { GeneratedPuzzle, GeneratorMessage, GeneratorSettings } from './generator'
import * as solver from './solver'
import type { Puzzle } from './types'

/** Enumerate every column permutation; do not share the production solver's search or pruning. */
function bruteForce(puzzle: Puzzle): number[][] {
  const answers: number[][] = []
  function enumerate(prefix: number[], remaining: number[]) {
    if (remaining.length) {
      for (const col of remaining) enumerate([...prefix, col], remaining.filter(value => value !== col))
      return
    }
    if (prefix.some((col, row) => row > 0 && Math.abs(col - prefix[row - 1]!) <= 1)) return
    if (new Set(prefix.map((col, row) => puzzle.grid[row]![col])).size !== puzzle.size) return
    answers.push(prefix)
  }
  enumerate([], Array.from({ length: puzzle.size }, (_, col) => col))
  return answers
}

function expectValidBoard(generated: GeneratedPuzzle, size: number) {
  const { puzzle, solution, regions } = generated
  expect(puzzle.size).toBe(size)
  expect(puzzle.grid).toHaveLength(size)
  expect(puzzle.grid.every(row => row.length === size)).toBe(true)
  expect(puzzle.marks).toHaveLength(size)
  expect(puzzle.marks.every(row => row.length === size && row.every(mark => mark === 'unknown'))).toBe(true)
  expect(regions).toHaveLength(size)
  expect(new Set(regions.map(region => region.color)).size).toBe(size)
  expect(regions.every(region => /^#[0-9a-f]{6}$/i.test(region.color))).toBe(true)
  expect(new Set(puzzle.grid.flat())).toEqual(new Set(regions.map(region => region.id)))
  expect(regions.map(region => region.id)).toEqual(Array.from({ length: size }, (_, id) => id))
  expect(solution).toHaveLength(size)
  expect([...solution].sort((a, b) => a - b)).toEqual(Array.from({ length: size }, (_, col) => col))
  expect(solution.every((col, row) => row === 0 || Math.abs(col - solution[row - 1]!) > 1)).toBe(true)
  expect(new Set(solution.map((col, row) => puzzle.grid[row]![col])).size).toBe(size)
  expect(Number.isInteger(generated.seed)).toBe(true)
  expect(generated.seed).toBeGreaterThanOrEqual(0)
  expect(generated.seed).toBeLessThan(2 ** 32)
  for (const { id } of regions) {
    const cells = puzzle.grid.flatMap((row, r) => row.flatMap((value, c) => value === id ? [r * size + c] : []))
    const reached = new Set([cells[0]!])
    const pending = [cells[0]!]
    while (pending.length) {
      const cell = pending.pop()!, row = Math.floor(cell / size), col = cell % size
      for (const [r, c] of [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]) {
        if (r! < 0 || r! >= size || c! < 0 || c! >= size || puzzle.grid[r!]![c!] !== id) continue
        const next = r! * size + c!
        if (!reached.has(next)) { reached.add(next); pending.push(next) }
      }
    }
    expect(reached.size, `region ${id} must be 4-connected`).toBe(cells.length)
  }
}

afterEach(() => vi.restoreAllMocks())

describe('唯一解棋盘生成器', () => {
  it.each([1, 4, 5, 6, 7])('%i 阶的多个种子与独立全排列枚举完全一致', size => {
    for (const seed of [0, 1, 42, 2026]) {
      const generated = generatePuzzle({ size, colorCount: size }, { seed })
      expectValidBoard(generated, size)
      expect(bruteForce(generated.puzzle)).toEqual([generated.solution])
    }
  })

  it.each([1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])('%i 阶、多个种子均符合规则且通过完整唯一解验证', size => {
    for (const seed of [0, 42, 0xffff_ffff]) {
      const generated = generatePuzzle({ size, colorCount: size }, { seed })
      expectValidBoard(generated, size)
      const result = solver.solvePuzzle(generated.puzzle, { maxSolutions: 2, maxNodes: 30_000 })
      expect(result.complete).toBe(true)
      expect(result.status).toBe('unique')
      expect(result.total).toBe(1)
      expect(result.solutions).toEqual([generated.solution])
    }
  }, 30_000)

  it('同一种子可复现，零种子有效且无需调用 Math.random', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Unexpected global random') })
    for (const seed of [0, 42, 0xffff_ffff]) {
      expect(generatePuzzle({ size: 7, colorCount: 7 }, { seed }))
        .toEqual(generatePuzzle({ size: 7, colorCount: 7 }, { seed }))
    }
    expect(random).not.toHaveBeenCalled()
    expect(generatePuzzle({ size: 4, colorCount: 4 }, { seed: -1 }).seed).toBe(0xffff_ffff)
    expect(generatePuzzle({ size: 4, colorCount: 4 }, { seed: 2 ** 32 + 42 }).seed).toBe(42)
  })

  it('不同种子改变布局及答案，而不只是调色盘', () => {
    const boards = Array.from({ length: 12 }, (_, seed) => generatePuzzle({ size: 7, colorCount: 7 }, { seed }))
    // Canonicalize color IDs so relabeling alone cannot satisfy the diversity assertion.
    const layouts = boards.map(({ puzzle }) => {
      const ids = new Map<number, number>()
      return puzzle.grid.flat().map(id => {
        if (!ids.has(id)) ids.set(id, ids.size)
        return ids.get(id)
      }).join(',')
    })
    expect(new Set(layouts).size).toBeGreaterThanOrEqual(10)
    expect(new Set(boards.map(board => board.solution.join(','))).size).toBeGreaterThanOrEqual(8)
  })

  it('未传种子时生成新的 uint32 种子，返回值可用于复现', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0.125).mockReturnValueOnce(0.75)
    const first = generatePuzzle({ size: 5, colorCount: 5 })
    const second = generatePuzzle({ size: 5, colorCount: 5 })
    expect(random).toHaveBeenCalledTimes(2)
    expect(first.seed).toBe(0x2000_0000)
    expect(second.seed).toBe(0xc000_0000)
    expect(generatePuzzle({ size: 5, colorCount: 5 }, { seed: first.seed })).toEqual(first)
    expect(generatePuzzle({ size: 5, colorCount: 5 }, { seed: second.seed })).toEqual(second)
  })

  it('增长色块、减少单格并尽量均衡面积', () => {
    for (const seed of [0, 42, 2026]) {
      const generated = generatePuzzle({ size: 7, colorCount: 7 }, { seed })
      const areas = generated.regions.map(region => generated.puzzle.grid.flat().filter(id => id === region.id).length)
      expect(Math.min(...areas)).toBeGreaterThan(1)
      expect(Math.max(...areas)).toBeLessThan(7 * 7 / 2)
    }
    const balanced = generatePuzzle({ size: 4, colorCount: 4 }, { seed: 0 })
    expect(balanced.regions.map(region => balanced.puzzle.grid.flat().filter(id => id === region.id).length)).toEqual([4, 4, 4, 4])
  })

  it('进度从 0 单调递增至 100，消息类型支持进度、结果和错误', () => {
    const progress: number[] = []
    const generated = generatePuzzle({ size: 5, colorCount: 5 }, { seed: 7, onProgress: value => progress.push(value) })
    expect(progress[0]).toBe(0)
    expect(progress.at(-1)).toBe(100)
    expect(progress.every((value, index) => Number.isInteger(value) && value >= 0 && value <= 100 && (!index || value > progress[index - 1]!))).toBe(true)
    const messages: GeneratorMessage[] = [
      { type: 'progress', progress: progress[0]! }, { type: 'success', puzzle: generated }, { type: 'error', message: '验证未完成' },
    ]
    expect(messages.map(message => message.type)).toEqual(['progress', 'success', 'error'])
  })

  it('低节点预算只返回完成验证的棋盘；初始验证也不能跳过', () => {
    const generated = generatePuzzle({ size: 4, colorCount: 4 }, { seed: 0, maxNodes: 10 })
    expect(bruteForce(generated.puzzle)).toEqual([generated.solution])
    expect(() => generatePuzzle({ size: 4, colorCount: 4 }, { seed: 0, maxNodes: 1 })).toThrow('无法完成唯一解验证')
    for (const maxNodes of [0, -1, 1.5, Infinity, NaN]) {
      expect(() => generatePuzzle({ size: 4, colorCount: 4 }, { maxNodes })).toThrow('节点预算须为正整数')
    }
  })

  it('即使找到一个答案也拒绝未完成的增长，保留最后已认证的棋盘', () => {
    const original = solver.solvePuzzle
    let calls = 0
    const solve = vi.spyOn(solver, 'solvePuzzle').mockImplementation((puzzle, options) => {
      const result = original(puzzle, options)
      if (++calls > 1) return { ...result, total: 1, complete: false, status: 'limited' }
      return result
    })
    const generated = generatePuzzle({ size: 5, colorCount: 5 }, { seed: 42 })
    expect(solve.mock.calls.length).toBeGreaterThan(2)
    expect(generated.regions.map(region => generated.puzzle.grid.flat().filter(id => id === region.id).length)).toEqual([21, 1, 1, 1, 1])
    expect(bruteForce(generated.puzzle)).toEqual([generated.solution])
    expectValidBoard(generated, 5)
  })

  it('不修改设置，重复调用返回独立可编辑的棋盘', () => {
    const settings = Object.freeze({ size: 4, colorCount: 4 })
    const options = Object.freeze({ seed: 42 })
    const first = generatePuzzle(settings, options)
    const expected = generatePuzzle(settings, options)
    first.puzzle.grid[0]![0] = 99
    first.puzzle.marks[0]![0] = 'mine'
    first.solution[0] = 99
    first.regions[0]!.color = '#000000'
    expect(generatePuzzle(settings, options)).toEqual(expected)
  })

  it('参数错误有清晰中文提示，2/3 阶在生成前被拒绝', () => {
    for (const size of [0, -1, 17, 2.5, NaN, Infinity]) {
      const settings = { size, colorCount: 4 }
      expect(generationIssue(settings)).toContain('边长须为 1–16 的整数')
      expect(() => generatePuzzle(settings)).toThrow(generationIssue(settings))
    }
    for (const colorCount of [0, -1, 17, 2.5, NaN, Infinity]) {
      expect(generationIssue({ size: 4, colorCount })).toContain('颜色数量须为 1–16 的整数')
    }
    expect(generationIssue({ size: 4, colorCount: 5 })).toContain('必须与棋盘边长相同')
    for (const size of [2, 3]) {
      const settings = { size, colorCount: size }
      expect(generationIssue(settings)).toContain('无法满足地雷互不相邻')
      expect(() => generatePuzzle(settings)).toThrow(generationIssue(settings))
    }
    for (const size of [1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
      expect(generationIssue({ size, colorCount: size })).toBe('')
    }
    expect(generationIssue(null as unknown as GeneratorSettings)).toContain('边长')
  })
})
