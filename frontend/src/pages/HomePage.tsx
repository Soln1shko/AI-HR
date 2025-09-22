import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Spline from '@splinetool/react-spline'

const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const [isVisible, setIsVisible] = useState({
    hero: false,
    features: false,
    candidates: false,
    companies: false,
    about: false,
    examples: false,
    dashboards: false,
    technical: false,
    actions: false
  })

  useEffect(() => {
    // Небольшая задержка для первого элемента при загрузке
    const initialTimeout = setTimeout(() => {
      setIsVisible(prev => ({ ...prev, hero: true }))
    }, 200)

    // Intersection Observer для анимации при скролле
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const section = entry.target.getAttribute('data-section')
            if (section && section !== 'hero') {
              // Добавляем небольшую задержку для плавности
              setTimeout(() => {
                setIsVisible(prev => ({ ...prev, [section]: true }))
              }, 100)
            }
          }
        })
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
      }
    )

    // Наблюдаем за всеми секциями кроме hero
    const sections = document.querySelectorAll('[data-section]:not([data-section="hero"])')
    sections.forEach(section => observer.observe(section))

    return () => {
      clearTimeout(initialTimeout)
      observer.disconnect()
    }
  }, [])

  const handleLoginClick = () => {
    navigate('/role-selection')
  }

  const handleRegisterClick = () => {
    navigate('/role-selection')
  }

  const handleCompanyRegisterClick = () => {
    navigate('/company-register')
  }

  return (
    <div className="min-h-screen bg-dark-950 text-white relative overflow-hidden">
      {/* Фоновые элементы */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-48 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.04) 30%, rgba(59, 130, 246, 0.01) 60%, transparent 100%)', filter: 'blur(60px)' }}></div>
        <div className="absolute top-1/3 -right-48 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, rgba(168, 85, 247, 0.04) 30%, rgba(168, 85, 247, 0.01) 60%, transparent 100%)', filter: 'blur(60px)' }}></div>
      </div>

      {/* TopPanel */}
      <div className="fixed top-0 left-0 right-0 z-50 p-6">
        <div className="glass rounded-2xl px-8 py-4 w-full">
          <div className="flex items-center justify-between">
            {/* Логотип/название */}
            <div className="flex items-center space-x-3">
              <img
                src="/vtb.png"
                alt="VTB Logo"
                className="w-10 h-10 object-contain rounded-lg"
              />
              <h1 className="text-xl font-semibold text-white tracking-tight">MORE.tech</h1>
            </div>

            {/* Кнопки авторизации */}
            <div className="flex items-center space-x-4">
              <button
                onClick={handleLoginClick}
                className="px-6 py-2.5 bg-dark-800/50 hover:bg-dark-700/50 text-white border border-dark-600/50 hover:border-dark-500/50 rounded-xl font-medium transition-all duration-300 hover:scale-105 focus:outline-none"
              >
                Войти
              </button>
              <button
                onClick={handleRegisterClick}
                className="px-6 py-2.5 bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 shadow-lg shadow-accent-blue/25 focus:outline-none"
              >
                Регистрация
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Основной контент */}
      <div className="relative z-10 pt-40 pb-20 px-6">
        <div className="w-full max-w-6xl mx-auto">
          
          {/* Заголовок */}
          <div 
            data-section="hero"
            className={`text-center mb-16 transition-all duration-1000 transform ${
              isVisible.hero 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-8'
            }`}
          >
            <h1 className="text-6xl font-bold mb-6 text-white">
              AI-HR
            </h1>
            <p className="text-2xl text-dark-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Революционная HR-платформа для цифрового рекрутинга с использованием искусственного интеллекта
            </p>
            <div className="w-32 h-px bg-gradient-to-r from-transparent via-white to-transparent mx-auto"></div>
          </div>

          {/* Основные возможности */}
          <div 
            data-section="features"
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 transition-all duration-1000 transform ${
              isVisible.features 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-8'
            }`}
          >
            <div className="glass rounded-2xl p-6 border border-dark-600/30 hover:border-accent-blue/30 transition-all duration-300 group">
              <div className="w-12 h-12 bg-gradient-to-br from-accent-blue/20 to-blue-600/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6 text-accent-blue" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">ИИ-Интервью</h3>
              <p className="text-dark-300 text-sm leading-relaxed">
                6 агентная система с адаптивным управлением и 6-критериальной оценкой
              </p>
            </div>

            <div className="glass rounded-2xl p-6 border border-dark-600/30 hover:border-accent-purple/30 transition-all duration-300 group">
              <div className="w-12 h-12 bg-gradient-to-br from-accent-purple/20 to-purple-600/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6 text-accent-purple" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">Голосовой Анализ</h3>
              <p className="text-dark-300 text-sm leading-relaxed">
                WebSocket анализ речи в реальном времени с Whisper транскрипцией
              </p>
            </div>

            <div className="glass rounded-2xl p-6 border border-dark-600/30 hover:border-green-500/30 transition-all duration-300 group">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">Job Matching</h3>
              <p className="text-dark-300 text-sm leading-relaxed">
                Автоматическая оценка соответствия резюме требованиям вакансии
              </p>
            </div>

            <div className="glass rounded-2xl p-6 border border-dark-600/30 hover:border-yellow-500/30 transition-all duration-300 group">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">RAG Система</h3>
              <p className="text-dark-300 text-sm leading-relaxed">
                База знаний с 99+ вопросами и семантический поиск через ChromaDB
              </p>
            </div>
          </div>

          {/* Возможности для кандидатов и компаний */}
          <div 
            data-section="candidates"
            className={`grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16 transition-all duration-1000 transform ${
              isVisible.candidates
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-8'
            }`}
          >
            {/* Для кандидатов */}
            <div className="glass rounded-2xl p-8 border border-dark-600/30">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-3">Для кандидатов</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-accent-blue rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Управление профилем</h3>
                    <p className="text-dark-300 text-sm">Редактирование данных, загрузка резюме, отслеживание заявок</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-accent-blue rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Умный поиск вакансий</h3>
                    <p className="text-dark-300 text-sm">Фильтрация по уровню, цветовое кодирование Junior/Middle/Senior</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-accent-blue rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="text-white font-medium mb-1">ИИ-проверка резюме</h3>
                    <p className="text-dark-300 text-sm">Анализ соответствия требованиям с возможностью редактирования</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-accent-blue rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Голосовые интервью</h3>
                    <p className="text-dark-300 text-sm">Real-time анализ речи и ИИ-обратная связь</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-accent-blue rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Транскрипция интервью</h3>
                    <p className="text-dark-300 text-sm">Автоматическая расшифровка ваших ответов</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-accent-blue rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Трекинг заявок</h3>
                    <p className="text-dark-300 text-sm">Мониторинг статуса с уведомлениями и фильтрами</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-accent-blue rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Детальная обратная связь</h3>
                    <p className="text-dark-300 text-sm">Подробный анализ ваших ответов с рекомендациями</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Для компаний */}
            <div className="glass rounded-2xl p-8 border border-dark-600/30">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-3">Для HR/Компаний</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-accent-purple rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Управление кандидатами</h3>
                    <p className="text-dark-300 text-sm">Полный анализ с резюме, результатами интервью и голосового анализа</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-accent-purple rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Детальная аналитика</h3>
                    <p className="text-dark-300 text-sm">ИИ-рекомендации и оценки по 6 критериям с обоснованием</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-accent-purple rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Управление заявками</h3>
                    <p className="text-dark-300 text-sm">Изменение статусов с автоматическими уведомлениями кандидатов</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-accent-purple rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Аналитические дэшборды</h3>
                    <p className="text-dark-300 text-sm">Интерактивные графики и статистика по вакансиям, кандидатам и процессу найма</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-accent-purple rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Выгрузка отчетов</h3>
                    <p className="text-dark-300 text-sm">Экспорт детальных отчетов по кандидатам и статистике в различных форматах</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-accent-purple rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Создание вакансий</h3>
                    <p className="text-dark-300 text-sm">Размещение с настройкой требований и кастомных вопросов</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-accent-purple rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Управление профилем</h3>
                    <p className="text-dark-300 text-sm">Настройка данных компании, аватара и контактной информации</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-accent-purple rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Фильтрация кандидатов</h3>
                    <p className="text-dark-300 text-sm">Поиск и фильтрация по различным критериям и статусам</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-accent-purple rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Корпоративный профиль</h3>
                    <p className="text-dark-300 text-sm">Страница в стиле современных HR-платформ</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3D Моделька */}
          <div 
            data-section="about"
            className={`w-full -mx-6 my-8 transition-all duration-1000 transform ${
              isVisible.about 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-8'
            }`}
          >
            <div className="w-full h-[800px] rounded-2xl overflow-hidden relative">
              {/* 3D модель */}
              <Spline scene="https://prod.spline.design/5YB7xt-mmy76YtIK/scene.splinecode" />
              
              {/* Невидимый overlay для блокировки взаимодействий по краям */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Верхняя часть */}
                <div className="absolute top-0 left-0 w-full h-1/4 pointer-events-auto"></div>
                {/* Нижняя часть */}
                <div className="absolute bottom-0 left-0 w-full h-1/4 pointer-events-auto"></div>
                {/* Левая часть */}
                <div className="absolute top-1/4 left-0 w-1/4 h-1/2 pointer-events-auto"></div>
                {/* Правая часть */}
                <div className="absolute top-1/4 right-0 w-1/4 h-1/2 pointer-events-auto"></div>
              </div>
            </div>
          </div>

          {/* Интеграция с HH.ru */}
          <div 
            data-section="examples"
            className={`glass rounded-2xl p-12 border border-dark-600/30 mb-16 transition-all duration-1000 transform ${
              isVisible.examples 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-8'
            }`}
          >
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-6">
                <img 
                  src="/hh.png" 
                  alt="HH.ru Logo" 
                  className="w-16 h-16 object-cover rounded-full"
                />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">Интеграция с HH.ru</h2>
              <p className="text-lg text-dark-300 mb-6">Полная интеграция с API HH.ru для автоматизации HR-процессов</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <h4 className="text-xl font-semibold text-white mb-3">OAuth2 авторизация</h4>
                <p className="text-dark-300 leading-relaxed">
                  Безопасная авторизация через HH.ru с получением токенов доступа для работы с API
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                  </svg>
                </div>
                <h4 className="text-xl font-semibold text-white mb-3">Синхронизация вакансий</h4>
                <p className="text-dark-300 leading-relaxed">
                  Автоматическая синхронизация вакансий компании с HH.ru и парсинг требований, навыков и опыта
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
                  </svg>
                </div>
                <h4 className="text-xl font-semibold text-white mb-3">Управление откликами</h4>
                <p className="text-dark-300 leading-relaxed">
                  Получение и обработка откликов кандидатов с детальной информацией о резюме и статусах
                </p>
              </div>
            </div>
          </div>

          {/* Примеры дэшбордов */}
          <div 
            data-section="dashboards"
            className={`glass rounded-2xl p-12 border border-dark-600/30 mb-16 transition-all duration-1000 transform ${
              isVisible.dashboards 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-8'
            }`}
          >
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-4">Примеры дэшбордов</h2>
              <p className="text-lg text-dark-300 mb-6">Интерактивные аналитические панели для HR</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Дэшборд для HR */}
              <div className="bg-dark-900/80 border border-dark-700/50 rounded-2xl overflow-hidden">
                {/* Заголовок модального окна */}
                <div className="p-6 border-b border-dark-700/50 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-light text-white mb-2">Аналитический дэшборд</h3>
                    <p className="text-dark-400">Комплексная аналитика по кандидатам</p>
                  </div>
                  <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium">
                    Активно
                  </div>
                </div>
                
                <div className="p-6">
                  {/* Основные метрики */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-dark-800/60 p-4 rounded-lg">
                      <p className="text-dark-300 text-sm">Всего кандидатов</p>
                      <p className="text-2xl font-bold text-white mt-1">127</p>
                    </div>
                    <div className="bg-dark-800/60 p-4 rounded-lg">
                      <p className="text-dark-300 text-sm">Средняя оценка</p>
                      <p className="text-2xl font-bold text-white mt-1">78%</p>
                    </div>
                    <div className="bg-dark-800/60 p-4 rounded-lg">
                      <p className="text-dark-300 text-sm">Активные вакансии</p>
                      <p className="text-2xl font-bold text-white mt-1">12</p>
                    </div>
                  </div>

                  {/* Кнопки действий */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Действия</h3>
                    <div className="flex items-center gap-3">
                      <button className="flex items-center space-x-2 px-4 py-2 bg-accent-blue/20 hover:bg-accent-blue/30 border border-accent-blue/30 hover:border-accent-blue/50 text-accent-blue rounded-lg font-medium transition-all duration-300 hover:scale-105">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                        </svg>
                        <span>Скачать отчет</span>
                      </button>
                      <button className="flex items-center space-x-2 px-4 py-2 bg-emerald-500/30 border border-emerald-500/50 text-emerald-400 rounded-lg font-medium transition-all duration-300 hover:scale-105">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                        </svg>
                        <span>Ответы</span>
                      </button>
                      <button className="flex items-center space-x-2 px-4 py-2 bg-purple-500/30 border border-purple-500/50 text-purple-400 rounded-lg font-medium transition-all duration-300 hover:scale-105">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z"/>
                        </svg>
                        <span>Результат</span>
                      </button>
                    </div>
                  </div>

                  {/* График распределения */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-white">Распределение по статусам</h4>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-dark-300 text-xs">Активные</span>
                            <span className="text-white text-xs font-medium">45</span>
                          </div>
                          <div className="w-full bg-dark-700 rounded-full h-1.5">
                            <div className="h-1.5 bg-green-500 rounded-full" style={{ width: '35%' }}></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-dark-300 text-xs">Завершенные</span>
                            <span className="text-white text-xs font-medium">32</span>
                          </div>
                          <div className="w-full bg-dark-700 rounded-full h-1.5">
                            <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: '25%' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Дэшборд для кандидата */}
              <div className="bg-dark-900/80 border border-dark-700/50 rounded-2xl overflow-hidden">
                {/* Заголовок модального окна */}
                <div className="p-6 border-b border-dark-700/50 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-light text-white mb-2">Аналитический дэшборд</h3>
                    <p className="text-dark-400">Комплексная оценка кандидата</p>
                  </div>
                  <div className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium">
                    Хорошо
                  </div>
                </div>
                
                <div className="p-6">
                  {/* Основные метрики */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-white mb-1">85%</div>
                      <div className="text-sm text-dark-300">Общая оценка</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-white mb-1">78%</div>
                      <div className="text-sm text-dark-300">Резюме</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-white mb-1">88%</div>
                      <div className="text-sm text-dark-300">Интервью</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-white mb-1">5</div>
                      <div className="text-sm text-dark-300">Вопросов</div>
                    </div>
                  </div>

                  {/* Оценки навыков с радиальными прогресс-барами */}
                  <div className="bg-dark-800/70 p-6 rounded-2xl border border-dark-700/50">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-white flex items-center">
                        <svg className="w-5 h-5 mr-2 text-accent-blue" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                        </svg>
                        Оценки навыков
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 gap-8 py-4">
                      <div className="flex flex-col items-center h-28">
                        <div className="relative w-20 h-20">
                          <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-dark-600"/>
                            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="none" strokeDasharray="251.2" strokeDashoffset="50.24" strokeLinecap="round" className="text-emerald-500 transition-all duration-1000 ease-out"/>
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-white">78%</span>
                          </div>
                        </div>
                        <span className="text-xs text-dark-300 mt-2 text-center">Резюме</span>
                      </div>
                      <div className="flex flex-col items-center h-28">
                        <div className="relative w-20 h-20">
                          <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-dark-600"/>
                            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="none" strokeDasharray="251.2" strokeDashoffset="30.14" strokeLinecap="round" className="text-accent-blue transition-all duration-1000 ease-out"/>
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-white">88%</span>
                          </div>
                        </div>
                        <span className="text-xs text-dark-300 mt-2 text-center">Интервью</span>
                      </div>
                      <div className="flex flex-col items-center h-28">
                        <div className="relative w-20 h-20">
                          <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-dark-600"/>
                            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="none" strokeDasharray="251.2" strokeDashoffset="37.68" strokeLinecap="round" className="text-accent-purple transition-all duration-1000 ease-out"/>
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-white">85%</span>
                          </div>
                        </div>
                        <span className="text-xs text-dark-300 mt-2 text-center">Общая</span>
                      </div>
                      <div className="flex flex-col items-center h-28">
                        <div className="relative w-20 h-20">
                          <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-dark-600"/>
                            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="none" strokeDasharray="251.2" strokeDashoffset="25.12" strokeLinecap="round" className="text-yellow-500 transition-all duration-1000 ease-out"/>
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-white">90%</span>
                          </div>
                        </div>
                        <span className="text-xs text-dark-300 mt-2 text-center">Речь</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Технические характеристики */}
          <div 
            data-section="technical"
            className={`glass rounded-2xl p-8 border border-dark-600/30 mb-16 transition-all duration-1000 transform ${
              isVisible.technical 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-8'
            }`}
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Технические возможности</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-accent-blue/20 to-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-accent-blue">6</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Агентная система</h3>
                <p className="text-dark-300 text-sm">Специализированные агенты для планирования, селекции вопросов, управления диалогом, оценки ответов, адаптивного контроля и генерации отчетов</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-accent-purple/20 to-purple-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-accent-purple">99+</span>
                </div>
                <h3 className="text-white font-semibold mb-2">База вопросов</h3>
                <p className="text-dark-300 text-sm">Структурированная база знаний с семантическим поиском через ChromaDB и HuggingFace embeddings</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-green-500">6</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Критерии оценки</h3>
                <p className="text-dark-300 text-sm">Техническая точность, глубина знаний, практический опыт, ясность коммуникации, подход к решению задач, примеры использования</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-accent-purple/20 to-purple-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-accent-purple">7</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Статусы заявок</h3>
                <p className="text-dark-300 text-sm">Полный жизненный цикл: Active, Completed, Test Task, Finalist, Offer, Rejected с цветовым кодированием</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-accent-blue/20 to-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-accent-blue">24/7</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Мониторинг</h3>
                <p className="text-dark-300 text-sm">Подробное логирование операций, метрики в реальном времени, отслеживание ресурсов и отладочный режим</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-accent-purple/20 to-purple-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-accent-purple">REST</span>
                </div>
                <h3 className="text-white font-semibold mb-2">API интеграция</h3>
                <p className="text-dark-300 text-sm">FastAPI с автоматической документацией, WebSocket для голосового анализа, полная интеграция с внешними HR-системами</p>
              </div>
            </div>
          </div>

          {/* Кнопки действий */}
          <div 
            data-section="actions"
            className={`text-center transition-all duration-1000 transform ${
              isVisible.actions 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-8'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
              <button
                onClick={handleRegisterClick}
                className="px-8 py-4 bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 text-white rounded-2xl font-semibold text-lg transition-all duration-300 hover:scale-105 shadow-lg shadow-accent-blue/25 focus:outline-none"
              >
                Начать как кандидат
              </button>
              <button
                onClick={handleCompanyRegisterClick}
                className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-500/90 hover:to-emerald-500/90 text-white rounded-2xl font-semibold text-lg transition-all duration-300 hover:scale-105 shadow-lg shadow-green-500/25 focus:outline-none"
              >
                Регистрация компании
              </button>
            </div>
            <p className="text-dark-400 text-sm">
              Уже есть аккаунт? <button onClick={handleLoginClick} className="text-accent-blue hover:text-accent-purple transition-colors font-medium">Войдите в систему</button>
            </p>
          </div>
        </div>
      </div>

      {/* Логотипы партнеров */}
      <div className="relative z-10 pb-8 px-6">
        <div className="w-full max-w-4xl mx-auto text-center">
          <div className="pt-8 border-t border-dark-600/30">
            <p className="text-dark-400 text-sm mb-6">При поддержке</p>
            <div className="flex justify-center items-center space-x-8 opacity-60 hover:opacity-80 transition-opacity duration-300">
              <img
                src="/ВТБ.svg"
                alt="ВТБ"
                className="h-8 w-auto filter brightness-0 invert"
              />
              <img
                src="/ITAM_logo.svg"
                alt="ITAM"
                className="h-8 w-auto filter brightness-0 invert"
              />
              <img
                src="/PHYSTECH GENESIS.svg"
                alt="PHYSTECH GENESIS"
                className="h-8 w-auto filter brightness-0 invert"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
