import bot from "../bot";
import { userStorage } from "../services";

// Функция для отправки уведомлений
export async function sendDailyReminders(hour: number) {
  const allUsers = userStorage.getUsersForNotification(hour);
  
  // Фильтруем пользователей: отправляем уведомления только тем, кто еще не пополнял сегодня
  const usersNeedingReminder = allUsers.filter(user => !userStorage.hasTopUpToday(user.userId));
  
  console.log(`Отправка уведомлений в ${hour}:00:`);
  console.log(`  - Всего пользователей с уведомлениями: ${allUsers.length}`);
  console.log(`  - Уже пополнили сегодня: ${allUsers.length - usersNeedingReminder.length}`);
  console.log(`  - Нужно отправить напоминания: ${usersNeedingReminder.length}`);
  
  for (const user of usersNeedingReminder) {
    try {
      // Отправляем напоминание только тем, кто еще не пополнял
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
      
      console.log(`  ✅ Напоминание отправлено пользователю ${user.userId}`);
    } catch (error) {
      console.error(`  ❌ Ошибка отправки уведомления пользователю ${user.userId}:`, error);
    }
  }
  
  // Если есть пользователи, которые уже пополнили, логируем это
  const usersAlreadyTopUp = allUsers.filter(user => userStorage.hasTopUpToday(user.userId));
  if (usersAlreadyTopUp.length > 0) {
    console.log(`  ℹ️ Пропущены пользователи (уже пополнили): ${usersAlreadyTopUp.map(u => u.userId).join(', ')}`);
  }
}

// Функция для запуска планировщика уведомлений
export function startNotificationScheduler() {
  const hours = [9, 12, 15, 18, 21];
  let lastNotificationHour = -1; // Отслеживаем последний час отправки
  
  // Проверяем каждую минуту, не пора ли отправить уведомления
  setInterval(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Отправляем уведомления в начале каждого часа из списка
    // И только если мы еще не отправляли в этот час
    if (currentMinute === 0 && hours.includes(currentHour) && lastNotificationHour !== currentHour) {
      lastNotificationHour = currentHour;
      sendDailyReminders(currentHour);
    }
    
    // Сбрасываем счетчик в начале нового дня
    if (currentHour === 0 && currentMinute === 0) {
      lastNotificationHour = -1;
    }
  }, 60000); // Проверяем каждую минуту
  
  console.log('Планировщик уведомлений запущен');
}

// Функция для отправки поздравлений тем, кто уже пополнил (опционально)
export async function sendCongratulations(hour: number) {
  const usersForCongratulations = userStorage.getUsersForCongratulations(hour);
  
  console.log(`Отправка поздравлений в ${hour}:00 для ${usersForCongratulations.length} пользователей`);
  
  for (const user of usersForCongratulations) {
    try {
      await bot.telegram.sendMessage(
        user.userId,
        `🎉 *Отлично\\!* Сегодня вы уже пополнили счет\\!\n\n` +
        `💰 Общая сумма: *${user.totalAmount}* рублей\n` +
        `📊 Использовано чисел: *${user.usedNumbers.size}*/365\n\n` +
        `Увидимся завтра\\! 😊`,
        { parse_mode: 'MarkdownV2' }
      );
      
      console.log(`  🎉 Поздравление отправлено пользователю ${user.userId}`);
    } catch (error) {
      console.error(`  ❌ Ошибка отправки поздравления пользователю ${user.userId}:`, error);
    }
  }
}