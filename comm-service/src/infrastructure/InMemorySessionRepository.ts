import { SessionRepository } from '../domain/SessionRepository';
import { Session } from '../domain/Session';

export class InMemorySessionRepository implements SessionRepository {
    private sessions: Map<string, Session> = new Map();

    async save(session: Session): Promise<void> {
        this.sessions.set(session.userId, session);
        console.log(`Sessione salvata per l'utente ${session.userId}`);
    }

    async findByUserId(userId: string): Promise<Session | null> {
        return this.sessions.get(userId) || null;
    }

    async remove(userId: string): Promise<void> {
        this.sessions.delete(userId);
        console.log(`Sessione rimossa per l'utente ${userId}`);
    }
}