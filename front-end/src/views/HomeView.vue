<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const username = computed(() => {
  return authStore.user?.name || authStore.user?.username || (authStore.user ? `${authStore.user.firstName || ''} ${authStore.user.lastName || ''}`.trim() : '') || 'Player'
})
</script>

<template>
  <div class="min-h-screen bg-[#0f0f0f] text-gray-100">
    <header class="w-full bg-[#171717] px-6 py-4 flex items-center justify-between shadow-md">
      <div class="flex items-center gap-4">
        <router-link to="/">
          <img src="/logo.png" alt="The Impostor" class="h-20 object-contain" />
        </router-link>
      </div>
      <div class="flex items-center gap-3">
        <div class="text-sm text-gray-200">{{ username }}</div>
        <div class="w-9 h-9 rounded-full bg-violet-300"></div>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 py-16">
      <div class="text-center mb-10">
        <h1 class="text-4xl md:text-3xl font-bold">Welcome {{ username }},<br>ready to find the impostor?</h1>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <!-- Create Game Card -->
        <div class="card pop-in p-8 rounded-xl bg-[rgba(18,18,18,0.95)] border-2 border-emerald-500/0 shadow-md flex flex-col justify-between" style="border-radius:14px;">
          <div>
            <h2 class="text-2xl font-extrabold text-emerald-400 text-center">CREATE GAME</h2>
            <p class="text-gray-400 text-center mt-4">Become host and invite your friends!</p>
          </div>

          <div class="mt-8 flex justify-center">
            <button class="px-8 py-3 rounded-full border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-700/10">NEW ROOM</button>
          </div>

        </div>

        <!-- Join Game Card -->
        <div class="card pop-in p-8 rounded-xl bg-[rgba(18,18,18,0.95)] border-2 border-violet-500/0 shadow-md flex flex-col justify-between" style="border-radius:14px;">
          <div>
            <h2 class="text-2xl font-extrabold text-violet-400 text-center">JOIN GAME</h2>
            <p class="text-gray-400 text-center mt-4">Insert Room Code:</p>

            <div class="mt-6 flex justify-center">
              <input type="text" placeholder="- - - - - -" class="w-3/4 md:w-2/3 px-4 py-3 rounded bg-[rgba(255,255,255,0.02)] border border-gray-700 text-gray-200 placeholder-gray-500 focus:outline-none" />
            </div>
          </div>

          <div class="mt-8 flex justify-center">
            <button class="px-10 py-3 rounded-full text-white bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed">JOIN</button>
          </div>
        </div>

      </div>
    </main>
  </div>
</template>

<style scoped>
.rounded-xl { border-radius: 14px; }
  
  .card { opacity: 0; transform: translateY(8px) scale(0.995); }

  @keyframes popIn {
    from { opacity: 0; transform: translateY(12px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .pop-in {
    animation-name: popIn;
    animation-duration: 420ms;
    animation-timing-function: cubic-bezier(.2,.9,.2,1);
    animation-fill-mode: forwards;
  }

  /* staggered delays for the two cards */
  .grid > .card:nth-child(1) { animation-delay: 120ms; }
  .grid > .card:nth-child(2) { animation-delay: 240ms; }

</style>
