import { solvePuzzle } from '../domain/solver'
import type { Puzzle } from '../domain/types'

self.onmessage = (event: MessageEvent<Puzzle>) => {
  self.postMessage(solvePuzzle(event.data))
}
