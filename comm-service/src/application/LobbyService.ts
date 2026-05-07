import { RoomManager } from './RoomManager';

export class LobbyService {
    private readonly lobbyUrl: string;

    constructor(private roomManager: RoomManager) {
        this.lobbyUrl = process.env.LOBBY_URL || 'http://localhost:8080';
    }

    async syncRoomState(roomCode: string): Promise<void> {
        try {
            const response = await fetch(`${this.lobbyUrl}/api/internal/rooms/${roomCode}`);
            if (response.ok) {
                const roomState = await response.json();
                this.roomManager.broadcastToRoom(roomCode, { type: 'room_update', payload: roomState });
            }
        } catch (error: any) {
            console.error(`[LobbyService] Errore syncRoomState per ${roomCode}: ${error.message}`);
        }
    }

    async handlePlayerReady(roomId: string, userId: string, ready?: boolean): Promise<void> {
        try {
            this.roomManager.broadcastToRoom(roomId, {
                type: 'player_ready',
                payload: { userId, ready }
            });
            console.log(`[LobbyService] Stato ready aggiornato per ${userId}.`);
        } catch (error: any) {
            console.error(`[LobbyService] Errore in handlePlayerReady: ${error.message}`);
        }
    }

    async handleStartGame(roomId: string, userId: string): Promise<string[] | null> {
        try {
            const response = await fetch(`${this.lobbyUrl}/api/rooms/${roomId}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hostId: userId }) 
            });

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                throw new Error(`Errore avvio partita nel lobby-service [${response.status}]: ${body}`);
            }

            const data = await response.json();
            this.roomManager.broadcastToRoom(roomId, {
                type: 'game_started',
                payload: { roomId }
            });
            await this.syncRoomState(roomId);
            console.log(`[LobbyService] Partita ${roomId} avviata! Broadcast inviato.`);
            return Array.isArray(data.playerIds) ? data.playerIds : [];

        } catch (error: any) {
            console.error(`[LobbyService] Errore in handleStartGame: ${error.message}`);
            return null;
        }
    }

    async handleLeaveRoom(roomId: string, userId: string, ws: any): Promise<void> {
        try {
            this.roomManager.leaveRoom(roomId, ws);

            try {
                await fetch(`${this.lobbyUrl}/api/rooms/${roomId}/leave`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ playerId: userId })
                });
            } catch (apiError: any) {
                console.error(`[LobbyService] Could not call leave API for ${userId}: ${apiError.message}`);
            }

            this.roomManager.broadcastToRoom(roomId, {
                type: 'player_left',
                payload: { userId }
            });
            await this.syncRoomState(roomId);
            console.log(`[LobbyService] ${userId} ha lasciato la stanza ${roomId}.`);
        } catch (error: any) {
            console.error(`[LobbyService] Errore in handleLeaveRoom: ${error.message}`);
        }
    }

    async handleUpdateSettings(roomId: string, userId: string, settings: any): Promise<void> {
        try {
            try {
                await fetch(`${this.lobbyUrl}/api/rooms/${roomId}/settings`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        hostId: userId,
                        impostors: settings.impostors,
                        discussionTime: settings.discussionTime
                    })
                });
            } catch (apiError: any) {
                console.error(`[LobbyService] Could not persist settings for ${roomId}: ${apiError.message}`);
            }

            this.roomManager.broadcastToRoom(roomId, {
                type: 'update_settings',
                payload: settings
            });
            console.log(`[LobbyService] Impostazioni stanza ${roomId} aggiornate da ${userId}.`);
        } catch (error: any) {
            console.error(`[LobbyService] Errore in handleUpdateSettings: ${error.message}`);
        }
    }

    async getNextWord(roomCode: string): Promise<{ word: string; impostorClue: string } | null> {
        try {
            const response = await fetch(`${this.lobbyUrl}/api/internal/games/${roomCode}/next-word`);
            if (response.ok) {
                const data = await response.json();
                return { word: String(data.word || ''), impostorClue: String(data.impostorClue || '') };
            }
            console.error(`[LobbyService] getNextWord HTTP ${response.status} per ${roomCode}`);
        } catch (error: any) {
            console.error(`[LobbyService] Errore getNextWord per ${roomCode}: ${error.message}`);
        }
        return null;
    }
}