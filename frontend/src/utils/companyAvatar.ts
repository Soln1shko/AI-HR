// import { getCompanyAvatar } from '../services/api' // Не используется в этом файле

// Заглушка для аватарки компании (SVG в base64) - иконка здания
export const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4NCiAgPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTIiIGZpbGw9IiMzNzQxNTEiLz4NCiAgPHN2ZyB4PSIxNiIgeT0iMTYiIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjNjM2NmYxIj4NCiAgICA8cGF0aCBkPSJNMTIgM0wyMSAxMkgxOFYyMUgxNVYxNUg5VjIxSDZWMTJIM0wxMiAzWiIvPg0KICA8L3N2Zz4NCjwvc3ZnPg0K'

/**
 * Получает аватарку компании из S3 или возвращает заглушку
 * @param companyId - ID компании
 * @returns Promise<string> - URL аватарки или заглушка
 */
export const getCompanyAvatarUrl = async (companyId: string): Promise<string> => {
  try {
    console.log(`Запрашиваем аватарку для компании ID: ${companyId}`)
    
    // Используем новый endpoint для получения изображения
    const token = localStorage.getItem('authToken')
    if (!token) {
      console.log('Токен авторизации отсутствует')
      return DEFAULT_AVATAR
    }

    const response = await fetch(`/api/company/avatar/${companyId}/image`, {
      method: 'GET',
      headers: {
        'x-access-token': token,
      },
    })

    if (response.ok) {
        // Проверяем Content-Type
      const contentType = response.headers.get('content-type')
      console.log(`Content-Type: ${contentType}`)
      
      // Создаем blob URL для изображения
      const blob = await response.blob()
      console.log(`Размер blob: ${blob.size} байт, тип: ${blob.type}`)
      
      // Проверяем, что это действительно изображение
      if (!blob.type.startsWith('image/') && blob.size > 0) {
        console.log('Получен не image blob, возможно это JSON с ошибкой')
        const text = await blob.text()
        console.log('Содержимое:', text)
        return DEFAULT_AVATAR
      }
      
      const avatarUrl = URL.createObjectURL(blob)
      console.log(`Аватарка загружена и создан blob URL: ${avatarUrl}`)
      return avatarUrl
    } else {
      console.log('Аватарка не найдена, используем заглушку')
      return DEFAULT_AVATAR
    }
  } catch (error) {
    console.error('Ошибка при получении аватарки компании:', error)
    return DEFAULT_AVATAR
  }
}

/**
 * Получает аватарки для списка компаний
 * @param companies - Массив компаний с полем _id
 * @returns Promise<Record<string, string>> - Объект с ID компании как ключ и URL аватарки как значение
 */
export const getCompanyAvatars = async (companies: Array<{ _id: string }>): Promise<Record<string, string>> => {
  const avatars: Record<string, string> = {}
  
  try {
    // Загружаем аватарки параллельно для всех компаний
    const avatarPromises = companies.map(async (company) => {
      const avatarUrl = await getCompanyAvatarUrl(company._id)
      return { companyId: company._id, avatarUrl }
    })
    
    const results = await Promise.all(avatarPromises)
    
    // Формируем объект с результатами
    results.forEach(({ companyId, avatarUrl }) => {
      avatars[companyId] = avatarUrl
    })
    
    return avatars
  } catch (error) {
    console.error('Ошибка при получении аватарок компаний:', error)
    return avatars
  }
}

/**
 * Проверяет, является ли URL заглушкой
 * @param url - URL для проверки
 * @returns boolean - true если это заглушка
 */
export const isDefaultAvatar = (url: string): boolean => {
  return url === DEFAULT_AVATAR || url.startsWith('data:image/svg+xml')
}

/**
 * Освобождает blob URL для предотвращения утечек памяти
 * @param url - URL для освобождения
 */
export const revokeAvatarUrl = (url: string): void => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}
