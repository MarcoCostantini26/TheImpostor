export class Event {
    constructor(
        public readonly type: string,
        public readonly payload: any
    ) {
        if (!type || typeof type !== 'string') {
            throw new Error('Event validation failed: type is missing or invalid');
        }
        if (payload === undefined) {
            this.payload = {};
        }
    }
}