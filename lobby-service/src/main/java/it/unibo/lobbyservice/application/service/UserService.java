package it.unibo.lobbyservice.application.service;

import it.unibo.lobbyservice.domain.model.AuthenticatedPlayer;
import it.unibo.lobbyservice.domain.repository.UserRepository;
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

    public UserService(UserRepository userRepository) {
        this.userRepository = Objects.requireNonNull(userRepository, "UserRepository cannot be null");
    }

    /**
     * Registra un nuovo utente.
     */
    public AuthenticatedPlayer registerUser(String username, String email, String passwordHash) {
        Objects.requireNonNull(username, "Username cannot be null");
        Objects.requireNonNull(email, "Email cannot be null");
        Objects.requireNonNull(passwordHash, "Password hash cannot be null");
        
        // Verifica email duplicata
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new UserAlreadyExistsException("Email " + email + " is already registered");
        }
        
        // Verifica username duplicato
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new UserAlreadyExistsException("Username " + username + " is already taken");
        }
        
        AuthenticatedPlayer player = AuthenticatedPlayer.create(username, email, passwordHash);
        return userRepository.save(player);
    }

    /**
     * Registra un nuovo utente con profilo completo.
     */
    public AuthenticatedPlayer registerUserWithProfile(String username, String email, String passwordHash,
                                                      Integer age, String country, String avatarUrl, String bio) {
        Objects.requireNonNull(username, "Username cannot be null");
        Objects.requireNonNull(email, "Email cannot be null");
        Objects.requireNonNull(passwordHash, "Password hash cannot be null");
        
        // Verifica email duplicata
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new UserAlreadyExistsException("Email " + email + " is already registered");
        }
        
        // Verifica username duplicato
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new UserAlreadyExistsException("Username " + username + " is already taken");
        }
        
        AuthenticatedPlayer player = AuthenticatedPlayer.createWithProfile(
                username, email, passwordHash, age, country, avatarUrl, bio
        );
        return userRepository.save(player);
    }

    /**
     * Trova un utente per email (usato per login).
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

