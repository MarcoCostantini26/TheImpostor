package it.unibo.lobbyservice.application.service;

import it.unibo.lobbyservice.domain.model.*;
import it.unibo.lobbyservice.domain.repository.RoomRepository;
import it.unibo.lobbyservice.infrastructure.integration.CommServiceNotifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

/**
 * Application Service per la gestione delle Room.
 * Coordina i casi d'uso del dominio Room.
 */
@Service
@Transactional
public class RoomService {
    
    private final RoomRepository roomRepository;
    private final RoomFactory roomFactory;
    private final CommServiceNotifier commNotifier;

    public RoomService(RoomRepository roomRepository, RoomFactory roomFactory, CommServiceNotifier commNotifier) {
        this.roomRepository = Objects.requireNonNull(roomRepository, "RoomRepository cannot be null");
        this.roomFactory = Objects.requireNonNull(roomFactory, "RoomFactory cannot be null");
        this.commNotifier = Objects.requireNonNull(commNotifier, "CommServiceNotifier cannot be null");
    }

    /**
     * UC-01: Crea una nuova stanza.
     * L'host diventa il primo giocatore.
     */
    public Room createRoom(User host) {
        Objects.requireNonNull(host, "Host cannot be null");
        
        Room room = roomFactory.createRoom(host);
        return roomRepository.save(room);
    }

    /**
     * UC-02: Unisciti a una stanza esistente.
     */
    public Room joinRoom(String roomCode, User player) {
        Objects.requireNonNull(roomCode, "Room code cannot be null");
        Objects.requireNonNull(player, "Player cannot be null");
        
        Room room = roomRepository.findByCode(RoomCode.of(roomCode))
                .orElseThrow(() -> new RoomNotFoundException("Room with code " + roomCode + " not found"));
        
        room.addPlayer(player);
        Room saved = roomRepository.save(room);

        // Notifica comm-service
        List<String> allPlayerIds = saved.getPlayers().stream().map(User::getId).toList();
        commNotifier.notifyPlayerJoined(roomCode, player.getId(), player.getUsername(), allPlayerIds);

        return saved;
    }

    /**
     * UC-03: Lascia una stanza.
     */
    public void leaveRoom(String roomCode, String playerId) {
        Objects.requireNonNull(roomCode, "Room code cannot be null");
        Objects.requireNonNull(playerId, "Player ID cannot be null");
        
        // Idempotent: if room doesn't exist, nothing to leave
        var optRoom = roomRepository.findByCode(RoomCode.of(roomCode));
        if (optRoom.isEmpty()) {
            return;
        }
        
        Room room = optRoom.get();
        room.removePlayer(playerId); // Now idempotent
        
        boolean roomDeleted;
        if (room.getStatus() == RoomStatus.ENDED) {
            roomRepository.deleteByCode(room.getCode());
            roomDeleted = true;
        } else {
            roomRepository.save(room);
            roomDeleted = false;
        }

        // Notifica comm-service
        commNotifier.notifyPlayerLeft(roomCode, playerId, roomDeleted);
    }

    /**
     * UC-04: Avvia la partita (solo host).
     * Ritorna l'evento GameStartRequested.
     */
    public GameStartRequested startGame(String roomCode, String requesterId) {
        Objects.requireNonNull(roomCode, "Room code cannot be null");
        Objects.requireNonNull(requesterId, "Requester ID cannot be null");
        
        Room room = roomRepository.findByCode(RoomCode.of(roomCode))
                .orElseThrow(() -> new RoomNotFoundException("Room with code " + roomCode + " not found"));
        
        room.startGame(requesterId);
        roomRepository.save(room);
        
        List<String> playerIds = room.getPlayers().stream()
                .map(User::getId)
                .toList();
        
        List<String> playerUsernames = room.getPlayers().stream()
                .map(User::getUsername)
                .toList();

        // Notifica comm-service
        commNotifier.notifyGameStarted(roomCode, playerIds, room.getHostId());
        
        return GameStartRequested.create(
                room.getCode().getValue(),
                room.getCurrentRound(),
                playerIds,
                playerUsernames,
                room.getHostId()
        );
    }

    /**
     * UC-05: Visualizza i dettagli di una stanza.
     */
    public Room getRoomByCode(String roomCode) {
        Objects.requireNonNull(roomCode, "Room code cannot be null");
        
        return roomRepository.findByCode(RoomCode.of(roomCode))
                .orElseThrow(() -> new RoomNotFoundException("Room with code " + roomCode + " not found"));
    }

    /**
     * Ottiene tutte le stanze attive.
     */
    public List<Room> getAllActiveRooms() {
        return roomRepository.findAllActive();
    }

    /**
     * Prepara la stanza per un nuovo round (rematch).
     */
    public Room prepareForNextRound(String roomCode, String requesterId) {
        Objects.requireNonNull(roomCode, "Room code cannot be null");
        Objects.requireNonNull(requesterId, "Requester ID cannot be null");
        
        Room room = roomRepository.findByCode(RoomCode.of(roomCode))
                .orElseThrow(() -> new RoomNotFoundException("Room with code " + roomCode + " not found"));
        
        if (!room.isHost(requesterId)) {
            throw new IllegalStateException("Only the host can prepare for next round");
        }
        
        room.prepareForNextRound();
        return roomRepository.save(room);
    }

    /**
     * Termina una partita.
     */
    public Room endGame(String roomCode) {
        Objects.requireNonNull(roomCode, "Room code cannot be null");
        
        Room room = roomRepository.findByCode(RoomCode.of(roomCode))
                .orElseThrow(() -> new RoomNotFoundException("Room with code " + roomCode + " not found"));
        
        room.endGame();
        return roomRepository.save(room);
    }

    /**
     * Aggiorna le impostazioni della stanza (solo host).
     */
    public Room updateSettings(String roomCode, String requesterId, int impostors, int discussionTime) {
        Objects.requireNonNull(roomCode, "Room code cannot be null");
        Objects.requireNonNull(requesterId, "Requester ID cannot be null");
        
        Room room = roomRepository.findByCode(RoomCode.of(roomCode))
                .orElseThrow(() -> new RoomNotFoundException("Room with code " + roomCode + " not found"));
        
        if (!room.isHost(requesterId)) {
            throw new IllegalStateException("Only the host can update settings");
        }
        
        room.updateSettings(impostors, discussionTime);
        Room saved = roomRepository.save(room);

        // Notifica comm-service
        commNotifier.notifySettingsUpdated(roomCode, impostors, discussionTime);

        return saved;
    }
}
