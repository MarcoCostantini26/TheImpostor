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
const roomSettings = new Map<string, { impostors: number; discussionTime: number }>(); 
const pendingLeaves = new Map<string, NodeJS.Timeout>();
const LEAVE_GRACE_PERIOD_MS = 15_000;

// ─── GESTIONE TURNI E INDIZI ─────────────────────────────────────────────────
const CLUE_TURN_SECONDS = 15;
const FREE_DISCUSSION_SECONDS = 60;
const roomDiscussionTimers = new Map<string, NodeJS.Timeout>(); 
const roomDiscussionExpiry = new Map<string, number>(); 
const roomClues = new Map<string, Record<string, string>>();
const roomVotingExpiry = new Map<string, number>();
const roomVotes = new Map<string, { voterId: string; targetId: string }[]>();
const roomAlivePlayers = new Map<string, string[]>();
const NEW_ROUND_DELAY_MS = 5_000;
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
            payload: { yourTurn: true, activePlayerId, seconds: CLUE_TURN_SECONDS, fullSeconds: CLUE_TURN_SECONDS, expiresAt: state.expiresAt }
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
        const roomDiscSeconds = roomSettings.get(roomCode)?.discussionTime ?? FREE_DISCUSSION_SECONDS;
        const discExpiry = Date.now() + roomDiscSeconds * 1000;
        roomManager.broadcastToRoom(roomCode, {
            type: 'discussion_phase_started',
            payload: { roomCode, seconds: roomDiscSeconds, expiresAt: discExpiry }
        });
        
        const discussionTimer = setTimeout(async () => {
            try {
                await engineAdapter.advanceToVoting(roomCode);
            } catch (e: any) {
                console.error(`[Turn] ❌ Errore auto-advance voting: ${e.message}`);
            }
            roomDiscussionTimers.delete(roomCode);
            roomDiscussionExpiry.delete(roomCode);
        }, roomDiscSeconds * 1000);
        
        roomDiscussionTimers.set(roomCode, discussionTimer);
        roomDiscussionExpiry.set(roomCode, Date.now() + roomDiscSeconds * 1000);
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

    // Absorb fire-and-forget notifications from lobby-service (no-op, comm-service drives the flow)
    if (req.method === 'POST' && req.url?.startsWith('/api/internal/lobby/')) {
        console.log(`[Internal] ${req.method} ${req.url} received from ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`);
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
                            console.log(`[Webhook] 📨 Role ${player.Role} sent to player ${player.ID}`);
                        } else {
                            console.log(`[Webhook] ⚠️ No active socket for player ${player.ID}`);
                        }
                    });

                    if (roomCode) {
                        roomManager.broadcastToRoom(roomCode, {
                            type: 'game_started',
                            payload: { roomCode, status: 'STARTED' }
                        });
                        roomClues.set(roomCode, {});
                        const turnQueue: string[] = players.map((p: any) => String(p.ID)).filter(Boolean);
                        roomAlivePlayers.set(roomCode, [...turnQueue]);
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

                    const newPhase = String(ep.newPhase || ep.NewPhase || 'VOTING').toUpperCase();
                    const timerSeconds = Number(ep.timer || ep.Timer) || 60;
                    if (newPhase === 'VOTING') {
                        roomVotingExpiry.set(roomCode, Date.now() + timerSeconds * 1000);
                        roomVotes.set(roomCode, []);
                    }

                    const votingExpiry = newPhase === 'VOTING' ? roomVotingExpiry.get(roomCode) : undefined;
                    roomManager.broadcastToRoom(roomCode, {
                        type: 'ENGINE_EVENT',
                        payload: { eventName: 'PhaseChanged', gameId: roomCode, newPhase, timer: timerSeconds, ...(votingExpiry ? { expiresAt: votingExpiry } : {}) }
                    });
                    console.log(`[Webhook] 🔁 PhaseChanged broadcast for room ${roomCode} -> ${newPhase}`);
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
                    // Normalize engine event so payload fields are accessible at top-level
                    const rawPayload = engineEvent.payload || {};
                    const normalizedPayload = { eventName: engineEvent.eventName, ...rawPayload };
                    const eventToBroadcast = { type: 'ENGINE_EVENT', payload: normalizedPayload };
                    const targetRoom = rawPayload.gameId || engineEvent.gameId || rawPayload.GameID;

                    // Track votes for reconnect recovery
                    if (engineEvent.eventName === 'PlayerVoted' && targetRoom) {
                        const voterId = String(rawPayload.voterId || rawPayload.VoterId || '');
                        const targetId = String(rawPayload.targetId || rawPayload.TargetId || '');
                        if (voterId && targetId) {
                            const votes = roomVotes.get(String(targetRoom)) || [];
                            const idx = votes.findIndex(v => v.voterId === voterId);
                            if (idx !== -1) votes[idx] = { voterId, targetId };
                            else votes.push({ voterId, targetId });
                            roomVotes.set(String(targetRoom), votes);
                        }
                    }

                    // Clear voting data and restart clue-submission round when resolved
                    if ((engineEvent.eventName === 'VotingResolved') && targetRoom) {
                        roomVotingExpiry.delete(String(targetRoom));
                        roomVotes.delete(String(targetRoom));

                        const eliminatedId = rawPayload.eliminatedId || rawPayload.EliminatedId || '';
                        if (eliminatedId) {
                            const alive = roomAlivePlayers.get(String(targetRoom)) || [];
                            roomAlivePlayers.set(String(targetRoom), alive.filter(id => id !== eliminatedId));
                        }

                        // Delay before starting new round so clients can display the popup
                        const roomCodeForNewRound = String(targetRoom);
                        setTimeout(() => {
                            const queue = [...(roomAlivePlayers.get(roomCodeForNewRound) || [])];
                            if (queue.length > 0) {
                                roomClues.set(roomCodeForNewRound, {});
                                roomTurns.set(roomCodeForNewRound, { queue, index: 0, timer: null });
                                startTurn(roomCodeForNewRound);
                            }
                        }, NEW_ROUND_DELAY_MS);
                    }

                    // Clean up alive-player tracking when the game ends
                    if ((engineEvent.eventName === 'GameEnded') && targetRoom) {
                        roomAlivePlayers.delete(String(targetRoom));
                    }

                    console.log(`[Webhook] 🔁 Broadcasting normalized event ${engineEvent.eventName} to room ${targetRoom || 'ALL'}`);

                    if (targetRoom) {
                        roomManager.broadcastToRoom(String(targetRoom), eventToBroadcast);
                    } else {
                        const messageString = JSON.stringify(eventToBroadcast);
                        wss.clients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) client.send(messageString);
                        });
                    }
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
                                    // If engine reports voting phase, restore it for the reconnecting client
                                    try {
                                        const votingExpiry = roomVotingExpiry.get(roomCodeForUser);
                                        if (votingExpiry && votingExpiry > Date.now()) {
                                            const remaining = Math.max(0, Math.ceil((votingExpiry - Date.now()) / 1000));
                                            console.log(`[Gateway] 🔁 Sending PhaseChanged voting recovery to ${currentUserId} for room ${roomCodeForUser} (remaining ${remaining}s)`);
                                            ws.send(JSON.stringify({ type: 'ENGINE_EVENT', payload: { eventName: 'PhaseChanged', newPhase: 'VOTING', timer: remaining, expiresAt: votingExpiry, gameId: roomCodeForUser } }));
                                            const votes = roomVotes.get(roomCodeForUser) || [];
                                            for (const v of votes) {
                                                ws.send(JSON.stringify({ type: 'ENGINE_EVENT', payload: { eventName: 'PlayerVoted', voterId: v.voterId, targetId: v.targetId, gameId: roomCodeForUser } }));
                                            }
                                        } else {
                                            const reportedPhase = gameState?.Phase || gameState?.phase || gameState?.CurrentTurn?.Phase || gameState?.currentPhase;
                                            const reportedTimer = gameState?.Timer || gameState?.timer || gameState?.CurrentTurn?.Timer || gameState?.timerSeconds;
                                            if (reportedPhase && String(reportedPhase).toUpperCase() === 'VOTING') {
                                                const timerValue = Number(reportedTimer) || 60;
                                                console.log(`[Gateway] 🔁 Sending PhaseChanged recovery (engine fallback) to ${currentUserId} for room ${roomCodeForUser} (timer ${timerValue})`);
                                                ws.send(JSON.stringify({ type: 'ENGINE_EVENT', payload: { eventName: 'PhaseChanged', newPhase: 'VOTING', timer: timerValue, gameId: roomCodeForUser } }));
                                            }
                                        }
                                    } catch (e) { /* ignore recovery errors */ }
                                }
                            }
                        } catch (e) {}

                        // Recovery discussion phase
                        const discExpiry = roomDiscussionExpiry.get(roomCodeForUser);
                        if (discExpiry && discExpiry > Date.now()) {
                            const remaining = Math.max(0, Math.ceil((discExpiry - Date.now()) / 1000));
                            console.log(`[Gateway] 🔁 Sending discussion_phase_started recovery to ${currentUserId} for room ${roomCodeForUser} (remaining ${remaining}s)`);
                            ws.send(JSON.stringify({ type: 'discussion_phase_started', payload: { roomCode: roomCodeForUser, seconds: remaining, expiresAt: discExpiry } }));
                        }
                        // Send alive players list so client can mark eliminated players as dead on reconnect
                        const alivePlayerIdsForUser = roomAlivePlayers.get(roomCodeForUser);
                        if (alivePlayerIdsForUser && alivePlayerIdsForUser.length > 0) {
                            roomManager.broadcastToRoom(roomCodeForUser, { type: 'players_status', payload: { alivePlayerIds: alivePlayerIdsForUser, roomCode: roomCodeForUser } });
                        }
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
                    } else {
                        // Recovery discussion phase
                        const discExpiry = roomDiscussionExpiry.get(roomCode);
                        if (discExpiry && discExpiry > Date.now()) {
                            const remaining = Math.max(0, Math.ceil((discExpiry - Date.now()) / 1000));
                            ws.send(JSON.stringify({ type: 'discussion_phase_started', payload: { roomCode, seconds: remaining, expiresAt: discExpiry } }));
                        } else {
                            // Recovery voting phase
                            const votingExpiry = roomVotingExpiry.get(roomCode);
                            if (votingExpiry && votingExpiry > Date.now()) {
                                const remaining = Math.max(0, Math.ceil((votingExpiry - Date.now()) / 1000));
                                ws.send(JSON.stringify({ type: 'ENGINE_EVENT', payload: { eventName: 'PhaseChanged', newPhase: 'VOTING', timer: remaining, expiresAt: votingExpiry, gameId: roomCode } }));
                                const votes = roomVotes.get(roomCode) || [];
                                for (const v of votes) {
                                    ws.send(JSON.stringify({ type: 'ENGINE_EVENT', payload: { eventName: 'PlayerVoted', voterId: v.voterId, targetId: v.targetId, gameId: roomCode } }));
                                }
                            }
                        }
                    }
                    // Send alive players list so client can mark eliminated players as dead on reconnect
                    const alivePlayerIds = roomAlivePlayers.get(roomCode);
                    if (alivePlayerIds && alivePlayerIds.length > 0) {
                        roomManager.broadcastToRoom(roomCode, { type: 'players_status', payload: { alivePlayerIds, roomCode } });
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
                    const cur = roomSettings.get(roomCode) || { impostors: 1, discussionTime: 60 };
                    roomSettings.set(roomCode, { impostors: payload.settings.impostors ?? cur.impostors, discussionTime: payload.settings.discussionTime ?? cur.discussionTime });
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

                // Notify all clients (includiamo anche il mittente) so everyone resets/updates the timer consistently
                roomManager.broadcastToRoom(roomCode, {
                    type: 'clue_submitted',
                    payload: { userId: currentUserId, username: payload.username || '', clue: clueText }
                });

                advanceTurn(roomCode);
                return;
            }

            if (eventType === 'start_game' || eventType === 'START_GAME') {
                const hostId = payload.hostId || currentUserId;

                // 1. Aggiorna lo stato della lobby e prendi la lista finale dei playerIds restituiti
                const playerIds = await lobbyService.handleStartGame(roomCode, hostId) || [];

                // 2. Recupera la parola del round dal lobby-service (DB)
                const wordEntry = await lobbyService.getNextWord(roomCode);
                const secretWord = wordEntry?.word || '';
                const hint = wordEntry?.impostorClue || '';

                // 3. Inoltra l'intero payload (arricchito con gameId, playerIds, impostori e parola) al RoutingService
                const settings = roomSettings.get(roomCode);
                const requestedImpostors = settings?.impostors ?? 1;
                const enrichedPayload = { ...payload, gameId: roomCode, playerIds, requestedImpostors, secretWord, hint };
                const event = new Event('START_GAME', enrichedPayload);
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
                // Block eliminated players from sending messages
                const aliveInRoom = roomAlivePlayers.get(roomCode);
                if (aliveInRoom && !aliveInRoom.includes(currentUserId)) {
                    ws.send(JSON.stringify({ type: 'error', payload: { message: 'Eliminated players cannot send messages' } }));
                    return;
                }
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