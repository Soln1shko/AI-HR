import React from 'react';
import { getCandidateTopicAnalytics } from '../utils/interviewAnalytics';
import { TopicAnalyticsDashboard } from './TopicCharts';

interface CandidateDashboardProps {
  candidate: any;
}

// Компонент для отображения радиального прогресс-бара
const RadialProgress: React.FC<{ value: number; max: number; color: string; label: string }> = ({ 
  value, 
  max, 
  color, 
  label 
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
          {/* Фоновый круг */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-dark-600"
          />
          {/* Прогресс круг */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`transition-all duration-1000 ease-out ${color}`}
          />
        </svg>
        {/* Текст в центре */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-white">{Math.round(percentage)}%</span>
        </div>
      </div>
      <span className="text-xs text-dark-300 mt-2 text-center">{label}</span>
    </div>
  );
};


// Функция для перевода названий оценок речи на русский язык
const translateVoiceScoreName = (scoreName: string): string => {
  const translations: Record<string, string> = {
    'confidence': 'Уверенность',
    'stress_resistance': 'Стрессоустойчивость', 
    'communication': 'Коммуникация',
    'energy': 'Энергичность'
  };
  
  return translations[scoreName] || scoreName;
};

// Компонент для отображения голосового анализа
const VoiceAnalysisChart: React.FC<{ voiceAnalysis: any }> = ({ voiceAnalysis }) => {
  if (!voiceAnalysis) return null;

  const scores = voiceAnalysis.scores || {};
  const tags = voiceAnalysis.tags || [];

  return (
    <div className="space-y-4">
      {/* Оценки */}
      {Object.keys(scores).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-white mb-3">Оценки речи</h4>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(scores).map(([key, value]: [string, any]) => (
              <div key={key} className="bg-dark-700/30 p-3 rounded-lg">
                <div className="text-xs text-dark-400 mb-1">{translateVoiceScoreName(key)}</div>
                <div className="flex items-center">
                  <div className="flex-1 bg-dark-600 rounded-full h-2 mr-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(value, 100)}%` }}
                    ></div>
                  </div>
                  <span className={`text-xs font-medium ${
                    value >= 70 ? 'text-green-400' : value >= 40 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {value}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Теги */}
      {tags.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-white mb-3">Характеристики речи</h4>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag: string, index: number) => (
              <span 
                key={index}
                className="px-2 py-1 bg-accent-blue/20 text-accent-blue text-xs rounded-full border border-accent-blue/30"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const CandidateDashboard: React.FC<CandidateDashboardProps> = ({ candidate }) => {
  // Временная отладка
  console.log('CandidateDashboard получил данные:', {
    candidateName: candidate.user_name,
    hasInterviewAnalysis: !!candidate.interview_analysis,
    interviewAnalysisType: typeof candidate.interview_analysis,
    interviewAnalysisLength: candidate.interview_analysis ? candidate.interview_analysis.length : 0
  });

  // Извлекаем данные для дэшборда
  const resumeScore = candidate.resume_score || 0;
  
  // Функция для извлечения оценки из текста отчета
  const extractScoreFromReport = (reportText: string): number => {
    if (!reportText) return 0;
    
    // Ищем паттерн "🎯 ОБЩАЯ ОЦЕНКА: XX.X%"
    const scoreMatch = reportText.match(/🎯\s*ОБЩАЯ\s*ОЦЕНКА:\s*(\d+(?:\.\d+)?)%/i);
    if (scoreMatch && scoreMatch[1]) {
      return parseFloat(scoreMatch[1]);
    }
    
    // Альтернативный поиск без эмодзи
    const altScoreMatch = reportText.match(/ОБЩАЯ\s*ОЦЕНКА:\s*(\d+(?:\.\d+)?)%/i);
    if (altScoreMatch && altScoreMatch[1]) {
      return parseFloat(altScoreMatch[1]);
    }
    
    return 0;
  };

  // Функция для извлечения общей характеристики из отчета
  const getOverallAssessment = (interviewAnalysis: any): string | null => {
    if (!interviewAnalysis) return null;
    
    // Если interviewAnalysis - это строка (текстовый отчет)
    if (typeof interviewAnalysis === 'string') {
      // Ищем паттерн "📄 ОБЩАЯ ХАРАКТЕРИСТИКА:" и текст после него
      const assessmentMatch = interviewAnalysis.match(/📄 ОБЩАЯ ХАРАКТЕРИСТИКА:\s*\n(.*?)(?=\n\n|✅|⚠️|🔧|🔍|🚨|📚|💼|⚠️|🚀|$)/s);
      if (assessmentMatch) {
        return assessmentMatch[1].trim();
      }
    }
    
    return null;
  };

  // Получаем AI оценку интервью из interview_analysis
  let aiInterviewScore = 0;
  
  // Сначала пробуем получить из числовых полей
  if (candidate.interview_analysis?.final_score && candidate.interview_analysis.final_score > 0) {
    aiInterviewScore = candidate.interview_analysis.final_score;
  } else if (candidate.interview_analysis?.score && candidate.interview_analysis.score > 0) {
    aiInterviewScore = candidate.interview_analysis.score;
  } else if (candidate.interview_result?.final_score && candidate.interview_result.final_score > 0) {
    aiInterviewScore = candidate.interview_result.final_score;
  } else if (candidate.interview_result?.score && candidate.interview_result.score > 0) {
    aiInterviewScore = candidate.interview_result.score;
  } else {
    // Если числовых полей нет, парсим из текста отчета
    const reportText = candidate.interview_result?.report || candidate.interview_analysis?.report || '';
    aiInterviewScore = extractScoreFromReport(reportText);
  }
  
  const answers = candidate.answers || [];
  
  // Отладочная информация
  console.log('Данные кандидата для дэшборда:', {
    candidate,
    resumeScore,
    aiInterviewScore,
    interview_result: candidate.interview_result,
    interview_analysis: candidate.interview_analysis,
    'interview_analysis.final_score': candidate.interview_analysis?.final_score,
    'interview_analysis.score': candidate.interview_analysis?.score,
    'report_text_preview': (candidate.interview_result?.report || candidate.interview_analysis?.report || '').substring(0, 200) + '...'
  });
  
  // Вычисляем средние значения голосового анализа из всех ответов
  const calculateAverageVoiceAnalysis = (answers: any[]) => {
    if (!answers || answers.length === 0) return null;
    
    const validAnalyses = answers.filter((answer: any) => answer.voice_analysis);
    if (validAnalyses.length === 0) return null;
    
    // Собираем все оценки
    const allScores: Record<string, number[]> = {};
    const allTags: string[] = [];
    
    validAnalyses.forEach((answer: any) => {
      const analysis = answer.voice_analysis;
      
      // Собираем оценки
      if (analysis.scores) {
        Object.entries(analysis.scores).forEach(([key, value]) => {
          if (!allScores[key]) allScores[key] = [];
          allScores[key].push(value as number);
        });
      }
      
      // Собираем теги
      if (analysis.tags) {
        allTags.push(...analysis.tags);
      }
    });
    
    // Вычисляем средние значения
    const averageScores: Record<string, number> = {};
    Object.entries(allScores).forEach(([key, values]) => {
      averageScores[key] = Math.round(values.reduce((sum, val) => sum + val, 0) / values.length);
    });
    
    // Убираем дубликаты тегов и считаем частоту
    const tagFrequency: Record<string, number> = {};
    allTags.forEach(tag => {
      tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
    });
    
    // Берем наиболее частые теги (больше половины ответов)
    const frequentTags = Object.entries(tagFrequency)
      .filter(([_, count]) => count >= Math.ceil(validAnalyses.length / 2))
      .map(([tag, _]) => tag);
    
    // Вычисляем общую оценку
    const overallScore = Object.values(averageScores).length > 0 
      ? Math.round(Object.values(averageScores).reduce((sum, val) => sum + val, 0) / Object.values(averageScores).length)
      : undefined;
    
    return {
      scores: averageScores,
      tags: frequentTags,
      overall_score: overallScore
    };
  };
  
  const voiceAnalysis = calculateAverageVoiceAnalysis(answers);
  
  // Вычисляем среднее значение из показателей речи
  const calculateVoiceAverage = () => {
    if (!voiceAnalysis?.scores) return 0;
    
    const speechMetrics = ['communication', 'confidence', 'energy', 'stress_resistance'];
    const values = speechMetrics
      .map(metric => voiceAnalysis.scores[metric])
      .filter(value => value !== undefined && value !== null);
    
    if (values.length === 0) return 0;
    
    return Math.round(values.reduce((sum, val) => sum + val, 0) / values.length);
  };
  
  const voiceAverageScore = calculateVoiceAverage();
  
  // Подсчитываем статистику
  const totalQuestions = answers.length;
  const answersWithVoiceAnalysis = answers.filter((answer: any) => answer.voice_analysis).length;
  const avgAnswerLength = answers.length > 0 
    ? Math.round(answers.reduce((sum: number, answer: any) => sum + (answer.answer_text?.length || 0), 0) / answers.length)
    : 0;

  // Вычисляем оценку интервью по формуле: 0.8 * общая оценка + 0.2 * резюме
  const calculatedInterviewScore = Math.round(0.8 * aiInterviewScore + 0.2 * resumeScore);
  
  // Определяем общую оценку по новой формуле: 0.2 * резюме + 0.8 * интервью
  const overallScore = Math.round(0.2 * resumeScore + 0.8 * calculatedInterviewScore);
  
  // Определяем уровень кандидата
  const getCandidateLevel = (score: number) => {
    if (score >= 85) return { level: 'Отлично', color: 'text-green-400', bg: 'bg-green-500/20' };
    if (score >= 70) return { level: 'Хорошо', color: 'text-blue-400', bg: 'bg-blue-500/20' };
    if (score >= 55) return { level: 'Средне', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    if (score >= 40) return { level: 'Слабо', color: 'text-orange-400', bg: 'bg-orange-500/20' };
    return { level: 'Плохо', color: 'text-red-400', bg: 'bg-red-500/20' };
  };

  const candidateLevel = getCandidateLevel(overallScore);

  return (
    <div className="space-y-6">
      {/* Заголовок с общей информацией */}
      <div className="bg-gradient-to-r from-dark-800/50 to-dark-700/50 p-6 rounded-2xl border border-dark-600/30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Аналитический дэшборд</h3>
            <p className="text-dark-300">Комплексная оценка кандидата</p>
          </div>
          <div className={`px-4 py-2 rounded-lg ${candidateLevel.bg} ${candidateLevel.color}`}>
            <span className="font-semibold">{candidateLevel.level}</span>
          </div>
        </div>
        
        {/* Основные метрики */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-white mb-1">{overallScore}%</div>
            <div className="text-sm text-dark-300">Общая оценка</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-white mb-1">{resumeScore}%</div>
            <div className="text-sm text-dark-300">Резюме</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-white mb-1">
              {aiInterviewScore > 0 ? `${Math.round(aiInterviewScore)}%` : 'N/A'}
            </div>
            <div className="text-sm text-dark-300">Интервью</div>
            {aiInterviewScore === 0 && (
              <div className="text-xs text-dark-400 mt-1">Не завершено</div>
            )}
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-white mb-1">{totalQuestions}</div>
            <div className="text-sm text-dark-300">Вопросов</div>
          </div>
        </div>
      </div>

      {/* Детальная аналитика */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Оценки навыков */}
        <div className="bg-dark-800/50 p-6 rounded-2xl border border-dark-600/30">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-white flex items-center">
              <svg className="w-5 h-5 mr-2 text-accent-blue" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
              </svg>
              Оценки навыков
            </h4>
            <div className="text-xs text-dark-400 bg-dark-700/50 px-2 py-1 rounded">
              Резюме • Интервью • Общая • Речь
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 py-8">
            <div className="flex justify-center items-center h-32">
              <RadialProgress 
                value={resumeScore} 
                max={100} 
                color="text-emerald-500" 
                label="Резюме" 
              />
            </div>
            <div className="flex justify-center items-center h-32">
              <RadialProgress 
                value={aiInterviewScore > 0 ? Math.round(aiInterviewScore) : 0} 
                max={100} 
                color="text-purple-500" 
                label={aiInterviewScore > 0 ? "Интервью" : "Интервью (N/A)"} 
              />
            </div>
            <div className="flex justify-center items-center h-32">
              <RadialProgress 
                value={overallScore} 
                max={100} 
                color="text-accent-blue" 
                label="Общая" 
              />
            </div>
            <div className="flex justify-center items-center h-32">
              <RadialProgress 
                value={voiceAverageScore} 
                max={100} 
                color="text-orange-500" 
                label={voiceAverageScore > 0 ? "Речь" : "Речь (N/A)"} 
              />
            </div>
          </div>
        </div>

        {/* Голосовой анализ */}
        <div className="bg-dark-800/50 p-6 rounded-2xl border border-dark-600/30">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-white flex items-center">
              <svg className="w-5 h-5 mr-2 text-accent-blue" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
              Анализ речи
            </h4>
            {voiceAnalysis && (
              <div className="text-xs text-dark-400 bg-dark-700/50 px-2 py-1 rounded">
                Среднее из {answersWithVoiceAnalysis} ответов
              </div>
            )}
          </div>
          {voiceAnalysis ? (
            <VoiceAnalysisChart voiceAnalysis={voiceAnalysis} />
          ) : (
            <div className="text-center py-8">
              <p className="text-dark-300">Данные голосового анализа недоступны</p>
              {totalQuestions > 0 && (
                <p className="text-dark-400 text-sm mt-2">
                  Из {totalQuestions} ответов ни один не содержит голосового анализа
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Статистика ответов */}
      <div className="bg-dark-800/50 p-6 rounded-2xl border border-dark-600/30">
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-accent-blue" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z"/>
          </svg>
          Статистика интервью
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-2">{totalQuestions}</div>
            <div className="text-sm text-dark-300">Всего вопросов</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-2">{avgAnswerLength}</div>
            <div className="text-sm text-dark-300">Средняя длина ответа</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-2">
              {candidate.status === 'completed' ? 'Завершено' : 
               candidate.status === 'active' ? 'В процессе' : 
               candidate.status === 'rejected' ? 'Отклонено' : 'Неизвестно'}
            </div>
            <div className="text-sm text-dark-300">Статус</div>
          </div>
        </div>
      </div>

      {/* Аналитика по темам */}
      {candidate.interview_analysis && (
        <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 p-6 rounded-2xl border border-green-500/30">
          <h4 className="text-lg font-semibold text-white mb-6 flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16,6L18.29,8.29L13.41,13.17L9.41,9.17L2,16.59L3.41,18L9.41,12L13.41,16L19.71,9.71L22,12V6H16Z"/>
            </svg>
            Аналитика по темам
          </h4>
          {(() => {
            const analytics = getCandidateTopicAnalytics(candidate);
            console.log('Аналитика по темам для кандидата:', {
              candidateName: candidate.user_name,
              topicsCount: analytics.topics.length,
              topics: analytics.topics,
              averageByTopic: analytics.averageByTopic
            });
            return (
              <TopicAnalyticsDashboard 
                analytics={analytics}
                candidateName={candidate.user_name}
              />
            );
          })()}
        </div>
      )}

      {/* Рекомендация AI */}
      {candidate.interview_result?.recommendation && (
        <div className="bg-gradient-to-r from-accent-blue/10 to-purple-500/10 p-6 rounded-2xl border border-accent-blue/30">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-accent-blue" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z"/>
            </svg>
            Рекомендация AI
          </h4>
          <div className="bg-dark-800/50 p-4 rounded-lg">
            <p className="text-dark-300 leading-relaxed">
              {getOverallAssessment(candidate.interview_analysis) || 
               (typeof candidate.interview_result.recommendation === 'string' 
                ? candidate.interview_result.recommendation 
                : JSON.stringify(candidate.interview_result.recommendation, null, 2))
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidateDashboard;
