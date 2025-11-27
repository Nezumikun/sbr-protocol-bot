import { GameEventType } from "./enumGameEventType"
import { PlayerState } from "./enumPlayerState"
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

    saveEvent() : void {
        const event= this.currentEvent
        const game = this.getCurrentGame()
        game.events.push(new GameEvent(event.type, event.player, event.from))
        if (event.type === GameEventType.Mahjong) {
            game.mahjongCount++
        }
    }

    getMahjongCount() : number {
        return this.getCurrentGame().mahjongCount
    }

    getIndexOfInGamePlayer() : number {
        return this.players.findIndex((x) => x.state === PlayerState.InGame)
    }

    getIndexOfMahjongPlayerWithoutScore() : number {
        const event = this.getCurrentGame().events.find((x) => x.type === GameEventType.Mahjong && x.score === 0)
        return (event && event.player !== "wall") ? event.player : -1
    }

    setTenpai(playerIndex : number) : void {
        this.players[playerIndex].state = PlayerState.Tenpai
    }

    setNoten(playerIndex : number) : void {
        this.players[playerIndex].state = PlayerState.Noten
        const events = this.getCurrentGame().events
        events.forEach((x) => {
            if (x.player === playerIndex) {
                x.score = 0 
            }
        })
        console.log(events)
    }

    setMahjongScore(playerIndex : number, score: number) : void {
        this.players[playerIndex].state = PlayerState.Noten
        const events = this.getCurrentGame().events
        events.forEach((x) => {
            if ((x.player === playerIndex) && (x.type === GameEventType.Mahjong)) {
                if (score === 0) {
                    x.type = GameEventType.FakeMahjong
                    x.score = -8
                }
                else {
                    x.score = score
                }
            }
        })
        console.log(events)
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