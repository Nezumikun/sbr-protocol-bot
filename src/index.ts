import 'dotenv/config';
import { Bot, GrammyError, HttpError, Context, InlineKeyboard, session, SessionFlavor, NextFunction } from 'grammy';
import { FileAdapter } from '@grammyjs/storage-file';
import { Session } from '../src/models/session'
import { SessionState } from './models/enumSessionState';
import { PlayerState } from './models/enumPlayerState';
import { GameEventType } from './models/enumGameEventType';
import { EventPlayer, GameEvent } from './models/gameEvent';
import { Game } from './models/game';
import { SessionData } from './models/sessionData';
import * as fs from 'fs';

type MyContext = Context // & SessionFlavor<SessionData>;

const sessions : Map<string, SessionData> = new Map<string, SessionData>()

const magicNumberForWall = 88

function getSessionKey(ctx: MyContext) : string | undefined {
    let key = undefined
    if (ctx.chat) return ctx.chat.id.toString()
    if (ctx.from) return ctx.from.id.toString()
    return key
}

function getSession(ctx : MyContext) : Session {
    let session = new Session()
    const key = getSessionKey(ctx)
    if (key) {
        let data = sessions.get(key)
        if (!data) {
            data = tryToLoadSessionFromFile(key)
            if (data) {
                sessions.set(key, data)
            }
        }
        if (data) {
            session = new Session(data)
        }
        else {
            sessions.set(key, session.data)
        }
    }
    console.log(session)
    return session
}

function tryToLoadSessionFromFile(key : string) : SessionData | undefined {
    const filePath = './storage/sessions/' + key + '.json'
    if (fs.existsSync(filePath)) {
        const jsonData = fs.readFileSync(filePath, 'utf-8')
        console.log('Load from ' + filePath)
        return JSON.parse(jsonData)
    }
    return undefined
}

function saveSessionToFile(ctx: MyContext) : void {
    const key = getSessionKey(ctx)
    if (key) {
        const data = sessions.get(key)
        if (data) {
            const jsonData = JSON.stringify(data, null, "\t")
            const filePath = './storage/sessions/' + key + '.json'
            fs.writeFileSync(filePath, jsonData)
            console.log('save to ' + filePath)
        }
    }
}

const BOT_API_KEY = process.env.BOT_API_KEY;

if (!BOT_API_KEY) {
    throw new Error('BOT_API_KEY is not defined');
}

async function sbrProtocolSessions(
    ctx: Context,
    next: NextFunction,
): Promise<void> {
    await next();
    saveSessionToFile(ctx)
}


const bot = new Bot<MyContext>(BOT_API_KEY);
bot.use(sbrProtocolSessions);
bot.use(
    // session({
    //     initial: () => (new Session()).data,
    //     storage: new FileAdapter({
    //         dirName: "storage/sessions",
    //     }),
    // })
);

bot.api.setMyCommands([
    { command: 'new_game', description: 'Начать игру' },
    { command: 'new_session', description: 'Начать сессию' },
    { command: 'end', description: 'Завершить сессию' },
]);

bot.command('start', async (ctx) => {
    await ctx.reply('Привет! Начнём?')
    await set_games_count(ctx)
 },
);

async function new_game(ctx:MyContext) : Promise<void> {
    const session = getSession(ctx)
    session.startNewGame()
    await ctx.reply(`Начата игра ${session.data.currentGameIndex + 1} из ${session.data.gamesLimit}`)
    await enter_game_event(ctx)
}

async function enter_game_event(ctx:MyContext) : Promise<void> {
    const session = getSession(ctx)
    session.data.state = SessionState.Play
    const inlineKeyboard = new InlineKeyboard()
        .text('Маджонг', 'game_event.select.mahjong')
        .text('Конг', 'game_event.select.kong')
        .text('Стена закончилась', 'game_event.select.end_of_wall')
    await ctx.reply("Добавим событие?", {
        reply_markup: inlineKeyboard
    })
}

async function enter_mahjong_player(ctx:MyContext) : Promise<void> {
    const session = getSession(ctx)
    const inlineKeyboard = new InlineKeyboard()
    for (let i : number = 0; i < 4; i++) {
        if (session.data.players[i].state !== PlayerState.InGame) continue
        inlineKeyboard.text(session.data.players[i].name, 'mahjong.player.' + i.toString())
    }
    inlineKeyboard.text("❌", "cancel")
    session.data.state = SessionState.EnterMahjong
    session.data.currentEvent.type = GameEventType.Mahjong
    await ctx.reply('Кто объявил маджонг?', {
        reply_markup: inlineKeyboard
    })
}

async function enter_kong_player(ctx:MyContext) : Promise<void> {
    const session = getSession(ctx)
    const inlineKeyboard = new InlineKeyboard()
    for (let i : number = 0; i < 4; i++) {
        if (session.data.players[i].state !== PlayerState.InGame) continue
        inlineKeyboard.text(session.data.players[i].name, 'kong.player.' + i.toString())
    }
    inlineKeyboard.text("❌", "cancel")
    session.data.state = SessionState.EnterKong
    session.data.currentEvent.type = GameEventType.Kong
    await ctx.reply('Кто объявил конг?', {
        reply_markup: inlineKeyboard
    })
}

async function enter_mahjong_from(ctx:MyContext, player: EventPlayer) : Promise<void> {
    const session = getSession(ctx)
    session.data.currentEvent.player = player
    const inlineKeyboard = new InlineKeyboard()
        .text("Со стены", 'mahjong.from.' + magicNumberForWall.toString())
    for (let i : number = 0; i < 4; i++) {
        if (session.data.players[i].state !== PlayerState.InGame) continue
        if (i === player) {
            session.data.players[i].state = PlayerState.Mahjong
            continue
        }
        inlineKeyboard.text(session.data.players[i].name, 'mahjong.from.' + i.toString())
    }
    inlineKeyboard.text("❌", "cancel")
    session.data.state = SessionState.EnterMahjong
    await ctx.reply('C кого взяли маджонг?', {
        reply_markup: inlineKeyboard
    })
}

async function enter_kong_from(ctx:MyContext, player: EventPlayer) : Promise<void> {
    const session = getSession(ctx)
    session.data.currentEvent.player = player
    const inlineKeyboard = new InlineKeyboard()
        .text("Со стены", 'kong.from.' + magicNumberForWall.toString())
    for (let i : number = 0; i < 4; i++) {
        if (session.data.players[i].state !== PlayerState.InGame) continue
        inlineKeyboard.text((i === player) ? "Доставленный" : session.data.players[i].name, 'kong.from.' + i.toString())
    }
    inlineKeyboard.text("❌", "cancel")
    session.data.state = SessionState.EnterKong
    await ctx.reply('C кого взяли маджонг?', {
        reply_markup: inlineKeyboard
    })
}

async function save_event(ctx:MyContext) : Promise<void> {
    const session = getSession(ctx)
    const event= session.data.currentEvent
    session.saveEvent()
    if (event.type === GameEventType.EndOfWall) {
        await ctx.reply('Зафиксировано')
        session.data.state = SessionState.Scoring
    }
    else if (event.type === GameEventType.Mahjong) {
        if (session.getMahjongCount() + 1 === session.data.playersCount) {
            session.data.state = SessionState.Scoring
        }
    }
    if (session.data.state === SessionState.Scoring) {
        await scoring(ctx)
    }
    else {
        await enter_game_event(ctx)
    }
}

async function scoring(ctx:MyContext) {
    const session = getSession(ctx)
    let indexOfPlayer = session.getIndexOfInGamePlayer()
    if (indexOfPlayer > -1) {
        await check_tenpai(ctx, indexOfPlayer)
        return
    }
    indexOfPlayer = session.getIndexOfMahjongPlayerWithoutScore()
    if (indexOfPlayer > -1) {
        await enter_mahjong(ctx, indexOfPlayer)
        return
    }
    indexOfPlayer = session.getIndexOfTenpaiPlayerWithoutScore()
    if (indexOfPlayer > -1) {
        await enter_tenpai(ctx, indexOfPlayer)
        return
    }
    await ctx.reply("Начинаем расчёты...")
    session.scoring()
    await ctx.reply('Протокол:\n' + session.getCurrentGame().logs.join('\n'))
    await ctx.reply('Очки:\n' + session.getResults().join('\n'))
    if (session.data.currentGameIndex + 1 === session.data.gamesLimit) {
        await ctx.reply('Итоги:\n' + session.getSummary().join('\n'))
        await set_games_count(ctx)
    }
    else {
        await new_game(ctx)
    }
}

async function check_tenpai(ctx:MyContext, playerIndex : number) {
    const session = getSession(ctx)
    const inlineKeyboard = new InlineKeyboard()
        .text('Да', 'check_tenpai.' + playerIndex.toString() + '.yes')
        .text('Нет', 'check_tenpai.' + playerIndex.toString() + '.no')
    await ctx.reply(`Игрок ${session.data.players[playerIndex].name} в ожидании?`, {
        reply_markup: inlineKeyboard
    })
}

async function set_tenpai(ctx:MyContext, playerIndex : number) {
    const session = getSession(ctx)
    session.setTenpai(playerIndex)
    await ctx.reply('Зафиксировано')
    await scoring(ctx)
}

async function set_noten(ctx:MyContext, playerIndex : number) {
    const session = getSession(ctx)
    session.setNoten(playerIndex)
    await ctx.reply('Зафиксировано')
    await scoring(ctx)
}

async function enter_mahjong(ctx:MyContext, playerIndex : number) {
    const session = getSession(ctx)
    const inlineKeyboard = new InlineKeyboard()
        .text('1', 'mahjong_score.' + playerIndex.toString() + '.1')
        .text('2', 'mahjong_score.' + playerIndex.toString() + '.2')
        .text('4', 'mahjong_score.' + playerIndex.toString() + '.4')
        .text('8', 'mahjong_score.' + playerIndex.toString() + '.8')
        .text('16', 'mahjong_score.' + playerIndex.toString() + '.16')
        .row()
        .text('Ложный маджонг', 'mahjong_score.' + playerIndex.toString() + '.0')
    await ctx.reply(`Сколько стоит рука игрока ${session.data.players[playerIndex].name}?`, {
        reply_markup: inlineKeyboard
    })
}

async function enter_tenpai(ctx:MyContext, playerIndex : number) {
    const session = getSession(ctx)
    const inlineKeyboard = new InlineKeyboard()
        .text('1', 'tenpai_score.' + playerIndex.toString() + '.1')
        .text('2', 'tenpai_score.' + playerIndex.toString() + '.2')
        .text('4', 'tenpai_score.' + playerIndex.toString() + '.4')
        .text('8', 'tenpai_score.' + playerIndex.toString() + '.8')
        .text('16', 'tenpai_score.' + playerIndex.toString() + '.16')
    await ctx.reply(`Сколько стоит ждущая рука игрока ${session.data.players[playerIndex].name}?`, {
        reply_markup: inlineKeyboard
    })
}

async function set_mahjong_score(ctx:MyContext, playerIndex : number, score: number) {
    const session = getSession(ctx)
    session.setMahjongScore(playerIndex, score)
    await ctx.reply('Зафиксировано')
    await scoring(ctx)
}

async function set_tenpai_score(ctx:MyContext, playerIndex : number, score: number) {
    const session = getSession(ctx)
    session.setTenpaiScore(playerIndex, score)
    await ctx.reply('Зафиксировано')
    await scoring(ctx)
}

async function set_player_count(ctx:MyContext, player_count:number) : Promise<void> {
    const session = getSession(ctx)
    session.data.playersCount = player_count
    session.resetPlayers()
    if (player_count === 3) {
        await enter_not_to_come_place(ctx)
    } else {
        await enter_player_name_east(ctx)
    }
}

async function enter_not_to_come_place(ctx:MyContext) {
    const session = getSession(ctx)
    const inlineKeyboard = new InlineKeyboard()
    for (let i : number = 0; i < 4; i++) {
        if (session.data.players[i].place === 'east') continue
        inlineKeyboard.text(Session.getPlaceName(session.data.players[i].place), 'new_session.data.not_to_come_place.' + i.toString())
    }
    session.data.state = SessionState.EnterNotComePlace
    await ctx.reply('На каком месте нет игрока?', {
        reply_markup: inlineKeyboard
    })
}

async function set_not_to_come_place(ctx:MyContext, playerIndex: number) {
    const session = getSession(ctx)
    session.data.players[playerIndex].state = PlayerState.NotToCome
    await enter_player_name_east(ctx)
}

async function enter_player_name_east(ctx:MyContext) {
    const session = getSession(ctx)
    session.data.state = SessionState.EnterPlayersNames
    await ctx.reply('Восток: введите имя игрока')
}

async function set_player_name(ctx:MyContext, name: string) : Promise<void> {
    const session = getSession(ctx)
    const playerIndex = session.data.players.findIndex((item) => item.state === PlayerState.InGame && item.name === '')
    session.data.players[playerIndex].name = name
    const playerNextIndex = session.data.players.findIndex((item) => item.state === PlayerState.InGame && item.name === '')
    if (playerNextIndex > -1) {
        await ctx.reply(Session.getPlaceName(session.data.players[playerNextIndex].place) + ': введите имя игрока')
    }
    else {
        await check_players(ctx)
    }
}

async function check_players(ctx:MyContext) {
    const session = getSession(ctx)
    const inlineKeyboard = new InlineKeyboard()
        .text('Да', 'new_session.data.check_players.yes')
        .text('Нет', 'new_session.data.check_players.no')
    const message: string[] = [ 'Рассадка:' ]
    for (let i : number = 0; i < 4; i++) {
        if (session.data.players[i].state !== PlayerState.NotToCome) {
            message.push(Session.getPlaceName(session.data.players[i].place) + ': ' + session.data.players[i].name)
        }
    }
    message.push('Всё верно?')
    session.data.state = SessionState.CheckPlayers
    await ctx.reply(message.join('\n'), {
        reply_markup: inlineKeyboard
    })
}

async function new_session(ctx:MyContext, games_in_session:number) : Promise<void> {
    const session = getSession(ctx)
    await ctx.reply(`Запускаем сессию. Сдач в сессии: ${games_in_session}`)
    session.data.gamesLimit = games_in_session
    session.data.state = SessionState.EnterPlayerCount
    const inlineKeyboard = new InlineKeyboard()
        .text('4', 'new_session.data.player_count.4')
        .text('3', 'new_session.data.player_count.3')
    await ctx.reply('Сколько будет игроков?', {
        reply_markup: inlineKeyboard
    })
}

async function set_games_count(ctx:MyContext) : Promise<void> {
    const session = getSession(ctx)
    session.resetData()
    await ctx.reply('Новая сессия');
    const inlineKeyboard = new InlineKeyboard()
        .text('10', 'new_session.data.games_count.10')
        .text('8', 'new_session.data.games_count.8')
        .text('4', 'new_session.data.games_count.4')
        .text('1', 'new_session.data.games_count.1')
    //    .text('другое', 'new_session.data.games_count.0')
    session.data.state = SessionState.EnterGamesCount
    await ctx.reply('Сколько будет сдач в сессии?', {
        reply_markup: inlineKeyboard
    });
}

bot.command('new_game', async (ctx) => {
        await new_session(ctx, 1)
    },
);

bot.command('new_session', async (ctx) => {
        await set_games_count(ctx)
    },
);

bot.on('callback_query:data', async (ctx) => {
    const session = getSession(ctx)
    const dataKey = ctx.callbackQuery.data
    if (session.data.state === SessionState.EnterGamesCount && dataKey.startsWith('new_session.data.games_count.')) {
        const games_in_session = parseInt(dataKey.replace('new_session.data.games_count.', ''))
        await new_session(ctx, games_in_session)
    }
    else if (session.data.state === SessionState.EnterPlayerCount && dataKey.startsWith('new_session.data.player_count.')) {
        const player_count = parseInt(dataKey.replace('new_session.data.player_count.', ''))
        await set_player_count(ctx, player_count)
    }
    else if (session.data.state === SessionState.EnterNotComePlace && dataKey.startsWith('new_session.data.not_to_come_place.')) {
        const playerIndex = parseInt(dataKey.replace('new_session.data.not_to_come_place.', ''))
        await set_not_to_come_place(ctx, playerIndex)
    }
    else if (session.data.state === SessionState.CheckPlayers && dataKey.startsWith('new_session.data.check_players.')) {
        const answer = dataKey.replace('new_session.data.check_players.', '')
        if (answer === 'yes') {
            await new_game(ctx)
        }
        else {
            await set_player_count(ctx, session.data.playersCount)
        }
    }
    else if (session.data.state === SessionState.Play && dataKey.startsWith('game_event.select.')) {
        const eventType = dataKey.replace('game_event.select.', '')
        switch (eventType) {
            case 'mahjong':
                await enter_mahjong_player(ctx)
                break
            case 'kong':
                await enter_kong_player(ctx)
                break
            case 'end_of_wall':
                session.data.currentEvent.type = GameEventType.EndOfWall
                session.data.currentEvent.player = 'wall'
                session.data.currentEvent.from = 'wall'
                await save_event(ctx)
                break
            default:
                await ctx.reply('Неизвестное событие ' + eventType)
        }
    }
    else if (session.data.state === SessionState.EnterMahjong && dataKey.startsWith('mahjong.player.')) {
        const playerIndex = parseInt(dataKey.replace('mahjong.player.', ''))
        if (playerIndex >= 0 && playerIndex < 4) {
            await enter_mahjong_from(ctx, <EventPlayer>playerIndex)
        }
    }
    else if (session.data.state === SessionState.EnterMahjong && dataKey.startsWith('mahjong.from.')) {
        const playerIndex = parseInt(dataKey.replace('mahjong.from.', ''))
        if (playerIndex >= 0 && playerIndex < 4) {
            session.data.currentEvent.from = <EventPlayer>playerIndex
            await save_event(ctx)
        } else if (playerIndex === magicNumberForWall) {
            session.data.currentEvent.from = 'wall'
            await save_event(ctx)
        }
    }
    else if (session.data.state === SessionState.EnterKong && dataKey.startsWith('kong.player.')) {
        const playerIndex = parseInt(dataKey.replace('kong.player.', ''))
        if (playerIndex >= 0 && playerIndex < 4) {
            await enter_kong_from(ctx, <EventPlayer>playerIndex)
        }
    }
    else if (session.data.state === SessionState.EnterKong && dataKey.startsWith('kong.from.')) {
        const playerIndex = parseInt(dataKey.replace('kong.from.', ''))
        if (playerIndex >= 0 && playerIndex < 4) {
            session.data.currentEvent.from = <EventPlayer>playerIndex
            await save_event(ctx)
        } else if (playerIndex === magicNumberForWall) {
            session.data.currentEvent.from = 'wall'
            await save_event(ctx)
        }
    }
    else if (session.data.state === SessionState.Scoring && dataKey.startsWith('check_tenpai.')) {
        const answer = dataKey.replace('check_tenpai.', '').split(".")
        const playerIndex = parseInt(answer[0])
        if (answer[1] === 'yes') {
            await set_tenpai(ctx, playerIndex)
        }
        else {
            await set_noten(ctx, playerIndex)
        }
    }
    else if (session.data.state === SessionState.Scoring && dataKey.startsWith('mahjong_score.')) {
        const answer = dataKey.replace('mahjong_score.', '').split(".")
        const playerIndex = parseInt(answer[0])
        const score = parseInt(answer[1])
        await set_mahjong_score(ctx, playerIndex, score)
    }
    else if (session.data.state === SessionState.Scoring && dataKey.startsWith('tenpai_score.')) {
        const answer = dataKey.replace('tenpai_score.', '').split(".")
        const playerIndex = parseInt(answer[0])
        const score = parseInt(answer[1])
        await set_tenpai_score(ctx, playerIndex, score)
    }
    else if (dataKey === "cancel") {
        await enter_game_event(ctx)
    }
    await ctx.answerCallbackQuery();
});

// Ответ на любое сообщение
bot.on('message:text', async (ctx) => {
    const session = getSession(ctx)
    if (session.data.state === SessionState.EnterPlayersNames) {
        await set_player_name(ctx, ctx.message.text)
    }
    else {
        await ctx.reply(ctx.message.text);
    }
});

// Обработка ошибок согласно документации
bot.catch((err) => {
 const ctx = err.ctx;
 console.error(`Error while handling update ${ctx.update.update_id}:`);
 const e = err.error;
 if (e instanceof GrammyError) {
   console.error('Error in request:', e.description);
 } else if (e instanceof HttpError) {
   console.error('Could not contact Telegram:', e);
 } else {
   console.error('Unknown error:', e);
 }
});

// Функция запуска бота
async function startBot() {
 try {
   bot.start();
   console.log('Bot started');
 } catch (error) {
   console.error('Error in startBot:', error);
 }
}
startBot();