import { Session } from '../domain/Session';
import { SessionRepository } from '../domain/SessionRepository';

export class InMemorySessionRepository implements SessionRepository {
    private sessions = new Map<string, Session>();

    async save(session: Session): Promise<void> {
        this.sessions.set(session.userId, session);
        console.log(`[Repository] Sessione salvata per: ${session.userId}`);
    }

    async findByUserId(userId: string): Promise<Session | null> {
        const session = this.sessions.get(userId);
        return session ? session : null;
    }

    async remove(userId: string): Promise<void> {
        this.sessions.delete(userId);
        console.log(`[Repository] Sessione rimossa per: ${userId}`);
    }
}