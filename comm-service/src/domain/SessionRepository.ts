import { Session } from './Session';

export interface SessionRepository {
    save(session: Session): Promise<void>;
    findByUserId(userId: string): Promise<Session | null>;
    remove(userId: string): Promise<void>;
}