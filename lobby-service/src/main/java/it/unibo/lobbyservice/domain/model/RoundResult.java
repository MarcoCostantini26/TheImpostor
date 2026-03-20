package it.unibo.lobbyservice.domain.model;

import lombok.EqualsAndHashCode;
import lombok.Getter;

import java.time.Instant;
import java.util.Objects;

/**
 * Rappresenta il risultato di un singolo round.
 * Embedded document dentro GameHistory.
 */
@Getter
@EqualsAndHashCode
public final class RoundResult {
    
    private final Integer roundNumber;
    private final String impostorId;
    private final String impostorUsername;
    private final String winnerId; // può essere l'impostore o null se vincono i players
    private final boolean impostorWon;
    private final Instant startedAt;
    private final Instant endedAt;
    private final Long durationSeconds;
    
    // Dettagli round
    private final Integer totalVotes;
    private final String eliminatedPlayerId;
    private final String eliminatedPlayerUsername;
    private final boolean impostorGuessedWord;
    private final String secretWord; // la parola segreta del round

    private RoundResult(Integer roundNumber, String impostorId, String impostorUsername,
                       String winnerId, boolean impostorWon, Instant startedAt, Instant endedAt,
                       Long durationSeconds, Integer totalVotes, String eliminatedPlayerId,
                       String eliminatedPlayerUsername, boolean impostorGuessedWord, String secretWord) {
        this.roundNumber = Objects.requireNonNull(roundNumber, "Round number cannot be null");
        this.impostorId = Objects.requireNonNull(impostorId, "Impostor ID cannot be null");
        this.impostorUsername = Objects.requireNonNull(impostorUsername, "Impostor username cannot be null");
        this.winnerId = winnerId;
        this.impostorWon = impostorWon;
        this.startedAt = Objects.requireNonNull(startedAt, "Started at cannot be null");
        this.endedAt = Objects.requireNonNull(endedAt, "Ended at cannot be null");
        this.durationSeconds = durationSeconds;
        this.totalVotes = totalVotes;
        this.eliminatedPlayerId = eliminatedPlayerId;
        this.eliminatedPlayerUsername = eliminatedPlayerUsername;
        this.impostorGuessedWord = impostorGuessedWord;
        this.secretWord = secretWord;
    }

    /**
     * Factory method per creare il risultato di un round.
     */
    public static RoundResult create(Integer roundNumber, String impostorId, String impostorUsername,
                                    String winnerId, boolean impostorWon, Instant startedAt, Instant endedAt,
                                    Integer totalVotes, String eliminatedPlayerId, String eliminatedPlayerUsername,
                                    boolean impostorGuessedWord, String secretWord) {
        
        long durationSeconds = java.time.Duration.between(startedAt, endedAt).getSeconds();
        
        return new RoundResult(roundNumber, impostorId, impostorUsername, winnerId, impostorWon,
                              startedAt, endedAt, durationSeconds, totalVotes,
                              eliminatedPlayerId, eliminatedPlayerUsername, impostorGuessedWord, secretWord);
    }

    /**
     * Verifica se un giocatore era l'impostore in questo round.
     */
    public boolean wasImpostor(String playerId) {
        return impostorId.equals(playerId);
    }

    /**
     * Verifica se un giocatore ha vinto questo round.
     */
    public boolean didPlayerWin(String playerId) {
        if (impostorWon) {
            return impostorId.equals(playerId);
        } else {
            return !impostorId.equals(playerId);
        }
    }
}

