package it.unibo.lobbyservice.application.service;

/**
 * Eccezione lanciata quando una stanza non viene trovata.
 */
public class RoomNotFoundException extends RuntimeException {
    
    public RoomNotFoundException(String message) {
        super(message);
    }
    
    public RoomNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }
}

