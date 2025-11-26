import { PlayerState } from "./enumPlayerState"

export type PlayerPlace = "east" | "south" | "west" | "nord"

export class Player {
    name: string = ''
    state : PlayerState = PlayerState.InGame
    place: PlayerPlace

    static getPlaceName(place: PlayerPlace) : string {
        return (place === "east") ? "Восток"
            : (place === "south") ? "Юг"
            : (place === "west") ? "Запад"
            : "Север"
    }

    getPlaceName() : string {
        return Player.getPlaceName(this.place)
    }

    constructor (place: PlayerPlace) {
        this.place = place
    }
}