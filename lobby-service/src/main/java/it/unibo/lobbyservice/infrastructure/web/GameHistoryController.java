package it.unibo.lobbyservice.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import it.unibo.lobbyservice.application.service.GameHistoryService;
import it.unibo.lobbyservice.application.service.GameHistoryService.PlayerStats;
import it.unibo.lobbyservice.domain.model.GameHistory;
import it.unibo.lobbyservice.domain.model.RoundResult;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * REST Controller per la gestione dello storico partite e statistiche.
 */
@RestController
@RequestMapping("/api/game-history")
@Tag(name = "Game History & Stats", description = "API per storico partite e statistiche giocatori")
public class GameHistoryController {
    
    private final GameHistoryService gameHistoryService;

    public GameHistoryController(GameHistoryService gameHistoryService) {
        this.gameHistoryService = Objects.requireNonNull(gameHistoryService, "GameHistoryService cannot be null");
    }

    /**
     * POST /api/game-history
     * Crea una nuova sessione di gioco.
     */
    @PostMapping
    public ResponseEntity<GameHistoryResponse> createGameSession(@RequestBody CreateGameSessionRequest request) {
        GameHistory gameHistory = gameHistoryService.createGameSession(
                request.roomCode(),
                request.playerIds(),
                request.playerUsernames(),
                request.hostId()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(GameHistoryResponse.from(gameHistory));
    }

    /**
     * POST /api/game-history/{roomCode}/rounds
     * Aggiunge il risultato di un round completato.
     */
    @PostMapping("/{roomCode}/rounds")
    public ResponseEntity<GameHistoryResponse> addRoundResult(
            @PathVariable String roomCode,
            @RequestBody AddRoundResultRequest request) {
        
        GameHistory gameHistory = gameHistoryService.addRoundResult(
                roomCode,
                request.roundNumber(),
                request.impostorId(),
                request.impostorUsername(),
                request.winnerId(),
                request.impostorWon(),
                Instant.parse(request.startedAt()),
                Instant.parse(request.endedAt()),
                request.totalVotes(),
                request.eliminatedPlayerId(),
                request.eliminatedPlayerUsername(),
                request.impostorGuessedWord(),
                request.secretWord()
        );
        
        return ResponseEntity.ok(GameHistoryResponse.from(gameHistory));
    }

    /**
     * GET /api/game-history/room/{roomCode}
     * Ottiene lo storico di una stanza specifica.
     */
    @GetMapping("/room/{roomCode}")
    public ResponseEntity<GameHistoryResponse> getGameHistoryByRoom(@PathVariable String roomCode) {
        GameHistory gameHistory = gameHistoryService.findByRoomCode(roomCode)
                .orElseThrow(() -> new RuntimeException("Game history not found for room " + roomCode));
        return ResponseEntity.ok(GameHistoryResponse.from(gameHistory));
    }

    /**
     * GET /api/game-history/player/{playerId}
     * Ottiene tutte le sessioni di gioco di un giocatore.
     */
    @GetMapping("/player/{playerId}")
    public ResponseEntity<List<GameHistoryResponse>> getPlayerGameHistory(@PathVariable String playerId) {
        List<GameHistory> sessions = gameHistoryService.findPlayerGameHistory(playerId);
        List<GameHistoryResponse> responses = sessions.stream()
                .map(GameHistoryResponse::from)
                .toList();
        return ResponseEntity.ok(responses);
    }

    /**
     * GET /api/game-history/host/{hostId}
     * Ottiene tutte le sessioni create da un host.
     */
    @GetMapping("/host/{hostId}")
    public ResponseEntity<List<GameHistoryResponse>> getSessionsByHost(@PathVariable String hostId) {
        List<GameHistory> sessions = gameHistoryService.findSessionsByHost(hostId);
        List<GameHistoryResponse> responses = sessions.stream()
                .map(GameHistoryResponse::from)
                .toList();
        return ResponseEntity.ok(responses);
    }

    /**
     * GET /api/game-history/recent?since={iso-timestamp}
     * Ottiene sessioni recenti.
     */
    @GetMapping("/recent")
    public ResponseEntity<List<GameHistoryResponse>> getRecentSessions(@RequestParam String since) {
        Instant sinceDate = Instant.parse(since);
        List<GameHistory> sessions = gameHistoryService.findRecentSessions(sinceDate);
        List<GameHistoryResponse> responses = sessions.stream()
                .map(GameHistoryResponse::from)
                .toList();
        return ResponseEntity.ok(responses);
    }

    /**
     * GET /api/game-history/stats/{playerId}
     * Ottiene statistiche aggregate di un giocatore.
     */
    @GetMapping("/stats/{playerId}")
    public ResponseEntity<PlayerStatsResponse> getPlayerStats(@PathVariable String playerId) {
        PlayerStats stats = gameHistoryService.calculatePlayerStats(playerId);
        return ResponseEntity.ok(PlayerStatsResponse.from(stats));
    }

    /**
     * DELETE /api/game-history/{id}
     * Elimina uno storico di partita.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteGameHistory(@PathVariable String id) {
        gameHistoryService.deleteGameHistory(id);
        return ResponseEntity.noContent().build();
    }

    // DTO Records
    public record CreateGameSessionRequest(
            String roomCode,
            List<String> playerIds,
            List<String> playerUsernames,
            String hostId
    ) {}

    public record AddRoundResultRequest(
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

    public record GameHistoryResponse(
            String id,
            String roomCode,
            List<String> playerIds,
            List<String> playerUsernames,
            String hostId,
            String createdAt,
            int totalRounds,
            List<RoundResultResponse> rounds
    ) {
        public static GameHistoryResponse from(GameHistory gameHistory) {
            List<RoundResultResponse> rounds = gameHistory.getAllRounds().stream()
                    .map(RoundResultResponse::from)
                    .toList();
            
            return new GameHistoryResponse(
                    gameHistory.getId(),
                    gameHistory.getRoomCode(),
                    gameHistory.getPlayerIds(),
                    gameHistory.getPlayerUsernames(),
                    gameHistory.getHostId(),
                    gameHistory.getCreatedAt().toString(),
                    gameHistory.getTotalRounds(),
                    rounds
            );
        }
    }

    public record RoundResultResponse(
            Integer roundNumber,
            String impostorId,
            String impostorUsername,
            String winnerId,
            boolean impostorWon,
            String startedAt,
            String endedAt,
            Long durationSeconds,
            Integer totalVotes,
            String eliminatedPlayerId,
            String eliminatedPlayerUsername,
            boolean impostorGuessedWord,
            String secretWord
    ) {
        public static RoundResultResponse from(RoundResult round) {
            return new RoundResultResponse(
                    round.getRoundNumber(),
                    round.getImpostorId(),
                    round.getImpostorUsername(),
                    round.getWinnerId(),
                    round.isImpostorWon(),
                    round.getStartedAt().toString(),
                    round.getEndedAt().toString(),
                    round.getDurationSeconds(),
                    round.getTotalVotes(),
                    round.getEliminatedPlayerId(),
                    round.getEliminatedPlayerUsername(),
                    round.isImpostorGuessedWord(),
                    round.getSecretWord()
            );
        }
    }

    public record PlayerStatsResponse(
            long totalGames,
            long totalWins,
            long totalImpostorRounds,
            long impostorWins,
            double winRate,
            double impostorWinRate
    ) {
        public static PlayerStatsResponse from(PlayerStats stats) {
            return new PlayerStatsResponse(
                    stats.totalGames(),
                    stats.totalWins(),
                    stats.totalImpostorRounds(),
                    stats.impostorWins(),
                    stats.getWinRate(),
                    stats.getImpostorWinRate()
            );
        }
    }
}

