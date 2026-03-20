package it.unibo.lobbyservice.domain.model;

import lombok.EqualsAndHashCode;
import lombok.Getter;

import java.util.UUID;

/**
 * Classe base astratta per tutti i tipi di utente.
 * Approccio polimorfico per gestire utenti autenticati e anonimi.
 */
@Getter
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public abstract class User {
    
    @EqualsAndHashCode.Include
    protected final String id;
    
    protected final String username;

    protected User(String id, String username) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Username cannot be null or empty");
        }
        this.id = id != null ? id : UUID.randomUUID().toString();
        this.username = username.trim();
    }

    /**
     * Ritorna true se l'utente è autenticato (registrato).
     */
    public abstract boolean isAuthenticated();
}

