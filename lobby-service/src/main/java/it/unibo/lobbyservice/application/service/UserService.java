package it.unibo.lobbyservice.application.service;

import it.unibo.lobbyservice.domain.model.AuthenticatedPlayer;
import it.unibo.lobbyservice.domain.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;
import java.util.Optional;

/**
 * Application Service per la gestione degli utenti autenticati.
 * Coordina registrazione, login e gestione profili.
 */
@Service
@Transactional
public class UserService {
    
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = Objects.requireNonNull(userRepository, "UserRepository cannot be null");
        this.passwordEncoder = Objects.requireNonNull(passwordEncoder, "PasswordEncoder cannot be null");
    }

    /**
     * Registra un nuovo utente.
     * Riceve la password in chiaro e la cifra internamente con BCrypt.
     */
    public AuthenticatedPlayer registerUser(String username, String email, String rawPassword) {
        Objects.requireNonNull(username, "Username cannot be null");
        Objects.requireNonNull(email, "Email cannot be null");
        Objects.requireNonNull(rawPassword, "Password cannot be null");

        // Verifica email duplicata
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new UserAlreadyExistsException("Email " + email + " is already registered");
        }
        
        // Verifica username duplicato
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new UserAlreadyExistsException("Username " + username + " is already taken");
        }

        String passwordHash = passwordEncoder.encode(rawPassword);
        AuthenticatedPlayer player = AuthenticatedPlayer.create(username, email, passwordHash);
        return userRepository.save(player);
    }

    /**
     * Registra un nuovo utente con profilo completo.
     * Riceve la password in chiaro e la cifra internamente con BCrypt.
     */
    public AuthenticatedPlayer registerUserWithProfile(String username, String email, String rawPassword,
                                                      Integer age, String country, String avatarUrl, String bio) {
        Objects.requireNonNull(username, "Username cannot be null");
        Objects.requireNonNull(email, "Email cannot be null");
        Objects.requireNonNull(rawPassword, "Password cannot be null");

        // Verifica email duplicata
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new UserAlreadyExistsException("Email " + email + " is already registered");
        }
        
        // Verifica username duplicato
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new UserAlreadyExistsException("Username " + username + " is already taken");
        }

        String passwordHash = passwordEncoder.encode(rawPassword);
        AuthenticatedPlayer player = AuthenticatedPlayer.createWithProfile(
                username, email, passwordHash, age, country, avatarUrl, bio
        );
        return userRepository.save(player);
    }

    /**
     * Autentica un utente verificando email e password con BCrypt.
     * Lancia InvalidCredentialsException se le credenziali non sono valide.
     */
    public AuthenticatedPlayer login(String email, String rawPassword) {
        Objects.requireNonNull(email, "Email cannot be null");
        Objects.requireNonNull(rawPassword, "Password cannot be null");

        // Uso un messaggio generico per non rivelare quale campo è errato (best practice sicurezza)
        AuthenticatedPlayer player = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(rawPassword, player.getPasswordHash())) {
            throw new InvalidCredentialsException("Invalid email or password");
        }

        return player;
    }

    /**
     * Trova un utente per email.
     */
    public Optional<AuthenticatedPlayer> findByEmail(String email) {
        Objects.requireNonNull(email, "Email cannot be null");
        return userRepository.findByEmailIgnoreCase(email);
    }

    /**
     * Trova un utente per ID.
     */
    public Optional<AuthenticatedPlayer> findById(String id) {
        Objects.requireNonNull(id, "ID cannot be null");
        return userRepository.findById(id);
    }

    /**
     * Trova un utente per username.
     */
    public Optional<AuthenticatedPlayer> findByUsername(String username) {
        Objects.requireNonNull(username, "Username cannot be null");
        return userRepository.findByUsernameIgnoreCase(username);
    }

    /**
     * Verifica se un'email è già registrata.
     */
    public boolean emailExists(String email) {
        Objects.requireNonNull(email, "Email cannot be null");
        return userRepository.existsByEmailIgnoreCase(email);
    }

    /**
     * Verifica se un username è già preso.
     */
    public boolean usernameExists(String username) {
        Objects.requireNonNull(username, "Username cannot be null");
        return userRepository.existsByUsernameIgnoreCase(username);
    }

    /**
     * Ottiene un utente per ID, lancia eccezione se non esiste.
     */
    public AuthenticatedPlayer getUserById(String id) {
        return findById(id)
                .orElseThrow(() -> new UserNotFoundException("User with ID " + id + " not found"));
    }

    /**
     * Elimina un utente.
     */
    public void deleteUser(String id) {
        Objects.requireNonNull(id, "ID cannot be null");
        if (!userRepository.existsById(id)) {
            throw new UserNotFoundException("User with ID " + id + " not found");
        }
        userRepository.deleteById(id);
    }
}

