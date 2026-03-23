export class Message {
    constructor(
        public readonly roomId: string,
        public readonly senderId: string,
        public readonly content: any
    ) {
        if (!roomId || typeof roomId !== 'string') {
            throw new Error('Message validation failed: roomId is missing or invalid');
        }
        if (!senderId || typeof senderId !== 'string') {
            throw new Error('Message validation failed: senderId is missing or invalid');
        }
        if (content === undefined || content === null) {
            throw new Error('Message validation failed: content is missing');
        }
    }
}