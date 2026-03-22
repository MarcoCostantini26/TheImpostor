package it.unibo.lobbyservice.application.service;

/**
 * Eccezione lanciata quando uno storico di partita non viene trovato.
 */
public class GameHistoryNotFoundException extends RuntimeException {
    
    public GameHistoryNotFoundException(String message) {
        super(message);
    }
    
    public GameHistoryNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }
}

