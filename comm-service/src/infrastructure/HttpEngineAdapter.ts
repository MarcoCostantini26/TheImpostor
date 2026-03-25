import { EngineGateway } from '../domain/EngineGateway';

export class HttpEngineAdapter implements EngineGateway {
    private readonly engineUrl: string;

    constructor() {
        this.engineUrl = process.env.ENGINE_URL || 'http://localhost:8081';
    }

    async createGame(gameId: string, playerIds: string[], requestedImpostors: number): Promise<void> {
        await this.post(`/games/create`, {
            gameId: gameId,
            playerIds: playerIds,
            requestedImpostors: requestedImpostors
        });
    }

    async castVote(gameId: string, voterId: string, targetId: string): Promise<void> {
        await this.post(`/games/vote?gameId=${gameId}`, {
            voterId: voterId,
            targetId: targetId
        });
    }

    async advanceToVoting(gameId: string): Promise<void> {
        await this.post(`/games/advance-voting?gameId=${gameId}`, {});
    }

    async resolveVoting(gameId: string): Promise<void> {
        await this.post(`/games/resolve-voting?gameId=${gameId}`, {});
    }

    async checkHealth(): Promise<boolean> {
        try {
            const response = await fetch(`${this.engineUrl}/health`);
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    private async post(path: string, body: any): Promise<void> {
        const response = await fetch(`${this.engineUrl}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorMsg = await response.text();
            throw new Error(`Engine Error (${response.status}): ${errorMsg}`);
        }
    }
}