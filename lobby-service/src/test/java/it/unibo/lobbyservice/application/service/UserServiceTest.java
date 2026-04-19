package it.unibo.lobbyservice.application.service;

import it.unibo.lobbyservice.domain.model.AuthenticatedPlayer;
import it.unibo.lobbyservice.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit test di UserService (Application Layer).
 * Verifica registrazione, login, ricerca ed eliminazione utenti
 * senza dipendenze esterne (mock di UserRepository e PasswordEncoder).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("UserService - Application Service")
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserService userService;

    private AuthenticatedPlayer player;

    @BeforeEach
    void setUp() {
        player = AuthenticatedPlayer.create("mario", "mario@test.com", "$2a$hash");
    }

    // =========================================================================
    @Nested
    @DisplayName("registerUser")
    class RegisterUser {

        @Test
        @DisplayName("registra un nuovo utente cifrando la password")
        void registerUserSuccessfully() {
            when(userRepository.existsByEmailIgnoreCase("mario@test.com")).thenReturn(false);
            when(userRepository.existsByUsernameIgnoreCase("mario")).thenReturn(false);
            when(passwordEncoder.encode("rawpassword")).thenReturn("$2a$hash");
            when(userRepository.save(any(AuthenticatedPlayer.class))).thenReturn(player);

            AuthenticatedPlayer result = userService.registerUser("mario", "mario@test.com", "rawpassword");

            assertThat(result).isNotNull();
            assertThat(result.getUsername()).isEqualTo("mario");
            verify(passwordEncoder).encode("rawpassword");
            verify(userRepository).save(any(AuthenticatedPlayer.class));
        }

        @Test
        @DisplayName("lancia UserAlreadyExistsException se email già registrata")
        void registerUserDuplicateEmailThrows() {
            when(userRepository.existsByEmailIgnoreCase("mario@test.com")).thenReturn(true);

            assertThatThrownBy(() -> userService.registerUser("mario", "mario@test.com", "pass"))
                    .isInstanceOf(UserAlreadyExistsException.class)
                    .hasMessageContaining("already registered");

            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("lancia UserAlreadyExistsException se username già preso")
        void registerUserDuplicateUsernameThrows() {
            when(userRepository.existsByEmailIgnoreCase("mario@test.com")).thenReturn(false);
            when(userRepository.existsByUsernameIgnoreCase("mario")).thenReturn(true);

            assertThatThrownBy(() -> userService.registerUser("mario", "mario@test.com", "pass"))
                    .isInstanceOf(UserAlreadyExistsException.class)
                    .hasMessageContaining("already taken");

            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("lancia NullPointerException se username è null")
        void registerUserNullUsernameThrows() {
            assertThatThrownBy(() -> userService.registerUser(null, "mario@test.com", "pass"))
                    .isInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("lancia NullPointerException se email è null")
        void registerUserNullEmailThrows() {
            assertThatThrownBy(() -> userService.registerUser("mario", null, "pass"))
                    .isInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("lancia NullPointerException se password è null")
        void registerUserNullPasswordThrows() {
            assertThatThrownBy(() -> userService.registerUser("mario", "mario@test.com", null))
                    .isInstanceOf(NullPointerException.class);
        }
    }

    // =========================================================================
    @Nested
    @DisplayName("login")
    class Login {

        @Test
        @DisplayName("login riuscito con credenziali corrette")
        void loginSuccessfully() {
            when(userRepository.findByEmailIgnoreCase("mario@test.com")).thenReturn(Optional.of(player));
            when(passwordEncoder.matches("rawpassword", "$2a$hash")).thenReturn(true);

            AuthenticatedPlayer result = userService.login("mario@test.com", "rawpassword");

            assertThat(result).isEqualTo(player);
        }

        @Test
        @DisplayName("lancia InvalidCredentialsException se email non trovata")
        void loginEmailNotFoundThrows() {
            when(userRepository.findByEmailIgnoreCase("unknown@test.com")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> userService.login("unknown@test.com", "pass"))
                    .isInstanceOf(InvalidCredentialsException.class)
                    .hasMessageContaining("Invalid email or password");
        }

        @Test
        @DisplayName("lancia InvalidCredentialsException se password errata")
        void loginWrongPasswordThrows() {
            when(userRepository.findByEmailIgnoreCase("mario@test.com")).thenReturn(Optional.of(player));
            when(passwordEncoder.matches("wrongpass", "$2a$hash")).thenReturn(false);

            assertThatThrownBy(() -> userService.login("mario@test.com", "wrongpass"))
                    .isInstanceOf(InvalidCredentialsException.class)
                    .hasMessageContaining("Invalid email or password");
        }

        @Test
        @DisplayName("il messaggio di errore non rivela quale campo è sbagliato (sicurezza)")
        void loginErrorMessageIsGeneric() {
            when(userRepository.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());

            // Stesso messaggio sia per email sbagliata...
            assertThatThrownBy(() -> userService.login("bad@test.com", "pass"))
                    .hasMessage("Invalid email or password");
        }

        @Test
        @DisplayName("lancia NullPointerException se email è null")
        void loginNullEmailThrows() {
            assertThatThrownBy(() -> userService.login(null, "pass"))
                    .isInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("lancia NullPointerException se password è null")
        void loginNullPasswordThrows() {
            assertThatThrownBy(() -> userService.login("mario@test.com", null))
                    .isInstanceOf(NullPointerException.class);
        }
    }

    // =========================================================================
    @Nested
    @DisplayName("findByEmail / findById / findByUsername")
    class FindUser {

        @Test
        @DisplayName("findByEmail ritorna Optional con utente se esiste")
        void findByEmailFound() {
            when(userRepository.findByEmailIgnoreCase("mario@test.com")).thenReturn(Optional.of(player));

            assertThat(userService.findByEmail("mario@test.com")).contains(player);
        }

        @Test
        @DisplayName("findByEmail ritorna Optional vuoto se non esiste")
        void findByEmailNotFound() {
            when(userRepository.findByEmailIgnoreCase("none@test.com")).thenReturn(Optional.empty());

            assertThat(userService.findByEmail("none@test.com")).isEmpty();
        }

        @Test
        @DisplayName("findById ritorna Optional con utente se esiste")
        void findByIdFound() {
            when(userRepository.findById(player.getId())).thenReturn(Optional.of(player));

            assertThat(userService.findById(player.getId())).contains(player);
        }

        @Test
        @DisplayName("findByUsername ritorna Optional con utente se esiste")
        void findByUsernameFound() {
            when(userRepository.findByUsernameIgnoreCase("mario")).thenReturn(Optional.of(player));

            assertThat(userService.findByUsername("mario")).contains(player);
        }

        @Test
        @DisplayName("lancia NullPointerException se i parametri sono null")
        void findWithNullThrows() {
            assertThatThrownBy(() -> userService.findByEmail(null))
                    .isInstanceOf(NullPointerException.class);
            assertThatThrownBy(() -> userService.findById(null))
                    .isInstanceOf(NullPointerException.class);
            assertThatThrownBy(() -> userService.findByUsername(null))
                    .isInstanceOf(NullPointerException.class);
        }
    }

    // =========================================================================
    @Nested
    @DisplayName("getUserById")
    class GetUserById {

        @Test
        @DisplayName("ritorna l'utente se esiste")
        void getUserByIdSuccessfully() {
            when(userRepository.findById(player.getId())).thenReturn(Optional.of(player));

            AuthenticatedPlayer result = userService.getUserById(player.getId());

            assertThat(result).isEqualTo(player);
        }

        @Test
        @DisplayName("lancia UserNotFoundException se non esiste")
        void getUserByIdNotFoundThrows() {
            when(userRepository.findById("nonExistentId")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> userService.getUserById("nonExistentId"))
                    .isInstanceOf(UserNotFoundException.class)
                    .hasMessageContaining("nonExistentId");
        }
    }

    // =========================================================================
    @Nested
    @DisplayName("deleteUser")
    class DeleteUser {

        @Test
        @DisplayName("elimina un utente esistente")
        void deleteUserSuccessfully() {
            when(userRepository.existsById(player.getId())).thenReturn(true);

            assertThatCode(() -> userService.deleteUser(player.getId()))
                    .doesNotThrowAnyException();

            verify(userRepository).deleteById(player.getId());
        }

        @Test
        @DisplayName("lancia UserNotFoundException se l'utente non esiste")
        void deleteUserNotFoundThrows() {
            when(userRepository.existsById("ghost")).thenReturn(false);

            assertThatThrownBy(() -> userService.deleteUser("ghost"))
                    .isInstanceOf(UserNotFoundException.class);

            verify(userRepository, never()).deleteById(any());
        }

        @Test
        @DisplayName("lancia NullPointerException se id è null")
        void deleteUserNullIdThrows() {
            assertThatThrownBy(() -> userService.deleteUser(null))
                    .isInstanceOf(NullPointerException.class);
        }
    }

    // =========================================================================
    @Nested
    @DisplayName("emailExists / usernameExists")
    class ExistenceChecks {

        @Test
        @DisplayName("emailExists ritorna true se email già registrata")
        void emailExistsTrue() {
            when(userRepository.existsByEmailIgnoreCase("mario@test.com")).thenReturn(true);
            assertThat(userService.emailExists("mario@test.com")).isTrue();
        }

        @Test
        @DisplayName("emailExists ritorna false se email non presente")
        void emailExistsFalse() {
            when(userRepository.existsByEmailIgnoreCase("new@test.com")).thenReturn(false);
            assertThat(userService.emailExists("new@test.com")).isFalse();
        }

        @Test
        @DisplayName("usernameExists ritorna true se username già preso")
        void usernameExistsTrue() {
            when(userRepository.existsByUsernameIgnoreCase("mario")).thenReturn(true);
            assertThat(userService.usernameExists("mario")).isTrue();
        }

        @Test
        @DisplayName("lancia NullPointerException se i parametri sono null")
        void existenceChecksWithNullThrows() {
            assertThatThrownBy(() -> userService.emailExists(null))
                    .isInstanceOf(NullPointerException.class);
            assertThatThrownBy(() -> userService.usernameExists(null))
                    .isInstanceOf(NullPointerException.class);
        }
    }
}

