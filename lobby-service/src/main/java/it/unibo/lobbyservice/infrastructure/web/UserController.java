package it.unibo.lobbyservice.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import it.unibo.lobbyservice.application.service.UserNotFoundException;
import it.unibo.lobbyservice.application.service.UserService;
import it.unibo.lobbyservice.domain.model.AuthenticatedPlayer;
import it.unibo.lobbyservice.infrastructure.config.JwtService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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
    private final JwtService jwtService;

    public UserController(UserService userService, JwtService jwtService) {
        this.userService = Objects.requireNonNull(userService, "UserService cannot be null");
        this.jwtService = Objects.requireNonNull(jwtService, "JwtService cannot be null");
    }

    /**
     * POST /api/users/register
     * Registrazione base (username, email, password).
     */
    @PostMapping("/register")
    public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
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
    public ResponseEntity<UserResponse> registerWithProfile(@Valid @RequestBody RegisterFullRequest request) {
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
     * Login utente. Ritorna JWT Bearer token + dati profilo.
     */
    @PostMapping("/login")
    @Operation(summary = "Login utente", description = "Autentica l'utente e restituisce un JWT Bearer token")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthenticatedPlayer player = userService.login(request.email(), request.password());
        String token = jwtService.generateToken(player);
        return ResponseEntity.ok(new LoginResponse(token, "Bearer", UserResponse.from(player)));
    }

    /**
     * GET /api/users/{id}
     * Ottiene un utente per ID (richiede JWT).
     */
    @GetMapping("/{id}")
    @Operation(summary = "Ottieni utente per ID", security = @SecurityRequirement(name = "bearerAuth"))
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
                .orElseThrow(() -> new UserNotFoundException("User with username '" + username + "' not found"));
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
    public record RegisterRequest(
            @NotBlank @Size(min = 3, max = 24) String username,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 24) String password
    ) {}

    public record RegisterFullRequest(
            @NotBlank @Size(min = 3, max = 24) String username,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 24) String password,
            Integer age,
            String country,
            String avatarUrl,
            String bio
    ) {}
    
    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password
    ) {}

    public record LoginResponse(String token, String tokenType, UserResponse user) {}

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

