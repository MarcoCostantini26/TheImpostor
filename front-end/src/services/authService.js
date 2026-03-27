import { apiClient } from './apiClient'

export async function login(email, password) {
  return apiClient.post('/api/users/login', { body: { email, password } })
}

export async function register(username, email, password) {
  return apiClient.post('/api/users/register', { body: { username, email, password } })
}

export async function me(id) {
  if (!id) throw new Error('Missing user id')
  return apiClient.get(`/api/users/${encodeURIComponent(id)}`)
}

export async function checkUsername(username) {
  return apiClient.get(`/api/users/check-username/${encodeURIComponent(username)}`)
}

export async function checkEmail(email) {
  return apiClient.get(`/api/users/check-email/${encodeURIComponent(email)}`)
}

export async function deleteUser(id) {
  if (!id) throw new Error('Missing user id')
  return apiClient.delete(`/api/users/${encodeURIComponent(id)}`)
}