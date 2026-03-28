import { WebSocket } from 'ws';

export class RoomManager {
    // Mappa: ID Stanza -> Set di WebSocket connessi
    private rooms: Map<string, Set<WebSocket>> = new Map();

    joinRoom(roomId: string, ws: WebSocket) {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
            console.log(`[RoomManager] 🏠 Creata nuova stanza in memoria: ${roomId}`);
        }
        this.rooms.get(roomId)!.add(ws);
        console.log(`[RoomManager] 👤 Socket aggiunto alla stanza: ${roomId}`);
    }

    leaveRoom(roomId: string, ws: WebSocket) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.delete(ws);
            console.log(`[RoomManager] 🚪 Socket rimosso dalla stanza: ${roomId}`);
            // Se la stanza è vuota, puliamo la memoria
            if (room.size === 0) {
                this.rooms.delete(roomId);
                console.log(`[RoomManager] 🧹 Stanza ${roomId} vuota e rimossa.`);
            }
        }
    }

    // Utile quando un socket si disconnette brutalmente (chiude il browser)
    leaveAllRooms(ws: WebSocket) {
        this.rooms.forEach((clients, roomId) => {
            if (clients.has(ws)) {
                this.leaveRoom(roomId, ws);
            }
        });
    }

    // Il motore del broadcast mirato
    broadcastToRoom(roomId: string, messageObj: any, excludeWs?: WebSocket) {
        const roomClients = this.rooms.get(roomId);
        if (!roomClients) return;

        const messageString = JSON.stringify(messageObj);
        roomClients.forEach(client => {
            // Inviamo a tutti tranne a chi ha generato l'evento (se specificato)
            if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
                client.send(messageString);
            }
        });
    }
}