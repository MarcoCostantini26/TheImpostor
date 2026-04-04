import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import * as wsService from '../services/wsService'
import * as roomService from '../services/roomService'
import { useAuthStore } from './auth'

export const useRoomStore = defineStore('room', () => {
  const players = ref([])
  const messages = ref([])
  const impostors = ref(1)
  const discussionTime = ref(90)
  const loading = ref(false)
  const error = ref(null)
  const roomStatus = ref(null)
  const roomHostId = ref(null)
  const myRole = ref(null)       // 'CREWMATE' | 'IMPOSTOR' | null
  const mySecretWord = ref(null) // the secret word (crewmates) or hint (impostors)
  let _joinedViaHome = false

  let unsubscribe = null
  let currentRoomCode = null
  const STORAGE_PREFIX = 'theimpostor:chat:'
  const MAX_PERSISTED = 200

  const authStore = useAuthStore()

  const currentPlayer = computed(() => {
    const uidCandidates = [authStore.user?.id, authStore.user?._id, authStore.user?.userId].filter(Boolean)
    const username = authStore.user?.username || authStore.user?.name || null

    if (!players.value || players.value.length === 0) return null

    return players.value.find((p) => {
      if (!p) return false
      if (uidCandidates.some((id) => id && (p.id === id || p.userId === id || p.user_id === id))) return true
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
      return allIds.some((id) => id && (cp.id === id || cp.userId === id || cp.user_id === id))
    }

    return false
  })

  function upsertPlayer(incoming) {
    if (!incoming) return
    const idx = players.value.findIndex((pl) => (
      (pl.id && incoming.id && pl.id === incoming.id) ||
      (pl.userId && incoming.userId && pl.userId === incoming.userId) ||
      (pl.username && incoming.username && pl.username === incoming.username)
    ))
    if (idx !== -1) players.value.splice(idx, 1, { ...players.value[idx], ...incoming })
    else players.value.push(incoming)
  }

  function removePlayerById(id) {
    if (!id) return
    players.value = players.value.filter((pl) => !(pl && (pl.id === id || pl.userId === id || pl.user_id === id)))
  }

  function handleIncoming(msg) {
    const payload = msg.payload || msg || {}
    const action = payload.action || msg.type || payload.type

    if (payload.room && Array.isArray(payload.room.players)) {
      players.value = payload.room.players
      roomStatus.value = payload.room.status || null
      roomHostId.value = payload.room.hostId || null
      return
    }

    if (Array.isArray(payload.players)) {
      players.value = payload.players
      roomStatus.value = payload.status || null
      roomHostId.value = payload.hostId || null
      return
    }

    if (action === 'room_update' || action === 'room_state' || action === 'room:updated') {
      players.value = payload.players || payload.room?.players || []
      roomStatus.value = payload.room?.status || payload.status || null
      roomHostId.value = payload.room?.hostId || payload.hostId || null
      return
    }

    if (action === 'player_joined' || action === 'player_join' || action === 'joined') {
      const incoming = payload.player || payload.user || payload
      upsertPlayer(incoming)
      return
    }

    if (action === 'player_ready' || action === 'PLAYER_READY' || action === 'toggle_ready') {
      const id = payload.userId || payload.playerId || payload.senderId || (payload.player && (payload.player.id || payload.player.userId))
      const ready = payload.ready ?? payload.isReady ?? (payload.player && payload.player.ready)
      if (id) {
        const idx = players.value.findIndex(pl => pl && (pl.id === id || pl.userId === id || pl.user_id === id))
        if (idx !== -1) players.value.splice(idx, 1, { ...players.value[idx], ready })
      } else if (payload.username) {
        players.value = players.value.map(p => (p && (p.username === payload.username || p.displayName === payload.username)) ? { ...p, ready } : p)
      }
      return
    }

    if (action === 'player_left' || action === 'left' || action === 'player_removed') {
      const id = payload.userId || payload.playerId || payload.id
      const uname = payload.username || payload.user || payload.displayName
      if (id) removePlayerById(id)
      else if (uname) players.value = players.value.filter((pl) => !(pl && (pl.username === uname || pl.displayName === uname)))
      return
    }

    if (action === 'update_settings' || action === 'UPDATE_SETTINGS' || action === 'settings:update') {
      const settings = payload.settings || payload || {}
      if (settings.impostors !== undefined) impostors.value = settings.impostors
      if (settings.discussionTime !== undefined) discussionTime.value = settings.discussionTime
      return
    }

    if (msg.type === 'CHAT' || action === 'chat_message' || payload.type === 'CHAT') {
      const p = payload || {}
      const senderId = p.senderId || p.userId || p.fromId || p.from || null
      let senderName = p.sender || p.displayName || p.username || p.from || null

      if (!senderName && senderId) {
        const pl = players.value.find(pl => {
          if (!pl) return false
          const ids = [pl.id, pl.userId, pl.user_id, pl._id, pl.connectionId, pl.socketId]
          return ids.some(id => id !== undefined && id !== null && String(id) === String(senderId))
        })
        if (pl) senderName = pl.username || pl.displayName || (typeof pl === 'string' ? pl : null)
      }

      if (!senderName) {
        senderName = p.username || p.displayName || senderId || 'Player'
      }

      messages.value.push({
        sender: senderName,
        senderId: senderId || null,
        content: p.content || p.message || '',
        timestamp: p.timestamp || new Date().toISOString(),
        _raw: p
      })
      messages.value = messages.value.slice(-MAX_PERSISTED)
      return
    }

    if (action === 'game_started' || action === 'GAME_STARTED') {
      roomStatus.value = 'STARTED'
      return
    }

    if (msg.type === 'ENGINE_EVENT') {
      const ep = msg.payload || {}
      if (ep.eventName === 'RoleAssigned') {
        myRole.value = ep.role || null
        mySecretWord.value = ep.secretWord || null
      }
      return
    }
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
    if (authStore.user?.id || !playersList) return
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
        const joinResult = await roomService.joinRoom(roomCode, displayName, authStore.user?.id || null, !!authStore.user?.id)
        resolveGuestId(joinResult?.players, displayName)
      }

      const room = await roomService.getRoom(roomCode)
      players.value = room.players || []
      roomStatus.value = room.status || room.state || null
      roomHostId.value = room.hostId || room.hostUserId || room.creatorId || null
      if (room.impostors !== undefined) impostors.value = room.impostors
      if (room.discussionTime !== undefined) discussionTime.value = room.discussionTime

      resolveGuestId(room.players, displayName)

      initWS(roomCode)
      wsService.sendEvent('join_room', { roomCode, userId: authStore.user?.id, username: displayName })

      try {
        const raw = localStorage.getItem(STORAGE_PREFIX + roomCode)
        const parsed = raw ? JSON.parse(raw) : []
        messages.value = Array.isArray(parsed) ? parsed.slice(-MAX_PERSISTED) : []
      } catch {
        messages.value = []
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
    }
    players.value = []
    messages.value = []
    roomStatus.value = null
    roomHostId.value = null
    myRole.value = null
    mySecretWord.value = null
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
    if (![60, 90, 120].includes(val)) return
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

  function dismissRole() {
    myRole.value = null
    mySecretWord.value = null
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
    dismissRole
  }
})

export default useRoomStore
