# app_v3.py - Complete Flask app

from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
import json
import uuid
import os
from pathlib import Path

app = Flask(__name__)
app.secret_key = 'edunova_v3_secret_key_2024'
CORS(app)

# Paths
script_dir = Path(__file__).parent
CURRICULUM_FOLDER = script_dir / 'curriculum'
USER_DATA_PATH = script_dir / 'user_progress_v3.json'

# Create curriculum folder if it doesn't exist
CURRICULUM_FOLDER.mkdir(exist_ok=True)

from tutor_v3 import EduNovaV3

sessions = {}

def get_user_session(user_id):
    if user_id not in sessions:
        sessions[user_id] = EduNovaV3(str(CURRICULUM_FOLDER), str(USER_DATA_PATH))
    return sessions[user_id]

@app.route('/')
def index():
    return render_template('learn.html')

@app.route('/api/init')
def init():
    try:
        user_id = session.get('user_id')
        if not user_id:
            user_id = str(uuid.uuid4())
            session['user_id'] = user_id
        
        core = get_user_session(user_id)
        categories = core.get_categories()
        stats = core.get_user_stats()
        
        return jsonify({
            'categories': categories,
            'stats': stats
        })
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e), 'categories': [], 'stats': {'xp': 0, 'lessons_completed': 0, 'total_lessons': 0, 'progress_percent': 0}})

@app.route('/api/category/<category_name>')
def get_category(category_name):
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'No session'}), 401
        
        core = get_user_session(user_id)
        lessons = core.get_lessons(category_name)
        
        for lesson in lessons:
            lesson['completed'] = core.is_lesson_completed(lesson['id'])
        
        return jsonify({
            'category': category_name,
            'lessons': lessons
        })
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e), 'lessons': []})

@app.route('/api/lesson/<lesson_id>')
def get_lesson(lesson_id):
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'No session'}), 401
        
        core = get_user_session(user_id)
        lesson = core.get_lesson(lesson_id)
        stats = core.get_user_stats()
        
        if not lesson:
            return jsonify({'error': 'Lesson not found'}), 404
        
        return jsonify({
            'lesson': lesson,
            'completed': core.is_lesson_completed(lesson_id),
            'completed_questions': core.get_completed_questions(lesson_id),
            'stats': stats
        })
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/videos/<path:filename>')
def serve_video(filename):
    from flask import send_from_directory
    return send_from_directory('videos', filename)

@app.route('/api/practice', methods=['POST'])
def check_practice():
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'No session'}), 401
        
        data = request.json
        core = get_user_session(user_id)
        
        result = core.check_practice_answer(
            data['lesson_id'], 
            data['question_index'], 
            data['answer_index']
        )
        
        stats = core.get_user_stats()
        
        return jsonify({
            'success': result.success,
            'message': result.message,
            'xp_earned': result.xp_earned,
            'correct_answer': result.correct_answer,
            'question_completed': result.question_completed,
            'lesson_completed': result.lesson_completed,
            'questions_remaining': result.questions_remaining,
            'total_questions': result.total_questions,
            'stats': stats
        })
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)