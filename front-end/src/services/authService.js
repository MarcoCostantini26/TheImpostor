export async function login(email, password) {
    const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    })

    const data = await response.json()

    if (!response.ok) {
        throw new Error(data.message || 'Login failed')
    }

    return data
}

export async function register(username, email, password) {
    const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ username, email, password }),
    })

    const data = await response.json()

    if (!response.ok) {
        throw new Error(data.message || data.error || 'Registration failed')
    }

    return data
}