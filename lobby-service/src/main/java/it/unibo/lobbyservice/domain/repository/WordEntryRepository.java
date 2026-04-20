package it.unibo.lobbyservice.domain.repository;

import it.unibo.lobbyservice.domain.model.WordEntry;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

/**
 * Repository MongoDB per le WordEntry.
 */
public interface WordEntryRepository extends MongoRepository<WordEntry, String> {

    Optional<WordEntry> findByWordIgnoreCase(String word);


    /** Ritorna tutte le entry il cui ID non è nella lista di esclusi. */
    List<WordEntry> findByIdNotIn(List<String> excludedIds);
}

