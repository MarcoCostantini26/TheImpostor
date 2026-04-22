/**
 * Returns true if the player object matches the given id.
 */
export function matchesId(player, id) {
  if (!player || id === undefined || id === null) return false
  const sid = String(id)
  return [player.id, player.userId, player.user_id, player._id, player.connectionId, player.socketId]
    .some(v => v !== undefined && v !== null && String(v) === sid)
}

/**
 * Finds the first player in the array whose id matches the given value.
 */
export function findPlayerById(players, id) {
  if (!Array.isArray(players) || id == null) return null
  return players.find(p => p && matchesId(p, id)) ?? null
}
