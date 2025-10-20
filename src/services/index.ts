import { MyBot } from "../declarations"
import logger from "./logger"
import userStorage from "./userStorage"

export default function (bot: MyBot) {
  bot.configure(logger)
  // Добавляем userStorage в контекст бота
  bot.context.userStorage = userStorage
}

export { default as userStorage } from "./userStorage"
