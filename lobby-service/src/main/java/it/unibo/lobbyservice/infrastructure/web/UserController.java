package it.unibo.lobbyservice.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import it.unibo.lobbyservice.application.service.UserService;
import it.unibo.lobbyservice.domain.model.AuthenticatedPlayer;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Objects;

/**
 * REST Controller per la gestione degli utenti autenticati.
 * Gestisce registrazione, login e profili.
 */
@RestController
@RequestMapping("/api/users")
@Tag(name = "User Management", description = "API per registrazione, login e gestione profili utenti")
public class UserController {
    
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = Objects.requireNonNull(userService, "UserService cannot be null");
    }

    /**
     * POST /api/users/register
     * Registrazione base (username, email, password).
     */
    @PostMapping("/register")
    public ResponseEntity<UserResponse> register(@RequestBody RegisterRequest request) {
        AuthenticatedPlayer player = userService.registerUser(
                request.username(),
                request.email(),
                request.password()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(player));
    }

    /**
     * POST /api/users/register-full
     * Registrazione con profilo completo.
     */
    @PostMapping("/register-full")
    public ResponseEntity<UserResponse> registerWithProfile(@RequestBody RegisterFullRequest request) {
        AuthenticatedPlayer player = userService.registerUserWithProfile(
                request.username(),
                request.email(),
                request.password(),
                request.age(),
                request.country(),
                request.avatarUrl(),
                request.bio()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(player));
    }

    /**
     * POST /api/users/login
     * Login utente.
     */
    @PostMapping("/login")
    public ResponseEntity<UserResponse> login(@RequestBody LoginRequest request) {
        AuthenticatedPlayer player = userService.login(request.email(), request.password());
        return ResponseEntity.ok(UserResponse.from(player));
    }

    /**
     * GET /api/users/{id}
     * Ottiene un utente per ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable String id) {
        AuthenticatedPlayer player = userService.getUserById(id);
        return ResponseEntity.ok(UserResponse.from(player));
    }

    /**
     * GET /api/users/username/{username}
     * Cerca utente per username.
     */
    @GetMapping("/username/{username}")
    public ResponseEntity<UserResponse> getUserByUsername(@PathVariable String username) {
        AuthenticatedPlayer player = userService.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(UserResponse.from(player));
    }

    /**
     * GET /api/users/check-email/{email}
     * Verifica se un'email è già registrata.
     */
    @GetMapping("/check-email/{email}")
    public ResponseEntity<CheckAvailabilityResponse> checkEmail(@PathVariable String email) {
        boolean exists = userService.emailExists(email);
        return ResponseEntity.ok(new CheckAvailabilityResponse(!exists, exists ? "Email already registered" : "Email available"));
    }

    /**
     * GET /api/users/check-username/{username}
     * Verifica se un username è già preso.
     */
    @GetMapping("/check-username/{username}")
    public ResponseEntity<CheckAvailabilityResponse> checkUsername(@PathVariable String username) {
        boolean exists = userService.usernameExists(username);
        return ResponseEntity.ok(new CheckAvailabilityResponse(!exists, exists ? "Username already taken" : "Username available"));
    }

    /**
     * DELETE /api/users/{id}
     * Elimina un utente.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable String id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }


    // DTO Records
    public record RegisterRequest(String username, String email, String password) {}
    
    public record RegisterFullRequest(
            String username,
            String email,
            String password,
            Integer age,
            String country,
            String avatarUrl,
            String bio
    ) {}
    
    public record LoginRequest(String email, String password) {}
    
    public record CheckAvailabilityResponse(boolean available, String message) {}

    public record UserResponse(
            String id,
            String username,
            String email,
            String createdAt,
            Integer age,
            String country,
            String avatarUrl,
            String bio
    ) {
        public static UserResponse from(AuthenticatedPlayer player) {
            return new UserResponse(
                    player.getId(),
                    player.getUsername(),
                    player.getEmail(),
                    player.getCreatedAt().toString(),
                    player.getAge(),
                    player.getCountry(),
                    player.getAvatarUrl(),
                    player.getBio()
            );
        }
    }
}

