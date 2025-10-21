import { Controller } from "../../controller";
import { MyBot, MyContext } from "../../declarations";
import { Markup } from "telegraf";
import { commands } from "./commands";
import { userStorage } from "../../services";
import { escapeMarkdownV2, formatNumber, formatPercent, formatNumberList } from "../../utils/markdown";

export default function (bot: MyBot) {
  const common = new Controller<MyContext>();
  
  const markup = Markup.inlineKeyboard([
    [Markup.button.callback("🚀 Начать копить!", "start")],
    [Markup.button.callback("📊 Моя статистика", "stats")],
  ]);

  // Команда /start
  common.start(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    // Инициализируем пользователя
    userStorage.initUser(userId);
    
    await ctx.reply(
      "💰 *Стратегия накопления капитала на год*\n\n" +
      "Каждый день выбирайте число от 1 до 365 и пополняйте брокерский счет на эту сумму\\.\n\n" +
      "🎯 *Правила:*\n" +
      "• Каждое число можно использовать только один раз\n" +
      "• Пополнение возможно только один раз в сутки\n" +
      "• Бот запомнит все ваши пополнения\n" +
      "• Максимальная сумма за год: *66 795 рублей*",
      { 
        parse_mode: 'MarkdownV2',
        ...markup 
      }
    );
    return next();
  });

  // Обработка текстовых сообщений (чисел)
  common.on("text", async (ctx, next) => {
    const { text } = ctx.message;
    const userId = ctx.from?.id;
    
    if (!userId) return next();

    // Пропускаем команды
    if (text.startsWith("/")) return next();

    const number = parseInt(text);
    
    if (!number || number < 1 || number > 365) {
      await ctx.reply(
        "❌ Пожалуйста, введите целое число от 1 до 365"
      );
      return next();
    }

    // Проверяем, пополнял ли пользователь уже сегодня
    if (userStorage.hasTopUpToday(userId)) {
      await ctx.reply(
        "⏰ *Вы уже пополняли счет сегодня\\!*\n\n" +
        "Пополнение возможно только один раз в сутки\\. Попробуйте завтра\\!\n\n" +
        "💡 Используйте /stats чтобы посмотреть текущий прогресс",
        { parse_mode: 'MarkdownV2' }
      );
      return next();
    }

    // Проверяем, использовалось ли число
    if (userStorage.isNumberUsed(userId, number)) {
      try {
        const stats = userStorage.getUserStats(userId);
        const remainingCount = stats?.remainingNumbers.length || 0;
        
        // Безопасно формируем список предлагаемых чисел
        let suggestedNumbers = '';
        if (stats && stats.remainingNumbers.length > 0) {
          const firstFive = stats.remainingNumbers.slice(0, 5);
          suggestedNumbers = formatNumberList(firstFive);
          if (remainingCount > 5) {
            suggestedNumbers += escapeMarkdownV2('...')
          }
        }
        
        await ctx.reply(
          `⚠️ *Число ${formatNumber(number)} уже использовалось\\!*\n\n` +
          `Выберите другое число\\. Доступно еще: *${formatNumber(remainingCount)}* чисел\n\n` +
          `💡 Попробуйте: ${suggestedNumbers}`,
          { parse_mode: 'MarkdownV2' }
        );
      } catch (error) {
        console.error('Ошибка при обработке повторного числа:', error);
        await ctx.reply(
          `⚠️ Число ${number} уже использовалось! Выберите другое число от 1 до 365.`
        );
      }
      return next();
    }

    // Сохраняем число в сессии для подтверждения
    ctx.session = {
      begin: 1,
      end: 365,
      topUpAmount: number
    };

    await ctx.reply(
      `💵 Вы хотите пополнить счет на *${number} рублей*?`,
      {
        parse_mode: 'MarkdownV2',
        ...Markup.inlineKeyboard([
          [Markup.button.callback("✅ Да, пополнил!", "confirm_topup")],
          [Markup.button.callback("❌ Нет, отмена", "cancel_topup")],
        ])
      }
    );
    
    return next();
  });

  // Установка времени уведомлений
  const timeButtons = [9, 12, 15, 18, 21].map((time) =>
    Markup.button.callback(`${time}:00`, `time_${time}`)
  );
  const markupTime = Markup.inlineKeyboard([
    timeButtons.slice(0, 3),
    timeButtons.slice(3)
  ]);

  common.command("time", async (ctx, next) => {
    await ctx.reply("🕐 Выберите время для ежедневных напоминаний:", markupTime);
    return next();
  });

  // Команда статистики
  common.command("stats", async (ctx, next) => {
    try {
      const userId = ctx.from?.id;
      if (!userId) return next();

      // Инициализируем пользователя если его нет
      userStorage.initUser(userId);
      
      const stats = userStorage.getUserStats(userId);
      if (!stats) {
        await ctx.reply("Сначала начните копить с помощью /start");
        return next();
      }

      const progress = ((stats.usedCount / 365) * 100).toFixed(1);
      const avgDaily = stats.daysFromStart > 0 ? (stats.totalAmount / stats.daysFromStart).toFixed(0) : 0;

      await ctx.reply(
        `📊 *Ваша статистика накоплений*\n\n` +
        `💰 Накоплено: *${formatNumber(stats.totalAmount)}* рублей\n` +
        `📈 Использовано чисел: *${formatNumber(stats.usedCount)}*/365 \\(${formatPercent(progress)}%\\)\n` +
        `📅 Дней с начала: *${formatNumber(stats.daysFromStart)}*\n` +
        `📊 Среднее в день: *${formatNumber(Number(avgDaily))}* рублей\n\n` +
        `🎯 До цели осталось: *${formatNumber(66795 - stats.totalAmount)}* рублей`,
        { parse_mode: 'MarkdownV2' }
      );
    } catch (error) {
      console.error('Ошибка в команде stats:', error);
      await ctx.reply("Произошла ошибка при получении статистики. Попробуйте еще раз.");
    }
    return next();
  });

  // Действие "Начать копить"
  common.action("start", async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    userStorage.initUser(userId);
    
    ctx.session = {
      begin: 1,
      end: 365,
    };

    await ctx.editMessageText(
      `🎯 *Стратегия запущена\\!*\n\n` +
      `Максимальная сумма за год: *66 795* рублей\n\n` +
      `💡 Введите число от 1 до 365 для пополнения счета`,
      { parse_mode: 'MarkdownV2' }
    );
    
    await ctx.answerCbQuery("Стратегия активирована! 🚀");
    return next();
  });

  // Действие "Статистика"
  common.action("stats", async (ctx, next) => {
    try {
      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.answerCbQuery("Ошибка: не удалось определить пользователя", { show_alert: true });
        return next();
      }

      // Инициализируем пользователя если его нет
      userStorage.initUser(userId);
      
      const stats = userStorage.getUserStats(userId);
      if (!stats) {
        await ctx.answerCbQuery("Сначала начните копить!", { show_alert: true });
        return next();
      }

      const progress = ((stats.usedCount / 365) * 100).toFixed(1);
      
      await ctx.editMessageText(
        `📊 *Статистика накоплений*\n\n` +
        `💰 Накоплено: *${formatNumber(stats.totalAmount)}* руб\n` +
        `📈 Прогресс: *${formatNumber(stats.usedCount)}*/365 \\(${formatPercent(progress)}%\\)\n` +
        `📅 Дней с начала: *${formatNumber(stats.daysFromStart)}*\n\n` +
        `🔙 Вернуться в главное меню`,
        { 
          parse_mode: 'MarkdownV2',
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔙 Назад", "back_to_main")]
          ])
        }
      );
      
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Ошибка в action stats:', error);
      await ctx.answerCbQuery("Произошла ошибка при получении статистики", { show_alert: true });
    }
    return next();
  });

  // Подтверждение пополнения
  common.action("confirm_topup", async (ctx, next) => {
    try {
      const userId = ctx.from?.id;
      const amount = ctx.session?.topUpAmount;
      
      if (!userId || !amount) {
        await ctx.answerCbQuery("Ошибка: данные сессии не найдены", { show_alert: true });
        return next();
      }

      // Проверяем причину отказа
      const hasTopUpToday = userStorage.hasTopUpToday(userId);
      const isNumberUsed = userStorage.isNumberUsed(userId, amount);
      
      if (hasTopUpToday) {
        await ctx.editMessageText(
          "⏰ *Вы уже пополняли счет сегодня\\!*\n\n" +
          "Пополнение возможно только один раз в сутки\\. Попробуйте завтра\\!\n\n" +
          "💡 Используйте /stats чтобы посмотреть текущий прогресс",
          { parse_mode: 'MarkdownV2' }
        );
        await ctx.answerCbQuery("Уже пополняли сегодня!", { show_alert: true });
      } else if (isNumberUsed) {
        await ctx.editMessageText(
          `❌ Ошибка: число ${formatNumber(amount)} уже использовалось\\!`,
          { parse_mode: 'MarkdownV2' }
        );
        await ctx.answerCbQuery("Число уже использовалось!", { show_alert: true });
      } else {
        const success = userStorage.addUsedNumber(userId, amount);
        
        if (success) {
          const stats = userStorage.getUserStats(userId);
          await ctx.editMessageText(
            `✅ *Отлично\\!* Пополнение на *${formatNumber(amount)}* рублей зафиксировано\n\n` +
            `💰 Общая сумма: *${formatNumber(stats?.totalAmount || 0)}* рублей\n` +
            `📊 Использовано чисел: *${formatNumber(stats?.usedCount || 0)}*/365\n\n` +
            `Продолжайте копить\\! 💪`,
            { parse_mode: 'MarkdownV2' }
          );
          await ctx.answerCbQuery("Пополнение зафиксировано! 💰");
        } else {
          await ctx.editMessageText(
            "❌ Произошла ошибка при сохранении пополнения\\. Попробуйте еще раз\\.",
            { parse_mode: 'MarkdownV2' }
          );
          await ctx.answerCbQuery("Ошибка сохранения!", { show_alert: true });
        }
      }
    } catch (error) {
      console.error('Ошибка в confirm_topup:', error);
      await ctx.answerCbQuery("Произошла ошибка при сохранении", { show_alert: true });
    }
    
    return next();
  });

  // Отмена пополнения
  common.action("cancel_topup", async (ctx, next) => {
    await ctx.editMessageText(
      "❌ Пополнение отменено\\. Введите другое число от 1 до 365",
      { parse_mode: 'MarkdownV2' }
    );
    await ctx.answerCbQuery();
    return next();
  });

  // Возврат в главное меню
  common.action("back_to_main", async (ctx, next) => {
    await ctx.editMessageText(
      "💰 *Стратегия накопления капитала на год*\n\n" +
      "Каждый день выбирайте число от 1 до 365 и пополняйте брокерский счет на эту сумму\\.\n\n" +
      "🎯 *Правила:*\n" +
      "• Каждое число можно использовать только один раз\n" +
      "• Пополнение возможно только один раз в сутки\n" +
      "• Бот запомнит все ваши пополнения\n" +
      "• Максимальная сумма за год: *66 795 рублей*",
      { 
        parse_mode: 'MarkdownV2',
        ...markup 
      }
    );
    await ctx.answerCbQuery();
    return next();
  });

  // Установка времени уведомлений
  [9, 12, 15, 18, 21].forEach(hour => {
    common.action(`time_${hour}`, async (ctx, next) => {
      const userId = ctx.from?.id;
      if (!userId) return next();

      userStorage.setNotificationTime(userId, hour);
      
      await ctx.editMessageText(
        `✅ Время уведомлений установлено на *${hour}:00*\n\n` +
        `Теперь каждый день в это время я буду напоминать вам о пополнении счета\\!`,
        { parse_mode: 'MarkdownV2' }
      );
      
      await ctx.answerCbQuery(`Уведомления в ${hour}:00 активированы! 🔔`);
      return next();
    });
  });

  // Команда для просмотра доступных чисел
  common.command("available", async (ctx, next) => {
    try {
      const userId = ctx.from?.id;
      if (!userId) return next();

      // Инициализируем пользователя если его нет
      userStorage.initUser(userId);
      
      const stats = userStorage.getUserStats(userId);
      if (!stats) {
        await ctx.reply("Сначала начните копить с помощью /start");
        return next();
      }

      const availableNumbers = stats.remainingNumbers;
      const totalAvailable = availableNumbers.length;
      
      if (totalAvailable === 0) {
        await ctx.reply(
          "🎉 *Поздравляем\\!* Вы использовали все числа от 1 до 365\\!\n\n" +
          `💰 Итоговая сумма: *${formatNumber(stats.totalAmount)}* рублей`,
          { parse_mode: 'MarkdownV2' }
        );
        return next();
      }

      // Показываем первые 20 доступных чисел
      const displayNumbers = availableNumbers.slice(0, 20);
      const moreCount = totalAvailable - displayNumbers.length;
      
      await ctx.reply(
        `📋 *Доступные числа* \\(${formatNumber(totalAvailable)} из 365\\):\n\n` +
        `${formatNumberList(displayNumbers)}${moreCount > 0 ? `\n\n${escapeMarkdownV2('...')} и еще ${formatNumber(moreCount)} чисел` : ''}\n\n` +
        `💡 Введите любое из этих чисел для пополнения счета`,
        { parse_mode: 'MarkdownV2' }
      );
    } catch (error) {
      console.error('Ошибка в команде available:', error);
      await ctx.reply("Произошла ошибка при получении доступных чисел. Попробуйте еще раз.");
    }
    
    return next();
  });

  // Команда для сброса данных (только для разработки)
  common.command("reset", async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    await ctx.reply(
      "⚠️ *Внимание\\!* Вы уверены, что хотите сбросить все данные?\n\n" +
      "Это действие нельзя отменить\\!",
      {
        parse_mode: 'MarkdownV2',
        ...Markup.inlineKeyboard([
          [Markup.button.callback("✅ Да, сбросить", "confirm_reset")],
          [Markup.button.callback("❌ Нет, отмена", "cancel_reset")],
        ])
      }
    );
    
    return next();
  });

  // Подтверждение сброса
  common.action("confirm_reset", async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    // Сбрасываем данные пользователя
    userStorage.resetUser(userId);
    
    await ctx.editMessageText(
      "✅ *Данные сброшены\\!*\n\n" +
      "Теперь вы можете начать копить заново\\. Используйте /start",
      { parse_mode: 'MarkdownV2' }
    );
    
    await ctx.answerCbQuery("Данные сброшены!");
    return next();
  });

  // Отмена сброса
  common.action("cancel_reset", async (ctx, next) => {
    await ctx.editMessageText(
      "❌ Сброс отменен\\. Ваши данные сохранены\\.",
      { parse_mode: 'MarkdownV2' }
    );
    await ctx.answerCbQuery();
    return next();
  });

  // Команда для проверки последнего пополнения
  common.command("today", async (ctx, next) => {
    try {
      const userId = ctx.from?.id;
      if (!userId) return next();

      userStorage.initUser(userId);
      
      const hasTopUpToday = userStorage.hasTopUpToday(userId);
      const stats = userStorage.getUserStats(userId);
      
      if (hasTopUpToday) {
        await ctx.reply(
          "✅ *Сегодня вы уже пополнили счет\\!*\n\n" +
          `💰 Общая сумма: *${formatNumber(stats?.totalAmount || 0)}* рублей\n` +
          `📊 Использовано чисел: *${formatNumber(stats?.usedCount || 0)}*/365\n\n` +
          "Следующее пополнение будет доступно завтра\\!",
          { parse_mode: 'MarkdownV2' }
        );
      } else {
        await ctx.reply(
          "⏰ *Сегодня вы еще не пополняли счет*\n\n" +
          "Введите число от 1 до 365 для пополнения\\!\n\n" +
          "💡 Используйте /available чтобы посмотреть доступные числа",
          { parse_mode: 'MarkdownV2' }
        );
      }
    } catch (error) {
      console.error('Ошибка в команде today:', error);
      await ctx.reply("Произошла ошибка при проверке статуса. Попробуйте еще раз.");
    }
    
    return next();
  });

  common.help((ctx) => ctx.reply(commands.text));

  // Команда для управления настройками уведомлений
  common.command("settings", async (ctx, next) => {
    try {
      const userId = ctx.from?.id;
      if (!userId) return next();

      userStorage.initUser(userId);
      const user = userStorage.getUser(userId);
      
      const hasNotifications = user?.notificationTime !== undefined;
      const hasCongratulations = user?.enableCongratulations === true;
      
      await ctx.reply(
        "⚙️ *Настройки уведомлений*\n\n" +
        `🔔 Напоминания: ${hasNotifications ? `включены в ${user?.notificationTime}:00` : 'отключены'}\n` +
        `🎉 Поздравления: ${hasCongratulations ? 'включены' : 'отключены'}\n\n` +
        "Выберите что настроить:",
        {
          parse_mode: 'MarkdownV2',
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔔 Время напоминаний", "set_time")],
            [Markup.button.callback(hasCongratulations ? "🎉 Отключить поздравления" : "🎉 Включить поздравления", "toggle_congratulations")],
            [Markup.button.callback("🔙 Назад", "back_to_main")]
          ])
        }
      );
    } catch (error) {
      console.error('Ошибка в команде settings:', error);
      await ctx.reply("Произошла ошибка при получении настроек. Попробуйте еще раз.");
    }
    
    return next();
  });

  // Действие переключения поздравлений
  common.action("toggle_congratulations", async (ctx, next) => {
    try {
      const userId = ctx.from?.id;
      if (!userId) return next();

      const user = userStorage.getUser(userId);
      const currentState = user?.enableCongratulations === true;
      const newState = !currentState;
      
      userStorage.setCongratulations(userId, newState);
      
      await ctx.editMessageText(
        `✅ Поздравления ${newState ? 'включены' : 'отключены'}\\!\n\n` +
        `${newState ? 
          'Теперь вы будете получать поздравления в установленное время, если уже пополнили счет сегодня\\.' : 
          'Поздравления отключены\\. Вы будете получать только напоминания о пополнении\\.'
        }`,
        { 
          parse_mode: 'MarkdownV2',
          ...Markup.inlineKeyboard([
            [Markup.button.callback("⚙️ Настройки", "settings_back")],
            [Markup.button.callback("🔙 Главное меню", "back_to_main")]
          ])
        }
      );
      
      await ctx.answerCbQuery(`Поздравления ${newState ? 'включены' : 'отключены'}!`);
    } catch (error) {
      console.error('Ошибка в toggle_congratulations:', error);
      await ctx.answerCbQuery("Произошла ошибка", { show_alert: true });
    }
    
    return next();
  });

  // Действие возврата к настройкам
  common.action("settings_back", async (ctx, next) => {
    try {
      const userId = ctx.from?.id;
      if (!userId) return next();

      const user = userStorage.getUser(userId);
      const hasNotifications = user?.notificationTime !== undefined;
      const hasCongratulations = user?.enableCongratulations === true;
      
      await ctx.editMessageText(
        "⚙️ *Настройки уведомлений*\n\n" +
        `🔔 Напоминания: ${hasNotifications ? `включены в ${user?.notificationTime}:00` : 'отключены'}\n` +
        `🎉 Поздравления: ${hasCongratulations ? 'включены' : 'отключены'}\n\n` +
        "Выберите что настроить:",
        {
          parse_mode: 'MarkdownV2',
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔔 Время напоминаний", "set_time")],
            [Markup.button.callback(hasCongratulations ? "🎉 Отключить поздравления" : "🎉 Включить поздравления", "toggle_congratulations")],
            [Markup.button.callback("🔙 Назад", "back_to_main")]
          ])
        }
      );
      
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Ошибка в settings_back:', error);
      await ctx.answerCbQuery("Произошла ошибка", { show_alert: true });
    }
    
    return next();
  });

  // Действие установки времени из настроек
  common.action("set_time", async (ctx, next) => {
    const timeButtons = [9, 12, 15, 18, 21].map((time) =>
      Markup.button.callback(`${time}:00`, `time_${time}`)
    );
    const markupTime = Markup.inlineKeyboard([
      timeButtons.slice(0, 3),
      timeButtons.slice(3),
      [Markup.button.callback("🔙 К настройкам", "settings_back")]
    ]);

    await ctx.editMessageText(
      "🕐 Выберите время для ежедневных напоминаний:",
      markupTime
    );
    
    await ctx.answerCbQuery();
    return next();
  });

  common.help((ctx) => ctx.reply(commands.text));

  bot.use(common);
}