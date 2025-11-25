import { SessionState } from "./enum"
import { Player } from "./player"
import { Players } from "./players"

export class Session {
    sessionState : SessionState = SessionState.Init
    gamesCount : number = 0
    playersCount : number = 0
    players : Players = new Players()
    currentGameNumber : number = 0
}