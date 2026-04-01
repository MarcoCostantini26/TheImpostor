<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import { checkUsername, checkEmail } from '../services/authService'

const authStore = useAuthStore()
const router = useRouter()

const username = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)
const usernameAvailable = ref(null) 
const emailAvailable = ref(null)
const usernameMsg = ref('')
const emailMsg = ref('')

async function checkUsernameAvailability() {
  usernameMsg.value = ''
  usernameAvailable.value = null
  if (!username.value) return
  try {
    const ok = await checkUsername(username.value)
    usernameAvailable.value = ok
    usernameMsg.value = ok ? 'Username available' : 'Username already taken'
  } catch {
    usernameAvailable.value = null
    usernameMsg.value = 'Unable to check username'
  }
}

async function checkEmailAvailability() {
  emailMsg.value = ''
  emailAvailable.value = null
  if (!email.value) return
  try {
    const ok = await checkEmail(email.value)
    emailAvailable.value = ok
    emailMsg.value = ok ? 'Email available' : 'Email already registered'
  } catch {
    emailAvailable.value = null
    emailMsg.value = 'Unable to check email'
  }
}

const handleRegister = async () => {
  loading.value = true
  error.value = ''

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    loading.value = false
    return
  }

  if (usernameAvailable.value === false) {
    error.value = 'Username already taken'
    loading.value = false
    return
  }

  if (emailAvailable.value === false) {
    error.value = 'Email already registered'
    loading.value = false
    return
  }

  const result = await authStore.register?.({ username: username.value, email: email.value, password: password.value })

  if (result && result.success) {
    router.push({ name: 'home' })
  } else {
    error.value = result?.error || 'Registration failed'
  }

  loading.value = false
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-6xl p-6 md:p-8 rounded-2xl bg-[rgba(48,48,48,0.85)] shadow-[0_20px_60px_rgba(0,0,0,0.6)] grid grid-cols-1 md:grid-cols-2 gap-0 items-center">
      <div class="card pop-in max-w-md w-full mx-auto space-y-8 bg-[rgba(18,18,18,0.95)] p-8 rounded-xl shadow-md border border-transparent order-2 md:order-1">
        <div>
          <h2 class="text-3xl font-bold text-white">REGISTER</h2>
        </div>

        <form class="mt-8 space-y-6" @submit.prevent="handleRegister">
          <div class="rounded-md shadow-sm -space-y-px">
            <div class="mb-4">
              <label for="username" class="block text-sm font-medium text-gray-400 mb-1">USERNAME</label>
              <input id="username" name="username" type="text" autocomplete="username" required v-model="username" @blur="checkUsernameAvailability"
                class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-700 bg-[rgba(255,255,255,0.02)] placeholder-gray-500 text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
              >
              <div class="text-xs mt-1" :class="usernameAvailable === false ? 'text-red-300' : 'text-green-300'">{{ usernameMsg }}</div>
            </div>

            <div class="mb-4">
              <label for="email-address" class="block text-sm font-medium text-gray-400 mb-1">EMAIL ADDRESS</label>
              <input id="email-address" name="email" type="email" autocomplete="email" required v-model="email" @blur="checkEmailAvailability"
                class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-700 bg-[rgba(255,255,255,0.02)] placeholder-gray-500 text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
              >
              <div class="text-xs mt-1" :class="emailAvailable === false ? 'text-red-300' : 'text-green-300'">{{ emailMsg }}</div>
            </div>

            <div class="mb-4">
              <label for="password" class="block text-sm font-medium text-gray-400 mb-1">PASSWORD</label>
              <input id="password" name="password" type="password" autocomplete="new-password" required v-model="password"
                class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-700 bg-[rgba(255,255,255,0.02)] placeholder-gray-500 text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
              >
            </div>

            <div>
              <label for="confirm-password" class="block text-sm font-medium text-gray-400 mb-1">CONFIRM PASSWORD</label>
              <input id="confirm-password" name="confirm-password" type="password" autocomplete="new-password" required v-model="confirmPassword"
                class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-700 bg-[rgba(255,255,255,0.02)] placeholder-gray-500 text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 sm:text-sm"
              >
            </div>
          </div>

          <div v-if="error" class="text-red-300 text-sm text-center bg-red-900 p-2 rounded border border-red-500">
            {{ error }}
          </div>

          <div>
            <button type="submit" :disabled="loading"
              class="block w-full text-center py-3 rounded-full text-white bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              {{ loading ? 'Creating...' : 'Create Account' }}
            </button>
          </div>
        </form>

        <div class="text-sm text-gray-400 text-center">
          Already have an account? <router-link to="/" class="text-violet-500 font-medium underline">Log in</router-link>
        </div>
      </div>

      <div class="flex items-center justify-center order-1 md:order-2 mb-4 md:mb-0">
        <img src="/logo.png" alt="The Impostor" class="w-full max-w-[260px] object-contain" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.hidden-md { display: none; }
@media (min-width: 768px) { .hidden-md { display: block; } }

/* pop-in animation */
.card { opacity: 0; transform: translateY(8px) scale(0.995); }

@keyframes popIn {
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.pop-in {
  animation-name: popIn;
  animation-duration: 420ms;
  animation-timing-function: cubic-bezier(.2,.9,.2,1);
  animation-fill-mode: forwards;
  animation-delay: 120ms;
}
</style>
