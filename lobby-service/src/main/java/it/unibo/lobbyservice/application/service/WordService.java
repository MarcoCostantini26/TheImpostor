package it.unibo.lobbyservice.application.service;

import it.unibo.lobbyservice.domain.model.GameHistory;
import it.unibo.lobbyservice.domain.model.RoundResult;
import it.unibo.lobbyservice.domain.model.WordEntry;
import it.unibo.lobbyservice.domain.repository.GameHistoryRepository;
import it.unibo.lobbyservice.domain.repository.WordEntryRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;
import java.util.Random;

/**
 * Application Service per la gestione delle parole nei round.
 *
 * Garantisce che all'interno della stessa partita (roomCode)
 * non venga mai pescata due volte la stessa parola.
 */
@Service
public class WordService {

    private final WordEntryRepository wordEntryRepository;
    private final GameHistoryRepository gameHistoryRepository;

    public WordService(WordEntryRepository wordEntryRepository,
                       GameHistoryRepository gameHistoryRepository) {
        this.wordEntryRepository = Objects.requireNonNull(wordEntryRepository);
        this.gameHistoryRepository = Objects.requireNonNull(gameHistoryRepository);
    }

    /**
     * Pesca una WordEntry casuale non ancora usata in questa partita.
     *
     * Legge i round già giocati in GameHistory per ricavare le parole usate,
     * poi sceglie tra le entry rimanenti.
     *
     * @param roomCode codice della stanza
     * @return una WordEntry mai usata in questa partita
     * @throws IllegalStateException se tutte le parole disponibili sono esaurite
     */
    public WordEntry pickWordForRoom(String roomCode) {
        Objects.requireNonNull(roomCode, "Room code cannot be null");

        List<String> usedIds = gameHistoryRepository.findByRoomCode(roomCode)
                .map(GameHistory::getAllRounds)
                .orElse(List.of())
                .stream()
                .map(RoundResult::getSecretWord)
                .filter(Objects::nonNull)
                .distinct()
                .map(word -> wordEntryRepository.findByWordIgnoreCase(word)
                        .map(WordEntry::getId)
                        .orElse(null))
                .filter(Objects::nonNull)
                .toList();

        List<WordEntry> available = wordEntryRepository.findByIdNotIn(usedIds);

        if (available.isEmpty()) {
            throw new IllegalStateException(
                    "All " + wordEntryRepository.count() + " words have already been used in room " + roomCode);
        }

        return available.get(new Random().nextInt(available.size()));
    }
}

