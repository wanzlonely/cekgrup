const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

let sock = null;

const startWhatsApp = async (nomorHP, botTelegram, chatId) => {
    const { state, saveCreds } = await useMultiFileAuthState('sessions');

    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (!sock.authState.creds.me && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(nomorHP);
                const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
                await botTelegram.sendMessage(chatId, `🔐 *KODE PAIRING:* \`${formattedCode}\``, { parse_mode: 'Markdown' });
            } catch (err) {
                await botTelegram.sendMessage(chatId, `❌ Error: ${err.message}`);
            }
        }, 3000);
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                startWhatsApp(nomorHP, botTelegram, chatId);
            } else {
                await botTelegram.sendMessage(chatId, "⚠️ Sesi terputus. Silakan login ulang.");
            }
        } else if (connection === 'open') {
            await botTelegram.sendMessage(chatId, "✅ WhatsApp Terhubung!");
        }
    });

    sock.ev.on('creds.update', saveCreds);
};

const cekUrutanGrup = async () => {
    if (!sock) throw new Error("WhatsApp belum terhubung!");

    const groups = await sock.groupFetchAllParticipating();
    const groupArray = Object.values(groups);

    groupArray.sort((a, b) => a.creation - b.creation);

    let text = `📊 *LIST GRUP (URUT DARI TERLAMA)*\n`;
    text += `Total: ${groupArray.length} Grup\n\n`;

    groupArray.forEach((g, i) => {
        const date = new Date(g.creation * 1000);
        const tglStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        
        text += `${i + 1}. *${g.subject}*\n`;
        text += `   📅 ${tglStr}\n`;
        text += `   🆔 ${g.id.split('@')[0]}\n\n`;
    });

    return text;
};

const cekViaLink = async (link) => {
    if (!sock) throw new Error("WhatsApp belum terhubung!");

    try {
        const code = link.split('chat.whatsapp.com/')[1];
        if (!code) throw new Error("Link tidak valid!");

        const groupGid = await sock.groupAcceptInvite(code);
        const metadata = await sock.groupMetadata(groupGid);
        
        const date = new Date(metadata.creation * 1000);
        const formattedDate = date.toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
        
        await sock.groupLeave(groupGid);

        return `✅ *CHECK SUKSES*\n\n` +
               `🏷 Nama: ${metadata.subject}\n` +
               `📅 Dibuat: ${formattedDate}\n` +
               `🆔 ID: ${metadata.id}`;

    } catch (error) {
        throw new Error("Gagal Join. Link hangus atau bot dibanned.");
    }
};

module.exports = { startWhatsApp, cekUrutanGrup, cekViaLink };
