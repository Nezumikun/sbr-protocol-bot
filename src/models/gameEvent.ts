import { GameEventType } from "./enumGameEventType";

export type EventPlayer = 0 | 1| 2 | 3 | "wall"

export class GameEvent {
    type: GameEventType
    player: EventPlayer
    from: EventPlayer

    constructor (type: GameEventType, player: EventPlayer = "wall", from: EventPlayer = "wall") {
        this.type = type
        this.player = player
        this.from = from
    }
}