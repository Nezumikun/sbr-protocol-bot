import 'dotenv/config';
import { Session } from '../src/models/session'
import { Bot, GrammyError, HttpError, Context, InlineKeyboard } from 'grammy';
import { SessionState } from './models/enum';
import { Players } from './models/players';

const session:Session = new Session()

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
 },
);

async function new_game(ctx:Context) : Promise<void> {
    session.currentGameNumber++
    await ctx.reply(`Начата игра ${session.currentGameNumber} из ${session.gamesCount}`)
}

async function set_player_count(ctx:Context, player_count:number) : Promise<void> {
    session.playersCount = player_count
    session.players = new Players()
    session.sessionState = SessionState.EnterPlayerNameEast
    await ctx.reply('Введите имя игрока на востоке')
    console.log('set_player_count', session)
}

async function set_player_name_east(ctx:Context, name: string) : Promise<void> {
    session.players.east.name = name
    session.sessionState = SessionState.EnterPlayerNameSouth
    await ctx.reply('Введите имя игрока на юге')
    console.log('set_player_name_east', session)
}

async function set_player_name_south(ctx:Context, name: string) : Promise<void> {
    session.players.south.name = name
    session.sessionState = SessionState.EnterPlayerNameWest
    await ctx.reply('Введите имя игрока на западе')
    console.log('set_player_name_south', session)
}

async function set_player_name_west(ctx:Context, name: string) : Promise<void> {
    session.players.west.name = name
    console.log('set_player_name_west', session)
    if (session.playersCount === 4) {
        session.sessionState = SessionState.EnterPlayerNameNord
        await ctx.reply('Введите имя игрока на севере')
    }
    else {
        await check_players(ctx)
    }
}

async function set_player_name_nord(ctx:Context, name: string) : Promise<void> {
    session.players.nord.name = name
    console.log('set_player_name_nord', session)
    await check_players(ctx)
}

async function check_players(ctx:Context) {
    const inlineKeyboard = new InlineKeyboard()
        .text('Да', 'new_session.check_players.yes')
        .text('Нет', 'new_session.check_players.no')
    await ctx.reply(`Рассадка:\nВосток: ${session.players.east.name}\nЮг: ${session.players.south.name}\nЗапад: ${session.players.west.name}\nСевер: ${session.players.nord.name}\nВсё верно?`, {
        reply_markup: inlineKeyboard
    })
}

async function new_session(ctx:Context, games_in_session:number) : Promise<void> {
    await ctx.reply(`Запускаем сессию. Сдач в сессии: ${games_in_session}`)
    session.gamesCount = games_in_session
    const inlineKeyboard = new InlineKeyboard()
        .text('4', 'new_session.player_count.4')
        .text('3', 'new_session.player_count.3')
    await ctx.reply('Сколько будет игроков?', {
        reply_markup: inlineKeyboard
    })
    console.log('new_session', session)
}

bot.command('new_game', async (ctx) => {
    await new_session(ctx, 1)
 },
);

bot.command('new_session', async (ctx) => {
    const inlineKeyboard = new InlineKeyboard()
        .text('10', 'new_session.session_count.10')
        .text('8', 'new_session.session_count.8')
        .text('4', 'new_session.session_count.4')
    //    .text('другое', 'new_session.session_count.0')
    await ctx.reply('Сколько будет сдач в сессии?', {
        reply_markup: inlineKeyboard
    });
 },
);

bot.on('callback_query:data', async (ctx) => {
    // console.log(ctx.callbackQuery)
    const dataKey = ctx.callbackQuery.data
    if (dataKey.startsWith('new_session.session_count.')) {
        const games_in_session = parseInt(dataKey.replace('new_session.session_count.', ''))
        await new_session(ctx, games_in_session)
    }
    else if (dataKey.startsWith('new_session.player_count.')) {
        const player_count = parseInt(dataKey.replace('new_session.player_count.', ''))
        await set_player_count(ctx, player_count)
    }
    else if (dataKey.startsWith('new_session.check_players.')) {
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
    if (session.sessionState === SessionState.EnterPlayerNameEast) {
        await set_player_name_east(ctx, ctx.message.text)
    }
    else if (session.sessionState === SessionState.EnterPlayerNameSouth) {
        await set_player_name_south(ctx, ctx.message.text)
    }
    else if (session.sessionState === SessionState.EnterPlayerNameWest) {
        await set_player_name_west(ctx, ctx.message.text)
    }
    else if (session.sessionState === SessionState.EnterPlayerNameNord) {
        await set_player_name_nord(ctx, ctx.message.text)
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