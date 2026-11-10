import { effectScope, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGenerator } from './useGenerator'
import { createPreset, DEFAULT_REGIONS } from '../domain/preset'
import type { GeneratedPuzzle, GeneratorMessage } from '../domain/generator'

const fixture: GeneratedPuzzle = { puzzle: createPreset(), regions: DEFAULT_REGIONS, solution: [3, 6, 4, 1, 5, 2, 0], seed: 42 }
class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: { data: GeneratorMessage }) => void) | null = null
  onerror: (() => void) | null = null
  terminate = vi.fn()
  postMessage = vi.fn()
  constructor() { FakeWorker.instances.push(this) }
  deliver(data: GeneratorMessage) { this.onmessage?.({ data }) }
}

describe('随机出题的后台任务与答案状态', () => {
  const scopes: ReturnType<typeof effectScope>[] = []
  function setup() { const scope = effectScope(); scopes.push(scope); return scope.run(useGenerator)! }
  beforeEach(() => { vi.useFakeTimers(); FakeWorker.instances = []; vi.stubGlobal('Worker', FakeWorker) })
  afterEach(() => { scopes.forEach(scope => scope.stop()); scopes.length = 0; vi.useRealTimers(); vi.unstubAllGlobals() })
  it('只有生成成功后能查看答案，每次生成都重新隐藏', () => {
    const state = setup(); state.toggleAnswer(); expect(state.revealed.value).toBe(false)
    state.generate(); expect(state.busy.value).toBe(true)
    FakeWorker.instances[0]!.deliver({ type: 'success', puzzle: fixture })
    expect(state.busy.value).toBe(false); expect(state.revealed.value).toBe(false)
    state.toggleAnswer(); expect(state.revealed.value).toBe(true)
    state.generate(); expect(state.generated.value).toBeNull(); expect(state.revealed.value).toBe(false)
    FakeWorker.instances[1]!.deliver({ type: 'success', puzzle: fixture })
    expect(state.revealed.value).toBe(false)
  })
  it('修改参数取消旧任务、同步匹配的颜色数并拒绝迟到的旧答案', () => {
    const state = setup(); state.generate()
    const old = FakeWorker.instances[0]!
    state.size.value = 4
    expect(state.colorCount.value).toBe(4); expect(state.issue.value).toBe(''); expect(old.terminate).toHaveBeenCalled()
    old.deliver({ type: 'success', puzzle: fixture }); expect(state.generated.value).toBeNull()
    state.generate()
    expect(FakeWorker.instances[1]!.postMessage).toHaveBeenCalledWith({ size: 4, colorCount: 4 })
    old.deliver({ type: 'error', message: 'old error' }); expect(state.error.value).toBe(''); expect(state.busy.value).toBe(true)
  })
  it('不匹配的颜色数和无解尺寸不启动生成', async () => {
    const state = setup(); state.colorCount.value = 5
    expect(state.issue.value).not.toBe(''); state.generate(); expect(FakeWorker.instances).toHaveLength(0)
    state.size.value = 8; expect(state.colorCount.value).toBe(5)
    state.size.value = 2; state.colorCount.value = 2; await nextTick()
    expect(state.issue.value).not.toBe(''); state.generate(); expect(FakeWorker.instances).toHaveLength(0)
  })
  it('取消、卸载和超时都会结束 Worker；失败不显示答案', () => {
    const state = setup(); state.generate(); state.cancel()
    FakeWorker.instances[0]!.deliver({ type: 'success', puzzle: fixture })
    expect(state.generated.value).toBeNull(); expect(state.busy.value).toBe(false)
    state.generate(); vi.advanceTimersByTime(45_000)
    expect(state.error.value).toContain('用时过长'); expect(FakeWorker.instances[1]!.terminate).toHaveBeenCalled()
    state.generate(); scopes[0]!.stop()
    expect(FakeWorker.instances[2]!.terminate).toHaveBeenCalled()
  })
})
