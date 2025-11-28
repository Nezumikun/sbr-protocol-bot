import { GameEvent } from "./gameEvent";

export class Game {
    events : GameEvent[] = []
    scores : number[] = [ 0, 0, 0, 0 ]
    logs : string[] = []
    mahjongCount: number = 0
    tenpaiCount: number = 0
    notenCount: number = 0
}