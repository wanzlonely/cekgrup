const { Telegraf, Markup } = require('telegraf');
const { startWhatsApp, cekUrutanGrup, cekViaLink } = require('./lib/whatsapp');
const { botToken, ownerId } = require('./settings');

const bot = new Telegraf(botToken);

const checkOwner = (ctx, next) => {
    if (ctx.from.id.toString() === ownerId.toString()) {
        return next();
    } else {
        return ctx.reply("❌ Akses Ditolak. Anda bukan pemilik bot ini.");
    }
};

const mainMenu = (ctx) => {
    const text = `🤖 *WHATSAPP GROUP ANALYZER*\n\n` +
                 `Panel kontrol untuk manajemen dan audit grup WhatsApp.\n` +
                 `Silakan pilih menu di bawah ini:`;

    const buttons = Markup.inlineKeyboard([
        [
            Markup.button.callback('📱 Tautkan WhatsApp', 'menu_login'),
            Markup.button.callback('📊 Cek Semua Grup', 'menu_cek_grup')
        ],
        [
            Markup.button.callback('🔗 Cek via Link', 'menu_cek_link'),
            Markup.button.callback('❓ Panduan', 'menu_help')
        ]
    ]);

    if (ctx.updateType === 'callback_query') {
        ctx.editMessageText(text, { parse_mode: 'Markdown', ...buttons });
    } else {
        ctx.reply(text, { parse_mode: 'Markdown', ...buttons });
    }
};

bot.use(checkOwner);

bot.start((ctx) => mainMenu(ctx));

bot.action('menu_main', (ctx) => mainMenu(ctx));

bot.action('menu_login', (ctx) => {
    const text = `🔐 *LOGIN SESSION*\n\n` +
                 `Silakan kirimkan **Nomor WhatsApp** Anda untuk mendapatkan Kode Pairing.\n\n` +
                 `Contoh format: \`628123456789\``;
    
    ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Kembali', 'menu_main')]
        ])
    });
});

bot.action('menu_cek_grup', async (ctx) => {
    ctx.answerCbQuery('⏳ Mengambil data grup...');
    
    try {
        const hasil = await cekUrutanGrup();
        
        if (hasil.length > 4000) {
            const buffer = Buffer.from(hasil, 'utf-8');
            await ctx.replyWithDocument({ source: buffer, filename: 'List_Grup_Oldest.txt' });
        } else {
            await ctx.reply(hasil, { parse_mode: 'Markdown' });
        }
    } catch (error) {
        ctx.reply(`❌ Gagal: ${error.message}`);
    }
});

bot.action('menu_cek_link', (ctx) => {
    const text = `🔗 *CHECK VIA LINK*\n\n` +
                 `Silakan kirimkan **Link Grup WhatsApp** yang ingin Anda cek tanggal pembuatannya.\n\n` +
                 `Pastikan link berformat: \`https://chat.whatsapp.com/...\``;

    ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Kembali', 'menu_main')]
        ])
    });
});

bot.action('menu_help', (ctx) => {
    const text = `📚 *PANDUAN PENGGUNAAN*\n\n` +
                 `1. Pilih *Tautkan WhatsApp* lalu kirim nomor HP Anda (628xxx).\n` +
                 `2. Masukkan Kode Pairing yang muncul di sini ke WhatsApp Anda.\n` +
                 `3. Pilih *Cek Semua Grup* untuk melihat daftar grup dari yang terlama.\n` +
                 `4. Pilih *Cek via Link* dan kirim link untuk mengintip umur grup tanpa join manual.`;

    ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Kembali', 'menu_main')]
        ])
    });
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();

    if (/^62\d{8,15}$/.test(text)) {
        ctx.reply("⏳ Memproses permintaan Pairing Code...");
        try {
            await startWhatsApp(text, bot, ctx.chat.id);
        } catch (error) {
            ctx.reply("❌ Gagal memproses login.");
        }
    } 
    
    else if (text.includes('chat.whatsapp.com')) {
        ctx.reply("⏳ Sedang melakukan scanning link...");
        try {
            const hasil = await cekViaLink(text);
            ctx.reply(hasil, { parse_mode: 'Markdown' });
        } catch (error) {
            ctx.reply(`❌ Error: ${error.message}`);
        }
    } 
    
    else {
        ctx.reply("⚠️ Perintah tidak dikenali. Gunakan tombol menu.", 
            Markup.inlineKeyboard([[Markup.button.callback('🏠 Menu Utama', 'menu_main')]])
        );
    }
});

bot.launch();
console.log("Bot Panel Berjalan...");

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
