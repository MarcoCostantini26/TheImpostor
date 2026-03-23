import { WebSocketServer, WebSocket, RawData } from 'ws';
import { randomUUID } from 'crypto';
import { InMemorySessionRepository } from './infrastructure/InMemorySessionRepository';
import { RoutingService } from './application/RoutingService';
import { ChatAndSignalingService } from './application/ChatAndSignalingService';
import { Session, Connection } from './domain/Session';

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const wss = new WebSocketServer({ port });

const sessionRepository = new InMemorySessionRepository();
const routingService = new RoutingService(sessionRepository);
const chatAndSignalingService = new ChatAndSignalingService(sessionRepository);

const activeSockets = new Map<string, WebSocket>();

wss.on('connection', async (ws: WebSocket) => {
    //qui simuliamo un processo di autenticazione e autorizzazione assegnando un ID utente temporaneo
    const temporaryUserId = randomUUID();
    const socketId = randomUUID();

    activeSockets.set(socketId, ws);

    const session = new Session(temporaryUserId);
    const connection = new Connection(socketId);
    session.addConnection(connection);

    await sessionRepository.save(session);

    ws.on('message', async (data: RawData) => {
        try {
            const parsedData = JSON.parse(data.toString());

            if (parsedData.type === 'CHAT') {
                const message = { roomId: parsedData.roomId, senderId: temporaryUserId, content: parsedData.content };
                await chatAndSignalingService.processChatMessage(message);
            } else if (parsedData.type === 'WEBRTC') {
                const message = { roomId: parsedData.roomId, senderId: temporaryUserId, content: parsedData.content };
                await chatAndSignalingService.processWebRTCSignaling(message);
            } else {
                const event = { type: parsedData.type, payload: parsedData.payload || parsedData };
                await routingService.handleClientEvent(temporaryUserId, event);
            }
        } catch (error) {
            console.error('Errore: Il messaggio ricevuto non è un JSON valido.');
        }
    });

    ws.on('close', async () => {
        await sessionRepository.remove(temporaryUserId);
        
        activeSockets.delete(socketId);
        console.log(`Client ${temporaryUserId} disconnesso dal Gateway.`);
    });
});

console.log(`Comms Gateway avviato sulla porta ${port}`);