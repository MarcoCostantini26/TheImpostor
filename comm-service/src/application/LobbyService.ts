import { RoomManager } from './RoomManager';

export class LobbyService {
    private readonly lobbyUrl: string;

    constructor(private roomManager: RoomManager) {
        this.lobbyUrl = process.env.LOBBY_URL || 'http://localhost:3000';
    }

    // GESTIONE: 'PLAYER_READY'
    async handlePlayerReady(roomId: string, userId: string): Promise<void> {
        try {
            await fetch(`${this.lobbyUrl}/api/rooms/${roomId}/ready`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            const response = await fetch(`${this.lobbyUrl}/api/internal/rooms/${roomId}`);
            if (!response.ok) throw new Error(`Lobby Service ha risposto con ${response.status}`);
            const roomState = await response.json();

            this.roomManager.broadcastToRoom(roomId, {
                type: 'room_update',
                payload: roomState
            });
            console.log(`[LobbyService] 🔄 Stato stanza ${roomId} aggiornato.`);
        } catch (error: any) {
            console.error(`[LobbyService] ❌ Errore in handlePlayerReady: ${error.message}`);
        }
    }

    // GESTIONE: 'START_GAME'
    async handleStartGame(roomId: string, userId: string): Promise<void> {
        try {
            const response = await fetch(`${this.lobbyUrl}/api/rooms/${roomId}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            if (!response.ok) throw new Error('Errore avvio partita nel lobby-service');

            this.roomManager.broadcastToRoom(roomId, {
                type: 'game_started',
                payload: { roomId }
            });
            console.log(`[LobbyService] 🚀 Partita ${roomId} avviata! Broadcast inviato.`);
        } catch (error: any) {
            console.error(`[LobbyService] ❌ Errore in handleStartGame: ${error.message}`);
        }
    }

    // GESTIONE: 'LEAVE_ROOM'
    async handleLeaveRoom(roomId: string, userId: string, ws: any): Promise<void> {
        try {
            this.roomManager.leaveRoom(roomId, ws);

            this.roomManager.broadcastToRoom(roomId, {
                type: 'player_left',
                payload: { userId }
            });
            console.log(`[LobbyService] 👋 ${userId} ha lasciato la stanza ${roomId}.`);
        } catch (error: any) {
            console.error(`[LobbyService] ❌ Errore in handleLeaveRoom: ${error.message}`);
        }
    }

    // 🟢 NUOVO: GESTIONE 'UPDATE_SETTINGS'
    async handleUpdateSettings(roomId: string, userId: string, settings: any): Promise<void> {
        try {
            // 1. Notifica il lobby-service in REST (adatta metodo e path alla tua API)
            const response = await fetch(`${this.lobbyUrl}/api/rooms/${roomId}/settings`, {
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, settings })
            });

            if (!response.ok) throw new Error('Errore aggiornamento impostazioni nel lobby-service');

            // 2. Broadcast 'update_settings' ai partecipanti della stanza
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