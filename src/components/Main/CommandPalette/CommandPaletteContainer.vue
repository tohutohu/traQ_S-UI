<template>
  <div v-if="isCommandPaletteShown" :class="$style.container">
    <command-palette />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { useCommandPaletteStore } from '@/providers/commandPalette'
import CommandPalette from './CommandPalette.vue'

export default defineComponent({
  name: 'CommandPaletteContainer',
  components: {
    CommandPalette
  },
  setup() {
    const { isCommandPaletteShown } = useCommandPaletteStore()
    return { isCommandPaletteShown }
  }
})
</script>

<style lang="scss" module>
.container {
  @include background-common-overlay;
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
}
</style>
