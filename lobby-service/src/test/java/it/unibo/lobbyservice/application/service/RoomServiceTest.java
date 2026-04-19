package it.unibo.lobbyservice.application.service;

import it.unibo.lobbyservice.domain.model.*;
import it.unibo.lobbyservice.domain.repository.RoomRepository;
import it.unibo.lobbyservice.infrastructure.integration.CommServiceNotifier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit test di RoomService (Application Layer).
 * Verifica la logica di coordinamento dei casi d'uso senza dipendenze esterne
 * tramite mock di RoomRepository, RoomFactory e CommServiceNotifier.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("RoomService - Application Service")
class RoomServiceTest {

    @Mock
    private RoomRepository roomRepository;

    @Mock
    private RoomFactory roomFactory;

    @Mock
    private CommServiceNotifier commNotifier;

    @InjectMocks
    private RoomService roomService;

    // --- Fixtures ---
    private AuthenticatedPlayer host;
    private RoomCode code;
    private Room room;

    @BeforeEach
    void setUp() {
        host = AuthenticatedPlayer.create("hostUser", "host@test.com", "hashedpassword");
        code = RoomCode.of("ABC123");
        room = Room.create(code, host);
    }

    // Aggiunge n giocatori anonimi alla stanza
    private void fillRoom(Room r, int total) {
        for (int i = r.getPlayerCount() + 1; i <= total; i++) {
            r.addPlayer(new AnonymousPlayer("player" + i));
        }
    }

    // =========================================================================
    @Nested
    @DisplayName("UC-01: createRoom")
    class CreateRoom {

        @Test
        @DisplayName("crea e salva una stanza, ritorna la stanza salvata")
        void createRoomSuccessfully() {
            when(roomFactory.createRoom(host)).thenReturn(room);
            when(roomRepository.save(room)).thenReturn(room);

            Room result = roomService.createRoom(host);

            assertThat(result).isEqualTo(room);
            verify(roomFactory).createRoom(host);
            verify(roomRepository).save(room);
        }

        @Test
        @DisplayName("lancia NullPointerException se host è null")
        void createRoomWithNullHostThrows() {
            assertThatThrownBy(() -> roomService.createRoom(null))
                    .isInstanceOf(NullPointerException.class);

            verifyNoInteractions(roomFactory, roomRepository, commNotifier);
        }
    }

    // =========================================================================
    @Nested
    @DisplayName("UC-02: joinRoom")
    class JoinRoom {

        @Test
        @DisplayName("aggiunge il giocatore e notifica il comm-service")
        void joinRoomSuccessfully() {
            AnonymousPlayer newPlayer = new AnonymousPlayer("newPlayer");
            when(roomRepository.findByCode(code)).thenReturn(Optional.of(room));
            when(roomRepository.save(room)).thenReturn(room);

            Room result = roomService.joinRoom("ABC123", newPlayer);

            assertThat(result).isEqualTo(room);
            assertThat(room.getPlayers()).contains(newPlayer);

            // Il comm-service deve essere notificato
            verify(commNotifier).notifyPlayerJoined(
                    eq("ABC123"),
                    eq(newPlayer.getId()),
                    eq(newPlayer.getUsername()),
                    anyList()
            );
        }

        @Test
        @DisplayName("lancia RoomNotFoundException se il codice non esiste")
        void joinRoomNotFoundThrows() {
            when(roomRepository.findByCode(code)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> roomService.joinRoom("ABC123", new AnonymousPlayer("p")))
                    .isInstanceOf(RoomNotFoundException.class);

            verifyNoInteractions(commNotifier);
        }

        @Test
        @DisplayName("lancia NullPointerException se roomCode è null")
        void joinRoomWithNullCodeThrows() {
            assertThatThrownBy(() -> roomService.joinRoom(null, host))
                    .isInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("lancia NullPointerException se player è null")
        void joinRoomWithNullPlayerThrows() {
            assertThatThrownBy(() -> roomService.joinRoom("ABC123", null))
                    .isInstanceOf(NullPointerException.class);
        }
    }

    // =========================================================================
    @Nested
    @DisplayName("UC-03: leaveRoom")
    class LeaveRoom {

        @Test
        @DisplayName("rimuove il giocatore e salva, notifica comm-service")
        void leaveRoomSuccessfully() {
            fillRoom(room, 4);
            String secondPlayerId = room.getPlayers().get(1).getId();
            when(roomRepository.findByCode(code)).thenReturn(Optional.of(room));
            when(roomRepository.save(room)).thenReturn(room);

            roomService.leaveRoom("ABC123", secondPlayerId);

            verify(roomRepository).save(room);
            verify(commNotifier).notifyPlayerLeft("ABC123", secondPlayerId, false);
        }

        @Test
        @DisplayName("quando l'ultimo giocatore lascia, la stanza viene eliminata")
        void lastPlayerLeavingDeletesRoom() {
            when(roomRepository.findByCode(code)).thenReturn(Optional.of(room));

            roomService.leaveRoom("ABC123", host.getId());

            verify(roomRepository).deleteByCode(code);
            verify(commNotifier).notifyPlayerLeft("ABC123", host.getId(), true);
        }

        @Test
        @DisplayName("idempotente: se la stanza non esiste, non lancia eccezione")
        void leaveRoomNotFoundIsIdempotent() {
            when(roomRepository.findByCode(code)).thenReturn(Optional.empty());

            assertThatCode(() -> roomService.leaveRoom("ABC123", host.getId()))
                    .doesNotThrowAnyException();

            verifyNoInteractions(commNotifier);
        }

        @Test
        @DisplayName("lancia NullPointerException se roomCode è null")
        void leaveRoomWithNullCodeThrows() {
            assertThatThrownBy(() -> roomService.leaveRoom(null, "someId"))
                    .isInstanceOf(NullPointerException.class);
        }
    }

    // =========================================================================
    @Nested
    @DisplayName("UC-04: startGame")
    class StartGame {

        @Test
        @DisplayName("avvia la partita e ritorna l'evento GameStartRequested")
        void startGameSuccessfully() {
            fillRoom(room, 4);
            when(roomRepository.findByCode(code)).thenReturn(Optional.of(room));
            when(roomRepository.save(room)).thenReturn(room);

            GameStartRequested event = roomService.startGame("ABC123", host.getId());

            assertThat(event).isNotNull();
            assertThat(event.getRoomCode()).isEqualTo("ABC123");
            assertThat(event.getPlayerIds()).hasSize(4);
            assertThat(room.getStatus()).isEqualTo(RoomStatus.STARTED);

            verify(commNotifier).notifyGameStarted(eq("ABC123"), anyList(), eq(host.getId()));
        }

        @Test
        @DisplayName("lancia eccezione se non è l'host a richiedere l'avvio")
        void startGameByNonHostThrows() {
            fillRoom(room, 4);
            String nonHostId = room.getPlayers().get(1).getId();
            when(roomRepository.findByCode(code)).thenReturn(Optional.of(room));

            assertThatThrownBy(() -> roomService.startGame("ABC123", nonHostId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("host");

            verifyNoInteractions(commNotifier);
        }

        @Test
        @DisplayName("lancia RoomNotFoundException se il codice non esiste")
        void startGameRoomNotFoundThrows() {
            when(roomRepository.findByCode(code)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> roomService.startGame("ABC123", host.getId()))
                    .isInstanceOf(RoomNotFoundException.class);

            verifyNoInteractions(commNotifier);
        }

        @Test
        @DisplayName("l'evento contiene tutti gli id e username dei giocatori")
        void startGameEventContainsAllPlayers() {
            fillRoom(room, 4);
            when(roomRepository.findByCode(code)).thenReturn(Optional.of(room));
            when(roomRepository.save(room)).thenReturn(room);

            GameStartRequested event = roomService.startGame("ABC123", host.getId());

            List<String> expectedUsernames = room.getPlayers().stream()
                    .map(User::getUsername).toList();
            assertThat(event.getPlayerUsernames()).containsExactlyInAnyOrderElementsOf(expectedUsernames);
        }
    }

    // =========================================================================
    @Nested
    @DisplayName("UC-05: getRoomByCode")
    class GetRoomByCode {

        @Test
        @DisplayName("ritorna la stanza se esiste")
        void getRoomByCodeSuccessfully() {
            when(roomRepository.findByCode(code)).thenReturn(Optional.of(room));

            Room result = roomService.getRoomByCode("ABC123");

            assertThat(result).isEqualTo(room);
        }

        @Test
        @DisplayName("lancia RoomNotFoundException se non esiste")
        void getRoomByCodeNotFoundThrows() {
            when(roomRepository.findByCode(code)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> roomService.getRoomByCode("ABC123"))
                    .isInstanceOf(RoomNotFoundException.class);
        }

        @Test
        @DisplayName("lancia NullPointerException se roomCode è null")
        void getRoomByCodeWithNullThrows() {
            assertThatThrownBy(() -> roomService.getRoomByCode(null))
                    .isInstanceOf(NullPointerException.class);
        }
    }

    // =========================================================================
    @Nested
    @DisplayName("updateSettings")
    class UpdateSettings {

        @Test
        @DisplayName("aggiorna le impostazioni e notifica comm-service")
        void updateSettingsSuccessfully() {
            when(roomRepository.findByCode(code)).thenReturn(Optional.of(room));
            when(roomRepository.save(room)).thenReturn(room);

            Room result = roomService.updateSettings("ABC123", host.getId(), 2, 90);

            assertThat(result.getImpostors()).isEqualTo(2);
            assertThat(result.getDiscussionTime()).isEqualTo(90);
            verify(commNotifier).notifySettingsUpdated("ABC123", 2, 90);
        }

        @Test
        @DisplayName("lancia eccezione se non è l'host a modificare le impostazioni")
        void updateSettingsByNonHostThrows() {
            fillRoom(room, 4);
            String nonHostId = room.getPlayers().get(1).getId();
            when(roomRepository.findByCode(code)).thenReturn(Optional.of(room));

            assertThatThrownBy(() -> roomService.updateSettings("ABC123", nonHostId, 1, 60))
                    .isInstanceOf(IllegalStateException.class);

            verifyNoInteractions(commNotifier);
        }
    }

    // =========================================================================
    @Nested
    @DisplayName("prepareForNextRound")
    class PrepareForNextRound {

        @Test
        @DisplayName("resetta la stanza per il prossimo round")
        void prepareForNextRoundSuccessfully() {
            fillRoom(room, 4);
            room.startGame(host.getId());
            room.endGame();

            when(roomRepository.findByCode(code)).thenReturn(Optional.of(room));
            when(roomRepository.save(room)).thenReturn(room);

            Room result = roomService.prepareForNextRound("ABC123", host.getId());

            assertThat(result.getStatus()).isEqualTo(RoomStatus.WAITING);
        }

        @Test
        @DisplayName("lancia eccezione se non è l'host a richiedere il rematch")
        void prepareForNextRoundByNonHostThrows() {
            fillRoom(room, 4);
            room.startGame(host.getId());
            room.endGame();

            String nonHostId = room.getPlayers().get(1).getId();
            when(roomRepository.findByCode(code)).thenReturn(Optional.of(room));

            assertThatThrownBy(() -> roomService.prepareForNextRound("ABC123", nonHostId))
                    .isInstanceOf(IllegalStateException.class);
        }
    }
}



