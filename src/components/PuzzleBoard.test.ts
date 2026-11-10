import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PuzzleBoard from './PuzzleBoard.vue'
import ColorEditor from './ColorEditor.vue'
import { createBlank, createPreset, DEFAULT_REGIONS } from '../domain/preset'
import { solvePuzzle } from '../domain/solver'

const props = () => ({ puzzle: createPreset(), regions: DEFAULT_REGIONS, result: solvePuzzle(createPreset()), solving: false, tool: 'paint' as const, view: 'certainty' as const, solutionIndex: 0, activeCount: 7 })
describe('可编辑棋盘', () => {
  it('显示49格、7个确定雷，并通过键盘上报涂色行为', async () => {
    const wrapper = mount(PuzzleBoard, { props: props() })
    expect(wrapper.findAll('[data-cell]')).toHaveLength(49)
    expect(wrapper.findAll('[data-state="mine"]')).toHaveLength(7)
    expect(wrapper.findAll('[data-state="safe"]')).toHaveLength(42)
    await wrapper.find('[data-row="0"][data-col="3"]').trigger('click', { detail: 0 })
    expect(wrapper.emitted('cell')).toEqual([[0, 3]])
    expect(wrapper.emitted('begin')).toHaveLength(1)
    expect(wrapper.emitted('end')).toHaveLength(1)
    wrapper.unmount()
  })
  it('多解展示可能雷，而不误标某个方案为确定雷', () => {
    const p = createBlank(4)
    const wrapper = mount(PuzzleBoard, { props: { ...props(), puzzle: p, result: solvePuzzle(p) } })
    expect(wrapper.findAll('[data-state="mine"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-state="possible"]')).toHaveLength(8)
    wrapper.unmount()
  })
  it('预算截断不产生必定雷和安全格，只可预览方案', async () => {
    const p = createBlank(4)
    const wrapper = mount(PuzzleBoard, { props: { ...props(), puzzle: p, result: solvePuzzle(p, { maxSolutions: 1 }) } })
    expect(wrapper.findAll('[data-state="mine"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-state="safe"]')).toHaveLength(0)
    await wrapper.setProps({ view: 'solution' })
    expect(wrapper.findAll('[data-state="preview"]')).toHaveLength(4)
    wrapper.unmount()
  })
  it('恢复原始色块模式不展示自动推断；手动标记仍可见', async () => {
    const setup = props(); setup.puzzle.marks[0]![3] = 'mine'
    const wrapper = mount(PuzzleBoard, { props: setup })
    await wrapper.setProps({ view: 'colors' })
    expect(wrapper.findAll('[data-state="mine"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-state="safe"]')).toHaveLength(0)
    await wrapper.find('[data-row="0"][data-col="0"]').trigger('contextmenu')
    expect(wrapper.emitted('pick')).toEqual([[0]])
    wrapper.unmount()
  })
})
describe('颜色与尺寸编辑器', () => {
  it('尺寸、颜色增删、工具切换均通过事件公开契约', async () => {
    const wrapper = mount(ColorEditor, { props: { regions: DEFAULT_REGIONS, counts: {}, selectedRegion: 0, tool: 'paint', size: 7, activeCount: 7, canUndo: false, canRedo: false } })
    await wrapper.find('input[type="number"]').setValue(8)
    await wrapper.find('.size-control button').trigger('click')
    expect(wrapper.emitted('resize')).toEqual([[8]])
    await wrapper.find('.add-color').trigger('click')
    expect(wrapper.emitted('add')).toHaveLength(1)
    await wrapper.find('[aria-label="删除青蓝"]').trigger('click')
    expect(wrapper.emitted('remove')).toEqual([[0]])
    await wrapper.findAll('.tool')[1]!.trigger('click')
    expect(wrapper.emitted('tool')).toEqual([['mine']])
    wrapper.unmount()
  })
})
