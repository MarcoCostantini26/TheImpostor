import { apiClient } from './apiClient'

export async function createRoom(hostUsername, hostId = null, isAuthenticated = false) {
  return apiClient.post('/api/rooms', { body: { hostUsername, hostId, isAuthenticated } })
}

export async function joinRoom(code, username, userId = null, isAuthenticated = false) {
  return apiClient.post(`/api/rooms/${encodeURIComponent(code)}/join`, { body: { username, userId, isAuthenticated } })
}

export async function leaveRoom(code, playerId) {
  return apiClient.post(`/api/rooms/${encodeURIComponent(code)}/leave`, { body: { playerId } })
}

export async function getRoom(code) {
  return apiClient.get(`/api/rooms/${encodeURIComponent(code)}`)
}

export default { createRoom, joinRoom, leaveRoom, getRoom }
