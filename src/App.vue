<script setup lang="ts">
import { onScopeDispose, shallowRef } from 'vue'
import AppHeader from './components/AppHeader.vue'
import PuzzleWorkbench from './components/PuzzleWorkbench.vue'
import GeneratorPage from './components/generator/GeneratorPage.vue'

const readPage = () => window.location.hash === '#/generator' ? 'generator' as const : 'editor' as const
const page = shallowRef(readPage())
function syncPage() { page.value = readPage() }
window.addEventListener('hashchange', syncPage)
onScopeDispose(() => window.removeEventListener('hashchange', syncPage))
</script>

<template>
  <AppHeader :page="page" />
  <GeneratorPage v-if="page === 'generator'" />
  <PuzzleWorkbench v-else />
</template>
