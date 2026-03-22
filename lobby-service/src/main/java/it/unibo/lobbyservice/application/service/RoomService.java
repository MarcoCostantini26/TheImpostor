package it.unibo.lobbyservice.application.service;

import it.unibo.lobbyservice.domain.model.*;
import it.unibo.lobbyservice.domain.repository.RoomRepository;
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

    public RoomService(RoomRepository roomRepository, RoomFactory roomFactory) {
        this.roomRepository = Objects.requireNonNull(roomRepository, "RoomRepository cannot be null");
        this.roomFactory = Objects.requireNonNull(roomFactory, "RoomFactory cannot be null");
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
        return roomRepository.save(room);
    }

    /**
     * UC-03: Lascia una stanza.
     */
    public void leaveRoom(String roomCode, String playerId) {
        Objects.requireNonNull(roomCode, "Room code cannot be null");
        Objects.requireNonNull(playerId, "Player ID cannot be null");
        
        Room room = roomRepository.findByCode(RoomCode.of(roomCode))
                .orElseThrow(() -> new RoomNotFoundException("Room with code " + roomCode + " not found"));
        
        room.removePlayer(playerId);
        
        if (room.getStatus() == RoomStatus.ENDED) {
            // Host ha lasciato: elimina la stanza
            roomRepository.deleteByCode(room.getCode());
        } else {
            roomRepository.save(room);
        }
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
        
        // Crea l'evento domain
        List<String> playerIds = room.getPlayers().stream()
                .map(User::getId)
                .toList();
        
        List<String> playerUsernames = room.getPlayers().stream()
                .map(User::getUsername)
                .toList();
        
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
}

