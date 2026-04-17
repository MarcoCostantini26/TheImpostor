<script setup>
import { computed } from 'vue'

const props = defineProps({
  eliminatedName: { type: String, default: null },
  eliminatedRole: { type: String, default: null },
  isTie: { type: Boolean, default: false }
})
const emits = defineEmits(['dismiss'])

const isImpostor = computed(() => props.eliminatedRole === 'IMPOSTOR')

function onDismiss() {
  emits('dismiss')
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 flex items-center justify-center z-50">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

      <div class="relative z-10 w-full max-w-xs mx-4 bg-[#121212] rounded-xl p-4 flex flex-col items-center gap-3 border border-white/10 shadow-xl card pop-in">

        <!-- Icon -->
        <div :class="['w-12 h-12 rounded-full border flex items-center justify-center',
          isTie
            ? 'border-yellow-500/50 bg-yellow-950/30'
            : isImpostor
              ? 'border-red-500/50 bg-red-950/30'
              : 'border-violet-500/50 bg-violet-950/30'
        ]">
          <!-- Tie icon -->
          <svg v-if="isTie" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-yellow-400">
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-5h2v2h-2zm0-8h2v6h-2z"/>
          </svg>
          <!-- Skull icon -->
          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
            :class="['w-6 h-6', isImpostor ? 'text-red-400' : 'text-violet-400']">
            <path d="M12 2a9 9 0 00-9 9c0 3.074 1.557 5.782 3.93 7.417V21a1 1 0 001 1h8a1 1 0 001-1v-2.583A9.002 9.002 0 0021 11a9 9 0 00-9-9zM9 16v-1H8v-1.5a.5.5 0 01.5-.5h7a.5.5 0 01.5.5V15h-1v1H9zm3-5a2 2 0 110-4 2 2 0 010 4z"/>
          </svg>
        </div>

        <!-- Title -->
        <h2 class="text-lg font-extrabold text-white tracking-widest">
          {{ isTie ? 'TIE VOTE' : 'PLAYER ELIMINATED' }}
        </h2>

        <!-- Tie message -->
        <template v-if="isTie">
          <p class="text-sm text-yellow-300 text-center">No consensus reached — no one was eliminated this round.</p>
        </template>

        <!-- Elimination info -->
        <template v-else>
          <p class="text-[10px] text-gray-400 tracking-widest uppercase">Eliminated</p>
          <div class="w-full text-center py-2 rounded-full font-extrabold text-sm tracking-widest border border-white/20 text-white bg-black/40">
            {{ eliminatedName || 'Unknown Player' }}
          </div>

          <template v-if="eliminatedRole">
            <p class="text-[10px] text-gray-500 tracking-widest uppercase mt-1">His Role Was</p>
            <div :class="[
              'w-full text-center py-2 rounded-full font-extrabold text-sm tracking-widest border',
              isImpostor
                ? 'border-red-500/40 text-red-400 bg-black/50'
                : 'border-violet-500/40 text-violet-300 bg-black/50'
            ]">
              {{ eliminatedRole }}
            </div>
          </template>
        </template>

        <p class="text-[10px] text-gray-500 text-center mt-1">A new round will start shortly…</p>

        <button
          @click="onDismiss"
          class="w-full mt-2 py-2 rounded-full font-bold text-white text-sm transition-colors bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600"
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
