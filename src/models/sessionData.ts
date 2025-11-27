import { GameEventType } from "./enumGameEventType"
import { SessionState } from "./enumSessionState"
import { Game } from "./game"
import { GameEvent } from "./gameEvent"
import { Player } from "./player"

export interface SessionData {
    state : SessionState
    currentEvent : GameEvent
    gamesLimit : number
    playersCount : number
    players : Player[]
    currentGameIndex : number
    games : Game[]
}