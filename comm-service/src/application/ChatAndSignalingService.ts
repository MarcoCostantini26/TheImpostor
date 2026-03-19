import { Message } from '../domain/ValueObjects';
import { SessionRepository } from '../domain/SessionRepository';

export class ChatAndSignalingService {
    constructor(private sessionRepository: SessionRepository) {}

    async processChatMessage(message: Message): Promise<void> {
        console.log(`Broadcasting messaggio nella stanza ${message.roomId} inviato da ${message.senderId}`);
    }

    async processWebRTCSignaling(message: Message): Promise<void> {
        console.log(`Elaborazione pacchetto WebRTC (SDP/ICE) nella stanza ${message.roomId} da ${message.senderId}`);
    }
}