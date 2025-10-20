import bot from "../bot";
import { userStorage } from "../services";

// Функция для отправки уведомлений
export async function sendDailyReminders(hour: number) {
  const users = userStorage.getUsersForNotification(hour);
  
  console.log(`Отправка уведомлений в ${hour}:00 для ${users.length} пользователей`);
  
  for (const user of users) {
    try {
      // Проверяем, пополнял ли пользователь счет сегодня
      const hasTopUpToday = userStorage.hasTopUpToday(user.userId);
      
      if (hasTopUpToday) {
        // Если уже пополнял сегодня, отправляем поздравление
        await bot.telegram.sendMessage(
          user.userId,
          `🎉 *Отлично\\!* Сегодня вы уже пополнили счет\\!\n\n` +
          `💰 Общая сумма: *${user.totalAmount}* рублей\n` +
          `📊 Использовано чисел: *${user.usedNumbers.size}*/365\n\n` +
          `Увидимся завтра\\! 😊`,
          { parse_mode: 'MarkdownV2' }
        );
      } else {
        // Если не пополнял, отправляем напоминание
        const stats = userStorage.getUserStats(user.userId);
        const remainingNumbers = stats?.remainingNumbers.slice(0, 5) || [];
        
        await bot.telegram.sendMessage(
          user.userId,
          `🔔 *Время пополнить счет\\!*\n\n` +
          `💡 Выберите число от 1 до 365 и пополните брокерский счет\\.\n\n` +
          `📊 Ваш прогресс: *${user.usedNumbers.size}*/365\n` +
          `💰 Накоплено: *${user.totalAmount}* рублей\n\n` +
          `🎯 Предлагаю числа: ${remainingNumbers.join(', ')}${remainingNumbers.length === 5 ? '\\.\\.\\.' : ''}`,
          { parse_mode: 'MarkdownV2' }
        );
      }
    } catch (error) {
      console.error(`Ошибка отправки уведомления пользователю ${user.userId}:`, error);
    }
  }
}

// Функция для запуска планировщика уведомлений
export function startNotificationScheduler() {
  const hours = [9, 12, 15, 18, 21];
  
  // Проверяем каждую минуту, не пора ли отправить уведомления
  setInterval(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Отправляем уведомления в начале каждого часа из списка
    if (currentMinute === 0 && hours.includes(currentHour)) {
      sendDailyReminders(currentHour);
    }
  }, 60000); // Проверяем каждую минуту
  
  console.log('Планировщик уведомлений запущен');
}