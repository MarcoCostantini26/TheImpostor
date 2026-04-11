package it.unibo.lobbyservice.domain.model;

import lombok.EqualsAndHashCode;
import lombok.Getter;

import java.util.concurrent.ThreadLocalRandom;

/**
 * Value Object: codice univoco di una stanza.
 * Immutabile.
 */
@Getter
@EqualsAndHashCode
public final class RoomCode {
    private static final int CODE_LENGTH = 6;
    private static final String ALLOWED_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    private final String value;

    private RoomCode(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Room code cannot be null or empty");
        }
        String normalized = value.toUpperCase().trim();
        if (normalized.length() != CODE_LENGTH) {
            throw new IllegalArgumentException("Room code must be exactly " + CODE_LENGTH + " characters");
        }
        if (!normalized.matches("[A-Z0-9]+")) {
            throw new IllegalArgumentException("Room code must contain only uppercase letters and numbers");
        }
        this.value = normalized;
    }

    public static RoomCode of(String value) {
        return new RoomCode(value);
    }

    public static RoomCode generate() {
        StringBuilder code = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            code.append(ALLOWED_CHARS.charAt(ThreadLocalRandom.current().nextInt(ALLOWED_CHARS.length())));
        }
        return new RoomCode(code.toString());
    }

    @Override
    public String toString() {
        return value;
    }
}

