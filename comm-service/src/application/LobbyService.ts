import { RoomManager } from './RoomManager';

export class LobbyService {
    private readonly lobbyUrl: string;

    constructor(private roomManager: RoomManager) {
        // Inserisci qui l'URL base del tuo lobby-service (es. http://localhost:3000)
        this.lobbyUrl = process.env.LOBBY_URL || 'http://localhost:3000';
    }

    // GESTIONE: 'PLAYER_READY'
    async handlePlayerReady(roomId: string, userId: string): Promise<void> {
        try {
            // 1. Chiama POST sul lobby-service per settare lo stato ready
            await fetch(`${this.lobbyUrl}/api/rooms/${roomId}/ready`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            // 2. Chiede GET per avere lo stato aggiornato (con opzioni e giocatori)
            const response = await fetch(`${this.lobbyUrl}/api/internal/rooms/${roomId}`);
            if (!response.ok) throw new Error(`Lobby Service ha risposto con ${response.status}`);
            const roomState = await response.json();

            // 3. Invia l'evento 'room_update' ai partecipanti
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
            // 1. Chiama POST per avviare la partita lato lobby
            const response = await fetch(`${this.lobbyUrl}/api/rooms/${roomId}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }) // Opzionale, se il lobby-service vuole sapere chi ha premuto start
            });

            if (!response.ok) throw new Error('Errore avvio partita nel lobby-service');

            // 2. Broadcast 'game_started' per dire al front-end di cambiare schermata
            this.roomManager.broadcastToRoom(roomId, {
                type: 'game_started',
                payload: { roomId } // Qui puoi aggiungere altri dati se servono al front-end
            });
            console.log(`[LobbyService] 🚀 Partita ${roomId} avviata! Broadcast inviato.`);
        } catch (error: any) {
            console.error(`[LobbyService] ❌ Errore in handleStartGame: ${error.message}`);
        }
    }

    // GESTIONE: 'LEAVE_ROOM'
    async handleLeaveRoom(roomId: string, userId: string, ws: any): Promise<void> {
        try {
            // 1. Rimuove immediatamente il socket dalla memoria locale
            this.roomManager.leaveRoom(roomId, ws);

            // 2. (Opzionale) Notifica il lobby-service in REST se la tua API lo prevede
            // await fetch(`${this.lobbyUrl}/api/rooms/${roomId}/leave`, { ... });

            // 3. Broadcast 'player_left' agli altri rimasti
            this.roomManager.broadcastToRoom(roomId, {
                type: 'player_left',
                payload: { userId }
            });
            console.log(`[LobbyService] 👋 ${userId} ha lasciato la stanza ${roomId}.`);
        } catch (error: any) {
            console.error(`[LobbyService] ❌ Errore in handleLeaveRoom: ${error.message}`);
        }
    }
}