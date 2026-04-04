<script setup>
import { computed } from 'vue'
const props = defineProps({
  role: { type: String, default: null },
  secret: { type: String, default: '' }
})
const emits = defineEmits(['dismiss'])

const isImpostor = computed(() => props.role === 'IMPOSTOR')

function onDismiss() {
  emits('dismiss')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="role" class="fixed inset-0 flex items-center justify-center z-50">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
      <div class="relative z-10 w-full max-w-sm mx-4 bg-[#121212] rounded-2xl p-8 flex flex-col items-center gap-4 border border-violet-500/20 shadow-2xl">
        <div class="w-16 h-16 rounded-full border-2 border-violet-500 flex items-center justify-center bg-[#1a1a2e]">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-7 h-7 text-violet-400 ml-1">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <h2 class="text-2xl font-extrabold text-white tracking-widest">GAME STARTED</h2>
        <p class="text-xs text-gray-400 tracking-widest uppercase">Your Role</p>

        <div :class="[
          'w-full text-center py-3 rounded-full font-extrabold text-lg tracking-widest border-2',
          isImpostor ? 'border-red-500/60 text-red-500 bg-black/60' : 'border-violet-500/60 text-violet-300 bg-black/60'
        ]">
          {{ role }}
        </div>

        <p :class="['text-[11px] tracking-widest uppercase mt-1', isImpostor ? 'text-red-400' : 'text-gray-400']">
          {{ isImpostor ? 'Use this hint to blend in' : 'Memorize the Secret Word' }}
        </p>

        <p :class="['text-3xl font-extrabold tracking-widest', isImpostor ? 'text-red-500' : 'text-white']">{{ secret }}</p>

        <button
          @click="onDismiss"
          :class="[
            'w-full mt-4 py-4 rounded-full font-bold text-white transition-colors',
            isImpostor
              ? 'bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800'
              : 'bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600'
          ]"
        >GOT IT</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
</style>
