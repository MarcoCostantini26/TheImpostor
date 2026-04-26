import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import * as wsService from '../services/wsService'
import * as roomService from '../services/roomService'
import { useAuthStore } from './auth'
import { matchesId, findPlayerById } from '../helpers/player'

export const useRoomStore = defineStore('room', () => {
  const players = ref([])
  const messages = ref([])
  const impostors = ref(1)
  const discussionTime = ref(60)
  const loading = ref(false)
  const error = ref(null)
  const roomStatus = ref(null)
  const roomHostId = ref(null)
  const myRole = ref(null)       // 'CREWMATE' | 'IMPOSTOR' | null
  const mySecretWord = ref(null) 

  const gamePhase = ref(null)        // 'DISCUSSION' | 'VOTING' | null
  const gameWinner = ref(null)       // 'CREWMATES_WIN' | 'IMPOSTOR_WINS' | null
  const votedPlayers = ref([])       
  const lastEliminatedId = ref(null)
  const voteCounts = ref({})         
  const votedBy = ref({})           
  const rolePopupVisible = ref(false)
  const playerClues = ref({})         

  const currentTurnUserId = ref(null)
  const turnSeconds = ref(15)         
  const allCluesSubmitted = ref(false) 

  const displayPhase = ref(null)        // 'CLUE_SUBMISSION' | 'DISCUSSION' | 'VOTING' | null
  const discussionFreeSeconds = ref(60) 
  const timeLeft = ref(0)               
  let _timerInterval = null              
  let _pendingTimerSeconds = 0           
  let _joinedViaHome = false

  const eliminationPopupVisible = ref(false)
  const eliminationData = ref(null)    
  const resolveVotingInProgress = ref(false)
  const impostorIdForGuess = ref(null)  

  let unsubscribe = null
  let currentRoomCode = null
  const STORAGE_PREFIX = 'theimpostor:chat:'
  const ROLE_STORAGE_PREFIX = 'theimpostor:role:'
  const MAX_PERSISTED = 200

  const authStore = useAuthStore()

  function startTimer(seconds) {
    stopTimer('startTimer:clear')
    timeLeft.value = Math.max(0, Math.round(seconds))
    if (timeLeft.value <= 0) return
    _timerInterval = setInterval(() => {
      if (timeLeft.value > 0) {
        timeLeft.value--
      } else stopTimer('expired')
    }, 1000)
  }

  function stopTimer() {
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null }
    timeLeft.value = 0
  }

  const currentPlayer = computed(() => {
    const uidCandidates = [authStore.user?.id, authStore.user?._id, authStore.user?.userId].filter(Boolean)
    const username = authStore.user?.username || authStore.user?.name || null

    if (!players.value || players.value.length === 0) return null

    return players.value.find((p) => {
      if (!p) return false
      if (uidCandidates.some((id) => matchesId(p, id))) return true
      if (username && (p.username === username || p.displayName === username)) return true
      if (typeof p === 'string' && username && p === username) return true
      return false
    }) || null
  })

  const isHost = computed(() => {
    const myIds = [authStore.user?.id, authStore.user?._id, authStore.user?.userId].filter(Boolean)
    const cp = currentPlayer.value
    const lobbyId = cp?.id || cp?.userId || null
    const allIds = [...new Set([...myIds, ...(lobbyId ? [lobbyId] : [])])]

    if (allIds.length === 0) return false

    if (roomHostId.value) {
      return allIds.some((id) => id === roomHostId.value)
    }

    if (cp) {
      if (cp.host) return true
      return allIds.some((id) => matchesId(cp, id))
    }

    return false
  })

  function upsertPlayer(incoming) {
    if (!incoming) return
    const incomingId = incoming.id || incoming.userId
    const idx = players.value.findIndex((pl) => {
      if (!pl) return false
      if (incomingId && matchesId(pl, incomingId)) return true
      return pl.username && incoming.username && pl.username === incoming.username
    })
    if (idx !== -1) {
      const existing = players.value[idx]
      const merged = { ...existing, ...incoming }
      if (existing.status === 'DEAD' || existing.eliminated) {
        merged.status = 'DEAD'
        merged.eliminated = true
      }
      players.value.splice(idx, 1, merged)
    } else {
      players.value.push(incoming)
    }
  }

  function mergePlayersPreserveDeadStatus(incoming) {
    if (!Array.isArray(incoming)) return incoming
    return incoming.map(p => {
      if (!p) return p
      const pid = p.id || p.userId
      const existing = pid ? findPlayerById(players.value, pid) : null
      if (existing && (existing.status === 'DEAD' || existing.eliminated)) {
        return { ...p, status: 'DEAD', eliminated: true }
      }
      return p
    })
  }

  function removePlayerById(id) {
    if (!id) return
    players.value = players.value.filter((pl) => !(pl && matchesId(pl, id)))
  }

  // --- WS action handlers ---

  function onRoomUpdate(payload) {
    players.value = mergePlayersPreserveDeadStatus(payload.players || payload.room?.players || [])
    roomStatus.value = payload.room?.status || payload.status || null
    roomHostId.value = payload.room?.hostId || payload.hostId || null
  }

  function onPlayerJoined(payload) {
    upsertPlayer(payload.player || payload.user || payload)
  }

  function onPlayerReady(payload) {
    const id = payload.userId || payload.playerId || payload.senderId || (payload.player && (payload.player.id || payload.player.userId))
    const ready = payload.ready ?? payload.isReady ?? (payload.player && payload.player.ready)
    if (id) {
      const idx = players.value.findIndex(pl => matchesId(pl, id))
      if (idx !== -1) players.value.splice(idx, 1, { ...players.value[idx], ready })
    } else if (payload.username) {
      players.value = players.value.map(p => (p && (p.username === payload.username || p.displayName === payload.username)) ? { ...p, ready } : p)
    }
  }

  function onPlayerLeft(payload) {
    const id = payload.userId || payload.playerId || payload.id
    const uname = payload.username || payload.user || payload.displayName
    if (id) removePlayerById(id)
    else if (uname) players.value = players.value.filter((pl) => !(pl && (pl.username === uname || pl.displayName === uname)))
  }

  function onSettingsUpdate(payload) {
    const settings = payload.settings || payload || {}
    if (settings.impostors !== undefined) impostors.value = settings.impostors
    if (settings.discussionTime !== undefined) discussionTime.value = settings.discussionTime
  }

  function onChatMessage(msg, payload) {
    const p = payload || {}
    const senderId = p.senderId || p.userId || p.fromId || p.from || null
    let senderName = p.sender || p.displayName || p.username || p.from || null
    if (!senderName && senderId) {
      const pl = findPlayerById(players.value, senderId)
      if (pl) senderName = pl.username || pl.displayName || (typeof pl === 'string' ? pl : null)
    }
    if (!senderName) senderName = p.username || p.displayName || senderId || 'Player'
    messages.value.push({
      sender: senderName,
      senderId: senderId || null,
      content: p.content || p.message || '',
      timestamp: p.timestamp || new Date().toISOString(),
      _raw: p
    })
    messages.value = messages.value.slice(-MAX_PERSISTED)
  }

  function onGameStarted() {
    roomStatus.value = 'STARTED'
    gamePhase.value = 'DISCUSSION'
    displayPhase.value = 'CLUE_SUBMISSION'
  }

  function onClueSubmitted(payload) {
    const uid = payload.userId || payload.senderId
    const clue = payload.clue || ''
    if (uid && clue) playerClues.value = { ...playerClues.value, [uid]: clue }
    try { stopTimer() } catch { /* void */ }
    _pendingTimerSeconds = 0
  }

  function onCluesState(msg) {
    const clues = (msg.payload || {}).clues || {}
    playerClues.value = { ...playerClues.value, ...clues }
  }

  function onPlayersStatus(msg) {
    const aliveIds = ((msg.payload || {}).alivePlayerIds || []).map(String)
    if (aliveIds.length > 0) {
      players.value = players.value.map(player => {
        if (!player) return player
        const pid = player.id || player.userId
        if (!pid) return player
        return aliveIds.includes(String(pid))
          ? { ...player, status: 'ALIVE' }
          : { ...player, status: 'DEAD', eliminated: true }
      })
    }
  }

  function onTurnStarted(msg) {
    const p = msg.payload || {}
    const fullSecs = p.fullSeconds || p.seconds || 15
    turnSeconds.value = fullSecs
    displayPhase.value = 'CLUE_SUBMISSION'
    currentTurnUserId.value = p.yourTurn ? (useAuthStore().user?.id || null) : (p.activePlayerId || null)
    _pendingTimerSeconds = 0
    if (p.expiresAt) {
      const expiresTs = typeof p.expiresAt === 'number' ? p.expiresAt : Date.parse(p.expiresAt)
      startTimer(Math.max(0, Math.ceil((expiresTs - Date.now()) / 1000)))
    } else {
      startTimer(fullSecs)
    }
  }

  function onDiscussionPhaseStarted(msg) {
    const p = msg.payload || {}
    allCluesSubmitted.value = true
    currentTurnUserId.value = null
    discussionFreeSeconds.value = p.seconds || 60
    displayPhase.value = 'DISCUSSION'
    if (p.expiresAt) {
      const expiresTs = typeof p.expiresAt === 'number' ? p.expiresAt : Date.parse(p.expiresAt)
      startTimer(Math.max(0, Math.ceil((expiresTs - Date.now()) / 1000)))
    } else {
      startTimer(p.seconds || 60)
    }
  }

  // --- ENGINE_EVENT handlers ---

  function onRoleAssigned(ep) {
    myRole.value = ep.role || null
    mySecretWord.value = ep.secretWord || null
    rolePopupVisible.value = true
    try {
      if (currentRoomCode) {
        sessionStorage.setItem(ROLE_STORAGE_PREFIX + currentRoomCode, JSON.stringify({ role: myRole.value, secretWord: mySecretWord.value }))
      }
    } catch { /* void */ }
  }

  function onPhaseChanged(ep) {
    gamePhase.value = ep.newPhase || null
    if (ep.newPhase === 'VOTING') {
      votedPlayers.value = []
      voteCounts.value = {}
      votedBy.value = {}
      displayPhase.value = 'VOTING'
      if (ep.expiresAt) {
        const expiresTs = typeof ep.expiresAt === 'number' ? ep.expiresAt : Date.parse(ep.expiresAt)
        startTimer(Math.max(0, Math.ceil((expiresTs - Date.now()) / 1000)))
      } else {
        startTimer(ep.timer || 60)
      }
    }
  }

  function onPlayerVoted(ep) {
    const voter = ep.voterId
    const target = ep.targetId || null
    if (!voter) return
    if (!votedPlayers.value.includes(voter)) votedPlayers.value = [...votedPlayers.value, voter]
    const prev = votedBy.value[voter]
    if (prev) voteCounts.value = { ...voteCounts.value, [prev]: Math.max(0, (voteCounts.value[prev] || 0) - 1) }
    if (target) {
      voteCounts.value = { ...voteCounts.value, [target]: (voteCounts.value[target] || 0) + 1 }
      votedBy.value = { ...votedBy.value, [voter]: target }
    }
  }

  function onVotingResolved(ep) {
    resolveVotingInProgress.value = false
    const eliminated = ep.eliminatedId || ''
    lastEliminatedId.value = eliminated || null
    gamePhase.value = 'DISCUSSION'
    displayPhase.value = 'CLUE_SUBMISSION'
    currentTurnUserId.value = null
    votedPlayers.value = []
    voteCounts.value = {}
    votedBy.value = {}
    playerClues.value = {}
    allCluesSubmitted.value = false
    stopTimer()
    if (eliminated) {
      const eliminatedPlayer = findPlayerById(players.value, eliminated)
      players.value = players.value.map(p => {
        if (!p) return p
        return matchesId(p, eliminated) ? { ...p, status: 'DEAD', eliminated: true } : p
      })
      eliminationData.value = {
        eliminatedId: eliminated,
        eliminatedName: eliminatedPlayer?.username || eliminatedPlayer?.displayName || eliminated,
        eliminatedRole: ep.eliminatedRole || null,
        isTie: false
      }
    } else {
      eliminationData.value = { eliminatedId: null, eliminatedName: null, eliminatedRole: null, isTie: true }
    }
    eliminationPopupVisible.value = true
  }

  function onImpostorGuessPhase(ep) {
    resolveVotingInProgress.value = false
    const impostorId = ep.impostorId || ep.ImpostorId || null
    impostorIdForGuess.value = impostorId
    gamePhase.value = 'GUESSING_WORD'
    displayPhase.value = 'GUESSING_WORD'
    votedPlayers.value = []
    voteCounts.value = {}
    votedBy.value = {}
    stopTimer()
    if (impostorId) {
      players.value = players.value.map(p => {
        if (!p) return p
        return matchesId(p, impostorId) ? { ...p, status: 'DEAD', eliminated: true } : p
      })
    }
  }

  function onPlayerEliminated(ep) {
    if (!ep.playerId) return
    players.value = players.value.map(p => {
      if (!p) return p
      return matchesId(p, ep.playerId) ? { ...p, status: 'DEAD', eliminated: true } : p
    })
  }

  function onGameEnded(ep) {
    gameWinner.value = ep.winner || null
    roomStatus.value = 'ENDED'
  }

  const engineEventHandlers = {
    RoleAssigned: onRoleAssigned,
    PhaseChanged: onPhaseChanged,
    PlayerVoted: onPlayerVoted,
    VotingResolved: onVotingResolved,
    ImpostorGuessPhase: onImpostorGuessPhase,
    PlayerEliminated: onPlayerEliminated,
    GameEnded: onGameEnded,
  }

  const actionHandlers = {
    room_update: onRoomUpdate, room_state: onRoomUpdate, 'room:updated': onRoomUpdate,
    player_joined: onPlayerJoined, player_join: onPlayerJoined, joined: onPlayerJoined,
    player_ready: onPlayerReady, PLAYER_READY: onPlayerReady, toggle_ready: onPlayerReady,
    player_left: onPlayerLeft, left: onPlayerLeft, player_removed: onPlayerLeft,
    update_settings: onSettingsUpdate, UPDATE_SETTINGS: onSettingsUpdate, 'settings:update': onSettingsUpdate,
    game_started: onGameStarted, GAME_STARTED: onGameStarted,
    clue_submitted: onClueSubmitted,
  }

  function handleIncoming(msg) {
    const payload = msg.payload || msg || {}
    const action = payload.action || msg.type || payload.type

    if (payload.room && Array.isArray(payload.room.players)) { onRoomUpdate(payload); return }
    if (Array.isArray(payload.players)) { onRoomUpdate(payload); return }

    if (msg.type === 'CHAT' || action === 'chat_message' || payload.type === 'CHAT') { onChatMessage(msg, payload); return }
    if (msg.type === 'clues_state') { onCluesState(msg); return }
    if (msg.type === 'players_status') { onPlayersStatus(msg); return }
    if (msg.type === 'turn_started') { onTurnStarted(msg); return }
    if (msg.type === 'discussion_phase_started') { onDiscussionPhaseStarted(msg); return }
    if (action === 'clue_submitted' || msg.type === 'clue_submitted') { onClueSubmitted(payload); return }
    if (msg.type === 'ENGINE_EVENT') { const ep = msg.payload || {}; engineEventHandlers[ep.eventName]?.(ep); return }

    actionHandlers[action]?.(payload)
  }

  function initWS(roomCode) {
    currentRoomCode = roomCode
    wsService.connect()
    if (authStore.user?.id) {
      wsService.send({ type: 'IDENTIFY', payload: { userId: authStore.user.id } })
    }
    if (unsubscribe) unsubscribe()
    unsubscribe = wsService.onMessage(handleIncoming)
  }

  function resolveGuestId(playersList, displayName) {
    if (!playersList || !authStore.user?.guest) return
    const me = playersList.find(p => p.username === displayName)
    if (me?.id) authStore.setUserId(me.id)
  }

  function markAsJoined() {
    _joinedViaHome = true
  }

  async function join(roomCode) {
    loading.value = true
    error.value = null
    const alreadyJoined = _joinedViaHome
    _joinedViaHome = false
    try {
      const displayName = authStore.user?.username || authStore.user?.name || 'Guest'

      if (!alreadyJoined) {
        try {
          const joinResult = await roomService.joinRoom(roomCode, displayName, authStore.user?.id || null, !!authStore.user?.id)
          resolveGuestId(joinResult?.players, displayName)
        } catch (joinErr) {
          console.warn('[room] HTTP join failed, falling back to WS join:', joinErr?.message || joinErr)
        }
      }

      try {
        const room = await roomService.getRoom(roomCode)
        players.value = room.players || []
        roomStatus.value = room.status || room.state || null
        roomHostId.value = room.hostId || room.hostUserId || room.creatorId || null
        if (room.impostors !== undefined) impostors.value = room.impostors
        if (room.discussionTime !== undefined) discussionTime.value = room.discussionTime
        resolveGuestId(room.players, displayName)
      } catch (getErr) {
        console.warn('[room] getRoom failed, will proceed with WS join and expect server to push state', getErr?.message || getErr)
      }

      initWS(roomCode)
      wsService.sendEvent('join_room', { roomCode, userId: authStore.user?.id, username: displayName })

      try {
        const raw = localStorage.getItem(STORAGE_PREFIX + roomCode)
        const parsed = raw ? JSON.parse(raw) : []
        messages.value = Array.isArray(parsed) ? parsed.slice(-MAX_PERSISTED) : []
      } catch {
        messages.value = []
      }

      if (!myRole.value) {
        try {
          const roleRaw = sessionStorage.getItem(ROLE_STORAGE_PREFIX + roomCode)
          if (roleRaw) {
            const saved = JSON.parse(roleRaw)
            if (saved.role) myRole.value = saved.role
            if (saved.secretWord) mySecretWord.value = saved.secretWord
          }
        } catch { /* void */ }
      }
    } catch (e) {
      error.value = e.message || 'Join failed'
      throw e
    } finally {
      loading.value = false
    }
  }

  function leave() {
    if (unsubscribe) unsubscribe()
    unsubscribe = null
    if (currentRoomCode) {
      wsService.sendEvent('leave_room', { roomCode: currentRoomCode, userId: authStore.user?.id })
      const code = currentRoomCode
      const pid = authStore.user?.id
      if (pid) {
        roomService.leaveRoom(code, pid).catch(() => {})
      }
      authStore.clearGuestId()
    }
    players.value = []
    messages.value = []
    roomStatus.value = null
    roomHostId.value = null
    myRole.value = null
    mySecretWord.value = null
    if (currentRoomCode) {
      try { sessionStorage.removeItem(ROLE_STORAGE_PREFIX + currentRoomCode) } catch { /* void */ }
    }
    gamePhase.value = null
    gameWinner.value = null
    votedPlayers.value = []
    lastEliminatedId.value = null
    rolePopupVisible.value = false
    eliminationPopupVisible.value = false
    eliminationData.value = null
    resolveVotingInProgress.value = false
    impostorIdForGuess.value = null
    playerClues.value = {}
    currentTurnUserId.value = null
    allCluesSubmitted.value = false
    displayPhase.value = null
    discussionFreeSeconds.value = 60
    stopTimer()
    _pendingTimerSeconds = 0
    currentRoomCode = null
  }

  function startGame() {
    if (!currentRoomCode) return
    const hostId = currentPlayer.value?.id || roomHostId.value || authStore.user?.id
    wsService.sendEvent('start_game', { roomCode: currentRoomCode, hostId })
  }

  function toggleReady() {
    const p = currentPlayer.value
    if (!p) return
    const newReady = !p.ready
    p.ready = newReady
    wsService.sendEvent('player_ready', { roomCode: currentRoomCode, ready: newReady, userId: authStore.user?.id, username: authStore.user?.username })
  }

  function sendChat(content) {
    if (!currentRoomCode || !content) return
    const _me = currentPlayer.value
    if (_me && (_me.status === 'DEAD' || _me.eliminated)) return
    try {
      const senderName = authStore.user?.username || authStore.user?.name || 'You'
      messages.value.push({ sender: senderName, content, senderId: authStore.user?.id, local: true, timestamp: new Date().toISOString() })
      messages.value = messages.value.slice(-MAX_PERSISTED)
    } catch {
      // void
    }
    const payload = { content, username: authStore.user?.username || authStore.user?.name }
    wsService.send({ type: 'CHAT', roomId: currentRoomCode, ...payload })
  }

  try {
    watch(messages, (newVal) => {
      try {
        if (!currentRoomCode) return
        const toStore = (newVal || []).slice(-MAX_PERSISTED)
        localStorage.setItem(STORAGE_PREFIX + currentRoomCode, JSON.stringify(toStore))
      } catch {
        // void
      }
    }, { deep: true })
  } catch {
    // void
  }

  function setDiscussionTime(val) {
    if (![30, 60, 90].includes(val)) return
    if (!isHost.value) return
    discussionTime.value = val
    if (currentRoomCode) wsService.sendEvent('update_settings', { roomCode: currentRoomCode, settings: { impostors: impostors.value, discussionTime: discussionTime.value } })
  }

  function decrementImpostors() {
    if (!isHost.value) return
    impostors.value = Math.max(1, impostors.value - 1)
    if (currentRoomCode) wsService.sendEvent('update_settings', { roomCode: currentRoomCode, settings: { impostors: impostors.value, discussionTime: discussionTime.value } })
  }

  function incrementImpostors() {
    if (!isHost.value) return
    impostors.value = Math.min(2, impostors.value + 1)
    if (currentRoomCode) wsService.sendEvent('update_settings', { roomCode: currentRoomCode, settings: { impostors: impostors.value, discussionTime: discussionTime.value } })
  }

  function castVote(targetId) {
    if (!currentRoomCode) return
    const voterId = authStore.user?.id
    if (!voterId) return
    wsService.send({ type: 'EVENT', payload: { action: 'CAST_VOTE', gameId: currentRoomCode, targetId: targetId || '' } })
  }

  function advanceToVoting() {
    if (!currentRoomCode) return
    wsService.send({ type: 'EVENT', payload: { action: 'ADVANCE_PHASE', gameId: currentRoomCode } })
  }

  function resolveVoting() {
    if (!currentRoomCode || resolveVotingInProgress.value) return
    resolveVotingInProgress.value = true
    wsService.send({ type: 'EVENT', payload: { action: 'RESOLVE_VOTING', gameId: currentRoomCode } })
  }

  function submitClue(clueWord) {
    if (!currentRoomCode || !clueWord) return
    const uid = authStore.user?.id
    if (uid) playerClues.value = { ...playerClues.value, [uid]: clueWord }
    wsService.sendEvent('submit_clue', {
      roomCode: currentRoomCode,
      clue: clueWord,
      username: authStore.user?.username || authStore.user?.name
    })
  }

  function dismissRole() {
    rolePopupVisible.value = false
    if (_pendingTimerSeconds > 0) {
      startTimer(_pendingTimerSeconds)
      _pendingTimerSeconds = 0
    }
  }

  function dismissElimination() {
    eliminationPopupVisible.value = false
  }

  function guessSecretWord(word) {
    if (!currentRoomCode || !word) return
    wsService.send({ type: 'EVENT', payload: { action: 'GUESS_WORD', gameId: currentRoomCode, guessedWord: word } })
  }

  return {
    players,
    messages,
    impostors,
    discussionTime,
    loading,
    error,
    roomStatus,
    roomHostId,
    myRole,
    mySecretWord,
    gamePhase,
    gameWinner,
    votedPlayers,
    lastEliminatedId,
    voteCounts,
    votedBy,
    rolePopupVisible,
    playerClues,
    currentTurnUserId,
    turnSeconds,
    allCluesSubmitted,
    displayPhase,
    discussionFreeSeconds,
    timeLeft,
    currentPlayer,
    isHost,
    join,
    leave,
    markAsJoined,
    initWS,
    startGame,
    toggleReady,
    sendChat,
    setDiscussionTime,
    decrementImpostors,
    incrementImpostors,
    upsertPlayer,
    removePlayerById,
    castVote,
    advanceToVoting,
    resolveVoting,
    submitClue,
    dismissRole,
    eliminationPopupVisible,
    eliminationData,
    dismissElimination,
    resolveVotingInProgress,
    impostorIdForGuess,
    guessSecretWord
  }
})

export default useRoomStore
