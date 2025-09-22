import io
import os
from collections import defaultdict

import matplotlib
matplotlib.use('Agg') 
import matplotlib.pyplot as plt
from docx import Document
from docx.shared import Inches
from docxtpl import DocxTemplate, InlineImage
from docx.enum.text import WD_ALIGN_PARAGRAPH
from pymongo import MongoClient
from bson.objectid import ObjectId
from ..core.database import users_collection, companies_collection, vacancies_collection,status_history_collection

# --- Настройки ---
FUNNEL_STAGES = ["completed", "test_task", "finalist", "offer","rejected"]
TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "otchet_voronka.docx")  # Путь к вашему новому шаблону
STATUS_TRANSLATIONS = {
    "test_task": "Тестовое",
    "finalist": "Финал",
    "offer": "Оффер",
    "completed": "Пройдено интервью",
    "rejected": "Отказ",
}

# --- Данные из MongoDB ---
def get_funnel_data(vacancy_id, funnel_stages):
  
    status_history_cursor = status_history_collection.find({"vacancy_id": vacancy_id})
    candidates_by_stage = defaultdict(set)
    for entry in status_history_cursor:
        status, user_id = entry.get("status"), entry.get("user_id")
        if status in funnel_stages and user_id:
            candidates_by_stage[status].add(user_id)
    funnel_data = []
    prev_count = None
    for stage in funnel_stages:
        count = len(candidates_by_stage.get(stage, set()))
        conversion = round((count / prev_count) * 100, 1) if prev_count and prev_count > 0 else None

        funnel_data.append({
            'stage': STATUS_TRANSLATIONS.get(stage, stage.capitalize()), # <-- ДОБАВИТЬ ЭТУ СТРОКУ
            'candidates': count,
            'conversion': f"{conversion}%" if conversion is not None else '—'
        })
    
        prev_count = count
    print(funnel_data)
    return funnel_data

def get_summary_data(vacancy_id):
   
    vacancy = vacancies_collection.find_one({"_id": ObjectId(vacancy_id)})
    if not vacancy: return None
    time_to_hire = "В процессе"
    final_status = status_history_collection.find_one({"vacancy_id": vacancy_id, "status": "completed"}, sort=[("updated_at", -1)])
    if final_status:
        start_date, end_date = vacancy.get("created_at"), final_status.get("updated_at")
        if start_date and end_date: time_to_hire = f"{(end_date - start_date).days} дней"
    total_candidates = status_history_collection.distinct("user_id", {"vacancy_id": vacancy_id})
    open_vacancies_count = vacancies_collection.count_documents({})
    return {"vacancy_title": vacancy.get("title", "Без названия"),
            "kpi": {"time_to_hire": time_to_hire, "total_candidates": len(total_candidates),
                    "open_vacancies_count": open_vacancies_count}}

def create_bar_chart_image(funnel_data):
    """Создает столбчатую диаграмму и возвращает ее как байтовый поток."""
    labels = [item['stage'] for item in funnel_data]
    counts = [item['candidates'] for item in funnel_data]
    
    fig, ax = plt.subplots(figsize=(6, 3.5))
    ax.bar(labels, counts, color='steelblue')
    ax.set_ylabel('Количество кандидатов')
    ax.set_title('Воронка подбора кандидатов')
    plt.xticks(rotation=15, ha="right")
    
    for i, count in enumerate(counts):
        ax.text(i, count, str(count), ha='center', va='bottom')
        
    memfile = io.BytesIO()
    plt.savefig(memfile, format='png', dpi=200, bbox_inches='tight')
    plt.close(fig)
    plt.clf()  
    plt.cla()  
    memfile.seek(0)
    return memfile

def generate_report(vacancy_id):
    try:
        funnel_data = get_funnel_data(vacancy_id, FUNNEL_STAGES)
        summary_data = get_summary_data(vacancy_id)
        print(summary_data)
        if not summary_data:
            print(f"Ошибка: Вакансия с ID '{vacancy_id}' не найдена.")
            return None, "Vacancy not found"

        doc = DocxTemplate(TEMPLATE_PATH)

        chart_image_stream = create_bar_chart_image(funnel_data)
        chart_image = InlineImage(doc, image_descriptor=chart_image_stream, width=Inches(5.5))

        context = {
            'vacancy_title': summary_data['vacancy_title'],
            'completed': funnel_data[0],
            'rejected': funnel_data[4],
            'test_task': funnel_data[1],
            'finalist': funnel_data[2],
            'offer': funnel_data[3],
            'kpi': summary_data['kpi'],
            'chart': chart_image  
        }
        print(context)

        doc.render(context)
        file_stream = io.BytesIO()
        doc.save(file_stream)
        file_stream.seek(0)

        plt.close('all')
        
        return file_stream, summary_data['vacancy_title']

    except FileNotFoundError:
        print(f"Ошибка: Файл шаблона '{TEMPLATE_PATH}' не найден.")
        plt.close('all')  
        return None, f"Template file not found: {TEMPLATE_PATH}"
    except Exception as e:
        print(f"\nПроизошла непредвиденная ошибка: {e}")
        plt.close('all')  
        return None, str(e)
