from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from ..core.database import users_collection, companies_collection
from ..core.utils import allowed_file, safe_filename
from ..services.export_to_yandex_cloud import create_s3_session, upload_file_object_to_s3
import os
from ..services.extract_resumeHH import extract_resume_from_HH
import logging

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Неполные данные'}), 400

    email = data['email']
    password = data['password']

    account = users_collection.find_one({'email': email})
    if not account:
        account = companies_collection.find_one({'email': email}) 
    if account and bcrypt.checkpw(password.encode('utf-8'), account['password']):
        role = account.get('role')
        
        token = jwt.encode({
            'account_id': str(account['_id']),
            'user': email,
            'role': role, 
            'exp': datetime.now(timezone.utc) + timedelta(hours=24)
        }, current_app.config['SECRET_KEY'], algorithm='HS256')

        return jsonify({'token': token, 'role': role}), 200
    
@auth_bp.route('/register', methods=['POST'])
def register():
    email = request.form.get('email')
    password = request.form.get('password')
    telegram_id = request.form.get('telegram_id')
    name = request.form.get('name')
    surname = request.form.get('surname')
    hh_resume_url = request.form.get('hh_resume_url')

    if not email or not password:
        return jsonify({'message': 'Email и пароль обязательны'}), 400

    if users_collection.find_one({'email': email}):
        return jsonify({'message': 'Пользователь с таким email уже существует'}), 409

    file = None
    if hh_resume_url:
        file = extract_resume_from_HH(hh_resume_url)
    elif 'resume' in request.files and request.files['resume'].filename != '':
        file = request.files['resume']

    if not file:
        return jsonify({'message': 'Резюме не было предоставлено или не удалось его получить'}), 400
    
    filepath = None
    if file and allowed_file(file.filename):
        safe_name = safe_filename(file.filename)
        unique_filename = f"{email}_{safe_name}"
        
        s3_client = create_s3_session()
        
        if s3_client and current_app.config['YC_STORAGE_BUCKET']:
            success, file_url = upload_file_object_to_s3(s3_client, file, unique_filename, current_app.config['YC_STORAGE_BUCKET'])
            
            if success:
                filepath = file_url
                logging.info(f"Файл успешно загружен в Yandex Storage: {file_url}")
            else:
                logging.warning(f"Не удалось загрузить в Yandex Storage, сохранено локально.")
                filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
                try:
                    file.seek(0)
                    with open(filepath, 'wb') as f:
                        f.write(file.read())
                except AttributeError:
                    file.seek(0)
                    file.save(filepath)

        else:
            logging.warning(f"Yandex Storage не настроен, сохранено локально.")
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
            try:
                file.seek(0)
                with open(filepath, 'wb') as f:
                    f.write(file.read())
            except AttributeError:
                file.seek(0)
                file.save(filepath)

    elif file:
        return jsonify({'message': f'Недопустимый тип файла: {file.filename}'}), 400

    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    result = users_collection.insert_one({
        'email': email,
        'password': hashed_password,
        'telegram_id': telegram_id,
        'name': name,
        'surname': surname,
        'resume_path': filepath,
        'role': 'user'
    })

    user_id = str(result.inserted_id)
    token = jwt.encode({
        'account_id': user_id,
        'user': email,
        'role': 'user', 
        'exp': datetime.now(timezone.utc) + timedelta(hours=24)
    }, current_app.config['SECRET_KEY'], algorithm='HS256')

    return jsonify({
        'message': 'Пользователь успешно зарегистрирован',
        'token': token,
        'role': 'user'
    }), 201

@auth_bp.route('/register/company', methods=['POST'])
def register_company():
    data = request.get_json()
    
    company_name = data.get('company_name')
    inn = data.get('inn')
    ogrn = data.get('ogrn')
    legal_address = data.get('legal_address')
    email = data.get('email')
    password = data.get('password')

    required_fields = [company_name, inn, ogrn, legal_address, email, password]
    if not all(required_fields):
        return jsonify({'message': 'Все поля обязательны для заполнения'}), 400
    if companies_collection.find_one({'company_name': {'$regex': f'^{company_name}$', '$options': 'i'}}):
        return jsonify({'message': 'Компания с таким названием уже зарегистрирована'}), 409
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    new_company = {
        'company_name': company_name,
        'inn': inn,
        'ogrn': ogrn,
        'legal_address': legal_address,
        'email': email,
        'password': hashed_password,
        'role': 'company'
    }
    
    companies_collection.insert_one(new_company)

    return jsonify({'message': 'Компания успешно зарегистрирована'}), 201
