import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { exchangeHhCode, completeHhRegistration, HhCompanyData } from '../services/api'

const HhRedirectPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [companyData, setCompanyData] = useState<HhCompanyData | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const processedCodes = useRef(new Set<string>())

  // Получаем код авторизации из URL (используется в useEffect)

  // Обработка кода авторизации от hh.ru
  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      setError('Ошибка авторизации: ' + error)
      return
    }

    if (code && state) {
      // Проверяем, не обрабатывали ли мы уже этот код
      if (!processedCodes.current.has(code)) {
        processedCodes.current.add(code)
        handleCodeExchange(code, state)
      }
    } else if (!code) {
      // Если нет кода, показываем демо данные
      setCompanyData({
        hh_id: 'demo',
        name: 'ООО "Пример Компании"',
        description: 'Демонстрационная компания',
        site_url: 'https://example.com',
        logo_url: '',
        industries: [],
        area: { name: 'Москва' },
        vacancies_count: 5
      })
    }
  }, [searchParams])

  const handleCodeExchange = async (code: string, state: string) => {
    // Проверяем, не обрабатываем ли мы уже этот код
    const cacheKey = `hh_code_${code}`
    if (localStorage.getItem(cacheKey)) {
      const cachedData = JSON.parse(localStorage.getItem(cacheKey)!)
      setCompanyData(cachedData.company_data)
      setSessionToken(cachedData.session_token)
      window.history.replaceState({}, '', '/hh-redirect')
      return
    }

    setIsLoadingData(true)
    setError('')

    try {
      const result = await exchangeHhCode(code, state)
      
      if (result.success && result.company_data && result.session_token) {
        // Кэшируем результат
        localStorage.setItem(cacheKey, JSON.stringify({
          company_data: result.company_data,
          session_token: result.session_token,
          already_registered: result.already_registered
        }))
        
        setCompanyData(result.company_data)
        setSessionToken(result.session_token)
        setError('') 
        
        // Если компания уже зарегистрирована, показываем сообщение
        if (result.already_registered) {
          setError('Компания уже зарегистрирована. Введите пароль для входа.')
        }
        
        // Очищаем URL от параметров
        window.history.replaceState({}, '', '/hh-redirect')
      } else {
        // Если код уже использован, проверяем кэш
        if (result.error === 'CODE_ALREADY_USED') {
          if (localStorage.getItem(cacheKey)) {
            const cachedData = JSON.parse(localStorage.getItem(cacheKey)!)
            setCompanyData(cachedData.company_data)
            setSessionToken(cachedData.session_token)
            setError('') // Очищаем ошибку при использовании кэша
            
            // Если компания уже зарегистрирована, показываем сообщение
            if (cachedData.already_registered) {
              setError('Компания уже зарегистрирована. Введите пароль для входа.')
            }
            
            window.history.replaceState({}, '', '/hh-redirect')
          } else {
            setError('Ошибка при получении данных компании')
          }
        } else if (result.error === 'COMPANY_ALREADY_REGISTERED') {
          // Компания уже зарегистрирована - показываем сообщение
          setError('Компания уже зарегистрирована. Войдите через обычную форму входа.')
        } else {
          // Показываем ошибку только если нет данных компании
          if (!companyData) {
            setError(result.error || 'Ошибка при получении данных компании')
          }
        }
      }
    } catch (err) {
      // Проверяем кэш еще раз на случай ошибки
      if (localStorage.getItem(cacheKey)) {
        const cachedData = JSON.parse(localStorage.getItem(cacheKey)!)
        setCompanyData(cachedData.company_data)
        setSessionToken(cachedData.session_token)
        setError('')
        
        // Если компания уже зарегистрирована, показываем сообщение
        if (cachedData.already_registered) {
          setError('Компания уже зарегистрирована. Введите пароль для входа.')
        }
        
        window.history.replaceState({}, '', '/hh-redirect')
      } else {
        // Показываем ошибку только если нет данных компании
        if (!companyData) {
          setError('Ошибка при получении данных компании')
        }
      }
    } finally {
      setIsLoadingData(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!password) {
      setError('Пароль обязателен')
      return
    }

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов')
      return
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    if (!sessionToken) {
      setError('Сессия истекла. Попробуйте снова.')
      return
    }

    setIsLoading(true)

    try {
      const result = await completeHhRegistration(sessionToken, password)
      
      if (result.success && result.token) {
        // Сохраняем токен авторизации
        localStorage.setItem('authToken', result.token)
        localStorage.setItem('isAuthenticated', 'true')
        localStorage.setItem('userRole', result.role || 'company')
        
        // Очищаем кэш hh.ru кодов
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('hh_code_')) {
            localStorage.removeItem(key)
          }
        })
        
        // Перенаправляем на страницу логина
        navigate('/company-login', { 
          state: { message: 'Регистрация через hh.ru завершена успешно! Теперь войдите в систему.' }
        })
      } else {
        setError(result.error || 'Ошибка при завершении регистрации')
      }
    } catch (err) {
      setError('Ошибка регистрации. Попробуйте снова.')
    } finally {
      setIsLoading(false)
    }
  }

  // Убираем проверку загрузки для демонстрации

  return (
    <div className="min-h-screen bg-dark-950 relative overflow-hidden">
      {/* Стильный фон */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Градиентная сетка */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }}
        ></div>
        
        {/* Диагональные линии */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div 
            className="absolute w-full h-px opacity-20"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.5), transparent)',
              top: '20%',
              transform: 'rotate(-45deg) translateY(-50%)',
              transformOrigin: 'center'
            }}
          ></div>
          <div 
            className="absolute w-full h-px opacity-15"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.4), transparent)',
              top: '60%',
              transform: 'rotate(45deg) translateY(-50%)',
              transformOrigin: 'center'
            }}
          ></div>
        </div>
        
        {/* Геометрические формы */}
        <div className="absolute top-1/4 left-8 w-2 h-2 bg-accent-blue/20 rounded-full"></div>
        <div className="absolute top-1/3 right-12 w-1 h-1 bg-accent-purple/30 rounded-full"></div>
        <div className="absolute bottom-1/4 left-16 w-1.5 h-1.5 bg-accent-blue/15 rounded-full"></div>
        <div className="absolute bottom-1/3 right-8 w-2 h-2 bg-accent-purple/20 rounded-full"></div>
        
        {/* Тонкие декоративные рамки */}
        <div 
          className="absolute top-20 left-10 w-32 h-24 border border-accent-blue/20 rounded-lg bg-accent-blue/5"
          style={{ transform: 'rotate(15deg)' }}
        ></div>
        <div 
          className="absolute bottom-32 right-16 w-40 h-20 border border-accent-purple/15 rounded-lg bg-accent-purple/3"
          style={{ transform: 'rotate(-12deg)' }}
        ></div>
        
        {/* Радиальные градиенты для глубины */}
        <div 
          className="absolute top-0 left-0 w-96 h-96 opacity-40"
          style={{
            background: 'radial-gradient(circle at top left, rgba(59, 130, 246, 0.02) 0%, transparent 70%)'
          }}
        ></div>
        <div 
          className="absolute bottom-0 right-0 w-96 h-96 opacity-40"
          style={{
            background: 'radial-gradient(circle at bottom right, rgba(139, 92, 246, 0.02) 0%, transparent 70%)'
          }}
        ></div>
      </div>
      
      {/* Основной контент */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-6 py-12">
        <div className="w-full max-w-md mx-auto">
          {/* Форма завершения регистрации */}
          <div className="glass rounded-3xl p-8 border border-dark-600/30">
            <div className="flex items-center justify-between mb-6">
              {/* Стрелка назад */}
              <button 
                onClick={() => navigate('/role-selection')}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-dark-800/50 hover:bg-dark-700/50 text-white transition-all duration-300 hover:scale-105"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {/* Логотипы с соединительной линией */}
              <div className="flex-1 flex justify-center items-center space-x-4">
                <img 
                  src="/hh.png" 
                  alt="hh.ru" 
                  className="w-12 h-12 object-contain rounded-full"
                />
                
                {/* Стрелка с линией */}
                <div className="flex items-center">
                  <div className="w-4 h-px bg-gray-400/50"></div>
                  <svg className="w-5 h-5 text-gray-400 mx-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="w-4 h-px bg-gray-400/50"></div>
                </div>
                
                <img 
                  src="/vtb.png" 
                  alt="VTB" 
                  className="w-12 h-12 object-contain rounded-full"
                />
              </div>
              
              {/* Пустое место для баланса */}
              <div className="w-10"></div>
            </div>
            
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white">Завершение регистрации</h2>
              <p className="text-dark-300 text-sm mt-2">Данные получены из hh.ru</p>
            </div>

            {/* Информация о компании */}
            {companyData && (
              <div className="mb-6 p-4 bg-dark-800/50 border border-dark-600/50 rounded-xl">
                <h3 className="text-white font-medium mb-3">Данные компании:</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-dark-300">Название:</span>
                    <span className="text-white">{companyData.name}</span>
                  </div>
                  {companyData.site_url && (
                    <div className="flex justify-between">
                      <span className="text-dark-300">Сайт:</span>
                      <span className="text-white">{companyData.site_url}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-dark-300">Вакансий:</span>
                    <span className="text-white">{companyData.vacancies_count}</span>
                  </div>
                  {companyData.area && (
                    <div className="flex justify-between">
                      <span className="text-dark-300">Город:</span>
                      <span className="text-white">{companyData.area.name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Индикатор загрузки данных */}
            {isLoadingData && (
              <div className="mb-6 p-4 bg-dark-800/50 border border-dark-600/50 rounded-xl text-center">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-white text-sm">Получение данных компании...</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Пароль */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Создайте пароль для входа *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                  placeholder="Минимум 6 символов"
                />
              </div>

              {/* Подтверждение пароля */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Подтвердите пароль *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                  placeholder="Повторите пароль"
                />
              </div>

              {/* Ошибка */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Кнопка завершения регистрации */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 disabled:from-dark-700 disabled:to-dark-700 text-white rounded-xl font-medium transition-colors duration-300 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Завершение регистрации...</span>
                  </div>
                ) : (
                  'Завершить регистрацию'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HhRedirectPage
