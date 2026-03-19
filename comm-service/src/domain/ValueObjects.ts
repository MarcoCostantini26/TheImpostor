export interface Event {
    type: string;
    payload: any;
}

export interface Message {
    roomId: string;
    senderId: string;
    content: any;
}