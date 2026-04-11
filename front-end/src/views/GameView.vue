<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useRoomStore } from '../stores/room'
import Avatar from '../components/AvatarIcon.vue'
import ClueSubmit from '../components/ClueSubmit.vue'
import PlayerCard from '../components/PlayerCard.vue'
import ChatPanel from '../components/ChatPanel.vue'

const route = useRoute()
const router = useRouter()
const code = route.params.code || ''

const authStore = useAuthStore()
const roomStore = useRoomStore()

const {
  players,
  messages,
  gameWinner,
  myRole,
  mySecretWord,
  playerClues,
  currentTurnUserId,
  displayPhase,
  rolePopupVisible,
  timeLeft
} = storeToRefs(roomStore)

const showMobileChat = ref(false)
const mobileUnreadCount = ref(0)
const clueInput        = ref('')
const myClueSubmitted  = ref(false)

const myUserId   = computed(() => authStore.user?.id)

const isMyTurn = computed(() => {
  const myId = myUserId.value
  return !!myId && currentTurnUserId.value === myId
})


watch(playerClues, (newClues) => {
  try {
    const id = myUserId.value
    if (!id) return
    if (newClues && newClues[id]) myClueSubmitted.value = true
  } catch { /* void */ }
}, { deep: true })

watch(rolePopupVisible, (visible) => {
  if (visible) return
  try {
    const id = myUserId.value
    if (id && playerClues.value && playerClues.value[id]) myClueSubmitted.value = true
  } catch { /* void */ }
})

// Chat scrolling and unread logic moved into ChatPanel component

onMounted(() => {
  (async () => {
    try {
      if (code) {
        await roomStore.join(code)
        roomStore.markAsJoined()
      } else {
        roomStore.initWS(code)
      }
    } catch (e) {
      const msg = e?.message || ''
      if (typeof msg === 'string' && msg.includes('Cannot join room')) {
        console.warn('[GameView] HTTP join rejected, attempting WS-only reconnect:', msg)
        try {
          roomStore.initWS(code)
        } catch (err) {
          console.warn('[GameView] initWS failed', err)
        }
        try { roomStore.markAsJoined() } catch (err) { console.warn(err) }
      } else {
        try { alert(msg || 'Could not join the room') } catch { /* void */}
        router.push({ name: 'home' })
      }
    }
  })()
})

onBeforeUnmount(() => {
  roomStore.leave()
})

const isImpostor = computed(() => myRole.value === 'IMPOSTOR')

const alivePlayers = computed(() =>
  players.value.filter(p => p && p.status !== 'DEAD' && !p.eliminated)
)

function getClue(player) {
  const uid = player?.id || player?.userId
  return uid ? (playerClues.value[uid] || null) : null
}

function isSelf(player) {
  const uid = player?.id || player?.userId
  return uid && uid === myUserId.value
}

function sendChat(msg) {
  if (!msg || !msg.trim()) return
  roomStore.sendChat(msg.trim())
}

function sendClue() {
  if (!clueInput.value.trim() || myClueSubmitted.value) return
  roomStore.submitClue(clueInput.value.trim().toUpperCase())
  myClueSubmitted.value = true
}

function timerColor(t) {
  if (t <= 0) return 'bg-gray-700'
  if (t <= 10) return 'bg-red-600'
  if (t <= 30) return 'bg-orange-500'
  return 'bg-red-500'
}
</script>

<template>
  <div class="min-h-screen bg-[#0d0d0d] text-gray-100 flex flex-col select-none">

      <!-- ═══════════ HEADER ═══════════ -->
    <header class="sticky top-0 z-40 bg-[#111] border-b border-white/5 px-4 md:px-8 py-3 flex items-center justify-between gap-4">

      <div class="flex items-center gap-4">
        <router-link to="/">
          <img src="/logo.png" alt="The Impostor" class="h-10 md:h-14 object-contain" />
        </router-link>
      </div>

      <!-- Desktop: role | divider | secret word -->
      <div class="hidden md:flex items-center gap-6 flex-1">
        <div>
          <p class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Your Role</p>
          <p :class="['text-base font-extrabold tracking-widest', isImpostor ? 'text-red-400' : 'text-violet-400']">
            {{ myRole || '—' }}
          </p>
        </div>
        <div class="w-px h-8 bg-white/10"></div>
        <div>
          <p class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Secret Word</p>
          <p :class="['text-base font-extrabold tracking-widest', isImpostor ? 'text-red-300' : 'text-white']">
            {{ mySecretWord || '—' }}
          </p>
        </div>
      </div>

      <!-- Mobile: role | timer | secret word -->
      <div class="flex md:hidden items-center justify-between flex-1 gap-2">
        <div>
          <p class="text-[9px] text-gray-500 uppercase tracking-widest">Your Role</p>
          <p :class="['text-sm font-extrabold tracking-widest', isImpostor ? 'text-red-400' : 'text-violet-400']">
            {{ myRole || '—' }}
          </p>
        </div>
        <!-- Timer circle (mobile) -->
        <div v-if="displayPhase"
          :class="['w-14 h-14 rounded-full flex items-center justify-center text-white font-extrabold text-xl flex-shrink-0 transition-colors', timerColor(timeLeft), timeLeft <= 5 && timeLeft > 0 ? 'animate-pulse' : '']">
          {{ timeLeft }}
        </div>
        <div v-else class="w-14 h-14 flex-shrink-0"></div>
        <div class="text-right">
          <p class="text-[9px] text-gray-500 uppercase tracking-widest">Secret Word</p>
          <p :class="['text-sm font-extrabold tracking-widest', isImpostor ? 'text-red-300' : 'text-white']">
            {{ mySecretWord || '—' }}
          </p>
        </div>
        <Avatar :name="authStore.user?.username || authStore.user?.name || 'P'" :active="true" size="sm" class="flex-shrink-0" />
      </div>

      <!-- User avatar (desktop) -->
      <div class="hidden md:flex items-center gap-2 flex-shrink-0">
        <span class="text-xs text-gray-400 font-semibold truncate max-w-[120px]">{{ authStore.user?.username || authStore.user?.name || 'Player' }}</span>
        <Avatar :name="authStore.user?.username || authStore.user?.name || 'P'" :active="true" size="sm" />
      </div>

      <!-- Timer circle (desktop) -->
      <div v-if="displayPhase"
        :class="['hidden md:flex w-16 h-16 rounded-full items-center justify-center text-white font-extrabold text-2xl flex-shrink-0 transition-colors', timerColor(timeLeft), timeLeft <= 5 && timeLeft > 0 ? 'animate-pulse' : '']">
        {{ timeLeft }}
      </div>
    </header>

    <!-- Phase banner -->
    <div :class="['text-center py-1.5 text-[11px] font-bold tracking-widest uppercase',
      displayPhase === 'DISCUSSION' ? 'bg-blue-900/30 text-blue-300'
      : 'bg-violet-900/30 text-violet-400']">
      <template v-if="displayPhase === 'CLUE_SUBMISSION' || !displayPhase">
        CLUE SUBMISSION
        <span v-if="isMyTurn" class="text-yellow-300"> — Your turn! Submit your word</span>
        <span v-else class="opacity-70"> — Waiting for players to submit their clue</span>
      </template>
      <template v-else-if="displayPhase === 'DISCUSSION'">
        DISCUSSION PHASE — All clues revealed, discuss with your team!
      </template>
    </div>

    <div class="flex flex-1 min-h-0 overflow-hidden">

      <!-- Clues + Players -->
      <main class="flex-1 overflow-y-auto p-4 md:p-6 pb-28 md:pb-8">

        <!-- Clue submit form -->
        <ClueSubmit
          v-if="displayPhase === 'CLUE_SUBMISSION' && isMyTurn && !myClueSubmitted"
          :modelValue="clueInput"
          @update:clue="clueInput = $event"
          :isImpostor="isImpostor"
          :timeLeft="timeLeft"
          :disabled="myClueSubmitted"
          @submit="sendClue"
        />

        <!-- Waiting banner -->
        <div v-else-if="displayPhase === 'CLUE_SUBMISSION' && !isMyTurn && currentTurnUserId"
          class="mb-6 card pop-in rounded-2xl bg-white/[0.03] border border-white/5 p-4 flex items-center gap-3">
          <div class="w-2 h-2 rounded-full bg-violet-400 animate-pulse flex-shrink-0"></div>
          <p class="text-sm text-gray-400">
            Waiting for
            <span class="text-white font-bold">
              {{ alivePlayers.find(p => (p.id || p.userId) === currentTurnUserId)?.displayName
                || alivePlayers.find(p => (p.id || p.userId) === currentTurnUserId)?.username
                || 'a player' }}
            </span>
            to submit their clue…
          </p>
        </div>

        <!-- Clues label -->
        <p class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-4">Clues</p>

        <!-- Alive player cards -->
        <div class="space-y-3">
          <PlayerCard
            v-for="player in alivePlayers"
            :key="player.id || player.userId"
            :player="player"
            :isSelf="isSelf(player)"
            :clue="getClue(player)"
          />
        </div>


      </main>

      <!-- Chat panel -->
      <ChatPanel
        :messages="messages"
        :myUserId="myUserId"
        v-model="showMobileChat"
        @send="sendChat"
        @unread-change="mobileUnreadCount = $event"
      />
    </div>

    <div class="md:hidden fixed bottom-0 left-0 right-0 z-30 flex flex-col">
      <button
        @click="showMobileChat = true"
        class="w-full bg-[#1a1a2e] border-t border-violet-500/20 py-4 flex items-center justify-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
        </svg>
        <span class="text-sm font-bold tracking-widest text-gray-300">
          DISCUSSION{{ mobileUnreadCount > 0 ? ` (${mobileUnreadCount} NEW MESSAGES)` : '' }}
        </span>
      </button>
    </div>

    <Teleport to="body">
      <div v-if="gameWinner"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div class="bg-[#121212] rounded-2xl p-8 max-w-sm w-full mx-4 border border-white/10 text-center flex flex-col items-center gap-4 shadow-2xl pop-in">
          <div class="text-6xl">{{ gameWinner === 'CREWMATES_WIN' ? '🛡️' : '💀' }}</div>
          <h2 :class="['text-2xl font-extrabold tracking-widest',
            gameWinner === 'CREWMATES_WIN' ? 'text-violet-300' : 'text-red-400']">
            {{ gameWinner === 'CREWMATES_WIN' ? 'CREWMATES WIN!' : 'IMPOSTOR WINS!' }}
          </h2>
          <p class="text-sm text-gray-400">The game has ended.</p>
          <button
            @click="router.push({ name: 'home' })"
            :class="['mt-4 w-full py-4 rounded-full font-bold text-white tracking-widest',
              gameWinner === 'CREWMATES_WIN'
                ? 'bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600'
                : 'bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800']"
          >BACK TO HOME</button>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<style scoped>
.slide-notif-enter-active,
.slide-notif-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.slide-notif-enter-from,
.slide-notif-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}

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
