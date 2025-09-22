import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const RoleSelectionPage: React.FC = () => {
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState<'candidate' | 'company' | null>(null)

  const handleRoleSelect = (role: 'candidate' | 'company') => {
    setSelectedRole(role)
  }

  const handleLogin = () => {
    if (selectedRole === 'candidate') {
      navigate('/login')
    } else if (selectedRole === 'company') {
      navigate('/company-login')
    }
  }

  const handleRegister = () => {
    if (selectedRole === 'candidate') {
      navigate('/register')
    } else if (selectedRole === 'company') {
      navigate('/company-register')
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
      <div className="relative z-10 flex items-center justify-center min-h-screen px-6">
        <div className="w-full max-w-md mx-auto">
          {/* Форма выбора роли */}
          <div className="glass rounded-3xl p-8 border border-dark-600/30">
            <div className="flex items-center justify-between mb-6">
              {/* Стрелка назад */}
              <button 
                onClick={() => navigate('/')}
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
            
            <div className="text-center mb-6">
              <h2 className="text-lg text-dark-300">Выберите ваш профиль</h2>
            </div>
            <div className="space-y-6">
              {/* Профиль соискателя */}
              <div 
                onClick={() => handleRoleSelect('candidate')}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
                  selectedRole === 'candidate' 
                    ? 'border-accent-blue/70 bg-accent-blue/10' 
                    : 'border-dark-600/30 hover:border-accent-blue/50'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent-blue to-blue-600 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Я ищу работу</h3>
                    <p className="text-sm text-gray-300">Профиль соискателя</p>
                  </div>
                </div>
              </div>

              {/* Профиль работодателя */}
              <div 
                onClick={() => handleRoleSelect('company')}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
                  selectedRole === 'company' 
                    ? 'border-accent-purple/70 bg-accent-purple/10' 
                    : 'border-dark-600/30 hover:border-accent-purple/50'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent-purple to-purple-600 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Я ищу сотрудников</h3>
                    <p className="text-sm text-gray-300">Профиль работодателя</p>
                  </div>
                </div>
              </div>

              {/* Кнопка входа */}
              <button 
                onClick={handleLogin}
                disabled={!selectedRole}
                className={`w-full px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                  selectedRole
                    ? 'bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/90 hover:to-accent-purple/90 text-white cursor-pointer'
                    : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                }`}
              >
                Войти
              </button>

              {/* Кнопка регистрации */}
              <button 
                onClick={handleRegister}
                disabled={!selectedRole}
                className={`w-full px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                  selectedRole
                    ? 'bg-dark-700/80 hover:bg-dark-600/80 text-white cursor-pointer border border-dark-600/50 hover:border-dark-500/50'
                    : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                }`}
              >
                Зарегистрироваться
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RoleSelectionPage
