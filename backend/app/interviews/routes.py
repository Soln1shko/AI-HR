from flask import Blueprint, request, jsonify,Response,current_app
import requests
from bson import ObjectId
from flask_cors import cross_origin
from ..parser.parser import DocumentParser
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from ..core.database import users_collection, companies_collection, interviews_collection, status_history_collection, vacancies_collection,interview_answers_collection
from ..core.utils import allowed_file, safe_filename
from ..services.export_to_yandex_cloud import create_s3_session, upload_file_object_to_s3
from ..services.delete_from_yandex_cloud import delete_file_from_s3
import os
from ..core.decorators import token_required, roles_required
from ..services.ai_hr import match_resume,start_interview,submit_interview_answer
import logging

interviews_bp = Blueprint('interviews', __name__)
@interviews_bp.route('/check-resume', methods=['POST', 'OPTIONS'])
@cross_origin()
@token_required
@roles_required('user')
def check_resume_score(caller_identity):
    """
    Проверяет резюме кандидата и возвращает оценку без создания интервью.
    Если оценка < 20%, создается запись с статусом 'rejected'.
    """
    if request.method == 'OPTIONS':
        return '', 200

    user_id = caller_identity['id']
    data = request.get_json()
    
    if not data or 'vacancy_id' not in data:
        return jsonify({'message': 'vacancy_id обязателен'}), 400
    
    vacancy_id = data['vacancy_id']
    
    query_filter = {
            'user_id': user_id,
            'vacancy_id': vacancy_id
    }

    existing_interview = interviews_collection.find_one(query_filter)
    if existing_interview:
        return jsonify({'message': 'Интервью уже создано'}), 400
    try:
        vacancy = vacancies_collection.find_one({'_id': ObjectId(vacancy_id)})
        if not vacancy:
            return jsonify({'message': 'Вакансия не найдена'}), 404
    except:
        return jsonify({'message': 'Некорректный ID вакансии'}), 400

    try:
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'message': 'Пользователь не найден'}), 404
            
        resume_path = user.get('resume_path')
        if not resume_path:
            return jsonify({'message': 'У пользователя нет загруженного резюме'}), 400
    except:
        return jsonify({'message': 'Ошибка при получении данных пользователя'}), 500

    parsed_resume_data = user.get('parsed_resume')
    if not parsed_resume_data:

        import sys
        sys.path.append(os.path.join(os.path.dirname(__file__), 'export_to_yandex'))
        
        s3_client = create_s3_session()
        if not s3_client:
            return jsonify({'message': 'Ошибка подключения к облачному хранилищу'}), 500
        
        if resume_path.startswith('https://storage.yandexcloud.net/'):
            object_name = '/'.join(resume_path.split('/')[4:])
        else:
            object_name = f"resumes/{os.path.basename(resume_path)}"
        
        try:
            s3_response = s3_client.get_object(Bucket=current_app.config['YC_STORAGE_BUCKET'], Key=object_name)
            file_content = s3_response['Body'].read()
            download_filename = os.path.basename(object_name)

            parser = DocumentParser(source=download_filename)
            parsed_text = parser.parse_content(file_content)

            if not parsed_text:
                return jsonify({'message': 'Не удалось извлечь текст из резюме'}), 400
            users_collection.update_one(
                {'_id': ObjectId(user_id)},
                {'$set': {'parsed_resume': parsed_text}}
            )
            parsed_resume_data = parsed_text

        except Exception as e:
            return jsonify({'message': f'Ошибка при обработке резюме: {str(e)}'}), 500

    existing_check = interviews_collection.find_one({
        'user_id': ObjectId(user_id),
        'vacancy_id': ObjectId(vacancy_id)
    })
    
    if existing_check:
        return jsonify({
            'success': True,
            'resume_score': existing_check.get('resume_score', 0),
            'can_proceed': existing_check.get('status') != 'rejected',
            'message': 'Резюме уже было проверено ранее',
            'interview_id': str(existing_check['_id']) if existing_check.get('status') == 'active' else None
        }), 200
    try:
        
        match_result = match_resume(parsed_resume_data, vacancy.get('description', ''), vacancy_id)
        resume_score = match_result.get('total_score_percent', 0)
        
    except Exception as e:
        logging.error(f"Ошибка при обращении к AI-HR сервису: {e}")
        return jsonify({'message': 'Ошибка оценки резюме'}), 500
    try:
        interview_record = {
            'user_id': ObjectId(user_id),
            'vacancy_id': ObjectId(vacancy_id),
            'status': 'rejected' if resume_score < 20 else 'active',
            'resume_score': resume_score,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        }
        
        if resume_score < 20:
            interview_record['rejection_reason'] = 'Низкая оценка соответствия резюме требованиям вакансии'
        else:
            interview_record['interview_analysis'] = None
            
        result = interviews_collection.insert_one(interview_record)
        interview_id = str(result.inserted_id)
        
    except Exception as e:
        logging.error(f"Ошибка при сохранении записи интервью: {e}")
        return jsonify({'message': 'Ошибка при сохранении результатов'}), 500

    response_data = {
        'success': True,
        'resume_score': resume_score,
        'can_proceed': resume_score >= 20,
        'message': 'Проверка резюме завершена успешно' if resume_score >= 20 else 'К сожалению, ваше резюме не соответствует требованиям данной вакансии'
    }
    
    if resume_score >= 20:
        response_data['interview_id'] = interview_id
    
    return jsonify(response_data), 200


@interviews_bp.route('/convert-resume', methods=['POST'])
@token_required
@roles_required('user')
def process_and_save_resume(caller_identity):
    """
    Создает интервью для пользователя с уже проверенным резюме.
    Резюме должно быть предварительно проверено через /check-resume.
    """
    user_id = caller_identity['id']
    data = request.get_json()
    
    if not data or 'vacancy_id' not in data:
        return jsonify({'message': 'vacancy_id обязателен'}), 400
        
    vacancy_id = data['vacancy_id']
    
    try:
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'message': 'Пользователь не найден'}), 404
            
        parsed_resume_data = user.get('parsed_resume')
        if not parsed_resume_data:
            return jsonify({'message': 'Резюме не найдено. Сначала проверьте резюме через соответствующую кнопку.'}), 400

        vacancy = vacancies_collection.find_one({'_id': ObjectId(vacancy_id)})
        if not vacancy:
            return jsonify({'message': 'Вакансия не найдена'}), 404

        existing_interview = interviews_collection.find_one({
            'user_id': ObjectId(user_id),
            'vacancy_id': ObjectId(vacancy_id)
        })
        
        if existing_interview:
            if existing_interview.get('status') == 'rejected':
                return jsonify({'message': 'Ваше резюме не прошло предварительную проверку для данной вакансии'}), 403
            elif existing_interview.get('status') in ['completed', 'offer', 'test_task', 'finalist']:
                return jsonify({'message': 'Собеседование для данной вакансии уже завершено'}), 200
            elif existing_interview.get('status') == 'active':
                return jsonify({
                    'interview_id': str(existing_interview['_id']),
                    'message': 'Собеседование готово к началу'
                }), 200
        return jsonify({'message': 'Сначала необходимо проверить соответствие резюме через кнопку "Проверить резюме"'}), 400

    except Exception as e:
        logging.error(f"Ошибка в process_and_save_resume: {e}")
        return jsonify({'message': f'Внутренняя ошибка сервера: {str(e)}'}), 500

@interviews_bp.route('/interviews/answer', methods=['POST', 'OPTIONS'])
@cross_origin()
@token_required
@roles_required('user')
def save_interview_answer(caller_identity):
    """
    Принимает и сохраняет ответ пользователя на один вопрос собеседования.
    """
    logging.info(f"🔍 /interviews/answer вызван, метод: {request.method}")
    if request.method == 'OPTIONS':
        return '', 200
    data = request.get_json()
    logging.info(f"Получены данные: {data}")
    logging.info(f"Caller identity: {caller_identity}")
    if not data:
        return jsonify({'message': 'Нет данных в запросе'}), 400
    mlinterview_id = data.get('mlinterview_id')
    interview_id = data.get('interview_id')
    question = data.get('question') 
    answer_text = data.get('answer_text')
    analysis = data.get('analysis') 
    vacancy_id = interviews_collection.find_one({'_id': ObjectId(interview_id)})['vacancy_id']
    video_id = data.get('video_id')
    if not interview_id:
        return jsonify({'message': 'Поле interview_id обязательно'}), 400
    if mlinterview_id and mlinterview_id.strip():
        if not question or not answer_text:
            return jsonify({'message': 'Поля question и answer_text обязательны для ответа'}), 400
        
        if not isinstance(answer_text, str) or not answer_text.strip():
            return jsonify({'message': 'Поле answer_text не может быть пустым'}), 400

    user_id = caller_identity['id']

    answer_document = None

    if mlinterview_id == '' or not mlinterview_id:
        try:
            user_document = users_collection.find_one(
                {"_id": ObjectId(user_id)}, 
                {"parsed_resume": 1, "_id": 0}  
            )
            parsed_resume_data = None  
            
            if user_document:
                parsed_resume_data = user_document.get("parsed_resume")
                
                if parsed_resume_data:
                    logging.info("Найденный анализ резюме:")
                    logging.info(parsed_resume_data)
                else:
                    logging.info("Пользователь найден, но поле 'parsed_resume' отсутствует или пустое.")
                    
            else:
                logging.info(f"Пользователь с ID {user_id} не найден.")
            resume_for_ai = parsed_resume_data[:2000] if parsed_resume_data else "Резюме не найдено"
            logging.info(f"Отправляем резюме длиной {len(resume_for_ai)} символов в AI-сервис")
            
            
            vacancy = vacancies_collection.find_one({'_id': ObjectId(vacancy_id)})
            job_description = vacancy.get('description', '') if vacancy else ''
            
            try:
                response_data = start_interview(resume_for_ai, str(vacancy_id), job_description)
            except Exception as e:
                logging.error(f"Ошибка AI-сервиса: {e}")
            
                response_data = {
                    'interview_id': f"mock_{interview_id}",
                    'status': 'active',
                    'current_question': 'Здравствуйте! Благодарим за интерес к нашей компании. Я — ваш AI-ассистент по подбору персонала. Сегодня мы проведем структурированное интервью, чтобы лучше понять ваш опыт, навыки и мотивацию.Пожалуйста, начните с краткого рассказа о себе. Желаю успешного собеседования!',
                    'report': None,
                    'recommendation': None
                }
            mlinterview_id = response_data['interview_id']
            
            first_question = response_data.get('current_question', 'Здравствуйте! Благодарим за интерес к нашей компании. Я — ваш AI-ассистент по подбору персонала. Сегодня мы проведем структурированное интервью, чтобы лучше понять ваш опыт, навыки и мотивацию.Пожалуйста, начните с краткого рассказа о себе. Желаю успешного собеседования!')

            logging.info(f"Сохраняем первый ответ. Статус: {response_data['status']}, Вопрос из AI: '{response_data.get('current_question')}', Итоговый вопрос: '{first_question}'")
            answer_document = {
                'interview_id': interview_id,
                'mlinterview_id': mlinterview_id,
                'question': first_question,
                'status': response_data['status'],
                'answer_text': answer_text,
                'report': response_data.get('report'),
                'recommendation': response_data.get('recommendation'),
                'optimal_time': response_data.get('optimal_time', 90),
                'voice_analysis': analysis,  
                'created_at': datetime.utcnow(),
                'video_id': video_id

            }
            try:
                interview_answers_collection.insert_one(answer_document)
            except Exception as e:
                return jsonify({'message': 'Ошибка при сохранении ответа', 'error': str(e)}), 500
        except requests.exceptions.RequestException as e:
            return jsonify({'message': 'Ошибка при отправке запроса', 'error': str(e)}), 500
    else:
        try:
            

            response_data = submit_interview_answer(mlinterview_id, answer_text)
            logging.info(f"AI-HR ответ: {response_data}")
            question_to_save = response_data.get('current_question') or question
            logging.info(f"Сохраняем ответ. Статус: {response_data['status']}, Вопрос из AI: '{response_data.get('current_question')}', Переданный вопрос: '{question}', Итоговый вопрос: '{question_to_save}'")
            optimal_time = response_data.get('optimal_time', 90)
            if optimal_time is None:
                optimal_time = 90

            answer_document = {
                'interview_id': interview_id,
                'mlinterview_id': mlinterview_id,
                'question': question_to_save,
                'status': response_data['status'],
                'answer_text': answer_text,
                'recommendation': response_data['recommendation'],
                'voice_analysis': analysis, 
                'optimal_time': optimal_time,
                'video_id': video_id
            }
            
            answer = {
                'interview_id': interview_id,
                'mlinterview_id': mlinterview_id,
                'question': question,
                'status': response_data['status'],
                'answer_text': answer_text,
                'recommendation': response_data['recommendation'],
                'voice_analysis': analysis, 
                'created_at': datetime.utcnow(),
                'video_id': video_id
            }
            if response_data['status']== 'completed':
                answer_document['report'] = response_data['report']
                answer_document['question'] = question_to_save 
                interviews_collection.update_one({'_id': ObjectId(interview_id)}, {'$set': {'status': 'completed', 'interview_analysis': response_data['report'], 'recommendation': response_data['recommendation']}})
            try:
                interview_answers_collection.insert_one(answer)
            except Exception as e:
                return jsonify({'message': 'Ошибка при сохранении ответа', 'error': str(e)}), 500
                
        except requests.exceptions.RequestException as e:
            return jsonify({'message': 'Ошибка при отправке запроса', 'error': str(e)}), 500
        
    if answer_document:
        response_data = {
            'interview_id': answer_document.get('interview_id'),
            'mlinterview_id': answer_document.get('mlinterview_id'),
            'question': answer_document.get('question'),
            'current_question': answer_document.get('question'),  
            'status': answer_document.get('status'),
            'answer_text': answer_document.get('answer_text'),
            'voice_analysis': answer_document.get('voice_analysis'),
            'optimal_time': answer_document.get('optimal_time'),
            'message': 'Ответ успешно сохранен'
        }
        logging.info(f"Отправляем ответ клиенту: {response_data}")
        return jsonify(response_data), 201
    else:
        return jsonify({'message': 'Ошибка при обработке запроса'}), 500



@interviews_bp.route('/interviews/<interview_id>/qna', methods=['GET'])
@token_required
def get_interview_qna(caller_identity, interview_id):
    """
    Returns a list of all questions and answers for a specific interview session.
    """
    try:
        interview_session = interviews_collection.find_one({'_id': ObjectId(interview_id)})
        if not interview_session:
            return jsonify({'message': 'Interview session not found'}), 404

        user_id_from_interview = interview_session.get('user_id')
        vacancy_id_from_interview = interview_session.get('vacancy_id')

        vacancy = vacancies_collection.find_one({'_id': ObjectId(vacancy_id_from_interview)})
        if not vacancy:
            return jsonify({'message': 'Associated vacancy not found'}), 404
        
        company_id_from_vacancy = vacancy.get('company_id')

        is_user_owner = caller_identity['role'] == 'user' and caller_identity['id'] == user_id_from_interview
        is_company_owner = caller_identity['role'] == 'company' and caller_identity['id'] == company_id_from_vacancy

        if not (is_user_owner or is_company_owner):
            return jsonify({'message': 'You do not have permission to view these answers'}), 403

    except Exception:
        return jsonify({'message': 'Invalid ID format'}), 400

    try:
        query = {'interview_id': interview_id}

        cursor = interview_answers_collection.find(query).sort('created_at', 1)

        qna_list = []
        for answer_doc in cursor:
            answer_doc['_id'] = str(answer_doc['_id'])
            qna_list.append(answer_doc)

    except Exception as e:
        return jsonify({'message': 'Error retrieving interview answers', 'error': str(e)}), 500
    return jsonify({
        'interview_id': interview_id,
        'qna': qna_list
    }), 200

@interviews_bp.route('/interviews/<interview_id>/status', methods=['PUT'])
@token_required
def update_interview_status(caller_identity, interview_id):
    """
    Обновляет статус конкретного собеседования.
    Доступно только компании, которая владеет вакансией.
    """

    data = request.get_json()
    if not data or 'status' not in data:
        return jsonify({'message': 'Поле "status" обязательно для обновления'}), 400

    new_status = data['status']
    valid_statuses = ['rejected', 'completed', 'test_task', 'finalist', 'offer']
    if new_status not in valid_statuses:
        return jsonify({
            'message': f'Недопустимый статус "{new_status}".',
            'allowed_statuses': valid_statuses
        }), 400

    if caller_identity['role'] != 'company':
        return jsonify({'message': 'Только компания может изменять статус собеседования'}), 403

    try:
        interview = interviews_collection.find_one({'_id': ObjectId(interview_id)})
        if not interview:
            return jsonify({'message': 'Собеседование не найдено'}), 404
        vacancy = vacancies_collection.find_one({'_id': ObjectId(interview['vacancy_id'])})
        if not vacancy:
            return jsonify({'message': 'Связанная вакансия не найдена'}), 404

        if vacancy.get('company_id') != caller_identity['id']:
            return jsonify({'message': 'У вас нет прав для управления этим собеседованием'}), 403

    except Exception:
        return jsonify({'message': 'Неверный формат ID'}), 400
    try:
        update_result = interviews_collection.update_one(
            {'_id': ObjectId(interview_id)},
            {'$set': {
                'status': new_status,
                'updated_at': datetime.now(timezone.utc)
            }}
        )

        if update_result.matched_count == 0:
            return jsonify({'message': 'Собеседование не найдено для обновления'}), 404

    except Exception as e:
        return jsonify({'message': 'Ошибка при обновлении статуса', 'error': str(e)}), 500
    return jsonify({'message': f'Статус собеседования успешно изменен на "{new_status}"'}), 200

@interviews_bp.route('/interviews/change-status', methods=['PUT', 'OPTIONS'])
@cross_origin()
@token_required
@roles_required('company') 
def decide_interview_status_flask(caller_identity):
    """
    Устанавливает статус собеседования: 'rejected' или 'accepted'.
    """
    if request.method == 'OPTIONS':
        return '', 200
  
    data = request.get_json()

    if not data or 'status' not in data or 'interview_id' not in data:
        return jsonify({"message": "Тело запроса должно содержать поле 'status'"}), 400

    new_status = data['status']
    interview_id = data['interview_id']
    if new_status not in ['rejected', 'completed', 'test_task', 'finalist', 'offer']:
        return jsonify({
            "message": "Недопустимое значение для статуса.",
            "allowed_statuses": ['rejected', 'completed', 'test_task', 'finalist', 'offer']
        }), 400

    try:
        interview_oid = ObjectId(interview_id)

    except Exception:
        return jsonify({"message": "Некорректный формат ID собеседования."}), 400
    try:
        update_result = interviews_collection.update_one(
            {'_id': interview_oid},
            {'$set': {
                'status': new_status,
                'updated_at': datetime.now(timezone.utc)
            }}
        )
        if update_result.matched_count == 0:
            return jsonify({"message": "Собеседование с таким ID не найдено."}), 404
        else:
            pipeline = [
            {
                '$match': { '_id': interview_oid }
            },
            {
                '$lookup': {
                    'from': 'vacancies',          
                    'localField': 'vacancy_id',  
                    'foreignField': '_id',     
                    'as': 'vacancy_info'         
                }
            },
        
            {
                '$unwind': {
                    'path': '$vacancy_info',
                    'preserveNullAndEmptyArrays': True 
                }
            },
            {
                '$project': {
                    '_id': 0, 
                    'user_id': '$user_id',
                    'vacancy_id': '$vacancy_id',
                    'company_id': '$vacancy_info.company_id' 
                }
            }
            ]

            try:
                result = list(interviews_collection.aggregate(pipeline))

                data = result[0]

                data['user_id'] = str(data['user_id']) if data.get('user_id') else None
                data['vacancy_id'] = str(data['vacancy_id']) if data.get('vacancy_id') else None
                data['company_id'] = str(data['company_id']) if data.get('company_id') else None

                update_status = status_history_collection.insert_one({
                    'interview_id': interview_oid,
                    'user_id': data['user_id'],
                    'vacancy_id': data['vacancy_id'],
                    'company_id': data['company_id'],
                    'status': new_status,
                    'updated_at': datetime.now(timezone.utc)
                })
            except Exception as e:
                return jsonify({"message": f"Ошибка при обновлении базы данных: {e}"}), 500
    except Exception as e:
        return jsonify({"message": f"Ошибка при обновлении базы данных: {e}"}), 500

    return jsonify({
        "message": "Статус собеседования успешно обновлен",
    }), 200
@interviews_bp.route('/vacancies/<vacancy_id>/interviews', methods=['GET'])
@token_required
@roles_required('company') 
def get_interviews_for_vacancy(caller_identity, vacancy_id):
    """
    Возвращает список всех собеседований, связанных с конкретной вакансией.
    Реализована пагинация.
    """

    try:
        vacancy = vacancies_collection.find_one({'_id': ObjectId(vacancy_id)})
        if not vacancy:
            return jsonify({'message': 'Вакансия не найдена'}), 404
        if vacancy.get('company_id') != caller_identity['id']:
            return jsonify({'message': 'У вас нет прав для просмотра собеседований по этой вакансии'}), 403
    except Exception:
        return jsonify({'message': 'Неверный формат ID вакансии'}), 400

    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20)) 
    except ValueError:
        return jsonify({'message': 'Параметры page и per_page должны быть числами'}), 400
    
    skip = (page - 1) * per_page

    query = {'vacancy_id': vacancy_id}
    
    cursor = interviews_collection.find(query).skip(skip).limit(per_page)

    interviews_list = []
    for interview in cursor:
        interview['_id'] = str(interview['_id'])
        if 'user_id' in interview:
            interview['user_id'] = str(interview['user_id'])
        if 'vacancy_id' in interview:
            interview['vacancy_id'] = str(interview['vacancy_id'])
        interviews_list.append(interview)

    total_interviews = interviews_collection.count_documents(query)

    return jsonify({
        'total': total_interviews,
        'page': page,
        'per_page': per_page,
        'total_pages': (total_interviews + per_page - 1) // per_page,
        'interviews': interviews_list
    }), 200

@interviews_bp.route('/interviews/<interview_id>', methods=['DELETE'])
@token_required
@roles_required('user')
def delete_interview(caller_identity, interview_id):
    """
    Удаляет интервью и все связанные с ним данные при выходе пользователя из собеседования.
    Только пользователь-владелец интервью может удалить его.
    """
    user_id = caller_identity['id']
    
    try:
        interview = interviews_collection.find_one({'_id': ObjectId(interview_id)})
        if not interview:
            return jsonify({'message': 'Интервью не найдено'}), 404

        if str(interview.get('user_id')) != user_id:
            return jsonify({'message': 'У вас нет прав для удаления этого интервью'}), 403

        try:
            answers_result = interview_answers_collection.delete_many({'interview_id': ObjectId(interview_id)})
            logging.info(f" Удалено ответов интервью: {answers_result.deleted_count}")
        except Exception as e:
            logging.error(f"Ошибка при удалении ответов интервью: {e}")

        try:
            status_result = status_history_collection.delete_many({'interview_id': ObjectId(interview_id)})
            logging.info(f"Удалено записей истории статусов: {status_result.deleted_count}")
        except Exception as e:
            logging.error(f"Ошибка при удалении истории статусов: {e}")

        delete_result = interviews_collection.delete_one({'_id': ObjectId(interview_id)})
        
        if delete_result.deleted_count == 0:
            return jsonify({'message': 'Интервью не было удалено'}), 500
            
        logging.info(f"Интервью {interview_id} успешно удалено пользователем {user_id}")
        
        return jsonify({
            'message': 'Интервью успешно удалено',
            'deleted_interview_id': interview_id,
            'deleted_answers': answers_result.deleted_count if 'answers_result' in locals() else 0,
            'deleted_status_history': status_result.deleted_count if 'status_result' in locals() else 0
        }), 200
        
    except Exception as e:
        logging.error(f"Ошибка при удалении интервью {interview_id}: {e}")
        return jsonify({'message': f'Ошибка при удалении интервью: {str(e)}'}), 500
