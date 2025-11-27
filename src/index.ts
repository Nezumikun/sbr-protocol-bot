import 'dotenv/config';
import { Bot, GrammyError, HttpError, Context, InlineKeyboard, session, SessionFlavor } from 'grammy';
import { FileAdapter } from '@grammyjs/storage-file';
import { Session } from '../src/models/session'
import { SessionState } from './models/enumSessionState';
import { PlayerState } from './models/enumPlayerState';
import { GameEventType } from './models/enumGameEventType';
import { EventPlayer, GameEvent } from './models/gameEvent';
import { Game } from './models/game';
import { SessionData } from './models/sessionData';

type MyContext = Context & SessionFlavor<SessionData>;

const magicNumberForWall = 88

function getSession(ctx : MyContext) : Session {
    const session = new Session(ctx.session)
    ctx.session = session
    return session
}

function resetSession(ctx : MyContext) : void {
    ctx.session = new Session()
}

const BOT_API_KEY = process.env.BOT_API_KEY;

if (!BOT_API_KEY) {
    throw new Error('BOT_API_KEY is not defined');
}

const bot = new Bot<MyContext>(BOT_API_KEY);
bot.use(
    session({
        initial: () => (new Session()),
        storage: new FileAdapter({
            dirName: "storage/sessions",
        }),
    })
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
    session.currentGameIndex++
    session.state = SessionState.Play
    session.games.push(new Game())
    await ctx.reply(`Начата игра ${session.currentGameIndex + 1} из ${session.gamesLimit}`)
    await enter_game_event(ctx)
}

async function enter_game_event(ctx:MyContext) : Promise<void> {
    const session = getSession(ctx)
    session.state = SessionState.Play
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
        if (session.players[i].state !== PlayerState.InGame) continue
        inlineKeyboard.text(session.players[i].name, 'mahjong.player.' + i.toString())
    }
    session.state = SessionState.EnterMahjong
    session.currentEvent.type = GameEventType.Mahjong
    await ctx.reply('Кто объявил маджонг?', {
        reply_markup: inlineKeyboard
    })
}

async function enter_kong_player(ctx:MyContext) : Promise<void> {
    const session = getSession(ctx)
    const inlineKeyboard = new InlineKeyboard()
    for (let i : number = 0; i < 4; i++) {
        if (session.players[i].state !== PlayerState.InGame) continue
        inlineKeyboard.text(session.players[i].name, 'kong.player.' + i.toString())
    }
    session.state = SessionState.EnterKong
    session.currentEvent.type = GameEventType.Kong
    await ctx.reply('Кто объявил конг?', {
        reply_markup: inlineKeyboard
    })
}

async function enter_mahjong_from(ctx:MyContext, player: EventPlayer) : Promise<void> {
    const session = getSession(ctx)
    session.currentEvent.player = player
    const inlineKeyboard = new InlineKeyboard()
        .text("Со стены", 'mahjong.from.' + magicNumberForWall.toString())
    for (let i : number = 0; i < 4; i++) {
        if (session.players[i].state !== PlayerState.InGame) continue
        if (i === player) {
            session.players[i].state = PlayerState.Mahjong
            continue
        }
        inlineKeyboard.text(session.players[i].name, 'mahjong.from.' + i.toString())
    }
    session.state = SessionState.EnterMahjong
    await ctx.reply('C кого взяли маджонг?', {
        reply_markup: inlineKeyboard
    })
}

async function enter_kong_from(ctx:MyContext, player: EventPlayer) : Promise<void> {
    const session = getSession(ctx)
    session.currentEvent.player = player
    const inlineKeyboard = new InlineKeyboard()
        .text("Со стены", 'kong.from.' + magicNumberForWall.toString())
    for (let i : number = 0; i < 4; i++) {
        if (session.players[i].state !== PlayerState.InGame) continue
        inlineKeyboard.text((i === player) ? "Доставленный" : session.players[i].name, 'kong.from.' + i.toString())
    }
    session.state = SessionState.EnterKong
    await ctx.reply('C кого взяли маджонг?', {
        reply_markup: inlineKeyboard
    })
}

async function save_event(ctx:MyContext) : Promise<void> {
    const session = getSession(ctx)
    const event= session.currentEvent
    session.getCurrentGame().events.push(new GameEvent(event.type, event.player, event.from))
    console.log(session.getCurrentGame())
    await enter_game_event(ctx)
}

async function set_player_count(ctx:MyContext, player_count:number) : Promise<void> {
    const session = getSession(ctx)
    session.playersCount = player_count
    session.resetPlayers()
    if (player_count === 3) {
        await enter_not_to_come_place(ctx)
    } else {
        await enter_player_name_east(ctx)
    }
    console.log('set_player_count', session)
}

async function enter_not_to_come_place(ctx:MyContext) {
    const session = getSession(ctx)
    const inlineKeyboard = new InlineKeyboard()
    for (let i : number = 0; i < 4; i++) {
        if (session.players[i].place === 'east') continue
        inlineKeyboard.text(Session.getPlaceName(session.players[i].place), 'new_session.not_to_come_place.' + i.toString())
    }
    session.state = SessionState.EnterNotComePlace
    await ctx.reply('На каком месте нет игрока?', {
        reply_markup: inlineKeyboard
    })
}

async function set_not_to_come_place(ctx:MyContext, playerIndex: number) {
    const session = getSession(ctx)
    session.players[playerIndex].state = PlayerState.NotToCome
    await enter_player_name_east(ctx)
}

async function enter_player_name_east(ctx:MyContext) {
    const session = getSession(ctx)
    session.state = SessionState.EnterPlayersNames
    await ctx.reply('Восток: введите имя игрока')
}

async function set_player_name(ctx:MyContext, name: string) : Promise<void> {
    const session = getSession(ctx)
    const playerIndex = session.players.findIndex((item) => item.state === PlayerState.InGame && item.name === '')
    session.players[playerIndex].name = name
    console.log('set_player_name', session)
    const playerNextIndex = session.players.findIndex((item) => item.state === PlayerState.InGame && item.name === '')
    if (playerNextIndex > -1) {
        await ctx.reply(Session.getPlaceName(session.players[playerNextIndex].place) + ': введите имя игрока')
    }
    else {
        await check_players(ctx)
    }
}

async function check_players(ctx:MyContext) {
    const session = getSession(ctx)
    const inlineKeyboard = new InlineKeyboard()
        .text('Да', 'new_session.check_players.yes')
        .text('Нет', 'new_session.check_players.no')
    const message: string[] = [ 'Рассадка:' ]
    for (let i : number = 0; i < 4; i++) {
        if (session.players[i].state !== PlayerState.NotToCome) {
            message.push(Session.getPlaceName(session.players[i].place) + ': ' + session.players[i].name)
        }
    }
    message.push('Всё верно?')
    session.state = SessionState.CheckPlayers
    await ctx.reply(message.join('\n'), {
        reply_markup: inlineKeyboard
    })
}

async function new_session(ctx:MyContext, games_in_session:number) : Promise<void> {
    resetSession(ctx)
    const session = getSession(ctx)
    await ctx.reply(`Запускаем сессию. Сдач в сессии: ${games_in_session}`)
    session.gamesLimit = games_in_session
    session.state = SessionState.EnterPlayerCount
    const inlineKeyboard = new InlineKeyboard()
        .text('4', 'new_session.player_count.4')
        .text('3', 'new_session.player_count.3')
    await ctx.reply('Сколько будет игроков?', {
        reply_markup: inlineKeyboard
    })
    console.log('new_session', session)
}

async function set_games_count(ctx:MyContext) : Promise<void> {
    const session = getSession(ctx)
    const inlineKeyboard = new InlineKeyboard()
        .text('10', 'new_session.games_count.10')
        .text('8', 'new_session.games_count.8')
        .text('4', 'new_session.games_count.4')
        .text('1', 'new_session.games_count.1')
    //    .text('другое', 'new_session.games_count.0')
    session.state = SessionState.EnterGamesCount
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
    if (session.state === SessionState.EnterGamesCount && dataKey.startsWith('new_session.games_count.')) {
        const games_in_session = parseInt(dataKey.replace('new_session.games_count.', ''))
        await new_session(ctx, games_in_session)
    }
    else if (session.state === SessionState.EnterPlayerCount && dataKey.startsWith('new_session.player_count.')) {
        const player_count = parseInt(dataKey.replace('new_session.player_count.', ''))
        await set_player_count(ctx, player_count)
    }
    else if (session.state === SessionState.EnterNotComePlace && dataKey.startsWith('new_session.not_to_come_place.')) {
        const playerIndex = parseInt(dataKey.replace('new_session.not_to_come_place.', ''))
        await set_not_to_come_place(ctx, playerIndex)
    }
    else if (session.state === SessionState.CheckPlayers && dataKey.startsWith('new_session.check_players.')) {
        const answer = dataKey.replace('new_session.check_players.', '')
        if (answer === 'yes') {
            await new_game(ctx)
        }
        else {
            await set_player_count(ctx, session.playersCount)
        }
    }
    else if (session.state === SessionState.Play && dataKey.startsWith('game_event.select.')) {
        const eventType = dataKey.replace('game_event.select.', '')
        switch (eventType) {
            case 'mahjong':
                enter_mahjong_player(ctx)
                break
            case 'kong':
                enter_kong_player(ctx)
                break
            case 'end_of_wall':
                session.currentEvent.type = GameEventType.EndOfWall
                session.currentEvent.player = 'wall'
                session.currentEvent.from = 'wall'
                await save_event(ctx)
                break
            default:
                await ctx.reply('Неизвестное событие ' + eventType)
        }
    }
    else if (session.state === SessionState.EnterMahjong && dataKey.startsWith('mahjong.player.')) {
        const playerIndex = parseInt(dataKey.replace('mahjong.player.', ''))
        if (playerIndex >= 0 && playerIndex < 4) {
            await enter_mahjong_from(ctx, <EventPlayer>playerIndex)
        }
    }
    else if (session.state === SessionState.EnterMahjong && dataKey.startsWith('mahjong.from.')) {
        const playerIndex = parseInt(dataKey.replace('mahjong.from.', ''))
        if (playerIndex >= 0 && playerIndex < 4) {
            session.currentEvent.from = <EventPlayer>playerIndex
            await save_event(ctx)
        } else if (playerIndex === magicNumberForWall) {
            session.currentEvent.from = 'wall'
            await save_event(ctx)
        }
    }
    else if (session.state === SessionState.EnterKong && dataKey.startsWith('kong.player.')) {
        const playerIndex = parseInt(dataKey.replace('kong.player.', ''))
        if (playerIndex >= 0 && playerIndex < 4) {
            await enter_kong_from(ctx, <EventPlayer>playerIndex)
        }
    }
    else if (session.state === SessionState.EnterKong && dataKey.startsWith('kong.from.')) {
        const playerIndex = parseInt(dataKey.replace('kong.from.', ''))
        if (playerIndex >= 0 && playerIndex < 4) {
            session.currentEvent.from = <EventPlayer>playerIndex
            await save_event(ctx)
        } else if (playerIndex === magicNumberForWall) {
            session.currentEvent.from = 'wall'
            await save_event(ctx)
        }
    }
    await ctx.answerCallbackQuery();
});

// Ответ на любое сообщение
bot.on('message:text', async (ctx) => {
    const session = getSession(ctx)
    if (session.state === SessionState.EnterPlayersNames) {
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