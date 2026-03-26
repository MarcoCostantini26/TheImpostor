package it.unibo.lobbyservice.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import it.unibo.lobbyservice.application.service.RoomService;
import it.unibo.lobbyservice.domain.model.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * REST Controller per la gestione delle Room.
 * Espone gli endpoint API per il ciclo di vita delle stanze.
 */
@RestController
@RequestMapping("/api/rooms")
@Tag(name = "Room Management", description = "API per creazione e gestione stanze di gioco")
public class RoomController {
    
    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = Objects.requireNonNull(roomService, "RoomService cannot be null");
    }

    /**
     * POST /api/rooms
     * Crea una nuova stanza (UC-01).
     */
    @PostMapping
    @Operation(summary = "Crea una nuova stanza", description = "L'host diventa il primo giocatore della stanza")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Stanza creata con successo"),
        @ApiResponse(responseCode = "400", description = "Dati richiesta non validi")
    })
    public ResponseEntity<RoomResponse> createRoom(@RequestBody CreateRoomRequest request) {
        User host = createUserFromRequest(request.hostUsername(), request.hostId(), request.isAuthenticated());
        Room room = roomService.createRoom(host);
        return ResponseEntity.status(HttpStatus.CREATED).body(RoomResponse.from(room));
    }

    /**
     * POST /api/rooms/{code}/join
     * Unisciti a una stanza esistente (UC-02).
     */
    @PostMapping("/{code}/join")
    public ResponseEntity<RoomResponse> joinRoom(@PathVariable String code, @RequestBody JoinRoomRequest request) {
        User player = createUserFromRequest(request.username(), request.userId(), request.isAuthenticated());
        Room room = roomService.joinRoom(code, player);
        return ResponseEntity.ok(RoomResponse.from(room));
    }

    /**
     * POST /api/rooms/{code}/leave
     * Lascia una stanza (UC-03).
     */
    @PostMapping("/{code}/leave")
    public ResponseEntity<?> leaveRoom(@PathVariable String code, @RequestBody LeaveRoomRequest request) {
        Room room = roomService.getRoomByCode(code);
        roomService.leaveRoom(code, request.playerId());
        
        // Se l'host esce la stanza viene eliminata -> 204
        if (request.playerId().equals(room.getHostId())) {
            return ResponseEntity.noContent().build();
        }
        
        // Altrimenti restituisci la stanza aggiornata
        Room updatedRoom = roomService.getRoomByCode(code);
        return ResponseEntity.ok(RoomResponse.from(updatedRoom));
    }

    /**
     * POST /api/rooms/{code}/start
     * Avvia la partita (UC-04 - solo host).
     */
    @PostMapping("/{code}/start")
    public ResponseEntity<GameStartResponse> startGame(@PathVariable String code, @RequestBody StartGameRequest request) {
        GameStartRequested event = roomService.startGame(code, request.hostId());
        return ResponseEntity.ok(GameStartResponse.from(event));
    }

    /**
     * GET /api/rooms/{code}
     * Visualizza i dettagli di una stanza (UC-05).
     */
    @GetMapping("/{code}")
    public ResponseEntity<RoomResponse> getRoomByCode(@PathVariable String code) {
        Room room = roomService.getRoomByCode(code);
        return ResponseEntity.ok(RoomResponse.from(room));
    }

    /**
     * GET /api/rooms
     * Ottiene tutte le stanze attive.
     */
    @GetMapping
    public ResponseEntity<List<RoomResponse>> getAllActiveRooms() {
        List<Room> rooms = roomService.getAllActiveRooms();
        List<RoomResponse> responses = rooms.stream()
                .map(RoomResponse::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(responses);
    }

    /**
     * POST /api/rooms/{code}/next-round
     * Prepara la stanza per un nuovo round (rematch).
     */
    @PostMapping("/{code}/next-round")
    public ResponseEntity<RoomResponse> prepareNextRound(@PathVariable String code, @RequestBody NextRoundRequest request) {
        Room room = roomService.prepareForNextRound(code, request.hostId());
        return ResponseEntity.ok(RoomResponse.from(room));
    }

    /**
     * POST /api/rooms/{code}/end
     * Termina la partita.
     */
    @PostMapping("/{code}/end")
    public ResponseEntity<RoomResponse> endGame(@PathVariable String code) {
        Room room = roomService.endGame(code);
        return ResponseEntity.ok(RoomResponse.from(room));
    }

    /**
     * PUT /api/rooms/{code}/settings
     * Aggiorna le impostazioni della stanza (solo host).
     */
    @PutMapping("/{code}/settings")
    @Operation(summary = "Aggiorna le impostazioni della stanza", description = "Solo l'host può modificare le impostazioni")
    public ResponseEntity<RoomResponse> updateSettings(@PathVariable String code, @RequestBody UpdateSettingsRequest request) {
        Room room = roomService.updateSettings(code, request.hostId(), request.impostors(), request.discussionTime());
        return ResponseEntity.ok(RoomResponse.from(room));
    }

    /**
     * GET /api/rooms/{code}/players
     * Restituisce la lista dei giocatori nella stanza.
     */
    @GetMapping("/{code}/players")
    @Operation(summary = "Lista giocatori della stanza")
    public ResponseEntity<List<PlayerInfo>> getPlayers(@PathVariable String code) {
        Room room = roomService.getRoomByCode(code);
        List<PlayerInfo> players = room.getPlayers().stream()
                .map(player -> new PlayerInfo(player.getId(), player.getUsername(), player.isAuthenticated()))
                .toList();
        return ResponseEntity.ok(players);
    }

    // Helper method per creare User dal request
    private User createUserFromRequest(String username, String userId, boolean isAuthenticated) {
        if (isAuthenticated && userId != null) {
            // Placeholder: dovrebbe essere recuperato dal database
            return new AnonymousPlayer(userId, username);
        }
        return new AnonymousPlayer(username);
    }

    // DTO Records
    public record CreateRoomRequest(String hostUsername, String hostId, boolean isAuthenticated) {}
    public record JoinRoomRequest(String username, String userId, boolean isAuthenticated) {}
    public record LeaveRoomRequest(String playerId) {}
    public record StartGameRequest(String hostId) {}
    public record NextRoundRequest(String hostId) {}
    public record UpdateSettingsRequest(String hostId, int impostors, int discussionTime) {}

    public record RoomResponse(
            String code,
            String hostId,
            String hostUsername,
            List<PlayerInfo> players,
            String status,
            int currentRound,
            String createdAt,
            String startedAt,
            boolean canStart,
            int impostors,
            int discussionTime
    ) {
        public static RoomResponse from(Room room) {
            List<PlayerInfo> players = room.getPlayers().stream()
                    .map(player -> new PlayerInfo(player.getId(), player.getUsername(), player.isAuthenticated()))
                    .toList();

            return new RoomResponse(
                    room.getCode().getValue(),
                    room.getHostId(),
                    room.getHostUsername(),
                    players,
                    room.getStatus().name(),
                    room.getCurrentRound(),
                    room.getCreatedAt().toString(),
                    room.getStartedAt() != null ? room.getStartedAt().toString() : null,
                    room.canStart(),
                    room.getImpostors(),
                    room.getDiscussionTime()
            );
        }
    }

    public record PlayerInfo(String id, String username, boolean isAuthenticated) {}

    public record GameStartResponse(
            String roomCode,
            int roundNumber,
            List<String> playerIds,
            List<String> playerUsernames,
            String hostId,
            String occurredAt
    ) {
        public static GameStartResponse from(GameStartRequested event) {
            return new GameStartResponse(
                    event.getRoomCode(),
                    event.getRoundNumber(),
                    event.getPlayerIds(),
                    event.getPlayerUsernames(),
                    event.getHostId(),
                    event.getOccurredAt().toString()
            );
        }
    }
}

