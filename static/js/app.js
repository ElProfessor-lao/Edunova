// static/js/app.js
// EduNova Frontend Application

// App State
let currentUser = null;
let currentSkill = null;
let currentScenario = null;
let waitingForResponse = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('App initializing...');
    initializeApp();
    setupEventListeners();
});

async function initializeApp() {
    try {
        console.log('Fetching user data...');
        const response = await fetch('/api/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: localStorage.getItem('userId') || null })
        });
        
        const data = await response.json();
        console.log('User data received:', data);
        
        if (data.status === 'success') {
            currentUser = data;
            
            if (data.user_id) {
                localStorage.setItem('userId', data.user_id);
            }
            
            updateNavStats(data.stats);
            displaySkills(data.skills);
            
            // Show welcome message
            console.log(`Welcome ${data.title}!`);
        } else {
            console.error('Failed to initialize:', data);
            showErrorMessage('Failed to load EduNova. Please refresh the page.');
        }
    } catch (error) {
        console.error('Initialization error:', error);
        showErrorMessage('Cannot connect to server. Make sure the backend is running on port 5000');
    }
}

function setupEventListeners() {
    const sendBtn = document.getElementById('sendBtn');
    const userInput = document.getElementById('userInput');
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
        console.log('Send button listener attached');
    }
    
    if (userInput) {
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    // Dashboard button
    const dashboardBtn = document.querySelector('.dashboard-btn');
    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', showDashboard);
        console.log('Dashboard button listener attached');
    }
}

function displaySkills(skills) {
    const skillsGrid = document.getElementById('skillsGrid');
    if (!skillsGrid) {
        console.error('Skills grid element not found!');
        return;
    }
    
    console.log('Displaying skills:', skills);
    
    if (!skills || skills.length === 0) {
        skillsGrid.innerHTML = '<div class="error-message">No skills available. Please check curriculum.json</div>';
        return;
    }
    
    skillsGrid.innerHTML = skills.map(skill => `
        <div class="skill-card" onclick="selectSkill('${escapeHtml(skill.name)}')">
            <div class="skill-icon">${skill.icon || '📚'}</div>
            <div class="skill-name">${escapeHtml(skill.name)}</div>
            <div class="skill-description">${escapeHtml(skill.description.substring(0, 100))}...</div>
            <div class="skill-meta">
                <span class="scenario-count">📚 ${skill.scenario_count || 0} scenarios</span>
                ${skill.completed ? '<span class="completed-badge">✅ Completed</span>' : '<span class="available-badge">📖 Available</span>'}
            </div>
        </div>
    `).join('');
    
    // Add recommendations section
    const recommendations = document.getElementById('recommendations');
    if (recommendations) {
        const incompleteSkills = skills.filter(s => !s.completed);
        if (incompleteSkills.length > 0) {
            recommendations.innerHTML = `
                <div class="recommendations-card">
                    <h3>💡 Recommended for You</h3>
                    <div class="recommendation-list">
                        ${incompleteSkills.slice(0, 2).map(skill => `
                            <div class="recommendation-item" onclick="selectSkill('${escapeHtml(skill.name)}')">
                                <span class="rec-icon">${skill.icon || '🎯'}</span>
                                <div>
                                    <strong>${escapeHtml(skill.name)}</strong>
                                    <p>${escapeHtml(skill.description.substring(0, 60))}...</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }
}

async function selectSkill(skillName) {
    console.log('Selecting skill:', skillName);
    showLoading();
    
    try {
        const response = await fetch(`/api/skills/${encodeURIComponent(skillName)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        console.log('Skill selection response:', data);
        
        if (data.status === 'success') {
            currentSkill = data.skill;
            showScenarioSelection(data.scenarios);
        } else {
            showErrorMessage('Failed to select skill: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error selecting skill:', error);
        showErrorMessage('Failed to connect to server');
    } finally {
        hideLoading();
    }
}

function showScenarioSelection(scenarios) {
    const skillsGridContainer = document.getElementById('skillsGrid').parentElement;
    
    const scenariosHtml = `
        <div class="hero-section">
            <h2 class="hero-title">🎯 Choose Your Challenge</h2>
            <p class="hero-subtitle">Pick a scenario to practice ${escapeHtml(currentSkill)}</p>
        </div>
        <div class="skills-grid">
            ${scenarios.map(scenario => `
                <div class="skill-card" onclick="startScenario('${scenario.id}')">
                    <div class="skill-icon">${scenario.icon || '🎯'}</div>
                    <div class="skill-name">${escapeHtml(scenario.title)}</div>
                    <div class="skill-description">${escapeHtml(scenario.description)}</div>
                    <div class="skill-meta">
                        <span class="difficulty-badge" data-level="${scenario.difficulty}">
                            ${scenario.difficulty.toUpperCase()}
                        </span>
                        ${scenario.is_milestone ? '<span class="milestone-badge-small">🏆 MILESTONE</span>' : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        <button class="back-btn" onclick="backToSkills()">← Back to Skills</button>
    `;
    
    skillsGridContainer.innerHTML = scenariosHtml;
}

async function startScenario(scenarioId) {
    console.log('Starting scenario:', scenarioId);
    showLoading();
    
    try {
        const response = await fetch(`/api/scenarios/${scenarioId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        console.log('Scenario start response:', data);
        
        if (data.status === 'success') {
            currentScenario = data.scenario;
            updateNavStats(data.stats);
            showScenarioView(data);
        } else {
            showErrorMessage('Failed to start scenario');
        }
    } catch (error) {
        console.error('Error starting scenario:', error);
        showErrorMessage('Failed to connect to server');
    } finally {
        hideLoading();
    }
}

function showScenarioView(data) {
    console.log('Showing scenario view');
    
    // Switch views
    document.getElementById('skillSelectionView').classList.remove('active');
    document.getElementById('scenarioView').classList.add('active');
    document.getElementById('dashboardView').classList.remove('active');
    
    // Update scenario header
    document.getElementById('scenarioIcon').textContent = data.scenario.icon || '🎯';
    document.getElementById('scenarioTitle').textContent = data.scenario.title;
    document.getElementById('scenarioDifficulty').textContent = data.scenario.difficulty.toUpperCase();
    document.getElementById('scenarioDifficulty').setAttribute('data-level', data.scenario.difficulty);
    document.getElementById('scenarioGoal').innerHTML = `🎯 ${escapeHtml(data.scenario.goal)}`;
    document.getElementById('keyLesson').innerHTML = escapeHtml(data.scenario.key_lesson);
    
    // Show/hide milestone badge
    const milestoneBadge = document.getElementById('milestoneBadge');
    if (milestoneBadge) {
        milestoneBadge.style.display = data.scenario.is_milestone ? 'inline-block' : 'none';
    }
    
    // Clear chat and add setup message
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = `
        <div class="message system-message">
            <div class="message-avatar">📖</div>
            <div class="message-content">
                <strong>📋 Scenario Setup</strong><br><br>
                ${escapeHtml(data.scenario.setup)}
            </div>
        </div>
    `;
    
    // Reset input
    document.getElementById('userInput').value = '';
    waitingForResponse = false;
    
    // Focus on input
    document.getElementById('userInput').focus();
}

async function sendMessage() {
    if (waitingForResponse) {
        showNotification('Please wait for response...', 'info');
        return;
    }
    
    const userInput = document.getElementById('userInput');
    const message = userInput.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    addMessageToChat('user', message, '🧑');
    userInput.value = '';
    
    waitingForResponse = true;
    showTypingIndicator();
    
    try {
        const response = await fetch('/api/interact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message })
        });
        
        const data = await response.json();
        console.log('Interaction response:', data);
        
        // Remove typing indicator
        removeTypingIndicator();
        
        if (data.status === 'success') {
            // Add response to chat
            let avatar = '👤';
            let role = 'simulation';
            
            if (data.is_intervention) {
                avatar = '💡';
                role = 'mentor';
            } else if (data.role === 'Mentor') {
                avatar = '🎓';
                role = 'mentor';
            }
            
            addMessageToChat(role, data.content, avatar);
            
            // Update stats
            updateNavStats(data.stats);
            
            // Check for success
            if (data.is_success) {
                showSuccessModal(data.xp_gained, data.badge_earned);
            }
        } else {
            addMessageToChat('system', 'Sorry, something went wrong. Please try again.', '⚠️');
        }
        
        waitingForResponse = false;
    } catch (error) {
        console.error('Error sending message:', error);
        removeTypingIndicator();
        addMessageToChat('system', 'Connection error. Please check if server is running.', '⚠️');
        waitingForResponse = false;
    }
}

function addMessageToChat(role, content, avatar) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">${formatMessage(content)}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatMessage(content) {
    // Convert line breaks to <br> and escape HTML
    return escapeHtml(content).replace(/\n/g, '<br>');
}

function showTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'message system-message';
    typingDiv.innerHTML = `
        <div class="message-avatar">✍️</div>
        <div class="message-content">
            <div class="typing-animation">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
}

function updateNavStats(stats) {
    const navLevel = document.getElementById('navLevel');
    const navXP = document.getElementById('navXP');
    const navStreak = document.getElementById('navStreak');
    
    if (navLevel) navLevel.textContent = stats.title;
    if (navXP) navXP.textContent = `${stats.xp} XP`;
    if (navStreak) navStreak.textContent = `${stats.daily_streak} day streak`;
}

function showSuccessModal(xpGained, badgeEarned) {
    const modal = document.getElementById('successModal');
    const message = document.getElementById('successMessage');
    
    let messageText = `🎉 Congratulations! You earned ${xpGained} XP!`;
    if (badgeEarned) {
        messageText += `<br><br>🏆 <strong>New Badge Unlocked:</strong> ${badgeEarned}!`;
    }
    messageText += `<br><br>You're making amazing progress! 🌟`;
    
    message.innerHTML = messageText;
    modal.classList.add('active');
}

function closeModalAndContinue() {
    const modal = document.getElementById('successModal');
    modal.classList.remove('active');
    backToSkills();
}

function backToSkills() {
    console.log('Returning to skills view');
    
    // Reset views
    document.getElementById('skillSelectionView').classList.add('active');
    document.getElementById('scenarioView').classList.remove('active');
    document.getElementById('dashboardView').classList.remove('active');
    
    // Reset current scenario
    currentScenario = null;
    currentSkill = null;
    
    // Reload skills
    initializeApp();
}

async function showDashboard() {
    console.log('Showing dashboard');
    
    try {
        const response = await fetch('/api/dashboard');
        const data = await response.json();
        console.log('Dashboard data:', data);
        
        if (data.status === 'success') {
            updateDashboard(data);
            
            // Switch views
            document.getElementById('skillSelectionView').classList.remove('active');
            document.getElementById('scenarioView').classList.remove('active');
            document.getElementById('dashboardView').classList.add('active');
        } else {
            showErrorMessage('Failed to load dashboard');
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showErrorMessage('Failed to connect to server');
    }
}

function updateDashboard(data) {
    const stats = data.stats;
    
    document.getElementById('dashboardTitle').textContent = stats.title;
    document.getElementById('dashboardLevel').textContent = stats.level;
    document.getElementById('dashboardXP').textContent = stats.xp;
    document.getElementById('dashboardXPNeeded').textContent = stats.xp_needed;
    
    const progressPercent = (stats.xp / stats.xp_needed) * 100;
    document.getElementById('xpProgress').style.width = `${progressPercent}%`;
    
    document.getElementById('statBadges').textContent = stats.badges_earned;
    document.getElementById('statSkills').textContent = stats.skills_mastered;
    document.getElementById('statStreak').textContent = stats.daily_streak;
    document.getElementById('statHours').textContent = stats.total_hours;
    
    // Display badges
    const badgesGrid = document.getElementById('badgesGrid');
    if (badgesGrid && data.badges_info) {
        badgesGrid.innerHTML = Object.entries(data.badges_info).map(([id, badge]) => {
            const isUnlocked = data.badges && data.badges.includes(id);
            return `
                <div class="badge-card ${isUnlocked ? '' : 'locked'}">
                    <div class="badge-icon">${isUnlocked ? '🏆' : '🔒'}</div>
                    <div class="badge-name">${escapeHtml(badge.name)}</div>
                    <div class="badge-desc" style="font-size: 0.7rem; margin-top: 0.25rem;">${escapeHtml(badge.description)}</div>
                </div>
            `;
        }).join('');
    }
}

function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-toast';
    errorDiv.innerHTML = `
        <div style="background: #fed7d7; color: #742a2a; padding: 1rem; border-radius: 10px; margin: 1rem; text-align: center;">
            ⚠️ ${escapeHtml(message)}
        </div>
    `;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

function showNotification(message, type) {
    console.log(`[${type}]: ${message}`);
    // Optional: Add a toast notification
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'error' ? '#f56565' : '#48bb78'};
        color: white;
        padding: 0.75rem 1.5rem;
        border-radius: 10px;
        z-index: 2000;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showLoading() {
    const sendBtn = document.querySelector('.send-btn');
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<div class="loading"></div> Sending...';
    }
}

function hideLoading() {
    const sendBtn = document.querySelector('.send-btn');
    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<span>Send</span><span class="send-icon">✈️</span>';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add typing animation CSS
const style = document.createElement('style');
style.textContent = `
    .typing-animation {
        display: flex;
        gap: 4px;
        align-items: center;
    }
    .typing-animation span {
        width: 8px;
        height: 8px;
        background: #667eea;
        border-radius: 50%;
        animation: typing 1.4s infinite;
    }
    .typing-animation span:nth-child(2) {
        animation-delay: 0.2s;
    }
    .typing-animation span:nth-child(3) {
        animation-delay: 0.4s;
    }
    @keyframes typing {
        0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.4;
        }
        30% {
            transform: translateY(-10px);
            opacity: 1;
        }
    }
    .error-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2000;
        animation: slideIn 0.3s ease;
    }
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    .available-badge {
        background: #4299e1;
        color: white;
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        font-size: 0.8rem;
    }
    .recommendations-card {
        background: white;
        border-radius: 20px;
        padding: 1.5rem;
        margin-top: 2rem;
    }
    .recommendation-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-top: 1rem;
    }
    .recommendation-item {
        display: flex;
        gap: 1rem;
        padding: 1rem;
        background: #f7fafc;
        border-radius: 12px;
        cursor: pointer;
        transition: transform 0.2s;
    }
    .recommendation-item:hover {
        transform: translateX(5px);
        background: #edf2f7;
    }
    .rec-icon {
        font-size: 2rem;
    }
    .milestone-badge-small {
        background: linear-gradient(135deg, #fbbf24, #f59e0b);
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 12px;
        font-size: 0.7rem;
        font-weight: 600;
    }
`;
document.head.appendChild(style);