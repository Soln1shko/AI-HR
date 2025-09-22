from flask import Blueprint, request, jsonify,Response,current_app
from bson import ObjectId
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from ..core.database import users_collection, companies_collection, interviews_collection, status_history_collection, vacancies_collection, interview_answers_collection
from ..core.utils import allowed_file, safe_filename
from ..services.export_to_yandex_cloud import create_s3_session, upload_file_object_to_s3
from ..services.delete_from_yandex_cloud import delete_file_from_s3
from ..services.video_yc import delete_video_in_yc
import os
from ..core.decorators import token_required, roles_required
import logging

vacancies_bp = Blueprint('vacancies', __name__)

@vacancies_bp.route('/vacancies/create', methods=['POST'])
@token_required
@roles_required('company')
def create_vacancy(caller_identity):
    """
    Создает новую вакансию. Позволяет опционально добавить список вопросов.
    """
    data = request.get_json()

    required_fields = ['title', 'grade', 'required_skills', 'min_experience', 'max_experience', 'work_field']
    if not all(field in data for field in required_fields):
        return jsonify({'message': f'Отсутствуют обязательные поля: {", ".join(required_fields)}'}), 400

    if not isinstance(data.get('required_skills'), list):
        return jsonify({'message': 'Поле "required_skills" должно быть списком'}), 400
    
    new_vacancy = {
        'company_id': caller_identity['id'],
        'title': data['title'],
        'grade': data['grade'],
        'required_skills': data['required_skills'],
        'min_experience': data['min_experience'],
        'max_experience': data['max_experience'],
        'work_field': data['work_field'],
        'work_address': data.get('work_address', ''),
        'optional_skills': data.get('optional_skills', []),
        'created_at': datetime.now(timezone.utc),
        'description': data['description']
    }

    questions = data.get('questions')
    if questions is not None:
        if isinstance(questions, list):
            new_vacancy['questions'] = questions
        else:
            return jsonify({'message': 'Поле "questions" должно быть списком, если оно предоставлено'}), 400
    try:
        result = vacancies_collection.insert_one(new_vacancy)
        inserted_id = result.inserted_id
    except Exception as e:
        return jsonify({'message': 'Ошибка при сохранении вакансии', 'error': str(e)}), 500
    return jsonify({'message': 'Вакансия успешно создана', 'vacancy_id': str(inserted_id)}), 201

@vacancies_bp.route('/vacancies', methods=['GET'])
@token_required
def get_all_vacancies(caller_identity):
    """
    Возвращает список вакансий с пагинацией и возможностью фильтрации по ID компании.
    Принимает query-параметры 'page', 'per_page' и 'company_id'.
    """
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
    except ValueError:
        return jsonify({'message': 'Параметры page и per_page должны быть числами'}), 400

    skip = (page - 1) * per_page
    query = {} 

    company_id = request.args.get('company_id')
    if company_id:
        try:
            query['company_id'] = str(company_id)
        except ValueError:
            return jsonify({'message': 'Неверный формат company_id'}), 400
    else:
        if caller_identity['role'] == 'company':
            query['company_id'] = caller_identity['id']

    cursor = vacancies_collection.find(query).skip(skip).limit(per_page)

    vacancies_list = []
    for vacancy in cursor:
        vacancy['_id'] = str(vacancy['_id'])
        if 'company_id' in vacancy:
            vacancy['company_id'] = str(vacancy['company_id'])
        vacancies_list.append(vacancy)
    total_vacancies = vacancies_collection.count_documents(query)

    return jsonify({
        'total': total_vacancies,
        'page': page,
        'per_page': per_page,
        'total_pages': (total_vacancies + per_page - 1) // per_page,
        'vacancies': vacancies_list
    }), 200 
    

@vacancies_bp.route('/vacancies/<vacancy_id>/questions', methods=['POST'])
@token_required
@roles_required('company')
def upload_vacancy_questions(caller_identity, vacancy_id):
    """
    Добавляет или полностью заменяет список вопросов для вакансии.
    Доступно только для компании, которая владеет этой вакансией.
    """
    data = request.get_json()
    questions = data.get('questions')
    if not isinstance(questions, list):
        return jsonify({'message': 'Поле "questions" обязательно и должно быть списком'}), 400
    try:
        vacancy_oid = ObjectId(vacancy_id)
    except Exception:
        return jsonify({'message': 'Неверный формат ID вакансии'}), 400

    vacancy = vacancies_collection.find_one({'_id': vacancy_oid})
    if not vacancy:
        return jsonify({'message': 'Вакансия не найдена'}), 404

    if vacancy.get('company_id') != caller_identity['id']:
        return jsonify({'message': 'У вас нет прав для редактирования этой вакансии'}), 403 
    try:
        vacancies_collection.update_one(
            {'_id': vacancy_oid},
            {'$set': {'questions': questions}} # 
        )
    except Exception as e:
        return jsonify({'message': 'Ошибка при обновлении вопросов', 'error': str(e)}), 500

    return jsonify({'message': 'Вопросы для вакансии успешно обновлены'}), 200

@vacancies_bp.route('/vacancies/<vacancy_id>/questions', methods=['GET'])
@token_required 
def get_vacancy_questions(caller_identity, vacancy_id):
    """
    Возвращает список вопросов для конкретной вакансии.
    """
    try:

        vacancy_oid = ObjectId(vacancy_id)
    except Exception:
        return jsonify({'message': 'Неверный формат ID вакансии'}), 400

    vacancy = vacancies_collection.find_one({'_id': vacancy_oid})
    if not vacancy:
        return jsonify({'message': 'Вакансия не найдена'}), 404

    questions = vacancy.get('questions', [])

    return jsonify({
        'vacancy_id': vacancy_id,
        'title': vacancy.get('title'),
        'questions': questions
    }), 200


@vacancies_bp.route('/vacancies/<vacancy_id>', methods=['PUT'])
@token_required
@roles_required('company')
def update_vacancy(caller_identity, vacancy_id):
    """
    Обновляет существующую вакансию.
    Доступно только для компании, которая владеет этой вакансией.
    """
    try:
        vacancy = vacancies_collection.find_one({'_id': ObjectId(vacancy_id)})
        if not vacancy:
            return jsonify({'message': 'Вакансия не найдена'}), 404
        if vacancy.get('company_id') != caller_identity['id']:
            return jsonify({'message': 'У вас нет прав для редактирования этой вакансии'}), 403
    except Exception:
        return jsonify({'message': 'Неверный формат ID вакансии'}), 400
    data = request.get_json()
    if not data:
        return jsonify({'message': 'Нет данных для обновления'}), 400

    update_fields = {}
    allowed_fields = [
        'title', 'grade', 'required_skills', 'min_experience',
        'max_experience', 'work_field', 'work_address', 'optional_skills', 'questions', 'description'
    ]
    for field in allowed_fields:
        if field in data:
            update_fields[field] = data[field]

    if not update_fields:
        return jsonify({'message': 'Нет разрешенных полей для обновления'}), 400
    try:
        vacancies_collection.update_one(
            {'_id': ObjectId(vacancy_id)},
            {'$set': update_fields}
        )
    except Exception as e:
        return jsonify({'message': 'Ошибка при обновлении вакансии', 'error': str(e)}), 500

    return jsonify({'message': 'Вакансия успешно обновлена'}), 200

@vacancies_bp.route('/vacancies/<vacancy_id>', methods=['DELETE'])
@token_required
@roles_required('company')
def delete_vacancy(caller_identity, vacancy_id):
    """
    Удаляет вакансию.
    Доступно только для компании, которая владеет этой вакансией.
    """
    try:
        vacancy = vacancies_collection.find_one({'_id': ObjectId(vacancy_id)})
        if not vacancy:
            return jsonify({'message': 'Вакансия не найдена'}), 404
        if vacancy.get('company_id') != caller_identity['id']:
            return jsonify({'message': 'У вас нет прав для удаления этой вакансии'}), 403
    except Exception:
        return jsonify({'message': 'Неверный формат ID вакансии'}), 400
    try:
        filter_reports = {"vacancy_id": vacancy_id}
        projection_reports = {"_id": 1}
        cursor_reports = interviews_collection.find(filter_reports, projection_reports)
        interview_ids = [str(doc['_id']) for doc in cursor_reports]
        filter_answers = {
                "interview_id": {"$in": interview_ids}, # Ищем документы, где interview_id находится в нашем списке
                "video_id": {"$exists": True}
        }
        projection_answers = {"video_id": 1, "_id": 0}
        cursor_answers = interview_answers_collection.find(filter_answers, projection_answers)

        video_ids = [doc['video_id'] for doc in cursor_answers]

        for video_id in video_ids:
            delete_video_in_yc(video_id)
    except Exception as e:
        return jsonify({'message': 'Ошибка при удалении вакансии', 'error': str(e)}), 500
    try:
        result = vacancies_collection.delete_one({'_id': ObjectId(vacancy_id)})
        if result.deleted_count == 0:
            return jsonify({'message': 'Вакансия не была удалена'}), 500
    except Exception as e:
        return jsonify({'message': 'Ошибка при удалении вакансии', 'error': str(e)}), 500

    return jsonify({'message': 'Вакансия успешно удалена'}), 200

@vacancies_bp.route('/vacancies/<vacancy_id>/candidates', methods=['GET'])
@token_required
@roles_required('company')
def get_candidates_for_vacancy(caller_identity, vacancy_id):
    """
    Возвращает список кандидатов (собеседований) с данными пользователей для конкретной вакансии.
    Доступно только для компании, которая владеет вакансией.
    """
    try:
        vacancy = vacancies_collection.find_one({'_id': ObjectId(vacancy_id)})
        if not vacancy:
            return jsonify({'message': 'Вакансия не найдена'}), 404
        if vacancy.get('company_id') != caller_identity['id']:
            return jsonify({'message': 'У вас нет прав для просмотра кандидатов по этой вакансии'}), 403
    except Exception:
        return jsonify({'message': 'Неверный формат ID вакансии'}), 400
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
    except ValueError:
        return jsonify({'message': 'Параметры page и per_page должны быть числами'}), 400
    
    skip = (page - 1) * per_page

    try:
        query = {'vacancy_id': ObjectId(vacancy_id)}
        count_by_objectid = interviews_collection.count_documents(query)
        
        if count_by_objectid > 0:
            cursor = interviews_collection.find(query).skip(skip).limit(per_page)
        else:
            query = {'vacancy_id': vacancy_id}
            cursor = interviews_collection.find(query).skip(skip).limit(per_page)
            count_by_string = interviews_collection.count_documents(query)
            print(f"📊 Найдено собеседований по строке: {count_by_string}")
            
    except Exception as e:
        print(f"❌ Ошибка при поиске по ObjectId: {e}")
        query = {'vacancy_id': vacancy_id}
        cursor = interviews_collection.find(query).skip(skip).limit(per_page)

    all_interviews = list(interviews_collection.find({'vacancy_id': ObjectId(vacancy_id)}))
    for idx, interview in enumerate(all_interviews):
        print(f"  {idx+1}. user_id: {interview['user_id']}, status: {interview['status']}, score: {interview.get('resume_score', 'N/A')}")
    
    cursor = interviews_collection.find(query).skip(skip).limit(per_page)

    candidates_list = []
    for interview in cursor:
        user = users_collection.find_one(
            {'_id': ObjectId(interview['user_id'])},
            {'name': 1, 'surname': 1, 'email': 1}  
        )
        candidate_data = {
            '_id': str(interview['_id']),
            'user_id': str(interview['user_id']),
            'vacancy_id': str(interview['vacancy_id']),
            'status': interview['status'],
            'resume_analysis': interview.get('resume_analysis'),
            'resume_score': interview.get('resume_score'),
            'interview_analysis': interview.get('interview_analysis'),
            'recommendation': interview.get('recommendation'),  # Добавляем поле recommendation
            'created_at': interview.get('created_at'),

            'user_name': f"{user.get('name', '')} {user.get('surname', '')}".strip() if user else 'Неизвестный пользователь',
            'user_email': user.get('email', 'unknown@example.com') if user else 'unknown@example.com'
        }
        candidates_list.append(candidate_data)

    total_candidates = interviews_collection.count_documents(query)

    return jsonify({
        'total': total_candidates,
        'page': page,
        'per_page': per_page,
        'total_pages': (total_candidates + per_page - 1) // per_page,
        'candidates': candidates_list,
        'vacancy_title': vacancy.get('title', 'Неизвестная вакансия')
    }), 200