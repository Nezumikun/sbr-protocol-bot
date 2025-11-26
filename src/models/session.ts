import { SessionState } from "./enumSessionState"
import { Player, PlayerPlace } from "./player"

export class Session {
    state : SessionState = SessionState.Init
    gamesLimit : number = 0
    playersCount : number = 0
    players : Player[]
    currentGameNumber : number = 0

    resetPlayers() : void {
        this.players = [
            new Player("east"),
            new Player("south"),
            new Player("west"),
            new Player("nord"),
        ]
    }

    getPlayerIndexBySeatPlace(place: PlayerPlace): number {
        return this.players.findIndex((item) => item.place === place)
    }

    constructor () {
        this.players = []
        this.resetPlayers()
    }
}