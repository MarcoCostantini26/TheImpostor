<script setup>
import Avatar from './AvatarIcon.vue'
const props = defineProps({
  player: { type: Object, required: true },
  isSelf: { type: Boolean, default: false },
  clue: { type: [String, null], default: null }
})
</script>

<template>
  <div :class="[
    'card flex items-center justify-between p-3 pr-4 rounded-xl border transition-all duration-200',
    isSelf ? 'border-violet-500/40 bg-violet-950/20' : 'border-white/5 bg-white/[0.02]'
  ]">
    <div class="flex items-center gap-3 min-w-0">
      <Avatar :name="player.displayName || player.username" :active="isSelf" size="sm" class="flex-shrink-0" />
      <div class="min-w-0">
        <p class="font-bold text-sm leading-tight truncate">
          {{ player.displayName || player.username }}
          <span v-if="isSelf" class="text-violet-400 font-normal text-xs"> (You)</span>
        </p>
      </div>
    </div>

    <div :class="[
      'ml-3 flex-shrink-0 px-4 py-1.5 rounded-full border text-xs font-bold tracking-widest whitespace-nowrap transition-all',
      clue ? 'border-violet-500/50 text-violet-300 bg-violet-950/20' : 'border-white/10 text-gray-600'
    ]">
      {{ clue ? `"${clue}"` : '...' }}
    </div>
  </div>
</template>

<style scoped>
</style>
