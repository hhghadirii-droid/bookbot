const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// 🧩 خواندن توکن از متغیر محیطی (امن)
const token = process.env.TOKEN;
if (!token) {
  console.error('❌ خطا: متغیر محیطی TOKEN تنظیم نشده است.');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// 🔒 آیدی عددی مدیران اصلی (فقط برای ثبت گروه مجاز)
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

// 🛠️ تابع کمکی بررسی ادمین بودن کاربر
function isAdmin(chatId, userId) {
  return bot.getChatAdministrators(chatId)
    .then(admins => admins.some(a => a.user.id === userId))
    .catch(e => {
      console.error('خطا در بررسی ادمین:', e);
      return false;
    });
}

// 📥 بررسی مجاز بودن گروه و مدیریت پیام‌ها
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const text = msg.text ? msg.text.trim() : '';

  if (!msg.chat.type.endsWith('group')) return;

  // ثبت گروه مجاز
  if (!allowedGroups.includes(chatId)) {
    bot.getChatAdministrators(chatId).then(admins => {
      const isOwnerInGroup = admins.some(a => allowedOwners.includes(a.user.id));

      if (isOwnerInGroup) {
        allowedGroups.push(chatId);
        fs.writeFileSync(allowedGroupsFile, JSON.stringify(allowedGroups, null, 2));
        bot.sendMessage(chatId, '✅ این گروه با موفقیت به عنوان گروه مجاز ققنوس ثبت شد.' + signature);
      } else {
        bot.sendMessage(chatId, '⚠️ گروه تأیید نشد؛ حضور یکی از مدیران اصلی ققنوس الزامی است.' + signature);
        bot.leaveChat(chatId);
      }
    }).catch(e => console.error('خطا در بررسی گروه:', e));
    return;
  }

  // 🎙️ اضافه شدن به صف با پیام "نوبت می‌خوام"
  if (/نوبت\s*[\u200c]?\s*می\s*[\u200c]?\s*خوام/.test(text)) {
    if (!queues[chatId]) queues[chatId] = [];

    const alreadyInQueue = queues[chatId].some(u => u.id === senderId);
    if (alreadyInQueue) {
      bot.sendMessage(chatId, `⚠️ ${msg.from.first_name}، شما در حال حاضر در صف قرار دارید.` + signature);
    } else {
      queues[chatId].push(msg.from);
      bot.sendMessage(chatId, `✅ ${msg.from.first_name} به صف نوبت اضافه شد.` + signature);
    }
  }

  // 💬 پاسخ وقتی کسی گفت "ربات"
  if (text.replace(/[\s‌]/g, '').includes('ربات')) {
    bot.sendMessage(chatId, 'جانم 😊 نوبت می‌خوای؟' + signature);
  }

  // 🛠️ فرمان‌های مدیریتی بدون /
  const cmd = text.replace('/', '').toLowerCase();

  if (['next', 'بعدی', 'بعدی را صدا بزن'].includes(cmd)) {
    isAdmin(chatId, senderId).then(admin => {
      if (!admin) return bot.sendMessage(chatId, '🚫 فقط ادمین‌های گروه مجاز به اجرای این دستور هستند.' + signature);

      if (!queues[chatId] || queues[chatId].length === 0) return bot.sendMessage(chatId, '📭 صف در حال حاضر خالی است.' + signature);

      const nextUser = queues[chatId].shift();
      bot.sendMessage(chatId, `🎙️ نوبت ${nextUser.first_name} است.` + signature);
    });
  }

  if (['clear', 'پاک کن', 'پاک کردن'].includes(cmd)) {
    isAdmin(chatId, senderId).then(admin => {
      if (!admin) return bot.sendMessage(chatId, '🚫 فقط ادمین‌های گروه مجاز به اجرای این دستور هستند.' + signature);

      queues[chatId] =
