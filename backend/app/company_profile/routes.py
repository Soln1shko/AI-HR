from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
import logging
from ..core.database import company_profile_collection, companies_collection
from ..core.decorators import token_required, roles_required
from datetime import datetime

company_profile_bp = Blueprint('company_profile', __name__)

@company_profile_bp.route('/company-profile', methods=['GET'])
@token_required
@roles_required('company')
def get_company_profile(caller_identity):
    """
    Получение профиля компании
    """
    try:
        company_id = caller_identity.get('id')
        if not company_id:
            return jsonify({'message': 'ID компании не найден в токене'}), 400

        profile = company_profile_collection.find_one({"company_id": ObjectId(company_id)})
        
        if not profile:

            company = companies_collection.find_one({"_id": ObjectId(company_id)})
            if company:
                profile = {
                    "company_id": ObjectId(company_id),
                    "basic_info": {
                        "website": "",
                        "industry": "",
                        "is_it_accredited": False,
                        "logo_url": ""
                    },
                    "detailed_description": {
                        "about_company": "",  
                        "about_team": "",      
                        "team_size": "",      
                        "corporate_culture": "", 
                        "work_conditions": "" 
                    },
                   
                    "contact_info": {
                        "phone": "",
                        "city": "",
                        "country": ""
                    },
                   
                    "benefits": [],
                    
                    "social_links": {
                        "linkedin": "",
                        "telegram": "",
                        "vk": "",
                        "facebook": ""
                    },
                    
                    "additional_info": {
                        "founded_year": None,
                        "employee_count": "",
                        "specializations": [],
                        "office_photos": [],
                        "company_values": []
                    },
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                result = company_profile_collection.insert_one(profile)
                profile['_id'] = result.inserted_id
            else:
                return jsonify({'message': 'Компания не найдена'}), 404
        
        
        company = companies_collection.find_one({"_id": ObjectId(company_id)})
        if not company:
            return jsonify({'message': 'Компания не найдена'}), 404
        
        
        combined_profile = {
            "_id": str(profile['_id']),
            "company_id": str(profile['company_id']),
            
            "basic_info": {
                "company_name": company.get('company_name', ''), 
                **profile.get('basic_info', {})  
            },
            
            "detailed_description": profile.get('detailed_description', {}),
            
            "contact_info": {
                "email": company.get('email', ''),  
                "address": company.get('legal_address', ''),  
                **profile.get('contact_info', {})  
            },
            
            "benefits": profile.get('benefits', []),
            "social_links": profile.get('social_links', {}),
            "additional_info": profile.get('additional_info', {}),
            "created_at": profile.get('created_at'),
            "updated_at": profile.get('updated_at')
        }
        
        return jsonify(combined_profile), 200
        
    except Exception as e:
        logging.error(f"Ошибка при получении профиля компании: {e}")
        return jsonify({'message': 'Внутренняя ошибка сервера'}), 500


@company_profile_bp.route('/company-profile', methods=['PUT'])
@token_required
@roles_required('company')
def update_company_profile(caller_identity):
    """
    Обновление профиля компании
    """
    try:
        company_id = caller_identity.get('id')
        if not company_id:
            return jsonify({'message': 'ID компании не найден в токене'}), 400
        
        data = request.get_json()
        if not data:
            return jsonify({'message': 'Данные не предоставлены'}), 400
        
        companies_update = {}
        profile_update = {}
      
        if 'basic_info' in data:
            basic_info = data['basic_info']
            if 'company_name' in basic_info:
                companies_update['company_name'] = basic_info['company_name']

            profile_basic_info = {k: v for k, v in basic_info.items() if k != 'company_name'}
            if profile_basic_info:
                profile_update['basic_info'] = profile_basic_info

        if 'contact_info' in data:
            contact_info = data['contact_info']
            if 'email' in contact_info:
                companies_update['email'] = contact_info['email']
            if 'address' in contact_info:
                companies_update['legal_address'] = contact_info['address']

            profile_contact_info = {k: v for k, v in contact_info.items() if k not in ['email', 'address']}
            if profile_contact_info:
                profile_update['contact_info'] = profile_contact_info

        profile_only_fields = ['detailed_description', 'benefits', 'social_links', 'additional_info']
        for field in profile_only_fields:
            if field in data:
                profile_update[field] = data[field]

        if companies_update:
            try:
                companies_collection.update_one(
                    {"_id": ObjectId(company_id)},
                    {"$set": companies_update}
                )
            except Exception as e:
                logging.error(f"Ошибка при обновлении companies: {e}")
                return jsonify({'message': 'Ошибка при обновлении основных данных компании'}), 500

        if profile_update:
            profile_update['updated_at'] = datetime.utcnow()
            
            result = company_profile_collection.update_one(
                {"company_id": ObjectId(company_id)},
                {"$set": profile_update},
                upsert=True
            )
            
            if result.matched_count == 0 and result.upserted_id is None:
                return jsonify({'message': 'Ошибка при обновлении профиля'}), 500

        if not companies_update and not profile_update:
            return jsonify({'message': 'Нет данных для обновления'}), 400

        updated_profile = company_profile_collection.find_one({"company_id": ObjectId(company_id)})
        updated_company = companies_collection.find_one({"_id": ObjectId(company_id)})
        
        if updated_profile and updated_company:
            combined_profile = {
                "_id": str(updated_profile['_id']),
                "company_id": str(updated_profile['company_id']),

                "basic_info": {
                    "company_name": updated_company.get('company_name', ''),  
                    **updated_profile.get('basic_info', {})  
                },
   
                "detailed_description": updated_profile.get('detailed_description', {}),

                "contact_info": {
                    "email": updated_company.get('email', ''),  
                    "address": updated_company.get('legal_address', ''),  
                    **updated_profile.get('contact_info', {})  
                },
              
                "benefits": updated_profile.get('benefits', []),
                "social_links": updated_profile.get('social_links', {}),
                "additional_info": updated_profile.get('additional_info', {}),
                "created_at": updated_profile.get('created_at'),
                "updated_at": updated_profile.get('updated_at')
            }
        else:
            combined_profile = None
        
        return jsonify({
            'message': 'Профиль успешно обновлен',
            'profile': combined_profile
        }), 200
        
    except Exception as e:
        logging.error(f"Ошибка при обновлении профиля компании: {e}")
        return jsonify({'message': 'Внутренняя ошибка сервера'}), 500


@company_profile_bp.route('/company-profile/public/<company_id>', methods=['GET'])
def get_public_company_profile(company_id):
    """
    Получение публичного профиля компании (для просмотра кандидатами)
    """
    try:
        if not ObjectId.is_valid(company_id):
            return jsonify({'message': 'Некорректный ID компании'}), 400

        profile = company_profile_collection.find_one({"company_id": ObjectId(company_id)})
        
        if not profile:

            company = companies_collection.find_one({"_id": ObjectId(company_id)})
            if not company:
                return jsonify({'message': 'Компания не найдена'}), 404
            
            profile = {
                "basic_info": {
                    "company_name": company.get('company_name', ''),  
                    "website": "",
                    "industry": "",
                    "is_it_accredited": False,
                    "logo_url": ""
                },
                "detailed_description": {
                    "about_company": "Информация о компании пока не заполнена",
                    "about_team": "",
                    "team_size": "",
                    "corporate_culture": "",
                    "work_conditions": ""
                },
                "contact_info": {
                    "email": company.get('email', ''),
                    "address": company.get('legal_address', ''),
                    "phone": "",
                    "city": "",
                    "country": ""
                },
                "benefits": [],
                "additional_info": {
                    "founded_year": None,
                    "employee_count": "",
                    "specializations": []
                }
            }
        else:

            company = companies_collection.find_one({"_id": ObjectId(company_id)})
            if not company:
                return jsonify({'message': 'Компания не найдена'}), 404
            
            profile = {

                "basic_info": {
                    "company_name": company.get('company_name', ''),  
                    **profile.get('basic_info', {})  
                },

                "detailed_description": profile.get('detailed_description', {}),
        
                "contact_info": {
                    "email": company.get('email', ''),  
                    "address": company.get('legal_address', ''),  
                    **profile.get('contact_info', {}) 
                },

                "benefits": profile.get('benefits', []),
                "social_links": profile.get('social_links', {}),
                "additional_info": profile.get('additional_info', {})
            }
        
        return jsonify(profile), 200
        
    except Exception as e:
        logging.error(f"Ошибка при получении публичного профиля компании: {e}")
        return jsonify({'message': 'Внутренняя ошибка сервера'}), 500
