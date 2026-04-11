<script setup>
import { computed } from 'vue'
const props = defineProps({
  modelValue: { type: String, default: '' },
  isImpostor: { type: Boolean, default: false },
  timeLeft: { type: Number, default: 0 },
  disabled: { type: Boolean, default: false }
})
const emits = defineEmits(['update:clue', 'submit'])

function onInput(e) {
  emits('update:clue', e.target.value)
}

function onSubmit() {
  if (!props.modelValue || !props.modelValue.trim() || props.disabled) return
  emits('submit')
}

const submitDisabled = computed(() => props.disabled || !(props.modelValue && props.modelValue.trim()))
</script>

<template>
  <div class="mb-6 card pop-in rounded-2xl bg-[#1a1a2e] border border-violet-500/30 p-4 ring-2 ring-violet-500/40">
    <p class="text-[10px] text-violet-400 uppercase tracking-widest mb-1 font-bold">⏱ Your turn! {{ timeLeft }}s left</p>
    <p class="text-[10px] text-gray-400 uppercase tracking-widest mb-3">
      {{ isImpostor
        ? 'Submit a hint — you don\'t know the secret word, try to blend in!'
        : 'Submit your one-word clue for the secret word' }}
    </p>
    <div class="flex gap-2">
      <input
        :value="modelValue"
        @input="onInput"
        @keydown.enter.prevent="onSubmit"
        placeholder="One word…"
        maxlength="20"
        class="flex-1 px-4 py-2.5 rounded-full bg-black/40 border border-violet-500/30 text-white uppercase tracking-widest font-bold text-sm focus:outline-none focus:border-violet-400 placeholder:normal-case placeholder:font-normal placeholder:text-gray-600"
      />
      <button
        @click="onSubmit"
        :disabled="submitDisabled"
        :class="['px-5 py-2 rounded-full font-bold text-sm transition-all', submitDisabled ? 'bg-white/5 text-gray-600 cursor-not-allowed' : 'bg-violet-500 text-white hover:bg-violet-600']"
      >SUBMIT</button>
    </div>
  </div>
</template>

<style scoped>
</style>
