<script setup>
import { ref, onMounted, computed } from 'vue'
import apiClient from '../services/apiClient'

const props = defineProps({
  playerId: { type: String, default: null },
  playerName: { type: String, default: 'Player' },
  isGuest: { type: Boolean, default: false }
})

const emits = defineEmits(['close'])

const stats = ref(null)
const loading = ref(false)
const error = ref(null)

onMounted(async () => {
  if (props.isGuest || !props.playerId) return
  loading.value = true
  try {
    stats.value = await apiClient.get(`/api/game-history/stats/${props.playerId}`)
  } catch (e) {
    error.value = e?.message || 'Could not load stats'
  } finally {
    loading.value = false
  }
})

const winRatePct = computed(() =>
  stats.value ? Math.round(stats.value.winRate * 100) : 0
)
const impostorWinRatePct = computed(() =>
  stats.value ? Math.round(stats.value.impostorWinRate * 100) : 0
)

function onBackdropClick(e) {
  if (e.target === e.currentTarget) emits('close')
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    @click="onBackdropClick"
  >
    <div class="relative w-full max-w-sm mx-4 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl p-6 pop-in">

      <!-- Close button -->
      <button
        @click="emits('close')"
        class="absolute top-3 right-3 text-gray-500 hover:text-gray-200 transition-colors"
        aria-label="Close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- Header -->
      <div class="flex flex-col items-center gap-2 mb-6">
        <div class="w-14 h-14 rounded-full bg-violet-500 flex items-center justify-center text-2xl font-bold text-white select-none">
          {{ (playerName || '?').charAt(0).toUpperCase() }}
        </div>
        <h2 class="text-lg font-bold text-gray-100">{{ playerName }}</h2>
        <p class="text-xs text-gray-500 uppercase tracking-widest">Stats</p>
      </div>

      <!-- Guest message -->
      <div v-if="isGuest" class="text-center text-gray-400 text-sm py-4">
        Stats are only available for registered players.
      </div>

      <!-- Loading -->
      <div v-else-if="loading" class="flex justify-center py-6">
        <div class="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center text-red-400 text-sm py-4">
        {{ error }}
      </div>

      <!-- Stats grid -->
      <div v-else-if="stats" class="grid grid-cols-2 gap-3">
        <div class="stat-card">
          <span class="stat-value">{{ stats.totalGames }}</span>
          <span class="stat-label">Games Played</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ stats.totalWins }}</span>
          <span class="stat-label">Wins</span>
        </div>
        <div class="stat-card col-span-2">
          <span class="stat-value text-emerald-400">{{ winRatePct }}%</span>
          <span class="stat-label">Win Rate</span>
          <div class="mt-2 h-1.5 rounded-full overflow-hidden" style="background:rgba(255,255,255,0.1)">
            <div class="h-full rounded-full bg-emerald-400 transition-all" :style="{ width: winRatePct + '%' }"></div>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-value text-red-400">{{ stats.totalImpostorRounds }}</span>
          <span class="stat-label">Impostor Rounds</span>
        </div>
        <div class="stat-card">
          <span class="stat-value text-red-400">{{ stats.impostorWins }}</span>
          <span class="stat-label">Impostor Wins</span>
        </div>
        <div class="stat-card col-span-2">
          <span class="stat-value text-red-400">{{ impostorWinRatePct }}%</span>
          <span class="stat-label">Impostor Win Rate</span>
          <div class="mt-2 h-1.5 rounded-full overflow-hidden" style="background:rgba(255,255,255,0.1)">
            <div class="h-full rounded-full bg-red-400 transition-all" :style="{ width: impostorWinRatePct + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- No data yet -->
      <div v-else class="text-center text-gray-500 text-sm py-4">
        No games played yet.
      </div>

    </div>
  </div>
</template>

<style scoped>
.stat-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
}
.stat-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: #f3f4f6;
}
.stat-label {
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #6b7280;
  font-weight: 600;
}

@keyframes popIn {
  from { opacity: 0; transform: translateY(10px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.pop-in {
  animation: popIn 300ms cubic-bezier(.2,.9,.2,1) forwards;
}
</style>
