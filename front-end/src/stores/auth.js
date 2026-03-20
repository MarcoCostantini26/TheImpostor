import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
    const user = ref(JSON.parse(localStorage.getItem('user')) || null)
    const token = ref(localStorage.getItem('token') || null)

    const API_URL = 'http://localhost:3000/api/auth'

    async function login(email, password) {
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.message || 'Login failed')
            }

            user.value = data
            token.value = data.token
            localStorage.setItem('user', JSON.stringify(data))
            localStorage.setItem('token', data.token)

            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    async function register(username, email, password) {
        try {
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.message || 'Registration failed')
            }

            user.value = data
            token.value = data.token
            localStorage.setItem('user', JSON.stringify(data))
            localStorage.setItem('token', data.token)

            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    function logout() {
        user.value = null
        token.value = null
        localStorage.removeItem('user')
        localStorage.removeItem('token')
        window.location.href = '/'
    }

    return { user, token, login, register, logout }
})
