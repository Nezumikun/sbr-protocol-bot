import { GameEventType } from "./enumGameEventType"
import { SessionState } from "./enumSessionState"
import { Game } from "./game"
import { GameEvent } from "./gameEvent"
import { Player, PlayerPlace } from "./player"
import { SessionData } from "./sessionData"

export class Session implements SessionData {

    state : SessionState = SessionState.Init
    currentEvent : GameEvent = new GameEvent(GameEventType.BeginGame, "wall", "wall")
    gamesLimit : number = 0
    playersCount : number = 0
    players : Player[] = []
    currentGameIndex : number = -1
    games : Game[] = []

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

    getCurrentGame() : Game {
        return this.games[this.currentGameIndex]
    }

    static getPlaceName(place: PlayerPlace) : string {
        return (place === "east") ? "Восток"
            : (place === "south") ? "Юг"
            : (place === "west") ? "Запад"
            : "Север"
    }

    constructor (data? : SessionData) {
        if (data) {
            this.state = data.state
            this.currentEvent = data.currentEvent
            this.gamesLimit = data.gamesLimit
            this.playersCount = data.playersCount
            this.players = data.players
            this.currentGameIndex = data.currentGameIndex
            this.games = data.games
        } else {
            this.resetPlayers()
        }
    }
}