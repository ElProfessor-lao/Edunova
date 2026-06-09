# tutor_v3.py - Complete working version with multiple JSON file support

import json
import uuid
import os
import glob
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from pathlib import Path

@dataclass
class UserProgress:
    user_id: str
    level: int = 1
    xp: int = 0
    completed_lessons: List[str] = None
    completed_questions: Dict[str, List[int]] = None
    last_activity: str = None
    
    def __post_init__(self):
        if self.completed_lessons is None:
            self.completed_lessons = []
        if self.completed_questions is None:
            self.completed_questions = {}
        if self.last_activity is None:
            self.last_activity = datetime.now().strftime("%Y-%m-%d")

@dataclass
class LearningResult:
    success: bool
    message: str
    xp_earned: int = 0
    correct_answer: bool = False
    feedback: str = ""
    question_completed: bool = False
    lesson_completed: bool = False
    questions_remaining: int = 0
    total_questions: int = 0

class EduNovaV3:
    def __init__(self, curriculum_folder: str, user_data_path: str = "user_progress_v3.json"):
        self.categories = []
        
        # Load all JSON files from the curriculum folder
        json_files = glob.glob(os.path.join(curriculum_folder, 'curriculum_*.json'))
        
        if not json_files:
            raise Exception(f"No curriculum files found in {curriculum_folder}")
        
        for file_path in sorted(json_files):
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.categories.extend(data.get('categories', []))
                print(f"Loaded: {os.path.basename(file_path)} - {len(data.get('categories', []))} categories")
        
        self.user_data_path = user_data_path
        self.user_progress = self._load_progress()
        
        self.XP_PER_QUESTION = 20
        self.XP_LESSON_COMPLETE = 50
    
    def _load_progress(self) -> UserProgress:
        if Path(self.user_data_path).exists():
            try:
                with open(self.user_data_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return UserProgress(**data)
            except:
                pass
        return UserProgress(user_id=str(uuid.uuid4()))
    
    def _save_progress(self):
        with open(self.user_data_path, 'w', encoding='utf-8') as f:
            json.dump(asdict(self.user_progress), f, indent=2)
    
    def get_categories(self) -> List[Dict]:
        return self.categories
    
    def get_lessons(self, category_name: str) -> List[Dict]:
        for cat in self.categories:
            if cat['name'] == category_name:
                return cat.get('lessons', [])
        return []
    
    def get_lesson(self, lesson_id: str) -> Optional[Dict]:
        for cat in self.categories:
            for lesson in cat.get('lessons', []):
                if lesson['id'] == lesson_id:
                    return lesson
        return None
    
    def is_lesson_completed(self, lesson_id: str) -> bool:
        return lesson_id in self.user_progress.completed_lessons
    
    def get_completed_questions(self, lesson_id: str) -> List[int]:
        if lesson_id in self.user_progress.completed_questions:
            return self.user_progress.completed_questions[lesson_id]
        return []
    
    def check_practice_answer(self, lesson_id: str, question_index: int, answer_index: int) -> LearningResult:
        lesson = self.get_lesson(lesson_id)
        if not lesson or 'practice_questions' not in lesson:
            return LearningResult(False, "No practice available", 0)
        
        questions = lesson['practice_questions']
        if question_index >= len(questions):
            return LearningResult(False, "Invalid question", 0)
        
        question = questions[question_index]
        is_correct = (answer_index == question.get('correct', -1))
        
        completed_questions = self.get_completed_questions(lesson_id)
        
        if question_index in completed_questions:
            return LearningResult(False, "You already answered this correctly!", 0)
        
        if is_correct:
            xp_earned = self.XP_PER_QUESTION
            self.user_progress.xp += xp_earned
            
            if lesson_id not in self.user_progress.completed_questions:
                self.user_progress.completed_questions[lesson_id] = []
            self.user_progress.completed_questions[lesson_id].append(question_index)
            
            remaining = len(questions) - len(self.user_progress.completed_questions[lesson_id])
            
            lesson_completed = False
            if remaining == 0 and lesson_id not in self.user_progress.completed_lessons:
                self.user_progress.completed_lessons.append(lesson_id)
                self.user_progress.xp += self.XP_LESSON_COMPLETE
                xp_earned += self.XP_LESSON_COMPLETE
                lesson_completed = True
            
            self._save_progress()
            
            message = f"✅ Correct! +{self.XP_PER_QUESTION} XP"
            if lesson_completed:
                message += f"\n\n🏆 LESSON COMPLETE! +{self.XP_LESSON_COMPLETE} XP bonus!"
            
            return LearningResult(True, message, xp_earned, True, question.get('feedback_en', ''), True, lesson_completed, remaining, len(questions))
        else:
            return LearningResult(False, f"❌ {question.get('feedback_en', 'Try again!')}", 0, False, question.get('feedback_en', ''), False, False, len(questions) - len(completed_questions), len(questions))
    
    def get_user_stats(self) -> Dict:
        total_lessons = 0
        total_questions = 0
        
        for cat in self.categories:
            for lesson in cat.get('lessons', []):
                total_lessons += 1
                total_questions += len(lesson.get('practice_questions', []))
        
        completed_questions_count = 0
        for lesson_id, completed in self.user_progress.completed_questions.items():
            completed_questions_count += len(completed)
        
        return {
            'level': self.user_progress.level,
            'xp': self.user_progress.xp,
            'xp_to_next': 1000,
            'lessons_completed': len(self.user_progress.completed_lessons),
            'total_lessons': total_lessons,
            'questions_completed': completed_questions_count,
            'total_questions': total_questions,
            'progress_percent': (completed_questions_count / total_questions * 100) if total_questions > 0 else 0
        }