const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// 🧩 خواندن توکن از متغیر محیطی
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
    return;
  }

  // 📦 متن پیام کاربر
  const text = msg.text?.trim();

  if (!text) return;

  // 🎤 next
  if (/^\/?next$/i.test(text)) {
    if (!allowedOwners.includes(senderId)) {
      return bot.sendMessage(chatId, '🚫 فقط مدیران ققنوس مجاز به اجرای این دستور هستند.' + signature);
    }
    if (!queues[chatId] || queues[chatId].length === 0) {
      return bot.sendMessage(chatId, '📭 صف در حال حاضر خالی است.' + signature);
    }
    const nextUser = queues[chatId].shift();
    bot.sendMessage(chatId, `🎙️ نوبت ${nextUser.first_name} است.` + signature);
    return;
  }

  // ❌ remove (مثلاً remove 2)
  if (/^\/?remove\s+\d+$/i.test(text)) {
    if (!allowedOwners.includes(senderId)) {
      return bot.sendMessage(chatId, '🚫 فقط مدیران ققنوس مجاز به اجرای این دستور هستند.' + signature);
    }
    const index = parseInt(text.replace(/[^0-9]/g, ''), 10) - 1;
    if (!queues[chatId] || index < 0 || index >= queues[chatId].length) {
      return bot.sendMessage(chatId, '❌ شماره نوبت معتبر نیست یا صف خالی است.' + signature);
    }
    const removed = queues[chatId].splice(index, 1)[0];
    bot.sendMessage(chatId, `🗑️ نوبت شماره ${index + 1} (${removed.first_name}) از صف حذف شد.` + signature);
    return;
  }

  // 🧹 clear
  if (/^\/?clear$/i.test(text)) {
    if (!allowedOwners.includes(senderId)) {
      return bot.sendMessage(chatId, '🚫 فقط مدیران ققنوس مجاز به اجرای این دستور هستند.' + signature);
    }
    queues[chatId] = [];
    bot.sendMessage(chatId, '🧹 صف نوبت ققنوس پاک شد.' + signature);
    return;
  }

  // 📜 list
  if (/^\/?list$/i.test(text)) {
    const queue = queues[chatId] || [];
    if (queue.length === 0) {
      return bot.sendMessage(chatId, '📭 صف فعلاً خالی است.' + signature);
    }
    const list = queue.map((u, i) => `${i + 1}. ${u.first_name}`).join('\n');
    bot.sendMessage(chatId, `📜 فهرست نوبت‌ها:\n\n${list}` + signature);
    return;
  }
});
// 💬 پاسخ به وقتی کسی گفت "ربات"
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  if (msg.text && /ر\s*[\u200c]?\s*با\s*[\u200c]?\s*ت/.test(msg.text.trim())) {
    bot.sendMessage(chatId, 'جانم 😊 نوبت می‌خوای؟' + signature);
  }
});

console.log('✅ ربات با موفقیت راه‌اندازی شد.');
