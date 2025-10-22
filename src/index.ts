import bot from "./bot"
import config from "./config"
import { startNotificationScheduler, stopNotificationScheduler } from "./tasks/notifications"

const logger = bot.context.logger!

async function main() {
  try {
    await bot.launch(config.launch as any)
    logger.info('The bot is working')
    
    // Запускаем планировщик уведомлений
    const schedulerStarted = startNotificationScheduler()
    if (schedulerStarted) {
      logger.info('Notification scheduler started successfully')
    } else {
      logger.warn('Notification scheduler failed to start (already running?)')
    }
    
    // Enable graceful stop
    process.once('SIGINT', () => {
      logger.info('Stopping bot and scheduler...')
      stopNotificationScheduler()
      bot.stop('SIGINT')
    })
    process.once('SIGTERM', () => {
      logger.info('Stopping bot and scheduler...')
      stopNotificationScheduler()
      bot.stop('SIGTERM')
    })
  } catch (err) {
    logger.error(err)
    stopNotificationScheduler()
  }
}

main();

process.on('unhandledRejection', (reason, p) =>
  logger.error('Unhandled Rejection at: Promise ', p, reason)
)
