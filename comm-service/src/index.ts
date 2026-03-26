import { createServer } from 'http';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { randomUUID } from 'crypto';
import { InMemorySessionRepository } from './infrastructure/InMemorySessionRepository';
import { HttpEngineAdapter } from './infrastructure/HttpEngineAdapter'; 
import { RoutingService } from './application/RoutingService';
import { ChatAndSignalingService } from './application/ChatAndSignalingService';
import { Session, Connection } from './domain/Session';
import { Message } from './domain/Message';
import { Event } from './domain/Event';
import { RoomManager } from './application/RoomManager';
import { LobbyService } from './application/LobbyService'; // 🟢 NUOVO IMPORT

interface AliveWebSocket extends WebSocket {
    isAlive?: boolean;
}

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

const sessionRepository = new InMemorySessionRepository();
const engineAdapter = new HttpEngineAdapter(); 

const routingService = new RoutingService(sessionRepository, engineAdapter);
const chatAndSignalingService = new ChatAndSignalingService(sessionRepository);

const roomManager = new RoomManager();
const lobbyService = new LobbyService(roomManager); // 🟢 INIZIALIZZAZIONE

const activeSockets = new Map<string, WebSocket>();

// SERVER HTTP: Gestisce il Webhook per ascoltare gli eventi di Go
const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/internal/engine-callback') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const engineEvent = JSON.parse(body);
                console.log(`[Webhook] 📢 Ricevuto da Go: ${engineEvent.eventName || engineEvent.EventName}`);
                
                // BROADCAST: Invia l'evento a tutti i client WebSocket connessi
                const messageToBroadcast = JSON.stringify({
                    type: 'ENGINE_EVENT',
                    payload: engineEvent
                });

                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(messageToBroadcast);
                    }
                });
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'Broadcast completato' }));
            } catch (e) {
                res.writeHead(400);
                res.end('Invalid JSON');
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

// SERVER WEBSOCKET: Si aggancia al Server HTTP sulla stessa porta
const wss = new WebSocketServer({ server });

wss.on('connection', async (ws: WebSocket) => {
    const extWs = ws as AliveWebSocket;
    extWs.isAlive = true;

    extWs.on('pong', () => {
        extWs.isAlive = true;
    });

    // Inizialmente usiamo un ID temporaneo
    let currentUserId = `temp-${randomUUID()}`;
    const socketId = randomUUID();

    activeSockets.set(socketId, ws);

    // Creiamo la sessione iniziale nel repository (Usando Connection come richiesto)
    const session = new Session(currentUserId);
    session.addConnection(new Connection(socketId));
    await sessionRepository.save(session);

    console.log(`[Gateway] 🔌 Nuova connessione. ID provvisorio: ${currentUserId}`);

    ws.on('message', async (data: RawData) => {
        try {
            const parsedData = JSON.parse(data.toString());
            console.log(`[Gateway] 📥 Ricevuto evento: ${parsedData.type}`);

            // --- LOGICA DI IDENTIFICAZIONE ---
            if (parsedData.type === 'IDENTIFY') {
                const newUserId = parsedData.payload.userId;
                console.log(`[Gateway] 🆔 Cambio identità: ${currentUserId} -> ${newUserId}`);
                
                await sessionRepository.remove(currentUserId);
                currentUserId = newUserId;
                
                const newSession = new Session(currentUserId);
                newSession.addConnection(new Connection(socketId));
                await sessionRepository.save(newSession);
                return;
            }

            // --- GESTIONE STANZE (PASSO 1) ---
            if (parsedData.type === 'JOIN_ROOM') {
                const roomId = parsedData.payload.roomId;
                roomManager.joinRoom(roomId, ws);
                
                roomManager.broadcastToRoom(roomId, {
                    type: 'player_joined',
                    payload: { userId: currentUserId }
                }, ws); 
                return;
            }

            // 🟢 --- GESTIONE AZIONI LOBBY (PASSO 2) ---
            if (parsedData.type === 'PLAYER_READY') {
                await lobbyService.handlePlayerReady(parsedData.payload.roomId, currentUserId);
                return;
            }

            if (parsedData.type === 'LEAVE_ROOM') {
                await lobbyService.handleLeaveRoom(parsedData.payload.roomId, currentUserId, ws);
                return;
            }

            if (parsedData.type === 'START_GAME') {
                // 1. Notifica il lobby-service in REST e fa il broadcast al front-end
                await lobbyService.handleStartGame(parsedData.payload.roomId, currentUserId);
                
                // 2. Invia l'ordine al motore Go (come facevamo prima)
                const eventPayload = parsedData.payload || parsedData;
                const event = new Event(parsedData.type, eventPayload);
                await routingService.handleClientEvent(currentUserId, event);
                return;
            }
            // 🟢 ---------------------------------------

            // Gestione messaggi di Chat e Signaling
            if (parsedData.type === 'CHAT') {
                const message = new Message(parsedData.roomId, currentUserId, parsedData.content);
                await chatAndSignalingService.processChatMessage(message);
            } else if (parsedData.type === 'WEBRTC') {
                const message = new Message(parsedData.roomId, currentUserId, parsedData.content);
                await chatAndSignalingService.processWebRTCSignaling(message);
            } else {
                // Altri eventi di gioco (CAST_VOTE, ADVANCE_PHASE, etc.) vanno direttamente a Go
                const eventPayload = parsedData.payload || parsedData;
                const event = new Event(parsedData.type, eventPayload);
                await routingService.handleClientEvent(currentUserId, event);
            }
        } catch (error: any) {
            console.error(`[Gateway] ❌ Errore elaborazione messaggio da ${currentUserId}: ${error.message}`);
        }
    });

    ws.on('close', async () => {
        roomManager.leaveAllRooms(ws); // PULIZIA STANZE ALLA DISCONNESSIONE
        await sessionRepository.remove(currentUserId);
        activeSockets.delete(socketId);
        console.log(`[Gateway] 🚪 Client disconnesso: ${currentUserId}`);
    });

    ws.on('error', (error) => {
        console.error(`[Gateway] 🔥 Errore socket per ${currentUserId}:`, error);
    });
});

// HEARTBEAT: Pulisce le connessioni "morte" ogni 30 secondi
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

// SHUTDOWN LOGIC: Gestione SIGTERM/SIGINT
const shutdown = () => {
    console.log('[Gateway] Ricevuto segnale di spegnimento. Chiusura in corso...');
    clearInterval(interval);
    server.close(() => {
        console.log('[Gateway] Server HTTP/WebSocket chiuso.');
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Gateway pronto sulla porta ${port}`);
});