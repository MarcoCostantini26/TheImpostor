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
      <div class="relative z-10 w-full max-w-xs mx-4 bg-[#121212] rounded-xl p-4 flex flex-col items-center gap-3 border border-violet-500/10 shadow-xl card pop-in">
        <div class="w-12 h-12 rounded-full border border-violet-500 flex items-center justify-center bg-[#1a1a2e]">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-7 h-7 text-violet-400 ml-1">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <h2 class="text-lg font-extrabold text-white tracking-widest">GAME STARTED</h2>
        <p class="text-[10px] text-gray-400 tracking-widest uppercase">Your Role</p>

        <div :class="[
          'w-full text-center py-2 rounded-full font-extrabold text-sm tracking-widest border',
          isImpostor ? 'border-red-500/40 text-red-500 bg-black/50' : 'border-violet-500/40 text-violet-300 bg-black/50'
        ]">
          {{ role }}
        </div>

        <p :class="['text-[10px] tracking-widest uppercase mt-1', isImpostor ? 'text-red-400' : 'text-gray-400']">
          {{ isImpostor ? 'Use this hint to blend in' : 'Memorize the Secret Word' }}
        </p>

        <p :class="['text-xl font-extrabold tracking-widest', isImpostor ? 'text-red-500' : 'text-white']">{{ secret }}</p>

        <button
          @click="onDismiss"
          :class="[
            'w-full mt-3 py-2 rounded-full font-bold text-white text-sm transition-colors',
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
@keyframes popIn {
  from { opacity: 0; transform: translateY(12px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)   scale(1);    }
}
.pop-in {
  animation: popIn 400ms cubic-bezier(.2,.9,.2,1) both;
}
.card {
  opacity: 0;
  transform: translateY(8px) scale(0.995);
}
</style>
