import { describe, expect, it } from 'vitest'
import { createBlank, createPreset } from './preset'
import { solvePuzzle } from './solver'
import type { Puzzle } from './types'

/** Independent full permutation oracle, without the solver's pruning. */
function oracle(puzzle: Puzzle): number[][] {
  const permutations: number[][] = []
  function permute(prefix: number[], rest: number[]) {
    if (!rest.length) {
      if (prefix.some((c, r) => r > 0 && Math.abs(c - prefix[r - 1]!) <= 1)) return
      if (new Set(prefix.map((c, r) => puzzle.grid[r]![c])).size !== puzzle.size) return
      for (let r = 0; r < puzzle.size; r++) for (let c = 0; c < puzzle.size; c++) {
        if (puzzle.marks[r]![c] === 'mine' && prefix[r] !== c) return
        if (puzzle.marks[r]![c] === 'safe' && prefix[r] === c) return
      }
      permutations.push(prefix); return
    }
    rest.forEach(c => permute([...prefix, c], rest.filter(other => other !== c)))
  }
  permute([], Array.from({ length: puzzle.size }, (_, c) => c))
  return permutations
}
const sorted = (rows: number[][]) => rows.map(row => row.join(',')).sort()

describe('三规则约束求解器', () => {
  it('原图唯一解，与全部 5040 排列的独立校验相同', () => {
    const p = createPreset()
    const result = solvePuzzle(p)
    expect(result.status).toBe('unique')
    expect(result.complete).toBe(true)
    expect(result.solutions).toEqual([[3, 6, 4, 1, 5, 2, 0]])
    expect(result.solutions).toEqual(oracle(p))
    expect(result.counts.flat().filter(Boolean)).toHaveLength(7)
    expect(result.counts.flat().filter(count => count === 0)).toHaveLength(42)
  })
  it('4阶每行一种颜色恰好有两个不相邻方案', () => {
    const result = solvePuzzle(createBlank(4))
    expect(result.status).toBe('multiple')
    expect(result.total).toBe(2)
    expect(sorted(result.solutions)).toEqual(['1,3,0,2', '2,0,3,1'])
    expect(result.counts.flat().filter(count => count === 2)).toHaveLength(0)
    expect(result.counts.flat().reduce((a, b) => a + b)).toBe(8)
  })
  it('1阶唯一，2/3阶因斜邻限制无解', () => {
    expect(solvePuzzle(createBlank(1)).solutions).toEqual([[0]])
    expect(solvePuzzle(createBlank(2)).status).toBe('none')
    expect(solvePuzzle(createBlank(3)).status).toBe('none')
  })
  it('标雷和排除参与约束；不修改输入', () => {
    const p = createBlank(4)
    p.marks[0]![1] = 'mine'
    const copy = JSON.stringify(p)
    expect(solvePuzzle(p).solutions).toEqual([[1, 3, 0, 2]])
    expect(JSON.stringify(p)).toBe(copy)
    p.marks[0]![1] = 'safe'
    expect(solvePuzzle(p).solutions).toEqual([[2, 0, 3, 1]])
  })
  it('排除整行和排除唯一答案中的雷导致无解', () => {
    const p = createPreset(); p.marks[0]![3] = 'safe'
    expect(solvePuzzle(p).status).toBe('none')
    const allSafe = createBlank(4); allSafe.marks[0]!.fill('safe')
    expect(solvePuzzle(allSafe).status).toBe('none')
  })
  it('颜色数量不是边长时清晰报告，不把未使用的调色盘颜色计入', () => {
    const p = createPreset(); p.grid = p.grid.map(row => row.map(id => id === 6 ? 0 : id))
    const r = solvePuzzle(p)
    expect(r.status).toBe('invalid'); expect(r.issues.join('')).toContain('6 种颜色')
  })
  it.each(['same-row', 'same-col', 'diagonal', 'same-color'])('识别手动雷冲突 %s', scenario => {
    const p = createPreset(); p.marks[0]![0] = 'mine'
    const cell = scenario === 'same-row' ? [0, 3] : scenario === 'same-col' ? [4, 0] : scenario === 'diagonal' ? [1, 1] : [2, 2]
    p.marks[cell[0]!]![cell[1]!] = 'mine'
    expect(solvePuzzle(p).status).toBe('invalid')
  })
  it('矩阵、标记、边长、颜色编号无效时不会崩溃', () => {
    for (const size of [0, 17, 2.5, NaN]) expect(solvePuzzle({ ...createPreset(), size }).status).toBe('invalid')
    expect(solvePuzzle({ ...createPreset(), grid: [] }).status).toBe('invalid')
    expect(solvePuzzle({ ...createPreset(), marks: [] }).status).toBe('invalid')
    const p = createPreset(); p.grid[0]![0] = -1
    expect(solvePuzzle(p).status).toBe('invalid')
    p.grid[0]![0] = 0; p.marks[0]![0] = 'bad' as never
    expect(solvePuzzle(p).status).toBe('invalid')
  })
  it('解数和节点预算截断不会误称唯一或确定安全', () => {
    const r = solvePuzzle(createBlank(4), { maxSolutions: 1 })
    expect(r.status).toBe('limited'); expect(r.complete).toBe(false); expect(r.total).toBe(1)
    const nodes = solvePuzzle(createBlank(16), { maxNodes: 20 })
    expect(nodes.status).toBe('limited'); expect(nodes.complete).toBe(false); expect(nodes.nodes).toBeLessThanOrEqual(20)
  })
  it('对多种随机小棋盘与独立枚举交叉验证', () => {
    let seed = 42
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed }
    for (let index = 0; index < 32; index++) {
      const n = index % 2 ? 5 : 4
      const p = createBlank(n)
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) p.grid[r]![c] = random() % n
      // Guarantee all region IDs exist, then randomly exclude a cell.
      for (let r = 0; r < n; r++) p.grid[r]![0] = r
      p.marks[random() % n]![random() % n] = 'safe'
      expect(sorted(solvePuzzle(p).solutions)).toEqual(sorted(oracle(p)))
    }
  })
})
