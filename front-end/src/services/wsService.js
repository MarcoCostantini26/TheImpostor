const WS_HOST = import.meta.env.VITE_WS_HOST || location.hostname
const WS_PORT = import.meta.env.VITE_WS_PORT || '3000'
const WS_PROTO = import.meta.env.VITE_WS_PROTO || (location.protocol === 'https:' ? 'wss' : 'ws')
const WS_BASE = import.meta.env.VITE_WS_BASE_URL || `${WS_PROTO}://${WS_HOST}:${WS_PORT}`

let socket = null
let listeners = []

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return

  socket = new WebSocket(WS_BASE)

  socket.onopen = () => console.log('[ws] connected to', WS_BASE)

  socket.onmessage = (ev) => {
    try {
      console.debug('[ws] recv raw', ev.data)
      const parsed = JSON.parse(ev.data)
      console.debug('[ws] recv parsed', parsed)
      listeners.forEach((cb) => cb(parsed))
    } catch (e) {
      console.warn('[ws] failed parse message', e)
    }
  }

  socket.onclose = () => console.log('[ws] closed')
  socket.onerror = (e) => console.error('[ws] error', e)
}

function disconnect() {
  if (socket) {
    socket.onclose = null
    socket.close()
    socket = null
  }
}

function isConnected() {
  return socket && socket.readyState === WebSocket.OPEN
}

function send(obj) {
  if (!socket || socket.readyState !== WebSocket.OPEN) connect()
  const payload = JSON.stringify(obj)
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(payload)
  } else {
    socket.addEventListener('open', () => socket.send(payload), { once: true })
  }
}

function sendEvent(action, payload = {}) {
  send({ type: 'EVENT', payload: { action, ...payload } })
}

function onMessage(cb) {
  listeners.push(cb)
  return () => {
    listeners = listeners.filter((c) => c !== cb)
  }
}

export { connect, disconnect, isConnected, send, sendEvent, onMessage }
