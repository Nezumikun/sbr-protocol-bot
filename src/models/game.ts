import { GameEvent } from "./gameEvent";

export class Game {
    events : GameEvent[] = []
    mahjongCount: number = 0
    scores : number[] = [ 0, 0, 0, 0 ]
}