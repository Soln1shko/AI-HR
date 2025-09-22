from flask import Blueprint, request, jsonify
import requests
import hashlib
import jwt
import os
import re
from datetime import datetime, timedelta
from ..core.database import companies_collection, vacancies_collection, hh_responses_collection
from ..core.decorators import token_required
import logging
import dotenv
import bcrypt

dotenv.load_dotenv()


hh_bp = Blueprint('hh_integration', __name__)

HH_CLIENT_ID = os.getenv('HH_CLIENT_ID', 'YOUR_HH_CLIENT_ID')
HH_CLIENT_SECRET = os.getenv('HH_CLIENT_SECRET', 'YOUR_HH_CLIENT_SECRET')
HH_REDIRECT_URI = os.getenv('HH_REDIRECT_URI', 'http://localhost:3000/hh-redirect')
SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key')

@hh_bp.route('/hh/exchange-code', methods=['POST'])
def exchange_code():
    """Обмен кода на токен и получение данных компании"""
    try:
        data = request.get_json()
        code = data.get('code')
        state = data.get('state')
        
        if not code:
            return jsonify({'error': 'Код авторизации не предоставлен'}), 400
        
        logging.info(f"Обмен кода hh.ru: {code[:10]}...")

        token_data = exchange_code_for_token(code)
        if not token_data:

            return jsonify({'error': 'Код авторизации уже использован. Попробуйте войти снова.'}), 400
            
        access_token = token_data['access_token']
        refresh_token = token_data.get('refresh_token')
       
        company_data = get_company_data(access_token)
        if not company_data:
            return jsonify({'error': 'Не удалось получить данные компании'}), 400
        
        user_data = get_user_data(access_token)
        
        vacancies_data = {'items': []}
        if company_data.get('id'):
            logging.info(f"Получаем вакансии для компании ID: {company_data['id']}")
            logging.info(f"Открытых вакансий по данным компании: {company_data.get('open_vacancies', 'неизвестно')}")
            vacancies_data = get_company_vacancies(access_token, company_data['id'])
            if not vacancies_data:
                logging.warning("Не удалось получить данные вакансий")
                vacancies_data = {'items': []}
            else:
                vacancies_count = len(vacancies_data.get('items', []))
                logging.info(f"Успешно получены данные вакансий: {vacancies_count} вакансий")
                if vacancies_count == 0:
                    logging.info("У компании нет открытых вакансий")
                else:
                    
                    logging.info("Начинаем получение кандидатов для отладки...")
                    candidates = get_all_candidates_for_company(access_token, company_data['id'])
                    logging.info(f"Получено кандидатов для отладки: {len(candidates)}")
        else:
            logging.warning("ID компании не найден, пропускаем получение вакансий")

        company_id = company_data.get('id')
        if not company_id:
            return jsonify({'error': 'Не удалось получить ID компании'}), 400
            
        existing_company = companies_collection.find_one({'hh_id': company_id})
        if existing_company:

            return jsonify({
                'success': True,
                'company_data': {
                    'hh_id': company_id,
                    'name': company_data.get('name', 'Неизвестная компания'),
                    'description': company_data.get('description'),
                    'site_url': company_data.get('site_url'),
                    'logo_url': company_data.get('logo_urls', {}).get('240') if company_data.get('logo_urls') else None,
                    'industries': company_data.get('industries', []),
                    'area': company_data.get('area'),
                    'vacancies_count': len(vacancies_data.get('items', []))
                },
                'session_token': generate_session_token({
                    'access_token': access_token,
                    'refresh_token': refresh_token,
                    'company_data': company_data,
                    'user_data': user_data,
                    'vacancies_data': vacancies_data
                }),
                'already_registered': True
            })
        return jsonify({
            'success': True,
            'company_data': {
                'hh_id': company_id,
                'name': company_data.get('name', 'Неизвестная компания'),
                'description': company_data.get('description'),
                'site_url': company_data.get('site_url'),
                'logo_url': company_data.get('logo_urls', {}).get('240') if company_data.get('logo_urls') else None,
                'industries': company_data.get('industries', []),
                'area': company_data.get('area'),
                'vacancies_count': len(vacancies_data.get('items', []))
            },
            'session_token': generate_session_token({
                'access_token': access_token,
                'refresh_token': refresh_token,
                'company_data': company_data,
                'user_data': user_data,
                'vacancies_data': vacancies_data
            })
        })
        
    except requests.exceptions.RequestException as e:
        logging.error(f"Ошибка API hh.ru: {str(e)}")
        if "code has already been used" in str(e):
            return jsonify({'error': 'Код авторизации уже использован. Попробуйте войти снова.'}), 400
        return jsonify({'error': 'Ошибка при получении данных от hh.ru'}), 500
    except Exception as e:
        logging.error(f"Ошибка при обмене кода: {str(e)}")
        if "NoneType" in str(e):
            return jsonify({'error': 'Код авторизации уже использован или недействителен. Попробуйте войти снова.'}), 400
        return jsonify({'error': f'Ошибка при обмене кода: {str(e)}'}), 500

@hh_bp.route('/hh/responses', methods=['GET'])
@token_required
def get_hh_responses(caller_identity):
    """Получение откликов HH.ru для компании с пагинацией"""
    try:
        company_id = caller_identity['id']
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 15))
        
        print(f"🔍 DEBUG: Ищем отклики для компании {company_id}")
    
        offset = (page - 1) * per_page

        total_count = hh_responses_collection.count_documents({
            'our_company_id': company_id
        })
        print(f"🔍 DEBUG: Найдено откликов в БД: {total_count}")
        
        responses = list(hh_responses_collection.find({
            'our_company_id': company_id
        }).sort('imported_at', -1).skip(offset).limit(per_page))

        for response in responses:
            response['_id'] = str(response['_id'])
        
        total_pages = (total_count + per_page - 1) // per_page
        
        return jsonify({
            'responses': responses,
            'total': total_count,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages
        }), 200
        
    except Exception as e:
        logging.error(f"Ошибка при получении откликов HH.ru: {e}")
        return jsonify({'error': 'Ошибка при получении откликов'}), 500


@hh_bp.route('/hh/complete-registration', methods=['POST'])
def complete_registration():
    """Завершение регистрации с паролем"""
    try:
        data = request.get_json()
        session_token = data.get('session_token')
        password = data.get('password')
        
        if not session_token or not password:
            return jsonify({'error': 'Недостаточно данных'}), 400
        
        if len(password) < 6:
            return jsonify({'error': 'Пароль должен содержать минимум 6 символов'}), 400

        session_data = jwt.decode(session_token, SECRET_KEY, algorithms=['HS256'])

        company_data = session_data.get('company_data')
        if not company_data:
            return jsonify({'error': 'Данные компании не найдены в сессии'}), 400

        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

        user_data = session_data.get('user_data', {})
        email = user_data.get('email')

        company_doc = {
            'hh_id': company_data.get('id'),
            'company_name': company_data.get('name', 'Неизвестная компания'),
            'email': email,
            'description': company_data.get('description'),
            'website': company_data.get('site_url'),
            'logo_url': company_data.get('logo_urls', {}).get('240') if company_data.get('logo_urls') else None,
            'industries': company_data.get('industries', []),
            'area': company_data.get('area'),
            'access_token': session_data.get('access_token'),  # В продакшене зашифровать!
            'refresh_token': session_data.get('refresh_token'),
            'password': password_hash,
            'role': 'company',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = companies_collection.insert_one(company_doc)
        company_id = str(result.inserted_id)

        vacancies_data = session_data.get('vacancies_data', {})
        vacancies = vacancies_data.get('items', [])
        logging.info(f"Сохраняем вакансии: {len(vacancies)} вакансий")
        if vacancies:
            for vacancy in vacancies:
                vacancy_doc = parse_vacancy_from_hh(vacancy, company_id)
                logging.info(f"Сохраняем вакансию: {vacancy_doc['title']} (HH ID: {vacancy_doc['hh_id']})")
                logging.info(f"Данные для сохранения: {vacancy_doc}")
                result = vacancies_collection.insert_one(vacancy_doc)
                logging.info(f"Вакансия сохранена с ID: {result.inserted_id}")
        else:
            logging.info("Нет вакансий для сохранения")

        access_token = session_data.get('access_token')
        if access_token and company_data.get('id'):
            logging.info("Начинаем сохранение откликов HH.ru...")

            our_vacancies = list(vacancies_collection.find({'company_id': company_id}))

            saved_responses = save_hh_responses_to_db(
                access_token, 
                company_data['id'], 
                company_id, 
                our_vacancies
            )
            logging.info(f"Сохранено откликов HH.ru: {saved_responses}")

        auth_token = jwt.encode({
            'account_id': company_id,
            'user': email,
            'role': 'company',
            'exp': datetime.utcnow() + timedelta(days=7)
        }, SECRET_KEY, algorithm='HS256')
        
        return jsonify({
            'success': True,
            'message': 'Регистрация завершена',
            'token': auth_token,
            'role': 'company',
            'company': {
                'id': company_id,
                'name': company_data.get('name', 'Неизвестная компания'),
                'vacancies_count': len(vacancies)
            }
        })
        
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Недействительная сессия'}), 401
    except Exception as e:
        logging.error(f"Ошибка при сохранении: {str(e)}")
        return jsonify({'error': f'Ошибка при сохранении: {str(e)}'}), 500

@hh_bp.route('/hh/sync-vacancies', methods=['POST'])
@token_required
def sync_vacancies(caller_identity):
    """Синхронизация вакансий с hh.ru"""
    try:
        if caller_identity.get('role') != 'company':
            return jsonify({'error': 'Доступ запрещен'}), 403
        
        company = companies_collection.find_one({'_id': caller_identity['id']})
        if not company:
            return jsonify({'error': 'Компания не найдена'}), 404
        
        access_token = company.get('access_token')
        if not access_token:
            return jsonify({'error': 'Токен hh.ru не найден'}), 400

        vacancies_data = get_company_vacancies(access_token, company['hh_id'])
        vacancies = vacancies_data.get('items', [])

        updated_count = 0
        for vacancy in vacancies:
            
            vacancy_doc = parse_vacancy_from_hh(vacancy, company['_id'])
            
            update_doc = {k: v for k, v in vacancy_doc.items() if k not in ['company_id', 'created_at']}
            update_doc['updated_at'] = datetime.utcnow()
            
            result = vacancies_collection.update_one(
                {'hh_id': vacancy['id']},
                {'$set': update_doc},
                upsert=True
            )
            if result.upserted_id or result.modified_count:
                updated_count += 1
        
        return jsonify({
            'success': True,
            'message': f'Синхронизировано {updated_count} вакансий',
            'vacancies_count': len(vacancies)
        })
        
    except Exception as e:
        logging.error(f"Ошибка синхронизации: {str(e)}")
        return jsonify({'error': f'Ошибка синхронизации: {str(e)}'}), 500


def exchange_code_for_token(code):
    """Обмен кода на токен"""
    token_url = 'https://hh.ru/oauth/token'
    data = {
        'grant_type': 'authorization_code',
        'client_id': HH_CLIENT_ID,
        'client_secret': HH_CLIENT_SECRET,
        'code': code,
        'redirect_uri': HH_REDIRECT_URI
    }
    
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'VTB-HRPlatform/1.0 (contact@vtb.ru)'
    }
    
    logging.info(f"Отправляем запрос к hh.ru: {token_url}")
    logging.info(f"Данные: {data}")
    logging.info(f"Заголовки: {headers}")
    
    response = requests.post(token_url, data=data, headers=headers)
    
    logging.info(f"Статус ответа: {response.status_code}")
    logging.info(f"Ответ: {response.text}")
    
    if response.status_code != 200:
        logging.error(f"Ошибка получения токена: {response.status_code} - {response.text}")
        return None
        
    return response.json()

def get_user_data(access_token):
    """Получение данных пользователя"""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'User-Agent': 'VTB-HRPlatform/1.0 (contact@vtb.ru)'
    }
    
    response = requests.get('https://api.hh.ru/me', headers=headers)
    if response.status_code != 200:
        logging.error(f"Ошибка получения данных пользователя: {response.status_code} - {response.text}")
        return None
        
    user_data = response.json()
    logging.info(f"Данные пользователя: {user_data}")
    return user_data

def get_company_data(access_token):
    """Получение данных компании"""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'User-Agent': 'VTB-HRPlatform/1.0 (contact@vtb.ru)'
    }
    
    # Сначала получаем информацию о пользователе
    user_data = get_user_data(access_token)
    if not user_data:
        return None

    if user_data.get('is_employer'):
        employer_id = user_data.get('employer', {}).get('id')
        if employer_id:
            company_response = requests.get(f'https://api.hh.ru/employers/{employer_id}', headers=headers)
            if company_response.status_code != 200:
                logging.error(f"Ошибка получения данных компании: {company_response.status_code} - {company_response.text}")
                return None
            company_data = company_response.json()
            logging.info(f"Данные компании: {company_data}")
            return company_data
    
    # Если не работодатель, возвращаем данные пользователя
    return user_data

def get_company_vacancies(access_token, employer_id):
    """Получение вакансий компании"""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'User-Agent': 'VTB-HRPlatform/1.0 (contact@vtb.ru)'
    }

    logging.info("Проверяем права доступа к API")
    test_response = requests.get('https://api.hh.ru/me', headers=headers)
    if test_response.status_code == 200:
        user_info = test_response.json()
        logging.info(f"Права пользователя: {user_info.get('is_employer', False)}")
        logging.info(f"ID работодателя: {user_info.get('employer', {}).get('id', 'не найден')}")
    else:
        logging.error(f"Ошибка проверки прав: {test_response.status_code} - {test_response.text}")

    params = {'employer_id': employer_id, 'per_page': 100}
    url = 'https://api.hh.ru/vacancies'
    
    logging.info(f"Запрашиваем вакансии для компании {employer_id}")
    logging.info(f"URL: {url}")
    logging.info(f"Параметры: {params}")
    
    response = requests.get(url, headers=headers, params=params)
    
    logging.info(f"Статус ответа вакансий: {response.status_code}")
    logging.info(f"Ответ вакансий: {response.text[:500]}...") 
    
    if response.status_code != 200:
        logging.error(f"Ошибка получения вакансий: {response.status_code} - {response.text}")

        alt_url = f'https://api.hh.ru/employers/{employer_id}/vacancies'
        logging.info(f"Пробуем альтернативный endpoint: {alt_url}")
        alt_response = requests.get(alt_url, headers=headers, params={'per_page': 100})
        
        logging.info(f"Статус альтернативного ответа: {alt_response.status_code}")
        logging.info(f"Альтернативный ответ: {alt_response.text[:500]}...")
        
        if alt_response.status_code == 200:
            vacancies_data = alt_response.json()
            logging.info(f"Получено вакансий через альтернативный endpoint: {len(vacancies_data.get('items', []))}")
            return vacancies_data
        else:
            logging.error(f"Ошибка альтернативного endpoint: {alt_response.status_code} - {alt_response.text}")
            return {'items': []}
    
    vacancies_data = response.json()
    vacancies = vacancies_data.get('items', [])
    logging.info(f"Получено вакансий: {len(vacancies)}")

    detailed_vacancies = []
    for vacancy in vacancies:
        detailed_vacancy = get_vacancy_details(access_token, vacancy['id'])
        if detailed_vacancy:
            detailed_vacancies.append(detailed_vacancy)
        else:

            detailed_vacancies.append(vacancy)
    
    logging.info(f"Обработано детальных вакансий: {len(detailed_vacancies)}")
    return {'items': detailed_vacancies}

def get_vacancy_details(access_token, vacancy_id):
    """Получение детальной информации о вакансии"""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'User-Agent': 'VTB-HRPlatform/1.0 (contact@vtb.ru)'
    }
    
    url = f'https://api.hh.ru/vacancies/{vacancy_id}'
    
    try:
        logging.info(f"Получаем детали вакансии {vacancy_id}")
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            vacancy_data = response.json()
            logging.info(f"Получены детали вакансии {vacancy_id}: {vacancy_data.get('name', 'Без названия')}")
            return vacancy_data
        else:
            logging.warning(f"Не удалось получить детали вакансии {vacancy_id}: {response.status_code}")
            return None
            
    except Exception as e:
        logging.error(f"Ошибка при получении деталей вакансии {vacancy_id}: {str(e)}")
        return None

def parse_vacancy_from_hh(vacancy_data, company_id):
    """Парсинг вакансии из данных HH.ru в формат для БД"""

    grade = extract_grade_from_vacancy(vacancy_data)

    min_experience, max_experience = extract_experience_from_vacancy(vacancy_data)
    
    # Извлекаем навыки
    required_skills = extract_skills_from_vacancy(vacancy_data)
    
    # Извлекаем описание
    description = extract_description_from_vacancy(vacancy_data)
    
    # Извлекаем сферу деятельности
    work_field = extract_work_field_from_vacancy(vacancy_data)
    
    # Извлекаем адрес работы
    work_address = extract_work_address_from_vacancy(vacancy_data)
    
    vacancy_doc = {
        'company_id': company_id,
        'hh_id': vacancy_data.get('id'),
        'title': vacancy_data.get('name', 'Без названия'),
        'grade': grade,
        'min_experience': min_experience,
        'max_experience': max_experience,
        'required_skills': required_skills,
        'description': description,
        'work_field': work_field,
        'work_address': work_address,
        'salary': vacancy_data.get('salary'),
        'area': vacancy_data.get('area'),
        'created_at': datetime.utcnow()
    }
    
    logging.info(f"Парсинг вакансии: {vacancy_doc['title']} - Grade: {grade}, Experience: {min_experience}-{max_experience}, Skills: {len(required_skills)}")
    logging.info(f"Полные данные вакансии: {vacancy_doc}")
    
    return vacancy_doc

def extract_grade_from_vacancy(vacancy_data):
    """Извлечение уровня (grade) из вакансии"""

    key_skills = vacancy_data.get('key_skills', [])
    for skill in key_skills:
        skill_name = skill.get('name', '').lower()
        if 'junior' in skill_name or 'джуниор' in skill_name:
            return 'junior'
        elif 'middle' in skill_name or 'мидл' in skill_name:
            return 'middle'
        elif 'senior' in skill_name or 'сеньор' in skill_name:
            return 'senior'
        elif 'lead' in skill_name or 'лид' in skill_name:
            return 'lead'

    title = vacancy_data.get('name', '').lower()
    if 'junior' in title or 'джуниор' in title:
        return 'junior'
    elif 'middle' in title or 'мидл' in title:
        return 'middle'
    elif 'senior' in title or 'сеньор' in title:
        return 'senior'
    elif 'lead' in title or 'лид' in title:
        return 'lead'

    description = vacancy_data.get('description', '').lower()
    if 'junior' in description or 'джуниор' in description:
        return 'junior'
    elif 'middle' in description or 'мидл' in description:
        return 'middle'
    elif 'senior' in description or 'сеньор' in description:
        return 'senior'
    elif 'lead' in description or 'лид' in description:
        return 'lead'
    
    return 'junior' 

def extract_experience_from_vacancy(vacancy_data):
    """Извлечение опыта работы из вакансии"""
    experience = vacancy_data.get('experience', {})
    if experience:
        min_exp = experience.get('id')
        if min_exp == 'noExperience':
            return 0, 0
        elif min_exp == 'between1And3':
            return 1, 3
        elif min_exp == 'between3And6':
            return 3, 6
        elif min_exp == 'moreThan6':
            return 6, 10
        else:
            return None, None

    description = vacancy_data.get('description', '')

    patterns = [
        r'от\s*(\d+)\s*до\s*(\d+)\s*лет?',
        r'(\d+)\s*-\s*(\d+)\s*лет?',
        r'от\s*(\d+)\s*лет?',
        r'(\d+)\+?\s*лет?\s*опыта?'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, description, re.IGNORECASE)
        if match:
            groups = match.groups()
            if len(groups) == 2:
                return int(groups[0]), int(groups[1])
            elif len(groups) == 1:
                return int(groups[0]), int(groups[0])
    
    return 0, 0  

def extract_skills_from_vacancy(vacancy_data):
    """Извлечение навыков из вакансии"""
    skills = []

    key_skills = vacancy_data.get('key_skills', [])
    for skill in key_skills:
        skills.append(skill.get('name', ''))

    return skills if skills else []

def extract_description_from_vacancy(vacancy_data):
    """Извлечение описания из вакансии"""

    description = vacancy_data.get('description', '')
    if description:

        description = re.sub(r'<[^>]+>', '', description)
        return description.strip()

    snippet = vacancy_data.get('snippet', {})
    if snippet:
        requirement = snippet.get('requirement', '')
        responsibility = snippet.get('responsibility', '')
        return f"{requirement}\n{responsibility}".strip()
    
    return None

def extract_work_field_from_vacancy(vacancy_data):
    """Извлечение сферы деятельности из вакансии"""

    specializations = vacancy_data.get('specializations', [])
    if specializations:
        return specializations[0].get('name', 'Не указано')

    professional_roles = vacancy_data.get('professional_roles', [])
    if professional_roles:
        return professional_roles[0].get('name', 'Не указано')
    
    return 'Не указано'

def extract_work_address_from_vacancy(vacancy_data):
    """Извлечение адреса работы из вакансии"""
    address = vacancy_data.get('address')
    if address:
        return address.get('raw', '')

    area = vacancy_data.get('area')
    if area:
        return area.get('name', '')
    
    return None


def get_vacancy_negotiations(access_token, vacancy_id):
    """Получение откликов по вакансии с пагинацией"""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'User-Agent': 'VTB-HRPlatform/1.0 (contact@vtb.ru)'
    }
    
    try:
        logging.info(f"Получение откликов для вакансии {vacancy_id}")
        
        all_negotiations = []
        page = 0
        per_page = 50
        
        while True:

            url = f'https://api.hh.ru/negotiations/response'
            params = {
                'vacancy_id': vacancy_id,
                'per_page': per_page,
                'page': page
            }
            
            response = requests.get(url, headers=headers, params=params)
            logging.info(f"Страница {page}: статус ответа API откликов: {response.status_code}")
            
            if response.status_code == 200:
                negotiations_data = response.json()
                items = negotiations_data.get('items', [])
                total_found = negotiations_data.get('found', 0)
                pages = negotiations_data.get('pages', 0)
                
                logging.info(f"Страница {page}: получено откликов: {len(items)}, всего найдено: {total_found}, страниц: {pages}")
                
                all_negotiations.extend(items)

                if page >= pages - 1:
                    break
                    
                page += 1
            else:
                logging.error(f"Ошибка получения откликов на странице {page}: {response.status_code} - {response.text}")
                break
        
        logging.info(f"Всего получено откликов: {len(all_negotiations)}")

        return {
            'items': all_negotiations,
            'found': len(all_negotiations),
            'pages': page + 1
        }
            
    except Exception as e:
        logging.error(f"Ошибка при получении откликов: {e}")
        return None


def get_resume_details(access_token, resume_id):
    """Получение детальной информации о резюме"""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'User-Agent': 'VTB-HRPlatform/1.0 (contact@vtb.ru)'
    }
    
    try:
        logging.info(f"Получение резюме {resume_id}")
        
        url = f'https://api.hh.ru/resumes/{resume_id}'
        response = requests.get(url, headers=headers)
        logging.info(f"Статус ответа API резюме: {response.status_code}")
        
        if response.status_code == 200:
            resume_data = response.json()
            
            
            return resume_data
        else:
            logging.error(f"Ошибка получения резюме: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        logging.error(f"Ошибка при получении резюме: {e}")
        return None


def save_hh_responses_to_db(access_token, company_id, our_company_id, our_vacancies):
    """Сохранение откликов HH.ru в базу данных"""
    try:
        logging.info(f"Сохранение откликов HH.ru для компании {company_id}")

        vacancies_data = get_company_vacancies(access_token, company_id)
        if not vacancies_data or not vacancies_data.get('items'):
            logging.warning("Вакансии не найдены")
            return 0
        
        saved_responses = 0

        for vacancy in vacancies_data['items']:
            hh_vacancy_id = vacancy['id']
            vacancy_name = vacancy.get('name', 'Без названия')

            our_vacancy = None
            for our_vac in our_vacancies:
                if our_vac.get('hh_id') == hh_vacancy_id:
                    our_vacancy = our_vac
                    break
            
            if not our_vacancy:
                logging.warning(f"Не найдена наша вакансия для HH ID: {hh_vacancy_id}")
                continue
            
            our_vacancy_id = str(our_vacancy['_id'])
            
            logging.info(f"Обработка вакансии {hh_vacancy_id}: {vacancy_name}")
            negotiations_data = get_vacancy_negotiations(access_token, hh_vacancy_id)
            if not negotiations_data or not negotiations_data.get('items'):
                logging.info(f"Откликов по вакансии {hh_vacancy_id} не найдено")
                continue
            for negotiation in negotiations_data['items']:
                resume_data = negotiation.get('resume', {})
                resume_id = resume_data.get('id')
                
                if not resume_id:
                    continue
                full_resume_data = get_resume_details(access_token, resume_id)
                response_doc = {
                    'hh_negotiation_id': negotiation.get('id'),
                    'hh_resume_id': resume_id,
                    'hh_vacancy_id': hh_vacancy_id,
                    'our_company_id': our_company_id,
                    'our_vacancy_id': our_vacancy_id,
                    'vacancy_name': vacancy_name,
                    'negotiation_state': negotiation.get('state', {}),
                    'created_at': negotiation.get('created_at'),
                    'updated_at': negotiation.get('updated_at'),
                    'resume_data': full_resume_data,
                    'negotiation_data': negotiation,
                    'imported_at': datetime.utcnow()
                }
                existing = hh_responses_collection.find_one({
                    'hh_negotiation_id': negotiation.get('id'),
                    'our_company_id': our_company_id
                })
                
                if not existing:
                    hh_responses_collection.insert_one(response_doc)
                    saved_responses += 1
                    logging.info(f"Сохранен отклик {negotiation.get('id')} для вакансии {vacancy_name}")
                else:
                    logging.info(f"Отклик {negotiation.get('id')} уже существует, пропускаем")
        
        logging.info(f"Сохранено новых откликов: {saved_responses}")
        return saved_responses
        
    except Exception as e:
        logging.error(f"Ошибка при сохранении откликов: {e}")
        return 0


def get_all_candidates_for_company(access_token, company_id):
    """Получение всех кандидатов для компании через её вакансии"""
    try:
        logging.info(f"Получение всех кандидатов для компании {company_id}")

        vacancies_data = get_company_vacancies(access_token, company_id)
        if not vacancies_data or not vacancies_data.get('items'):
            logging.warning("Вакансии не найдены")
            return []
        
        all_candidates = []
        processed_resumes = set()  

        for vacancy in vacancies_data['items']:
            vacancy_id = vacancy['id']
            logging.info(f"Обработка вакансии {vacancy_id}: {vacancy.get('name', 'Без названия')}")

            negotiations_data = get_vacancy_negotiations(access_token, vacancy_id)
            if not negotiations_data or not negotiations_data.get('items'):
                logging.info(f"Откликов по вакансии {vacancy_id} не найдено")
                continue

            for negotiation in negotiations_data['items']:
                resume_id = negotiation.get('resume', {}).get('id')
                if not resume_id or resume_id in processed_resumes:
                    continue
                
                processed_resumes.add(resume_id)

                resume_data = get_resume_details(access_token, resume_id)
                if resume_data:

                    resume_data['applied_vacancy'] = {
                        'id': vacancy_id,
                        'name': vacancy.get('name', ''),
                        'negotiation_id': negotiation.get('id')
                    }
                    all_candidates.append(resume_data)
        
        logging.info(f"Всего найдено уникальных кандидатов: {len(all_candidates)}")
        
        return all_candidates
        
    except Exception as e:
        logging.error(f"Ошибка при получении кандидатов: {e}")
        return []


def generate_session_token(data):
    """Генерация временного токена сессии"""
    payload = {
        **data,
        'exp': datetime.utcnow() + timedelta(minutes=5)  # 5 минут
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')
