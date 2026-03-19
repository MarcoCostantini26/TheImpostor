import { WebSocketServer } from 'ws';
import { InMemorySessionRepository } from './infrastructure/InMemorySessionRepository';
import { RoutingService } from './application/RoutingService';
import { ChatAndSignalingService } from './application/ChatAndSignalingService';

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const wss = new WebSocketServer({ port });
const sessionRepository = new InMemorySessionRepository();

const routingService = new RoutingService(sessionRepository);
const chatAndSignalingService = new ChatAndSignalingService(sessionRepository);

wss.on('connection', (ws) => {
    console.log('Nuovo client connesso al Gateway!');

    ws.on('message', (data) => {
        console.log(`Messaggio grezzo ricevuto: ${data}`);
        //qui faremo il parsing del JSON (Message o Event) e lo passeremo a routingService o chatAndSignalingService in base al tipo.
    });

    ws.on('close', () => {
        console.log('Client disconnesso dal Gateway.');
        //qui andrà la logica per ripulire la connessione dalla Sessione
    });
});

console.log(`Comms Gateway avviato e in ascolto sulla porta ${port}`);