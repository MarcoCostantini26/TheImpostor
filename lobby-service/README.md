# Lobby Service - The Impostor

Backend Java/Spring Boot per la gestione stanze, utenti e storico partite.

---

## Prerequisiti
- Java 21
- Gradle (incluso via wrapper `./gradlew`)
- Il file `.env` configurato nella root del progetto o l'URL di MongoDB disponibile.

---

## Configurazione del Database (MongoDB)

Lobby Service si appoggia a un cluster MongoDB Atlas remoto. Le credenziali non sono incluse nel codice sorgente per ragioni di sicurezza.

### Tramite file .env (Uso consigliato con Docker)
Assicurati che esista un file `.env` nella cartella padre (dove risiede il `docker-compose.yml`) contenente la variabile:

```env
MONGODB_URI=mongodb+srv://<utente>:<password>@<cluster>.mongodb.net/theimpostor?appName=TheImpostor
```

---

## Avvio del Servizio

### Avvio Locale (Spring Boot diretto)
Se desideri avviare solo il Lobby Service in locale senza usare Docker, devi passare l'URI di MongoDB come variabile d'ambiente direttamente nel terminale:

```bash
cd lobby-service
MONGODB_URI="mongodb+srv://..." ./gradlew bootRun
```

### Avvio tramite Docker Compose (Insieme agli altri servizi)
Se stai avviando l'intera applicazione o preferisci usare Docker, naviga nella cartella radice del progetto:

```bash
docker compose up -d --build lobby-service
```
Il servizio sara in ascolto sulla porta `8080`.

---

## Consultazione e Test delle API

Il Lobby Service espone un'interfaccia interattiva Swagger UI che documenta tutti gli endpoint disponibili (sia le API pubbliche per il Front-end, sia le API interne per Node e Go).

Per consultare le API:
1. Assicurati che il server sia in esecuzione (vedi sezione precedente).
2. Apri il browser al seguente indirizzo:
   **http://localhost:8080/swagger-ui.html**

Per consultare il file OpenAPI in formato JSON nudo:
- **http://localhost:8080/v3/api-docs**

Per verificare che il server stia rispondendo correttamente (Health Check):
- **http://localhost:8080/actuator/health**

---

## Panoramica Endpoint Principali

Il servizio e suddiviso nei seguenti contesti:

- **/api/rooms**: Gestione del ciclo di vita della stanza (creazione, join, leave, start).
- **/api/users**: Registrazione, autenticazione e recupero profilo giocatori.
- **/api/game-history**: Salvataggio e calcolo delle statistiche delle partite concluse.
- **/api/internal**: API riservate alla comunicazione intra-container (Comm Service e Game Engine) per validare le connessioni e aggiornare i round.

Tutti i dettagli sui payload accettati sono visibili nella pagina Swagger UI indicata sopra.

---

## Struttura del Progetto

Il progetto segue i principi del Domain-Driven Design (DDD) all'interno del package `it.unibo.lobbyservice`:

- **domain**: Contiene le entita di business (es. Room, User, GameHistory) e i contratti dei Repository.
- **application**: Contiene gli Use Case e i Service che orchestrano la logica.
- **infrastructure**: Contiene i Controller REST, la configurazione (CORS, MongoDB, OpenAPI) e l'implementazione pratica del database.
