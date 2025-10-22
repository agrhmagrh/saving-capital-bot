import bot from "../bot";
import { userStorage } from "../services";
import * as fs from 'fs';
import * as path from 'path';

// Функция для отправки уведомлений
export async function sendDailyReminders(hour: number) {
  const timestamp = new Date().toLocaleString('ru-RU');
  console.log(`\n🔔 [${timestamp}] Начинаем отправку уведомлений в ${hour}:00`);
  
  const allUsers = userStorage.getUsersForNotification(hour);
  
  // Фильтруем пользователей: отправляем уведомления только тем, кто еще не пополнял сегодня
  const usersNeedingReminder = allUsers.filter(user => !userStorage.hasTopUpToday(user.userId));
  
  console.log(`📊 Статистика:`);
  console.log(`  - Всего пользователей с уведомлениями: ${allUsers.length}`);
  console.log(`  - Уже пополнили сегодня: ${allUsers.length - usersNeedingReminder.length}`);
  console.log(`  - Нужно отправить напоминания: ${usersNeedingReminder.length}`);
  
  if (usersNeedingReminder.length === 0) {
    console.log(`✨ Все пользователи уже пополнили счет сегодня! Напоминания не нужны.`);
    return;
  }
  
  let successCount = 0;
  let errorCount = 0;
  
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
      
      successCount++;
      console.log(`  ✅ Напоминание отправлено пользователю ${user.userId}`);
    } catch (error) {
      errorCount++;
      console.error(`  ❌ Ошибка отправки уведомления пользователю ${user.userId}:`, error);
    }
  }
  
  // Если есть пользователи, которые уже пополнили, логируем это
  const usersAlreadyTopUp = allUsers.filter(user => userStorage.hasTopUpToday(user.userId));
  if (usersAlreadyTopUp.length > 0) {
    console.log(`  ℹ️ Пропущены пользователи (уже пополнили): ${usersAlreadyTopUp.map(u => u.userId).join(', ')}`);
  }
  
  console.log(`📈 Итого: ${successCount} успешно, ${errorCount} ошибок`);
  console.log(`🔔 [${new Date().toLocaleString('ru-RU')}] Отправка уведомлений завершена\n`);
}

// Файлы для отслеживания состояния
const NOTIFICATION_LOG_FILE = path.join(process.cwd(), 'data', 'last_notifications.json');
const SCHEDULER_LOCK_FILE = path.join(process.cwd(), 'data', 'scheduler.lock');

// Переменная для хранения ID интервала
let schedulerInterval: NodeJS.Timeout | null = null;

// Функция для проверки, отправляли ли уже уведомления в этот час сегодня
function hasNotificationSentToday(hour: number): boolean {
  try {
    if (!fs.existsSync(NOTIFICATION_LOG_FILE)) {
      return false;
    }
    
    const data = JSON.parse(fs.readFileSync(NOTIFICATION_LOG_FILE, 'utf8'));
    const today = new Date().toDateString();
    const key = `${today}_${hour}`;
    
    return data[key] === true;
  } catch (error) {
    console.error('Ошибка чтения файла уведомлений:', error);
    return false;
  }
}

// Функция для создания блокировки планировщика
function createSchedulerLock(): boolean {
  try {
    // Создаем папку data если её нет
    const dataDir = path.dirname(SCHEDULER_LOCK_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Проверяем, существует ли уже блокировка
    if (fs.existsSync(SCHEDULER_LOCK_FILE)) {
      const lockData = JSON.parse(fs.readFileSync(SCHEDULER_LOCK_FILE, 'utf8'));
      const lockTime = new Date(lockData.timestamp);
      const now = new Date();
      
      // Если блокировка старше 10 минут, считаем её устаревшей
      const lockAge = now.getTime() - lockTime.getTime();
      if (lockAge > 10 * 60 * 1000) { // 10 минут
        console.log('🔓 Найдена устаревшая блокировка планировщика, удаляем...');
        fs.unlinkSync(SCHEDULER_LOCK_FILE);
      } else {
        console.log(`❌ Планировщик уже запущен (PID: ${lockData.pid}, время: ${lockTime.toLocaleString('ru-RU')})`);
        return false;
      }
    }

    // Создаем новую блокировку
    const lockData = {
      pid: process.pid,
      timestamp: new Date().toISOString(),
      startTime: new Date().toLocaleString('ru-RU')
    };

    fs.writeFileSync(SCHEDULER_LOCK_FILE, JSON.stringify(lockData, null, 2));
    console.log(`🔒 Блокировка планировщика создана (PID: ${process.pid})`);
    return true;
  } catch (error) {
    console.error('Ошибка создания блокировки планировщика:', error);
    return false;
  }
}

// Функция для удаления блокировки планировщика
function removeSchedulerLock(): void {
  try {
    if (fs.existsSync(SCHEDULER_LOCK_FILE)) {
      fs.unlinkSync(SCHEDULER_LOCK_FILE);
      console.log('🔓 Блокировка планировщика удалена');
    }
  } catch (error) {
    console.error('Ошибка удаления блокировки планировщика:', error);
  }
}

// Функция для обновления блокировки (heartbeat)
function updateSchedulerLock(): void {
  try {
    if (fs.existsSync(SCHEDULER_LOCK_FILE)) {
      const lockData = JSON.parse(fs.readFileSync(SCHEDULER_LOCK_FILE, 'utf8'));
      lockData.timestamp = new Date().toISOString();
      lockData.lastHeartbeat = new Date().toLocaleString('ru-RU');
      fs.writeFileSync(SCHEDULER_LOCK_FILE, JSON.stringify(lockData, null, 2));
    }
  } catch (error) {
    console.error('Ошибка обновления блокировки планировщика:', error);
  }
}

// Функция для записи, что уведомления отправлены
function markNotificationSent(hour: number): void {
  try {
    // Создаем папку data если её нет
    const dataDir = path.dirname(NOTIFICATION_LOG_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    let data: { [key: string]: boolean } = {};
    if (fs.existsSync(NOTIFICATION_LOG_FILE)) {
      data = JSON.parse(fs.readFileSync(NOTIFICATION_LOG_FILE, 'utf8'));
    }
    
    const today = new Date().toDateString();
    const key = `${today}_${hour}`;
    data[key] = true;
    
    // Очищаем старые записи (старше 7 дней)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    Object.keys(data).forEach(k => {
      const [dateStr] = k.split('_');
      if (new Date(dateStr) < weekAgo) {
        delete data[k];
      }
    });
    
    fs.writeFileSync(NOTIFICATION_LOG_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Ошибка записи файла уведомлений:', error);
  }
}

// Функция для остановки планировщика
export function stopNotificationScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('⏹️ Планировщик уведомлений остановлен');
  }
  removeSchedulerLock();
}

// Функция для запуска планировщика уведомлений
export function startNotificationScheduler(): boolean {
  // Проверяем, не запущен ли уже планировщик
  if (schedulerInterval) {
    console.log('⚠️ Планировщик уже запущен в этом процессе');
    return false;
  }

  // Пытаемся создать блокировку
  if (!createSchedulerLock()) {
    console.log('❌ Не удалось запустить планировщик - уже запущен в другом процессе');
    return false;
  }

  const hours = [9, 12, 15, 18, 21];
  
  console.log('✅ Планировщик уведомлений запущен');
  console.log(`📅 Проверка уведомлений каждые 2 минуты для часов: ${hours.join(', ')}`);
  console.log(`🔒 PID процесса: ${process.pid}`);
  
  // Проверяем каждые 2 минуты (чтобы не пропустить из-за задержек)
  schedulerInterval = setInterval(() => {
    // Обновляем блокировку (heartbeat)
    updateSchedulerLock();
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Отправляем уведомления в первые 5 минут каждого часа из списка
    // И только если мы еще не отправляли сегодня в этот час
    if (currentMinute <= 5 && hours.includes(currentHour)) {
      if (!hasNotificationSentToday(currentHour)) {
        console.log(`⏰ Время ${currentHour}:${currentMinute.toString().padStart(2, '0')} - отправляем уведомления`);
        markNotificationSent(currentHour);
        sendDailyReminders(currentHour);
      } else {
        // Логируем только один раз в час, чтобы не спамить
        if (currentMinute <= 2) {
          console.log(`ℹ️ Уведомления в ${currentHour}:00 уже отправлены сегодня`);
        }
      }
    }
  }, 120000); // Проверяем каждые 2 минуты

  // Обработчики для корректного завершения
  process.on('SIGINT', () => {
    console.log('\n🛑 Получен сигнал SIGINT, останавливаем планировщик...');
    stopNotificationScheduler();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Получен сигнал SIGTERM, останавливаем планировщик...');
    stopNotificationScheduler();
    process.exit(0);
  });

  process.on('exit', () => {
    removeSchedulerLock();
  });

  // Обработчик для необработанных исключений
  process.on('uncaughtException', (error) => {
    console.error('💥 Необработанное исключение:', error);
    stopNotificationScheduler();
    process.exit(1);
  });

  return true;
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