from flask import Blueprint, request, jsonify,Response,current_app
from bson import ObjectId
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from ..core.database import users_collection, companies_collection, interviews_collection, status_history_collection
from ..core.utils import allowed_file, safe_filename
from ..services.export_to_yandex_cloud import create_s3_session, upload_file_object_to_s3
from ..services.delete_from_yandex_cloud import delete_file_from_s3
import os
from ..core.decorators import token_required, roles_required
import logging
from ..services.extract_resumeHH import extract_resume_from_HH

users_bp = Blueprint('users', __name__)

@users_bp.route('/profile')
@token_required
def get_profile(caller_identity):

    user = users_collection.find_one({'_id': ObjectId(caller_identity['id'])})
    if not user:
        return jsonify({'message': 'Пользователь не найден'}), 404
    
    return jsonify({
        'email': user['email'],
        'telegram_id': user.get('telegram_id'),
        'name': user.get('name'),
        'surname': user.get('surname'),
        'role': user['role'],
        'resume_path': user.get('resume_path')
    })

@users_bp.route('/user/updateprofile', methods=['PUT'])
@token_required
@roles_required('user') 
def update_own_user_profile(caller_identity):
    """
    Обновляет профиль текущего пользователя, аутентифицированного по токену.
    """
    user_id = caller_identity['id']
    data = request.get_json()
    if not data:
        return jsonify({'message': 'Нет данных для обновления'}), 400
    update_fields = {}
    allowed_fields = ['name', 'surname', 'telegram_id']
    for field in allowed_fields:
        if field in data:
            update_fields[field] = data[field]
    
    if not update_fields:
        return jsonify({'message': 'Нет разрешенных полей для обновления'}), 400

    try:
        result = users_collection.update_one(
            {'_id': ObjectId(user_id)}, 
            {'$set': update_fields}
        )

        if result.matched_count == 0:
            return jsonify({'message': 'Пользователь не найден'}), 404
    except Exception as e:
        return jsonify({'message': 'Ошибка при обновлении профиля', 'error': str(e)}), 500

    return jsonify({'message': 'Профиль успешно обновлен'}), 200

@users_bp.route('/download-resume', methods=['GET'])
@token_required
def download_resume(caller_identity):
    """
    Скачивание резюме пользователя из Yandex Object Storage
    """
    try:

        user_id = caller_identity.get('_id') or caller_identity.get('id')
        if not user_id:
            return jsonify({'message': 'ID пользователя не найден'}), 400
            
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            return jsonify({'message': 'Пользователь не найден'}), 404
        
        if not user.get('resume_path'):
            return jsonify({'message': 'Резюме не найдено'}), 404
        
        s3_client = create_s3_session()
        if not s3_client:
            return jsonify({'message': 'Ошибка подключения к облачному хранилищу'}), 500
        
        resume_path = user['resume_path']
        
        if resume_path.startswith('https://storage.yandexcloud.net/'):
            
            url_parts = resume_path.split('/')
            if len(url_parts) >= 6:
               
                object_name = '/'.join(url_parts[4:])  # resumes/filename.ext
            else:
                
                resume_filename = os.path.basename(resume_path)
                object_name = f"resumes/{resume_filename}"
        else:
            
            resume_filename = os.path.basename(resume_path)
            object_name = f"resumes/{resume_filename}"
        
        try:
            
            response = s3_client.get_object(Bucket=current_app.config['YC_STORAGE_BUCKET'], Key=object_name)
            file_content = response['Body'].read()
            
            download_filename = os.path.basename(object_name)
            
            if download_filename.lower().endswith('.pdf'):
                mimetype = 'application/pdf'
            elif download_filename.lower().endswith('.doc'):
                mimetype = 'application/msword'
            elif download_filename.lower().endswith('.docx'):
                mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            else:
                mimetype = 'application/octet-stream'
            
            response = Response(
                file_content,
                mimetype=mimetype,
                headers={
                    'Content-Disposition': f'attachment; filename="{download_filename}"',
                    'Content-Length': str(len(file_content))
                }
            )
            return response
            
        except Exception as e:
            logging.error(f"Ошибка при скачивании файла из S3: {e}")
            return jsonify({'message': 'Файл не найден в хранилище'}), 404
            
    except Exception as e:
        logging.error(f"Ошибка при скачивании резюме: {e}")
        return jsonify({'message': 'Внутренняя ошибка сервера'}), 500

@users_bp.route('/update-resume', methods=['POST'])
@token_required
def update_resume(caller_identity):
    """
    Обновление резюме пользователя: удаление старого и загрузка нового
    """
    try:
       
        if 'resume' not in request.files:
            return jsonify({'message': 'Файл резюме отсутствует'}), 400

        file = request.files['resume']
        if not file or not allowed_file(file.filename):
            return jsonify({'message': 'Недопустимый тип файла'}), 400

        user_id = caller_identity.get('_id') or caller_identity.get('id')
        if not user_id:
            return jsonify({'message': 'ID пользователя не найден'}), 400
            
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({'message': 'Пользователь не найден'}), 404
        s3_client = create_s3_session()
        if not s3_client:
            return jsonify({'message': 'Ошибка подключения к облачному хранилищу'}), 500
        old_resume_path = user.get('resume_path')
        if old_resume_path:
            
            if old_resume_path.startswith('https://storage.yandexcloud.net/'):
                url_parts = old_resume_path.split('/')
                if len(url_parts) >= 6:
                    old_object_name = '/'.join(url_parts[4:])  
                    delete_file_from_s3(s3_client, current_app.config['YC_STORAGE_BUCKET'], old_object_name)
                    logging.info(f"Старое резюме удалено: {old_object_name}")

        safe_name = safe_filename(file.filename)
        unique_filename = f"{user['email']}_{safe_name}"
        
        success, file_url = upload_file_object_to_s3(s3_client, file, unique_filename, current_app.config['YC_STORAGE_BUCKET'])
        
        if not success:
            return jsonify({'message': 'Ошибка при загрузке нового резюме'}), 500

        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"resume_path": file_url,'parsed_resume': None}}
        )

        return jsonify({
            'message': 'Резюме успешно обновлено',
            'resume_path': file_url
        }), 200

    except Exception as e:
        logging.error(f"Ошибка при обновлении резюме: {e}")
        return jsonify({'message': 'Внутренняя ошибка сервера'}), 500

@users_bp.route('/update-resume-from-hh', methods=['POST'])
@token_required
def update_resume_from_hh(caller_identity):
    """
    Обновление резюме пользователя: удаление старого и загрузка нового
    """
    try:
        request.get_json()

        hh_resume_url = request.json.get('hh_resume_url')
        if not hh_resume_url:
            return jsonify({'message': 'URL резюме отсутствует'}), 400

        user_id = caller_identity.get('_id') or caller_identity.get('id')
        if not user_id:
            return jsonify({'message': 'ID пользователя не найден'}), 400
            
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({'message': 'Пользователь не найден'}), 404

        s3_client = create_s3_session()
        if not s3_client:
            return jsonify({'message': 'Ошибка подключения к облачному хранилищу'}), 500

        old_resume_path = user.get('resume_path')
        if old_resume_path:
            if old_resume_path.startswith('https://storage.yandexcloud.net/'):
                url_parts = old_resume_path.split('/')
                if len(url_parts) >= 6:
                    old_object_name = '/'.join(url_parts[4:])  
                    delete_file_from_s3(s3_client, current_app.config['YC_STORAGE_BUCKET'], old_object_name)
                    logging.info(f"Старое резюме удалено: {old_object_name}")

        file = extract_resume_from_HH(hh_resume_url)
        safe_name = safe_filename(file.filename)
        unique_filename = f"{user['email']}_{safe_name}"
        
        success, file_url = upload_file_object_to_s3(s3_client, file, unique_filename, current_app.config['YC_STORAGE_BUCKET'])
        
        if not success:
            return jsonify({'message': 'Ошибка при загрузке нового резюме'}), 500
        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"resume_path": file_url,'parsed_resume': None}}
        )

        return jsonify({
            'message': 'Резюме успешно обновлено',
            'resume_path': file_url
        }), 200

    except Exception as e:
        logging.error(f"Ошибка при обновлении резюме: {e}")
        return jsonify({'message': 'Внутренняя ошибка сервера'}), 500
    
@users_bp.route('/download-candidate-resume', methods=['GET'])
@token_required
@roles_required('company') 
def download_candidate_resume(caller_identity):
    """
    Скачивание резюме кандидата HR-ом из Yandex Object Storage
    """
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'message': 'user_id обязателен'}), 400
            
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            return jsonify({'message': 'Пользователь не найден'}), 404
        
        if not user.get('resume_path'):
            return jsonify({'message': 'Резюме не найдено'}), 404
        s3_client = create_s3_session()
        if not s3_client:
            return jsonify({'message': 'Ошибка подключения к облачному хранилищу'}), 500
        resume_path = user['resume_path']
        if resume_path.startswith('https://storage.yandexcloud.net/'):
            url_parts = resume_path.split('/')
            if len(url_parts) >= 6:
                object_name = '/'.join(url_parts[4:])
            else:
                resume_filename = os.path.basename(resume_path)
                object_name = f"resumes/{resume_filename}"
        else:
            resume_filename = os.path.basename(resume_path)
            object_name = f"resumes/{resume_filename}"
        
        try:
            response = s3_client.get_object(Bucket=current_app.config['YC_STORAGE_BUCKET'], Key=object_name)
            file_content = response['Body'].read()
            download_filename = os.path.basename(object_name)
            if download_filename.lower().endswith('.pdf'):
                mimetype = 'application/pdf'
            elif download_filename.lower().endswith('.doc'):
                mimetype = 'application/msword'
            elif download_filename.lower().endswith('.docx'):
                mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            else:
                mimetype = 'application/octet-stream'
            response = Response(
                file_content,
                mimetype=mimetype,
                headers={
                    'Content-Disposition': f'attachment; filename="{download_filename}"',
                    'Content-Length': str(len(file_content))
                }
            )
            return response
            
        except Exception as e:
            logging.error(f"Ошибка при скачивании файла кандидата из S3: {e}")
            return jsonify({'message': 'Файл не найден в хранилище'}), 404
            
    except Exception as e:
        logging.error(f"Ошибка при скачивании резюме кандидата: {e}")
        return jsonify({'message': 'Внутренняя ошибка сервера'}), 500
    
@users_bp.route('/user-interviews', methods=['GET'])
@token_required
@roles_required('user')
def get_all_interviews_for_user(caller_identity):
    """
    Возвращает список всех собеседований для указанного пользователя.
    Добавляет пагинацию для обработки больших объемов данных.
    """
    try:
        user_id = ObjectId(caller_identity['id'])
    except Exception:
        return jsonify({"message": "Некорректный формат ID пользователя."}), 400
    
    try:
        query = {'user_id': user_id}
        cursor = interviews_collection.find(query)
        total_documents = interviews_collection.count_documents(query)
        interviews_list = []
        for interview in cursor:
            interview['_id'] = str(interview['_id'])
            if 'user_id' in interview:
                interview['user_id'] = str(interview['user_id'])
            if 'vacancy_id' in interview:
                interview['vacancy_id'] = str(interview['vacancy_id'])
            interviews_list.append(interview)
            
    except Exception as e:
        return jsonify({"message": f"Ошибка при обращении к базе данных: {e}"}), 500

    return jsonify({
        "interviews": interviews_list
    }), 200

@users_bp.route('/user-interviews-status-changes', methods=['GET'])
@token_required
@roles_required('user')
def get_user_interviews_status_changes(caller_identity):
    try:
        user_id = caller_identity['id']
    except Exception:
        return jsonify({"message": "Некорректный формат ID пользователя."}), 400
    try:
        query = {'user_id': user_id}
        cursor = status_history_collection.find(query)
        status_changes_list = []
        for status_changes in cursor:
            status_changes['_id'] = str(status_changes['_id'])
            if 'interview_id' in status_changes:
                status_changes['interview_id'] = str(status_changes['interview_id'])
            status_changes_list.append(status_changes)
            
    except Exception as e:
        return jsonify({"message": f"Ошибка при обращении к базе данных: {e}"}), 500

    return jsonify({
        "status_changes": status_changes_list
    }), 200
