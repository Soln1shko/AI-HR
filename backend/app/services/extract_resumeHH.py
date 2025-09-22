# extract_resumeHH.py

import re
import requests
import os
from dotenv import load_dotenv
import io

load_dotenv()

EMPLOYER_ACCESS_TOKEN = os.getenv('EMPLOYER_ACCESS_TOKEN')

class HHApiManager:
    """
    Класс для работы с API hh.ru от имени работодателя.
    """
    BASE_URL = 'https://api.hh.ru'

    def __init__(self, access_token, app_name='MyHRPlatform/1.0 (contact@myhr.tech)'):
        """
        Инициализирует менеджер с токеном доступа работодателя.
        :param access_token: Токен, полученный от работодателя через OAuth2.
        """
        if not access_token:
            raise ValueError("Access token не может быть пустым.")
        self.headers = {
            'Authorization': f'Bearer {access_token}',
            'User-Agent': app_name
        }

    def get_resume_by_id(self, resume_id):
        """
        Получает информацию о резюме по его ID.
        Требует прав работодателя.
        """
        endpoint = f'resumes/{resume_id}'
        print(f"Отправка запроса на получение резюме: {self.BASE_URL}/{endpoint}")
        try:
            response = requests.get(f"{self.BASE_URL}/{endpoint}", headers=self.headers)
            response.raise_for_status()  # Вызовет ошибку для статусов 4xx/5xx
            return response.json()
        except requests.exceptions.HTTPError as err:
            if err.response.status_code == 403:
                print("Ошибка 403 (Доступ запрещен): Убедитесь, что токен принадлежит работодателю с доступом к базе резюме.")
            elif err.response.status_code == 404:
                print(f"Ошибка 404 (Не найдено): Резюме с ID '{resume_id}' не найдено или скрыто.")
            else:
                print(f"HTTP ошибка: {err}")
            return None
        except requests.exceptions.RequestException as err:
            print(f"Ошибка сетевого запроса: {err}")
            return None

def extract_resume_id_from_url(url):
    """
    Извлекает ID резюме из стандартной ссылки hh.ru.
    """
    match = re.search(r'/resume/([a-zA-Z0-9]+)', url)
    if match:
        return match.group(1)
    return None

def extract_resume_from_HH(resume_url_from_user):
    """
    Извлекает данные резюме с hh.ru и возвращает их в виде файлового объекта в памяти.
    """
    resume_id = extract_resume_id_from_url(resume_url_from_user)
    if not resume_id:
        print("ID резюме не найден в URL.")
        return None

    print(f"Извлечен ID резюме: {resume_id}")

    api_manager = HHApiManager(access_token=EMPLOYER_ACCESS_TOKEN)
    resume_data = api_manager.get_resume_by_id(resume_id)

    if not resume_data:
        print("Не удалось получить данные резюме.")
        return None

    string_io = io.StringIO()

    string_io.write("### Основная информация\n")
    string_io.write(f"* **ФИО:** {resume_data.get('last_name', '')} {resume_data.get('first_name', '')} {resume_data.get('middle_name', '')}\n")
    string_io.write(f"* **Возраст:** {resume_data.get('age', 'Не указан')}\n")
    string_io.write(f"* **Пол:** {resume_data.get('gender', {}).get('name', 'Не указан')}\n")
    string_io.write(f"* **Город:** {resume_data.get('area', {}).get('name', 'Не указан')}\n")
    string_io.write(f"* **Желаемая должность:** {resume_data.get('title', 'Не указана')}\n")
    if resume_data.get('professional_roles'):
        string_io.write(f"* **Профессиональная роль:** {resume_data['professional_roles'][0].get('name', '')}\n")

    string_io.write("\n### Контакты\n")
    if resume_data.get('contact') and len(resume_data['contact']) > 0:
        phone_contact = next((c for c in resume_data['contact'] if c.get('type', {}).get('id') == 'cell'), None)
        if phone_contact:
             string_io.write(f"* **Телефон:** {phone_contact.get('value', {}).get('formatted', 'Не указан')}\n")
    string_io.write(f"* **Ссылка на резюме:** {resume_data.get('alternate_url', 'Нет')}\n")


    string_io.write("\n### Ключевые навыки и образование\n")
    if resume_data.get('skill_set'):
        string_io.write(f"* **Навыки:** {', '.join(resume_data['skill_set'])}\n")
    if resume_data.get('education') and resume_data['education'].get('level') and resume_data['education'].get('primary'):
        edu_primary = resume_data['education']['primary'][0]
        string_io.write(f"* **Образование:** {resume_data['education']['level'].get('name', '')} — {edu_primary.get('name', '')} (год окончания: {edu_primary.get('year', '')})\n")
    if resume_data.get('language'):
        language = resume_data['language'][0]
        string_io.write(f"* **Языки:** {language.get('name', '')} ({language.get('level', {}).get('name', '')})\n")

    string_io.write("\n### Опыт работы\n")
    if resume_data.get('experience'):
        for exp in resume_data['experience']:
            string_io.write(f"* **Компания:** {exp.get('company', 'Не указано')}\n")
            string_io.write(f"  * **Должность:** {exp.get('position', 'Не указано')}\n")
            string_io.write(f"  * **Период:** {exp.get('start', '')} - {exp.get('end', 'по настоящее время')}\n")
            string_io.write(f"  * **Описание:** {exp.get('description', 'Нет описания')}\n\n")
    string_io.seek(0)

    byte_io = io.BytesIO(string_io.read().encode('utf-8'))

    setattr(byte_io, 'filename', f"resume_{resume_id}.txt")
 
    
    return byte_io

