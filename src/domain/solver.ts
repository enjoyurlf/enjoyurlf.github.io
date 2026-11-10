import type { Puzzle, SolveResult } from './types'

export function solvePuzzle(puzzle: Puzzle, options: { maxSolutions?: number; maxNodes?: number } = {}): SolveResult {
  const n = puzzle?.size
  const validSize = Number.isInteger(n) && n >= 1 && n <= 16
  const result: SolveResult = {
    status: 'invalid', solutions: [], counts: Array.from({ length: validSize ? n : 0 }, () => Array<number>(n).fill(0)),
    total: 0, complete: true, nodes: 0, issues: [],
  }
  if (!validSize) { result.issues.push('棋盘边长须为 1–16 的整数。'); return result }
  const { grid, marks } = puzzle
  if (!Array.isArray(grid) || grid.length !== n || !grid.every(row => Array.isArray(row) && row.length === n && row.every(id => Number.isInteger(id) && id >= 0 && id <= 63))) {
    result.issues.push('色块矩阵尺寸不正确，或颜色编号无效。'); return result
  }
  if (!Array.isArray(marks) || marks.length !== n || !marks.every(row => Array.isArray(row) && row.length === n && row.every(mark => ['unknown', 'mine', 'safe'].includes(mark)))) {
    result.issues.push('标记矩阵尺寸不正确，或标记无效。'); return result
  }
  const colors = new Set(grid.flat())
  if (colors.size !== n) result.issues.push(`当前棋盘实际使用 ${colors.size} 种颜色；${n} × ${n} 棋盘必须恰好使用 ${n} 种颜色。`)
  const known: [number, number][] = []
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (marks[r]![c] === 'mine') known.push([r, c])
  for (let i = 0; i < known.length; i++) {
    const [r, c] = known[i]!
    for (let j = 0; j < i; j++) {
      const [rr, cc] = known[j]!
      const label = `手动地雷 R${rr + 1}C${cc + 1} 与 R${r + 1}C${c + 1}`
      if (r === rr) result.issues.push(`${label}位于同一行。`)
      else if (c === cc) result.issues.push(`${label}位于同一列。`)
      else if (Math.abs(r - rr) <= 1 && Math.abs(c - cc) <= 1) result.issues.push(`${label}相邻（含斜角）。`)
      else if (grid[r]![c] === grid[rr]![cc]) result.issues.push(`${label}属于同一种颜色。`)
    }
  }
  if (result.issues.length) return result

  const maxSolutions = Math.max(1, Math.floor(options.maxSolutions ?? 10_000))
  const maxNodes = Math.max(1, Math.floor(options.maxNodes ?? 1_000_000))
  const candidates = Array.from({ length: n }, (_, r) => {
    const forced = known.find(([row]) => row === r)
    return forced ? [forced[1]] : Array.from({ length: n }, (_, c) => c).filter(c => marks[r]![c] !== 'safe')
  })
  const columns = new Set<number>()
  const usedColors = new Set<number>()
  const placement: number[] = []
  let stopped = false
  const available = (r: number, c: number, previous: number | undefined): boolean =>
    !columns.has(c) && !usedColors.has(grid[r]![c]!) && (previous === undefined || Math.abs(c - previous) > 1)

  function visit(row: number) {
    if (stopped) return
    if (result.nodes >= maxNodes) { stopped = true; return }
    result.nodes++
    if (row === n) {
      result.solutions.push([...placement]); result.total++
      placement.forEach((col, r) => result.counts[r]![col]++)
      if (result.total >= maxSolutions) stopped = true
      return
    }
    for (const col of candidates[row]!) {
      if (stopped) return
      if (!available(row, col, placement[row - 1])) continue
      placement[row] = col; columns.add(col); usedColors.add(grid[row]![col]!)
      // Forward-check all remaining rows and the union of available columns/colors.
      let viable = true
      const futureColumns = new Set<number>()
      const futureColors = new Set<number>()
      for (let r = row + 1; r < n && viable; r++) {
        let any = false
        for (const c of candidates[r]!) if (available(r, c, r === row + 1 ? col : undefined)) {
          any = true; futureColumns.add(c); futureColors.add(grid[r]![c]!)
        }
        if (!any) viable = false
      }
      if (futureColumns.size < n - row - 1 || futureColors.size < n - row - 1) viable = false
      if (viable) visit(row + 1)
      columns.delete(col); usedColors.delete(grid[row]![col]!); placement.length = row
    }
  }
  visit(0)
  result.complete = !stopped
  result.status = stopped ? 'limited' : result.total === 0 ? 'none' : result.total === 1 ? 'unique' : 'multiple'
  if (stopped) result.issues.push('已达到搜索预算（最多 10,000 个解 / 1,000,000 节点）。仅显示找到的方案，不将部分统计认定为必然结论。')
  if (!stopped && !result.total) result.issues.push('已穷尽搜索，没有满足全部三条规则及手动标记的方案。请检查色块划分或清除手动标记。')
  return result
}
