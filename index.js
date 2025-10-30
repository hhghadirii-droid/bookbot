const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// 🧩 خواندن توکن از متغیر محیطی (امن)
const token = process.env.TOKEN;
if (!token) {
  console.error('❌ خطا: متغیر محیطی TOKEN تنظیم نشده است.');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// 🔒 آیدی عددی مدیران مجاز
const allowedOwners = [89603350, 5096982033];

// 📁 فایل ذخیره گروه‌های مجاز
const allowedGroupsFile = 'allowedGroups.json';
if (!fs.existsSync(allowedGroupsFile)) {
  fs.writeFileSync(allowedGroupsFile, JSON.stringify([]));
}
let allowedGroups = JSON.parse(fs.readFileSync(allowedGroupsFile, 'utf8'));

// 📋 صف هر گروه
const queues = {};

// ✍️ امضای انتهای پیام‌ها
const signature = '\n\n—🕊️ گروه ادبی ققنوس ';

// 📥 بررسی مجاز بودن گروه
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;

  if (!msg.chat.type.endsWith('group')) return;

  if (!allowedGroups.includes(chatId)) {
    try {
      const admins = await bot.getChatAdministrators(chatId);
      const isOwnerInGroup = admins.some(a => allowedOwners.includes(a.user.id));

      if (isOwnerInGroup) {
        allowedGroups.push(chatId);
        fs.writeFileSync(allowedGroupsFile, JSON.stringify(allowedGroups, null, 2));
        bot.sendMessage(chatId, '✅ این گروه با موفقیت به عنوان گروه مجاز ققنوس ثبت شد.' + signature);
      } else {
        bot.sendMessage(chatId, '⚠️ گروه تأیید نشد؛ حضور یکی از مدیران اصلی ققنوس الزامی است.' + signature);
        bot.leaveChat(chatId);
      }
    } catch (e) {
      console.error('خطا در بررسی گروه:', e);
    }
    return;
  }

  // 🎙️ اضافه شدن به صف با پیام "نوبت می‌خوام"
  if (msg.text && /نوبت\s*[\u200c]?\s*می\s*[\u200c]?\s*خوام/.test(msg.text.trim())) {
    if (!queues[chatId]) queues[chatId] = [];

    const alreadyInQueue = queues[chatId].some(u => u.id === senderId);
    if (alreadyInQueue) {
      bot.sendMessage(chatId, `⚠️ ${msg.from.first_name}، شما در حال حاضر در صف قرار دارید.` + signature);
    } else {
      queues[chatId].push(msg.from);
      bot.sendMessage(chatId, `✅ ${msg.from.first_name} به صف نوبت اضافه شد.` + signature);
    }
  }

  // 💬 پاسخ به وقتی کسی گفت "ربات"
  if (msg.text && msg.text.replace(/\s|‌/g, '').includes('ربات')) {
  bot.sendMessage(chatId, 'جانم 😊 نوبت می‌خوای؟' + signature);
}

});

// 🎤 دستور "next"
bot.onText(/next/, (msg) => {
  const chatId = msg.chat.id;
