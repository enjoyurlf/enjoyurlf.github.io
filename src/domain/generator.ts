import { emptyMarks } from './preset'
import { solvePuzzle } from './solver'
import type { Puzzle, Region } from './types'

export interface GeneratorSettings { size: number; colorCount: number }
export interface GeneratedPuzzle { puzzle: Puzzle; regions: Region[]; solution: number[]; seed: number }
export type GeneratorMessage =
  | { type: 'progress'; progress: number }
  | { type: 'success'; puzzle: GeneratedPuzzle }
  | { type: 'error'; message: string }

export interface GeneratorOptions {
  /** Normalized to an unsigned 32-bit integer; the returned seed can be replayed. */
  seed?: number
  /** Monotonically increasing percentage, from 0 to 100. */
  onProgress?: (progress: number) => void
  /** Node limit for each uniqueness check, including the initial and final checks. */
  maxNodes?: number
}

const PALETTE = [
  '#61a6b8', '#f5d88c', '#c77e9b', '#c5a52b', '#907ed1', '#4e8f69', '#e69bdf', '#e88853',
  '#5b78be', '#9acb78', '#bd615b', '#74c8bc', '#ac966d', '#b5a4df', '#debb72', '#729c89',
]

export function generationIssue(settings: GeneratorSettings): string {
  if (!Number.isInteger(settings?.size) || settings.size < 1 || settings.size > 16) return '棋盘边长须为 1–16 的整数。'
  if (!Number.isInteger(settings.colorCount) || settings.colorCount < 1 || settings.colorCount > 16) return '颜色数量须为 1–16 的整数。'
  if (settings.colorCount !== settings.size) return '颜色数量必须与棋盘边长相同，才能让每行、每列、每种颜色恰好有一颗地雷。'
  if (settings.size === 2 || settings.size === 3) return '2 × 2 和 3 × 3 棋盘无法满足地雷互不相邻（含斜角）的规则，请选择 1 或 4–16 阶。'
  return ''
}

/** Mulberry32 also has a non-degenerate stream for seed zero. */
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), state | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000
  }
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[items[i], items[j]] = [items[j]!, items[i]!]
  }
  return items
}

function chooseSolution(size: number, random: () => number): number[] {
  const solution: number[] = []
  const used = new Set<number>()
  let nodes = 0
  function visit(): boolean {
    if (++nodes > 20_000) return false
    if (solution.length === size) return true
    const previous = solution[solution.length - 1]
    const columns = shuffle(Array.from({ length: size }, (_, col) => col), random)
    for (const col of columns) {
      if (used.has(col) || (previous !== undefined && Math.abs(col - previous) <= 1)) continue
      solution.push(col); used.add(col)
      if (visit()) return true
      solution.pop(); used.delete(col)
      if (nodes >= 20_000) break
    }
    return false
  }
  if (visit()) return solution
  // This construction is valid for every supported size, even if random DFS hits its budget.
  const fallback = Array.from({ length: size }, (_, col) => col).filter(col => col % 2 === 1)
    .concat(Array.from({ length: size }, (_, col) => col).filter(col => col % 2 === 0))
  if (random() < 0.5) fallback.reverse()
  return random() < 0.5 ? fallback.map(col => size - 1 - col) : fallback
}

/** Generate with bounded search; only completely certified boards can be returned. */
export function generatePuzzle(settings: GeneratorSettings, options: GeneratorOptions = {}): GeneratedPuzzle {
  const issue = generationIssue(settings)
  if (issue) throw new Error(issue)
  const maxNodes = options.maxNodes ?? 30_000
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 1) throw new Error('唯一解验证的节点预算须为正整数。')
  const seed = (options.seed ?? Math.floor(Math.random() * 0x1_0000_0000)) >>> 0
  const random = seededRandom(seed)
  const size = settings.size
  let progress = -1
  const report = (value: number) => {
    const next = Math.floor(value)
    if (next > progress) { progress = next; options.onProgress?.(next) }
  }
  report(0)
  const solution = chooseSolution(size, random)
  const rowOrder = shuffle(Array.from({ length: size }, (_, row) => row), random)
  const puzzle: Puzzle = { size, grid: Array.from({ length: size }, () => Array<number>(size).fill(0)), marks: emptyMarks(size) }
  const sizes = Array<number>(size).fill(1)
  sizes[0] = size * size - size + 1
  // The singleton regions force n - 1 mines. The remaining row/column force the background mine.
  rowOrder.forEach((row, id) => { puzzle.grid[row]![solution[row]!] = id })
  const colors = shuffle([...PALETTE], random)
  const regions: Region[] = colors.slice(0, size).map((color, id) => ({ id, name: `颜色 ${id + 1}`, color }))
  const matchesSolution = (result: ReturnType<typeof solvePuzzle>) => result.complete && result.total === 1
    && result.solutions[0]?.length === size && result.solutions[0].every((col, row) => col === solution[row])
  const initial = solvePuzzle(puzzle, { maxSolutions: 2, maxNodes })
  if (!matchesSolution(initial)) throw new Error('搜索预算不足，无法完成唯一解验证，请提高节点预算后重试。')
  let certifiedGrid = puzzle.grid.map(row => [...row])
  report(5)

  const neighbors = Array.from({ length: size * size }, (_, cell) => {
    const row = Math.floor(cell / size), col = cell % size
    return [row > 0 ? cell - size : -1, row + 1 < size ? cell + size : -1,
      col > 0 ? cell - 1 : -1, col + 1 < size ? cell + 1 : -1].filter(next => next >= 0)
  })
  const regionAt = (cell: number) => puzzle.grid[Math.floor(cell / size)]![cell % size]!
  const isMine = (cell: number) => solution[Math.floor(cell / size)] === cell % size
  const visited = new Uint32Array(size * size)
  const queue = new Int32Array(size * size)
  let visitId = 0
  // Removing a boundary cell must leave its source region 4-connected.
  function sourceStaysConnected(cell: number, source: number): boolean {
    const adjacent = neighbors[cell]!.filter(next => regionAt(next) === source)
    if (adjacent.length <= 1) return true
    visitId++
    let head = 0, tail = 1
    queue[0] = adjacent[0]!
    visited[cell] = visitId; visited[queue[0]!] = visitId
    while (head < tail) {
      const current = queue[head++]!
      for (const next of neighbors[current]!) {
        if (visited[next] === visitId || regionAt(next) !== source) continue
        visited[next] = visitId; queue[tail++] = next
      }
    }
    return tail === sizes[source]! - 1
  }

  // A total node budget bounds expensive 16x16 growth as well as each individual search.
  const totalNodeBudget = 120_000
  const attemptLimit = size * size * 6
  let spentNodes = 0, attempts = 0
  let changed = true
  while (changed && attempts < attemptLimit && spentNodes < totalNodeBudget) {
    changed = false
    const order = shuffle(Array.from({ length: size }, (_, id) => id), random)
      .sort((a, b) => sizes[a]! - sizes[b]!)
    for (const target of order) {
      // Prefer small regions, compact shapes and larger donors. Each candidate touches the target.
      const candidates: { cell: number; score: number }[] = []
      for (let cell = 0; cell < size * size; cell++) {
        const source = regionAt(cell)
        if (source === target || isMine(cell) || sizes[source]! <= sizes[target]! + 1) continue
        const touching = neighbors[cell]!.filter(next => regionAt(next) === target).length
        if (touching) candidates.push({ cell, score: touching * 3 + random() * 5 + sizes[source]! / (size * size) })
      }
      candidates.sort((a, b) => b.score - a.score)
      // Failed candidates can become viable after another region grows, so revisit on later passes.
      for (const { cell } of candidates.slice(0, 12)) {
        if (attempts >= attemptLimit || spentNodes >= totalNodeBudget) break
        const source = regionAt(cell)
        if (!sourceStaysConnected(cell, source)) continue
        const row = Math.floor(cell / size), col = cell % size
        puzzle.grid[row]![col] = target
        const result = solvePuzzle(puzzle, { maxSolutions: 2, maxNodes: Math.min(maxNodes, totalNodeBudget - spentNodes) })
        attempts++; spentNodes += result.nodes
        if (matchesSolution(result)) {
          sizes[source]!--; sizes[target]!++
          certifiedGrid = puzzle.grid.map(cells => [...cells])
          changed = true
        } else {
          // Multiple solutions AND incomplete searches are rejected, even if one answer was found.
          puzzle.grid[row]![col] = source
        }
        report(5 + 90 * Math.max(attempts / attemptLimit, spentNodes / totalNodeBudget))
        if (matchesSolution(result)) break
      }
    }
  }
  const final = solvePuzzle(puzzle, { maxSolutions: 2, maxNodes })
  // Retain the last complete certificate if a final check is limited; never promote partial results.
  if (!matchesSolution(final)) puzzle.grid = certifiedGrid
  report(100)
  return { puzzle, regions, solution, seed }
}
