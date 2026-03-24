import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as authService from '../services/authService'

export const useAuthStore = defineStore('auth', () => {
    const user = ref(JSON.parse(localStorage.getItem('user')) || null)
    const token = ref(localStorage.getItem('token') || null)

    async function login({ email, password }) {
        try {
            const data = await authService.login(email, password)

            user.value = data || null
            token.value = null

            localStorage.setItem('user', JSON.stringify(user.value))
            localStorage.removeItem('token')

            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    async function register({ username, email, password }) {
        try {
            const data = await authService.register(username, email, password)

            user.value = data || null
            token.value = null

            localStorage.setItem('user', JSON.stringify(user.value))
            localStorage.removeItem('token')

            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    function guest(name) {
        user.value = { username: name }
        token.value = null
        localStorage.setItem('user', JSON.stringify(user.value))
        localStorage.removeItem('token')
        return { success: true }
    }

    function logout() {
        user.value = null
        token.value = null
        localStorage.removeItem('user')
        localStorage.removeItem('token')
        window.location.href = '/'
    }

    // If a token exists on load, try to validate and fetch the user
    ;(async () => {
        const stored = JSON.parse(localStorage.getItem('user') || 'null')
        const id = stored?.id
        if (id) {
            try {
                const data = await authService.me(id)
                user.value = data || null
                localStorage.setItem('user', JSON.stringify(user.value))
            } catch (e) {
                token.value = null
                localStorage.removeItem('token')
                user.value = null
                localStorage.removeItem('user')
            }
        }
    })()

    return { user, token, login, register, logout, guest }
})
