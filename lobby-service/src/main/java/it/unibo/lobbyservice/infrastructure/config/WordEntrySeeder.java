package it.unibo.lobbyservice.infrastructure.config;

import it.unibo.lobbyservice.domain.model.WordEntry;
import it.unibo.lobbyservice.domain.repository.WordEntryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Popola la collection "word_entries" su MongoDB Atlas all'avvio dell'applicazione.
 * Viene eseguito SOLO se la collection è vuota (idempotente).
 *
 * Regola degli indizi:
 *  - Una sola parola
 *  - Non deve essere sinonimo diretto né parte del nome della parola
 *  - Deve dare un'idea vaga del concetto, non la risposta esatta
 */
@Component
public class WordEntrySeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(WordEntrySeeder.class);

    private final WordEntryRepository wordEntryRepository;

    public WordEntrySeeder(WordEntryRepository wordEntryRepository) {
        this.wordEntryRepository = wordEntryRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (wordEntryRepository.count() > 0) {
            log.info("[WordEntrySeeder] Collection già popolata ({} entry). Skip.", wordEntryRepository.count());
            return;
        }

        List<WordEntry> entries = buildEntries();
        wordEntryRepository.saveAll(entries);
        log.info("[WordEntrySeeder] {} WordEntry inserite nella collection 'word_entries'.", entries.size());
    }

    private List<WordEntry> buildEntries() {
        return List.of(
            // --- Animali ---
            WordEntry.create("Elefante",    "Savana"),
            WordEntry.create("Pinguino",    "Antartico"),
            WordEntry.create("Giraffa",     "Erbivoro"),
            WordEntry.create("Squalo",      "Predatore"),
            WordEntry.create("Camaleonte",  "Mimetismo"),
            WordEntry.create("Fenicottero", "Rosa"),
            WordEntry.create("Koala",       "Australia"),
            WordEntry.create("Polpo",       "Tentacoli"),
            WordEntry.create("Struzzo",     "Veloce"),
            WordEntry.create("Piranha",     "Amazzonia"),

            // --- Cibo ---
            WordEntry.create("Pizza",       "Lievito"),
            WordEntry.create("Sushi",       "Giappone"),
            WordEntry.create("Cioccolato",  "Cacao"),
            WordEntry.create("Anguria",     "Estate"),
            WordEntry.create("Tiramisu",    "Mascarpone"),
            WordEntry.create("Ramen",       "Brodo"),
            WordEntry.create("Tacos",       "Messico"),
            WordEntry.create("Croissant",   "Burro"),
            WordEntry.create("Paella",      "Zafferano"),
            WordEntry.create("Gelato",      "Cremoso"),

            // --- Sport ---
            WordEntry.create("Calcio",      "Stadio"),
            WordEntry.create("Nuoto",       "Vasca"),
            WordEntry.create("Tennis",      "Rete"),
            WordEntry.create("Scherma",     "Lama"),
            WordEntry.create("Arrampicata", "Parete"),
            WordEntry.create("Ciclismo",    "Pedale"),
            WordEntry.create("Judo",        "Tatami"),
            WordEntry.create("Pallavolo",   "Battuta"),
            WordEntry.create("Rugby",       "Ovale"),
            WordEntry.create("Tiro",        "Bersaglio"),

            // --- Professioni ---
            WordEntry.create("Astronauta",  "Orbita"),
            WordEntry.create("Chirurgo",    "Bisturi"),
            WordEntry.create("Sommelier",   "Annata"),
            WordEntry.create("Apicoltore",  "Alveare"),
            WordEntry.create("Vulcanologo", "Eruzione"),
            WordEntry.create("Botanico",    "Radici"),
            WordEntry.create("Geologo",     "Strati"),
            WordEntry.create("Archivista",  "Documento"),
            WordEntry.create("Liutaio",     "Verniciatura"),
            WordEntry.create("Sommozzatore","Profondita"),

            // --- Oggetti ---
            WordEntry.create("Bussola",     "Magnetico"),
            WordEntry.create("Binocolo",    "Lente"),
            WordEntry.create("Termometro",  "Mercurio"),
            WordEntry.create("Clessidra",   "Sabbia"),
            WordEntry.create("Periscopo",   "Sottomarino"),
            WordEntry.create("Sestante",    "Navigazione"),
            WordEntry.create("Abaco",       "Calcolo"),
            WordEntry.create("Metronomo",   "Ritmo"),
            WordEntry.create("Barometro",   "Pressione"),
            WordEntry.create("Compasso",    "Cerchio"),

            // --- Luoghi ---
            WordEntry.create("Deserto",     "Duna"),
            WordEntry.create("Foresta",     "Sottobosco"),
            WordEntry.create("Fiordo",      "Norvegia"),
            WordEntry.create("Atollo",      "Corallo"),
            WordEntry.create("Tundra",      "Permafrost"),
            WordEntry.create("Palude",      "Fango"),
            WordEntry.create("Canyon",      "Erosione"),
            WordEntry.create("Delta",       "Sedimento"),
            WordEntry.create("Grotta",      "Stalattite"),
            WordEntry.create("Golfo",       "Insenatura"),

            // --- Fenomeni naturali ---
            WordEntry.create("Tsunami",     "Maremoto"),
            WordEntry.create("Tornado",     "Rotazione"),
            WordEntry.create("Aurora",      "Plasma"),
            WordEntry.create("Siccita",     "Aridita"),
            WordEntry.create("Valanga",     "Slavina"),
            WordEntry.create("Eclissi",     "Ombra"),
            WordEntry.create("Terremoto",   "Magnitudo"),
            WordEntry.create("Tifone",      "Ciclone"),
            WordEntry.create("Nebbia",      "Visibilita"),
            WordEntry.create("Grandine",    "Chicco"),

            // --- Tecnologia ---
            WordEntry.create("Satellite",   "Telemetria"),
            WordEntry.create("Transistor",  "Silicio"),
            WordEntry.create("Algoritmo",   "Istruzione"),
            WordEntry.create("Processore",  "Frequenza"),
            WordEntry.create("Fibra",       "Impulso"),
            WordEntry.create("Blockchain",  "Decentralizzato"),
            WordEntry.create("Sensore",     "Rilevamento"),
            WordEntry.create("Antenna",     "Segnale"),
            WordEntry.create("Firmware",    "Integrato"),
            WordEntry.create("Prototipo",   "Sperimentale"),

            // --- Arte e cultura ---
            WordEntry.create("Affresco",    "Intonaco"),
            WordEntry.create("Mosaico",     "Tessera"),
            WordEntry.create("Sonetto",     "Quartina"),
            WordEntry.create("Sinfonia",    "Movimento"),
            WordEntry.create("Calligrafia", "Pennino"),
            WordEntry.create("Origami",     "Piegatura"),
            WordEntry.create("Lacca",       "Verniciatura"),
            WordEntry.create("Papiro",      "Egitto"),
            WordEntry.create("Acquerello",  "Trasparenza"),
            WordEntry.create("Scultura",    "Argilla")
        );
    }
}

