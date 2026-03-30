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
            console.error(`[LobbyService] ❌ Errore syncRoomState per ${roomCode}: ${error.message}`);
        }
    }

    async handlePlayerReady(roomId: string, userId: string, ready?: boolean): Promise<void> {
        try {
            this.roomManager.broadcastToRoom(roomId, {
                type: 'player_ready',
                payload: { userId, ready }
            });
            console.log(`[LobbyService] 🔄 Stato ready aggiornato per ${userId}.`);
        } catch (error: any) {
            console.error(`[LobbyService] ❌ Errore in handlePlayerReady: ${error.message}`);
        }
    }

    async handleStartGame(roomId: string, userId: string): Promise<void> {
        try {
            const response = await fetch(`${this.lobbyUrl}/api/rooms/${roomId}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hostId: userId }) 
            });

            if (!response.ok) throw new Error('Errore avvio partita nel lobby-service');

            this.roomManager.broadcastToRoom(roomId, {
                type: 'game_started',
                payload: { roomId }
            });
            await this.syncRoomState(roomId);
            console.log(`[LobbyService] 🚀 Partita ${roomId} avviata! Broadcast inviato.`);
        } catch (error: any) {
            console.error(`[LobbyService] ❌ Errore in handleStartGame: ${error.message}`);
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
                console.error(`[LobbyService] ⚠️ Could not call leave API for ${userId}: ${apiError.message}`);
            }

            this.roomManager.broadcastToRoom(roomId, {
                type: 'player_left',
                payload: { userId }
            });
            await this.syncRoomState(roomId);
            console.log(`[LobbyService] 👋 ${userId} ha lasciato la stanza ${roomId}.`);
        } catch (error: any) {
            console.error(`[LobbyService] ❌ Errore in handleLeaveRoom: ${error.message}`);
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
                console.error(`[LobbyService] ⚠️ Could not persist settings for ${roomId}: ${apiError.message}`);
            }

            this.roomManager.broadcastToRoom(roomId, {
                type: 'update_settings',
                payload: settings
            });
            console.log(`[LobbyService] ⚙️ Impostazioni stanza ${roomId} aggiornate da ${userId}.`);
        } catch (error: any) {
            console.error(`[LobbyService] ❌ Errore in handleUpdateSettings: ${error.message}`);
        }
    }
}