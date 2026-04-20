package it.unibo.lobbyservice.domain.model;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit test dell'Aggregate Root Room.
 * Verifica tutte le invarianti di business senza dipendenze esterne.
 */
@DisplayName("Room Aggregate Root")
class RoomTest {

    private AuthenticatedPlayer host;
    private RoomCode code;

    @BeforeEach
    void setUp() {
        host = AuthenticatedPlayer.create("hostUser", "host@test.com", "hashedpassword");
        code = RoomCode.generate();
    }

    // --- Helper per creare giocatori anonimi ---
    private AnonymousPlayer anon(String username) {
        return new AnonymousPlayer(username);
    }

    // --- Helper per riempire la stanza fino a min player ---
    private Room roomWithMinPlayers() {
        Room room = Room.create(code, host);
        room.addPlayer(anon("player2"));
        room.addPlayer(anon("player3"));
        room.addPlayer(anon("player4"));
        return room;
    }

    // =========================================================================
    @Nested
    @DisplayName("Creazione stanza")
    class Creation {

        @Test
        @DisplayName("crea stanza con host come primo giocatore")
        void createRoomWithHost() {
            Room room = Room.create(code, host);

            assertThat(room.getCode()).isEqualTo(code);
            assertThat(room.getHostId()).isEqualTo(host.getId());
            assertThat(room.getPlayers()).hasSize(1);
            assertThat(room.getStatus()).isEqualTo(RoomStatus.WAITING);
            assertThat(room.getCreatedAt()).isNotNull();
        }

        @Test
        @DisplayName("lancia eccezione se host è null")
        void createRoomWithNullHostThrows() {
            assertThatThrownBy(() -> Room.create(code, null))
                    .isInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("lancia eccezione se codice è null")
        void createRoomWithNullCodeThrows() {
            assertThatThrownBy(() -> Room.create(null, host))
                    .isInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("nuova stanza non può ancora essere avviata (< 4 giocatori)")
        void newRoomCannotStart() {
            Room room = Room.create(code, host);
            assertThat(room.canStart()).isFalse();
        }
    }

    // =========================================================================
    @Nested
    @DisplayName("Aggiunta giocatori")
    class AddPlayer {

        @Test
        @DisplayName("aggiunge giocatore correttamente")
        void addPlayerSuccessfully() {
            Room room = Room.create(code, host);
            room.addPlayer(anon("player2"));

            assertThat(room.getPlayerCount()).isEqualTo(2);
        }

        @Test
        @DisplayName("idempotente: aggiungere lo stesso giocatore due volte non cambia nulla")
        void addSamePlayerTwiceIsIdempotent() {
            Room room = Room.create(code, host);
            AnonymousPlayer p = anon("player2");
            room.addPlayer(p);
            room.addPlayer(p); // seconda volta

            assertThat(room.getPlayerCount()).isEqualTo(2);
        }

        @Test
        @DisplayName("lancia eccezione se username già presente nella stanza")
        void addPlayerWithDuplicateUsernameThrows() {
            Room room = Room.create(code, host);
            room.addPlayer(anon("player2"));

            assertThatThrownBy(() -> room.addPlayer(anon("player2")))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("already taken");
        }

        @Test
        @DisplayName("lancia eccezione se la stanza è piena (> 8 giocatori)")
        void addPlayerToFullRoomThrows() {
            Room room = Room.create(code, host);
            for (int i = 2; i <= 8; i++) {
                room.addPlayer(anon("player" + i));
            }

            assertThatThrownBy(() -> room.addPlayer(anon("player11")))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("full");
        }

        @Test
        @DisplayName("lancia eccezione se la stanza non è in WAITING")
        void addPlayerToStartedRoomThrows() {
            Room room = roomWithMinPlayers();
            room.startGame(host.getId());

            assertThatThrownBy(() -> room.addPlayer(anon("latePlayer")))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("already started");
        }

        @Test
        @DisplayName("con 4 giocatori canStart() è true")
        void canStartWithFourPlayers() {
            Room room = roomWithMinPlayers();
            assertThat(room.canStart()).isTrue();
        }
    }

    // =========================================================================
    @Nested
    @DisplayName("Rimozione giocatori")
    class RemovePlayer {

        @Test
        @DisplayName("rimuove giocatore correttamente")
        void removePlayerSuccessfully() {
            Room room = roomWithMinPlayers();
            String secondPlayerId = room.getPlayers().get(1).getId();

            room.removePlayer(secondPlayerId);

            assertThat(room.getPlayerCount()).isEqualTo(3);
            assertThat(room.getStatus()).isEqualTo(RoomStatus.WAITING);
        }

        @Test
        @DisplayName("idempotente: rimuovere giocatore non presente non lancia eccezione")
        void removeAbsentPlayerIsIdempotent() {
            Room room = Room.create(code, host);

            assertThatCode(() -> room.removePlayer("nonExistentId"))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("se l'ultimo giocatore lascia, stanza diventa ENDED")
        void lastPlayerLeavingEndsRoom() {
            Room room = Room.create(code, host);
            room.removePlayer(host.getId());

            assertThat(room.getStatus()).isEqualTo(RoomStatus.ENDED);
        }

        @Test
        @DisplayName("se host lascia, un altro giocatore diventa host")
        void hostLeavingTransfersOwnership() {
            Room room = roomWithMinPlayers();
            String oldHostId = host.getId();

            room.removePlayer(oldHostId);

            assertThat(room.getHostId()).isNotEqualTo(oldHostId);
            assertThat(room.getHostId()).isIn(
                    room.getPlayers().stream().map(User::getId).toList()
            );
        }

        @Test
        @DisplayName("lancia eccezione se si prova a lasciare una stanza già avviata")
        void removePlayerFromStartedRoomThrows() {
            Room room = roomWithMinPlayers();
            room.startGame(host.getId());
            String playerId = room.getPlayers().get(1).getId();

            assertThatThrownBy(() -> room.removePlayer(playerId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("already started");
        }
    }

    // =========================================================================
    @Nested
    @DisplayName("Avvio partita")
    class StartGame {

        @Test
        @DisplayName("avvia la partita correttamente (host, min 4 giocatori)")
        void startGameSuccessfully() {
            Room room = roomWithMinPlayers();
            room.startGame(host.getId());

            assertThat(room.getStatus()).isEqualTo(RoomStatus.STARTED);
            assertThat(room.getStartedAt()).isNotNull();
            assertThat(room.getCurrentRound()).isEqualTo(1);
        }

        @Test
        @DisplayName("lancia eccezione se non è l'host ad avviare")
        void startGameByNonHostThrows() {
            Room room = roomWithMinPlayers();
            String nonHostId = room.getPlayers().get(1).getId();

            assertThatThrownBy(() -> room.startGame(nonHostId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("host");
        }

        @Test
        @DisplayName("lancia eccezione con meno di 4 giocatori")
        void startGameWithTooFewPlayersThrows() {
            Room room = Room.create(code, host);
            room.addPlayer(anon("player2"));

            assertThatThrownBy(() -> room.startGame(host.getId()))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Insufficient players");
        }

        @Test
        @DisplayName("lancia eccezione se impostors >= numero giocatori")
        void startGameWithTooManyImpostorsThrows() {
            Room room = roomWithMinPlayers(); // 4 giocatori
            room.updateSettings(4, 60); // 4 impostors su 4 giocatori

            assertThatThrownBy(() -> room.startGame(host.getId()))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("impostors");
        }

        @Test
        @DisplayName("idempotente: avviare due volte non lancia eccezione")
        void startGameTwiceIsIdempotent() {
            Room room = roomWithMinPlayers();
            room.startGame(host.getId());

            assertThatCode(() -> room.startGame(host.getId()))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("lancia eccezione se la stanza è già terminata")
        void startGameOnEndedRoomThrows() {
            Room room = roomWithMinPlayers();
            room.startGame(host.getId());
            room.endGame();

            assertThatThrownBy(() -> room.startGame(host.getId()))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    // =========================================================================
    @Nested
    @DisplayName("Fine partita e rematch")
    class EndGameAndRematch {

        @Test
        @DisplayName("termina la partita correttamente")
        void endGameSuccessfully() {
            Room room = roomWithMinPlayers();
            room.startGame(host.getId());
            room.endGame();

            assertThat(room.getStatus()).isEqualTo(RoomStatus.ENDED);
        }

        @Test
        @DisplayName("lancia eccezione se si prova a terminare una partita non avviata")
        void endGameNotStartedThrows() {
            Room room = Room.create(code, host);

            assertThatThrownBy(() -> room.endGame())
                    .isInstanceOf(IllegalStateException.class);
        }

        @Test
        @DisplayName("prepara la stanza per il prossimo round (rematch)")
        void prepareForNextRoundSuccessfully() {
            Room room = roomWithMinPlayers();
            room.startGame(host.getId());
            room.endGame();
            room.prepareForNextRound();

            assertThat(room.getStatus()).isEqualTo(RoomStatus.WAITING);
            assertThat(room.getStartedAt()).isNull();
        }

        @Test
        @DisplayName("round incrementa ad ogni startGame")
        void roundCounterIncrements() {
            Room room = roomWithMinPlayers();
            assertThat(room.getCurrentRound()).isEqualTo(0);

            room.startGame(host.getId());
            assertThat(room.getCurrentRound()).isEqualTo(1);

            room.endGame();
            room.prepareForNextRound();
            room.startGame(host.getId());
            assertThat(room.getCurrentRound()).isEqualTo(2);
        }
    }

    // =========================================================================
    @Nested
    @DisplayName("Impostazioni stanza")
    class Settings {

        @Test
        @DisplayName("aggiorna impostazioni correttamente")
        void updateSettingsSuccessfully() {
            Room room = Room.create(code, host);
            room.updateSettings(2, 120);

            assertThat(room.getImpostors()).isEqualTo(2);
            assertThat(room.getDiscussionTime()).isEqualTo(120);
        }

        @Test
        @DisplayName("lancia eccezione se impostors < 1")
        void updateSettingsWithZeroImpostorsThrows() {
            Room room = Room.create(code, host);

            assertThatThrownBy(() -> room.updateSettings(0, 60))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("impostor");
        }

        @Test
        @DisplayName("lancia eccezione se discussionTime < 10 secondi")
        void updateSettingsWithTooShortDiscussionTimeThrows() {
            Room room = Room.create(code, host);

            assertThatThrownBy(() -> room.updateSettings(1, 5))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Discussion time");
        }

        @Test
        @DisplayName("lancia eccezione se si aggiornano le impostazioni durante la partita")
        void updateSettingsDuringGameThrows() {
            Room room = roomWithMinPlayers();
            room.startGame(host.getId());

            assertThatThrownBy(() -> room.updateSettings(1, 60))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("already started");
        }
    }
}

