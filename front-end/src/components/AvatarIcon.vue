<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: [String, Number], default: '' },
  active: { type: Boolean, default: false },
  size: { type: String, default: 'md' }, // 'sm' or 'md'
  clickable: { type: Boolean, default: false }
})

const emits = defineEmits(['click'])

const initial = computed(() => {
  const s = (props.name ?? '').toString().trim()
  return s ? s.charAt(0).toUpperCase() : '?'
})

const classes = computed(() => {
  const sizes = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-9 h-9 text-sm'
  }
  const bg = props.active ? 'bg-violet-400' : 'bg-violet-300'
  const base = `${sizes[props.size] || sizes.md} rounded-full inline-flex items-center justify-center font-semibold text-white`
  const cursor = props.clickable ? ' cursor-pointer hover:brightness-110 transition-[filter]' : ''
  return `${base} ${bg}${cursor}`
})
</script>

<template>
  <button v-if="clickable" :class="classes" @click="emits('click')" type="button">
    {{ initial }}
  </button>
  <div v-else :class="classes">
    {{ initial }}
  </div>
</template>

<style scoped>
</style>
