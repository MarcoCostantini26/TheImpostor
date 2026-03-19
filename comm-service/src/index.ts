import { WebSocketServer, WebSocket, RawData } from 'ws';
import { InMemorySessionRepository } from './infrastructure/InMemorySessionRepository';
import { RoutingService } from './application/RoutingService';
import { ChatAndSignalingService } from './application/ChatAndSignalingService';

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const wss = new WebSocketServer({ port });
const sessionRepository = new InMemorySessionRepository();

const routingService = new RoutingService(sessionRepository);
const chatAndSignalingService = new ChatAndSignalingService(sessionRepository);

wss.on('connection', (ws: WebSocket) => {
    console.log('Nuovo client connesso al Gateway!');

    ws.on('message', (data: RawData) => {
        console.log(`Messaggio grezzo ricevuto: ${data}`);
    });

    ws.on('close', () => {
        console.log('Client disconnesso dal Gateway.');
    });
});

console.log(`Comms Gateway avviato e in ascolto sulla porta ${port}`);