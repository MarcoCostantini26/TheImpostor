import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'login',
            component: () => import('../views/LoginView.vue')
        },
        {
            path: '/home',
            name: 'home',
            component: () => import('../views/HomeView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/lobby/:code',
            name: 'lobby',
            component: () => import('../views/LobbyView.vue'),
            meta: { requiresAuth: true }
        },
        {
            path: '/register',
            name: 'register',
            component: () => import('../views/RegisterView.vue')
        }
    ]
})

router.beforeEach((to) => {
    const authStore = useAuthStore()
    const isAuthenticated = !!authStore.user

    if (to.meta.requiresAuth && !isAuthenticated) {
        return { name: 'login' }
    }
})

export default router
