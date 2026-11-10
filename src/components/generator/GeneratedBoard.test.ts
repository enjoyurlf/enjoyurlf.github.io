import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import GeneratedBoard from './GeneratedBoard.vue'
import { createPreset, DEFAULT_REGIONS } from '../../domain/preset'
import type { GeneratedPuzzle } from '../../domain/generator'

const generated: GeneratedPuzzle = { puzzle: createPreset(), regions: DEFAULT_REGIONS, solution: [3, 6, 4, 1, 5, 2, 0], seed: 42 }
describe('随机棋盘答案显示', () => {
  it('默认显示完整色块，不在图标、坐标或无障碍描述中泄露答案', () => {
    const wrapper = mount(GeneratedBoard, { props: { generated, revealed: false, busy: false } })
    expect(wrapper.findAll('[data-generated-row]')).toHaveLength(49)
    expect(wrapper.findAll('[data-answer="mine"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-answer-coordinate]')).toHaveLength(0)
    expect(wrapper.findAll('[data-generated-row]').every(cell => !/地雷|安全/.test(cell.attributes('aria-label') ?? ''))).toBe(true)
    expect(wrapper.text()).toContain('查看答案')
  })
  it('查看答案事件、唯一解雷位和隐藏后的清理', async () => {
    const wrapper = mount(GeneratedBoard, { props: { generated, revealed: false, busy: false } })
    await wrapper.get('button[aria-pressed]').trigger('click')
    expect(wrapper.emitted('toggleAnswer')).toHaveLength(1)
    await wrapper.setProps({ revealed: true })
    expect(wrapper.findAll('[data-answer="mine"]').map(cell => [Number(cell.attributes('data-generated-row')), Number(cell.attributes('data-generated-col'))])).toEqual(generated.solution.map((col, row) => [row, col]))
    expect(wrapper.findAll('[data-answer-coordinate]')).toHaveLength(7)
    expect(wrapper.text()).toContain('隐藏答案')
    await wrapper.setProps({ revealed: false })
    expect(wrapper.findAll('[data-answer="mine"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-answer-coordinate]')).toHaveLength(0)
  })
  it('生成中不展示旧棋盘或答案按钮', () => {
    const wrapper = mount(GeneratedBoard, { props: { generated: null, revealed: false, busy: true } })
    expect(wrapper.text()).toContain('正在创造一张新地图')
    expect(wrapper.findAll('[data-generated-row]')).toHaveLength(0)
    expect(wrapper.find('button[aria-pressed]').exists()).toBe(false)
  })
})
