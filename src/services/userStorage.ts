import { UserData } from "../declarations";
import dataStorage from "./dataStorage";

class UserStorageService {
  private users: Map<number, UserData> = new Map();

  constructor() {
    // Загружаем данные при инициализации
    this.users = dataStorage.loadData();
    console.log(`Загружено ${this.users.size} пользователей`);
  }

  // Сохранить данные
  private saveData(): void {
    dataStorage.saveData(this.users);
  }

  // Получить данные пользователя
  getUser(userId: number): UserData | undefined {
    return this.users.get(userId);
  }

  // Создать нового пользователя или получить существующего
  initUser(userId: number): UserData {
    let user = this.users.get(userId);
    
    if (!user) {
      user = {
        userId,
        usedNumbers: new Set<number>(),
        totalAmount: 0,
        startDate: new Date(),
      };
      this.users.set(userId, user);
      this.saveData();
    }
    
    return user;
  }

  // Проверить, использовалось ли число
  isNumberUsed(userId: number, number: number): boolean {
    const user = this.users.get(userId);
    return user ? user.usedNumbers.has(number) : false;
  }

  // Добавить использованное число
  addUsedNumber(userId: number, number: number): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    if (user.usedNumbers.has(number)) {
      return false; // Число уже использовалось
    }

    user.usedNumbers.add(number);
    user.totalAmount += number;
    user.lastTopUpDate = new Date();
    this.saveData();
    return true;
  }

  // Получить статистику пользователя
  getUserStats(userId: number): { 
    totalAmount: number; 
    usedCount: number; 
    remainingNumbers: number[];
    daysFromStart: number;
  } | null {
    const user = this.users.get(userId);
    if (!user) return null;

    const allNumbers = Array.from({ length: 365 }, (_, i) => i + 1);
    const remainingNumbers = allNumbers.filter(num => !user.usedNumbers.has(num));
    
    const daysFromStart = Math.floor(
      (new Date().getTime() - user.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      totalAmount: user.totalAmount,
      usedCount: user.usedNumbers.size,
      remainingNumbers,
      daysFromStart
    };
  }

  // Установить время уведомлений
  setNotificationTime(userId: number, hour: number): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    user.notificationTime = hour;
    this.saveData();
    return true;
  }

  // Получить всех пользователей с установленным временем уведомлений
  getUsersForNotification(hour: number): UserData[] {
    return Array.from(this.users.values()).filter(
      user => user.notificationTime === hour
    );
  }

  // Проверить, пополнял ли пользователь счет сегодня
  hasTopUpToday(userId: number): boolean {
    const user = this.users.get(userId);
    if (!user || !user.lastTopUpDate) return false;

    const today = new Date();
    const lastTopUp = user.lastTopUpDate;
    
    return (
      today.getDate() === lastTopUp.getDate() &&
      today.getMonth() === lastTopUp.getMonth() &&
      today.getFullYear() === lastTopUp.getFullYear()
    );
  }

  // Сбросить данные пользователя
  resetUser(userId: number): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    // Сохраняем время уведомлений
    const notificationTime = user.notificationTime;
    
    // Создаем нового пользователя
    const newUser: UserData = {
      userId,
      usedNumbers: new Set<number>(),
      totalAmount: 0,
      startDate: new Date(),
      notificationTime
    };
    
    this.users.set(userId, newUser);
    this.saveData();
    return true;
  }

  // Создать резервную копию данных
  createBackup(): void {
    dataStorage.createBackup();
  }
}

export default new UserStorageService();