package it.unibo.lobbyservice.infrastructure.integration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;

/**
 * Notifica il comm-service (Node.js/Socket.IO) dei cambiamenti di stato nella stanza.
 * Le chiamate sono fire-and-forget (@Async): se il comm-service non risponde,
 * il lobby-service continua a funzionare normalmente.
 *
 * Timeout configurabili via:
 *   app.comm-service.connect-timeout-ms (default 2000 ms)
 *   app.comm-service.read-timeout-ms    (default 3000 ms)
 */
@Service
public class CommServiceNotifier {

    private static final Logger log = LoggerFactory.getLogger(CommServiceNotifier.class);

    private final RestClient restClient;
    private final String commServiceUrl;

    // ---------------------------------------------------------------------------
    // Payload records tipizzati — sostituiscono Map<String, Object> grezzo.
    // Il campo "event" usa CommEvent (enum) invece di String:
    // typo impossibile, tutti gli eventi sono in un posto solo.
    // Jackson serializza l'enum come stringa (es. "PLAYER_JOINED").
    // ---------------------------------------------------------------------------
    record PlayerJoinedPayload(CommEvent event, String roomCode, String playerId,
                               String username, List<String> players) {}

    record PlayerLeftPayload(CommEvent event, String roomCode, String playerId,
                             boolean roomDeleted) {}

    record GameStartedPayload(CommEvent event, String roomCode,
                              List<String> playerIds, String hostId) {}

    record SettingsUpdatedPayload(CommEvent event, String roomCode,
                                  int impostors, int discussionTime) {}

    // ---------------------------------------------------------------------------

    public CommServiceNotifier(
            @Value("${app.comm-service.url:http://localhost:3000}") String commServiceUrl,
            @Value("${app.comm-service.connect-timeout-ms:2000}") int connectTimeoutMs,
            @Value("${app.comm-service.read-timeout-ms:3000}") int readTimeoutMs) {

        this.commServiceUrl = commServiceUrl;

        // Timeout espliciti: evita che i thread @Async rimangano bloccati
        // indefinitamente se il comm-service non risponde
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeoutMs);
        factory.setReadTimeout(readTimeoutMs);

        this.restClient = RestClient.builder()
                .baseUrl(commServiceUrl)
                .requestFactory(factory)
                .build();

        log.info("CommServiceNotifier initialized with URL: {} (connect={}ms, read={}ms)",
                commServiceUrl, connectTimeoutMs, readTimeoutMs);
    }

    /**
     * Notifica che un giocatore si è unito alla stanza.
     */
    @Async
    public void notifyPlayerJoined(String roomCode, String playerId, String username, List<String> allPlayerIds) {
        sendNotification(CommEvent.PLAYER_JOINED,
                new PlayerJoinedPayload(CommEvent.PLAYER_JOINED, roomCode, playerId, username, allPlayerIds));
    }

    /**
     * Notifica che un giocatore ha lasciato la stanza.
     */
    @Async
    public void notifyPlayerLeft(String roomCode, String playerId, boolean roomDeleted) {
        sendNotification(CommEvent.PLAYER_LEFT,
                new PlayerLeftPayload(CommEvent.PLAYER_LEFT, roomCode, playerId, roomDeleted));
    }

    /**
     * Notifica che la partita è stata avviata.
     */
    @Async
    public void notifyGameStarted(String roomCode, List<String> playerIds, String hostId) {
        sendNotification(CommEvent.GAME_STARTED,
                new GameStartedPayload(CommEvent.GAME_STARTED, roomCode, playerIds, hostId));
    }

    /**
     * Notifica che le impostazioni della stanza sono cambiate.
     */
    @Async
    public void notifySettingsUpdated(String roomCode, int impostors, int discussionTime) {
        sendNotification(CommEvent.SETTINGS_UPDATED,
                new SettingsUpdatedPayload(CommEvent.SETTINGS_UPDATED, roomCode, impostors, discussionTime));
    }

    private void sendNotification(CommEvent event, Object payload) {
        try {
            restClient.post()
                    .uri(event.getPath())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
            log.debug("Notification sent to comm-service: {}", event.getPath());
        } catch (Exception e) {
            // Fire-and-forget: non blocchiamo il lobby-service se comm-service non risponde
            log.warn("Failed to notify comm-service at {}{}: {}", commServiceUrl, event.getPath(), e.getMessage());
        }
    }
}
