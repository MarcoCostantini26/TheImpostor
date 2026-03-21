package it.unibo.lobbyservice.application.service;

/**
 * Eccezione lanciata quando si tenta di registrare un utente già esistente.
 */
public class UserAlreadyExistsException extends RuntimeException {
    
    public UserAlreadyExistsException(String message) {
        super(message);
    }
    
    public UserAlreadyExistsException(String message, Throwable cause) {
        super(message, cause);
    }
}

