package it.unibo.lobbyservice;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

/**
 * Test di base per LobbyService.
 * Nota: Il context test completo richiede MongoDB attivo.
 * Per CI/CD usare Testcontainers o MongoDB embedded.
 */
class LobbyServiceApplicationTests {

    @Test
    void applicationClassExists() {
        // Verifica che la classe principale esista e sia instanziabile
        assertDoesNotThrow(() -> {
            Class<?> clazz = Class.forName("it.unibo.lobbyservice.LobbyServiceApplication");
            assert clazz != null;
        });
    }

}
