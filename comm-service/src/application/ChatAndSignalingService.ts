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
            const chatEvent = {
                type: 'CHAT',
                payload: {
                    senderId: message.senderId,
                    content: message.content, //(usa content invece di text)
                    timestamp: new Date().toISOString()
                }
            };

            this.roomManager.broadcastToRoom(message.roomId, chatEvent, ws);
            console.log(`[Chat] 💬 ${message.senderId} -> Stanza ${message.roomId}: ${message.content}`);
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