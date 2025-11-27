import { PlayerState } from "./enumPlayerState"

export type PlayerPlace = "east" | "south" | "west" | "nord"

export class Player {
    name: string = ''
    state : PlayerState = PlayerState.InGame
    place: PlayerPlace

    constructor (place: PlayerPlace) {
        this.place = place
    }
}