package it.unibo.lobbyservice.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import it.unibo.lobbyservice.application.service.GameHistoryService;
import it.unibo.lobbyservice.application.service.RoomService;
import it.unibo.lobbyservice.domain.model.GameHistory;
import it.unibo.lobbyservice.domain.model.Room;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * Controller per le API interne utilizzate dagli altri microservizi.
 * (Es. Comm Service in Node.js, Game Engine in Go)
 */
@RestController
@RequestMapping("/api/internal")
@Tag(name = "Internal Integration", description = "API interne per Comm Service e Game Engine")
public class InternalIntegrationController {

    private final RoomService roomService;
    private final GameHistoryService gameHistoryService;

    public InternalIntegrationController(RoomService roomService, GameHistoryService gameHistoryService) {
        this.roomService = Objects.requireNonNull(roomService);
        this.gameHistoryService = Objects.requireNonNull(gameHistoryService);
    }

    /**
     * GET /api/internal/rooms/{code}
     * Usato da Comm Service e Game Engine per recuperare i dettagli di una stanza e validare chi c'è dentro.
     */
    @GetMapping("/rooms/{code}")
    @Operation(summary = "Recupera i dettagli di una stanza", description = "API ad uso interno")
    public ResponseEntity<RoomController.RoomResponse> getRoomDetails(@PathVariable String code) {
        Room room = roomService.getRoomByCode(code);
        return ResponseEntity.ok(RoomController.RoomResponse.from(room));
    }

    /**
     * POST /api/internal/auth/validate-token
     * Usato dal Comm Service per validare la connessione al WebSocket di un utente.
     */
    @PostMapping("/auth/validate-token")
    @Operation(summary = "Valida un token utente per una determinata stanza")
    public ResponseEntity<TokenValidationResponse> validateToken(@RequestBody TokenValidationRequest request) {
        try {
            Room room = roomService.getRoomByCode(request.roomCode());
            // Verifica se l'utente è attualmente elencato tra i giocatori della stanza
            boolean isPlayerInRoom = room.getPlayers().stream()
                    .anyMatch(p -> p.getId().equals(request.playerId()) || p.getUsername().equals(request.username()));

            if (isPlayerInRoom) {
                return ResponseEntity.ok(new TokenValidationResponse(true, "Token valid and player is in room"));
            } else {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new TokenValidationResponse(false, "Player is not in the specified room"));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new TokenValidationResponse(false, "Room not found or invalid data"));
        }
    }

    /**
     * POST /api/internal/games/session
     * Usato dal Game Engine quando inizia ufficialmente una partita per registrare la sessione.
     */
    @PostMapping("/games/session")
    @Operation(summary = "Inizializza una sessione di gioco nello storico")
    public ResponseEntity<GameHistoryResponse> createGameSession(@RequestBody CreateSessionRequest request) {
        GameHistory session = gameHistoryService.createGameSession(
                request.roomCode(),
                request.playerIds(),
                request.playerUsernames(),
                request.hostId()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(GameHistoryResponse.from(session));
    }

    /**
     * POST /api/internal/games/{roomCode}/round-result
     * Usato dal Game Engine alla fine di un round per salvare i risultati.
     */
    @PostMapping("/games/{roomCode}/round-result")
    @Operation(summary = "Registra i risultati di un round completato")
    public ResponseEntity<GameHistoryResponse> saveRoundResult(
            @PathVariable String roomCode,
            @RequestBody RoundResultRequest request) {
        
        GameHistory session = gameHistoryService.addRoundResult(
                roomCode,
                request.roundNumber(),
                request.impostorId(),
                request.impostorUsername(),
                request.winnerId(),
                request.impostorWon(),
                request.startedAt() != null ? Instant.parse(request.startedAt()) : Instant.now(),
                request.endedAt() != null ? Instant.parse(request.endedAt()) : Instant.now(),
                request.totalVotes(),
                request.eliminatedPlayerId(),
                request.eliminatedPlayerUsername(),
                request.impostorGuessedWord(),
                request.secretWord()
        );
        return ResponseEntity.ok(GameHistoryResponse.from(session));
    }

    // DTOs specifici per queste integrazioni interne
    public record TokenValidationRequest(String roomCode, String playerId, String username) {}
    public record TokenValidationResponse(boolean valid, String message) {}

    public record CreateSessionRequest(String roomCode, List<String> playerIds, List<String> playerUsernames, String hostId) {}

    public record RoundResultRequest(
            Integer roundNumber,
            String impostorId,
            String impostorUsername,
            String winnerId,
            boolean impostorWon,
            String startedAt,
            String endedAt,
            Integer totalVotes,
            String eliminatedPlayerId,
            String eliminatedPlayerUsername,
            boolean impostorGuessedWord,
            String secretWord
    ) {}

    public record GameHistoryResponse(String id, String roomCode, int totalRounds, String createdAt) {
        public static GameHistoryResponse from(GameHistory history) {
            return new GameHistoryResponse(
                    history.getId(),
                    history.getRoomCode(),
                    history.getTotalRounds(),
                    history.getCreatedAt().toString()
            );
        }
    }
}
