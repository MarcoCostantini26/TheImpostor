package it.unibo.lobbyservice.infrastructure.integration;

/**
 * Enum di tutti gli eventi che il lobby-service invia al comm-service.
 * Ogni valore porta con sé:
 *  - il nome dell'evento (serializzato da Jackson come stringa nel JSON)
 *  - il path HTTP dell'endpoint del comm-service da notificare
 */
public enum CommEvent {
    PLAYER_JOINED ("/api/internal/lobby/player-joined"),
    PLAYER_LEFT   ("/api/internal/lobby/player-left"),
    GAME_STARTED  ("/api/internal/lobby/game-started"),
    SETTINGS_UPDATED("/api/internal/lobby/settings-updated");

    private final String path;

    CommEvent(String path) {
        this.path = path;
    }

    public String getPath() {
        return path;
    }
}

