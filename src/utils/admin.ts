// Утилиты для проверки админских прав

/**
 * Проверяет, является ли пользователь администратором
 */
export function isAdmin(userId: number): boolean {
  const adminId = getAdminId();
  if (adminId === null) {
    return false; // Если ADMIN_ID не установлен, никто не является админом
  }
  return userId === adminId;
}

/**
 * Получает ID администратора из переменных окружения
 */
export function getAdminId(): number | null {
  const adminIdStr = process.env.ADMIN_ID;
  
  if (!adminIdStr) {
    console.warn('⚠️ ADMIN_ID не установлен в переменных окружения');
    return null;
  }
  
  const adminId = parseInt(adminIdStr);
  
  if (isNaN(adminId)) {
    console.error('❌ ADMIN_ID должен быть числом');
    return null;
  }
  
  return adminId;
}

/**
 * Проверяет, настроен ли ADMIN_ID
 */
export function isAdminConfigured(): boolean {
  return getAdminId() !== null;
}

/**
 * Логирует попытку доступа к админской команде
 */
export function logAdminAccess(userId: number, command: string, allowed: boolean): void {
  const status = allowed ? '✅ РАЗРЕШЕН' : '❌ ЗАПРЕЩЕН';
  const reason = !isAdminConfigured() ? ' (ADMIN_ID не настроен)' : '';
  console.log(`🔐 Админский доступ: пользователь ${userId}, команда ${command} - ${status}${reason}`);
}