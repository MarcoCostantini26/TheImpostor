package it.unibo.lobbyservice.domain.repository;

import it.unibo.lobbyservice.domain.model.GameHistory;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Repository per GameHistory.
 * Usa Spring Data MongoDB per la persistenza.
 * Collection: "game_history"
 * Classe per interrogare il DB come con JDBC
 * Ci sono altri metodi impliciti come save, findById, findAll, deleteById,
 * existsById, count, deleteAll
 */
@Repository
public interface GameHistoryRepository extends MongoRepository<GameHistory, String> {

    /**
     * Trova lo storico di una stanza per codice.
     */
    Optional<GameHistory> findByRoomCode(String roomCode);

    /**
     * Trova tutte le sessioni di gioco di un giocatore specifico.
     */
    List<GameHistory> findByPlayerIdsContaining(String playerId);

    /**
     * Trova tutte le sessioni create dopo una certa data.
     */
    List<GameHistory> findByCreatedAtAfter(Instant date);

    /**
     * Trova tutte le sessioni create da un host specifico.
     */
    List<GameHistory> findByHostId(String hostId);

    /**
     * Verifica se esiste già uno storico per un roomCode.
     */
    boolean existsByRoomCode(String roomCode);
}
