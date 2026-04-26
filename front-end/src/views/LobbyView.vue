<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useRoomStore } from '../stores/room'
import Avatar from '../components/AvatarIcon.vue'
import RolePopup from '../components/RolePopup.vue'
import { matchesId } from '../helpers/player'

const route = useRoute()
const router = useRouter()
const code = route.params.code || ''
const authStore = useAuthStore()

const username = computed(() => {
  return authStore.user?.name || authStore.user?.username || (authStore.user ? `${authStore.user.firstName || ''} ${authStore.user.lastName || ''}`.trim() : '') || 'Player'
})

const roomStore = useRoomStore()
const { players, messages, impostors, discussionTime, myRole, mySecretWord } = storeToRefs(roomStore)
const newMessage = ref('')
const desktopChat = ref(null)
const mobileChat  = ref(null)
const showMobileChat    = ref(false)
const mobileUnreadCount = ref(0)
const currentPlayer = computed(() => roomStore.currentPlayer)
const isHost = computed(() => roomStore.isHost)
const currentReady = computed(() => !!currentPlayer.value && !!currentPlayer.value.ready)

const nonHostPlayers = computed(() => players.value.filter(p => !isPlayerHost(p)))
const readyCount = computed(() => nonHostPlayers.value.filter(p => p.ready).length)
const allReady = computed(() => nonHostPlayers.value.length > 0 && readyCount.value === nonHostPlayers.value.length)
const MIN_PLAYERS = 4
const enoughPlayers = computed(() => players.value.length >= MIN_PLAYERS)
const canStart = computed(() => allReady.value && enoughPlayers.value)
const maxImpostors = computed(() => players.value.length >= 6 ? 2 : 1)

function isCurrent(p) {
  if (!p) return false
  const uid = authStore.user?.id
  const uname = authStore.user?.username || authStore.user?.name
  if (uid && matchesId(p, uid)) return true
  if (uname && (p.username === uname || p.displayName === uname)) return true
  if (typeof p === 'string' && p === uname) return true
  return false
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
  try {
    await roomStore.join(code)
    await nextTick()
    if (desktopChat.value) desktopChat.value.scrollTop = desktopChat.value.scrollHeight
    if (showMobileChat.value && mobileChat.value) mobileChat.value.scrollTop = mobileChat.value.scrollHeight
  } catch {
    setTimeout(() => router.push({ name: 'home' }), 1400)
  }
})

watch(messages, async () => {
  await nextTick()
  if (desktopChat.value) desktopChat.value.scrollTop = desktopChat.value.scrollHeight
  if (showMobileChat.value) {
    if (mobileChat.value) mobileChat.value.scrollTop = mobileChat.value.scrollHeight
    mobileUnreadCount.value = 0
  } else {
    mobileUnreadCount.value++
  }
}, { deep: true })

watch(showMobileChat, async (val) => {
  if (val) {
    mobileUnreadCount.value = 0
    await nextTick()
    if (mobileChat.value) mobileChat.value.scrollTop = mobileChat.value.scrollHeight
  }
})

watch(maxImpostors, (newMax) => {
  if (impostors.value > newMax) {
    decrementImpostors()
  }
})

onBeforeUnmount(() => {
  if (roomStore.roomStatus !== 'STARTED') {
    roomStore.leave()
  }
})

const { startGame, toggleReady, setDiscussionTime, decrementImpostors, incrementImpostors } = roomStore
function sendChat() { if (!newMessage.value) return; roomStore.sendChat(newMessage.value); newMessage.value = '' }
function onRolePopupDismiss() {
  roomStore.dismissRole()
  router.push({ name: 'game', params: { code } })
}
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

    <div class="p-4 md:p-6">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 pb-20 md:pb-0">
      <!-- Players column -->
      <aside class="card pop-in order-2 md:order-none col-span-1 md:col-span-3 bg-[rgba(24,24,24,0.9)] p-3 md:p-4 rounded flex flex-col">
        <h3 class="text-sm text-gray-300 font-bold mb-4">PLAYERS ({{ players.length }})</h3>
        <ul class="space-y-3 overflow-auto">
            <li v-for="(p, idx) in players" :key="idx"
              :class="[ 'flex items-center justify-between py-3 rounded-lg', isCurrent(p) ? 'bg-violet-700/30 ring-1 ring-violet-500' : 'bg-[rgba(0,0,0,0.2)]', 'w-full px-2 md:px-3' ]">
            <div class="flex items-center gap-3">
              <Avatar :name="p.displayName || p.username || p" :active="isCurrent(p)" size="sm" class="flex-shrink-0" />
              <div class="text-sm">
                <span :class="isCurrent(p) ? 'font-bold' : ''">{{ p.displayName || p.username || p }}<span v-if="isCurrent(p)" class="text-violet-400 font-normal text-xs"> (You)</span></span>
              </div>
            </div>
            <div :class="[ 'text-xs font-semibold', statusClass(p) ]">{{ statusLabel(p) }}</div>
          </li>
        </ul>
      </aside>

      <!-- Main settings -->
      <main class="card pop-in order-1 md:order-none col-span-1 md:col-span-6 bg-[rgba(18,18,18,0.95)] p-3 md:p-4 rounded flex flex-col">
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
              <button @click="incrementImpostors" :disabled="!isHost || impostors >= maxImpostors"
                :title="!isHost ? 'Only host can change settings' : (impostors >= maxImpostors ? 'Need at least 6 players for 2 impostors' : 'Increase impostors')"
                class="w-10 h-10 rounded-md bg-violet-500 flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed">+</button>
            </div>
            <!-- Discussion time selector -->
            <div class="mt-6">
              <label class="block text-sm text-gray-400 mb-2 font-semibold">DISCUSSION TIME</label>
              <div class="w-full bg-[rgba(0,0,0,0.15)] rounded-full flex overflow-hidden">
                <button @click="setDiscussionTime(30)" :disabled="!isHost"
                  :title="!isHost ? 'Only host can change settings' : '60 seconds'"
                  :class="discussionTime === 30 ? 'flex-1 py-3 text-center bg-violet-500 text-white font-semibold' : 'flex-1 py-3 text-center text-gray-300'"
                  class-disabled="opacity-50 cursor-not-allowed">30s</button>
                <button @click="setDiscussionTime(60)" :disabled="!isHost"
                  :title="!isHost ? 'Only host can change settings' : '90 seconds'"
                  :class="discussionTime === 60 ? 'flex-1 py-3 text-center bg-violet-500 text-white font-semibold' : 'flex-1 py-3 text-center text-gray-300'">60s</button>
                <button @click="setDiscussionTime(90)" :disabled="!isHost"
                  :title="!isHost ? 'Only host can change settings' : '120 seconds'"
                  :class="discussionTime === 90 ? 'flex-1 py-3 text-center bg-violet-500 text-white font-semibold' : 'flex-1 py-3 text-center text-gray-300'">90s</button>
              </div>
              <div v-if="!isHost" class="mt-2 text-xs text-gray-400">Only the host can modify game settings</div>
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-center">
          <button v-if="isHost" @click="startGame" :disabled="!canStart" :class="['w-full max-w-3xl px-10 py-4 rounded-full font-bold', canStart ? 'bg-violet-500 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed']">
              <span v-if="!enoughPlayers">Need {{ MIN_PLAYERS - players.length }} more player{{ MIN_PLAYERS - players.length > 1 ? 's' : '' }}!</span>
              <span v-else>START GAME ({{ readyCount+1 }}/{{ nonHostPlayers.length+1 }} ready)</span>
            </button>
          <button v-else @click="toggleReady" :class="['w-full max-w-3xl px-10 py-4 rounded-full font-bold', currentReady ? 'bg-emerald-400 text-black' : 'bg-violet-500 text-white']">{{ currentReady ? 'UNREADY' : 'READY' }}</button>
        </div>
      </main>

      <!-- Desktop chat (hidden on small screens) -->
      <aside class="hidden md:flex card pop-in order-3 md:order-none col-span-1 md:col-span-3 bg-[rgba(24,24,24,0.9)] p-3 md:p-4 rounded flex-col">
        <h3 class="text-sm text-gray-300 font-bold mb-4">CHAT</h3>
        <div ref="desktopChat" class="h-64 overflow-y-auto mb-4 p-2 bg-[rgba(0,0,0,0.2)] rounded">
          <div v-for="(m, i) in messages" :key="i" class="mb-3">
            <div>
              <div class="text-sm font-bold text-violet-300 leading-tight">{{ ((m.local || (m.senderId && String(m.senderId) === String(authStore.user?.id))) ? 'You' : (m.sender ?? m.displayName ?? m.from ?? m.senderId ?? 'Player')) + ':' }}</div>
              <div class="text-sm text-gray-200 break-words mt-1">{{ m.content || m.message }}</div>
            </div>
          </div>
        </div>

        <div class="p-0 w-full">
          <div class="flex gap-2 items-center w-full">
            <input v-model="newMessage" @keydown.enter="sendChat" placeholder="Send a message..." class="flex-1 min-w-0 w-full px-3 py-2 rounded bg-[rgba(0,0,0,0.25)] text-gray-100" />
            <button @click="sendChat" class="flex-shrink-0 px-4 py-2 rounded bg-violet-500">SEND</button>
          </div>
        </div>
      </aside>

      <!-- Mobile chat toggle + panel -->
      <div class="md:hidden fixed bottom-0 left-0 right-0 z-30 flex flex-col">
        <button
          v-if="!showMobileChat"
          @click="showMobileChat = true"
          class="w-full bg-[#1a1a2e] border-t border-violet-500/20 py-3 flex items-center justify-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
          <span class="text-sm font-bold tracking-widest text-gray-300">CHAT{{ mobileUnreadCount > 0 ? ` (${mobileUnreadCount} NEW)` : '' }}</span>
        </button>

        <div v-else class="bg-[#0f0f0f] border-t border-violet-500/20 flex flex-col" style="height: 50vh">
          <div class="flex items-center justify-between px-4 py-2 border-b border-white/5">
            <p class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Chat</p>
            <button @click="showMobileChat = false" class="text-gray-500 hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          <div ref="mobileChat" class="flex-1 overflow-y-auto p-4 space-y-3">
            <div v-for="(m, i) in messages" :key="i">
              <p class="text-xs font-bold text-violet-300">{{ (m.local || String(m.senderId) === String(authStore.user?.id)) ? 'You' : (m.sender || m.displayName || 'Player') }}</p>
              <p class="text-sm text-gray-200 mt-0.5 break-words">{{ m.content || m.message }}</p>
            </div>
          </div>

          <div class="p-3 border-t border-white/5 flex gap-2">
            <input v-model="newMessage" @keydown.enter="sendChat" placeholder="Send a message..." class="flex-1 min-w-0 px-4 py-2 rounded-full bg-black/40 border border-white/10 text-gray-100 text-sm focus:outline-none" />
            <button @click="sendChat" class="flex-shrink-0 px-4 py-2 rounded-full font-bold text-sm bg-violet-600 text-white">SEND</button>
          </div>
        </div>
      </div>
      </div>
    </div>
  </div>

  <!-- Role Assigned Popup -->
  <RolePopup :role="myRole" :secret="mySecretWord" v-if="roomStore.rolePopupVisible" @dismiss="onRolePopupDismiss" />
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
