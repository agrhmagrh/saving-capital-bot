import * as fs from "fs";
import * as path from "path";
import { UserData } from "../declarations";

class DataStorageService {
  private dataFile: string;

  constructor() {
    // Создаем папку data если её нет
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.dataFile = path.join(dataDir, "users.json");
  }

  // Загрузить данные из файла
  loadData(): Map<number, UserData> {
    try {
      if (!fs.existsSync(this.dataFile)) {
        return new Map();
      }

      const data = fs.readFileSync(this.dataFile, "utf8");
      const parsed = JSON.parse(data);

      const users = new Map<number, UserData>();

      // Восстанавливаем данные с правильными типами
      for (const [userId, userData] of Object.entries(parsed)) {
        const user = userData as any;
        users.set(Number(userId), {
          userId: user.userId,
          usedNumbers: new Set(user.usedNumbers || []),
          totalAmount: user.totalAmount || 0,
          startDate: new Date(user.startDate),
          lastTopUpDate: user.lastTopUpDate
            ? new Date(user.lastTopUpDate)
            : undefined,
          notificationTime: user.notificationTime,
        });
      }

      return users;
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
      return new Map();
    }
  }

  // Сохранить данные в файл
  saveData(users: Map<number, UserData>): void {
    try {
      const dataToSave: any = {};

      // Преобразуем данные для сериализации
      for (const [userId, userData] of users.entries()) {
        dataToSave[userId] = {
          userId: userData.userId,
          usedNumbers: Array.from(userData.usedNumbers),
          totalAmount: userData.totalAmount,
          startDate: userData.startDate.toISOString(),
          lastTopUpDate: userData.lastTopUpDate?.toISOString(),
          notificationTime: userData.notificationTime,
        };
      }

      fs.writeFileSync(
        this.dataFile,
        JSON.stringify(dataToSave, null, 2),
        "utf8"
      );
    } catch (error) {
      console.error("Ошибка сохранения данных:", error);
    }
  }

  // Создать резервную копию
  createBackup(): void {
    try {
      if (fs.existsSync(this.dataFile)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupFile = this.dataFile.replace(
          ".json",
          `_backup_${timestamp}.json`
        );
        fs.copyFileSync(this.dataFile, backupFile);
        console.log(`Резервная копия создана: ${backupFile}`);
      }
    } catch (error) {
      console.error("Ошибка создания резервной копии:", error);
    }
  }
}

export default new DataStorageService();
