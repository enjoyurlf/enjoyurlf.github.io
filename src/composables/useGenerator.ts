import { computed, onScopeDispose, shallowReadonly, shallowRef, watch } from 'vue'
import { generationIssue, type GeneratedPuzzle, type GeneratorMessage } from '../domain/generator'

export function useGenerator() {
  const size = shallowRef(7)
  const colorCount = shallowRef(7)
  const generated = shallowRef<GeneratedPuzzle | null>(null)
  const busy = shallowRef(false)
  const revealed = shallowRef(false)
  const progress = shallowRef(0)
  const error = shallowRef('')
  const issue = computed(() => generationIssue({ size: size.value, colorCount: colorCount.value }))
  let worker: Worker | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  let request = 0

  function stop() {
    request++
    worker?.terminate(); worker = undefined
    if (timeout !== undefined) clearTimeout(timeout)
    timeout = undefined; busy.value = false
  }
  function invalidate() {
    stop(); generated.value = null; revealed.value = false; progress.value = 0; error.value = ''
  }
  watch(size, (next, previous) => {
    if (colorCount.value === previous) colorCount.value = next
  }, { flush: 'sync' })
  watch([size, colorCount], invalidate, { flush: 'sync' })

  function generate() {
    invalidate()
    if (issue.value) return
    busy.value = true
    const current = request
    try {
      worker = new Worker(new URL('../workers/generator.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<GeneratorMessage>) => {
        if (current !== request) return
        const message = event.data
        if (message.type === 'progress') { progress.value = message.progress; return }
        if (message.type === 'success') { generated.value = message.puzzle; progress.value = 100 }
        else error.value = message.message
        stop()
      }
      worker.onerror = () => {
        if (current !== request) return
        error.value = '生成器运行失败，请重新生成。'; stop()
      }
      worker.postMessage({ size: size.value, colorCount: colorCount.value })
      timeout = setTimeout(() => {
        if (current !== request) return
        error.value = '本次生成用时过长，请重试或选择更小的棋盘。'; stop()
      }, 45_000)
    } catch {
      error.value = '浏览器无法启动生成器，请通过 HTTP 服务打开页面后重试。'; stop()
    }
  }
  function cancel() { stop(); progress.value = 0; error.value = '已取消生成，可以修改参数后重试。' }
  function toggleAnswer() { if (generated.value && !busy.value) revealed.value = !revealed.value }
  function downloadPuzzle() {
    const data = generated.value
    if (!data) return
    // Export only the unmarked puzzle; it can be imported into the editor.
    const blob = new Blob([JSON.stringify({ version: 1, puzzle: data.puzzle, regions: data.regions }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = `random-puzzle-${data.puzzle.size}x${data.puzzle.size}-${data.seed}.json`
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  onScopeDispose(stop)
  return { size, colorCount, issue, generated: shallowReadonly(generated), busy: shallowReadonly(busy), revealed: shallowReadonly(revealed), progress: shallowReadonly(progress), error: shallowReadonly(error), generate, cancel, toggleAnswer, downloadPuzzle }
}
