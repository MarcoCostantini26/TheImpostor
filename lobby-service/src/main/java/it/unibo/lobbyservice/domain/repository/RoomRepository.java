package it.unibo.lobbyservice.domain.repository;

import it.unibo.lobbyservice.domain.model.Room;
import it.unibo.lobbyservice.domain.model.RoomCode;
import it.unibo.lobbyservice.domain.model.RoomStatus;

import java.util.List;
import java.util.Optional;

/**
 * Repository per Room Aggregate.
 * Implementazione in-memory (ephemeral storage).
 * Le stanze sono volatili e non persistono su database.
 * Classe per interrogare la classe inMemoryRoomRepository -- non persistono su
 * database
 */
public interface RoomRepository {

    /**
     * Salva una stanza (create o update).
     */
    Room save(Room room);

    /**
     * Trova una stanza per codice univoco.
     */
    Optional<Room> findByCode(RoomCode code);

    /**
     * Trova tutte le stanze attive (WAITING o STARTED).
     */
    List<Room> findAllActive();

    /**
     * Trova tutte le stanze con uno status specifico.
     */
    List<Room> findByStatus(RoomStatus status);

    /**
     * Elimina una stanza per codice.
     */
    void deleteByCode(RoomCode code);

    /**
     * Verifica se un codice stanza esiste già.
     */
    boolean existsByCode(RoomCode code);

    /**
     * Elimina tutte le stanze (utile per testing).
     */
    void deleteAll();

    /**
     * Conta il numero totale di stanze.
     */
    long count();
}
