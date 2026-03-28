<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useRoomStore } from '../stores/room'
import Avatar from '../components/Avatar.vue'

const route = useRoute()
const router = useRouter()
const code = route.params.code || ''
const authStore = useAuthStore()

const username = computed(() => {
  return authStore.user?.name || authStore.user?.username || (authStore.user ? `${authStore.user.firstName || ''} ${authStore.user.lastName || ''}`.trim() : '') || 'Player'
})

const roomStore = useRoomStore()
const { players, messages, impostors, discussionTime } = storeToRefs(roomStore)
const newMessage = ref('')
const chatContainer = ref(null)
const currentPlayer = computed(() => roomStore.currentPlayer)
const isHost = computed(() => roomStore.isHost)
const currentReady = computed(() => !!currentPlayer.value && !!currentPlayer.value.ready)

function isCurrent(p) {
  const uid = authStore.user?.id
  if (!p) return false
  return (
    (uid && (p.id === uid || p.userId === uid)) ||
    (p.username && p.username === authStore.user?.username) ||
    (p.displayName && p.displayName === (authStore.user?.username || authStore.user?.name)) ||
    (typeof p === 'string' && p === (authStore.user?.username || authStore.user?.name))
  )
}

function isPlayerHost(p) {
  if (!p) return false
  const hid = roomStore.roomHostId
  if (hid && (p.id === hid || p.userId === hid)) return true
  return p.host === true
}

function statusLabel(p) {
  if (!p) return ''
  if (isPlayerHost(p)) return 'HOST'
  if (p.ready) return 'READY'
  return 'WAITING'
}

function statusClass(p) {
  if (!p) return 'text-gray-400'
  if (isPlayerHost(p)) return 'text-emerald-400'
  if (p.ready) return 'text-emerald-400'
  return 'text-gray-400'
}

onMounted(async () => {
  const alreadyJoined = route.query?.joined === '1'
  try {
    await roomStore.join(code, alreadyJoined)
    await nextTick()
    if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  } catch {
    setTimeout(() => router.push({ name: 'home' }), 1400)
  }
})

watch(messages, async () => {
  await nextTick()
  if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight
}, { deep: true })

onBeforeUnmount(() => {
  roomStore.leave()
})

const { startGame, toggleReady, setDiscussionTime, decrementImpostors, incrementImpostors } = roomStore
function sendChat() { if (!newMessage.value) return; roomStore.sendChat(newMessage.value); newMessage.value = '' }
</script>

<template>
  <div class="min-h-screen bg-[#0f0f0f] text-gray-100 flex flex-col">
    <header class="w-full bg-[#171717] px-6 py-4 flex items-center justify-between shadow-md">
      <div class="flex items-center gap-4">
        <router-link to="/">
          <img src="/logo.png" alt="The Impostor" class="h-12 md:h-20 object-contain" />
        </router-link>
      </div>

      <div class="flex-1 flex justify-center">
        <div class="px-3 md:px-6 py-2 rounded-full bg-violet-600/20 text-violet-300 font-bold text-sm md:text-base">CODE: {{ code }}</div>
      </div>

      <div class="flex items-center gap-3">
        <div class="text-sm text-gray-200">{{ username }}</div>
        <Avatar :name="username" />
      </div>
    </header>

    <div class="p-4 md:p-6 flex-1 min-h-0">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 h-full min-h-0">
      <!-- Players column -->
      <aside class="card pop-in order-2 md:order-none col-span-1 md:col-span-3 bg-[rgba(24,24,24,0.9)] p-3 md:p-4 rounded flex flex-col h-full min-h-0">
        <h3 class="text-sm text-gray-300 font-bold mb-4">PLAYERS ({{ players.length }})</h3>
        <ul class="space-y-3 flex-1 overflow-auto">
            <li v-for="(p, idx) in players" :key="idx"
              :class="[ 'flex items-center justify-between py-3 rounded-lg', isCurrent(p) ? 'bg-violet-700/30 ring-1 ring-violet-500' : 'bg-[rgba(0,0,0,0.2)]', 'w-full px-2 md:px-3' ]">
            <div class="flex items-center gap-3">
              <Avatar :name="p.displayName || p.username || p" :active="isCurrent(p)" size="sm" class="flex-shrink-0" />
              <div class="text-sm">
                <span :class="isCurrent(p) ? 'font-bold' : ''">{{ p.displayName || p.username || p }}<span v-if="isCurrent(p)" class="font-extrabold"> (You)</span></span>
              </div>
            </div>
            <div :class="[ 'text-xs font-semibold', statusClass(p) ]">{{ statusLabel(p) }}</div>
          </li>
        </ul>
      </aside>

      <!-- Main settings -->
      <main class="card pop-in order-1 md:order-none col-span-1 md:col-span-6 bg-[rgba(18,18,18,0.95)] p-3 md:p-4 rounded flex flex-col h-full min-h-0">
        <h2 class="text-2xl font-bold mb-4">GAME SETTINGS</h2>
        <!-- settings UI: number of impostors selector -->
        <div class="flex-1">
          <div class="w-full">
            <label class="block text-sm text-gray-400 mb-2 font-semibold">NUMBER OF IMPOSTORS</label>
            <div class="flex items-center justify-start gap-4">
              <button @click="decrementImpostors" :disabled="!isHost || impostors <= 1"
                :title="!isHost ? 'Only host can change settings' : 'Decrease impostors'"
                class="w-10 h-10 rounded-md bg-[rgba(0,0,0,0.4)] border border-gray-700 flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed">-</button>
              <div class="text-2xl font-bold text-white">{{ impostors }}</div>
              <button @click="incrementImpostors" :disabled="!isHost || impostors >= 2"
                :title="!isHost ? 'Only host can change settings' : 'Increase impostors'"
                class="w-10 h-10 rounded-md bg-violet-500 flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed">+</button>
            </div>
            <!-- Discussion time selector -->
            <div class="mt-6">
              <label class="block text-sm text-gray-400 mb-2 font-semibold">DISCUSSION TIME</label>
              <div class="w-full bg-[rgba(0,0,0,0.15)] rounded-full flex overflow-hidden">
                <button @click="setDiscussionTime(60)" :disabled="!isHost"
                  :title="!isHost ? 'Only host can change settings' : '60 seconds'"
                  :class="discussionTime === 60 ? 'flex-1 py-3 text-center bg-violet-500 text-white font-semibold' : 'flex-1 py-3 text-center text-gray-300'"
                  class-disabled="opacity-50 cursor-not-allowed">60s</button>
                <button @click="setDiscussionTime(90)" :disabled="!isHost"
                  :title="!isHost ? 'Only host can change settings' : '90 seconds'"
                  :class="discussionTime === 90 ? 'flex-1 py-3 text-center bg-violet-500 text-white font-semibold' : 'flex-1 py-3 text-center text-gray-300'">90s</button>
                <button @click="setDiscussionTime(120)" :disabled="!isHost"
                  :title="!isHost ? 'Only host can change settings' : '120 seconds'"
                  :class="discussionTime === 120 ? 'flex-1 py-3 text-center bg-violet-500 text-white font-semibold' : 'flex-1 py-3 text-center text-gray-300'">120s</button>
              </div>
              <div v-if="!isHost" class="mt-2 text-xs text-gray-400">Only the host can modify game settings</div>
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-center">
          <button v-if="isHost" @click="startGame" class="w-full max-w-3xl px-10 py-4 rounded-full bg-violet-500 text-white font-bold">START GAME</button>
          <button v-else @click="toggleReady" :class="['w-full max-w-3xl px-10 py-4 rounded-full font-bold', currentReady ? 'bg-emerald-400 text-black' : 'bg-violet-500 text-white']">{{ currentReady ? 'UNREADY' : 'READY' }}</button>
        </div>
      </main>

      <!-- Chat -->
      <aside class="card pop-in order-3 md:order-none col-span-1 md:col-span-3 bg-[rgba(24,24,24,0.9)] p-3 md:p-4 rounded flex flex-col h-full min-h-0">
        <h3 class="text-sm text-gray-300 font-bold mb-4">CHAT</h3>
        <div ref="chatContainer" class="h-64 md:h-[calc(100vh-300px)] overflow-y-auto mb-4 p-2 bg-[rgba(0,0,0,0.2)] rounded">
          <div v-for="(m, i) in messages" :key="i" class="mb-3">
            <div>
              <div class="text-sm font-bold text-violet-300 leading-tight">{{ ((m.local || (m.senderId && String(m.senderId) === String(authStore.user?.id))) ? 'You' : (m.sender ?? m.displayName ?? m.from ?? m.senderId ?? 'Player')) + ':' }}</div>
              <div class="text-sm text-gray-200 break-words mt-1">{{ m.content || m.message }}</div>
            </div>
          </div>
        </div>

        <div class="flex gap-2 items-center">
          <input v-model="newMessage" placeholder="Send a message..." class="flex-1 px-3 py-2 rounded bg-[rgba(0,0,0,0.25)] text-gray-100" />
          <button @click="sendChat" class="px-4 py-2 rounded bg-violet-500">SEND</button>
        </div>
      </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* pop-in animation (same as Login/Register) */
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
  animation-delay: 120ms;
}

/* staggered delays for the three columns */
.grid > .card:nth-child(1) { animation-delay: 120ms; }
.grid > .card:nth-child(2) { animation-delay: 240ms; }
.grid > .card:nth-child(3) { animation-delay: 360ms; }
</style>
