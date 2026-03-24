package it.unibo.lobbyservice.domain.model;

import lombok.EqualsAndHashCode;
import lombok.Getter;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * Domain Event pubblicato quando l'host avvia una partita.
 * Serve per sincronizzare il Lobby Context con il Game Engine Context.
 * Questo evento contiene tutte le informazioni necessarie per iniziare la partita.
 */
@Getter
@EqualsAndHashCode
public final class GameStartRequested {
    
    private final String roomCode;
    private final Integer roundNumber;
    private final List<String> playerIds;
    private final List<String> playerUsernames;
    private final String hostId;
    private final Instant occurredAt;

    private final int MINIMUM_PLAYERS_REQUIRED= 4;

    private GameStartRequested(String roomCode, Integer roundNumber, List<String> playerIds, 
                              List<String> playerUsernames, String hostId, Instant occurredAt) {
        this.roomCode = Objects.requireNonNull(roomCode, "Room code cannot be null");
        this.roundNumber = Objects.requireNonNull(roundNumber, "Round number cannot be null");
        this.playerIds = List.copyOf(Objects.requireNonNull(playerIds, "Player IDs cannot be null"));
        this.playerUsernames = List.copyOf(Objects.requireNonNull(playerUsernames, "Player usernames cannot be null"));
        this.hostId = Objects.requireNonNull(hostId, "Host ID cannot be null");
        this.occurredAt = occurredAt != null ? occurredAt : Instant.now();
        
        if (playerIds.size() != playerUsernames.size()) {
            throw new IllegalArgumentException("Player IDs and usernames lists must have the same size");
        }
        if (playerIds.size() < MINIMUM_PLAYERS_REQUIRED) {
            throw new IllegalArgumentException("At least "+ MINIMUM_PLAYERS_REQUIRED +" players required to start a game");
        }
    }

    /**
     * Factory method per creare l'evento.
     */
    public static GameStartRequested create(String roomCode, Integer roundNumber, 
                                          List<String> playerIds, List<String> playerUsernames, 
                                          String hostId) {
        return new GameStartRequested(roomCode, roundNumber, playerIds, playerUsernames, 
                                     hostId, Instant.now());
    }

    /**
     * Ottiene il numero di giocatori.
     */
    public int getPlayerCount() {
        return playerIds.size();
    }

    @Override
    public String toString() {
        return "GameStartRequested{" +
                "roomCode='" + roomCode + '\'' +
                ", roundNumber=" + roundNumber +
                ", playerCount=" + playerIds.size() +
                ", hostId='" + hostId + '\'' +
                ", occurredAt=" + occurredAt +
                '}';
    }
}

