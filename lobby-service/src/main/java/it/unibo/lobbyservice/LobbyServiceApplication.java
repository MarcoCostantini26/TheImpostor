package it.unibo.lobbyservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class LobbyServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(LobbyServiceApplication.class, args);
    }

}
