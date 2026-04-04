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
import { LobbyService } from './application/LobbyService';

interface AliveWebSocket extends WebSocket {
    isAlive?: boolean;
}

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const sessionRepository = new InMemorySessionRepository();
const engineAdapter = new HttpEngineAdapter(); 

const roomManager = new RoomManager();
const lobbyService = new LobbyService(roomManager); 

const routingService = new RoutingService(sessionRepository, engineAdapter);
const chatAndSignalingService = new ChatAndSignalingService(sessionRepository, roomManager);

const activeSockets = new Map<string, WebSocket>();
const userSockets = new Map<string, WebSocket>(); // userId → ws (for targeted delivery)

const userRooms = new Map<string, string>();
const roomSettings = new Map<string, { impostors: number }>(); // roomCode → settings
const pendingLeaves = new Map<string, NodeJS.Timeout>();
const LEAVE_GRACE_PERIOD_MS = 15_000;

// SERVER HTTP: Gestisce il Webhook per ascoltare gli eventi di Go
const server = createServer((req, res) => {
    // Absorb fire-and-forget notifications from lobby-service (no-op, comm-service drives the flow)
    if (req.method === 'POST' && req.url?.startsWith('/api/internal/lobby/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }

    if (req.method === 'POST' && req.url === '/internal/engine-callback') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const engineEvent = JSON.parse(body);
                const eventName = engineEvent.eventName || engineEvent.EventName;
                console.log(`[Webhook] 📢 Ricevuto da Go: ${eventName}`);

                if (eventName === 'GameCreated') {
                    const game = engineEvent.payload || {};
                    const secretWord = String(game.SecretWord || '');
                    const hint = String(game.Hint || '');
                    const roomCode = String(game.ID || '');

                    // Send each player only their own role (targeted delivery)
                    const players: any[] = game.Players || [];
                    players.forEach((player: any) => {
                        const playerWs = userSockets.get(String(player.ID));
                        if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                            const isImpostor = player.Role === 'IMPOSTOR';
                            playerWs.send(JSON.stringify({
                                type: 'ENGINE_EVENT',
                                payload: {
                                    eventName: 'RoleAssigned',
                                    role: String(player.Role),
                                    secretWord: isImpostor ? hint : secretWord,
                                    isImpostor
                                }
                            }));
                            console.log(`[Webhook] 📨 Role ${player.Role} sent to player ${player.ID}`);
                        } else {
                            console.log(`[Webhook] ⚠️ No active socket for player ${player.ID}`);
                        }
                    });

                    // Broadcast game_started to the whole room
                    if (roomCode) {
                        roomManager.broadcastToRoom(roomCode, {
                            type: 'game_started',
                            payload: { roomCode, status: 'STARTED' }
                        });
                    }
                } else {
                    // For other engine events, broadcast to all clients
                    const messageToBroadcast = JSON.stringify({
                        type: 'ENGINE_EVENT',
                        payload: engineEvent
                    });
                    wss.clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(messageToBroadcast);
                        }
                    });
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'Elaborato' }));
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
        let parsedData;

        // 🟢 GESTIONE ERRORI JSON (Invia errore al client)
        try {
            parsedData = JSON.parse(data.toString());
        } catch (e) {
            ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid JSON format' } }));
            return;
        }

        try {
            // 🟢 ESTRAZIONE WRAPPER 'EVENT' E NOMENCLATURA
            const eventType = parsedData.type === 'EVENT' ? parsedData.payload?.action : parsedData.type;
            const payload = parsedData.type === 'EVENT' ? parsedData.payload : (parsedData.payload || parsedData);
            
            console.log(`[Gateway] 📥 Ricevuto evento: ${eventType}`);

            if (eventType === 'IDENTIFY') {
                const newUserId = payload.userId;
                console.log(`[Gateway] 🆔 Cambio identità: ${currentUserId} -> ${newUserId}`);
                
                await sessionRepository.remove(currentUserId);

                // Move room mapping from temp ID to real ID
                const existingRoom = userRooms.get(currentUserId);
                if (existingRoom) {
                    userRooms.delete(currentUserId);
                    userRooms.set(newUserId, existingRoom);
                }

                // Update targeted socket mapping
                userSockets.delete(currentUserId);
                userSockets.set(newUserId, ws);

                currentUserId = newUserId;
                
                // Cancel any pending leave for this user (reconnection after refresh)
                if (pendingLeaves.has(currentUserId)) {
                    clearTimeout(pendingLeaves.get(currentUserId)!);
                    pendingLeaves.delete(currentUserId);
                    console.log(`[Gateway] 🔄 Pending leave cancelled for reconnected user: ${currentUserId}`);
                }
                
                const newSession = new Session(currentUserId);
                newSession.addConnection(new Connection(socketId));
                await sessionRepository.save(newSession);
                return;
            }

            // 🟢 Supporta 'roomCode' (richiesto) o 'roomId' (fallback)
            const roomCode = payload.roomCode || payload.roomId;

            if (eventType === 'join_room' || eventType === 'JOIN_ROOM') {
                roomManager.joinRoom(roomCode, ws);

                // Track which room this user is in
                userRooms.set(currentUserId, roomCode);

                // Cancel any pending leave (reconnection after refresh)
                if (pendingLeaves.has(currentUserId)) {
                    clearTimeout(pendingLeaves.get(currentUserId)!);
                    pendingLeaves.delete(currentUserId);
                    console.log(`[Gateway] 🔄 Pending leave cancelled on join_room for: ${currentUserId}`);
                }

                roomManager.broadcastToRoom(roomCode, {
                    type: 'player_joined',
                    payload: { userId: currentUserId, username: payload.username }
                }, ws); 
                await lobbyService.syncRoomState(roomCode);
                return;
            }

            if (eventType === 'player_ready' || eventType === 'toggle_ready' || eventType === 'PLAYER_READY') {
                await lobbyService.handlePlayerReady(roomCode, currentUserId, payload.ready);
                return;
            }

            if (eventType === 'leave_room' || eventType === 'LEAVE_ROOM') {
                userRooms.delete(currentUserId);
                if (pendingLeaves.has(currentUserId)) {
                    clearTimeout(pendingLeaves.get(currentUserId)!);
                    pendingLeaves.delete(currentUserId);
                }
                await lobbyService.handleLeaveRoom(roomCode, currentUserId, ws);
                return;
            }

            if (eventType === 'update_settings' || eventType === 'UPDATE_SETTINGS') {
                if (roomCode && payload.settings) {
                    const cur = roomSettings.get(roomCode) || { impostors: 1 };
                    roomSettings.set(roomCode, { impostors: payload.settings.impostors ?? cur.impostors });
                }
                await lobbyService.handleUpdateSettings(roomCode, currentUserId, payload.settings);
                return;
            }

            if (eventType === 'start_game' || eventType === 'START_GAME') {
                const hostId = payload.hostId || currentUserId;
                const playerIds = await lobbyService.handleStartGame(roomCode, hostId);
                if (playerIds && playerIds.length > 0) {
                    const settings = roomSettings.get(roomCode);
                    const requestedImpostors = settings?.impostors ?? 1;
                    await engineAdapter.createGame(roomCode, playerIds, requestedImpostors);
                }
                return;
            }

            if (eventType === 'CHAT') {
                const message = new Message(roomCode, currentUserId, payload);
                await chatAndSignalingService.processChatMessage(message, ws);
            } else if (eventType === 'WEBRTC') {
                const message = new Message(roomCode, currentUserId, payload);
                await chatAndSignalingService.processWebRTCSignaling(message, ws);
            } else {
                // Eventi di gioco (START_GAME, CAST_VOTE, etc.)
                const eventPayload = parsedData.payload || parsedData;
                const event = new Event(parsedData.type, eventPayload);
                await routingService.handleClientEvent(currentUserId, event);
            }
        } catch (error: any) {
            console.error(`[Gateway] ❌ Errore elaborazione messaggio da ${currentUserId}: ${error.message}`);
            ws.send(JSON.stringify({ type: 'error', payload: { message: error.message } })); 
        }
    });

    ws.on('close', async () => {
        roomManager.leaveAllRooms(ws); 
        userSockets.delete(currentUserId);
        await sessionRepository.remove(currentUserId);
        activeSockets.delete(socketId);

        const roomCode = userRooms.get(currentUserId);
        if (roomCode) {
            userRooms.delete(currentUserId);
            const closedUserId = currentUserId;
            const timeout = setTimeout(async () => {
                try {
                    console.log(`[Gateway] ⏰ Grace period expired for ${closedUserId} in room ${roomCode}. Removing from lobby.`);
                    await lobbyService.handleLeaveRoom(roomCode, closedUserId, ws);
                } catch (e: any) {
                    console.error(`[Gateway] ❌ Error during grace period leave: ${e.message}`);
                }
                pendingLeaves.delete(closedUserId);
            }, LEAVE_GRACE_PERIOD_MS);
            pendingLeaves.set(closedUserId, timeout);
            console.log(`[Gateway] 🕐 Grace period started for ${currentUserId} (${LEAVE_GRACE_PERIOD_MS}ms).`);
        }

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