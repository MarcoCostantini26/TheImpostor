import { EngineGateway } from '../domain/EngineGateway';

export class HttpEngineAdapter implements EngineGateway {
    private readonly engineUrl: string;

    constructor() {
        this.engineUrl = process.env.ENGINE_URL || 'http://localhost:8081';
    }

    async createGame(gameId: string, playerIds: string[], requestedImpostors: number, secretWord: string, hint: string): Promise<void> {
        await this.post(`/games/create`, { gameId, playerIds, requestedImpostors, secretWord, hint });
    }

    async guessSecretWord(gameId: string, impostorId: string, guessedWord: string): Promise<void> {
        await this.post(`/games/guess-word?gameId=${gameId}`, { impostorId, guessedWord });
    }

    async castVote(gameId: string, voterId: string, targetId: string): Promise<void> {
        await this.post(`/games/vote?gameId=${gameId}`, { voterId, targetId });
    }

    async advanceToVoting(gameId: string): Promise<void> {
        await this.post(`/games/advance-voting?gameId=${gameId}`, {});
    }

    async resolveVoting(gameId: string): Promise<void> {
        await this.post(`/games/resolve-voting?gameId=${gameId}`, {});
    }

    async getGameState(gameId: string): Promise<any> {
        const url = `${this.engineUrl}/games/state?gameId=${encodeURIComponent(gameId)}`;
        const response = await fetch(url);
        if (!response.ok) {
            const errorMsg = await response.text();
            throw new Error(`Engine Error (${response.status}): ${errorMsg}`);
        }
        return response.json();
    }

    private async post(path: string, body: any): Promise<void> {
        const url = `${this.engineUrl}${path}`;
        console.log(`[Adapter] INVIO a Go: ${url}`); 
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            console.log(`[Adapter] RISPOSTA da Go: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const errorMsg = await response.text();
                throw new Error(`Engine Error (${response.status}): ${errorMsg}`);
            }
        } catch (error: any) {
            console.error(`[Adapter] ERRORE FISICO: Go è acceso sulla 8081? -> ${error.message}`);
            throw error;
        }
    }
}