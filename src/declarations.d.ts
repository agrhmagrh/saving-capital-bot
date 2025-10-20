import { Context } from "telegraf"
import { Telegraf } from "./telegraf"

interface UserData {
  userId: number;
  usedNumbers: Set<number>;
  totalAmount: number;
  startDate: Date;
  lastTopUpDate?: Date;
  notificationTime?: number; // час для уведомлений (9, 12, 15, 18, 21)
}

interface SessionData {
  begin: number,
  end: number,
  topUpAmount?: number | null,
  userData?: UserData
}

export interface MyContext extends Context {
  state: object,
  session: SessionData,
  userStorage?: any // Добавляем userStorage в контекст
}

export type MyBot = Telegraf<MyContext>

export { UserData }
