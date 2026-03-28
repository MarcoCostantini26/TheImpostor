<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import * as authService from '../services/authService'

const props = defineProps({
  userId: { type: [String, Number], default: null }
})

const loading = ref(false)
const authStore = useAuthStore()
const router = useRouter()

function getId() {
  return props.userId ?? authStore.user?.id
}

async function handleDelete() {
  const id = getId()
  if (!id) {
    alert('UserID not available.')
    return
  }

  const ok = confirm('Are you sure to delete your account?')
  if (!ok) return

  loading.value = true
  try {
    await authService.deleteUser(id)

    alert('Account deleted successfully.')
    authStore.logout()
    router.push({ name: 'login' })
  } catch (e) {
    alert(e.message || 'Delete failed')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <button @click="handleDelete" :disabled="loading"
    class="block w-full text-center py-2 rounded-full text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
    {{ loading ? 'Deleting...' : 'Delete Account' }}
  </button>
</template>

<style scoped>
</style>
