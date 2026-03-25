import { Event } from './Event';

export interface EngineGateway {
    createGame(gameId: string, playerIds: string[], requestedImpostors: number): Promise<void>;
    
    castVote(gameId: string, voterId: string, targetId: string): Promise<void>;
    
    advanceToVoting(gameId: string): Promise<void>;
    
    resolveVoting(gameId: string): Promise<void>;
}