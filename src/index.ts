import bot from "./bot"
import config from "./config"
import { startNotificationScheduler } from "./tasks/notifications"

const logger = bot.context.logger!

async function main() {
  try {
    await bot.launch(config.launch as any)
    logger.info('The bot is working')
    
    // Запускаем планировщик уведомлений
    startNotificationScheduler()
    logger.info('Notification scheduler started')
    
    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'))
    process.once('SIGTERM', () => bot.stop('SIGTERM'))
  } catch (err) {
    logger.error(err)
  }
}

main();

process.on('unhandledRejection', (reason, p) =>
  logger.error('Unhandled Rejection at: Promise ', p, reason)
)
