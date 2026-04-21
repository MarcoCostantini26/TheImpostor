package it.unibo.lobbyservice.domain.model;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Utente registrato con profilo persistente.
 * Salvato su MongoDB.
 */
@Getter
@EqualsAndHashCode(callSuper = true)
@Document(collection = "users") // crea collection o tabella su mongoDB
public final class AuthenticatedPlayer extends User {

    @Indexed(unique = true)
    private final String email;

    private final String passwordHash;
    private final Instant createdAt;

    // Campi profilo opzionali
    private final Integer age;
    private final String country;
    private final String avatarUrl;
    private final String bio;

    public AuthenticatedPlayer(String id, String username, String email, String passwordHash,
            Instant createdAt, Integer age, String country,
            String avatarUrl, String bio) {
        super(id, username);
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email cannot be null or empty");
        }
        if (passwordHash == null || passwordHash.isBlank()) {
            throw new IllegalArgumentException("Password hash cannot be null or empty");
        }
        this.email = email.toLowerCase().trim();
        this.passwordHash = passwordHash;
        this.createdAt = createdAt != null ? createdAt : Instant.now();
        this.age = age;
        this.country = country;
        this.avatarUrl = avatarUrl;
        this.bio = bio;
    }

    /**
     * Factory method per creare un nuovo utente registrato.
     */
    public static AuthenticatedPlayer create(String username, String email, String passwordHash) {
        return new AuthenticatedPlayer(null, username, email, passwordHash, Instant.now(),
                null, null, null, null);
    }

    /**
     * Factory method con profilo completo.
     */
    public static AuthenticatedPlayer createWithProfile(String username, String email, String passwordHash,
            Integer age, String country, String avatarUrl, String bio) {
        return new AuthenticatedPlayer(null, username, email, passwordHash, Instant.now(),
                age, country, avatarUrl, bio);
    }

    @Override
    public boolean isAuthenticated() {
        return true;
    }
}
