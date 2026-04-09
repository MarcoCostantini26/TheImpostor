import { Event } from './Event';

export interface EngineGateway {
    createGame(gameId: string, playerIds: string[], requestedImpostors: number, secretWord: string): Promise<void>;
    
    castVote(gameId: string, voterId: string, targetId: string): Promise<void>;

    advanceToVoting(gameId: string): Promise<void>;

    resolveVoting(gameId: string): Promise<void>;

    guessSecretWord(gameId: string, impostorId: string, guessedWord: string): Promise<void>;

    getGameState(gameId: string): Promise<any>;
}