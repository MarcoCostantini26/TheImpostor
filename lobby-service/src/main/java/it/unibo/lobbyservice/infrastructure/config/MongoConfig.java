package it.unibo.lobbyservice.infrastructure.config;

import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.config.AbstractMongoClientConfiguration;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

/**
 * Configurazione MongoDB Atlas per Spring Boot 4.x.
 * Funziona come JPA/Hibernate: collections e indici creati automaticamente.
 */
@Configuration
@EnableMongoRepositories(basePackages = "it.unibo.lobbyservice.domain.repository")
@EnableMongoAuditing
public class MongoConfig extends AbstractMongoClientConfiguration {

    @Value("${app.mongodb.uri}")
    private String connectionString;

    @Override
    protected String getDatabaseName() {
        return "theimpostor";
    }

    @Override
    public MongoClient mongoClient() {
        ConnectionString connString = new ConnectionString(connectionString);
        MongoClientSettings settings = MongoClientSettings.builder()
                .applyConnectionString(connString)
                .build();
        return MongoClients.create(settings);
    }

    /**
     * Abilita creazione automatica indici da annotazioni @Indexed.
     * Come JPA/Hibernate con @Index.
     */
    @Override
    protected boolean autoIndexCreation() {
        return true;
    }
}
