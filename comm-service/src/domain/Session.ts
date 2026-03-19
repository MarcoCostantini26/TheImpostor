export class Connection {
    constructor(public readonly socketId: string) {}
}

export class WebRTCPeer {
    constructor(public readonly peerId: string) {}
}

export class Session {
    private _connections: Connection[] = [];
    private _webrtcPeers: WebRTCPeer[] = [];

    constructor(public readonly userId: string) {}

    get connections(): ReadonlyArray<Connection> {
        return this._connections;
    }

    get webrtcPeers(): ReadonlyArray<WebRTCPeer> {
        return this._webrtcPeers;
    }

    addConnection(connection: Connection): void {
        this._connections.push(connection);
    }

    removeConnection(socketId: string): void {
        this._connections = this._connections.filter(c => c.socketId !== socketId);
    }

    addWebRTCPeer(peer: WebRTCPeer): void {
        this._webrtcPeers.push(peer);
    }
    
    removeWebRTCPeer(peerId: string): void {
        this._webrtcPeers = this._webrtcPeers.filter(p => p.peerId !== peerId);
    }
}