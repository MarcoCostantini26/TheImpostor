import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as authService from '../services/authService'

export const useAuthStore = defineStore('auth', () => {
    const user = ref(JSON.parse(localStorage.getItem('user')) || null)
    const token = ref(localStorage.getItem('token') || null)

    async function login({ email, password }) {
        try {
            const data = await authService.login(email, password)

            token.value = data.token || null
            user.value = data.user || null

            localStorage.setItem('user', JSON.stringify(user.value))
            if (token.value) {
                localStorage.setItem('token', token.value)
            } else {
                localStorage.removeItem('token')
            }

            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    async function register({ username, email, password }) {
        try {
            await authService.register(username, email, password)

            const loginData = await authService.login(email, password)
            token.value = loginData.token || null
            user.value = loginData.user || null

            localStorage.setItem('user', JSON.stringify(user.value))
            if (token.value) {
                localStorage.setItem('token', token.value)
            } else {
                localStorage.removeItem('token')
            }

            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    function guest(name) {
        user.value = { username: name, guest: true }
        token.value = null
        localStorage.setItem('user', JSON.stringify(user.value))
        localStorage.removeItem('token')
        return { success: true }
    }

    function setUserId(id) {
        if (user.value) {
            user.value = { ...user.value, id }
            localStorage.setItem('user', JSON.stringify(user.value))
        }
    }

    function clearGuestId() {
        if (user.value?.guest) {
            const rest = { ...user.value }
            delete rest.id
            user.value = rest
            localStorage.setItem('user', JSON.stringify(user.value))
        }
    }

    function logout() {
        user.value = null
        token.value = null
        localStorage.removeItem('user')
        localStorage.removeItem('token')
        window.location.href = '/'
    }

    ;(async () => {
        const stored = JSON.parse(localStorage.getItem('user') || 'null')
        const id = stored?.id
        if (id && !stored?.guest && token.value) {
            try {
                const data = await authService.me(id)
                user.value = data || null
                localStorage.setItem('user', JSON.stringify(user.value))
            } catch {
                token.value = null
                localStorage.removeItem('token')
                user.value = null
                localStorage.removeItem('user')
            }
        }
    })()

    const isAuthenticated = computed(() => !!token.value && !!user.value && !user.value.guest)

    return { user, token, isAuthenticated, login, register, logout, guest, setUserId, clearGuestId }
})
