import { GameEventType } from "./enumGameEventType"
import { PlayerState } from "./enumPlayerState"
import { SessionState } from "./enumSessionState"
import { Game } from "./game"
import { EventPlayer, GameEvent } from "./gameEvent"
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
        const event = new GameEvent(this.currentEvent.type, this.currentEvent.player, this.currentEvent.from)
        const game = this.getCurrentGame()
        if (event.type === GameEventType.Mahjong) {
            game.mahjongCount++
            if (event.from === "wall") {
                event.fromDetail = []
                this.players.forEach((x, i) => {
                    if (x.state === PlayerState.InGame && i !== event.player) {
                        event.fromDetail.push(<EventPlayer>i)
                    }
                })
            }
        }
        else if (event.type === GameEventType.Kong) {
            if (event.from === "wall" || event.from === event.player) {
                event.fromDetail = []
                this.players.forEach((x, i) => {
                    if (x.state === PlayerState.InGame && i !== event.player) {
                        event.fromDetail.push(<EventPlayer>i)
                    }
                })
            }
        }
        game.events.push(event)
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

    getIndexOfTenpaiPlayerWithoutScore() : number {
        const game = this.getCurrentGame()
        if (game.tenpaiCount > 0 && game.notenCount > 0) {
            const event = game.events.find((x) => x.type === GameEventType.Tenpai && x.score === 0)
            return (event && event.player !== "wall") ? event.player : -1
        }
        else {
            return -1
        }
    }

    setTenpai(playerIndex : number) : void {
        this.players[playerIndex].state = PlayerState.Tenpai
        this.getCurrentGame().tenpaiCount++
        this.getCurrentGame().events.push(new GameEvent(GameEventType.Tenpai, <EventPlayer>playerIndex, <EventPlayer>playerIndex))
    }

    setNoten(playerIndex : number) : void {
        this.players[playerIndex].state = PlayerState.Noten
        this.getCurrentGame().notenCount++
        this.getCurrentGame().events.push(new GameEvent(GameEventType.Noten, <EventPlayer>playerIndex, <EventPlayer>playerIndex))
        const events = this.getCurrentGame().events
        events.forEach((x) => {
            if (x.player === playerIndex) {
                x.score = 0 
            }
        })
        console.log(events)
    }

    setMahjongScore(playerIndex : number, score: number) : void {
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

    setTenpaiScore(playerIndex : number, score: number) : void {
        const events = this.getCurrentGame().events
        events.forEach((x) => {
            if ((x.player === playerIndex) && (x.type === GameEventType.Tenpai)) {
                x.score = score
            }
        })
        console.log(events)
    }

    scoreToString(score : number, multipleFrom : boolean) {
        if (multipleFrom) {
            return 'По ' + ((score > 0) ? '+' : '') +  score.toString() +  ' ' +
                ((score === 1) ? 'очку'
                :(score === 2) ? 'очка'
                : (score === 3) ? 'очка'
                : (score === 5) ? 'очков'
                : (score === 9) ? 'очков'
                : (score === 17) ? 'очков'
                : '')
        } else {
            return ((score > 0) ? '+' : '') +  score.toString() +  ' ' +
                ((score === 1) ? 'очко'
                : (score === 2) ? 'очка'
                : (score === 4) ? 'очка'
                : (score === 8) ? 'очков'
                : (score === 16) ? 'очков'
                : '')
        }
    }

    scoring() : void {
        const game = this.getCurrentGame()
        game.scores = [0, 0, 0, 0]
        game.logs = []
        for (let i : number = 0; i < game.events.length; i++) {
            const event = game.events[i]
            const fromList : string[] = []
            switch (event.type) {
                case GameEventType.Mahjong:
                    if (event.player === "wall") break
                    game.scores[event.player] += event.fromDetail.length * (event.score + (event.from === "wall" ? 1 : 0))
                    event.fromDetail.forEach((i) => {
                        if (i === "wall") return
                        game.scores[i] -= (event.score + (event.from === "wall" ? 1 : 0))
                        fromList.push(this.players[i].name)
                    })
                    if (event.from === "wall") {
                        game.logs.push(`Маджонг. ${this.players[event.player].name} со стены. ${this.scoreToString(event.score + 1, event.fromDetail.length > 1)} c ${fromList.join(', ')}`)
                    } else {
                        game.logs.push(`Маджонг. ${this.players[event.player].name} с ${this.players[event.from].name}. ${this.scoreToString(event.score, false)}`)
                    }
                    break
                case GameEventType.Kong:
                    if (event.player === "wall") break
                    game.scores[event.player] += event.fromDetail.length * event.score
                    event.fromDetail.forEach((i) => {
                        if ((i === "wall") || (i === event.player)) return
                        game.scores[i] -= event.score
                        fromList.push(this.players[i].name)
                    })
                    if (event.from === "wall") {
                        console.log(event.fromDetail)
                        game.logs.push(`Закрытый конг. ${this.players[event.player].name}. ${this.scoreToString(event.score, event.fromDetail.length > 1)} c ${fromList.join(', ')}`)
                    } else if (event.from === event.player) {
                        game.logs.push(`Доставленный конг. ${this.players[event.player].name}. ${this.scoreToString(event.score, event.fromDetail.length > 1)} c ${fromList.join(', ')}`)
                    } else {
                        game.logs.push(`Конг. ${this.players[event.player].name} с ${this.players[event.from].name}. ${this.scoreToString(event.score, false)}`)
                    }
                    break
            }
        }
        console.log(game)
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