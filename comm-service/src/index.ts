import { WebSocketServer, WebSocket, RawData } from 'ws';
import { randomUUID } from 'crypto';
import { InMemorySessionRepository } from './infrastructure/InMemorySessionRepository';
import { RoutingService } from './application/RoutingService';
import { ChatAndSignalingService } from './application/ChatAndSignalingService';
import { Session, Connection } from './domain/Session';
import { Message } from './domain/Message';
import { Event } from './domain/Event';

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const wss = new WebSocketServer({ port });

const sessionRepository = new InMemorySessionRepository();
const routingService = new RoutingService(sessionRepository);
const chatAndSignalingService = new ChatAndSignalingService(sessionRepository);

const activeSockets = new Map<string, WebSocket>();

wss.on('connection', async (ws: WebSocket) => {
    const temporaryUserId = randomUUID();
    const socketId = randomUUID();

    activeSockets.set(socketId, ws);

    const session = new Session(temporaryUserId);
    const connection = new Connection(socketId);
    session.addConnection(connection);

    await sessionRepository.save(session);
    console.log(`[Gateway] Client connesso: ${temporaryUserId} (Socket ID: ${socketId})`);

    ws.on('message', async (data: RawData) => {
        try {
            const parsedData = JSON.parse(data.toString());

            if (parsedData.type === 'CHAT') {
                //Validazione tramite Value Object Message
                const message = new Message(parsedData.roomId, temporaryUserId, parsedData.content);
                await chatAndSignalingService.processChatMessage(message);

            } else if (parsedData.type === 'WEBRTC') {
                //Validazione tramite Value Object Message
                const message = new Message(parsedData.roomId, temporaryUserId, parsedData.content);
                await chatAndSignalingService.processWebRTCSignaling(message);

            } else {
                //Validazione tramite Value Object Event
                const eventPayload = parsedData.payload || parsedData;
                const event = new Event(parsedData.type, eventPayload);
                await routingService.handleClientEvent(temporaryUserId, event);
            }
        } catch (error: any) {
            console.error(`[Gateway] Errore elaborazione messaggio da ${temporaryUserId}: ${error.message}`);
        }
    });

    ws.on('close', async () => {
        await sessionRepository.remove(temporaryUserId);
        
        activeSockets.delete(socketId);
        console.log(`[Gateway] Client disconnesso: ${temporaryUserId}`);
    });
});

console.log(`Comms Gateway avviato sulla porta ${port}`);