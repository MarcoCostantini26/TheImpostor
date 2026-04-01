import { RoomManager } from './RoomManager';
import { Message } from '../domain/Message';
import { SessionRepository } from '../domain/SessionRepository';
import { WebSocket } from 'ws';

export class ChatAndSignalingService {
    constructor(
        private sessionRepository: SessionRepository,
        private roomManager: RoomManager 
    ) {}

    async processChatMessage(message: Message, ws?: WebSocket): Promise<void> {
        try {
            let content: any = message.content
            let senderName: string | undefined = undefined
            if (content && typeof content === 'object') {
                senderName = content.username || content.sender || undefined
                content = content.content ?? content.message ?? ''
            }

            const chatEvent: any = {
                type: 'CHAT',
                payload: {
                    senderId: message.senderId,
                    content: content,
                    timestamp: new Date().toISOString()
                }
            }

            if (senderName) chatEvent.payload.sender = senderName

            this.roomManager.broadcastToRoom(message.roomId, chatEvent, ws);
            console.log(`[Chat] 💬 ${message.senderId} (${senderName || 'unknown'}) -> Stanza ${message.roomId}: ${content}`);
        } catch (error: any) {
            console.error(`[Chat] ❌ Errore processChatMessage: ${error.message}`);
        }
    }

    async processWebRTCSignaling(message: Message, ws?: WebSocket): Promise<void> {
        try {
            const signalingEvent = {
                type: 'WEBRTC', 
                payload: {
                    senderId: message.senderId,
                    ...message.content 
                }
            };

            this.roomManager.broadcastToRoom(message.roomId, signalingEvent, ws);
            console.log(`[WebRTC] 📡 Segnale da ${message.senderId} -> Stanza ${message.roomId}`);
        } catch (error: any) {
            console.error(`[WebRTC] ❌ Errore processWebRTCSignaling: ${error.message}`);
        }
    }
}