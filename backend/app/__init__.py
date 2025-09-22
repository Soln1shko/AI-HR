# app/__init__.py
from flask import Flask
from flask_cors import CORS
from config import Config

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    CORS(app, origins="*", expose_headers=['Content-Disposition'])

    # Регистрация Blueprints (маршрутов)
    from .auth.routes import auth_bp
    from .users.routes import users_bp
    from .companies.routes import companies_bp
    from .company_profile.routes import company_profile_bp
    from .vacancies.routes import vacancies_bp
    from .interviews.routes import interviews_bp
    from .report.routes import reports_bp
    from .video.routes import video_bp
    from .hh_integration.routes import hh_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(companies_bp)
    app.register_blueprint(company_profile_bp)
    app.register_blueprint(vacancies_bp)
    app.register_blueprint(interviews_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(video_bp,url_prefix = '/video')
    app.register_blueprint(hh_bp)

    return app
