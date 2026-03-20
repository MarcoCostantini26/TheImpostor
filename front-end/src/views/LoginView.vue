<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const handleLogin = async () => {
	loading.value = true
	error.value = ''
  
	const result = await authStore.login(email.value, password.value)
  
	if (result && result.success) {
		router.push('/')		// to update
	} else {
		error.value = result?.error || 'Login failed'
	}
	loading.value = false
}
</script>

<template>
	<div class="min-h-screen flex items-center justify-center px-4">
		<div class="w-full max-w-6xl p-6 md:p-8 rounded-2xl bg-[rgba(48,48,48,0.85)] shadow-[0_20px_60px_rgba(0,0,0,0.6)] grid grid-cols-1 md:grid-cols-2 gap-0 items-center">
			<div class="max-w-md w-full space-y-8 bg-[rgba(18,18,18,0.95)] p-8 rounded-xl shadow-md border border-transparent order-2 md:order-1">
				<div>
					<h2 class="text-3xl font-bold text-white">LOGIN</h2>
				</div>

				<form class="mt-8 space-y-6" @submit.prevent="handleLogin">
					<div class="rounded-md shadow-sm -space-y-px">
						<div class="mb-4">
							<label for="email-address" class="block text-sm font-medium text-gray-400 mb-1">EMAIL ADDRESS</label>
							<input id="email-address" name="email" type="email" autocomplete="email" required v-model="email"
								class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-700 bg-[rgba(255,255,255,0.02)] placeholder-gray-500 text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
								>
						</div>
						<div>
							<label for="password" class="block text-sm font-medium text-gray-400 mb-1">PASSWORD</label>
							<input id="password" name="password" type="password" autocomplete="current-password" required v-model="password"
								class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-700 bg-[rgba(255,255,255,0.02)] placeholder-gray-500 text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
								>
						</div>
					</div>

					<div v-if="error" class="text-red-300 text-sm text-center bg-red-900 p-2 rounded border border-red-500">
						{{ error }}
					</div>

					<div>
						<button type="submit" :disabled="loading"
							class="block w-full text-center py-3 rounded-full text-white bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed">
							{{ loading ? 'Signing in...' : 'Login' }}
						</button>
					</div>
				</form>

				<div class="flex items-center">
					<div class="flex-1 h-px bg-gray-700"></div>
					<div class="px-3 text-gray-400">OR</div>
					<div class="flex-1 h-px bg-gray-700"></div>
				</div>

				<router-link to="/register" class="block w-full text-center py-3 rounded-full border-2 border-emerald-400 text-emerald-400">Sign up</router-link>
				<button @click="() => { if(!loading) $emit?.('') }" class="block w-full text-center py-3 rounded-full border-2 border-white text-white">Play as Guest</button>
			</div>

			<div class="flex items-center justify-center order-1 md:order-2 mb-4 md:mb-0">
				<img src="/logo.png" alt="The Impostor" class="w-full max-w-[260px] object-contain" />
			</div>
		</div>
	</div>
</template>

<style scoped>
/* keep minimal scoped rules so Tailwind handles the layout */
.hidden-md { display: none; }
@media (min-width: 768px) { .hidden-md { display: block; } }
</style>

