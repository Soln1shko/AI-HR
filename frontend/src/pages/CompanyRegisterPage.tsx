import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { registerCompany, CompanyRegisterData } from '../services/api'

const CompanyRegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<CompanyRegisterData>({
    companyName: '',
    inn: '',
    ogrn: '',
    website: '',
    legalAddress: '',
    actualAddress: '',
    contactPersonName: '',
    contactPersonPosition: '',
    email: '',
    phone: '',
    password: '',
    description: '',
  })
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const totalSteps = 4

  const steps = [
    {
      title: 'Основная информация',
      fields: ['companyName', 'inn', 'ogrn'],
      optionalFields: ['website']
    },
    {
      title: 'Адреса',
      fields: ['legalAddress'],
      optionalFields: ['actualAddress']
    },
    {
      title: 'Контактные данные',
      fields: ['email', 'password'],
      optionalFields: ['contactPersonName', 'contactPersonPosition', 'phone']
    },
    {
      title: 'Описание',
      fields: [],
      optionalFields: ['description']
    }
  ]

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateStep = (step: number): boolean => {
    const stepData = steps[step - 1]
    const requiredFields = stepData.fields
    const newErrors: Record<string, string> = {}

    // Проверяем только обязательные поля
    requiredFields.forEach(field => {
      if (field === 'password') {
        if (!formData.password) {
          newErrors.password = 'Пароль обязателен'
        } else if (formData.password.length < 6) {
          newErrors.password = 'Пароль должен содержать минимум 6 символов'
        } else if (formData.password !== confirmPassword) {
          newErrors.password = 'Пароли не совпадают'
        }
      } else if (field === 'email') {
        if (!formData.email) {
      newErrors.email = 'Email обязателен'
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Некорректный email'
    }
      } else if (field === 'inn') {
        if (!formData.inn) {
          newErrors.inn = 'ИНН обязателен'
        } else if (!/^\d{10}$/.test(formData.inn)) {
          newErrors.inn = 'ИНН должен содержать 10 цифр'
        }
      } else if (field === 'ogrn') {
        if (!formData.ogrn) {
          newErrors.ogrn = 'ОГРН обязателен'
        } else if (!/^\d{13}$/.test(formData.ogrn)) {
          newErrors.ogrn = 'ОГРН должен содержать 13 цифр'
        }
      } else if (field === 'phone') {
        if (!formData.phone) {
      newErrors.phone = 'Телефон обязателен'
        } else if (!/^\+?[1-9]\d{1,14}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Некорректный номер телефона'
    }
      } else {
        if (!formData[field as keyof CompanyRegisterData]) {
          newErrors[field] = 'Поле обязательно'
        }
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps))
    }
  }

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateStep(currentStep)) {
      return
    }

    setIsSubmitting(true)
    try {
      const response = await registerCompany(formData)
      
      if (response.success) {
        navigate('/company-login')
      } else {
        setErrors({ submit: response.error || 'Ошибка регистрации' })
      }
    } catch (error) {
      setErrors({ submit: 'Ошибка регистрации. Попробуйте снова.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            {/* Название компании */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Название компании *
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => handleInputChange('companyName', e.target.value)}
                className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                placeholder="ООО 'Название компании'"
              />
              {errors.companyName && <p className="text-red-400 text-sm mt-1">{errors.companyName}</p>}
            </div>

            {/* ИНН */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                ИНН *
              </label>
              <input
                type="text"
                value={formData.inn}
                onChange={(e) => handleInputChange('inn', e.target.value)}
                className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                placeholder="1234567890"
                maxLength={10}
              />
              {errors.inn && <p className="text-red-400 text-sm mt-1">{errors.inn}</p>}
            </div>

            {/* ОГРН */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                ОГРН *
              </label>
              <input
                type="text"
                value={formData.ogrn}
                onChange={(e) => handleInputChange('ogrn', e.target.value)}
                className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                placeholder="1234567890123"
                maxLength={13}
              />
              {errors.ogrn && <p className="text-red-400 text-sm mt-1">{errors.ogrn}</p>}
            </div>

            {/* Веб-сайт */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Веб-сайт
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
                className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                placeholder="https://example.com"
              />
            </div>
          </div>
        )

      case 2:
    return (
          <div className="space-y-6">
            {/* Юридический адрес */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Юридический адрес *
              </label>
              <textarea
                value={formData.legalAddress}
                onChange={(e) => handleInputChange('legalAddress', e.target.value)}
                className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors resize-none"
                placeholder="Полный юридический адрес компании"
                rows={3}
              />
              {errors.legalAddress && <p className="text-red-400 text-sm mt-1">{errors.legalAddress}</p>}
            </div>

            {/* Фактический адрес */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Фактический адрес
              </label>
              <textarea
                value={formData.actualAddress}
                onChange={(e) => handleInputChange('actualAddress', e.target.value)}
                className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors resize-none"
                placeholder="Фактический адрес (если отличается от юридического)"
                rows={3}
              />
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            {/* Контактное лицо */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Контактное лицо
              </label>
              <input
                type="text"
                value={formData.contactPersonName}
                onChange={(e) => handleInputChange('contactPersonName', e.target.value)}
                className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                placeholder="ФИО контактного лица"
              />
              {errors.contactPersonName && <p className="text-red-400 text-sm mt-1">{errors.contactPersonName}</p>}
            </div>

            {/* Должность */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Должность
              </label>
              <input
                type="text"
                value={formData.contactPersonPosition}
                onChange={(e) => handleInputChange('contactPersonPosition', e.target.value)}
                className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                placeholder="Должность контактного лица"
              />
              {errors.contactPersonPosition && <p className="text-red-400 text-sm mt-1">{errors.contactPersonPosition}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                placeholder="company@example.com"
              />
              {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
            </div>

            {/* Телефон */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Телефон
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                placeholder="+7 (999) 123-45-67"
              />
              {errors.phone && <p className="text-red-400 text-sm mt-1">{errors.phone}</p>}
            </div>

            {/* Пароль */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Пароль *
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors"
                placeholder="Минимум 6 символов"
              />
              {errors.password && <p className="text-red-400 text-sm mt-1">{errors.password}</p>}
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
      </div>
    )

      case 4:
    return (
          <div className="space-y-6">
            {/* Описание */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Описание компании
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50 transition-colors resize-none"
                placeholder="Краткое описание деятельности компании, особенности работы, ценности..."
                rows={4}
              />
            </div>

            {/* Кнопка входа через hh.ru */}
            <div>
            <button
                type="button"
                className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 flex items-center justify-center space-x-3"
              >
                <img
                  src="/hh.png"
                  alt="hh.ru"
                  className="w-6 h-6 object-contain rounded-full"
                />
                <span>Войти через hh.ru</span>
            </button>
        </div>
      </div>
    )

      default:
        return null
    }
  }

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
          {/* Форма регистрации */}
        <div className="glass rounded-3xl p-8 border border-dark-600/30">
            <div className="flex items-center justify-between mb-6">
              {/* Стрелка назад */}
              <button 
                onClick={currentStep === 1 ? () => navigate('/role-selection') : handlePrev}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-dark-800/50 hover:bg-dark-700/50 text-white transition-all duration-300 hover:scale-105"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {/* Логотип компании */}
              <div className="flex-1 flex justify-center">
                <img 
                  src="/vtb.png" 
                  alt="VTB Logo" 
                  className="w-12 h-12 object-contain rounded-full"
                />
                </div>

              {/* Пустое место для баланса */}
              <div className="w-10"></div>
                </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white">Поиск сотрудников</h2>
                </div>

            {/* Прогресс-бар */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-dark-300">Шаг {currentStep} из {totalSteps}</span>
                <span className="text-sm text-dark-300">{Math.round((currentStep / totalSteps) * 100)}%</span>
                </div>
              <div className="w-full bg-dark-700/50 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-accent-blue to-accent-purple h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-2">
                {steps.map((step, index) => (
                  <div key={index} className="text-center">
                    <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${
                      index + 1 <= currentStep ? 'bg-accent-blue' : 'bg-dark-600'
                    }`}></div>
                    <span className={`text-xs ${
                      index + 1 <= currentStep ? 'text-accent-blue' : 'text-dark-400'
                    }`}>
                      {step.title}
                    </span>
              </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {renderStepContent()}

              {/* Ошибка */}
              {errors.submit && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-red-400 text-sm">{errors.submit}</p>
                </div>
              )}

              {/* Кнопки навигации */}
              <div className="space-y-4 pt-4">
                <div className="flex space-x-4">
                  {currentStep > 1 && (
              <button
                type="button"
                      onClick={handlePrev}
                      className="px-8 py-3 bg-dark-700/50 hover:bg-dark-600/50 text-white rounded-xl font-medium transition-all duration-300 hover:scale-105"
              >
                Назад
              </button>
                  )}
                  
                  {currentStep < totalSteps ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="flex-1 px-8 py-3 bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 text-white rounded-xl font-medium transition-colors duration-300"
                    >
                      Далее
                    </button>
                  ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex-1 px-8 py-3 rounded-xl font-medium transition-all ${
                  isSubmitting
                    ? 'bg-dark-600 text-dark-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-accent-blue to-accent-purple text-white hover:scale-105 hover:shadow-xl hover:shadow-accent-blue/20'
                }`}
              >
                      {isSubmitting ? 'Отправка...' : 'Зарегистрироваться'}
                    </button>
                  )}
                </div>

                {/* Кнопка входа через hh.ru только на первом этапе */}
                {currentStep === 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      // OAuth авторизация через hh.ru
                      const state = Math.random().toString(36).substring(7)
                      localStorage.setItem('oauth_state', state)
                      
                      const authUrl = `https://hh.ru/oauth/authorize?` +
                        `response_type=code&` +
                        `client_id=ВАШ_ID` +
                        `redirect_uri=${encodeURIComponent('http://localhost:3000/hh-redirect')}&` +
                        `scope=employer&` +
                        `state=${state}`
                      window.location.href = authUrl
                    }}
                    className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors duration-300 flex items-center justify-center space-x-3"
                  >
                    <img
                      src="/hh.png"
                      alt="hh.ru"
                      className="w-6 h-6 object-contain rounded-full"
                    />
                    <span>Войти через hh.ru</span>
              </button>
                )}
            </div>
          </form>
        </div>
      </div>
      </div>
    </div>
  )
}

export default CompanyRegisterPage
