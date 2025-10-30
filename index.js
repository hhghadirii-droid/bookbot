const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// 🧩 خواندن توکن از متغیر محیطی
const token = process.env.TOKEN;
if (!token) {
  console.error('❌ خطا: متغیر محیطی TOKEN تنظیم نشده است.');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// 🔒 آیدی مدیران اصلی برای ثبت گروه مجاز
const allowedOwners = [89603350, 5096982033];

// 📁 فایل ذخیره گروه‌های مجاز
const allowedGroupsFile = 'allowedGroups.json';
if (!fs.existsSync(allowedGroupsFile)) fs.writeFileSync(allowedGroupsFile, JSON.stringify([]));
let allowedGroups = JSON.parse(fs.readFileSync(allowedGroupsFile, 'utf8'));

// 📋 صف‌ها
const queues = {};

// ✍️ امضای پیام‌ها
const signature = '\n\n—🕊️ گروه ادبی ققنوس ';

// 🛠️ بررسی ادمین بودن کاربر
function isAdmin(chatId, userId) {
  return bot.getChatAdministrators(chatId)
    .then(admins => admins.some(a => a.user.id === userId))
    .catch(e => {
      console.error('خطا در بررسی ادمین:', e);
      return false;
    });
}

// 📥 مدیریت پیام‌ها
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  if (!msg.text || !msg.chat.type.endsWith('group')) return;

  // پاکسازی متن: فاصله‌ها، نیم‌فاصله‌ها، / و حروف بزرگ
  let text = msg.text.replace(/[\s‌]+/g, '').replace(/^\//, '').toLowerCase();

  // 🔹 ثبت گروه مجاز
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

  // 🔹 اضافه شدن به صف با پیام "نوبت می‌خوام"
  if (/نوبتمیخوام/.test(text)) {
    if (!queues[chatId]) queues[chatId] = [];
    const alreadyInQueue = queues[chatId].some(u => u.id === senderId);
    if (alreadyInQueue) {
      bot.sendMessage(chatId, `⚠️ ${msg.from.first_name}، شما در حال حاضر در صف قرار دارید.` + signature);
    } else {
      queues[chatId].push(msg.from);
      bot.sendMessage(chatId, `✅ ${msg.from.first_name} به صف نوبت اضافه شد.` + signature);
    }
    return;
  }

  // 🔹 پاسخ وقتی کسی گفت "ربات"
  if (text.includes('ربات')) {
    bot.sendMessage(chatId, 'جانم 😊 نوبت می‌خوای؟' + signature);
    return;
  }

  // 🔹 دستورات مدیریتی بدون /
  if (['next', 'بعدی', 'بعدیراصدابزن'].includes(text)) {
    isAdmin(chatId, senderId).then(admin => {
      if (!admin) return bot.sendMessage(chatId, '🚫 فقط ادمین‌های گروه مجاز هستند.' + signature);
      if (!queues[chatId] || queues[chatId].length === 0) return bot.sendMessage(chatId, '📭 صف در حال حاضر خالی است.' + signature);
      const nextUser = queues[chatId].shift();
      bot.sendMessage(chatId, `🎙️ نوبت ${nextUser.first_name} است.` + signature);
    });
    return;
  }

  if (['clear', 'پاککن', 'پاککردن'].includes(text)) {
    isAdmin(chatId, senderId).then(admin => {
      if (!admin) return bot.sendMessage(chatId, '🚫 فقط ادمین‌های گروه مجاز هستند.' + signature);
      queues[chatId] = [];
      bot.sendMessage(chatId, '🧹 صف نوبت ققنوس پاک شد.' + signature);
    });
    return;
  }

  if (text.startsWith('remove') || text.startsWith('حذف')) {
    const index = parseInt(text.replace(/\D/g, ''), 10) - 1;
    isAdmin(chatId, senderId).then(admin => {
      if (!admin) return bot.sendMessage(chatId, '🚫 فقط ادمین‌های گروه مجاز هستند.' + signature);
      if (!queues[chatId] || isNaN(index) || index < 0 || index >= queues[chatId].length) {
        return bot.sendMessage(chatId, '❌ شماره نوبت معتبر نیست یا صف خالی است.' + signature);
      }
      const removed = queues[chatId].splice(index, 1)[0];
      bot.sendMessage(chatId, `🗑️ نوبت شماره ${index + 1} (${removed.first_name}) از صف حذف شد.` + signature);
    });
    return;
  }

  // 🔹 دستور /list هنوز با / باشد
  if (text === 'list') {
    const queue = queues[chatId] || [];
    if (queue.length === 0) return bot.sendMessage(chatId, '📭 صف فعلاً خالی است.' + signature);
    const list = queue.map((u, i) => `${i + 1}. ${u.first_name}`).join('\n');
    bot.sendMessage(chatId, `📜 فهرست نوبت‌ها:\n\n${list}` + signature);
  }
});

console.log('✅ ربات با موفقیت راه‌اندازی شد.');
