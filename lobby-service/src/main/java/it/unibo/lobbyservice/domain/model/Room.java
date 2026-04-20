package it.unibo.lobbyservice.domain.model;

import lombok.EqualsAndHashCode;
import lombok.Getter;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Room Aggregate Root.
 * Gestisce l'integrità della fase di matchmaking.
 * Invarianti business:
 * - Username univoci nella stanza
 * - Minimo 4 giocatori per iniziare
 * - Solo l'host può avviare la partita
 */
@Getter
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public final class Room {
    private static final int MIN_PLAYERS = 4;
    private static final int MAX_PLAYERS = 8;
    private static final int DEFAULT_IMPOSTORS = 1;
    private static final int DEFAULT_DISCUSSION_TIME = 60;

    @EqualsAndHashCode.Include
    private final RoomCode code;
    
    private String hostId;
    private final Map<String, User> players; // userId -> User
    private RoomStatus status;
    private int currentRound; // numero round corrente (incrementa ad ogni rematch)
    private final Instant createdAt;
    private Instant startedAt;

    // Game settings
    private int impostors;
    private int discussionTime; // secondi

    private Room(RoomCode code, String hostId, Map<String, User> players, 
                 RoomStatus status, int currentRound, Instant createdAt, Instant startedAt) {
        this.code = Objects.requireNonNull(code, "Room code cannot be null");
        this.hostId = Objects.requireNonNull(hostId, "Host ID cannot be null");
        this.players = new LinkedHashMap<>(players);
        this.status = status;
        this.currentRound = currentRound;
        this.createdAt = createdAt != null ? createdAt : Instant.now();
        this.startedAt = startedAt;
        this.impostors = DEFAULT_IMPOSTORS;
        this.discussionTime = DEFAULT_DISCUSSION_TIME;
    }

    /**
     * Factory method: crea una nuova stanza con l'host come primo giocatore.
     */
    public static Room create(RoomCode code, User host) {
        Objects.requireNonNull(host, "Host cannot be null");
        Map<String, User> players = new LinkedHashMap<>();
        players.put(host.getId(), host);
        return new Room(code, host.getId(), players, RoomStatus.WAITING, 0, Instant.now(), null);
    }

    /**
     * Aggiunge un giocatore alla stanza.
     * Regole business:
     * - Stanza deve essere in WAITING
     * - Username deve essere univoco
     * - Stanza non può superare MAX_PLAYERS
     */
    public void addPlayer(User player) {
        Objects.requireNonNull(player, "Player cannot be null");
        
        if (status != RoomStatus.WAITING) {
            throw new IllegalStateException("Cannot join room: game already started or ended");
        }
        
        // Idempotent: if player already in room by ID, do nothing
        if (players.containsKey(player.getId())) {
            return;
        }
        
        if (players.size() >= MAX_PLAYERS) {
            throw new IllegalStateException("Room is full (max " + MAX_PLAYERS + " players)");
        }
        
        // Verifica username univoco nella stanza
        boolean usernameExists = players.values().stream()
            .anyMatch(p -> p.getUsername().equalsIgnoreCase(player.getUsername()));
        
        if (usernameExists) {
            throw new IllegalArgumentException("Username '" + player.getUsername() + "' is already taken in this room");
        }
        
        players.put(player.getId(), player);
    }

    /**
     * Rimuove un giocatore dalla stanza.
     * Se l'host lascia e ci sono altri giocatori, il ruolo di host viene assegnato a un altro giocatore.
     * Se l'ultimo giocatore lascia, la stanza viene chiusa (status -> ENDED).
     */
    public void removePlayer(String playerId) {
        // Idempotent: if player not in room, do nothing
        if (!players.containsKey(playerId)) {
            return;
        }
        
        if (status != RoomStatus.WAITING) {
            throw new IllegalStateException("Cannot leave room: game already started");
        }
        
        players.remove(playerId);
        
        if (players.isEmpty()) {
            status = RoomStatus.ENDED;
        } else if (playerId.equals(hostId)) {
            // Host left but others remain: pick a random new host
            List<String> remainingIds = new ArrayList<>(players.keySet());
            hostId = remainingIds.get(ThreadLocalRandom.current().nextInt(remainingIds.size()));
        }
    }

    /**
     * Avvia la partita.
     * Solo l'host può chiamare questo metodo.
     * Richiede almeno MIN_PLAYERS giocatori.
     */
    public void startGame(String requesterId) {
        if (!requesterId.equals(hostId)) {
            throw new IllegalStateException("Only the host can start the game");
        }

        // Idempotent: if already started, do nothing (allows retry after webhook failure)
        if (status == RoomStatus.STARTED) {
            return;
        }

        if (status != RoomStatus.WAITING) {
            throw new IllegalStateException("Game already started or room ended");
        }
        
        if (players.size() < MIN_PLAYERS) {
            throw new IllegalStateException("Insufficient players to start (minimum " + MIN_PLAYERS + ")");
        }
        
        if (impostors >= players.size()) {
            throw new IllegalStateException(
                "Number of impostors (" + impostors + ") must be less than total players (" + players.size() + ")"
            );
        }

        currentRound++;
        status = RoomStatus.STARTED;
        startedAt = Instant.now();
    }

    /**
     * Termina la partita.
     */
    public void endGame() {
        if (status != RoomStatus.STARTED) {
            throw new IllegalStateException("Cannot end a game that hasn't started");
        }
        status = RoomStatus.ENDED;
    }

    /**
     * Prepara la stanza per un nuovo round (rematch).
     * Riporta lo status a WAITING mantenendo i giocatori attuali.
     */
    public void prepareForNextRound() {
        if (status != RoomStatus.ENDED && status != RoomStatus.STARTED) {
            throw new IllegalStateException("Can only prepare for next round after a game has finished");
        }
        status = RoomStatus.WAITING;
        startedAt = null;
    }

    /**
     * Aggiorna le impostazioni della stanza.
     * Solo quando la stanza è in WAITING.
     */
    public void updateSettings(int impostors, int discussionTime) {
        if (status != RoomStatus.WAITING) {
            throw new IllegalStateException("Cannot change settings: game already started");
        }
        if (impostors < 1) {
            throw new IllegalArgumentException("At least 1 impostor is required");
        }
        if (discussionTime < 10) {
            throw new IllegalArgumentException("Discussion time must be at least 10 seconds");
        }
        this.impostors = impostors;
        this.discussionTime = discussionTime;
    }

    // Metodi di utilità

    public List<User> getPlayers() {
        return new ArrayList<>(players.values());
    }

    public User getPlayer(String playerId) {
        return players.get(playerId);
    }

    public int getPlayerCount() {
        return players.size();
    }

    public boolean isHost(String userId) {
        return hostId.equals(userId);
    }

    public boolean canStart() {
        return status == RoomStatus.WAITING && players.size() >= MIN_PLAYERS;
    }

    /**
     * Restituisce lo username dell'host.
     */
    public String getHostUsername() {
        User host = players.get(hostId);
        return host != null ? host.getUsername() : null;
    }
}

