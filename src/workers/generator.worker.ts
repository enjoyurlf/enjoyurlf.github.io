import { generatePuzzle, type GeneratorMessage, type GeneratorSettings } from '../domain/generator'

function send(message: GeneratorMessage) { self.postMessage(message) }
self.onmessage = (event: MessageEvent<GeneratorSettings>) => {
  try {
    const puzzle = generatePuzzle(event.data, { onProgress: progress => send({ type: 'progress', progress }) })
    send({ type: 'success', puzzle })
  } catch (error) {
    send({ type: 'error', message: error instanceof Error ? error.message : '随机地图生成失败，请重试。' })
  }
}
