from flask import Blueprint, request, jsonify,Response,current_app
from bson import ObjectId
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from ..core.database import users_collection, companies_collection
from ..core.utils import allowed_file, safe_filename
from ..services.export_to_yandex_cloud import create_s3_session, upload_file_object_to_s3, upload_company_avatar_to_s3, get_company_avatar_url, check_company_avatar_exists
from ..services.delete_from_yandex_cloud import delete_file_from_s3, delete_company_avatar_from_s3
from ..services.import_from_yandex_cloud import get_company_avatar_from_s3
import os
from ..core.decorators import token_required, roles_required
import logging

companies_bp = Blueprint('companies', __name__)

@companies_bp.route('/company')
@token_required 
@roles_required('company')
def company_dashboard(caller_identity): 
    company = companies_collection.find_one({'_id': ObjectId(caller_identity['id'])})
    if not company:
        return jsonify({'message': 'Компания не найдена'}), 404
        
    return jsonify({
        '_id': str(company['_id']),
        'email': company['email'],
        'inn': company.get('inn'),
        'ogrn': company.get('ogrn'),
        'company_name': company.get('company_name'),
        'legal_address': company.get('legal_address'),
        'role': company['role']
    }), 200

@companies_bp.route('/company/avatar', methods=['POST'])
@token_required
@roles_required('company')
def upload_company_avatar(caller_identity):
    if 'avatar' not in request.files:
        return jsonify({'message': 'Файл аватара отсутствует'}), 400

    file = request.files['avatar']
    company = companies_collection.find_one({'_id': ObjectId(caller_identity['id'])})
    if not company:
        return jsonify({'message': 'Компания не найдена'}), 404
        
    company_id = str(company['_id'])
    
    if file and file.filename:

        file_extension = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else 'jpg'
        logging.info(f"Загружается аватарка: {file.filename}, расширение: {file_extension}")
        
        s3_client = create_s3_session()
        if not s3_client:
            return jsonify({'message': 'Ошибка подключения к хранилищу'}), 500

        bucket_name = os.getenv('YC_STORAGE_BUCKET')
        if not bucket_name:
            return jsonify({'message': 'Конфигурация хранилища не найдена'}), 500

        delete_company_avatar_from_s3(s3_client, company_id, file_extension, bucket_name)

        success, avatar_url = upload_company_avatar_to_s3(s3_client, file, company_id, file_extension, bucket_name)
        
        if success:
            return jsonify({
                'message': 'Аватар успешно сохранен',
                'avatar_url': avatar_url
            }), 200
        else:
            return jsonify({'message': 'Ошибка при загрузке аватара'}), 500
    else:
        return jsonify({'message': 'Недопустимый файл'}), 400
  
@companies_bp.route('/companies', methods=['GET'])
@token_required
def get_all_companies(caller_identity):
    """
    Возвращает список всех компаний с пагинацией.
    Исключает из ответа чувствительные данные, такие как пароль.
    """
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
    except ValueError:
        return jsonify({'message': 'Параметры page и per_page должны быть числами'}), 400

    skip = (page - 1) * per_page

    projection = {
        'password': 0
    }
    query = {}
    cursor = companies_collection.find(query, projection).skip(skip).limit(per_page)
    companies_list = []
    for company in cursor:
        company['_id'] = str(company['_id'])
        companies_list.append(company)
    total_companies = companies_collection.count_documents(query)

    return jsonify({
        'total': total_companies,
        'page': page,
        'per_page': per_page,
        'total_pages': (total_companies + per_page - 1) // per_page,
        'companies': companies_list
    }), 200

@companies_bp.route('/company/updateprofile', methods=['PUT'])
@token_required
@roles_required('company') 
def update_own_company_profile(caller_identity):
    """
    Обновляет профиль текущей компании, аутентифицированной по токену.
    """

    company_id = caller_identity['id']

    data = request.get_json()
    if not data:
        return jsonify({'message': 'Нет данных для обновления'}), 400

    update_fields = {}
    allowed_fields = ['company_name', 'inn', 'ogrn', 'legal_address']
    for field in allowed_fields:
        if field in data:
            update_fields[field] = data[field]
    
    if not update_fields:
        return jsonify({'message': 'Нет разрешенных полей для обновления'}), 400

    try:
        result = companies_collection.update_one(
            {'_id': ObjectId(company_id)}, 
            {'$set': update_fields}
        )
        if result.matched_count == 0:
            return jsonify({'message': 'Компания не найдена'}), 404
    except Exception as e:
        return jsonify({'message': 'Ошибка при обновлении профиля компании', 'error': str(e)}), 500

    return jsonify({'message': 'Профиль компании успешно обновлен'}), 200


@companies_bp.route('/company/avatar/<company_id>', methods=['GET'])
@token_required
def get_company_avatar(caller_identity, company_id):
    """
    Получает URL аватарки компании из S3.
    """
    try:

        company = companies_collection.find_one({'_id': ObjectId(company_id)})
        if not company:
            return jsonify({'message': 'Компания не найдена'}), 404

        s3_client = create_s3_session()
        if not s3_client:
            return jsonify({'message': 'Ошибка подключения к хранилищу'}), 500

        bucket_name = os.getenv('YC_STORAGE_BUCKET')
        if not bucket_name:
            return jsonify({'message': 'Конфигурация хранилища не найдена'}), 500
        extensions = ['jpg', 'jpeg', 'png', 'webp']
        for ext in extensions:
            if check_company_avatar_exists(s3_client, company_id, ext, bucket_name):
                avatar_url = get_company_avatar_url(company_id, ext, bucket_name)
                logging.info(f"Найдена аватарка для компании {company_id}: {avatar_url}")
                return jsonify({
                    'avatar_url': avatar_url,
                    'exists': True
                }), 200

        logging.info(f"Аватарка не найдена для компании {company_id}")
        return jsonify({
            'avatar_url': None,
            'exists': False
        }), 200
        
    except Exception as e:
        logging.error(f"Ошибка при получении аватарки компании: {e}")
        return jsonify({'message': 'Ошибка при получении аватарки'}), 500


@companies_bp.route('/company/avatar/<company_id>/image', methods=['GET'])
@token_required
def get_company_avatar_image(caller_identity, company_id):
    """
    Получает аватарку компании как изображение (для отображения в браузере).
    """
    try:

        company = companies_collection.find_one({'_id': ObjectId(company_id)})
        if not company:
            return jsonify({'message': 'Компания не найдена'}), 404

        s3_client = create_s3_session()
        if not s3_client:
            return jsonify({'message': 'Ошибка подключения к хранилищу'}), 500

        bucket_name = os.getenv('YC_STORAGE_BUCKET')
        if not bucket_name:
            return jsonify({'message': 'Конфигурация хранилища не найдена'}), 500

        extensions = ['jpg', 'jpeg', 'png', 'webp']
        for ext in extensions:
            success, file_data, content_type = get_company_avatar_from_s3(s3_client, company_id, ext, bucket_name)
            if success and file_data:
                logging.info(f"Отдаем аватарку компании {company_id} как изображение")
                return Response(
                    file_data,
                    mimetype=content_type,
                    headers={
                        'Cache-Control': 'public, max-age=3600',
                        'Content-Length': str(len(file_data))
                    }
                )

        logging.info(f"Аватарка компании {company_id} не найдена, возвращаем заглушку")
        return jsonify({'message': 'Аватарка не найдена'}), 404
        
    except Exception as e:
        logging.error(f"Ошибка при получении изображения аватарки компании: {e}")
        return jsonify({'message': 'Ошибка при получении изображения'}), 500