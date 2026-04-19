package it.unibo.lobbyservice.domain.model;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Objects;

/**
 * Documento MongoDB che rappresenta una coppia parola/indizio usata durante un round.
 *
 * - I CREWMATE vedono la parola  (es. "Elefante")
 * - L'IMPOSTORE vede solo l'indizio — una singola parola correlata (es. "Savana")
 *
 * Salvato nella collection "word_entries" su MongoDB Atlas.
 */
@Getter
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Document(collection = "word_entries")
public final class WordEntry {

    @Id
    @EqualsAndHashCode.Include
    private final String id;

    /** Parola visibile ai crewmate. */
    @Indexed(unique = true)
    private final String word;

    /** Indizio a una parola sola visibile solo all'impostore. */
    private final String impostorClue;

    public WordEntry(String id, String word, String impostorClue) {
        this.id = id;
        this.word = validateSingleWord(word, "word");
        this.impostorClue = validateSingleWord(impostorClue, "impostorClue");

        if (this.word.equalsIgnoreCase(this.impostorClue)) {
            throw new IllegalArgumentException(
                    "The impostor clue cannot be the same word as the crewmate word");
        }
    }

    /** Factory method per creare una nuova entry (senza ID, lo assegna MongoDB). */
    public static WordEntry create(String word, String impostorClue) {
        return new WordEntry(null, word, impostorClue);
    }

    private static String validateSingleWord(String value, String fieldName) {
        Objects.requireNonNull(value, fieldName + " cannot be null");
        String trimmed = value.trim();
        if (trimmed.isBlank()) {
            throw new IllegalArgumentException(fieldName + " cannot be blank");
        }
        if (trimmed.contains(" ")) {
            throw new IllegalArgumentException(
                    fieldName + " must be a single word, but was: '" + trimmed + "'");
        }
        return trimmed;
    }
}

