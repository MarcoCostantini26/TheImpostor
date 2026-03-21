package it.unibo.lobbyservice.application.service;

/**
 * Eccezione lanciata quando un utente non viene trovato.
 */
public class UserNotFoundException extends RuntimeException {
    
    public UserNotFoundException(String message) {
        super(message);
    }
    
    public UserNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }
}

