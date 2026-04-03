package it.unibo.lobbyservice.infrastructure.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

/**
 * Configurazione Spring Security con JWT stateless.
 *
 * Rotte pubbliche (no token):
 *   - POST /api/users/register, /api/users/register-full, /api/users/login
 *   - GET  /api/users/check-email/**, /api/users/check-username/**
 *   - /api/internal/** (chiamate interne da altri microservizi)
 *   - Swagger UI, OpenAPI docs, Actuator
 *
 * Tutto il resto richiede un valido JWT Bearer token.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final CorsConfigurationSource corsConfigurationSource;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                          CorsConfigurationSource corsConfigurationSource) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.corsConfigurationSource = corsConfigurationSource;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // CORS: usa il CorsConfigurationSource definito in CorsConfig
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            // Disabilita CSRF (stateless JWT, non serve)
            .csrf(AbstractHttpConfigurer::disable)
            // Nessuna sessione HTTP
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // Regole di autorizzazione
            .authorizeHttpRequests(auth -> auth
                // Autenticazione pubblica
                .requestMatchers(
                    "/api/users/register",
                    "/api/users/register-full",
                    "/api/users/login"
                ).permitAll()
                // Check disponibilità (usati nel flow di registrazione)
                .requestMatchers("/api/users/check-email/**", "/api/users/check-username/**").permitAll()
                // API interne tra microservizi (non esposti al pubblico)
                .requestMatchers("/api/internal/**").permitAll()
                // Documentazione Swagger
                .requestMatchers(
                    "/swagger-ui/**",
                    "/swagger-ui.html",
                    "/v3/api-docs/**"
                ).permitAll()
                // Actuator health check
                .requestMatchers("/actuator/**").permitAll()
                // Tutto il resto richiede autenticazione JWT
                .anyRequest().authenticated()
            )
            // Aggiungi il filtro JWT prima di UsernamePasswordAuthenticationFilter
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}

