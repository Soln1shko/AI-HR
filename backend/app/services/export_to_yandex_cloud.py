import logging
import os
from datetime import datetime

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv


load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

YC_SA_KEY_ID = os.getenv('YC_SA_KEY_ID')
YC_SA_SECRET_KEY = os.getenv('YC_SA_SECRET_KEY')
YC_STORAGE_BUCKET = os.getenv('YC_STORAGE_BUCKET')
YC_ENDPOINT_URL = os.getenv('YC_ENDPOINT_URL', 'https://storage.yandexcloud.net')


def create_s3_session():
    """
    Создает и настраивает сессию для работы с Yandex Object Storage.
    """
    try:
        session = boto3.session.Session(
            aws_access_key_id=YC_SA_KEY_ID,
            aws_secret_access_key=YC_SA_SECRET_KEY,
            region_name="ru-central1"
        )
        s3_client = session.client(
            service_name='s3',
            endpoint_url=YC_ENDPOINT_URL
        )
        return s3_client
    except Exception as e:
        logging.error(f"Не удалось создать сессию S3: {e}")
        return None


def upload_document_to_s3(s3_client, file_path, bucket_name):
    """
    Загружает файл (PDF, DOC, DOCX) в Yandex Object Storage (S3).
    """

    if not YC_SA_KEY_ID or not YC_SA_SECRET_KEY or not bucket_name:
        logging.error("Учетные данные (ID, ключ, имя бакета) не найдены в .env файле.")
        return False

    if not os.path.exists(file_path):
        logging.error(f"Файл для загрузки не найден: {file_path}")
        return False

    allowed_extensions = ['.pdf', '.doc', '.docx','txt']
    file_name = os.path.basename(file_path)
    file_ext = os.path.splitext(file_name)[1].lower()

    if file_ext not in allowed_extensions:
        logging.warning(f"Неподдерживаемый тип файла: {file_ext}. Допускаются только: {allowed_extensions}")
        return False

    object_name = f"documents/{file_name}"

    try:
        logging.info(f"Начало загрузки {file_path} в бакет {bucket_name} как {object_name}...")
        s3_client.upload_file(file_path, bucket_name, object_name)
        logging.info("Файл успешно загружен.")
        return True
    except ClientError as e:
        logging.error(f"Ошибка при загрузке файла в S3: {e}")
        return False


def upload_file_object_to_s3(s3_client, file_object, filename, bucket_name):
    """
    Загружает файловый объект (из Flask request.files) в Yandex Object Storage.
    """

    if not YC_SA_KEY_ID or not YC_SA_SECRET_KEY or not bucket_name:
        logging.error("Учетные данные (ID, ключ, имя бакета) не найдены в .env файле.")
        return False, None

    allowed_extensions = ['.pdf', '.doc', '.docx', '.txt']
    file_ext = os.path.splitext(filename)[1].lower()

    if file_ext not in allowed_extensions:
        logging.warning(f"Неподдерживаемый тип файла: {file_ext}. Допускаются только: {allowed_extensions}")
        return False, None

    object_name = f"resumes/{filename}"

    try:
        logging.info(f"Начало загрузки {filename} в бакет {bucket_name} как {object_name}...")

        file_object.seek(0)

        s3_client.upload_fileobj(file_object, bucket_name, object_name)

        file_url = f"{YC_ENDPOINT_URL}/{bucket_name}/{object_name}"
        
        logging.info(f"Файл успешно загружен. URL: {file_url}")
        return True, file_url
    except ClientError as e:
        logging.error(f"Ошибка при загрузке файла в S3: {e}")
        return False, None


def upload_company_avatar_to_s3(s3_client, file_object, company_id, file_extension, bucket_name):
    """
    Загружает аватарку компании в Yandex Object Storage.
    
    :param s3_client: Клиент boto3 для работы с S3
    :param file_object: Файловый объект из Flask request.files
    :param company_id: ID компании
    :param file_extension: Расширение файла (jpg, png, etc.)
    :param bucket_name: Имя бакета
    :return: (success: bool, file_url: str or None)
    """

    if not YC_SA_KEY_ID or not YC_SA_SECRET_KEY or not bucket_name:
        logging.error("Учетные данные (ID, ключ, имя бакета) не найдены в .env файле.")
        return False, None

    allowed_extensions = ['jpg', 'jpeg', 'png', 'webp']
    if file_extension.lower() not in allowed_extensions:
        logging.warning(f"Неподдерживаемый тип файла для аватарки: {file_extension}. Допускаются только: {allowed_extensions}")
        return False, None

    object_name = f"company_avatars/{company_id}.{file_extension.lower()}"

    try:
        logging.info(f"Начало загрузки аватарки компании {company_id} в бакет {bucket_name} как {object_name}...")
        

        file_object.seek(0)

        s3_client.upload_fileobj(file_object, bucket_name, object_name)

        file_url = f"{YC_ENDPOINT_URL}/{bucket_name}/{object_name}"
        
        logging.info(f"Аватарка компании успешно загружена. URL: {file_url}")
        return True, file_url
    except ClientError as e:
        logging.error(f"Ошибка при загрузке аватарки компании в S3: {e}")
        return False, None


def get_company_avatar_url(company_id, file_extension, bucket_name):
    """
    Формирует URL аватарки компании из S3.
    
    :param company_id: ID компании
    :param file_extension: Расширение файла
    :param bucket_name: Имя бакета
    :return: URL аватарки или None
    """
    if not YC_SA_KEY_ID or not YC_SA_SECRET_KEY or not bucket_name:
        logging.error("Учетные данные не найдены в .env файле.")
        return None
    
    object_name = f"company_avatars/{company_id}.{file_extension.lower()}"
    return f"{YC_ENDPOINT_URL}/{bucket_name}/{object_name}"


def check_company_avatar_exists(s3_client, company_id, file_extension, bucket_name):
    """
    Проверяет существование аватарки компании в S3.
    
    :param s3_client: Клиент boto3 для работы с S3
    :param company_id: ID компании
    :param file_extension: Расширение файла
    :param bucket_name: Имя бакета
    :return: True если файл существует, False если нет
    """
    if not YC_SA_KEY_ID or not YC_SA_SECRET_KEY or not bucket_name:
        logging.error("Учетные данные не найдены в .env файле.")
        return False
    
    object_name = f"company_avatars/{company_id}.{file_extension.lower()}"
    logging.info(f"Проверяем существование файла: {object_name}")
    
    try:
        s3_client.head_object(Bucket=bucket_name, Key=object_name)
        logging.info(f"Файл найден: {object_name}")
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == '404':
            logging.info(f"Файл не найден: {object_name}")
            return False
        else:
            logging.error(f"Ошибка при проверке существования аватарки: {e}")
            return False


def main():
    """
    Основная функция для демонстрации загрузки файлов.
    """
    s3_client = create_s3_session()
    if not s3_client:
        logging.error("Выход из программы: не удалось создать S3 клиент.")
        return

    script_dir = os.path.dirname(os.path.abspath(__file__))
    files_to_upload = [
        os.path.join(script_dir, "Резюме.docx"),
    ]

    for file_path in files_to_upload:

        upload_document_to_s3(s3_client, file_path, YC_STORAGE_BUCKET)



if __name__ == "__main__":
    main()
