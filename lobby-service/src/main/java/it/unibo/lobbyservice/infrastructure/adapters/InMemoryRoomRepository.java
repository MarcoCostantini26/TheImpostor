package it.unibo.lobbyservice.infrastructure.adapters;

import it.unibo.lobbyservice.domain.model.Room;
import it.unibo.lobbyservice.domain.model.RoomCode;
import it.unibo.lobbyservice.domain.model.RoomStatus;
import it.unibo.lobbyservice.domain.repository.RoomRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Implementazione in-memory di RoomRepository.
 * Storage effimero per stanze attive (no persistenza su database).
 * Thread-safe usando ConcurrentHashMap.
 */
@Component
public class InMemoryRoomRepository implements RoomRepository {
    
    private final Map<RoomCode, Room> rooms = new ConcurrentHashMap<>();

    @Override
    public Room save(Room room) {
        rooms.put(room.getCode(), room);
        return room;
    }

    @Override
    public Optional<Room> findByCode(RoomCode code) {
        return Optional.ofNullable(rooms.get(code));
    }

    @Override
    public List<Room> findAllActive() {
        return rooms.values().stream()
                .filter(room -> room.getStatus() == RoomStatus.WAITING || 
                               room.getStatus() == RoomStatus.STARTED)
                .toList();
    }

    @Override
    public List<Room> findByStatus(RoomStatus status) {
        return rooms.values().stream()
                .filter(room -> room.getStatus() == status)
                .toList();
    }

    @Override
    public void deleteByCode(RoomCode code) {
        rooms.remove(code);
    }

    @Override
    public boolean existsByCode(RoomCode code) {
        return rooms.containsKey(code);
    }

    @Override
    public void deleteAll() {
        rooms.clear();
    }

    @Override
    public long count() {
        return rooms.size();
    }
}

