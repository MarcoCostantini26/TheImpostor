package it.unibo.lobbyservice.application.service;

import it.unibo.lobbyservice.domain.model.GameHistory;
import it.unibo.lobbyservice.domain.model.RoundResult;
import it.unibo.lobbyservice.domain.repository.GameHistoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Application Service per la gestione dello storico partite.
 * Gestisce GameHistory e RoundResult.
 */
@Service
@Transactional
public class GameHistoryService {
    
    private final GameHistoryRepository gameHistoryRepository;

    public GameHistoryService(GameHistoryRepository gameHistoryRepository) {
        this.gameHistoryRepository = Objects.requireNonNull(gameHistoryRepository, "GameHistoryRepository cannot be null");
    }

    /**
     * Crea una nuova sessione di gioco.
     */
    public GameHistory createGameSession(String roomCode, List<String> playerIds, 
                                        List<String> playerUsernames, String hostId) {
        Objects.requireNonNull(roomCode, "Room code cannot be null");
        Objects.requireNonNull(playerIds, "Player IDs cannot be null");
        Objects.requireNonNull(playerUsernames, "Player usernames cannot be null");
        Objects.requireNonNull(hostId, "Host ID cannot be null");
        
        GameHistory gameHistory = GameHistory.create(roomCode, playerIds, playerUsernames, hostId);
        return gameHistoryRepository.save(gameHistory);
    }

    /**
     * Aggiunge il risultato di un round a una sessione esistente.
     */
    public GameHistory addRoundResult(String roomCode, Integer roundNumber, String impostorId, 
                                     String impostorUsername, String winnerId, boolean impostorWon,
                                     Instant startedAt, Instant endedAt, Integer totalVotes,
                                     String eliminatedPlayerId, String eliminatedPlayerUsername,
                                     boolean impostorGuessedWord, String secretWord) {
        
        GameHistory gameHistory = gameHistoryRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new GameHistoryNotFoundException("Game history for room " + roomCode + " not found"));
        
        RoundResult roundResult = RoundResult.create(
                roundNumber, impostorId, impostorUsername, winnerId, impostorWon,
                startedAt, endedAt, totalVotes, eliminatedPlayerId, eliminatedPlayerUsername,
                impostorGuessedWord, secretWord
        );
        
        gameHistory.addRoundResult(roundResult);
        return gameHistoryRepository.save(gameHistory);
    }

    /**
     * Trova lo storico di una stanza specifica.
     */
    public Optional<GameHistory> findByRoomCode(String roomCode) {
        Objects.requireNonNull(roomCode, "Room code cannot be null");
        return gameHistoryRepository.findByRoomCode(roomCode);
    }

    /**
     * Trova tutte le sessioni di gioco di un giocatore.
     */
    public List<GameHistory> findPlayerGameHistory(String playerId) {
        Objects.requireNonNull(playerId, "Player ID cannot be null");
        return gameHistoryRepository.findByPlayerIdsContaining(playerId);
    }

    /**
     * Trova tutte le sessioni create da un host.
     */
    public List<GameHistory> findSessionsByHost(String hostId) {
        Objects.requireNonNull(hostId, "Host ID cannot be null");
        return gameHistoryRepository.findByHostId(hostId);
    }

    /**
     * Trova sessioni recenti (dopo una certa data).
     */
    public List<GameHistory> findRecentSessions(Instant since) {
        Objects.requireNonNull(since, "Since date cannot be null");
        return gameHistoryRepository.findByCreatedAtAfter(since);
    }

    /**
     * Calcola le statistiche aggregate di un giocatore.
     */
    public PlayerStats calculatePlayerStats(String playerId) {
        Objects.requireNonNull(playerId, "Player ID cannot be null");
        
        List<GameHistory> sessions = gameHistoryRepository.findByPlayerIdsContaining(playerId);
        
        long totalGames = sessions.stream()
                .mapToLong(GameHistory::getTotalRounds)
                .sum();
        
        long totalWins = sessions.stream()
                .mapToLong(session -> session.countWins(playerId))
                .sum();
        
        long totalImpostorRounds = sessions.stream()
                .mapToLong(session -> session.countImpostorRounds(playerId))
                .sum();
        
        long impostorWins = sessions.stream()
                .flatMap(session -> session.getAllRounds().stream())
                .filter(round -> round.wasImpostor(playerId) && round.isImpostorWon())
                .count();
        
        return new PlayerStats(totalGames, totalWins, totalImpostorRounds, impostorWins);
    }

    /**
     * Elimina lo storico di una sessione.
     */
    public void deleteGameHistory(String id) {
        Objects.requireNonNull(id, "ID cannot be null");
        if (!gameHistoryRepository.existsById(id)) {
            throw new GameHistoryNotFoundException("Game history with ID " + id + " not found");
        }
        gameHistoryRepository.deleteById(id);
    }

    /**
     * Record per statistiche aggregate di un giocatore.
     */
    public record PlayerStats(
            long totalGames,
            long totalWins,
            long totalImpostorRounds,
            long impostorWins
    ) {
        public double getWinRate() {
            return totalGames > 0 ? (double) totalWins / totalGames : 0.0;
        }
        
        public double getImpostorWinRate() {
            return totalImpostorRounds > 0 ? (double) impostorWins / totalImpostorRounds : 0.0;
        }
    }
}

