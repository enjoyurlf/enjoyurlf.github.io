import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const url = 'http://127.0.0.1:5173'
const checks = []
const errors = []
// Independent row enumeration: no generator code, no solver imports, no preset marks.
function onlyAnswer(puzzle) {
  assert.ok(puzzle.marks.flat().every(mark => mark === 'unknown'))
  const n = puzzle.size, cols = new Set(), colors = new Set(), placed = [], answers = []
  let nodes = 0
  function visit(r) {
    if (++nodes > 5_000_000) throw new Error('Independent checker budget exceeded')
    if (r === n) { answers.push([...placed]); return }
    for (let c = 0; c < n && answers.length < 2; c++) {
      const color = puzzle.grid[r][c]
      if (cols.has(c) || colors.has(color) || (r && Math.abs(c - placed[r - 1]) <= 1)) continue
      cols.add(c); colors.add(color); placed.push(c); visit(r + 1)
      placed.pop(); cols.delete(c); colors.delete(color)
    }
  }
  visit(0)
  assert.equal(answers.length, 1, 'Exported unmarked puzzle must have exactly one solution')
  return answers[0]
}
async function exported(page, name) {
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出随机棋盘', exact: true }).click()
  const download = await downloadPromise
  const path = `artifacts/${name}.json`
  await download.saveAs(path)
  const data = JSON.parse(await readFile(path, 'utf8'))
  assert.equal(data.version, 1)
  assert.equal('solution' in data, false)
  return data
}
async function hidden(page, size) {
  await page.getByRole('heading', { name: `${size} × ${size} 随机地图`, exact: true }).waitFor({ timeout: 45_000 })
  await expect(page.locator('[data-generated-row]')).toHaveCount(size * size)
  await expect(page.locator('[data-answer="mine"]')).toHaveCount(0)
  await expect(page.locator('[data-answer-coordinate]')).toHaveCount(0)
  assert.ok((await page.locator('[data-generated-row]').evaluateAll(cells => cells.map(c => c.getAttribute('aria-label')))).every(label => !/地雷|安全/.test(label)))
}
async function reveal(page, answer) {
  await page.getByRole('button', { name: '查看答案', exact: true }).click()
  await expect(page.locator('[data-answer="mine"]')).toHaveCount(answer.length)
  const actual = await page.locator('[data-answer="mine"]').evaluateAll(cells => cells.map(cell => [Number(cell.dataset.generatedRow), Number(cell.dataset.generatedCol)]))
  assert.deepEqual(actual, answer.map((col, row) => [row, col]))
  await expect(page.locator('[data-answer-coordinate]')).toHaveCount(answer.length)
}
function track(page) {
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
}

await mkdir('artifacts', { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
  const page = await context.newPage(); track(page)
  await page.goto(url)
  await page.getByRole('heading', { name: '找到唯一答案', exact: true }).waitFor()
  await page.getByRole('link', { name: '随机出题', exact: true }).click()
  await hidden(page, 7)
  const initial = await exported(page, 'generator-puzzle')
  const initialAnswer = onlyAnswer(initial.puzzle)
  await page.screenshot({ path: 'artifacts/generator-hidden.png', fullPage: true })
  await reveal(page, initialAnswer)
  await page.screenshot({ path: 'artifacts/generator-answer.png', fullPage: true })
  await page.getByRole('button', { name: '隐藏答案', exact: true }).click(); await hidden(page, 7)
  checks.push('导航到随机出题、默认隐藏答案、查看/隐藏均正确；导出7阶地图独立枚举只有一个解')

  await reveal(page, initialAnswer)
  await page.getByRole('button', { name: '生成随机地图', exact: true }).click(); await hidden(page, 7)
  const another = await exported(page, 'generator-another')
  onlyAnswer(another.puzzle)
  assert.notDeepEqual(another, initial)
  checks.push('重新生成获得不同地图，自动清除旧答案')

  await page.getByRole('spinbutton', { name: '随机颜色数量', exact: true }).fill('6')
  await expect(page.getByRole('button', { name: '生成随机地图', exact: true })).toBeDisabled()
  await expect(page.locator('[data-generated-row]')).toHaveCount(0)
  await expect(page.locator('#generation-issue')).not.toBeEmpty()
  await page.getByRole('spinbutton', { name: '随机棋盘边长', exact: true }).fill('3')
  await page.getByRole('spinbutton', { name: '随机颜色数量', exact: true }).fill('3')
  await expect(page.getByRole('button', { name: '生成随机地图', exact: true })).toBeDisabled()
  checks.push('颜色数不匹配和3阶无解均明确提示，不能误生成，旧地图立即清除')

  for (const size of [1, 4, 8, 16]) {
    await page.getByRole('spinbutton', { name: '随机棋盘边长', exact: true }).fill(String(size))
    await expect(page.getByRole('spinbutton', { name: '随机颜色数量', exact: true })).toHaveValue(String(size))
    await page.getByRole('button', { name: '生成随机地图', exact: true }).click()
    await hidden(page, size)
    const data = await exported(page, `generator-${size}`)
    assert.equal(new Set(data.puzzle.grid.flat()).size, size)
    await reveal(page, onlyAnswer(data.puzzle))
  }
  checks.push('1/4/8/16阶尺寸、同步颜色数、实际色数及唯一解独立检查全部正确')

  await page.getByRole('link', { name: '编辑求解', exact: true }).click()
  await page.getByRole('heading', { name: '找到唯一答案', exact: true }).waitFor()
  await expect(page.locator('[data-cell]')).toHaveCount(49)
  await page.getByLabel('导入棋盘 JSON', { exact: true }).setInputFiles('artifacts/generator-puzzle.json')
  await page.getByRole('heading', { name: '找到唯一答案', exact: true }).waitFor()
  await expect(page.locator('[data-state="mine"]')).toHaveCount(7)
  const editorMines = await page.locator('[data-state="mine"]').evaluateAll(cells => cells.map(cell => Number(cell.dataset.col)))
  assert.deepEqual(editorMines, initialAnswer)
  await page.goBack(); await hidden(page, 7)
  await page.reload(); await hidden(page, 7)
  checks.push('编辑页原有数据保留；生成地图可导入并得到同一唯一解；页面回退/直达刷新可用')
  await context.close()

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const mobile = await mobileContext.newPage(); track(mobile)
  await mobile.goto(`${url}/#/generator`); await hidden(mobile, 7)
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
  await mobile.getByRole('button', { name: '查看答案', exact: true }).tap()
  await expect(mobile.locator('[data-answer="mine"]')).toHaveCount(7)
  await mobile.screenshot({ path: 'artifacts/generator-mobile.png', fullPage: true })
  await mobile.getByRole('spinbutton', { name: '随机棋盘边长', exact: true }).fill('16')
  await mobile.getByRole('button', { name: '生成随机地图', exact: true }).tap(); await hidden(mobile, 16)
  await mobile.getByRole('button', { name: '查看答案', exact: true }).tap()
  await expect(mobile.locator('[data-answer="mine"]')).toHaveCount(16)
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
  await mobileContext.close()
  checks.push('390px手机端7阶/16阶均无横向溢出，触摸查看答案正常')
  assert.deepEqual(errors, [])
  const report = { url: `${url}/#/generator`, checkedAt: new Date().toISOString(), checks, errors }
  await writeFile('artifacts/generator-verification.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
