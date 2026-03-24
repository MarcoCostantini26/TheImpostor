package it.unibo.lobbyservice.domain.repository;

import it.unibo.lobbyservice.domain.model.AuthenticatedPlayer;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository per AuthenticatedPlayer.
 * Usa Spring Data MongoDB per la persistenza.
 * Collection: "users"
 * Classe per interrogare il DB come con JDBC
 */
@Repository
public interface UserRepository extends MongoRepository<AuthenticatedPlayer, String> {

    /**
     * Trova un utente per email (case-insensitive).
     */
    Optional<AuthenticatedPlayer> findByEmailIgnoreCase(String email);

    /**
     * Verifica se un'email è già registrata.
     */
    boolean existsByEmailIgnoreCase(String email);

    /**
     * Trova un utente per username (case-insensitive).
     */
    Optional<AuthenticatedPlayer> findByUsernameIgnoreCase(String username);

    /**
     * Verifica se un username è già preso.
     */
    boolean existsByUsernameIgnoreCase(String username);
}
