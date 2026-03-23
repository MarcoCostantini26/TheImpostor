package it.unibo.lobbyservice.domain.model;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * GameHistory Aggregate.
 * Rappresenta lo storico completo di una sessione di gioco in una stanza.
 * Può contenere più round consecutivi (rematch).
 * Salvato su MongoDB per analytics e statistiche.
 */
@Getter
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Document(collection = "game_history")
public final class GameHistory {
    
    @Id
    @EqualsAndHashCode.Include
    private final String id;
    
    private final String roomCode;
    private final List<String> playerIds;
    private final List<String> playerUsernames;
    private final String hostId;
    private final Instant createdAt;
    private final List<RoundResult> rounds; // storico di tutti i round giocati

    private GameHistory(String id, String roomCode, List<String> playerIds, List<String> playerUsernames,
                       String hostId, Instant createdAt, List<RoundResult> rounds) {
        this.id = id;
        this.roomCode = Objects.requireNonNull(roomCode, "Room code cannot be null");
        this.playerIds = List.copyOf(Objects.requireNonNull(playerIds, "Player IDs cannot be null"));
        this.playerUsernames = List.copyOf(Objects.requireNonNull(playerUsernames, "Player usernames cannot be null"));
        this.hostId = Objects.requireNonNull(hostId, "Host ID cannot be null");
        this.createdAt = createdAt != null ? createdAt : Instant.now();
        this.rounds = new ArrayList<>(rounds);
    }

    /**
     * Factory method per creare uno storico di sessione di gioco.
     */
    public static GameHistory create(String roomCode, List<String> playerIds, List<String> playerUsernames, String hostId) {
        return new GameHistory(null, roomCode, playerIds, playerUsernames, hostId, Instant.now(), new ArrayList<>());
    }

    /**
     * Aggiunge il risultato di un round completato.
     */
    public void addRoundResult(RoundResult roundResult) {
        Objects.requireNonNull(roundResult, "Round result cannot be null");
        this.rounds.add(roundResult);
    }

    /**
     * Verifica se un giocatore ha partecipato a questa sessione.
     */
    public boolean hasPlayer(String playerId) {
        return playerIds.contains(playerId);
    }

    /**
     * Ottiene il numero totale di round giocati.
     */
    public int getTotalRounds() {
        return rounds.size();
    }

    /**
     * Ottiene un round specifico per numero.
     */
    public RoundResult getRound(int roundNumber) {
        return rounds.stream()
                .filter(r -> r.getRoundNumber().equals(roundNumber))
                .findFirst()
                .orElse(null);
    }

    /**
     * Conta quante volte un giocatore è stato impostore.
     */
    public long countImpostorRounds(String playerId) {
        return rounds.stream()
                .filter(r -> r.wasImpostor(playerId))
                .count();
    }

    /**
     * Conta quante vittorie ha ottenuto un giocatore.
     */
    public long countWins(String playerId) {
        return rounds.stream()
                .filter(r -> r.didPlayerWin(playerId))
                .count();
    }

    /**
     * Ottiene la lista di tutti i round (immutabile).
     */
    public List<RoundResult> getAllRounds() {
        return List.copyOf(rounds);
    }
}

