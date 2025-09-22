// Утилиты для анализа данных интервью

export interface TopicDetail {
  topic: string;
  finalScore: number;
  technicalAccuracy: number;
  depthOfKnowledge: number;
  practicalExperience: number;
  communication: number;
}

export interface TopicAnalytics {
  topics: TopicDetail[];
  averageByTopic: { [topicName: string]: number };
  averageBySkill: {
    technicalAccuracy: number;
    depthOfKnowledge: number;
    practicalExperience: number;
    communication: number;
  };
  totalAverage: number;
}

/**
 * Парсит детализацию по темам из отчета интервью
 */
export const parseTopicDetails = (interviewAnalysis: any): TopicDetail[] => {
  if (!interviewAnalysis) return [];

  let reportText = '';
  
  // Получаем текст отчета
  if (typeof interviewAnalysis === 'string') {
    reportText = interviewAnalysis;
  } else if (interviewAnalysis.report && typeof interviewAnalysis.report === 'string') {
    reportText = interviewAnalysis.report;
  } else {
    return [];
  }

  const topics: TopicDetail[] = [];
  
  // Ищем раздел "ДЕТАЛИЗАЦИЯ ПО ТЕМАМ" - берем все до конца текста
  const detailsSectionMatch = reportText.match(/ДЕТАЛИЗАЦИЯ ПО ТЕМАМ\s*\n([\s\S]*)/i);
  if (!detailsSectionMatch) {
    console.log('Раздел "ДЕТАЛИЗАЦИЯ ПО ТЕМАМ" не найден');
    return topics;
  }

  const detailsSection = detailsSectionMatch[1];
  console.log('Раздел найден, длина:', detailsSection.length);
  console.log('Первые 500 символов раздела:', detailsSection.substring(0, 500));
  
  return parseTopicsFromSection(detailsSection, topics);
};

const parseTopicsFromSection = (detailsSection: string, topics: TopicDetail[]): TopicDetail[] => {
  console.log('Начинаем парсинг раздела, длина:', detailsSection.length);
  
  // Попробуем найти все упоминания "• Тема:"
  const simpleMatches = detailsSection.match(/•\s*Тема:/g);
  console.log('Найдено упоминаний "• Тема:":', simpleMatches ? simpleMatches.length : 0);
  
  // Разделим по "• Тема:" - это более надежный способ
  const parts = detailsSection.split(/•\s*Тема:/);
  console.log('Частей после разделения:', parts.length);
  
  if (parts.length > 1) {
    // Пропускаем первую часть (до первой темы)
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      console.log(`\nОбрабатываем часть ${i}:`, part.substring(0, 100) + '...');
      
      const topicMatch = part.match(/^\s*([^\n]+)/);
      if (topicMatch) {
        const topicName = topicMatch[1].trim();
        console.log(`Название темы ${i}:`, topicName);
        
        const finalScoreMatch = part.match(/Итоговая оценка:\s*(\d+(?:\.\d+)?)%/);
        const technicalMatch = part.match(/Техническая точность:\s*(\d+(?:\.\d+)?)\/10/);
        const depthMatch = part.match(/Глубина знаний:\s*(\d+(?:\.\d+)?)\/10/);
        const practicalMatch = part.match(/Практический опыт:\s*(\d+(?:\.\d+)?)\/10/);
        const communicationMatch = part.match(/Коммуникация:\s*(\d+(?:\.\d+)?)\/10/);

        console.log('Найденные оценки для', topicName, ':', {
          finalScore: finalScoreMatch ? finalScoreMatch[1] : 'не найдено',
          technical: technicalMatch ? technicalMatch[1] : 'не найдено',
          depth: depthMatch ? depthMatch[1] : 'не найдено',
          practical: practicalMatch ? practicalMatch[1] : 'не найдено',
          communication: communicationMatch ? communicationMatch[1] : 'не найдено'
        });

        if (finalScoreMatch) {
          const topicData = {
            topic: topicName,
            finalScore: parseFloat(finalScoreMatch[1]),
            technicalAccuracy: technicalMatch ? parseFloat(technicalMatch[1]) * 10 : 0,
            depthOfKnowledge: depthMatch ? parseFloat(depthMatch[1]) * 10 : 0,
            practicalExperience: practicalMatch ? parseFloat(practicalMatch[1]) * 10 : 0,
            communication: communicationMatch ? parseFloat(communicationMatch[1]) * 10 : 0,
          };
          
          topics.push(topicData);
          console.log('Тема добавлена:', topicData);
        } else {
          console.log('Итоговая оценка не найдена для темы:', topicName);
        }
      } else {
        console.log('Не удалось извлечь название темы из части:', i);
      }
    }
    return topics;
  }

  console.log('Не удалось разделить текст по темам');
  return topics;
};

/**
 * Вычисляет аналитику по темам
 */
export const calculateTopicAnalytics = (topics: TopicDetail[]): TopicAnalytics => {
  if (topics.length === 0) {
    return {
      topics: [],
      averageByTopic: {},
      averageBySkill: {
        technicalAccuracy: 0,
        depthOfKnowledge: 0,
        practicalExperience: 0,
        communication: 0,
      },
      totalAverage: 0,
    };
  }

  // Группируем по темам и вычисляем средние для графиков
  const topicGroups: { [key: string]: TopicDetail[] } = {};
  topics.forEach(topic => {
    if (!topicGroups[topic.topic]) {
      topicGroups[topic.topic] = [];
    }
    topicGroups[topic.topic].push(topic);
  });

  const averageByTopic: { [topicName: string]: number } = {};
  Object.keys(topicGroups).forEach(topicName => {
    const topicScores = topicGroups[topicName].map(t => t.finalScore);
    averageByTopic[topicName] = topicScores.reduce((sum, score) => sum + score, 0) / topicScores.length;
  });

  // Средние по навыкам (по всем темам)
  const averageBySkill = {
    technicalAccuracy: topics.reduce((sum, t) => sum + t.technicalAccuracy, 0) / topics.length,
    depthOfKnowledge: topics.reduce((sum, t) => sum + t.depthOfKnowledge, 0) / topics.length,
    practicalExperience: topics.reduce((sum, t) => sum + t.practicalExperience, 0) / topics.length,
    communication: topics.reduce((sum, t) => sum + t.communication, 0) / topics.length,
  };

  // Общий средний балл
  const totalAverage = topics.reduce((sum, t) => sum + t.finalScore, 0) / topics.length;

  return {
    topics, // Возвращаем все темы без группировки для таблицы
    averageByTopic, // Средние по уникальным темам для графиков
    averageBySkill,
    totalAverage,
  };
};

/**
 * Получает аналитику по темам из данных кандидата
 */
export const getCandidateTopicAnalytics = (candidate: any): TopicAnalytics => {
  const topics = parseTopicDetails(candidate.interview_analysis);
  return calculateTopicAnalytics(topics);
};

/**
 * Получает аналитику по всем кандидатам
 */
export const getCompanyTopicAnalytics = (candidates: any[]): {
  allTopics: TopicDetail[];
  companyAverages: {
    byTopic: { [topicName: string]: number };
    bySkill: {
      technicalAccuracy: number;
      depthOfKnowledge: number;
      practicalExperience: number;
      communication: number;
    };
    overall: number;
  };
} => {
  const allTopics: TopicDetail[] = [];
  
  candidates.forEach(candidate => {
    const candidateTopics = parseTopicDetails(candidate.interview_analysis);
    allTopics.push(...candidateTopics);
  });

  if (allTopics.length === 0) {
    return {
      allTopics: [],
      companyAverages: {
        byTopic: {},
        bySkill: {
          technicalAccuracy: 0,
          depthOfKnowledge: 0,
          practicalExperience: 0,
          communication: 0,
        },
        overall: 0,
      },
    };
  }

  // Группируем по темам
  const topicGroups: { [key: string]: TopicDetail[] } = {};
  allTopics.forEach(topic => {
    if (!topicGroups[topic.topic]) {
      topicGroups[topic.topic] = [];
    }
    topicGroups[topic.topic].push(topic);
  });

  const byTopic: { [topicName: string]: number } = {};
  Object.keys(topicGroups).forEach(topicName => {
    const topicScores = topicGroups[topicName].map(t => t.finalScore);
    byTopic[topicName] = topicScores.reduce((sum, score) => sum + score, 0) / topicScores.length;
  });

  // Средние по навыкам по всем кандидатам
  const bySkill = {
    technicalAccuracy: allTopics.reduce((sum, t) => sum + t.technicalAccuracy, 0) / allTopics.length,
    depthOfKnowledge: allTopics.reduce((sum, t) => sum + t.depthOfKnowledge, 0) / allTopics.length,
    practicalExperience: allTopics.reduce((sum, t) => sum + t.practicalExperience, 0) / allTopics.length,
    communication: allTopics.reduce((sum, t) => sum + t.communication, 0) / allTopics.length,
  };

  const overall = allTopics.reduce((sum, t) => sum + t.finalScore, 0) / allTopics.length;

  return {
    allTopics,
    companyAverages: {
      byTopic,
      bySkill,
      overall,
    },
  };
};
