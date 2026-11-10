<script setup lang="ts">
import { Grid2X2, Shuffle, Paintbrush, LockKeyhole } from 'lucide-vue-next'
defineProps<{ page: 'editor' | 'generator' }>()
</script>

<template>
  <header class="app-header">
    <div class="header-inner">
      <a class="brand" href="#/editor" aria-label="色块扫雷主页"><span class="brand-logo"><Grid2X2 :size="22" /></span><span>色块扫雷 <small>PUZZLE LAB</small></span></a>
      <nav class="page-nav" aria-label="页面导航">
        <a href="#/editor" :class="{ active: page === 'editor' }" :aria-current="page === 'editor' ? 'page' : undefined"><Paintbrush :size="16" />编辑求解</a>
        <a href="#/generator" :class="{ active: page === 'generator' }" :aria-current="page === 'generator' ? 'page' : undefined"><Shuffle :size="16" />随机出题</a>
      </nav>
      <span class="local-note"><LockKeyhole :size="12" />本地运行 · 无需上传</span>
    </div>
  </header>
</template>

<style scoped>
.app-header { background: #fdfdfaf2; border-bottom: 1px solid var(--line); }
.header-inner { min-height: 74px; max-width: 1320px; margin: auto; padding: 12px 34px; display: flex; align-items: center; gap: 28px; }
.brand { display: flex; align-items: center; gap: 10px; color: #405641; text-decoration: none; font-size: 16px; font-weight: 650; }
.brand-logo { width: 35px; height: 35px; display: grid; place-items: center; background: #e7efe5; color: var(--teal); border-radius: 9px; }
.brand small { font-family: var(--mono); font-size: 9px; font-weight: 400; color: #8a9b83; letter-spacing: .12em; margin-left: 12px; }
.page-nav { display: flex; gap: 5px; padding: 4px; background: #f1f4ed; border-radius: 10px; }
.page-nav a { display: flex; align-items: center; gap: 7px; text-decoration: none; font-size: 12px; color: #778670; padding: 9px 12px; border-radius: 7px; }
.page-nav a.active { background: white; color: #3f765c; box-shadow: 0 1px 4px #334d2410; }
.page-nav a:hover { color: #345d45; }
.local-note { margin-left: auto; display: flex; align-items: center; gap: 6px; font-size: 10px; color: #8b9d85; }
@media (max-width: 850px) { .header-inner { padding: 12px 22px; gap: 16px; }.brand small { display: none; } }
@media (max-width: 600px) { .header-inner { padding: 12px 16px; flex-wrap: wrap; gap: 12px; }.brand { font-size: 15px; }.page-nav { margin-left: auto; }.page-nav a { padding: 9px; font-size: 11px; gap: 5px; }.local-note { display: none; } }
</style>
