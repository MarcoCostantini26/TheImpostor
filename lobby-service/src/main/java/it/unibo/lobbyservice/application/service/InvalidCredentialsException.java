package it.unibo.lobbyservice.application.service;

/**
 * Eccezione lanciata quando le credenziali di login non sono valide.
 * Mappa su HTTP 401 Unauthorized.
 */
public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException(String message) {
        super(message);
    }
}

