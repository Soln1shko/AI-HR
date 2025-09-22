import React, { useState, useEffect } from 'react';
import TopPanel from '../components/TopPanel';
import CandidateDashboard from '../components/CandidateDashboard';
import CompanyDashboard from '../components/CompanyDashboard';
import { getAllVacancies, getCandidatesForVacancy, getCandidateAnswers, updateCandidateStatus, downloadCandidateResume, getVideoPlaybackUrl, getHhResponses, type Candidate, type CandidateAnswer } from '../services/api';

// Функция для преобразования URL резюме HH.ru в правильный формат
const convertHhResumeUrl = (originalUrl: string): string => {
  try {
    // Парсим исходный URL
    const url = new URL(originalUrl);
    const pathParts = url.pathname.split('/');
    
    // Извлекаем ID резюме и имя файла
    let resumeId: string | null = null;
    let encodedName: string | null = null;
    
    for (let i = 0; i < pathParts.length; i++) {
      if (pathParts[i] === 'resumes' && i + 1 < pathParts.length) {
        resumeId = pathParts[i + 1];
      } else if (pathParts[i] === 'download' && i + 1 < pathParts.length) {
        encodedName = pathParts[i + 1];
      }
    }
    
    if (!resumeId || !encodedName) {
      console.error('Не удалось извлечь ID резюме или имя файла из URL:', originalUrl);
      return originalUrl; // Возвращаем исходный URL если не удалось преобразовать
    }
    
    // Получаем тип файла из параметров
    const fileType = url.searchParams.get('type') || 'pdf';
    
    // Создаем новые параметры запроса
    const newParams = new URLSearchParams({
      'hash': resumeId,
      'type': fileType,
      'hhtmSource': 'resume',
      'hhtmFrom': ''
    });
    
    // Формируем новый URL
    const newUrl = `https://hh.ru/resume_converter/${encodedName}?${newParams.toString()}`;
    
    console.log('Преобразован URL резюме:', {
      original: originalUrl,
      converted: newUrl
    });
    
    return newUrl;
  } catch (error) {
    console.error('Ошибка при преобразовании URL резюме:', error);
    return originalUrl; // Возвращаем исходный URL при ошибке
  }
};

// Функция для перевода тегов анализа на русский язык
const translateAnalysisTag = (tag: string): string => {
  const translations: Record<string, string> = {
    'Достаточно уверенный': 'Достаточно уверенный',
    'Быстрая речь': 'Быстрая речь',
    'Слабая коммуникация': 'Слабая коммуникация',
    'Пассивный': 'Пассивный',
    'Подвержен стрессу': 'Подвержен стрессу',
    'Уверенный': 'Уверенный',
    'Спокойная речь': 'Спокойная речь',
    'Хорошая коммуникация': 'Хорошая коммуникация',
    'Активный': 'Активный',
    'Стрессоустойчивый': 'Стрессоустойчивый',
    'Неуверенный': 'Неуверенный',
    'Медленная речь': 'Медленная речь',
    'Отличная коммуникация': 'Отличная коммуникация',
    'Очень активный': 'Очень активный'
  };
  
  return translations[tag] || tag;
};

// Функция для перевода названий оценок
const translateScoreName = (scoreName: string): string => {
  const translations: Record<string, string> = {
    'confidence': 'Уверенность',
    'stress_resistance': 'Стрессоустойчивость', 
    'communication': 'Коммуникация',
    'energy': 'Энергичность'
  };
  
  return translations[scoreName] || scoreName;
};

// Компонент для Yandex Cloud видеоплеера
const YandexVideoPlayer: React.FC<{ src: string }> = ({ src }) => {
  return (
    <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
      <iframe
        src={src}
        className="absolute top-0 left-0 w-full h-full rounded-lg"
        frameBorder="0"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture; screen-wake-lock; display-capture"
        title="Видео ответ кандидата"
      />
    </div>
  );
};

// Компонент для отображения анализа речи
const VoiceAnalysisDisplay: React.FC<{ analysis: CandidateAnswer['voice_analysis'] }> = ({ analysis }) => {
  if (!analysis) return null;

  return (
    <div className="mt-4 p-4 bg-dark-800/50 rounded-lg border border-dark-600/30">
      <h5 className="text-white font-medium mb-3 flex items-center">
        <svg className="w-4 h-4 mr-2 text-accent-blue" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
        Анализ речи
      </h5>
      
      {/* Теги */}
      {analysis.tags && analysis.tags.length > 0 && (
        <div className="mb-4">
          <h6 className="text-dark-300 text-sm font-medium mb-2">Характеристики:</h6>
          <div className="flex flex-wrap gap-2">
            {analysis.tags.map((tag, index) => (
              <span 
                key={index}
                className="px-2 py-1 bg-accent-blue/20 text-accent-blue text-xs rounded-full border border-accent-blue/30"
              >
                {translateAnalysisTag(tag)}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Оценки */}
      {analysis.scores && (
        <div>
          <h6 className="text-dark-300 text-sm font-medium mb-2">Оценки:</h6>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(analysis.scores).map(([key, value]) => (
              <div key={key} className="bg-dark-700/50 p-2 rounded-lg">
                <div className="text-dark-400 text-xs mb-1">{translateScoreName(key)}</div>
                <div className="flex items-center">
                  <div className="flex-1 bg-dark-600 rounded-full h-2 mr-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(value, 100)}%` }}
                    ></div>
                  </div>
                  <span className={`text-sm font-medium ${
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
      
      {/* Общая оценка */}
      {analysis.overall_score !== undefined && (
        <div className="mt-3 pt-3 border-t border-dark-600/30">
          <div className="flex items-center justify-between">
            <span className="text-dark-300 text-sm font-medium">Общая оценка:</span>
            <span className={`text-lg font-bold ${
              analysis.overall_score >= 70 ? 'text-green-400' : 
              analysis.overall_score >= 40 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {analysis.overall_score}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

interface ExtendedCandidate extends Candidate {
  user_name?: string;
  user_email?: string;
  answers?: CandidateAnswer[];
  answersLoaded?: boolean;
  vacancy_title?: string;
  vacancy_grade?: string;
  interview_result?: {
    report?: any;
    recommendation?: any;
    final_score?: number;
    status?: string;
  };
}

interface Vacancy {
  _id: string;
  title: string;
  grade: string;
  required_skills: string[];
  company_id: string;
  work_field?: string;
  min_experience?: number;
  max_experience?: number;
}

const CandidatesPage: React.FC = () => {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [candidates, setCandidates] = useState<ExtendedCandidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<ExtendedCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<ExtendedCandidate | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [openStatusDropdown, setOpenStatusDropdown] = useState<string | null>(null);
  
  // Состояния для видео
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const [loadingVideos, setLoadingVideos] = useState<Set<string>>(new Set());
  
  // Фильтры
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedVacancy, setSelectedVacancy] = useState<string>('all');

  // Состояние для скачивания резюме
  const [downloadingResume, setDownloadingResume] = useState(false);


  // Состояние для управления видимостью секций в модальном окне
  const [showAnswers, setShowAnswers] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [activeSection, setActiveSection] = useState<'answers' | 'results' | 'dashboard'>('answers');

  // Состояние для управления вкладками на главной странице
  const [activeTab, setActiveTab] = useState<'candidates' | 'analytics' | 'hh_responses'>('candidates');

  // Состояния для откликов HH.ru
  const [hhResponses, setHhResponses] = useState<any[]>([]);
  const [hhLoading, setHhLoading] = useState(false);
  const [hhError, setHhError] = useState('');
  const [hhPage, setHhPage] = useState(1);
  const [hhTotalPages, setHhTotalPages] = useState(1);
  const [hhTotal, setHhTotal] = useState(0);
  
  // Фильтры для откликов HH.ru
  const [hhSelectedVacancy, setHhSelectedVacancy] = useState<string>('all');
  
  // Модальное окно для отклика HH.ru
  const [selectedHhResponse, setSelectedHhResponse] = useState<any>(null);
  const [isHhModalOpen, setIsHhModalOpen] = useState(false);

  // Загрузка вакансий при монтировании компонента
  useEffect(() => {
    loadVacancies();
  }, []);

  // Загрузка откликов HH.ru
  const loadHhResponses = async (page: number = 1) => {
    setHhLoading(true);
    setHhError('');
    try {
      const response = await getHhResponses(page, 15);
      setHhResponses(response.responses);
      setHhTotalPages(response.total_pages);
      setHhTotal(response.total);
      setHhPage(page);
    } catch (error) {
      console.error('Ошибка при загрузке откликов HH.ru:', error);
      setHhError('Ошибка при загрузке откликов HH.ru');
    } finally {
      setHhLoading(false);
    }
  };

  // Загрузка откликов при переключении на вкладку
  useEffect(() => {
    if (activeTab === 'hh_responses') {
      loadHhResponses(1);
    }
  }, [activeTab]);

  // Фильтрация откликов HH.ru
  const filteredHhResponses = hhResponses.filter(response => {
    // Фильтр по вакансии
    if (hhSelectedVacancy !== 'all' && response.our_vacancy_id !== hhSelectedVacancy) {
      return false;
    }
    
    return true;
  });

  // Открытие модального окна с откликом HH.ru
  const openHhResponseModal = (response: any) => {
    setSelectedHhResponse(response);
    setIsHhModalOpen(true);
  };

  // Закрытие модального окна
  const closeHhResponseModal = () => {
    setSelectedHhResponse(null);
    setIsHhModalOpen(false);
  };

  // Закрытие дропдауна при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Закрываем только если клик не по кнопке фильтра и не по dropdown'у
      if (!target.closest('.filter-dropdown') && !target.closest('.status-dropdown')) {
        setOpenStatusDropdown(null);
      }
    };

    if (openStatusDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [openStatusDropdown]);

  // Загрузка кандидатов для всех вакансий после загрузки вакансий
  useEffect(() => {
    if (vacancies.length > 0) {
      loadAllCandidates();
    }
  }, [vacancies]);

  // Фильтрация кандидатов при изменении фильтров или кандидатов
  useEffect(() => {
    let filtered = [...candidates];

    // Фильтр по статусу
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(candidate => candidate.status === selectedStatus);
    }

    // Фильтр по вакансии
    if (selectedVacancy !== 'all') {
      filtered = filtered.filter(candidate => candidate.vacancy_id === selectedVacancy);
    }

    setFilteredCandidates(filtered);
  }, [candidates, selectedStatus, selectedVacancy]);

  const loadVacancies = async () => {
    try {
      const response = await getAllVacancies();
      if (response.success && response.data) {
        setVacancies(response.data.vacancies || []);
        console.log('Загружено вакансий:', response.data.vacancies?.length);
        console.log('Список вакансий:', response.data.vacancies?.map((v: any) => `${v.title} (ID: ${v._id})`));
      } else {
        setError(response.error || 'Ошибка загрузки вакансий');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
      console.error('Ошибка при загрузке вакансий:', err);
    }
  };

  const loadAllCandidates = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Загружаем кандидатов для всех вакансий компании');
      const allCandidates: ExtendedCandidate[] = [];
      
      // Загружаем кандидатов для каждой вакансии
      for (const vacancy of vacancies) {
        console.log(`Загружаем кандидатов для вакансии: ${vacancy.title} (ID: ${vacancy._id})`);
        const response = await getCandidatesForVacancy(vacancy._id);
        
        if (response.success && response.data) {
          const candidatesData = response.data.candidates || [];
          console.log(`Найдено кандидатов для ${vacancy.title}: ${candidatesData.length}`);
          
          // Добавляем информацию о вакансии к каждому кандидату
          const candidatesWithVacancy = candidatesData.map((candidate: ExtendedCandidate) => {
            // Парсим данные интервью
            const interviewScore = parseInterviewScore(candidate.interview_analysis);
            const interviewStatus = getInterviewStatus(candidate.interview_analysis);
            
            console.log(`Кандидат ${candidate.user_name}:`, {
              interview_analysis: candidate.interview_analysis,
              parsedScore: interviewScore,
              parsedStatus: interviewStatus,
              recommendation: (candidate as any).recommendation
            });
            
            return {
              ...candidate,
              answersLoaded: false,
              vacancy_title: vacancy.title,
              vacancy_grade: vacancy.grade,
              interview_result: candidate.interview_analysis ? {
                report: candidate.interview_analysis,
                recommendation: (candidate as any).recommendation, // recommendation хранится отдельно в базе
                final_score: interviewScore,
                status: interviewStatus
              } : (candidate as any).recommendation ? {
                // Если нет interview_analysis, но есть recommendation
                report: null,
                recommendation: (candidate as any).recommendation,
                final_score: null,
                status: 'Не завершено'
              } : undefined
            };
          });
          
          allCandidates.push(...candidatesWithVacancy);
        } else {
          console.error(`Ошибка загрузки кандидатов для ${vacancy.title}:`, response.error);
        }
      }
      
      // Сортируем кандидатов: сначала необработанные (completed), потом обработанные (accepted/rejected)
      const sortedCandidates = allCandidates.sort((a, b) => {
        const statusPriority = {
          'active': 0,
          'completed': 1,
          'test_task': 2,
          'finalist': 3,
          'offer': 4,
          'rejected': 5
        };
        
        const aPriority = statusPriority[a.status as keyof typeof statusPriority] ?? 3;
        const bPriority = statusPriority[b.status as keyof typeof statusPriority] ?? 3;
        
        return aPriority - bPriority;
      });
      
      setCandidates(sortedCandidates);
      console.log('Всего кандидатов загружено:', sortedCandidates.length);
      
    } catch (err) {
      console.error('Исключение при загрузке всех кандидатов:', err);
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  const loadCandidateAnswers = async (candidate: ExtendedCandidate) => {
    try {
      const response = await getCandidateAnswers(candidate._id);
      if (response.success && response.data) {
        const updatedCandidate = {
          ...candidate,
          answers: response.data.qna || [],
          answersLoaded: true,
          // Убеждаемся, что interview_analysis передается
          interview_analysis: candidate.interview_analysis
        };
        setSelectedCandidate(updatedCandidate);
        setShowDetailsModal(true);
        
        // Обновляем данные в массиве кандидатов
        setCandidates(prev => prev.map(c => 
          c._id === candidate._id ? updatedCandidate : c
        ));
      } else {
        setError(response.error || 'Ошибка загрузки ответов кандидата');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
      console.error('Ошибка при загрузке ответов кандидата:', err);
    }
  };

  const handleStatusUpdate = async (interviewId: string, status: 'rejected' | 'completed' | 'test_task' | 'finalist' | 'offer') => {
    try {
      const response = await updateCandidateStatus(interviewId, status);
      if (response.success) {
        // Обновляем статус в локальном состоянии и пересортировываем
        setCandidates(prev => {
          const updated = prev.map(c => 
            c._id === interviewId ? { ...c, status } : c
          );
          
          // Пересортировка после обновления статуса
          return updated.sort((a, b) => {
            const statusPriority = {
              'active': 0,
              'completed': 1,
              'test_task': 2,
              'finalist': 3,
              'offer': 4,
              'rejected': 5
            };
            
            const aPriority = statusPriority[a.status as keyof typeof statusPriority] ?? 3;
            const bPriority = statusPriority[b.status as keyof typeof statusPriority] ?? 3;
            
            return aPriority - bPriority;
          });
        });
        
        // Если модальное окно открыто, обновляем и его
        if (selectedCandidate && selectedCandidate._id === interviewId) {
          setSelectedCandidate(prev => prev ? { ...prev, status } : null);
        }
        
        console.log(`Статус кандидата обновлён на: ${status}`);
      } else {
        setError(response.error || 'Ошибка обновления статуса');
        console.error('Ошибка обновления статуса:', response.error);
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
      console.error('Ошибка при обновлении статуса:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { text: 'Активные', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      rejected: { text: 'Отклонённые', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
      completed: { text: 'Одобренные ИИ', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
      test_task: { text: 'Тестовое задание', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
      finalist: { text: 'Финалисты', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
      offer: { text: 'Оффер', color: 'bg-green-500/20 text-green-400 border-green-500/30' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        {config.text}
      </span>
    );
  };

  // Функция для скачивания резюме кандидата
  const handleDownloadResume = async () => {
    if (!selectedCandidate) return;

    try {
      setDownloadingResume(true);
      await downloadCandidateResume(selectedCandidate.user_id); // Используем новую функцию для кандидатов
    } catch (err) {
      console.error('Ошибка скачивания резюме:', err);
      alert('Ошибка при скачивании резюме');
    } finally {
      setDownloadingResume(false);
    }
  };


  const getScoreColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Функция для загрузки видео
  const handleLoadVideo = async (videoId: string) => {
    if (videoUrls[videoId] || loadingVideos.has(videoId)) {
      return; // Видео уже загружено или загружается
    }

    setLoadingVideos(prev => new Set(prev).add(videoId));
    
    try {
      const response = await getVideoPlaybackUrl(videoId);
      if (response.success && response.data?.hls_url) {
        setVideoUrls(prev => ({
          ...prev,
          [videoId]: response.data!.hls_url
        }));
      } else {
        setError(response.error || 'Ошибка загрузки видео');
      }
    } catch (err) {
      setError('Ошибка загрузки видео');
      console.error('Ошибка загрузки видео:', err);
    } finally {
      setLoadingVideos(prev => {
        const newSet = new Set(prev);
        newSet.delete(videoId);
        return newSet;
      });
    }
  };

  // Функция для переключения видео
  const toggleVideo = (videoId: string) => {
    if (expandedVideoId === videoId) {
      setExpandedVideoId(null);
    } else {
      setExpandedVideoId(videoId);
      handleLoadVideo(videoId);
    }
  };

  // Функция для парсинга процентов из отчета интервью
  const parseInterviewScore = (interviewAnalysis: any): number | null => {
    if (!interviewAnalysis) return null;
    
    // Если есть готовый final_score
    if (interviewAnalysis.final_score) {
      return interviewAnalysis.final_score;
    }
    
    // Если есть score
    if (interviewAnalysis.score) {
      return interviewAnalysis.score;
    }
    
    // Если interviewAnalysis - это строка (текстовый отчет)
    if (typeof interviewAnalysis === 'string') {
      // Ищем паттерн "ОБЩАЯ ОЦЕНКА: XX.X/100" или "ОБЩАЯ ОЦЕНКА: XX.X%"
      const scoreMatch = interviewAnalysis.match(/ОБЩАЯ ОЦЕНКА:\s*(\d+(?:\.\d+)?)(?:\/100|%)?/i);
      if (scoreMatch) {
        return parseFloat(scoreMatch[1]);
      }
      
      // Ищем паттерн "ОБЩАЯ ОЦЕНКА: XX.X%" в другом формате
      const scoreMatch2 = interviewAnalysis.match(/(\d+(?:\.\d+)?)%/);
      if (scoreMatch2) {
        return parseFloat(scoreMatch2[1]);
      }
    }
    
    // Пытаемся парсить из report (если это объект)
    if (interviewAnalysis.report && typeof interviewAnalysis.report === 'string') {
      // Ищем паттерн "ОБЩАЯ ОЦЕНКА: XX.X/100" или "ОБЩАЯ ОЦЕНКА: XX.X%"
      const scoreMatch = interviewAnalysis.report.match(/ОБЩАЯ ОЦЕНКА:\s*(\d+(?:\.\d+)?)(?:\/100|%)?/i);
      if (scoreMatch) {
        return parseFloat(scoreMatch[1]);
      }
      
      // Ищем паттерн "ОБЩАЯ ОЦЕНКА: XX.X%" в другом формате
      const scoreMatch2 = interviewAnalysis.report.match(/(\d+(?:\.\d+)?)%/);
      if (scoreMatch2) {
        return parseFloat(scoreMatch2[1]);
      }
    }
    
    return null;
  };

  // Функция для определения статуса интервью
  const getInterviewStatus = (interviewAnalysis: any): string => {
    if (!interviewAnalysis) return 'Не завершено';
    
    // Если есть готовый статус
    if (interviewAnalysis.status) {
      return interviewAnalysis.status;
    }
    
    // Если interviewAnalysis - это строка (текстовый отчет)
    if (typeof interviewAnalysis === 'string') {
      // Ищем паттерн "РЕШЕНИЕ: XXX"
      const decisionMatch = interviewAnalysis.match(/РЕШЕНИЕ:\s*(\w+)/i);
      if (decisionMatch) {
        const decision = decisionMatch[1].toUpperCase();
        if (decision === 'HIRE') return 'Одобрен';
        if (decision === 'MAYBE') return 'На рассмотрении';
        if (decision === 'REJECT') return 'Отклонен';
        return decision;
      }
    }
    
    // Пытаемся парсить из report (если это объект)
    if (interviewAnalysis.report && typeof interviewAnalysis.report === 'string') {
      // Ищем паттерн "РЕШЕНИЕ: XXX"
      const decisionMatch = interviewAnalysis.report.match(/РЕШЕНИЕ:\s*(\w+)/i);
      if (decisionMatch) {
        const decision = decisionMatch[1].toUpperCase();
        if (decision === 'HIRE') return 'Одобрен';
        if (decision === 'MAYBE') return 'На рассмотрении';
        if (decision === 'REJECT') return 'Отклонен';
        return decision;
      }
    }
    
    return 'Не завершено';
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
    
    // Пытаемся парсить из report (если это объект)
    if (interviewAnalysis.report && typeof interviewAnalysis.report === 'string') {
      // Ищем паттерн "📄 ОБЩАЯ ХАРАКТЕРИСТИКА:" и текст после него
      const assessmentMatch = interviewAnalysis.report.match(/📄 ОБЩАЯ ХАРАКТЕРИСТИКА:\s*\n(.*?)(?=\n\n|✅|⚠️|🔧|🔍|🚨|📚|💼|⚠️|🚀|$)/s);
      if (assessmentMatch) {
        return assessmentMatch[1].trim();
      }
    }
    
    return null;
  };

  const getAvailableStatuses = (currentStatus: string) => {
    // Определяем, какие статусы доступны для изменения в зависимости от текущего
    if (currentStatus === 'active') {
      return []; // Активные интервью нельзя менять вручную
    }
    
    // Для всех остальных статусов (включая rejected) можно менять на любой HR статус
    const allStatuses = [
      { value: 'rejected', label: 'Отклонённые' },
      { value: 'completed', label: 'Одобренные ИИ' },
      { value: 'test_task', label: 'Тестовое задание' },
      { value: 'finalist', label: 'Финалисты' },
      { value: 'offer', label: 'Оффер' }
    ];
    
    // Исключаем текущий статус из списка доступных
    return allStatuses.filter(status => status.value !== currentStatus);
  };

  return (
    <div className="min-h-screen bg-dark-950 relative overflow-hidden">
      {/* Фон как в VacanciesListPage */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute top-1/4 -left-48 w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.04) 30%, rgba(59, 130, 246, 0.01) 60%, transparent 100%)',
            filter: 'blur(60px)'
          }}
        ></div>
        <div 
          className="absolute bottom-1/4 -right-48 w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.06) 0%, rgba(139, 92, 246, 0.03) 30%, rgba(139, 92, 246, 0.008) 60%, transparent 100%)',
            filter: 'blur(60px)'
          }}
        ></div>
        <div 
          className="absolute top-3/4 left-1/3 w-64 h-64 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.04) 0%, rgba(16, 185, 129, 0.02) 30%, rgba(16, 185, 129, 0.005) 60%, transparent 100%)',
            filter: 'blur(50px)'
          }}
        ></div>
      </div>

      <TopPanel />
      
      <div className="relative z-10 pt-36 pb-20 px-6">
        <div className="w-full max-w-6xl mx-auto">

          {/* Заголовок */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-light text-white">
                  {activeTab === 'candidates' ? 'Кандидаты' : 
                   activeTab === 'analytics' ? 'Аналитика компании' : 
                   'Отклики HH.ru'}
                </h2>
                <p className="text-dark-400 text-sm mt-1">
                  {activeTab === 'candidates' 
                    ? `${filteredCandidates.length} из ${candidates.length} кандидатов`
                    : activeTab === 'analytics'
                    ? 'Общая статистика по всем кандидатам и процессу найма'
                    : 'Все отклики кандидатов с сайта hh.ru'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Вкладки и фильтры */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {/* Вкладки */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActiveTab('candidates')}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                    activeTab === 'candidates'
                      ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30'
                      : 'bg-dark-800/50 text-dark-300 border border-dark-600/50 hover:bg-dark-700/50 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                    <span>Кандидаты</span>
                  </div>
                </button>
                
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                    activeTab === 'analytics'
                      ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30'
                      : 'bg-dark-800/50 text-dark-300 border border-dark-600/50 hover:bg-dark-700/50 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                    </svg>
                    <span>Аналитика</span>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('hh_responses')}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                    activeTab === 'hh_responses'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-dark-800/50 text-dark-300 border border-dark-600/50 hover:bg-dark-700/50 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <img src="/hh.png" alt="HH.ru" className="w-4 h-4 rounded" />
                    <span>Отклики HH.ru</span>
                  </div>
                </button>
              </div>

              {/* Фильтры и действия */}
              {activeTab === 'candidates' && (
                <div className="flex items-center space-x-4">
                {/* Фильтр по статусу */}
                <div className="relative filter-dropdown">
                  <button
                    onClick={() => setOpenStatusDropdown(openStatusDropdown === 'status' ? null : 'status')}
                    className="px-4 py-2 rounded-full text-sm font-medium border bg-dark-800/50 text-white border-dark-600/50 hover:opacity-80 transition-opacity cursor-pointer min-w-[160px] flex items-center justify-between"
                  >
                    <span>
                      {selectedStatus === 'all' ? 'Все статусы' :
                       selectedStatus === 'active' ? 'Активные' :
                       selectedStatus === 'rejected' ? 'Отклонённые' :
                       selectedStatus === 'completed' ? 'Одобренные ИИ' :
                       selectedStatus === 'test_task' ? 'Тестовое задание' :
                       selectedStatus === 'finalist' ? 'Финалисты' :
                       selectedStatus === 'offer' ? 'Оффер' : 'Все статусы'}
                    </span>
                    <svg className="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {openStatusDropdown === 'status' && (
                    <div className="absolute top-full left-0 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-lg z-50 min-w-[160px]">
                      <button
                        onClick={() => {
                          setSelectedStatus('all');
                          setOpenStatusDropdown(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors first:rounded-t-lg"
                      >
                        Все статусы
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStatus('active');
                          setOpenStatusDropdown(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors"
                      >
                        Активные
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStatus('rejected');
                          setOpenStatusDropdown(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors"
                      >
                        Отклонённые
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStatus('completed');
                          setOpenStatusDropdown(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors"
                      >
                        Одобренные ИИ
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStatus('test_task');
                          setOpenStatusDropdown(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors"
                      >
                        Тестовое задание
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStatus('finalist');
                          setOpenStatusDropdown(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors"
                      >
                        Финалисты
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStatus('offer');
                          setOpenStatusDropdown(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors last:rounded-b-lg"
                      >
                        Оффер
                      </button>
                    </div>
                  )}
                </div>

                {/* Фильтр по вакансии */}
                <div className="relative filter-dropdown">
                  <button
                    onClick={() => setOpenStatusDropdown(openStatusDropdown === 'vacancy' ? null : 'vacancy')}
                    className="px-4 py-2 rounded-full text-sm font-medium border bg-dark-800/50 text-white border-dark-600/50 hover:opacity-80 transition-opacity cursor-pointer min-w-[200px] flex items-center justify-between"
                  >
                    <span>
                      {selectedVacancy === 'all' ? 'Все вакансии' : 
                       vacancies.find(v => v._id === selectedVacancy)?.title + ' • ' + vacancies.find(v => v._id === selectedVacancy)?.grade || 'Все вакансии'}
                    </span>
                    <svg className="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {openStatusDropdown === 'vacancy' && (
                    <div className="absolute top-full left-0 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-lg z-50 min-w-[200px]">
                      <button
                        onClick={() => {
                          setSelectedVacancy('all');
                          setOpenStatusDropdown(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors first:rounded-t-lg"
                      >
                        Все вакансии
                      </button>
                      {vacancies.map((vacancy) => (
                        <button
                          key={vacancy._id}
                          onClick={() => {
                            setSelectedVacancy(vacancy._id);
                            setOpenStatusDropdown(null);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors last:rounded-b-lg"
                        >
                          {vacancy.title} • {vacancy.grade}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                </div>
              )}

              {/* Фильтры для откликов HH.ru */}
              {activeTab === 'hh_responses' && (
                <div className="flex items-center space-x-4">
                  {/* Фильтр по вакансии */}
                  <div className="relative filter-dropdown">
                    <button
                      onClick={() => setOpenStatusDropdown(openStatusDropdown === 'hh_vacancy' ? null : 'hh_vacancy')}
                      className="px-4 py-2 rounded-full text-sm font-medium border bg-dark-800/50 text-white border-dark-600/50 hover:opacity-80 transition-opacity cursor-pointer min-w-[200px] flex items-center justify-between"
                    >
                      <span>
                        {hhSelectedVacancy === 'all' ? 'Все вакансии' : 
                         vacancies.find(v => v._id === hhSelectedVacancy)?.title + ' • ' + vacancies.find(v => v._id === hhSelectedVacancy)?.grade || 'Все вакансии'}
                      </span>
                      <svg className="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {openStatusDropdown === 'hh_vacancy' && (
                      <div className="absolute top-full left-0 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-lg z-50 min-w-[200px]">
                        <button
                          onClick={() => {
                            setHhSelectedVacancy('all');
                            setOpenStatusDropdown(null);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors first:rounded-t-lg"
                        >
                          Все вакансии
                        </button>
                        {vacancies.map((vacancy) => (
                          <button
                            key={vacancy._id}
                            onClick={() => {
                              setHhSelectedVacancy(vacancy._id);
                              setOpenStatusDropdown(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors last:rounded-b-lg"
                          >
                            {vacancy.title} • {vacancy.grade}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          </div>

          {/* Сообщения об ошибках */}
          {error && (
            <div className="glass rounded-2xl p-6 border border-red-500/30 mb-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Ошибка загрузки</h3>
                <p className="text-red-400">{error}</p>
              </div>
            </div>
          )}

          {/* Индикатор загрузки */}
          {loading && activeTab === 'candidates' && (
            <div className="glass rounded-2xl p-12 border border-dark-600/30 mb-8">
              <div className="flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-blue mb-4"></div>
                <span className="text-dark-300 text-lg">Загрузка кандидатов...</span>
              </div>
            </div>
          )}

          {/* Контент в зависимости от активной вкладки */}
          {activeTab === 'candidates' && (
            <>
              {/* Список кандидатов как в VacanciesListPage */}
              {!loading && (
            <div className="space-y-6">
              {filteredCandidates.length === 0 ? (
                <div className="glass rounded-3xl p-8 border border-dark-600/30">
                  <div className="text-center">
                    <h3 className="text-xl text-white mb-2">Кандидаты не найдены</h3>
                    <p className="text-dark-400">
                      {candidates.length === 0 
                        ? "По вакансиям компании пока нет кандидатов"
                        : "По выбранным фильтрам кандидаты не найдены"
                      }
                    </p>
                  </div>
                </div>
              ) : (
                filteredCandidates.map((candidate, index) => (
                  <div
                    key={candidate._id}
                    className="cursor-pointer glass rounded-2xl p-6 border border-dark-600/30 hover:border-accent-blue/50 transition-all duration-300 hover:scale-105 group animate-stagger-fade-in text-left"
                    style={{
                      animationDelay: `${index * 0.1}s`
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-accent-blue to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {candidate.user_name?.charAt(0) || 'У'}
                            </span>
                          </div>
                          <h3 className="text-xl font-semibold text-white group-hover:text-accent-blue transition-colors">
                            {candidate.user_name || 'Пользователь'}
                          </h3>
                          
                          {/* Дропдаун статуса */}
                          <div className="relative status-dropdown">
                            {getAvailableStatuses(candidate.status).length > 0 ? (
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenStatusDropdown(openStatusDropdown === candidate._id ? null : candidate._id);
                                  }}
                                  className={`px-3 py-1 rounded-full text-xs font-medium border cursor-pointer hover:opacity-80 transition-opacity ${
                                    candidate.status === 'active' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                    candidate.status === 'rejected' ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' :
                                    candidate.status === 'completed' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                                    candidate.status === 'test_task' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                                    candidate.status === 'finalist' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                    candidate.status === 'offer' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                    'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                  }`}
                                >
                                  {getStatusBadge(candidate.status).props.children}
                                  <svg className="w-3 h-3 ml-1 inline" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </button>
                                
                                {openStatusDropdown === candidate._id && (
                                  <div className="absolute top-full left-0 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-lg z-50 min-w-[160px]">
                                    {getAvailableStatuses(candidate.status).map((status) => (
                                      <button
                                        key={status.value}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStatusUpdate(candidate._id, status.value as 'rejected' | 'completed' | 'test_task' | 'finalist' | 'offer');
                                          setOpenStatusDropdown(null);
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
                                      >
                                        {status.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              getStatusBadge(candidate.status)
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4 mb-4">
                          <span className="text-dark-300 font-medium">{candidate.user_email || 'user@example.com'}</span>
                          <span className="text-dark-500">•</span>
                          {candidate.vacancy_title && (
                            <>
                              <span className="text-dark-400">{candidate.vacancy_title}</span>
                              <span className="text-dark-500">•</span>
                              <span className="text-dark-400">{candidate.vacancy_grade}</span>
                            </>
                          )}
                          {candidate.resume_score && (
                            <>
                              <span className="text-dark-500">•</span>
                              <span className={`font-medium ${getScoreColor(candidate.resume_score)}`}>
                                Резюме: {candidate.resume_score}%
                              </span>
                            </>
                          )}
                          {candidate.interview_result && (
                            <>
                              <span className="text-dark-500">•</span>
                              <span className={`font-medium ${getScoreColor(candidate.interview_result.final_score)}`}>
                                Интервью: {candidate.interview_result.final_score ? `${candidate.interview_result.final_score}%` : 'N/A'}
                              </span>
                              {candidate.interview_result.status && (
                                <>
                                  <span className="text-dark-500">•</span>
                                  <span className="text-dark-400 text-sm">
                                    {candidate.interview_result.status}
                                  </span>
                                </>
                              )}
                            </>
                          )}
                        </div>

                        {/* Рекомендация */}
                        {candidate.interview_result?.recommendation && (
                          <div className="mt-3 p-3 bg-dark-800/30 rounded-lg border border-dark-600/30">
                            <h4 className="text-white text-sm font-medium mb-2">Рекомендация AI:</h4>
                            <p className="text-dark-300 text-sm leading-relaxed">
                              {getOverallAssessment(candidate.interview_analysis) || 
                               (typeof candidate.interview_result.recommendation === 'string' 
                                ? candidate.interview_result.recommendation 
                                : JSON.stringify(candidate.interview_result.recommendation, null, 2))
                              }
                            </p>
                          </div>
                        )}

                      </div>

                      <div className="ml-6 flex-shrink-0">
                        <button
                          onClick={() => loadCandidateAnswers(candidate)}
                          className="group relative overflow-hidden px-4 py-2.5 rounded-xl bg-dark-700/50 hover:bg-gradient-to-r hover:from-accent-blue hover:to-accent-purple text-dark-300 hover:text-white transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-accent-blue/20 border border-dark-600/50 hover:border-transparent"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer"></div>
                          <span className="relative z-10 text-sm font-medium">Просмотреть ответы</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
              )}
            </>
          )}

          {/* Вкладка аналитики */}
          {activeTab === 'analytics' && (
            <CompanyDashboard candidates={candidates} vacancies={vacancies} />
          )}

          {/* Контент для откликов HH.ru */}
          {activeTab === 'hh_responses' && (
            <div>
              {hhLoading ? (
                <div className="glass rounded-2xl p-12 border border-dark-600/30">
                  <div className="flex flex-col items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-blue mb-4"></div>
                    <span className="text-dark-300 text-lg">Загрузка откликов...</span>
                  </div>
                </div>
              ) : hhError ? (
                <div className="glass rounded-2xl p-6 border border-red-500/30">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">Ошибка загрузки</h3>
                    <p className="text-red-400">{hhError}</p>
                  </div>
                </div>
              ) : (
                <div>
                  {/* Статистика */}
                  <div className="mb-8 glass rounded-2xl p-6 border border-dark-600/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {filteredHhResponses.length === hhResponses.length ? 'Всего откликов' : 'Отфильтровано откликов'}
                        </h3>
                        <p className="text-2xl font-bold text-red-400">
                          {filteredHhResponses.length === hhResponses.length ? hhTotal : filteredHhResponses.length}
                          {filteredHhResponses.length !== hhResponses.length && (
                            <span className="text-sm text-dark-400 ml-2">из {hhResponses.length}</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-dark-400">Страница {hhPage} из {hhTotalPages}</p>
                      </div>
                    </div>
                  </div>

                  {/* Список откликов */}
                  {filteredHhResponses.length === 0 ? (
                    <div className="glass rounded-3xl p-8 border border-dark-600/30">
                      <div className="text-center">
                        <h3 className="text-xl text-white mb-2">Откликов не найдено</h3>
                        <p className="text-dark-400">
                          {hhResponses.length === 0 
                            ? "Пока нет откликов с сайта hh.ru"
                            : "По выбранным фильтрам отклики не найдены"
                          }
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {filteredHhResponses.map((response, index) => (
                        <div 
                          key={response._id} 
                          onClick={() => openHhResponseModal(response)}
                          className="cursor-pointer glass rounded-2xl p-6 border border-dark-600/30 hover:border-red-500/50 transition-all duration-300 hover:scale-105 group animate-stagger-fade-in"
                          style={{
                            animationDelay: `${index * 0.1}s`
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-3">
                                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                                  <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                  </svg>
                                </div>
                                <div>
                                  <h3 className="text-lg font-semibold text-white">
                                    {response.resume_data?.first_name || 'Неизвестно'} {response.resume_data?.last_name || ''}
                                  </h3>
                                  <p className="text-dark-400">Вакансия: {response.vacancy_name}</p>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                  <p className="text-sm text-dark-400 mb-1">Возраст</p>
                                  <p className="text-white">{response.resume_data?.age || 'Не указан'}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-dark-400 mb-1">Город</p>
                                  <p className="text-white">{response.resume_data?.area?.name || 'Не указан'}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-dark-400 mb-1">Желаемая должность</p>
                                  <p className="text-white">{response.resume_data?.title || 'Не указана'}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-dark-400 mb-1">Дата отклика</p>
                                  <p className="text-white">
                                    {new Date(response.created_at).toLocaleDateString('ru-RU')}
                                  </p>
                                </div>
                              </div>

                              {response.resume_data?.salary && (
                                <div className="mb-4">
                                  <p className="text-sm text-dark-400 mb-1">Зарплатные ожидания</p>
                                  <p className="text-white">
                                    {response.resume_data.salary.from && response.resume_data.salary.to 
                                      ? `${response.resume_data.salary.from} - ${response.resume_data.salary.to} ${response.resume_data.salary.currency || 'руб.'}`
                                      : response.resume_data.salary.from 
                                      ? `от ${response.resume_data.salary.from} ${response.resume_data.salary.currency || 'руб.'}`
                                      : 'Не указано'
                                    }
                                  </p>
                                </div>
                              )}

                              {response.resume_data?.skills && Array.isArray(response.resume_data.skills) && response.resume_data.skills.length > 0 && (
                                <div className="mb-4">
                                  <p className="text-sm text-dark-400 mb-2">Навыки</p>
                                  <div className="flex flex-wrap gap-2">
                                    {response.resume_data.skills.slice(0, 5).map((skill: any, index: number) => (
                                      <span key={index} className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs">
                                        {skill.name || skill}
                                      </span>
                                    ))}
                                    {response.resume_data.skills.length > 5 && (
                                      <span className="px-2 py-1 bg-dark-700/50 text-dark-300 rounded-full text-xs">
                                        +{response.resume_data.skills.length - 5} еще
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Кнопки для резюме */}
                              <div className="flex items-center space-x-3 mt-4" onClick={(e) => e.stopPropagation()}>
                                {response.resume_data?.alternate_url && (
                                  <a
                                    href={response.resume_data.alternate_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm font-medium"
                                  >
                                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                                    </svg>
                                    Посмотреть
                                  </a>
                                )}
                                
                                {response.resume_data?.download?.pdf?.url && (
                                  <a
                                    href={convertHhResumeUrl(response.resume_data.download.pdf.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm font-medium"
                                  >
                                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                                    </svg>
                                    Скачать PDF
                                  </a>
                                )}
                              </div>
                            </div>
                            
                            <div className="ml-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                response.negotiation_state?.id === 'response' 
                                  ? 'bg-green-500/20 text-green-400' 
                                  : 'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {response.negotiation_state?.name || 'Новый отклик'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Пагинация */}
                  {hhTotalPages > 1 && (
                    <div className="flex items-center justify-center space-x-2 mt-8">
                      <button
                        onClick={() => loadHhResponses(hhPage - 1)}
                        disabled={hhPage === 1}
                        className="group relative overflow-hidden px-6 py-3 rounded-xl bg-dark-700/50 hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 text-dark-300 hover:text-white transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-red-500/20 border border-dark-600/50 hover:border-transparent disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer"></div>
                        <span className="relative z-10 text-sm font-medium">Назад</span>
                      </button>
                      
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.min(5, hhTotalPages) }, (_, i) => {
                          const pageNum = Math.max(1, Math.min(hhTotalPages - 4, hhPage - 2)) + i;
                          if (pageNum > hhTotalPages) return null;
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => loadHhResponses(pageNum)}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 ${
                                pageNum === hhPage
                                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                                  : 'bg-dark-800/50 text-dark-300 hover:bg-dark-700/50 hover:text-white border border-dark-600/50 hover:border-red-500/30'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      
                      <button
                        onClick={() => loadHhResponses(hhPage + 1)}
                        disabled={hhPage === hhTotalPages}
                        className="group relative overflow-hidden px-6 py-3 rounded-xl bg-dark-700/50 hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 text-dark-300 hover:text-white transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-red-500/20 border border-dark-600/50 hover:border-transparent disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer"></div>
                        <span className="relative z-10 text-sm font-medium">Вперед</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно с деталями кандидата */}
      {showDetailsModal && selectedCandidate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl border border-dark-600/30 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8 border-b border-dark-600/30 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-light text-white mb-2">
                  {selectedCandidate.user_name || 'Детали кандидата'}
                </h2>
                <p className="text-dark-400">{selectedCandidate.user_email}</p>
                {selectedCandidate.vacancy_title && (
                  <p className="text-accent-blue text-sm mt-1">{selectedCandidate.vacancy_title} • {selectedCandidate.vacancy_grade}</p>
                )}
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-10 h-10 glass rounded-full border border-dark-600/30 text-dark-400 hover:text-white hover:border-accent-blue/50 transition-all duration-300 flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              {/* Статистика */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-dark-700/30 p-4 rounded-lg">
                  <p className="text-dark-300 text-sm">Статус</p>
                  <div className="mt-2">
                    {/* Дропдаун статуса в модальном окне */}
                    {getAvailableStatuses(selectedCandidate.status).length > 0 ? (
                      <div className="relative status-dropdown">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenStatusDropdown(openStatusDropdown === `modal_${selectedCandidate._id}` ? null : `modal_${selectedCandidate._id}`);
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-medium border cursor-pointer hover:opacity-80 transition-opacity ${
                            selectedCandidate.status === 'active' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                            selectedCandidate.status === 'rejected' ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' :
                            selectedCandidate.status === 'completed' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                            selectedCandidate.status === 'test_task' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                            selectedCandidate.status === 'finalist' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                            selectedCandidate.status === 'offer' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                            'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          }`}
                        >
                          {getStatusBadge(selectedCandidate.status).props.children}
                          <svg className="w-3 h-3 ml-1 inline" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                        
                        {openStatusDropdown === `modal_${selectedCandidate._id}` && (
                          <div className="absolute top-full left-0 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-lg z-50 min-w-[160px]">
                            {getAvailableStatuses(selectedCandidate.status).map((status) => (
                              <button
                                key={status.value}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusUpdate(selectedCandidate._id, status.value as 'rejected' | 'completed' | 'test_task' | 'finalist' | 'offer');
                                  setOpenStatusDropdown(null);
                                  // Обновляем статус в selectedCandidate для мгновенного отображения
                                  setSelectedCandidate(prev => prev ? {...prev, status: status.value} : null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
                              >
                                {status.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      getStatusBadge(selectedCandidate.status)
                    )}
                  </div>
                </div>
                
                {selectedCandidate.resume_score && (
                  <div className="bg-dark-700/30 p-4 rounded-lg">
                    <p className="text-dark-300 text-sm">Оценка резюме</p>
                    <p className={`text-2xl font-bold mt-1 ${getScoreColor(selectedCandidate.resume_score)}`}>
                      {selectedCandidate.resume_score}%
                    </p>
                  </div>
                )}

                {selectedCandidate.interview_result && (
                  <div className="bg-dark-700/30 p-4 rounded-lg">
                    <p className="text-dark-300 text-sm">Оценка интервью</p>
                    <p className={`text-2xl font-bold mt-1 ${getScoreColor(selectedCandidate.interview_result.final_score)}`}>
                      {selectedCandidate.interview_result.final_score ? `${selectedCandidate.interview_result.final_score}%` : 'N/A'}
                    </p>
                    {selectedCandidate.interview_result.status && (
                      <p className="text-dark-400 text-sm mt-1">
                        {selectedCandidate.interview_result.status}
                      </p>
                    )}
                  </div>
                )}
                
                <div className="bg-dark-700/30 p-4 rounded-lg">
                  <p className="text-dark-300 text-sm">Количество ответов</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {selectedCandidate.answers?.length || 0}
                  </p>
                </div>
               </div>

               {/* Действия с кандидатом */}
               <div className="mb-6">
                 <h3 className="text-lg font-semibold text-white mb-4">Действия</h3>
                 <div className="flex items-center justify-between gap-3">
                   <button
                     onClick={handleDownloadResume}
                     disabled={downloadingResume}
                     className="flex items-center space-x-2 px-4 py-2 bg-accent-blue/20 hover:bg-accent-blue/30 border border-accent-blue/30 hover:border-accent-blue/50 text-accent-blue rounded-lg font-medium transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     {downloadingResume ? (
                       <>
                         <div className="w-4 h-4 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin"></div>
                         <span>Скачивание...</span>
                       </>
                     ) : (
                       <>
                         <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                           <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                         </svg>
                         <span>Скачать резюме</span>
                       </>
                     )}
                   </button>

                   <div className="flex items-center gap-3 ml-auto">
                     <button
                       onClick={() => {
                         setShowAnswers(true);
                         setShowResults(false);
                         setActiveSection('answers');
                       }}
                       className={`flex items-center space-x-2 px-4 py-2 border rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                         activeSection === 'answers'
                           ? 'bg-emerald-500/30 border-emerald-500/50 text-emerald-400' 
                           : 'bg-dark-700/50 border-dark-600/50 text-dark-300 hover:bg-dark-700/70 hover:text-white'
                       }`}
                     >
                       <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                         <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                       </svg>
                       <span>Ответы</span>
                     </button>
                     <button
                       onClick={() => {
                         setShowAnswers(false);
                         setShowResults(true);
                         setActiveSection('results');
                       }}
                       className={`flex items-center space-x-2 px-4 py-2 border rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                         activeSection === 'results'
                           ? 'bg-purple-500/30 border-purple-500/50 text-purple-400' 
                           : 'bg-dark-700/50 border-dark-600/50 text-dark-300 hover:bg-dark-700/70 hover:text-white'
                       }`}
                     >
                       <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                         <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z"/>
                       </svg>
                       <span>Результат</span>
                     </button>
                     <button
                       onClick={() => {
                         setShowAnswers(false);
                         setShowResults(false);
                         setActiveSection('dashboard');
                       }}
                       className={`flex items-center space-x-2 px-4 py-2 border rounded-lg font-medium transition-all duration-300 hover:scale-105 ${
                         activeSection === 'dashboard'
                           ? 'bg-accent-blue/30 border-accent-blue/50 text-accent-blue' 
                           : 'bg-dark-700/50 border-dark-600/50 text-dark-300 hover:bg-dark-700/70 hover:text-white'
                       }`}
                     >
                       <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                         <path d="M3,13H11V3H3M3,21H11V15H3M13,21H21V11H13M13,3V9H21V3"/>
                       </svg>
                       <span>Дэшборды</span>
                     </button>
                   </div>
                 </div>
               </div>

               {/* Ответы кандидата */}
               {showAnswers && (
                 <div>
                   <h3 className="text-lg font-semibold text-white mb-4">Ответы на вопросы</h3>
                   
                   {!selectedCandidate.answers || selectedCandidate.answers.length === 0 ? (
                     <div className="text-center py-8">
                       <p className="text-dark-300">Ответы кандидата не найдены</p>
                     </div>
                   ) : (
                     <div className="space-y-4">
                       {selectedCandidate.answers.map((answer, index) => (
                         <div key={answer._id} className="bg-dark-700/30 p-4 rounded-lg">
                           <div className="mb-3">
                             <h4 className="text-white font-medium mb-2">
                               Вопрос {index + 1}:
                             </h4>
                             <p className="text-blue-300 italic">{answer.question}</p>
                           </div>
                           
                           <div>
                             <h4 className="text-white font-medium mb-2">Ответ:</h4>
                             <p className="text-dark-300 leading-relaxed">{answer.answer_text}</p>
                           </div>
                           
                           {/* Анализ речи */}
                           <VoiceAnalysisDisplay analysis={answer.voice_analysis} />
                           
                           {/* Видео ответа */}
                           {answer.video_id && (
                             <div className="mt-4">
                               <button
                                 onClick={() => answer.video_id && toggleVideo(answer.video_id)}
                                 className="flex items-center space-x-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 hover:border-blue-500/50 text-blue-400 rounded-lg font-medium transition-all duration-300 hover:scale-105"
                               >
                                 {loadingVideos.has(answer.video_id) ? (
                                   <>
                                     <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                                     <span>Загрузка...</span>
                                   </>
                                 ) : (
                                   <>
                                     <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                       <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                                     </svg>
                                     <span>{expandedVideoId === answer.video_id ? 'Скрыть видео' : 'Показать видео'}</span>
                                   </>
                                 )}
                               </button>
                               
                               {expandedVideoId === answer.video_id && videoUrls[answer.video_id] && (
                                 <div className="mt-4 max-w-md">
                                   <YandexVideoPlayer
                                     src={videoUrls[answer.video_id]}
                                   />
                                 </div>
                               )}
                             </div>
                           )}
                         </div>
                       ))}
                     </div>
                   )}
                 </div>
               )}

               {/* Результаты интервью */}
               {showResults && selectedCandidate.interview_result && (
                 <div>
                   <h3 className="text-lg font-semibold text-white mb-4">Результаты интервью</h3>
                   
                   {selectedCandidate.interview_result.recommendation && (
                     <div className="bg-dark-700/30 p-4 rounded-lg mb-4">
                       <h4 className="text-white font-medium mb-2">Рекомендация:</h4>
                       <p className="text-dark-300 leading-relaxed">
                         {getOverallAssessment(selectedCandidate.interview_analysis) || 
                          (typeof selectedCandidate.interview_result.recommendation === 'string' 
                           ? selectedCandidate.interview_result.recommendation 
                           : JSON.stringify(selectedCandidate.interview_result.recommendation, null, 2))
                         }
                       </p>
                     </div>
                   )}

                   {selectedCandidate.interview_result.report && (
                     <div className="bg-dark-700/30 p-4 rounded-lg">
                       <h4 className="text-white font-medium mb-2">Отчёт:</h4>
                       <div className="text-dark-300 leading-relaxed whitespace-pre-wrap">
                         {typeof selectedCandidate.interview_result.report === 'string' 
                           ? selectedCandidate.interview_result.report 
                           : JSON.stringify(selectedCandidate.interview_result.report, null, 2)
                         }
                       </div>
                     </div>
                   )}
                 </div>
               )}

               {/* Дэшборд аналитики */}
               {activeSection === 'dashboard' && (
                 <div>
                   <CandidateDashboard candidate={selectedCandidate} />
                 </div>
               )}
              
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для отклика HH.ru */}
      {isHhModalOpen && selectedHhResponse && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl border border-dark-600/30 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8 border-b border-dark-600/30 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-light text-white mb-2">
                  {selectedHhResponse.resume_data?.first_name || 'Неизвестно'} {selectedHhResponse.resume_data?.last_name || ''}
                </h2>
                <p className="text-dark-400">Вакансия: {selectedHhResponse.vacancy_name}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <img src="/hh.png" alt="HH.ru" className="w-4 h-4 rounded ml-0.5" />
                  <span className="text-red-400 text-sm">Отклик с HH.ru</span>
                </div>
              </div>
              <button
                onClick={closeHhResponseModal}
                className="w-10 h-10 glass rounded-full border border-dark-600/30 text-dark-400 hover:text-white hover:border-red-500/50 transition-all duration-300 flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">

              {/* Статистика */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-dark-700/30 p-4 rounded-lg">
                  <p className="text-dark-300 text-sm">Возраст</p>
                  <p className="text-white text-lg font-medium mt-1">{selectedHhResponse.resume_data?.age || 'Не указан'}</p>
                </div>
                <div className="bg-dark-700/30 p-4 rounded-lg">
                  <p className="text-dark-300 text-sm">Город</p>
                  <p className="text-white text-lg font-medium mt-1">{selectedHhResponse.resume_data?.area?.name || 'Не указан'}</p>
                </div>
                <div className="bg-dark-700/30 p-4 rounded-lg">
                  <p className="text-dark-300 text-sm">Опыт работы</p>
                  <p className="text-white text-lg font-medium mt-1">
                    {selectedHhResponse.resume_data?.total_experience?.months 
                      ? `${Math.floor(selectedHhResponse.resume_data.total_experience.months / 12)} лет ${selectedHhResponse.resume_data.total_experience.months % 12} мес.`
                      : 'Не указан'
                    }
                  </p>
                </div>
              </div>

              {/* Дополнительная информация */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-dark-700/30 p-4 rounded-lg">
                  <p className="text-dark-300 text-sm mb-2">Желаемая должность</p>
                  <p className="text-white font-medium">{selectedHhResponse.resume_data?.title || 'Не указана'}</p>
                </div>
                <div className="bg-dark-700/30 p-4 rounded-lg">
                  <p className="text-dark-300 text-sm mb-2">Статус отклика</p>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedHhResponse.negotiation_state?.id === 'response' 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                      : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  }`}>
                    {selectedHhResponse.negotiation_state?.name || 'Новый отклик'}
                  </span>
                </div>
              </div>

              {selectedHhResponse.resume_data?.salary && (
                <div className="bg-dark-700/30 p-4 rounded-lg mb-6">
                  <p className="text-dark-300 text-sm mb-2">Зарплатные ожидания</p>
                  <p className="text-white text-lg font-medium">
                    {selectedHhResponse.resume_data.salary.from && selectedHhResponse.resume_data.salary.to 
                      ? `${selectedHhResponse.resume_data.salary.from} - ${selectedHhResponse.resume_data.salary.to} ${selectedHhResponse.resume_data.salary.currency || 'руб.'}`
                      : selectedHhResponse.resume_data.salary.from 
                      ? `от ${selectedHhResponse.resume_data.salary.from} ${selectedHhResponse.resume_data.salary.currency || 'руб.'}`
                      : 'Не указано'
                    }
                  </p>
                </div>
              )}

              {/* Навыки */}
              {selectedHhResponse.resume_data?.skills && Array.isArray(selectedHhResponse.resume_data.skills) && selectedHhResponse.resume_data.skills.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-white mb-4">Навыки</h3>
                  <div className="bg-dark-700/30 p-4 rounded-lg">
                    <div className="flex flex-wrap gap-2">
                      {selectedHhResponse.resume_data.skills.map((skill: any, index: number) => (
                        <span key={index} className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm border border-red-500/30">
                          {skill.name || skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Опыт работы */}
              {selectedHhResponse.resume_data?.experience && Array.isArray(selectedHhResponse.resume_data.experience) && selectedHhResponse.resume_data.experience.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-white mb-4">Опыт работы</h3>
                  <div className="space-y-4">
                    {selectedHhResponse.resume_data.experience.map((exp: any, index: number) => (
                      <div key={index} className="bg-dark-700/30 p-4 rounded-lg border border-dark-600/30">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-white font-medium text-lg">{exp.position || 'Должность не указана'}</h4>
                          <span className="text-dark-300 text-sm bg-dark-800/50 px-2 py-1 rounded">
                            {exp.start && exp.end 
                              ? `${new Date(exp.start).toLocaleDateString('ru-RU')} - ${new Date(exp.end).toLocaleDateString('ru-RU')}`
                              : exp.start 
                              ? `с ${new Date(exp.start).toLocaleDateString('ru-RU')}`
                              : 'Период не указан'
                            }
                          </span>
                        </div>
                        <p className="text-red-400 font-medium mb-2">{exp.company || 'Компания не указана'}</p>
                        {exp.description && (
                          <p className="text-dark-300 text-sm leading-relaxed">{exp.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Образование */}
              {selectedHhResponse.resume_data?.education && Array.isArray(selectedHhResponse.resume_data.education) && selectedHhResponse.resume_data.education.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-white mb-4">Образование</h3>
                  <div className="space-y-3">
                    {selectedHhResponse.resume_data.education.map((edu: any, index: number) => (
                      <div key={index} className="bg-dark-700/30 p-4 rounded-lg border border-dark-600/30">
                        <h4 className="text-white font-medium text-lg mb-1">{edu.name || 'Учебное заведение не указано'}</h4>
                        <p className="text-red-400 font-medium mb-1">{edu.organization || 'Организация не указана'}</p>
                        {edu.year && (
                          <p className="text-dark-300 text-sm">Год: {edu.year}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Кнопки действий */}
              <div className="flex items-center space-x-3 pt-6 border-t border-dark-600/30">
                {selectedHhResponse.resume_data?.alternate_url && (
                  <a
                    href={selectedHhResponse.resume_data.alternate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-6 py-3 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors font-medium"
                  >
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                    </svg>
                    Посмотреть на HH.ru
                  </a>
                )}
                
                {selectedHhResponse.resume_data?.download?.pdf?.url && (
                  <a
                    href={convertHhResumeUrl(selectedHhResponse.resume_data.download.pdf.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-6 py-3 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors font-medium"
                  >
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                    </svg>
                    Скачать PDF
                  </a>
                )}
                
                <button
                  onClick={closeHhResponseModal}
                  className="ml-auto px-6 py-3 bg-dark-800/50 text-dark-300 rounded-lg hover:bg-dark-700/50 transition-colors font-medium"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CandidatesPage;
