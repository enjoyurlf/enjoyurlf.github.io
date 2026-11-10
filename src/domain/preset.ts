import type { CellMark, Puzzle, Region } from './types'

export const PRESET_GRID = [
  [0, 0, 0, 0, 1, 1, 2],
  [0, 0, 0, 1, 1, 2, 2],
  [0, 3, 0, 1, 1, 1, 1],
  [0, 3, 3, 3, 3, 1, 1],
  [4, 4, 4, 4, 3, 5, 5],
  [6, 6, 4, 6, 3, 3, 5],
  [6, 6, 6, 6, 3, 3, 5],
]
export const DEFAULT_REGIONS: Region[] = [
  { id: 0, name: '青蓝', color: '#61a6b8' },
  { id: 1, name: '浅黄', color: '#f5d88c' },
  { id: 2, name: '莓红', color: '#c77e9b' },
  { id: 3, name: '赭黄', color: '#c5a52b' },
  { id: 4, name: '柔紫', color: '#907ed1' },
  { id: 5, name: '森林', color: '#4e8f69' },
  { id: 6, name: '浅粉', color: '#e69bdf' },
]
export function emptyMarks(size: number): CellMark[][] {
  return Array.from({ length: size }, () => Array<CellMark>(size).fill('unknown'))
}
export function createPreset(): Puzzle {
  return { size: 7, grid: PRESET_GRID.map(row => [...row]), marks: emptyMarks(7) }
}
export function createBlank(size: number): Puzzle {
  return { size, grid: Array.from({ length: size }, (_, row) => Array<number>(size).fill(row)), marks: emptyMarks(size) }
}
