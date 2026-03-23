import { WebSocketServer, WebSocket, RawData } from 'ws';
import { randomUUID } from 'crypto';
import { InMemorySessionRepository } from './infrastructure/InMemorySessionRepository';
import { HttpEngineAdapter } from './infrastructure/HttpEngineAdapter'; 
import { RoutingService } from './application/RoutingService';
import { ChatAndSignalingService } from './application/ChatAndSignalingService';
import { Session, Connection } from './domain/Session';
import { Message } from './domain/Message';
import { Event } from './domain/Event';

interface AliveWebSocket extends WebSocket {
    isAlive?: boolean;
}

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const wss = new WebSocketServer({ port });

const sessionRepository = new InMemorySessionRepository();
const engineAdapter = new HttpEngineAdapter(); 

const routingService = new RoutingService(sessionRepository, engineAdapter);
const chatAndSignalingService = new ChatAndSignalingService(sessionRepository);

const activeSockets = new Map<string, WebSocket>();

wss.on('connection', async (ws: WebSocket) => {
    const extWs = ws as AliveWebSocket;
    extWs.isAlive = true;

    extWs.on('pong', () => {
        extWs.isAlive = true;
    });

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

    ws.on('error', (error) => {
        console.error(`[Gateway] Errore socket per ${temporaryUserId}:`, error);
    });
});

// HEARTBEAT
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        const extWs = ws as AliveWebSocket;
        
        if (extWs.isAlive === false) {
            console.log(`[Gateway] Connessione fantasma rilevata, terminazione forzata.`);
            return extWs.terminate();
        }

        extWs.isAlive = false;
        extWs.ping();
    });
}, 30000);

// DOCKER
const shutdown = () => {
    console.log('[Gateway] Ricevuto segnale di spegnimento. Chiusura in corso...');
    
    clearInterval(interval);
    
    wss.close(() => {
        console.log('[Gateway] Server WebSocket chiuso.');
        process.exit(0);
    });

    setTimeout(() => {
        console.error('[Gateway] Chiusura forzata dopo timeout.');
        process.exit(1);
    }, 10000);
};

// Segnali di sistema per lo spegnimento dei container Docker
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log(`Comms Gateway avviato sulla porta ${port}`);