export type CellMark = 'unknown' | 'mine' | 'safe'
export interface Region { id: number; name: string; color: string }
export interface Puzzle { size: number; grid: number[][]; marks: CellMark[][] }
export interface SolveResult {
  status: 'unique' | 'multiple' | 'none' | 'invalid' | 'limited'
  /** Each solution contains a zero-based column for each row. */
  solutions: number[][]
  counts: number[][]
  total: number
  complete: boolean
  nodes: number
  issues: string[]
}
