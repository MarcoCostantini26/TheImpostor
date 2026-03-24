package it.unibo.lobbyservice.domain.model;

/**
 * Stato del ciclo di vita di una Room.
 */
public enum RoomStatus {
    /**
     * Stanza aperta, in attesa di giocatori.
     */
    WAITING,
    
    /**
     * Partita iniziata, stanza chiusa.
     */
    STARTED,
    
    /**
     * Partita terminata.
     */
    ENDED
}

