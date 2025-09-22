from flask import Blueprint, request, jsonify, send_file, abort
from ..services.create_doc import generate_report

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/report/vacancy/<string:vacancy_id>', methods=['GET'])
def download_report(vacancy_id):
    """
    Генерирует и отдает отчет по ID вакансии.
    Пример использования: GET /report/vacancy/{vacancy_id}
    """
    if not vacancy_id:
        return jsonify({'message': 'vacancy_id обязателен'}), 400
    file_stream, data = generate_report(vacancy_id)
    
    if not file_stream:
        if data == "Vacancy not found":
            abort(404, description=f"Вакансия с ID '{vacancy_id}' не найдена.")
        else:
            abort(500, description=data) 

    vacancy_title = data
    filename = f"report_{vacancy_title.replace(' ', '_')}.docx"
 
    return send_file(
        file_stream,
        as_attachment=True,
        download_name=filename,
        mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
