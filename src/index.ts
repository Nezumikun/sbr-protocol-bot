import 'dotenv/config';
import { Session } from '../src/models/session'
import { Bot, GrammyError, HttpError, Context, InlineKeyboard } from 'grammy';
import { SessionState } from './models/enumSessionState';
import { PlayerState } from './models/enumPlayerState';

const sessions:Map<number, Session> = new Map<number, Session>()

function getSession(ctx : Context) : Session {
    if (!ctx.from?.id) {
        throw new Error("Unknown UserId")
    }
    const userId: number = ctx.from.id
    let session = sessions.get(userId)
    if (!session) {
        session = new Session()
        sessions.set(userId, session)
    }
    return session
}

function resetSession(ctx : Context) : void {
    if (!ctx.from?.id) {
        throw new Error("Unknown UserId")
    }
    const userId: number = ctx.from.id
    sessions.set(userId, new Session())
}

const BOT_API_KEY = process.env.BOT_API_KEY;

if (!BOT_API_KEY) {
    throw new Error('BOT_API_KEY is not defined');
}

const bot = new Bot(BOT_API_KEY);

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

async function new_game(ctx:Context) : Promise<void> {
    const session = getSession(ctx)
    session.currentGameNumber++
    session.state = SessionState.Play
    await ctx.reply(`Начата игра ${session.currentGameNumber} из ${session.gamesLimit}`)
}

async function set_player_count(ctx:Context, player_count:number) : Promise<void> {
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

async function enter_not_to_come_place(ctx: Context) {
    const session = getSession(ctx)
    const inlineKeyboard = new InlineKeyboard()
    for (let i : number = 0; i < 4; i++) {
        if (session.players[i].place === 'east') continue
        inlineKeyboard.text(session.players[i].getPlaceName(), 'new_session.not_to_come_place.' + i.toString())
    }
    session.state = SessionState.EnterNotComePlace
    await ctx.reply('На каком месте нет игрока?', {
        reply_markup: inlineKeyboard
    })
}

async function set_not_to_come_place(ctx: Context, playerIndex: number) {
    const session = getSession(ctx)
    session.players[playerIndex].state = PlayerState.NotToCome
    await enter_player_name_east(ctx)
}

async function enter_player_name_east(ctx: Context) {
    const session = getSession(ctx)
    session.state = SessionState.EnterPlayersNames
    await ctx.reply('Восток: введите имя игрока')
}

async function set_player_name(ctx:Context, name: string) : Promise<void> {
    const session = getSession(ctx)
    const playerIndex = session.players.findIndex((item) => item.state === PlayerState.InGame && item.name === '')
    session.players[playerIndex].name = name
    console.log('set_player_name', session)
    const playerNextIndex = session.players.findIndex((item) => item.state === PlayerState.InGame && item.name === '')
    if (playerNextIndex > -1) {
        await ctx.reply(session.players[playerNextIndex].getPlaceName() + ': введите имя игрока')
    }
    else {
        await check_players(ctx)
    }
}

async function check_players(ctx:Context) {
    const session = getSession(ctx)
    const inlineKeyboard = new InlineKeyboard()
        .text('Да', 'new_session.check_players.yes')
        .text('Нет', 'new_session.check_players.no')
    const message: string[] = [ 'Рассадка:' ]
    for (let i : number = 0; i < 4; i++) {
        if (session.players[i].state !== PlayerState.NotToCome) {
            message.push(session.players[i].getPlaceName() + ': ' + session.players[i].name)
        }
    }
    message.push('Всё верно?')
    session.state = SessionState.CheckPlayers
    await ctx.reply(message.join('\n'), {
        reply_markup: inlineKeyboard
    })
}

async function new_session(ctx:Context, games_in_session:number) : Promise<void> {
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

async function set_games_count(ctx:Context) : Promise<void> {
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