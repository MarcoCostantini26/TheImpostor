const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

function jsonHeaders() {
    return { 'Content-Type': 'application/json' }
}

export async function login(email, password) {
    const response = await fetch(`${API}/api/users/login`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ email, password }),
        credentials: 'include'
    })

    const data = await response.json()

    if (!response.ok) {
        throw new Error(data.message || data.error || 'Login failed')
    }

    return data
}

export async function register(username, email, password) {
    const response = await fetch(`${API}/api/users/register`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ username, email, password }),
        credentials: 'include'
    })

    const data = await response.json()

    if (!response.ok) {
        throw new Error(data.message || data.error || 'Registration failed')
    }

    return data
}

// fetch user by id (used to validate stored user on app load)
export async function me(id) {
    if (!id) throw new Error('Missing user id')

    const response = await fetch(`${API}/api/users/${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: jsonHeaders(),
        credentials: 'include'
    })

    const data = await response.json()

    if (!response.ok) {
        throw new Error(data.message || data.error || 'Unauthorized')
    }

    return data
}

export async function checkUsername(username) {
    const response = await fetch(`${API}/api/users/check-username/${encodeURIComponent(username)}`, {
        method: 'GET',
        headers: jsonHeaders(),
    })

    const data = await response.json()

    if (!response.ok) {
        throw new Error(data.message || data.error || 'Username check failed')
    }

    if (typeof data === 'boolean') return data
    return data?.available ?? true
}

export async function checkEmail(email) {
    const response = await fetch(`${API}/api/users/check-email/${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: jsonHeaders(),
    })

    const data = await response.json()

    if (!response.ok) {
        throw new Error(data.message || data.error || 'Email check failed')
    }

    if (typeof data === 'boolean') return data
    return data?.available ?? true
}