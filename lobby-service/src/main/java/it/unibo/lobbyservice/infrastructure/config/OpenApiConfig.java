package it.unibo.lobbyservice.infrastructure.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Configurazione Swagger/OpenAPI per documentazione automatica delle API.
 *
 * Swagger UI disponibile su: http://localhost:8080/swagger-ui/index.html
 * OpenAPI JSON: http://localhost:8080/v3/api-docs
 */
@Configuration
public class OpenApiConfig {

    private static final String BEARER_AUTH = "bearerAuth";

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Lobby Service API - The Impostor Game")
                        .version("1.0.0")
                        .description("""
                                API REST per la gestione del Lobby Context del gioco The Impostor.

                                ## Funzionalità
                                - **Room Management**: Creazione, join, leave, start partite
                                - **User Management**: Registrazione, login, profili utenti
                                - **Game History**: Storico partite e statistiche giocatori

                                ## Autenticazione
                                Usa **JWT Bearer token**. Fai login su `POST /api/users/login`,
                                copia il `token` dalla risposta e inseriscilo nel pulsante
                                **Authorize** qui sopra (formato: `<token>`, senza "Bearer ").
                                """)
                        .contact(new Contact()
                                .name("Università di Bologna")
                                .email("daniel.meco@studio.unibo.it")))
                .servers(List.of(
                        new Server()
                                .url("http://localhost:8080")
                                .description("Development Server"),
                        new Server()
                                .url("http://lobby-service:8080")
                                .description("Docker Container")))
                // Applica bearerAuth come schema globale
                .addSecurityItem(new SecurityRequirement().addList(BEARER_AUTH))
                .components(new Components()
                        .addSecuritySchemes(BEARER_AUTH, new SecurityScheme()
                                .name(BEARER_AUTH)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Inserisci il token JWT ottenuto dal login")));
    }
}

