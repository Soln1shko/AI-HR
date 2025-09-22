import React from 'react';
import { TopicDetail, TopicAnalytics } from '../utils/interviewAnalytics';

interface TopicBarChartProps {
  data: { [topicName: string]: number };
  title: string;
  color?: string;
}

export const TopicBarChart: React.FC<TopicBarChartProps> = ({ 
  data, 
  title, 
  color = "from-blue-500 to-purple-500" 
}) => {
  const entries = Object.entries(data);
  const maxValue = Math.max(...entries.map(([, value]) => value));

  return (
    <div className="glass rounded-2xl p-6 border border-dark-600/30">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div className="space-y-3">
        {entries.map(([topic, value]) => {
          const percentage = (value / maxValue) * 100;
          return (
            <div key={topic} className="flex items-center space-x-3">
              <div className="w-32 text-sm text-dark-300 truncate" title={topic}>
                {topic}
              </div>
              <div className="flex-1 bg-dark-700/50 rounded-full h-6 relative overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-1000 ease-out`}
                  style={{ width: `${percentage}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-medium text-white">
                    {Math.round(value)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface TopicLineChartProps {
  data: { [topicName: string]: number };
  title: string;
  color?: string;
}

export const TopicLineChart: React.FC<TopicLineChartProps> = ({ 
  data, 
  title
}) => {
  const entries = Object.entries(data);
  const maxValue = Math.max(...entries.map(([, value]) => value));
  const minValue = Math.min(...entries.map(([, value]) => value));
  const range = maxValue - minValue;

  // Создаем точки для линии
  const points = entries.map(([topic, value], index) => {
    // Добавляем отступы слева и справа (3% с каждой стороны)
    const x = 3 + (index / (entries.length - 1)) * 94;
    // Добавляем отступы сверху и снизу (10% сверху, 5% снизу)
    const y = range > 0 ? 75 - ((value - minValue) / range) * 55 : 50;
    return { x, y, topic, value };
  });

  // Создаем SVG path для линии
  const pathData = points.map((point, index) => {
    const command = index === 0 ? 'M' : 'L';
    return `${command} ${point.x} ${point.y}`;
  }).join(' ');

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="glass rounded-2xl p-6 border border-dark-600/30">
      <h3 className="text-lg font-semibold text-white mb-6">{title}</h3>
      
      <div className="relative pb-4">
        {/* SVG график */}
        <div className="w-full h-[500px] relative">
          <svg
            viewBox="0 0 100 80"
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Сетка */}
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100" height="80" fill="url(#grid)" />
            
            {/* Ось Y (вертикальная линия) */}
            <line x1="3" y1="10" x2="3" y2="75" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8"/>
            
            {/* Ось X (горизонтальная линия) */}
            <line x1="3" y1="75" x2="96" y2="75" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8"/>
            
            {/* Ось Y - значения */}
            {[20, 33, 46, 59, 72].map((y) => {
              const value = maxValue - ((y - 20) / 55) * range;
              return (
                <g key={y}>
                  <line x1="3" y1={y} x2="96" y2={y} stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
                  <text x="1" y={y + 1} fontSize="2" fill="rgba(255,255,255,0.6)" textAnchor="start">
                    {Math.round(value)}%
                  </text>
                </g>
              );
            })}
            
            {/* Линия графика */}
            <path
              d={pathData}
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="0.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-lg"
            />
            
            {/* Градиент для линии */}
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="50%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
            
            {/* Точки данных */}
            {points.map((point, index) => (
              <g key={index}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="1.5"
                  fill="white"
                  stroke="url(#lineGradient)"
                  strokeWidth="1"
                  className="hover:r-2 transition-all duration-300 cursor-pointer"
                />
                {/* Название темы */}
                <text
                  x={point.x}
                  y={point.y - 3}
                  fontSize="1.8"
                  fill="rgba(255,255,255,0.9)"
                  textAnchor="middle"
                  className="pointer-events-none"
                  style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                >
                  {point.topic.length > 12 ? point.topic.substring(0, 12) + '...' : point.topic}
                </text>
                {/* Tooltip при наведении */}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill="transparent"
                  className="cursor-pointer"
                >
                  <title>{point.topic}: {Math.round(point.value)}%</title>
                </circle>
              </g>
            ))}
          </svg>
        </div>
        
        
        {/* Легенда с цветовой кодировкой */}
        <div className="mt-4 flex flex-wrap gap-2">
          {entries.slice(0, 6).map(([topic, value]) => (
            <div key={topic} className="flex items-center gap-2 text-xs">
              <div className={`w-3 h-3 rounded-full ${
                value >= 80 ? 'bg-green-400' :
                value >= 60 ? 'bg-yellow-400' : 'bg-red-400'
              }`}></div>
              <span className="text-dark-300 truncate max-w-[100px]" title={topic}>
                {topic.length > 12 ? topic.substring(0, 12) + '...' : topic}
              </span>
              <span className={`font-medium ${getScoreColor(value)}`}>
                {Math.round(value)}%
              </span>
            </div>
          ))}
          {entries.length > 6 && (
            <div className="text-xs text-dark-400">
              +{entries.length - 6} еще...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface SkillRadarChartProps {
  data: {
    technicalAccuracy: number;
    depthOfKnowledge: number;
    practicalExperience: number;
    communication: number;
  };
  title: string;
}

export const SkillRadarChart: React.FC<SkillRadarChartProps> = ({ data, title }) => {
  const skills = [
    { key: 'technicalAccuracy', label: 'Техническая точность', value: data.technicalAccuracy },
    { key: 'depthOfKnowledge', label: 'Глубина знаний', value: data.depthOfKnowledge },
    { key: 'practicalExperience', label: 'Практический опыт', value: data.practicalExperience },
    { key: 'communication', label: 'Коммуникация', value: data.communication },
  ];

  return (
    <div className="glass rounded-2xl p-6 border border-dark-600/30">
      <h3 className="text-lg font-semibold text-white mb-6">{title}</h3>
      <div className="grid grid-cols-4 gap-6">
        {skills.map((skill) => (
          <div key={skill.key} className="flex flex-col items-center">
            <div className="relative w-24 h-24 mb-3">
              <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                {/* Фоновый круг */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-dark-600"
                />
                {/* Прогресс круг */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - skill.value / 100)}`}
                  strokeLinecap="round"
                  className={`transition-all duration-1000 ease-out ${
                    skill.value >= 80 ? 'text-green-400' :
                    skill.value >= 60 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-white">
                  {Math.round(skill.value)}%
                </span>
              </div>
            </div>
            <span className="text-sm text-dark-300 text-center leading-tight">
              {skill.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface TopicDetailsTableProps {
  topics: TopicDetail[];
  title: string;
}

export const TopicDetailsTable: React.FC<TopicDetailsTableProps> = ({ topics, title }) => {
  if (topics.length === 0) {
    return (
      <div className="glass rounded-2xl p-6 border border-dark-600/30">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <p className="text-dark-400 text-center py-8">Нет данных по темам</p>
      </div>
    );
  }

  // Группируем темы по названию для подсчета количества
  const topicCounts: { [key: string]: number } = {};
  const topicDisplayNames: string[] = [];
  
  topics.forEach((topic, index) => {
    if (!topicCounts[topic.topic]) {
      topicCounts[topic.topic] = 0;
    }
    topicCounts[topic.topic]++;
    
    // Если тема повторяется, добавляем номер
    const count = topicCounts[topic.topic];
    const displayName = count > 1 ? `${topic.topic} (${count})` : topic.topic;
    topicDisplayNames[index] = displayName;
  });

  return (
    <div className="glass rounded-2xl p-6 border border-dark-600/30">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-600/30">
              <th className="text-left py-2 text-dark-300 font-medium">Тема</th>
              <th className="text-center py-2 text-dark-300 font-medium">Итоговая</th>
              <th className="text-center py-2 text-dark-300 font-medium">Техническая</th>
              <th className="text-center py-2 text-dark-300 font-medium">Глубина</th>
              <th className="text-center py-2 text-dark-300 font-medium">Опыт</th>
              <th className="text-center py-2 text-dark-300 font-medium">Коммуникация</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((topic, index) => (
              <tr key={index} className="border-b border-dark-600/20">
                <td className="py-3 text-white text-sm">{topicDisplayNames[index]}</td>
                <td className="py-3 text-center">
                  <span className={`text-sm font-medium ${
                    topic.finalScore >= 80 ? 'text-green-400' :
                    topic.finalScore >= 60 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {topic.finalScore.toFixed(1)}%
                  </span>
                </td>
                <td className="py-3 text-center">
                  <span className="text-dark-300 text-sm">
                    {(topic.technicalAccuracy / 10).toFixed(1)}/10
                  </span>
                </td>
                <td className="py-3 text-center">
                  <span className="text-dark-300 text-sm">
                    {(topic.depthOfKnowledge / 10).toFixed(1)}/10
                  </span>
                </td>
                <td className="py-3 text-center">
                  <span className="text-dark-300 text-sm">
                    {(topic.practicalExperience / 10).toFixed(1)}/10
                  </span>
                </td>
                <td className="py-3 text-center">
                  <span className="text-dark-300 text-sm">
                    {(topic.communication / 10).toFixed(1)}/10
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface TopicAnalyticsDashboardProps {
  analytics: TopicAnalytics;
  candidateName?: string;
}

export const TopicAnalyticsDashboard: React.FC<TopicAnalyticsDashboardProps> = ({ 
  analytics, 
  candidateName 
}) => {
  return (
    <div className="space-y-6">
      {/* График на всю ширину */}
      <TopicLineChart
        data={analytics.averageByTopic}
        title={candidateName ? `Оценки по темам - ${candidateName}` : "Средние оценки по темам"}
        color="from-blue-500 to-cyan-500"
      />
      
      {/* Радар на всю ширину */}
      <SkillRadarChart
        data={analytics.averageBySkill}
        title={candidateName ? `Навыки - ${candidateName}` : "Средние навыки"}
      />
      
      {/* Таблица на всю ширину */}
      <TopicDetailsTable
        topics={analytics.topics}
        title={candidateName ? `Детализация по темам - ${candidateName}` : "Детализация по темам"}
      />
    </div>
  );
};
