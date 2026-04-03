package it.unibo.lobbyservice.infrastructure.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import it.unibo.lobbyservice.domain.model.AuthenticatedPlayer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Servizio per la gestione dei JWT.
 * Genera e valida token Bearer per l'autenticazione stateless.
 */
@Service
public class JwtService {

    @Value("${app.jwt.secret}")
    private String secret;

    @Value("${app.jwt.expiration}")
    private long expiration;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Genera un JWT per un utente autenticato.
     * Il subject è l'ID utente; username ed email sono claims aggiuntivi.
     */
    public String generateToken(AuthenticatedPlayer player) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expiration);

        return Jwts.builder()
                .subject(player.getId())
                .claim("username", player.getUsername())
                .claim("email", player.getEmail())
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey())
                .compact();
    }

    /**
     * Verifica che il token sia valido (firma corretta, non scaduto).
     */
    public boolean isTokenValid(String token) {
        try {
            Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    /**
     * Estrae l'ID utente (subject) dal token.
     */
    public String extractUserId(String token) {
        return getClaims(token).getSubject();
    }

    /**
     * Estrae lo username dal token.
     */
    public String extractUsername(String token) {
        return getClaims(token).get("username", String.class);
    }

    /**
     * Estrae l'email dal token.
     */
    public String extractEmail(String token) {
        return getClaims(token).get("email", String.class);
    }

    private Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}

