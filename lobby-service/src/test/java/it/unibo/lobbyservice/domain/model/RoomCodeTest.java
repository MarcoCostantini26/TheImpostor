package it.unibo.lobbyservice.domain.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit test del Value Object RoomCode.
 * Verifica validazione, normalizzazione, generazione e uguaglianza strutturale.
 */
@DisplayName("RoomCode - Value Object")
class RoomCodeTest {

    // =========================================================================
    @Nested
    @DisplayName("RoomCode.of() - costruzione da stringa")
    class Of {

        @Test
        @DisplayName("accetta un codice valido di 6 caratteri alfanumerici maiuscoli")
        void validCodeIsAccepted() {
            RoomCode code = RoomCode.of("ABC123");

            assertThat(code.getValue()).isEqualTo("ABC123");
        }

        @Test
        @DisplayName("normalizza automaticamente il codice in maiuscolo")
        void lowercaseInputIsNormalized() {
            RoomCode code = RoomCode.of("abc123");

            assertThat(code.getValue()).isEqualTo("ABC123");
        }

        @Test
        @DisplayName("rimuove spazi iniziali e finali (trim)")
        void whitespaceIsTrimmed() {
            RoomCode code = RoomCode.of("  XY99ZZ  ");

            assertThat(code.getValue()).isEqualTo("XY99ZZ");
        }

        @Test
        @DisplayName("lancia IllegalArgumentException se il codice è null")
        void nullCodeThrows() {
            assertThatThrownBy(() -> RoomCode.of(null))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("null or empty");
        }

        @Test
        @DisplayName("lancia IllegalArgumentException se il codice è vuoto")
        void emptyCodeThrows() {
            assertThatThrownBy(() -> RoomCode.of(""))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("null or empty");
        }

        @Test
        @DisplayName("lancia IllegalArgumentException se il codice è solo spazi")
        void blankCodeThrows() {
            assertThatThrownBy(() -> RoomCode.of("   "))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("null or empty");
        }

        @Test
        @DisplayName("lancia IllegalArgumentException se il codice è troppo corto (< 6)")
        void tooShortCodeThrows() {
            assertThatThrownBy(() -> RoomCode.of("AB12"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("6 characters");
        }

        @Test
        @DisplayName("lancia IllegalArgumentException se il codice è troppo lungo (> 6)")
        void tooLongCodeThrows() {
            assertThatThrownBy(() -> RoomCode.of("ABC1234"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("6 characters");
        }

        @Test
        @DisplayName("lancia IllegalArgumentException se contiene caratteri speciali")
        void specialCharsThrows() {
            assertThatThrownBy(() -> RoomCode.of("AB!@#$"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("uppercase letters and numbers");
        }

        @Test
        @DisplayName("lancia IllegalArgumentException se contiene spazi interni")
        void internalSpaceThrows() {
            assertThatThrownBy(() -> RoomCode.of("AB 123"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // =========================================================================
    @Nested
    @DisplayName("RoomCode.generate() - generazione casuale")
    class Generate {

        @Test
        @DisplayName("genera un codice di esattamente 6 caratteri")
        void generatedCodeHasSixChars() {
            RoomCode code = RoomCode.generate();

            assertThat(code.getValue()).hasSize(6);
        }

        @Test
        @DisplayName("genera un codice con soli caratteri alfanumerici maiuscoli")
        void generatedCodeContainsOnlyValidChars() {
            RoomCode code = RoomCode.generate();

            assertThat(code.getValue()).matches("[A-Z0-9]{6}");
        }

        @RepeatedTest(20)
        @DisplayName("genera sempre un codice valido (ripetuto 20 volte)")
        void generatedCodeIsAlwaysValid() {
            RoomCode code = RoomCode.generate();

            assertThat(code.getValue())
                    .hasSize(6)
                    .matches("[A-Z0-9]{6}");
        }

        @Test
        @DisplayName("genera codici con buona casualità (nessun duplicato su 100 tentativi)")
        void generatedCodesAreRandom() {
            Set<String> generated = new HashSet<>();
            for (int i = 0; i < 100; i++) {
                generated.add(RoomCode.generate().getValue());
            }

            // Su 100 generazioni da un alfabeto di 36^6 = ~2 miliardi di combinazioni,
            // la probabilità di collisione è trascurabile
            assertThat(generated).hasSizeGreaterThan(95);
        }
    }

    // =========================================================================
    @Nested
    @DisplayName("Uguaglianza strutturale (equals & hashCode)")
    class Equality {

        @Test
        @DisplayName("due RoomCode con lo stesso valore sono uguali")
        void sameValueIsEqual() {
            RoomCode a = RoomCode.of("ABC123");
            RoomCode b = RoomCode.of("ABC123");

            assertThat(a).isEqualTo(b);
            assertThat(a.hashCode()).isEqualTo(b.hashCode());
        }

        @Test
        @DisplayName("due RoomCode con valori diversi non sono uguali")
        void differentValueIsNotEqual() {
            RoomCode a = RoomCode.of("ABC123");
            RoomCode b = RoomCode.of("XYZ999");

            assertThat(a).isNotEqualTo(b);
        }

        @Test
        @DisplayName("uguaglianza è case-insensitive grazie alla normalizzazione")
        void equalityIsCaseInsensitive() {
            RoomCode lower = RoomCode.of("abc123");
            RoomCode upper = RoomCode.of("ABC123");

            assertThat(lower).isEqualTo(upper);
        }

        @Test
        @DisplayName("toString() ritorna il valore del codice")
        void toStringReturnsValue() {
            RoomCode code = RoomCode.of("ABC123");

            assertThat(code.toString()).isEqualTo("ABC123");
        }
    }
}

