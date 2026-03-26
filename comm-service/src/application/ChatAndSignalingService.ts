import { RoomManager } from './RoomManager';
import { Message } from '../domain/Message';
import { SessionRepository } from '../domain/SessionRepository';
import { WebSocket } from 'ws';

export class ChatAndSignalingService {
    constructor(
        private sessionRepository: SessionRepository,
        private roomManager: RoomManager // 🟢 INIETTATO IL ROOM MANAGER
    ) {}

    async processChatMessage(message: Message, ws?: WebSocket): Promise<void> {
        try {
            // Formattiamo l'evento esattamente come lo vuole il front-end
            const chatEvent = {
                type: 'chat_message',
                payload: {
                    senderId: message.senderId,
                    text: message.content,
                    timestamp: new Date().toISOString()
                }
            };

            // Invia solo alla stanza specifica. Se passiamo 'ws', il mittente non riceve un duplicato.
            this.roomManager.broadcastToRoom(message.roomId, chatEvent, ws);
            console.log(`[Chat] 💬 ${message.senderId} -> Stanza ${message.roomId}: ${message.content}`);
        } catch (error: any) {
            console.error(`[Chat] ❌ Errore processChatMessage: ${error.message}`);
        }
    }

    async processWebRTCSignaling(message: Message, ws?: WebSocket): Promise<void> {
        try {
            const signalingEvent = {
                type: 'webrtc_signaling',
                payload: {
                    senderId: message.senderId,
                    data: message.content
                }
            };

            // Nel WebRTC è FONDAMENTALE escludere il mittente, altrimenti il browser va in palla
            this.roomManager.broadcastToRoom(message.roomId, signalingEvent, ws);
            console.log(`[WebRTC] 📡 Segnale da ${message.senderId} -> Stanza ${message.roomId}`);
        } catch (error: any) {
            console.error(`[WebRTC] ❌ Errore processWebRTCSignaling: ${error.message}`);
        }
    }
}