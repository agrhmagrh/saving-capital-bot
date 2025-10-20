const [ , , taskName ] = process.argv

async function runTask() {
  if (!taskName) {
    console.error('Please provide a task name')
    process.exit(1)
  }
  
  try {
    const task = await import('./' + taskName)
    await task.default()
  } catch (error) {
    console.error('Failed to run task:', error)
    process.exit(1)
  }
}

// Если запускается как основной модуль
if (require.main === module) {
  runTask()
}

// Экспортируем функции для использования в других модулях
export * from "./notifications"
