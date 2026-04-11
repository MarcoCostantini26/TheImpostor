<template>
  <!-- Desktop panel -->
  <aside class="hidden md:flex w-80 xl:w-96 flex-col bg-[#111] border-l border-white/5 flex-shrink-0 card pop-in">
    <div class="px-5 py-3 border-b border-white/5">
      <p class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Live Discussion</p>
    </div>

    <div ref="desktopChat" class="flex-1 overflow-y-auto p-4 space-y-4">
      <div v-for="(m, i) in messages" :key="i">
        <p class="text-xs font-bold text-violet-300 leading-tight">
          {{ (m.local || String(m.senderId) === String(myUserId)) ? 'You' : (m.sender || m.displayName || 'Player') }}
        </p>
        <p class="text-sm text-gray-200 mt-0.5 break-words leading-snug">{{ m.content || m.message }}</p>
      </div>
    </div>

    <div class="p-3 border-t border-white/5 flex gap-2">
      <input
        v-model="newMessage"
        @keydown.enter.prevent="onSend"
        placeholder="Send a message…"
        class="flex-1 px-4 py-2.5 rounded-full bg-black/40 border border-white/10 text-gray-100 text-sm focus:outline-none focus:border-violet-500/50 placeholder:text-gray-600"
      />
      <button @click="onSend" class="px-4 py-2 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm transition-colors">SEND</button>
    </div>
  </aside>

  <!-- Mobile chat panel -->
  <div v-if="show" class="md:hidden fixed bottom-0 left-0 right-0 z-30 flex flex-col card pop-in" style="height: 50vh">
    <div class="flex items-center justify-between px-4 py-2 border-b border-white/5">
      <p class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Live Discussion</p>
      <button @click="closeMobile" class="text-gray-500 hover:text-white">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>

    <div ref="mobileChat" class="flex-1 overflow-y-auto p-4 space-y-3">
      <div v-for="(m, i) in messages" :key="i">
        <p class="text-xs font-bold text-violet-300">
          {{ (m.local || String(m.senderId) === String(myUserId)) ? 'You' : (m.sender || m.displayName || 'Player') }}
        </p>
        <p class="text-sm text-gray-200 mt-0.5 break-words">{{ m.content || m.message }}</p>
      </div>
    </div>

    <div class="p-3 border-t border-white/5 flex gap-2">
      <input v-model="newMessage" @keydown.enter.prevent="onSend" placeholder="Send a message…" class="flex-1 px-4 py-2 rounded-full bg-black/40 border border-white/10 text-gray-100 text-sm focus:outline-none" />
      <button @click="onSend" class="px-4 py-2 rounded-full bg-violet-600 text-white font-bold text-sm">SEND</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  myUserId: { type: [String, Number], default: null },
  modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'send', 'unread-change'])

const show = ref(props.modelValue)
const newMessage = ref('')
const desktopChat = ref(null)
const mobileChat = ref(null)
let unread = 0

watch(() => props.modelValue, v => { show.value = v })

watch(show, async (val) => {
  emit('update:modelValue', val)
  if (val) {
    unread = 0
    emit('unread-change', 0)
    await nextTick()
    if (mobileChat.value) mobileChat.value.scrollTop = mobileChat.value.scrollHeight
  }
})

watch(() => props.messages, async () => {
  await nextTick()
  if (desktopChat.value) desktopChat.value.scrollTop = desktopChat.value.scrollHeight
  if (show.value) {
    if (mobileChat.value) mobileChat.value.scrollTop = mobileChat.value.scrollHeight
    unread = 0
    emit('unread-change', 0)
  } else {
    unread++
    emit('unread-change', unread)
  }
}, { deep: true })

function onSend() {
  if (!newMessage.value || !newMessage.value.trim()) return
  emit('send', newMessage.value.trim())
  newMessage.value = ''
  nextTick(() => {
    if (mobileChat.value) mobileChat.value.scrollTop = mobileChat.value.scrollHeight
    if (desktopChat.value) desktopChat.value.scrollTop = desktopChat.value.scrollHeight
  })
}

function closeMobile() { show.value = false }
</script>

<style scoped>
@keyframes popIn {
  from { opacity: 0; transform: translateY(12px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)   scale(1);    }
}
.pop-in {
  animation: popIn 400ms cubic-bezier(.2,.9,.2,1) both;
}
.card {
  opacity: 0;
  transform: translateY(8px) scale(0.995);
}
</style>
