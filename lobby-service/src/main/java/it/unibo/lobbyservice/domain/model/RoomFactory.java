package it.unibo.lobbyservice.domain.model;

import it.unibo.lobbyservice.domain.repository.RoomRepository;
import org.springframework.stereotype.Component;

import java.util.Objects;

/**
 * Domain Service (Factory) per creare Room Aggregates.
 * Gestisce la generazione di RoomCode univoci.
 */
@Component
public class RoomFactory {
    
    private static final int MAX_RETRIES = 10;
    private final RoomRepository roomRepository;

    public RoomFactory(RoomRepository roomRepository) {
        this.roomRepository = Objects.requireNonNull(roomRepository, "RoomRepository cannot be null");
    }

    /**
     * Crea una nuova stanza con codice univoco e l'host specificato.
     * Ritenta la generazione del codice in caso di collisione.
     */
    public Room createRoom(User host) {
        Objects.requireNonNull(host, "Host cannot be null");
        
        RoomCode code = generateUniqueCode();
        return Room.create(code, host);
    }

    private RoomCode generateUniqueCode() {
        for (int attempt = 0; attempt < MAX_RETRIES; attempt++) {
            RoomCode candidate = RoomCode.generate();
            if (!roomRepository.existsByCode(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Failed to generate unique room code after " + MAX_RETRIES + " attempts");
    }
}

