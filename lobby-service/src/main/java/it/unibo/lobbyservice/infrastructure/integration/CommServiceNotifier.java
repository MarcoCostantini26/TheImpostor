package it.unibo.lobbyservice.infrastructure.integration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Notifica il comm-service (Node.js/Socket.IO) dei cambiamenti di stato nella stanza.
 * Le chiamate sono fire-and-forget: se il comm-service non risponde, il lobby-service
 * continua a funzionare normalmente.
 */
@Service
public class CommServiceNotifier {

    private static final Logger log = LoggerFactory.getLogger(CommServiceNotifier.class);

    private final RestClient restClient;
    private final String commServiceUrl;

    public CommServiceNotifier(@Value("${app.comm-service.url:http://localhost:3000}") String commServiceUrl) {
        this.commServiceUrl = commServiceUrl;
        this.restClient = RestClient.builder()
                .baseUrl(commServiceUrl)
                .build();
        log.info("CommServiceNotifier initialized with URL: {}", commServiceUrl);
    }

    /**
     * Notifica che un giocatore si e' unito alla stanza.
     */
    @Async
    public void notifyPlayerJoined(String roomCode, String playerId, String username, List<String> allPlayerIds) {
        sendNotification("/api/internal/lobby/player-joined", Map.of(
                "event", "PLAYER_JOINED",
                "roomCode", roomCode,
                "playerId", playerId,
                "username", username,
                "players", allPlayerIds
        ));
    }

    /**
     * Notifica che un giocatore ha lasciato la stanza.
     */
    @Async
    public void notifyPlayerLeft(String roomCode, String playerId, boolean roomDeleted) {
        sendNotification("/api/internal/lobby/player-left", Map.of(
                "event", "PLAYER_LEFT",
                "roomCode", roomCode,
                "playerId", playerId,
                "roomDeleted", roomDeleted
        ));
    }

    /**
     * Notifica che la partita e' stata avviata.
     */
    @Async
    public void notifyGameStarted(String roomCode, List<String> playerIds, String hostId) {
        sendNotification("/api/internal/lobby/game-started", Map.of(
                "event", "GAME_STARTED",
                "roomCode", roomCode,
                "playerIds", playerIds,
                "hostId", hostId
        ));
    }

    /**
     * Notifica che le impostazioni della stanza sono cambiate.
     */
    @Async
    public void notifySettingsUpdated(String roomCode, int impostors, int discussionTime) {
        sendNotification("/api/internal/lobby/settings-updated", Map.of(
                "event", "SETTINGS_UPDATED",
                "roomCode", roomCode,
                "impostors", impostors,
                "discussionTime", discussionTime
        ));
    }

    private void sendNotification(String path, Map<String, Object> payload) {
        try {
            restClient.post()
                    .uri(path)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
            log.debug("Notification sent to comm-service: {} -> {}", path, payload.get("event"));
        } catch (Exception e) {
            // Fire-and-forget: non blocchiamo il lobby-service se comm-service non risponde
            log.warn("Failed to notify comm-service at {}{}: {}", commServiceUrl, path, e.getMessage());
        }
    }
}
