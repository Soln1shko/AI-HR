"""Модуль сопоставления резюме с требованиями вакансии."""

import re
import os
import json
from openai import OpenAI
from typing import Any, Dict, List, Optional


class FlexibleResumeMatcher:
    """
    Оценивает соответствие резюме требованиям вакансии по нескольким критериям.

    Методика предполагает расчет итогового балла (0..100) на основе взвешенной
    суммы частных оценок: обязательные навыки, дополнительные навыки, опыт и
    образование. При отсутствии API-ключа выполняется резервная эвристическая
    оценка без LLM.
    
    Attributes:
        required_skills: Список обязательных навыков.
        optional_skills: Список желательных навыков.
        min_experience: Минимальный стаж (в годах).
        max_experience: Максимальный стаж (в годах), если задан.
        education_required: Требуемый уровень образования.
        weights: Веса критериев в итоговой оценке.
    """
    def __init__(
        self,
        required_skills: List[str],
        optional_skills: List[str],
        min_experience: float,
        job_description: str,
        max_experience: Optional[float] = None,
        education_required: Optional[str] = None,
        weights: Optional[Dict[str, float]] = None,
    ) -> None:
        self.required_skills = required_skills
        self.optional_skills = optional_skills
        self.min_experience = min_experience
        self.max_experience = max_experience
        self.education_required = education_required
        self.job_description = job_description
        # Веса критериев с безопасными значениями по умолчанию
        self.weights = weights or {
            "required_skills": 0.5,
            "optional_skills": 0.15,
            "experience": 0.25,
            "education": 0.1,
        }

    def _extract_experience(self, text: str) -> float:
        """Извлекает стаж работы из сырого текста резюме.

        Ожидает паттерн вида: "опыт работы --- <годы> лет <месяцы>".

        Args:
            text: Текст резюме.

        Returns:
            Оцененный стаж в годах (с учетом месяцев).
        """
        match = re.search(r'опыт работы\s*---\s*(\d+)\s*(?:лет|год|года)\s*(\d+)?', text.lower())
        if match:
            years = int(match.group(1))
            months = int(match.group(2)) if match.group(2) else 0
            return round(years + months / 12, 1)
        return 0.0

    def _extract_education(self, text: str) -> str:
        """Извлекает уровень образования из текста резюме.

        Args:
            text: Текст резюме.

        Returns:
            Нормализованное значение уровня образования.
        """
        text_lower = text.lower()
        if "высшее" in text_lower:
            return "высшее"
        elif "среднее специальное" in text_lower or "колледж" in text_lower:
            return "среднее специальное"
        return "не указано"

    def _check_skills(self, text: str, skills: List[str]) -> Dict[str, bool]:
        """Проверяет наличие перечисленных навыков в тексте.

        Args:
            text: Текст резюме.
            skills: Перечень навыков.

        Returns:
            Словарь {навык: найден ли в тексте}.
        """
        text_lower = text.lower()
        return {skill: bool(re.search(r'\b' + re.escape(skill.lower()) + r'\b', text_lower)) for skill in skills}

    def _fallback_rule_based(self, resume_text: str) -> Dict[str, Any]:
        """Резервная эвристическая оценка соответствия без использования LLM.

        Args:
            resume_text: Сырой текст резюме.

        Returns:
            Структура с итоговым баллом и деталями по критериям.
        """
        candidate_exp = self._extract_experience(resume_text)
        candidate_edu = self._extract_education(resume_text)
        required_skills_map = self._check_skills(resume_text, self.required_skills)
        optional_skills_map = self._check_skills(resume_text, self.optional_skills)

        req_found = sum(required_skills_map.values())
        req_total = len(self.required_skills)
        required_score = req_found / req_total if req_total > 0 else 1.0

        opt_found = sum(optional_skills_map.values())
        opt_total = len(self.optional_skills)
        optional_score = opt_found / opt_total if opt_total > 0 else 1.0
        
        experience_score = 1.0
        if candidate_exp < self.min_experience:
            penalty = (self.min_experience - candidate_exp) / self.min_experience * 0.3
            experience_score = 1.0 - penalty
        elif self.max_experience and candidate_exp > self.max_experience:
            penalty = (candidate_exp - self.max_experience) / self.max_experience * 0.1
            experience_score = 1.0 - min(penalty, 0.1)

        education_score = 1.0
        if self.education_required and candidate_edu != self.education_required:
            education_score = 0.0

        final_score = (
            required_score * float(self.weights.get("required_skills", 0.5)) +
            optional_score * float(self.weights.get("optional_skills", 0.15)) +
            experience_score * float(self.weights.get("experience", 0.25)) +
            education_score * float(self.weights.get("education", 0.1))
        )

        return {
            "total_score_percent": round(final_score * 100),
            "details": {
                "experience": {"required_years": f"{self.min_experience}-{self.max_experience}", "candidate_has_years": candidate_exp, "score": round(experience_score*100)},
                "education": {"required": self.education_required, "candidate_has": candidate_edu, "score": round(education_score*100)},
                "required_skills": {"map": required_skills_map, "score": round(required_score*100)},
                "optional_skills": {"map": optional_skills_map, "score": round(optional_score*100)},
            }
        }
        
    def evaluate(self, resume_text: str) -> Dict[str, Any]:
        """Оценивает соответствие резюме требованиям вакансии.

        Если задан API-ключ, выполняет запрос к LLM (через OpenRouter) и ожидает
        строгий JSON-ответ. При любом сбое или отсутствии ключа используется
        резервная эвристическая оценка.

        Args:
            resume_text: Сырой текст резюме кандидата.

        Returns:
            Словарь с ключами `total_score_percent` и `details`.
        """
        api_key = os.getenv("OPENROUTER_API_KEY", "").strip()

        if not api_key:
            return self._fallback_rule_based(resume_text)

        try:
            client = OpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1")

            system_prompt = (
                """
                Ты — строгий HR-ассессор. Оцени соответствие резюме требованиям вакансии СТРОГО по РУБРИКЕ и верни ТОЛЬКО валидный JSON.

                ТРЕБОВАНИЯ К ВЫВОДУ:
                - Верни исключительно JSON без текста вне JSON, без код-блоков и комментариев.
                - Все числовые оценки — целые проценты 0..100 (НЕ доли).
                - Структура и ключи фиксированы: total_score_percent (int 0..100), details: experience, education, required_skills, optional_skills.
                - Не добавляй новых полей и не меняй названия ключей. Без хвостовых запятых.

                ПРАВИЛА ИЗВЛЕЧЕНИЯ:
                - Извлеки стаж (в годах, допускается дробное), уровень образования (нормализуй), наличие каждого навыка из списков.
                - Учитывай ТОЛЬКО явно указанные факты из резюме; если факт не указан прямо — считай отсутствующим (false/0).
                - Не интерпретируй смежные формулировки как наличие конкретного обязательного навыка.
                - Карты навыков ("map") должны содержать ВСЕ навыки из соответствующих списков вакансии; значения — строго true/false.

                РУБРИКА (оценки в процентах 0..100):
                - required_skills (вес weight_required): доля найденных обязательных навыков (округляй до целого).
                • Если не найден НИ ОДИН обязательный — required_skills.score = 0 и итоговый total_score_percent ≤ 25.
                • Если покрытие < 50% обязательных — итоговый total_score_percent ≤ 60.
                • Если покрытие 50..75% — итоговый total_score_percent ≤ 70.
                - optional_skills (вес weight_optional): доля найденных доп. навыков (округляй до целого). Если список пуст — score = 100, "map" = {}.
                - experience (вес weight_experience):
                • Если опыт не указан или равен 0 → score = 0.
                • Если опыт < min: score ≈ 60 при недостаче ≤ 1 год, линейно снижается до 0 при большей недостаче.
                • Если задан max и опыт > max: штраф до −10 п.п. (нижняя граница 90).
                • Иначе score = 100.
                - education (вес weight_education): 100 при точном соответствии требованию, иначе 0. Если требование не задано — 100.

                ФИНАЛЬНЫЙ БАЛЛ:
                - final = required_skills.score * weight_required + optional_skills.score * weight_optional + experience.score * weight_experience + education.score * weight_education.
                - Верни total_score_percent = ceil(final), ограничив 0..100 и применив ограничения по покрытию обязательных навыков (см. выше).

                ГРАНИЧНЫЕ СЛУЧАИ:
                - Пустое или крайне короткое резюме → все секции 0, total_score_percent = 0.
                """
            )

            vacancy_text_lines = (
                """
                <VACANCY>
                <REQUIRED_SKILLS>{required_skills}</REQUIRED_SKILLS>
                <OPTIONAL_SKILLS>{optional_skills}</OPTIONAL_SKILLS>
                <MIN_EXPERIENCE>{min_experience}</MIN_EXPERIENCE>
                <MAX_EXPERIENCE>{max_experience}</MAX_EXPERIENCE>
                <EDUCATION_REQUIRED>{education_required}</EDUCATION_REQUIRED>
                <JOB_DESCRIPTION>{job_description}</JOB_DESCRIPTION>
                <WEIGHTS>required={weights_required};optional={weights_optional};experience={weights_experience};education={weights_education}</WEIGHTS>
                </VACANCY>

                <RESUME_RAW>
                {resume}
                </RESUME_RAW>

                ФОРМАТ ВЫХОДА (ровно такой JSON, без комментариев и лишнего текста):
                {
                    "total_score_percent": 0,
                    "details": {
                        "experience": {"candidate_has_years": 0.0, "score": 0},
                        "education": {"candidate_has": "", "score": 0},
                        "required_skills": {"map": {}, "score": 0},
                        "optional_skills": {"map": {}, "score": 0}
                    }
                }
                """
            )
            user_prompt_text = "\n".join(vacancy_text_lines)

            model_name = os.getenv("AI_HR_LLM_MODEL", "mistralai/mistral-7b-instruct")

            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt_text},
                ],
                temperature=0.1,
            )

            content = response.choices[0].message.content if response.choices else ""
            if not content:
                raise ValueError("Пустой ответ LLM")

            content = content.strip()
            if content.startswith("```"):
                content = content.strip('`')
                if content.lower().startswith("json\n"):
                    content = content[5:]

            parsed = json.loads(content)

            total = int(parsed.get("total_score_percent", 0))
            details = parsed.get("details", {})
            details.setdefault("experience", {})
            details.setdefault("education", {})
            details.setdefault("required_skills", {})
            details.setdefault("optional_skills", {})

            total = max(0, min(100, total))

            return {
                "total_score_percent": total,
                "details": details,
            }

        except Exception as e:
            return self._fallback_rule_based(resume_text)
