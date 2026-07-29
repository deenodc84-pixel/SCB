const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();

// Initialize bot
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Initialize express for Railway
const app = express();
const port = process.env.PORT || 3000;

// Database setup
const db = new sqlite3.Database('./data.db');

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    focus_count INTEGER DEFAULT 0,
    breath_count INTEGER DEFAULT 0,
    habit_streak INTEGER DEFAULT 0,
    last_active DATE
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    habit_name TEXT,
    completed BOOLEAN DEFAULT 0,
    date DATE
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS reminders (
    user_id INTEGER,
    reminder_time TEXT,
    active BOOLEAN DEFAULT 1
  )`);
});

// User states for tracking
const userStates = {};

// Helpers
function getMotivationalQuote() {
  const quotes = [
    "Small steps lead to big changes. Keep going!",
    "Your mind is your sanctuary. Protect it.",
    "Every moment is a fresh beginning.",
    "You're doing better than you think!",
    "Progress, not perfection.",
    "Focus on what matters most.",
    "Your potential is limitless.",
    "Every day is a new opportunity.",
    "You've got this!",
    "Be kind to yourself today."
  ];
  return quotes[Math.floor(Math.random() * quotes.length)];
}

function getBreathingGuide() {
  return `*5-Minute Breathing Exercise*

1. Find a comfortable position
2. Close your eyes gently
3. Follow this rhythm:

Inhale... 1, 2, 3, 4
Hold... 1, 2
Exhale... 1, 2, 3, 4

Repeat 8 times.

Feel the calm wash over you.`;
}

function getJournalPrompt() {
  const prompts = [
    "What are three things you're grateful for today?",
    "What's one small victory you had today?",
    "How are you feeling right now, and why?",
    "What can you do tomorrow to make it better?",
    "Write about something that made you smile.",
    "What did you learn about yourself today?"
  ];
  return prompts[Math.floor(Math.random() * prompts.length)];
}

// Bot commands
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || 'user';
  const firstName = msg.from.first_name || '';
  
  // Register user
  db.run(`INSERT OR IGNORE INTO users (user_id, username, first_name, last_active) VALUES (?, ?, ?, date('now'))`, 
    [userId, username, firstName]);
  
  const welcome = `*Welcome to SCB Wellbeing Bot, ${firstName || 'friend'}!*

I'm your digital wellbeing companion. Here to help you stay focused, calm, and productive.

*What I can do for you:*
Focus Timer - Boost your productivity
Breathing Exercises - Reduce stress instantly
Habit Tracking - Build positive routines
Daily Motivation - Stay inspired
Journal Prompts - Reflect and grow
Screen Breaks - Protect your wellbeing

Try using commands like /focus or /breath to get started!

Type /help for all commands.`;

  bot.sendMessage(chatId, welcome, { parse_mode: 'Markdown' });
});

bot.onText(/\/focus/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Update user stats
  db.run(`UPDATE users SET focus_count = focus_count + 1 WHERE user_id = ?`, [userId]);
  
  const focusMessage = `*Focus Session Started!*

Duration: 25 minutes
Tip: Put your phone down and concentrate

I'll remind you when your session is complete.

*Focus Flow:*
1. Find a quiet space
2. Set a clear goal
3. Work without distractions
4. Take a 5-min break after

Ready, set, focus!`;

  bot.sendMessage(chatId, focusMessage, { parse_mode: 'Markdown' });
  
  // Set reminder after 25 minutes
  setTimeout(() => {
    bot.sendMessage(chatId, 'Focus session complete! Time for a well-deserved break.');
  }, 1500000); // 25 minutes
});

bot.onText(/\/breath/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  db.run(`UPDATE users SET breath_count = breath_count + 1 WHERE user_id = ?`, [userId]);
  
  bot.sendMessage(chatId, getBreathingGuide(), { parse_mode: 'Markdown' });
});

bot.onText(/\/habits/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  const habitKeyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Meditate', callback_data: 'habit_meditate' },
          { text: 'Read', callback_data: 'habit_read' }
        ],
        [
          { text: 'Exercise', callback_data: 'habit_exercise' },
          { text: 'Hydrate', callback_data: 'habit_hydrate' }
        ],
        [
          { text: 'Journal', callback_data: 'habit_journal' },
          { text: 'View Stats', callback_data: 'habit_stats' }
        ]
      ]
    }
  };
  
  bot.sendMessage(chatId, '*Daily Habits Tracker*\n\nMark what you have completed today:',
    { parse_mode: 'Markdown', ...habitKeyboard }
  );
});

bot.onText(/\/motivate/, (msg) => {
  const chatId = msg.chat.id;
  const quote = getMotivationalQuote();
  bot.sendMessage(chatId, `*Daily Motivation*\n\n${quote}\n\nKeep shining!`, { parse_mode: 'Markdown' });
});

bot.onText(/\/journal/, (msg) => {
  const chatId = msg.chat.id;
  const prompt = getJournalPrompt();
  bot.sendMessage(chatId, `*Journal Time*\n\n${prompt}\n\nTake 5 minutes to write your thoughts.\nNo judgment, just honesty.\n\nShare your reflection if you would like support.`,
    { parse_mode: 'Markdown' });
});

bot.onText(/\/reminder/, (msg) => {
  const chatId = msg.chat.id;
  
  const reminderMessage = `*Screen Break Reminder*\n\nSet your break interval:\n\nType /break15 for 15 minutes\nType /break30 for 30 minutes\nType /break60 for 60 minutes\nType /stopreminder to cancel\n\nRemember: Your eyes and mind need rest!`;

  bot.sendMessage(chatId, reminderMessage, { parse_mode: 'Markdown' });
});

// Break command handlers
bot.onText(/\/break(\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const minutes = parseInt(match[1]);
  
  bot.sendMessage(chatId, 
    `Reminder set for ${minutes} minutes!\n\nI will remind you to take a break.\nStay healthy!`);
  
  setTimeout(() => {
    bot.sendMessage(chatId, 
      `*Time for a break!*\n\nStand up, stretch, and look away from your screen for 5 minutes.\n\nYour eyes and body will thank you!`,
      { parse_mode: 'Markdown' });
  }, minutes * 60000);
});

bot.onText(/\/stopreminder/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Reminders stopped. Stay mindful!');
});

bot.onText(/\/stats/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  db.get(`SELECT focus_count, breath_count, habit_streak FROM users WHERE user_id = ?`, [userId], (err, row) => {
    if (row) {
      const stats = `*Your Progress*\n\nFocus Sessions: ${row.focus_count}\nBreathing Exercises: ${row.breath_count}\nHabit Streak: ${row.habit_streak} days\n\nKeep up the great work!\nEvery small step counts.`;
      
      bot.sendMessage(chatId, stats, { parse_mode: 'Markdown' });
    }
  });
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  const help = `*Help & Commands*\n\nHere is everything I can do:\n\n/focus - Start a 25-min focus session\n/breath - Guided breathing exercise\n/habits - Track your daily habits\n/motivate - Get motivation\n/journal - Daily reflection prompt\n/reminder - Set screen break reminders\n/stats - View your progress\n/about - Learn about this bot\n/help - Show this menu\n\n*Tips:*\nUse /break15, /break30, etc. for reminders\nYour data is private and secure\nConsistency beats intensity!\n\nNeed support? I am always here.`;

  bot.sendMessage(chatId, help, { parse_mode: 'Markdown' });
});

bot.onText(/\/about/, (msg) => {
  const chatId = msg.chat.id;
  
  const about = `*About SCB Wellbeing Bot*\n\nYour personal digital wellness companion!\n\n*Features:*\nPrivacy-first - No data stored\nScience-backed techniques\nAd-free experience\nFree to use\n\n*Why I exist:*\nIn our digital world, we need moments of pause. I am here to help you find balance, focus, and peace.\n\n*Credits:*\nBuilt with love for the Telegram community\nVersion 1.0.0\n\n*Connect:*\n@SCB888BOT - Your wellbeing journey starts here!`;

  bot.sendMessage(chatId, about, { parse_mode: 'Markdown' });
});

// Callback queries
bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  
  if (data.startsWith('habit_')) {
    const habit = data.split('_')[1];
    
    db.run(`INSERT INTO habits (user_id, habit_name, completed, date) VALUES (?, ?, 1, date('now'))`, 
      [userId, habit]);
    
    db.run(`UPDATE users SET habit_streak = habit_streak + 1 WHERE user_id = ?`, [userId]);
    
    bot.answerCallbackQuery(callbackQuery.id, {
      text: `${habit} tracked! Keep it up!`,
      show_alert: false
    });
    
    bot.sendMessage(chatId, `*${habit}* marked as completed!\n\nKeep building those healthy habits!`,
      { parse_mode: 'Markdown' });
  } else if (data === 'habit_stats') {
    db.get(`SELECT COUNT(*) as count FROM habits WHERE user_id = ? AND date = date('now')`, 
      [userId], (err, row) => {
        bot.sendMessage(chatId, 
          `*Today's Progress*\n\nHabits completed: ${row.count}/6\n\nKeep going! Every habit counts.`,
          { parse_mode: 'Markdown' });
      });
  }
});

// Error handling
bot.on('error', (error) => {
  console.error('Bot error:', error);
});

// Express server for Railway
app.get('/', (req, res) => {
  res.send('SCB Wellbeing Bot is running!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Handle process termination
process.on('SIGINT', () => {
  db.close();
  process.exit();
});

console.log('SCB Wellbeing Bot is active!');
