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
const userSockets = new Map<string, WebSocket>(); // userId → ws (per messaggi privati come i ruoli)

const userRooms = new Map<string, string>();
const roomSettings = new Map<string, { impostors: number }>(); 
const pendingLeaves = new Map<string, NodeJS.Timeout>();
const LEAVE_GRACE_PERIOD_MS = 15_000;

// ─── GESTIONE TURNI E INDIZI ─────────────────────────────────────────────────
const CLUE_TURN_SECONDS = 15;
const FREE_DISCUSSION_SECONDS = 60;
const roomDiscussionTimers = new Map<string, NodeJS.Timeout>(); 
const roomDiscussionExpiry = new Map<string, number>(); 
const roomClues = new Map<string, Record<string, string>>(); 
interface TurnState {
    queue: string[];   
    index: number;     
    timer: NodeJS.Timeout | null;
    expiresAt?: number; 
}
const roomTurns = new Map<string, TurnState>(); 

function startTurn(roomCode: string) {
    const state = roomTurns.get(roomCode);
    if (!state) return;
    if (state.timer) clearTimeout(state.timer);
    const activePlayerId = state.queue[state.index];
    const playerWs = userSockets.get(activePlayerId);

    state.expiresAt = Date.now() + CLUE_TURN_SECONDS * 1000;

    roomManager.broadcastToRoom(roomCode, {
        type: 'turn_started',
        payload: { yourTurn: false, activePlayerId, seconds: CLUE_TURN_SECONDS, fullSeconds: CLUE_TURN_SECONDS, expiresAt: state.expiresAt }
    });
    
    if (playerWs && playerWs.readyState === WebSocket.OPEN) {
        playerWs.send(JSON.stringify({
            type: 'turn_started',
            payload: { yourTurn: true, seconds: CLUE_TURN_SECONDS, fullSeconds: CLUE_TURN_SECONDS, expiresAt: state.expiresAt }
        }));
    }

    state.timer = setTimeout(() => {
        advanceTurn(roomCode);
    }, CLUE_TURN_SECONDS * 1000);
}

function advanceTurn(roomCode: string) {
    const state = roomTurns.get(roomCode);
    if (!state) return;
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }

    state.index++;
    if (state.index >= state.queue.length) {
        roomTurns.delete(roomCode);
        roomManager.broadcastToRoom(roomCode, {
            type: 'discussion_phase_started',
            payload: { roomCode, seconds: FREE_DISCUSSION_SECONDS }
        });
        
        const discussionTimer = setTimeout(async () => {
            try {
                await engineAdapter.advanceToVoting(roomCode);
            } catch (e: any) {
                console.error(`[Turn] ❌ Errore auto-advance voting: ${e.message}`);
            }
            roomDiscussionTimers.delete(roomCode);
            roomDiscussionExpiry.delete(roomCode);
        }, FREE_DISCUSSION_SECONDS * 1000);
        
        roomDiscussionTimers.set(roomCode, discussionTimer);
        roomDiscussionExpiry.set(roomCode, Date.now() + FREE_DISCUSSION_SECONDS * 1000);
        return;
    }
    startTurn(roomCode);
}

// SERVER HTTP: Gestisce il Webhook per ascoltare gli eventi di Go
const server = createServer(async (req, res) => {
    // Proxy per recuperare lo stato
    if (req.method === 'GET' && req.url?.startsWith('/api/games/state')) {
        const gameId = new URL(req.url, `http://localhost`).searchParams.get('gameId') || '';
        try {
            const state = await engineAdapter.getGameState(gameId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(state));
        } catch (e: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
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

                    // Invio privato dei ruoli (e della parola segreta)
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
                        }
                    });

                    if (roomCode) {
                        roomManager.broadcastToRoom(roomCode, {
                            type: 'game_started',
                            payload: { roomCode, status: 'STARTED' }
                        });
                        roomClues.set(roomCode, {});
                        const turnQueue: string[] = players.map((p: any) => String(p.ID)).filter(Boolean);
                        roomTurns.set(roomCode, { queue: turnQueue, index: 0, timer: null });
                        setTimeout(() => startTurn(roomCode), 500);
                    }
                } else if (eventName === 'PhaseChanged') {
                    const ep = engineEvent.payload || {};
                    const roomCode = String(ep.gameId || ep.GameID || '');
                    const ts = roomTurns.get(roomCode);
                    if (ts?.timer) { clearTimeout(ts.timer); }
                    roomTurns.delete(roomCode);
                    const dt = roomDiscussionTimers.get(roomCode);
                    if (dt) { clearTimeout(dt); roomDiscussionTimers.delete(roomCode); }
                    if (roomDiscussionExpiry.has(roomCode)) roomDiscussionExpiry.delete(roomCode);
                    
                    roomManager.broadcastToRoom(roomCode, {
                        type: 'ENGINE_EVENT',
                        payload: { eventName: 'PhaseChanged', gameId: roomCode, newPhase: ep.newPhase || ep.NewPhase || 'VOTING', timer: ep.timer || ep.Timer || 60 }
                    });
                } else if (eventName === 'GameEnded') {
                    const ep = engineEvent.payload || {};
                    const roomCode = String(ep.gameId || ep.GameID || '');
                    if (roomCode) {
                        roomManager.broadcastToRoom(roomCode, {
                            type: 'ENGINE_EVENT',
                            payload: {
                                eventName: 'GameEnded',
                                gameId: roomCode,
                                winner: ep.winner || ep.Winner || '',
                                reason: ep.reason || ep.Reason || '' // Essenziale per "WORD_GUESSED"
                            }
                        });
                    }
                } else {
                    // Fallback per tutti gli altri eventi (es. VotingResolved, ImpostorGuessPhase)
                    const eventToBroadcast = { type: 'ENGINE_EVENT', payload: engineEvent };
                    const targetRoom = engineEvent.payload?.gameId || engineEvent.gameId || engineEvent.payload?.GameID;

                    if (targetRoom) {
                        roomManager.broadcastToRoom(targetRoom, eventToBroadcast);
                    } else {
                        const messageString = JSON.stringify(eventToBroadcast);
                        wss.clients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) client.send(messageString);
                        });
                    }
                }
                
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

const wss = new WebSocketServer({ server });

wss.on('connection', async (ws: WebSocket) => {
    const extWs = ws as AliveWebSocket;
    extWs.isAlive = true;

    extWs.on('pong', () => {
        extWs.isAlive = true;
    });

    let currentUserId = `temp-${randomUUID()}`;
    const socketId = randomUUID();

    activeSockets.set(socketId, ws);

    const session = new Session(currentUserId);
    session.addConnection(new Connection(socketId));
    await sessionRepository.save(session);

    console.log(`[Gateway] 🔌 Nuova connessione. ID provvisorio: ${currentUserId}`);

    ws.on('message', async (data: RawData) => {
        let parsedData;

        try {
            parsedData = JSON.parse(data.toString());
        } catch (e) {
            ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid JSON format' } }));
            return;
        }

        try {
            const eventType = parsedData.type === 'EVENT' ? parsedData.payload?.action : parsedData.type;
            const payload = parsedData.type === 'EVENT' ? parsedData.payload : (parsedData.payload || parsedData);
            
            console.log(`[Gateway] 📥 Ricevuto evento: ${eventType}`);

            if (eventType === 'IDENTIFY') {
                const newUserId = payload.userId;
                console.log(`[Gateway] 🆔 Cambio identità: ${currentUserId} -> ${newUserId}`);
                
                await sessionRepository.remove(currentUserId);

                const existingRoom = userRooms.get(currentUserId);
                if (existingRoom) {
                    userRooms.delete(currentUserId);
                    userRooms.set(newUserId, existingRoom);
                }

                userSockets.delete(currentUserId);
                userSockets.set(newUserId, ws); // Tracciamo il socket per i ruoli privati

                currentUserId = newUserId;
                
                if (pendingLeaves.has(currentUserId)) {
                    clearTimeout(pendingLeaves.get(currentUserId)!);
                    pendingLeaves.delete(currentUserId);
                }
                
                const newSession = new Session(currentUserId);
                newSession.addConnection(new Connection(socketId));
                await sessionRepository.save(newSession);

                // Tentativo di recovery dello stato dei turni e del ruolo
                try {
                    const roomCodeForUser = userRooms.get(currentUserId);
                    if (roomCodeForUser) {
                        const ts = roomTurns.get(roomCodeForUser);
                        if (ts && ts.queue && ts.queue.length > 0) {
                            const activePlayerId = ts.queue[ts.index];
                            const remaining = ts.expiresAt ? Math.max(0, Math.ceil((ts.expiresAt - Date.now()) / 1000)) : CLUE_TURN_SECONDS;
                            const isMyTurn = currentUserId === activePlayerId;
                            ws.send(JSON.stringify({ type: 'turn_started', payload: { yourTurn: isMyTurn, activePlayerId, seconds: remaining, fullSeconds: CLUE_TURN_SECONDS, expiresAt: ts.expiresAt } }));
                        }
                        
                        try {
                            const gameState = await engineAdapter.getGameState(roomCodeForUser);
                            const playersList = gameState?.Players || gameState?.players || null;
                            if (Array.isArray(playersList)) {
                                const me = playersList.find((p: any) => String(p.ID || p.id || p.playerId) === String(currentUserId));
                                if (me) {
                                    const globalSecret = gameState?.SecretWord || gameState?.secretWord || '';
                                    const globalHint = gameState?.Hint || gameState?.hint || '';
                                    const roleVal = String(me.Role || me.role || 'CREWMATE');
                                    const isImpostor = (me.Role || me.role) === 'IMPOSTOR' || (me.Role || me.role) === 'Impostor';
                                    const secretWord = isImpostor ? (globalHint || me.Hint) : (globalSecret || me.SecretWord);
                                    ws.send(JSON.stringify({ type: 'ENGINE_EVENT', payload: { eventName: 'RoleAssigned', role: roleVal, secretWord, isImpostor } }));
                                }
                            }
                        } catch (e) {}
                    }
                } catch (err) {}

                return;
            }

            const roomCode = payload.roomCode || payload.roomId;

            if (eventType === 'join_room' || eventType === 'JOIN_ROOM') {
                roomManager.joinRoom(roomCode, ws);
                userRooms.set(currentUserId, roomCode);

                if (pendingLeaves.has(currentUserId)) {
                    clearTimeout(pendingLeaves.get(currentUserId)!);
                    pendingLeaves.delete(currentUserId);
                }

                roomManager.broadcastToRoom(roomCode, {
                    type: 'player_joined',
                    payload: { userId: currentUserId, username: payload.username }
                }, ws); 
                await lobbyService.syncRoomState(roomCode);

                // Recovery indizi e turni
                try {
                    const clues = roomClues.get(roomCode) || {};
                    ws.send(JSON.stringify({ type: 'clues_state', payload: { clues } }));
                    
                    const ts = roomTurns.get(roomCode);
                    if (ts && ts.queue && ts.queue.length > 0) {
                        const activePlayerId = ts.queue[ts.index];
                        const remaining = ts.expiresAt ? Math.max(0, Math.ceil((ts.expiresAt - Date.now()) / 1000)) : CLUE_TURN_SECONDS;
                        ws.send(JSON.stringify({ type: 'turn_started', payload: { yourTurn: currentUserId === activePlayerId, activePlayerId, seconds: remaining, fullSeconds: CLUE_TURN_SECONDS, expiresAt: ts.expiresAt } }));
                    }
                } catch (e) {}
                
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

            if (eventType === 'submit_clue' || eventType === 'SUBMIT_CLUE') {
                const clueText = String(payload.clue || '').toUpperCase();
                const ts = roomTurns.get(roomCode);
                const activePlayerId = ts?.queue?.[ts.index];

                if (!ts || !activePlayerId || activePlayerId !== currentUserId) {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Not your turn or no active turn' } }));
                    return;
                }

                const existing = roomClues.get(roomCode) || {};
                if (existing[currentUserId]) {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Clue already submitted' } }));
                    return;
                }

                existing[currentUserId] = clueText;
                roomClues.set(roomCode, existing);

                roomManager.broadcastToRoom(roomCode, {
                    type: 'clue_submitted',
                    payload: { userId: currentUserId, username: payload.username || '', clue: clueText }
                }, ws);

                advanceTurn(roomCode);
                return;
            }

            if (eventType === 'start_game' || eventType === 'START_GAME') {
                const hostId = payload.hostId || currentUserId;
                
                // 1. Aggiorna lo stato della lobby
                await lobbyService.handleStartGame(roomCode, hostId);
                
                // 2. Inoltra l'intero payload (che contiene già playerIds e secretWord) al RoutingService
                const event = new Event(eventType, payload);
                await routingService.handleClientEvent(currentUserId, event);
                return;
            }

            if (eventType === 'ADVANCE_PHASE' || eventType === 'advance_phase') {
                const gameRoomCode = payload.gameId || roomCode || userRooms.get(currentUserId) || '';
                if (gameRoomCode) {
                    const ts = roomTurns.get(gameRoomCode);
                    if (ts?.timer) { clearTimeout(ts.timer); }
                    roomTurns.delete(gameRoomCode);
                    const dt = roomDiscussionTimers.get(gameRoomCode);
                    if (dt) { clearTimeout(dt); roomDiscussionTimers.delete(gameRoomCode); }
                }
                const eventObj = new Event(eventType, payload);
                await routingService.handleClientEvent(currentUserId, eventObj);
                return;
            }

            if (eventType === 'CHAT') {
                const message = new Message(roomCode, currentUserId, payload);
                await chatAndSignalingService.processChatMessage(message, ws);
            } else if (eventType === 'WEBRTC') {
                const message = new Message(roomCode, currentUserId, payload);
                await chatAndSignalingService.processWebRTCSignaling(message, ws);
            } else {
                // Gestisce tutti gli altri eventi, incluso GUESS_WORD
                const eventPayload = parsedData.payload || parsedData;
                const event = new Event(eventType, eventPayload);
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
                    await lobbyService.handleLeaveRoom(roomCode, closedUserId, ws);
                } catch (e: any) {
                    console.error(`[Gateway] ❌ Error during grace period leave: ${e.message}`);
                }
                pendingLeaves.delete(closedUserId);
            }, LEAVE_GRACE_PERIOD_MS);
            pendingLeaves.set(closedUserId, timeout);
        }

        console.log(`[Gateway] 🚪 Client disconnesso: ${currentUserId}`);
    });

    ws.on('error', (error) => {
        console.error(`[Gateway] 🔥 Errore socket per ${currentUserId}:`, error);
    });
});

const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        const extWs = ws as AliveWebSocket;
        if (extWs.isAlive === false) {
            return extWs.terminate();
        }
        extWs.isAlive = false;
        extWs.ping();
    });
}, 30000);

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