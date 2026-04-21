<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useRoomStore } from '../stores/room'
import Avatar from '../components/AvatarIcon.vue'
import EliminationPopup from '../components/EliminationPopup.vue'
import { useToast } from 'vue-toastification'
import * as voiceChat from '../services/voiceChatService.js'

const route = useRoute()
const router = useRouter()
const code = route.params.code || ''

const authStore = useAuthStore()
const roomStore = useRoomStore()
const toast = useToast()

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
  timeLeft,
  votedPlayers, voteCounts, isHost,
  eliminationPopupVisible, eliminationData,
  currentPlayer, resolveVotingInProgress,
  impostorIdForGuess
} = storeToRefs(roomStore)

const isEliminated = computed(() => !!(currentPlayer.value?.status === 'DEAD' || currentPlayer.value?.eliminated))
const isImpostorForGuess = computed(() => !!myUserId.value && !!impostorIdForGuess.value && String(myUserId.value) === String(impostorIdForGuess.value))

const impostorGuessWord = ref('')

function submitGuess() {
  if (!impostorGuessWord.value.trim()) return
  roomStore.guessSecretWord(impostorGuessWord.value.trim().toUpperCase())
  impostorGuessWord.value = ''
}

const newMessage = ref('')
const desktopChat = ref(null)
const mobileChat  = ref(null)
const micMuted = ref(false)
const showMobileChat    = ref(false)
const mobileUnreadCount = ref(0)
const clueInput        = ref('')
const myClueSubmitted  = ref(false)

const myUserId   = computed(() => authStore.user?.id)

const isMyTurn = computed(() => {
  const myId = myUserId.value
  return !!myId && currentTurnUserId.value === myId
})

const canResolveVoting = computed(() => {
  const totalAlive = alivePlayers.value.length || 0
  const votes = (votedPlayers.value && votedPlayers.value.length) || 0
  return isHost.value && !resolveVotingInProgress.value && totalAlive > 0 && votes === totalAlive
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

watch(displayPhase, (phase, oldPhase) => {
  if (phase === 'CLUE_SUBMISSION') {
    const id = myUserId.value
    if (!id || !playerClues.value?.[id]) myClueSubmitted.value = false
  }
  if (phase === 'DISCUSSION') {
    const id = myUserId.value
    if (id) {
      const peerIds = (players.value || [])
        .map(p => p?.id || p?.userId)
        .filter(pid => pid && pid !== id)
      voiceChat.init(code, String(id), peerIds)
    }
  } else if (oldPhase === 'DISCUSSION') {
    voiceChat.destroy()
    micMuted.value = false
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
        try { toast.error(msg || 'Could not join the room') } catch { /* void */}
        router.push({ name: 'home' })
      }
    }
  })()
})

onBeforeUnmount(() => {
  voiceChat.destroy()
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

function toggleMic() {
  micMuted.value = voiceChat.toggleMute()
}

function sendChat() {
  if (!newMessage.value.trim()) return
  roomStore.sendChat(newMessage.value.trim())
  newMessage.value = ''
}

function sendClue() {
  if (!clueInput.value.trim() || myClueSubmitted.value) return
  roomStore.submitClue(clueInput.value.trim().toUpperCase())
  myClueSubmitted.value = true
}

function castVoteFor(player) {
  const pid = player?.id || player?.userId
  if (!pid) return
  // disable if already voted or voting for self
  const alreadyVoted = votedPlayers.value && votedPlayers.value.includes(myUserId.value)
  if (alreadyVoted) return
  if (String(pid) === String(myUserId.value)) return
  roomStore.castVote(pid)
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
        <!-- Mute button (mobile) -->
        <button v-if="displayPhase === 'DISCUSSION'" @click="toggleMic" :title="micMuted ? 'Unmute mic' : 'Mute mic'"
          :class="['w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0',
            micMuted ? 'bg-red-700' : 'bg-white/10']">
          <svg v-if="!micMuted" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 10a7 7 0 01-14 0M12 19v4M8 23h8" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 16.95A7 7 0 015 10M19 10a7 7 0 01-.34 2.19M12 19v4M8 23h8" />
          </svg>
        </button>
      </div>

      <!-- User avatar (desktop) -->
      <div class="hidden md:flex items-center gap-2 flex-shrink-0">
        <!-- Mute button -->
        <button v-if="displayPhase === 'DISCUSSION'" @click="toggleMic" :title="micMuted ? 'Unmute mic' : 'Mute mic'"
          :class="['w-8 h-8 rounded-full flex items-center justify-center transition-colors',
            micMuted ? 'bg-red-700 hover:bg-red-600' : 'bg-white/10 hover:bg-white/20']">
          <svg v-if="!micMuted" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 10a7 7 0 01-14 0M12 19v4M8 23h8" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 16.95A7 7 0 015 10M19 10a7 7 0 01-.34 2.19M12 19v4M8 23h8" />
          </svg>
        </button>
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
      <template v-else-if="displayPhase === 'GUESSING_WORD'">
        GUESSING PHASE — The impostor has one last chance to guess the secret word!
      </template>
    </div>

    <!-- Voting controls (host + quick status) -->
    <div v-if="displayPhase === 'VOTING'" class="py-2 px-4">
      <div class="flex items-center justify-center gap-4">
        <div class="text-sm text-gray-300">Votes: {{ (votedPlayers && votedPlayers.length) || 0 }} / {{ alivePlayers.length }}</div>
        <button v-if="isHost" @click="roomStore.resolveVoting()" :disabled="!canResolveVoting" :class="['px-4 py-2 rounded-full font-bold transition', !canResolveVoting ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white']">RESOLVE VOTING</button>
      </div>
    </div>

    <div class="flex flex-1 min-h-0 overflow-hidden">

      <!-- Clues + Players -->
      <main class="flex-1 overflow-y-auto p-4 md:p-6 pb-28 md:pb-8">

        <!-- Guessing phase UI -->
        <div v-if="displayPhase === 'GUESSING_WORD'" class="mb-6">
          <div v-if="isImpostorForGuess"
            class="rounded-2xl bg-[#1a0d0d] border border-red-500/40 p-5 ring-2 ring-red-500/30">
            <p class="text-[10px] text-red-400 uppercase tracking-widest mb-1 font-bold">🎯 Final Chance</p>
            <p class="text-sm text-gray-300 mb-4">You've been eliminated! Guess the secret word to win the game for the impostors.</p>
            <div class="flex gap-2">
              <input
                v-model="impostorGuessWord"
                @keydown.enter="submitGuess"
                placeholder="Secret word…"
                maxlength="30"
                class="flex-1 px-4 py-2.5 rounded-full bg-black/40 border border-red-500/30 text-white uppercase tracking-widest font-bold text-sm focus:outline-none focus:border-red-400 placeholder:normal-case placeholder:font-normal placeholder:text-gray-600"
              />
              <button
                @click="submitGuess"
                :disabled="!impostorGuessWord.trim()"
                :class="['px-5 py-2 rounded-full font-bold text-sm transition-all',
                  impostorGuessWord.trim() ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-white/5 text-gray-600 cursor-not-allowed']"
              >GUESS</button>
            </div>
          </div>
          <div v-else
            class="rounded-2xl bg-white/[0.03] border border-white/5 p-5 flex items-center gap-3">
            <div class="w-2 h-2 rounded-full bg-red-400 animate-pulse flex-shrink-0"></div>
            <p class="text-sm text-gray-400">The impostor is making is <span class="text-white font-bold">final guess</span>. Waiting…</p>
          </div>
        </div>

        <!-- Clue submit form -->
        <div v-if="displayPhase === 'CLUE_SUBMISSION' && isMyTurn && !myClueSubmitted"
          class="mb-6 rounded-2xl bg-[#1a1a2e] border border-violet-500/30 p-4 ring-2 ring-violet-500/40">
          <p class="text-[10px] text-violet-400 uppercase tracking-widest mb-1 font-bold">⏱ Your turn! {{ timeLeft }}s left</p>
          <p class="text-[10px] text-gray-400 uppercase tracking-widest mb-3">
            {{ isImpostor
              ? 'Submit a hint — you don\'t know the secret word, try to blend in!'
              : 'Submit your one-word clue for the secret word' }}
          </p>
          <div class="flex gap-2">
            <input
              v-model="clueInput"
              @keydown.enter="sendClue"
              placeholder="One word…"
              maxlength="20"
              class="flex-1 px-4 py-2.5 rounded-full bg-black/40 border border-violet-500/30 text-white uppercase tracking-widest font-bold text-sm focus:outline-none focus:border-violet-400 placeholder:normal-case placeholder:font-normal placeholder:text-gray-600"
            />
            <button
              @click="sendClue"
              :disabled="!clueInput.trim()"
              :class="['px-5 py-2 rounded-full font-bold text-sm transition-all',
                clueInput.trim() ? 'bg-violet-500 text-white hover:bg-violet-600' : 'bg-white/5 text-gray-600 cursor-not-allowed']"
            >SUBMIT</button>
          </div>
        </div>

        <!-- Waiting banner -->
        <div v-else-if="displayPhase === 'CLUE_SUBMISSION' && !isMyTurn && currentTurnUserId"
          class="mb-6 rounded-2xl bg-white/[0.03] border border-white/5 p-4 flex items-center gap-3">
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
          <div
            v-for="player in alivePlayers"
            :key="player.id || player.userId"
            :class="[
              'flex items-center justify-between p-3 pr-4 rounded-xl border transition-all duration-200',
              isSelf(player)
                ? 'border-violet-500/40 bg-violet-950/20'
                : 'border-white/5 bg-white/[0.02]'
            ]"
          >
            <div class="flex items-center gap-3 min-w-0">
              <Avatar :name="player.displayName || player.username" :active="isSelf(player)" size="sm" class="flex-shrink-0" />
              <div class="min-w-0">
                <p class="font-bold text-sm leading-tight truncate">
                  {{ player.displayName || player.username }}
                  <span v-if="isSelf(player)" class="text-violet-400 font-normal text-xs"> (You)</span>
                </p>

              </div>
            </div>

            <!-- Voting UI or Clue pill -->
            <div v-if="displayPhase === 'VOTING'" class="ml-3 flex items-center gap-2">
              <div class="px-3 py-1 rounded-full bg-black/20 border border-white/10 text-xs font-bold">{{ (voteCounts[player.id] || voteCounts[player.userId] || 0) }}</div>
              <button
                @click="castVoteFor(player)"
                :disabled="isSelf(player) || (votedPlayers && votedPlayers.includes(myUserId))"
                :class="['px-3 py-1 rounded-full text-xs font-bold transition', (isSelf(player) || (votedPlayers && votedPlayers.includes(myUserId))) ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-violet-500 text-white hover:bg-violet-600']"
              >VOTE</button>
            </div>
            <div v-else :class="[
              'ml-3 flex-shrink-0 px-4 py-1.5 rounded-full border text-xs font-bold tracking-widest whitespace-nowrap transition-all',
              getClue(player)
                ? 'border-violet-500/50 text-violet-300 bg-violet-950/20'
                : 'border-white/10 text-gray-600'
            ]">
              {{ getClue(player) ? `"${getClue(player)}"` : '...' }}
            </div>
          </div>

          <!-- Dead players removed: elimination UI handled elsewhere -->
        </div>


      </main>

      <!-- ── RIGHT: Live Discussion (desktop) ── -->
      <aside class="hidden md:flex w-80 xl:w-96 flex-col bg-[#111] border-l border-white/5 flex-shrink-0">
        <div class="px-5 py-3 border-b border-white/5">
          <p class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Live Discussion</p>
        </div>

        <div ref="desktopChat" class="flex-1 overflow-y-auto p-4 space-y-4">
          <div v-for="(m, i) in messages" :key="i">
            <p class="text-xs font-bold text-violet-300 leading-tight">
              {{ (m.local || String(m.senderId) === String(myUserId)) ? 'You' : (m.sender || m.displayName || 'Player') }}
            </p>
            <p class="text-sm text-gray-200 mt-0.5 break-words leading-snug">{{ m.content || m.message }}</p>
          </div>
        </div>

        <div class="p-3 border-t border-white/5 flex gap-2">
          <input
            v-model="newMessage"
            @keydown.enter="sendChat"
            placeholder="Send a message…"
            class="flex-1 px-4 py-2.5 rounded-full bg-black/40 border border-white/10 text-gray-100 text-sm focus:outline-none focus:border-violet-500/50 placeholder:text-gray-600"
          />
          <button
            @click="sendChat"
            :disabled="isEliminated"
            :class="['px-4 py-2 rounded-full font-bold text-sm transition-colors', isEliminated ? 'bg-white/5 text-gray-600 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700 text-white']"
          >SEND</button>
        </div>
      </aside>
    </div>

    <div class="md:hidden fixed bottom-0 left-0 right-0 z-30 flex flex-col">
      <button
        v-if="!showMobileChat"
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

      <!-- Expanded chat panel -->
      <div v-else class="bg-[#0f0f0f] border-t border-violet-500/20 flex flex-col" style="height: 50vh">
        <div class="flex items-center justify-between px-4 py-2 border-b border-white/5">
          <p class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Live Discussion</p>
          <button @click="showMobileChat = false" class="text-gray-500 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div ref="mobileChat" class="flex-1 overflow-y-auto p-4 space-y-3">
          <div v-for="(m, i) in messages" :key="i">
            <p class="text-xs font-bold text-violet-300">
              {{ (m.local || String(m.senderId) === String(myUserId)) ? 'You' : (m.sender || m.displayName || 'Player') }}
            </p>
            <p class="text-sm text-gray-200 mt-0.5 break-words">{{ m.content || m.message }}</p>
          </div>
        </div>

        <div class="p-3 border-t border-white/5 flex gap-2">
          <input
            v-model="newMessage"
            @keydown.enter="sendChat"
            placeholder="Send a message…"
            class="flex-1 px-4 py-2 rounded-full bg-black/40 border border-white/10 text-gray-100 text-sm focus:outline-none"
          />
          <button @click="sendChat" :disabled="isEliminated" :class="['px-4 py-2 rounded-full font-bold text-sm', isEliminated ? 'bg-white/5 text-gray-600 cursor-not-allowed' : 'bg-violet-600 text-white']">SEND</button>
        </div>
      </div>
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
            @click="router.push({ name: 'login' })"
            :class="['mt-4 w-full py-4 rounded-full font-bold text-white tracking-widest',
              gameWinner === 'CREWMATES_WIN'
                ? 'bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600'
                : 'bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800']"
          >CLOSE</button>
        </div>
      </div>
    </Teleport>

    <EliminationPopup
      v-if="eliminationPopupVisible"
      :eliminated-name="eliminationData?.eliminatedName || null"
      :eliminated-role="eliminationData?.eliminatedRole || null"
      :is-tie="eliminationData?.isTie || false"
      @dismiss="roomStore.dismissElimination()"
    />

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
</style>
