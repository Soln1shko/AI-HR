import React, { useState } from 'react';
import { downloadVacancyReport } from '../services/api';

interface Candidate {
  _id: string;
  user_name?: string;
  user_email?: string;
  status: string;
  resume_score?: number;
  interview_analysis?: {
    final_score?: number;
    score?: number;
    report?: string;
  };
  interview_result?: {
    final_score?: number;
    score?: number;
    report?: string;
  };
  answers?: Array<{
    voice_analysis?: {
      scores?: Record<string, number>;
      tags?: string[];
    };
  }>;
  vacancy_title?: string;
  vacancy_grade?: string;
}

interface CompanyDashboardProps {
  candidates: Candidate[];
  vacancies: Array<{
    _id: string;
    title: string;
    grade: string;
  }>;
}

// Функция для извлечения оценки из отчёта
const extractScoreFromReport = (reportText: string): number => {
  if (!reportText) return 0;
  const scoreMatch = reportText.match(/🎯\s*ОБЩАЯ\s*ОЦЕНКА:\s*(\d+(?:\.\d+)?)%/i);
  if (scoreMatch && scoreMatch[1]) {
    return parseFloat(scoreMatch[1]);
  }
  const altScoreMatch = reportText.match(/ОБЩАЯ\s*ОЦЕНКА:\s*(\d+(?:\.\d+)?)%/i);
  if (altScoreMatch && altScoreMatch[1]) {
    return parseFloat(altScoreMatch[1]);
  }
  return 0;
};

// Функция для получения оценки интервью кандидата
const getInterviewScore = (candidate: Candidate): number => {
  if (candidate.interview_analysis?.final_score && candidate.interview_analysis.final_score > 0) {
    return candidate.interview_analysis.final_score;
  } else if (candidate.interview_analysis?.score && candidate.interview_analysis.score > 0) {
    return candidate.interview_analysis.score;
  } else if (candidate.interview_result?.final_score && candidate.interview_result.final_score > 0) {
    return candidate.interview_result.final_score;
  } else if (candidate.interview_result?.score && candidate.interview_result.score > 0) {
    return candidate.interview_result.score;
  } else {
    const reportText = candidate.interview_result?.report || candidate.interview_analysis?.report || '';
    return extractScoreFromReport(reportText);
  }
};

// Функция для получения общей оценки кандидата
const getOverallScore = (candidate: Candidate): number => {
  const resumeScore = candidate.resume_score || 0;
  const aiInterviewScore = getInterviewScore(candidate);
  const calculatedInterviewScore = Math.round(0.8 * aiInterviewScore + 0.2 * resumeScore);
  return Math.round(0.2 * resumeScore + 0.8 * calculatedInterviewScore);
};

// Компонент для отображения статистики
const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}> = ({ title, value, subtitle, icon, color, trend }) => (
  <div className="bg-dark-800/50 border border-dark-600/30 rounded-xl p-6 hover:border-dark-500/50 transition-all duration-300">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-lg ${color}`}>
        {icon}
      </div>
      {trend && (
        <div className={`text-sm font-medium ${trend.isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {trend.isPositive ? '+' : ''}{trend.value}%
        </div>
      )}
    </div>
    <div>
      <h3 className="text-2xl font-bold text-white mb-1">{value}</h3>
      <p className="text-dark-400 text-sm">{title}</p>
      {subtitle && <p className="text-dark-500 text-xs mt-1">{subtitle}</p>}
    </div>
  </div>
);


// Компонент для отображения графика распределения
const DistributionChart: React.FC<{
  data: Array<{ label: string; value: number; color: string }>;
  title: string;
}> = ({ data, title }) => (
  <div className="bg-dark-800/50 border border-dark-600/30 rounded-xl p-6">
    <h3 className="text-lg font-semibold text-white mb-6">{title}</h3>
    <div className="space-y-4">
      {data.map((item, index) => (
        <div key={index} className="flex items-center">
          <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: item.color }}></div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-dark-300 text-sm">{item.label}</span>
              <span className="text-white text-sm font-medium">{item.value}</span>
            </div>
            <div className="w-full bg-dark-700 rounded-full h-2">
              <div 
                className="h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: `${(item.value / Math.max(...data.map(d => d.value))) * 100}%`,
                  backgroundColor: item.color
                }}
              ></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Компонент для отображения настоящего графика
const LineChart: React.FC<{
  data: Array<{ label: string; value: number; color: string }>;
  title: string;
  maxValue: number;
  height?: number;
}> = ({ data, title, maxValue, height = 300 }) => {
  const chartWidth = 400;
  const chartHeight = height;
  const padding = 60;
  const innerWidth = chartWidth - padding * 2;
  const innerHeight = chartHeight - padding * 2;

  // Обработка случая с одним элементом и защита от нулевых значений
  const allValues = data.map(d => d.value);
  const maxDataValue = Math.max(...allValues);
  const safeMaxValue = Math.max(maxValue, maxDataValue, 1);
  
  const points = data.map((item, index) => {
    const x = data.length === 1 
      ? padding + innerWidth / 2 
      : padding + (index / Math.max(data.length - 1, 1)) * innerWidth;
    
    // Если все значения равны 0, размещаем точки в середине графика
    const allZero = allValues.every(v => v === 0);
    const y = allZero 
      ? padding + innerHeight / 2 
      : padding + innerHeight - (item.value / safeMaxValue) * innerHeight;
    
    return { x, y, value: item.value, label: item.label, color: item.color };
  });

  const pathData = points.length > 1 
    ? points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
    : `M ${points[0]?.x || 0} ${points[0]?.y || 0}`;

  return (
    <div className="bg-dark-700/30 p-4 rounded-lg">
      <h4 className="text-white font-medium mb-4">{title}</h4>
      <div className="relative w-full overflow-x-auto bg-transparent">
        <svg 
          width={chartWidth} 
          height={chartHeight} 
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="min-w-full"
          style={{ backgroundColor: 'transparent', background: 'transparent' }}
        >
          {/* Сетка */}
          <defs>
            <pattern id={`grid-${title.replace(/[^a-zA-Z0-9]/g, '-')}`} width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.2"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="transparent" />
          <rect width="100%" height="100%" fill={`url(#grid-${title.replace(/[^a-zA-Z0-9]/g, '-')})`} style={{ backgroundColor: 'transparent' }} />
          
          {/* Оси */}
          <line x1={padding} y1={padding} x2={padding} y2={chartHeight - padding} stroke="#6B7280" strokeWidth="2"/>
          <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#6B7280" strokeWidth="2"/>
          
          {/* Линия графика */}
          {points.length > 1 && (
            <path d={pathData} fill="none" stroke="#3B82F6" strokeWidth="3" opacity="0.8" style={{ backgroundColor: 'transparent' }}/>
          )}
          
          {/* Точки */}
          {points.map((point, index) => (
            <g key={index}>
              <circle 
                cx={point.x} 
                cy={point.y} 
                r="5" 
                fill={point.color}
                stroke="#1F2937"
                strokeWidth="2"
                className="hover:r-6 transition-all duration-200 cursor-pointer"
              />
              {/* Подписи значений */}
              <text 
                x={point.x} 
                y={point.y - 12} 
                textAnchor="middle" 
                className="text-sm fill-white font-bold"
                style={{ fontSize: '12px' }}
              >
                {point.value}
              </text>
            </g>
          ))}
          
          {/* Подписи осей X */}
          {points.map((point, index) => (
            <text 
              key={index}
              x={point.x} 
              y={chartHeight - padding + 20} 
              textAnchor="middle" 
              className="text-xs fill-gray-400"
              style={{ fontSize: '10px' }}
            >
              {point.label.length > 12 ? point.label.substring(0, 12) + '...' : point.label}
            </text>
          ))}
          
          {/* Подписи оси Y */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
            const value = Math.round(safeMaxValue * ratio);
            const y = padding + innerHeight - (ratio * innerHeight);
            return (
              <g key={index}>
                <line 
                  x1={padding - 5} 
                  y1={y} 
                  x2={padding} 
                  y2={y} 
                  stroke="#6B7280" 
                  strokeWidth="1"
                />
                <text 
                  x={padding - 10} 
                  y={y + 4} 
                  textAnchor="end" 
                  className="text-xs fill-gray-400"
                  style={{ fontSize: '10px' }}
                >
                  {value}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

// Компонент для интерактивных графиков по вакансиям
const InteractiveVacancyChart: React.FC<{
  vacancyStats: Array<{
    title: string;
    grade: string;
    total: number;
    completed: number;
    averageScore: number;
    hired: number;
  }>;
  allCandidatesData: {
    total: number;
    completed: number;
    averageScore: number;
    hired: number;
  };
}> = ({ vacancyStats, allCandidatesData }) => {
  const [visibleVacancies, setVisibleVacancies] = useState<Set<string>>(
    new Set(['all', ...vacancyStats.map(v => v.title)])
  );

  const toggleVacancy = (vacancyTitle: string) => {
    const newVisible = new Set(visibleVacancies);
    if (newVisible.has(vacancyTitle)) {
      newVisible.delete(vacancyTitle);
    } else {
      newVisible.add(vacancyTitle);
    }
    setVisibleVacancies(newVisible);
  };

  const getVacancyColor = (index: number) => {
    const colors = [
      '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', 
      '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
    ];
    return colors[index % colors.length];
  };

  const chartData = [
    {
      label: 'Общий',
      data: allCandidatesData,
      color: '#3B82F6',
      isVisible: visibleVacancies.has('all')
    },
    ...vacancyStats.map((vacancy, index) => ({
      label: `${vacancy.title} (${vacancy.grade})`,
      data: vacancy,
      color: getVacancyColor(index),
      isVisible: visibleVacancies.has(vacancy.title)
    }))
  ].filter(item => item.isVisible);

  const maxTotal = Math.max(...chartData.map(d => d.data.total));
  const maxCompleted = Math.max(...chartData.map(d => d.data.completed));
  const maxHired = Math.max(...chartData.map(d => d.data.hired));

  return (
    <div className="bg-dark-800/50 border border-dark-600/30 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Статистика по вакансиям</h3>
        <div className="text-sm text-dark-400">
          {chartData.length} из {vacancyStats.length + 1} графиков
        </div>
      </div>

      {/* Переключатели */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => toggleVacancy('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              visibleVacancies.has('all')
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-dark-700/50 text-dark-300 border border-dark-600/50 hover:bg-dark-600/50'
            }`}
          >
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3B82F6' }}></div>
              <span>Общий</span>
            </div>
          </button>
          
          {vacancyStats.map((vacancy, index) => (
            <button
              key={vacancy.title}
              onClick={() => toggleVacancy(vacancy.title)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                visibleVacancies.has(vacancy.title)
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-dark-700/50 text-dark-300 border border-dark-600/50 hover:bg-dark-600/50'
              }`}
            >
              <div className="flex items-center space-x-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: getVacancyColor(index) }}
                ></div>
                <span>{vacancy.title}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* График: Всего кандидатов */}
        <LineChart
          data={chartData.map(item => ({
            label: item.label,
            value: item.data.total,
            color: item.color
          }))}
          title="Всего кандидатов"
          maxValue={maxTotal}
        />

        {/* График: Завершённых интервью */}
        <LineChart
          data={chartData.map(item => ({
            label: item.label,
            value: item.data.completed,
            color: item.color
          }))}
          title="Завершённых интервью"
          maxValue={maxCompleted}
        />

        {/* График: Средняя оценка */}
        <LineChart
          data={chartData.map(item => ({
            label: item.label,
            value: item.data.averageScore || 0,
            color: item.color
          }))}
          title="Средняя оценка (%)"
          maxValue={Math.max(100, ...chartData.map(d => d.data.averageScore || 0), 1)}
        />

        {/* График: Принято на работу */}
        <LineChart
          data={chartData.map(item => ({
            label: item.label,
            value: item.data.hired,
            color: item.color
          }))}
          title="Принято на работу"
          maxValue={maxHired}
        />
      </div>
    </div>
  );
};

const CompanyDashboard: React.FC<CompanyDashboardProps> = ({ candidates, vacancies }) => {
  // Состояние для скачивания отчетов
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [selectedVacancyForReport, setSelectedVacancyForReport] = useState<string>('');

  // Функция для скачивания отчета
  const handleDownloadReport = async () => {
    if (!selectedVacancyForReport) {
      alert('Пожалуйста, выберите вакансию');
      return;
    }

    try {
      setDownloadingReport(true);
      await downloadVacancyReport(selectedVacancyForReport);
    } catch (error) {
      console.error('Ошибка при скачивании отчета:', error);
      alert('Ошибка при скачивании отчета. Попробуйте еще раз.');
    } finally {
      setDownloadingReport(false);
    }
  };

  // Исключаем отклонённых кандидатов из всех расчётов
  const activeCandidates = candidates.filter(c => c.status !== 'rejected');
  
  // Общая статистика
  const totalCandidates = activeCandidates.length;
  const completedInterviews = activeCandidates.filter(c => c.status !== 'active').length;
  const activeInterviews = activeCandidates.filter(c => c.status === 'active').length;
  const hiredCandidates = activeCandidates.filter(c => c.status === 'offer').length;

  // Статистика по статусам (без отклонённых)
  const statusStats = {
    active: activeCandidates.filter(c => c.status === 'active').length,
    completed: activeCandidates.filter(c => c.status === 'completed').length,
    test_task: activeCandidates.filter(c => c.status === 'test_task').length,
    finalist: activeCandidates.filter(c => c.status === 'finalist').length,
    offer: activeCandidates.filter(c => c.status === 'offer').length,
  };

  // Статистика по оценкам (без отклонённых)
  const candidatesWithScores = activeCandidates.filter(c => {
    const resumeScore = c.resume_score || 0;
    const interviewScore = getInterviewScore(c);
    return resumeScore > 0 || interviewScore > 0;
  });

  const averageResumeScore = candidatesWithScores.length > 0 
    ? Math.round(candidatesWithScores.reduce((sum, c) => sum + (c.resume_score || 0), 0) / candidatesWithScores.length)
    : 0;

  const averageInterviewScore = candidatesWithScores.length > 0
    ? Math.round(candidatesWithScores.reduce((sum, c) => sum + getInterviewScore(c), 0) / candidatesWithScores.length)
    : 0;

  const averageOverallScore = candidatesWithScores.length > 0
    ? Math.round(candidatesWithScores.reduce((sum, c) => sum + getOverallScore(c), 0) / candidatesWithScores.length)
    : 0;

  // Распределение по уровням
  const levelDistribution = candidatesWithScores.reduce((acc, candidate) => {
    const score = getOverallScore(candidate);
    if (score >= 85) acc.excellent++;
    else if (score >= 70) acc.good++;
    else if (score >= 55) acc.average++;
    else if (score >= 40) acc.weak++;
    else acc.poor++;
    return acc;
  }, { excellent: 0, good: 0, average: 0, weak: 0, poor: 0 });

  // Статистика по вакансиям (без отклонённых)
  const vacancyStats = vacancies.map(vacancy => {
    const vacancyCandidates = activeCandidates.filter(c => c.vacancy_title === vacancy.title);
    const completedVacancyCandidates = vacancyCandidates.filter(c => c.status !== 'active');
    const averageScore = completedVacancyCandidates.length > 0
      ? Math.round(completedVacancyCandidates.reduce((sum, c) => sum + getOverallScore(c), 0) / completedVacancyCandidates.length)
      : 0;
    
    return {
      title: vacancy.title,
      grade: vacancy.grade,
      total: vacancyCandidates.length,
      completed: completedVacancyCandidates.length,
      averageScore,
      hired: vacancyCandidates.filter(c => c.status === 'offer').length
    };
  }).sort((a, b) => b.total - a.total);

  // Анализ голосовых характеристик (без отклонённых)
  const voiceAnalysisStats = activeCandidates.reduce((acc, candidate) => {
    if (candidate.answers) {
      candidate.answers.forEach(answer => {
        if (answer.voice_analysis?.scores) {
          Object.entries(answer.voice_analysis.scores).forEach(([key, value]) => {
            if (!acc[key]) acc[key] = { total: 0, count: 0 };
            acc[key].total += value as number;
            acc[key].count += 1;
          });
        }
      });
    }
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  const averageVoiceScores = Object.entries(voiceAnalysisStats).map(([key, data]) => ({
    name: key === 'confidence' ? 'Уверенность' :
          key === 'stress_resistance' ? 'Стрессоустойчивость' :
          key === 'communication' ? 'Коммуникация' :
          key === 'energy' ? 'Энергичность' : key,
    value: Math.round(data.total / data.count),
    color: key === 'confidence' ? '#10B981' :
           key === 'stress_resistance' ? '#3B82F6' :
           key === 'communication' ? '#8B5CF6' :
           key === 'energy' ? '#F59E0B' : '#6B7280'
  }));

  // Конверсия по воронке
  const conversionRates = {
    interviewToCompleted: completedInterviews > 0 ? Math.round((statusStats.completed / completedInterviews) * 100) : 0,
    completedToTestTask: statusStats.completed > 0 ? Math.round((statusStats.test_task / statusStats.completed) * 100) : 0,
    testTaskToFinalist: statusStats.test_task > 0 ? Math.round((statusStats.finalist / statusStats.test_task) * 100) : 0,
    finalistToOffer: statusStats.finalist > 0 ? Math.round((statusStats.offer / statusStats.finalist) * 100) : 0,
  };

  return (
    <div className="space-y-8">

      {/* Основные метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Всего кандидатов"
          value={totalCandidates}
          subtitle={`${activeInterviews} активных интервью`}
          icon={
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          }
          color="bg-blue-500/20"
        />
        
        <StatCard
          title="Завершённых интервью"
          value={completedInterviews}
          subtitle={`${Math.round((completedInterviews / totalCandidates) * 100)}% от общего числа`}
          icon={
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          }
          color="bg-green-500/20"
        />
        
        <StatCard
          title="Принято на работу"
          value={hiredCandidates}
          subtitle={`${Math.round((hiredCandidates / totalCandidates) * 100)}% конверсия`}
          icon={
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          }
          color="bg-yellow-500/20"
        />
        
        <StatCard
          title="Средняя оценка"
          value={`${averageOverallScore}%`}
          subtitle={`Резюме: ${averageResumeScore}%, Интервью: ${averageInterviewScore}%`}
          icon={
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
            </svg>
          }
          color="bg-purple-500/20"
        />
      </div>

      {/* Графики и аналитика */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Распределение по статусам */}
        <DistributionChart
          title="Распределение по статусам"
          data={[
            { label: 'Активные', value: statusStats.active, color: '#3B82F6' },
            { label: 'Одобренные ИИ', value: statusStats.completed, color: '#EAB308' },
            { label: 'Тестовое задание', value: statusStats.test_task, color: '#8B5CF6' },
            { label: 'Финалисты', value: statusStats.finalist, color: '#10B981' },
            { label: 'Оффер', value: statusStats.offer, color: '#22C55E' },
          ]}
        />

        {/* Распределение по уровням */}
        <DistributionChart
          title="Распределение по уровням"
          data={[
            { label: 'Отлично (85%+)', value: levelDistribution.excellent, color: '#10B981' },
            { label: 'Хорошо (70-84%)', value: levelDistribution.good, color: '#3B82F6' },
            { label: 'Средне (55-69%)', value: levelDistribution.average, color: '#EAB308' },
            { label: 'Слабо (40-54%)', value: levelDistribution.weak, color: '#F97316' },
            { label: 'Плохо (<40%)', value: levelDistribution.poor, color: '#EF4444' },
          ]}
        />
      </div>

      {/* Анализ голосовых характеристик */}
      {averageVoiceScores.length > 0 && (
        <div className="bg-dark-800/50 border border-dark-600/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Средние показатели голосового анализа</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {averageVoiceScores.map((score, index) => (
              <div key={index} className="text-center">
                <div className="text-2xl font-bold text-white mb-1">{score.value}%</div>
                <div className="text-dark-400 text-sm">{score.name}</div>
                <div 
                  className="w-full h-2 rounded-full mt-2"
                  style={{ backgroundColor: `${score.color}20` }}
                >
                  <div 
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${score.value}%`,
                      backgroundColor: score.color
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Интерактивные графики по вакансиям */}
      <InteractiveVacancyChart 
        vacancyStats={vacancyStats}
        allCandidatesData={{
          total: totalCandidates,
          completed: completedInterviews,
          averageScore: averageOverallScore,
          hired: hiredCandidates
        }}
      />

      {/* Конверсия по воронке */}
      <div className="bg-dark-800/50 border border-dark-600/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Конверсия по воронке найма</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400 mb-2">{conversionRates.interviewToCompleted}%</div>
            <div className="text-dark-300 text-sm mb-1">Интервью → Одобрено ИИ</div>
            <div className="text-dark-500 text-xs">{statusStats.completed} из {completedInterviews}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400 mb-2">{conversionRates.completedToTestTask}%</div>
            <div className="text-dark-300 text-sm mb-1">Одобрено → Тестовое</div>
            <div className="text-dark-500 text-xs">{statusStats.test_task} из {statusStats.completed}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400 mb-2">{conversionRates.testTaskToFinalist}%</div>
            <div className="text-dark-300 text-sm mb-1">Тестовое → Финалист</div>
            <div className="text-dark-500 text-xs">{statusStats.finalist} из {statusStats.test_task}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400 mb-2">{conversionRates.finalistToOffer}%</div>
            <div className="text-dark-300 text-sm mb-1">Финалист → Оффер</div>
            <div className="text-dark-500 text-xs">{statusStats.offer} из {statusStats.finalist}</div>
          </div>
        </div>
      </div>

      {/* Скачивание отчетов */}
      <div className="bg-dark-800/50 border border-dark-600/30 rounded-xl p-6">
          {/* Заголовок */}
          <h3 className="text-lg font-semibold text-white mb-6">Скачивание отчетов</h3>

          {/* Основной контент */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Выбор вакансии */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-dark-300 mb-3">
                Выберите вакансию для анализа
              </label>
              <div className="relative">
                <select
                  value={selectedVacancyForReport}
                  onChange={(e) => setSelectedVacancyForReport(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-700/50 border border-dark-600/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-transparent transition-all duration-200 hover:border-dark-500/50 appearance-none"
                >
                  <option value="">Выберите вакансию...</option>
                  {vacancies.map((vacancy) => (
                    <option key={vacancy._id} value={vacancy._id}>
                      {vacancy.title}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-5 h-5 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Кнопка скачивания */}
            <div className="flex items-end">
              <button
                onClick={handleDownloadReport}
                disabled={downloadingReport || !selectedVacancyForReport}
                className="w-full px-6 py-3 bg-gradient-to-r from-accent-blue to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-dark-600 disabled:to-dark-700 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 flex items-center justify-center gap-3 font-medium shadow-lg hover:shadow-xl disabled:shadow-none transform hover:scale-105 disabled:transform-none"
              >
                {downloadingReport ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Генерация...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Скачать отчет</span>
                  </>
                )}
              </button>
            </div>
          </div>


          {/* Описание и особенности */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-dark-700/30 rounded-lg">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <div className="text-white text-sm font-medium">Воронка найма</div>
                <div className="text-dark-400 text-xs">Конверсии по этапам</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-dark-700/30 rounded-lg">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="text-white text-sm font-medium">Диаграммы</div>
                <div className="text-dark-400 text-xs">Визуализация данных</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-dark-700/30 rounded-lg">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <div className="text-white text-sm font-medium">KPI метрики</div>
                <div className="text-dark-400 text-xs">Время найма, статистика</div>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
};

export default CompanyDashboard;
