import { GameEventType } from "./enumGameEventType"
import { PlayerState } from "./enumPlayerState"
import { SessionState } from "./enumSessionState"
import { Game } from "./game"
import { EventPlayer, GameEvent } from "./gameEvent"
import { Player, PlayerPlace } from "./player"
import { SessionData } from "./sessionData"
import _ from 'lodash'

export class Session {

    data : SessionData = {
        state: SessionState.Init,
        currentEvent: new GameEvent(GameEventType.BeginGame, "wall", "wall"),
        gamesLimit: 0,
        playersCount: 0,
        players: [],
        currentGameIndex: -1,
        games: []
    }

    resetData() : void {
        this.data.state = SessionState.Init,
        this.data.currentEvent = new GameEvent(GameEventType.BeginGame, "wall", "wall"),
        this.data.gamesLimit = 0,
        this.data.playersCount = 0,
        this.data.players =  [],
        this.data.currentGameIndex = -1,
        this.data.games = []
    }

    resetPlayers() : void {
        this.data.players = [
            new Player("east"),
            new Player("south"),
            new Player("west"),
            new Player("nord"),
        ]
    }

    startNewGame() : void {
        this.data.players.forEach((x, i) => {
            if (x.state === PlayerState.NotToCome) return
            this.data.players[i].state = PlayerState.InGame
        })
        this.data.currentGameIndex++
        this.data.games.push(new Game())
        this.data.state = SessionState.Play
    }

    getPlayerIndexBySeatPlace(place: PlayerPlace): number {
        return this.data.players.findIndex((item) => item.place === place)
    }

    getCurrentGame() : Game {
        return this.data.games[this.data.currentGameIndex]
    }

    saveEvent() : void {
        const event = new GameEvent(this.data.currentEvent.type, this.data.currentEvent.player, this.data.currentEvent.from)
        const game = this.getCurrentGame()
        if (event.type === GameEventType.Mahjong) {
            game.mahjongCount++
            if (event.from === "wall") {
                event.fromDetail = []
                this.data.players.forEach((x, i) => {
                    if (x.state === PlayerState.InGame && i !== event.player) {
                        event.fromDetail.push(<EventPlayer>i)
                    }
                })
            }
        }
        else if (event.type === GameEventType.Kong) {
            if (event.from === "wall" || event.from === event.player) {
                event.fromDetail = []
                this.data.players.forEach((x, i) => {
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
        return this.data.players.findIndex((x) => x.state === PlayerState.InGame)
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
        this.data.players[playerIndex].state = PlayerState.Tenpai
        this.getCurrentGame().tenpaiCount++
        this.getCurrentGame().events.push(new GameEvent(GameEventType.Tenpai, <EventPlayer>playerIndex, <EventPlayer>playerIndex))
    }

    setNoten(playerIndex : number) : void {
        this.data.players[playerIndex].state = PlayerState.Noten
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
        const mahjongList : EventPlayer[] = []
        for (let i : number = 0; i < game.events.length; i++) {
            const event = game.events[i]
            const fromList : string[] = []
            switch (event.type) {
                case GameEventType.Mahjong:
                    if (event.player === "wall") break
                    mahjongList.push(event.player)
                    game.scores[event.player] += event.fromDetail.length * (event.score + (event.from === "wall" ? 1 : 0))
                    event.fromDetail.forEach((i) => {
                        if (i === "wall") return
                        game.scores[i] -= (event.score + (event.from === "wall" ? 1 : 0))
                        fromList.push(this.data.players[i].name)
                    })
                    if (event.from === "wall") {
                        game.logs.push(`Маджонг. ${this.data.players[event.player].name} со стены. ${this.scoreToString(event.score + 1, event.fromDetail.length > 1)} c ${fromList.join(', ')}`)
                    } else {
                        game.logs.push(`Маджонг. ${this.data.players[event.player].name} с ${this.data.players[event.from].name}. ${this.scoreToString(event.score, false)}`)
                    }
                    break
                case GameEventType.Kong:
                    if (event.player === "wall") break
                    game.scores[event.player] += event.fromDetail.length * event.score
                    event.fromDetail.forEach((i) => {
                        if ((i === "wall") || (i === event.player)) return
                        game.scores[i] -= event.score
                        fromList.push(this.data.players[i].name)
                    })
                    if (event.from === "wall") {
                        console.log(event.fromDetail)
                        game.logs.push(`Закрытый конг. ${this.data.players[event.player].name}. ${this.scoreToString(event.score, event.fromDetail.length > 1)} c ${fromList.join(', ')}`)
                    } else if (event.from === event.player) {
                        game.logs.push(`Доставленный конг. ${this.data.players[event.player].name}. ${this.scoreToString(event.score, event.fromDetail.length > 1)} c ${fromList.join(', ')}`)
                    } else {
                        game.logs.push(`Конг. ${this.data.players[event.player].name} с ${this.data.players[event.from].name}. ${this.scoreToString(event.score, false)}`)
                    }
                    break
                case GameEventType.FakeMahjong:
                    if (event.player === "wall") break
                    event.fromDetail = []
                    this.data.players.forEach((x, i) => {
                        if (mahjongList.findIndex((m) => m === i) > -1) return
                        if (i === event.player) return
                        if (x.state === PlayerState.NotToCome) return
                        game.scores[i] -= event.score
                        fromList.push(this.data.players[i].name)
                        event.fromDetail.push(<EventPlayer>i)
                    })
                    game.scores[event.player] += event.fromDetail.length * event.score
                    game.logs.push(`Ложный маджонг. ${this.data.players[event.player].name}. ${this.scoreToString(-event.score, event.fromDetail.length > 1)} уплаченного штрафа получают ${fromList.join(', ')}`)
                    break
            }
        }
        console.log(game)
    }

    getTotal() : number[] {
        const total: number[] = [ 0, 0, 0, 0 ]
        this.data.games.forEach((g) => {
            g.scores.forEach((s, i) => total[i] += s)
        })
        return total
    }

    getResults() : string[] {
        const result : string[] = []
        const total = this.getTotal()
        this.data.players.forEach((x, i) => {
            if (x.state === PlayerState.NotToCome) return
            const score = this.getCurrentGame().scores[i]
            result.push(x.name + ': ' + ((total[i] > 0) ? '+' : '') + total[i].toString() + ' (' + (score > 0? '+' : '') + score.toString() + ')')
        })
        return result
    }

    getSummary() : string[] {
        const result : string[] = []
        const total = this.getTotal()
        total.forEach((t, i) => {
            this.data.players[i].score = t
        })
        let sortTotal = this.getTotal()
        sortTotal.splice(this.data.players.findIndex((x) => x.state === PlayerState.NotToCome), 1)
        sortTotal = (<number[]>(_.uniq(sortTotal))).sort((a, b) => b - a)
        this.data.players
            .sort((a, b) => (b.score - a.score))
            .forEach((x, i) => {
                if (x.state === PlayerState.NotToCome) return
                const index = sortTotal.findIndex((x) => x === total[i])
                result.push(x.name + ': ' + ((x.score > 0) ? '+' : '') + x.score.toString() + ' ' + 
                    ((index === 0) ? '🥇' : (index === 1) ? '🥈' : (index === 2) ? '🥉' : '')
                )
            })
        return result
    }

    static getPlaceName(place: PlayerPlace) : string {
        return (place === "east") ? "Восток"
            : (place === "south") ? "Юг"
            : (place === "west") ? "Запад"
            : "Север"
    }

    constructor (data? : SessionData) {
        if (data) {
            this.data = data
        } else {
            this.resetPlayers()
        }
    }
}