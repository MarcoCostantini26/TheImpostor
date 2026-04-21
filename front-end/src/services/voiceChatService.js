import * as wsService from './wsService.js'

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

/** @type {Map<string, RTCPeerConnection>} */
const peers = new Map()

let myId = null
let roomCode = null
let localStream = null
let unsubscribe = null
let _muted = false

async function init(room, userId, peerIds) {
  myId = userId
  roomCode = room

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  } catch (e) {
    console.warn('[voice] Accesso al microfono negato:', e)
    return
  }

  if (_muted) {
    localStream.getAudioTracks().forEach(t => { t.enabled = false })
  }

  unsubscribe = wsService.onMessage(_handleSignal)

  for (const peerId of peerIds) {
    if (peerId !== myId && myId < peerId) {
      await _createOffer(peerId)
    }
  }
}

function destroy() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null }
  peers.forEach(pc => pc.close())
  peers.clear()
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop())
    localStream = null
  }
  myId = null
  roomCode = null
  _muted = false
}

function toggleMute() {
  _muted = !_muted
  const enabled = !_muted
  if (localStream) {
    localStream.getAudioTracks().forEach(t => { t.enabled = enabled })
  }
  peers.forEach(pc => {
    pc.getSenders().forEach(sender => {
      if (sender.track && sender.track.kind === 'audio') {
        sender.track.enabled = enabled
      }
    })
  })
  return _muted
}

function isMuted() {
  return _muted
}

function _handleSignal(msg) {
  if (msg.type !== 'WEBRTC') return
  const { senderId, to, signal } = msg.payload || {}
  if (!signal || to !== myId) return

  if (signal.type === 'offer') {
    _handleOffer(senderId, signal).catch(e => console.error('[voice] handleOffer error:', e))
  } else if (signal.type === 'answer') {
    _handleAnswer(senderId, signal).catch(e => console.error('[voice] handleAnswer error:', e))
  } else if (signal.type === 'ice-candidate') {
    _handleIceCandidate(senderId, signal.candidate).catch(e => console.error('[voice] ICE error:', e))
  }
}

function _getOrCreatePeerConnection(peerId) {
  if (peers.has(peerId)) return peers.get(peerId)

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream))
  }

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) {
      _sendSignal(peerId, { type: 'ice-candidate', candidate })
    }
  }

  pc.ontrack = ({ streams }) => {
    const audio = new Audio()
    audio.srcObject = streams[0]
    audio.autoplay = true
    console.log('[voice] Audio stream ricevuto da:', peerId)
  }

  pc.onconnectionstatechange = () => {
    console.log(`[voice] Connessione con ${peerId}: ${pc.connectionState}`)
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      peers.delete(peerId)
    }
  }

  peers.set(peerId, pc)
  return pc
}

async function _createOffer(peerId) {
  const pc = _getOrCreatePeerConnection(peerId)
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  _sendSignal(peerId, { type: 'offer', sdp: offer.sdp })
}

async function _handleOffer(peerId, signal) {
  if (peers.has(peerId)) {
    peers.get(peerId).close()
    peers.delete(peerId)
  }
  const pc = _getOrCreatePeerConnection(peerId)
  await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp })
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
  _sendSignal(peerId, { type: 'answer', sdp: answer.sdp })
}

async function _handleAnswer(peerId, signal) {
  const pc = peers.get(peerId)
  if (pc) await pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp })
}

async function _handleIceCandidate(peerId, candidate) {
  const pc = peers.get(peerId)
  if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate))
}

function _sendSignal(to, signal) {
  wsService.send({
    type: 'WEBRTC',
    payload: { roomId: roomCode, to, signal }
  })
}

export { init, destroy, toggleMute, isMuted }
