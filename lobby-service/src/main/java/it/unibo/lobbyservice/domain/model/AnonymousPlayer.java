package it.unibo.lobbyservice.domain.model;

/**
 * Utente guest che partecipa senza registrazione.
 * Temporaneo, non salvato su database.
 */
public final class AnonymousPlayer extends User {

    public AnonymousPlayer(String username) {
        super(null, username); // ID auto-generato
    }

    public AnonymousPlayer(String id, String username) {
        super(id, username);
    }

    @Override
    public boolean isAuthenticated() {
        return false;
    }
}

