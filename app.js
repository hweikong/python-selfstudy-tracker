/* =============================================
   Python 学习追踪器 - Application Engine
   ============================================= */

// ===== State Management =====
const STORAGE_KEY = 'python-tracker-progress';
const START_DATE = '2026-05-25'; // User's start date

// Detect file:// protocol — localStorage is blocked in that context
const isFileProtocol = location.protocol === 'file:';

function getProgress() {
    if (isFileProtocol) {
        // file:// protocol — localStorage not available, use sessionStorage as fallback
        try {
            const saved = sessionStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
}

function saveProgress(progress) {
    if (isFileProtocol) {
        // file:// protocol — store in sessionStorage (survives navigation)
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
        } catch (e) {
            console.warn('sessionStorage failed:', e);
        }
    } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    }
}

function getWeekProgress(phase) {
    const progress = getProgress();
    let totalDays = 0;
    let completedDays = 0;
    Object.values(phase.weeks).forEach(week => {
        week.days.forEach((_, idx) => {
            totalDays++;
            const key = `${phase.id}-${Object.keys(phase.weeks).find(k => phase.weeks[k] === week)}-${idx}`;
            if (progress[key]) completedDays++;
        });
    });
    return { completed: completedDays, total: totalDays, percent: totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0 };
}

function getOverallProgress() {
    const progress = getProgress();
    let totalDays = 0;
    let completedDays = 0;

    COURSE_DATA.phases.forEach(phase => {
        Object.values(phase.weeks).forEach(week => {
            week.days.forEach((day, idx) => {
                totalDays++;
                const key = `${phase.id}-${week.id}-${idx}`;
                if (progress[key]) completedDays++;
            });
        });
    });

    return { completed: completedDays, total: totalDays, percent: totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0 };
}

function getTodayWeekId() {
    const today = new Date();
    const start = new Date(START_DATE);
    const diffTime = today.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return null; // Before start date

    // 5 days learning / 2 days rest pattern
    const weekNum = Math.floor(diffDays / 5);
    const dayInWeek = diffDays % 5;

    if (dayInWeek >= 5) return null; // Rest day

    const globalDay = Math.floor(diffDays / 5) * 5 + dayInWeek;
    let dayCount = 0;

    for (const phase of COURSE_DATA.phases) {
        for (const [weekId, week] of Object.entries(phase.weeks)) {
            for (const day of week.days) {
                if (dayCount === globalDay) {
                    return `${phase.id}-${weekId}`;
                }
                dayCount++;
            }
        }
    }
    return null;
}

function getTodayBrief() {
    const todayId = getTodayWeekId();
    if (!todayId) return null;
    const [phaseId, weekId] = todayId.split('-');
    const phase = COURSE_DATA.phases.find(p => p.id === phaseId);
    if (!phase) return null;
    const week = phase.weeks[weekId];
    if (!week) return null;

    // Find the day index
    let dayCount = 0;
    for (const p of COURSE_DATA.phases) {
        for (const [wid] of Object.entries(p.weeks)) {
            if (p.id === phaseId && wid === weekId) {
                const days = week.days;
                for (let i = 0; i < days.length; i++) {
                    if (dayCount === getProgress()._todayTarget) {
                        return { phase, week, day: days[i], weekId, phaseId, dayIndex: i };
                    }
                    dayCount++;
                }
            }
        }
    }
    return null;
}

// ===== Navigation =====
function getCurrentPage() {
    const path = window.location.pathname.split('/').pop() || '';
    const hash = window.location.hash.replace('#', '');
    
    // If hash is set, use it
    if (hash) return hash;
    
    // If path matches a phase file, use that
    if (path.startsWith('phase')) {
        // Extract phase number from filename
        const num = parseInt(path.replace('phase', '').replace('.html', ''));
        if (!isNaN(num)) return `phase${num}`;
    }
    
    // If path is study.html
    if (path === 'study.html' || path === 'study') return 'study';
    
    return 'dashboard';
}

function renderCurrentPage() {
    const page = getCurrentPage();
    const main = document.getElementById('main-content');

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        const dataPage = item.getAttribute('data-page');
        if (dataPage === page) item.classList.add('active');
    });

    switch (page) {
        case 'dashboard':
            renderDashboard(main);
            break;
        case 'study':
            renderStudyPlan(main);
            break;
        default:
            if (page.startsWith('phase')) {
                renderPhasePage(main, page);
            } else {
                renderDashboard(main);
            }
    }
}

// ===== Dashboard Page =====
function renderDashboard(container) {
    const overall = getOverallProgress();
    const todayBrief = getTodayBrief();
    const todayId = getTodayWeekId();

    const daysSinceStart = Math.max(0, Math.floor((new Date().getTime() - new Date(START_DATE).getTime()) / (1000 * 60 * 60 * 24)));
    const weeksCompleted = Math.floor(overall.percent / (100 / 26));

    let html = `
    <div class="page-header animate-fade">
        <h1>🐍 Python 学习追踪器</h1>
        <p class="subtitle">你的26周Python学习之路 — 从零到数据分析、爬虫、机器学习</p>
    </div>

    <div class="today-banner animate-fade delay-1 ${todayBrief ? '' : 'no-study-banner'}">
        <h2>📅 今天的任务</h2>
        <div class="today-content">
    `;

    if (todayBrief) {
        const day = todayBrief.day;
        html += `
            <strong>第${daysSinceStart + 1}天 · ${getPhaseName(todayBrief.phaseId)}</strong><br>
            <span>${todayBrief.week.title} — ${day.title}</span>
            <p style="margin-top:8px;opacity:0.9">${day.brief}</p>
            ${day.link ? `<a href="${day.link}" target="_blank" class="today-action">${day.linkText} →</a>` : ''}
        `;
    } else {
        html += `
            <p style="font-size:1.1rem">今天是休息日 🎉 好好放松，为明天充电！</p>
            <p style="margin-top:8px;opacity:0.85">学习节奏：每周学习5天，休息2天。保持节奏最重要。</p>
        `;
    }

    html += `
        </div>
    </div>

    <div class="stats-grid animate-fade delay-2">
        <div class="stat-card primary">
            <div class="stat-icon">📚</div>
            <div class="stat-value">${overall.percent}%</div>
            <div class="stat-label">整体进度</div>
        </div>
        <div class="stat-card success">
            <div class="stat-icon">✅</div>
            <div class="stat-value">${overall.completed}</div>
            <div class="stat-label">已完成天数</div>
        </div>
        <div class="stat-card accent">
            <div class="stat-icon">📅</div>
            <div class="stat-value">${daysSinceStart}</div>
            <div class="stat-label">已过去天数</div>
        </div>
        <div class="stat-card secondary">
            <div class="stat-icon">🔥</div>
            <div class="stat-value">${weeksCompleted + 1}</div>
            <div class="stat-label">当前周次</div>
        </div>
    </div>

    <div class="overall-progress animate-fade delay-3">
        <h2>📈 总进度</h2>
        <div class="progress-bar-container">
            <div class="progress-bar">
                <div class="progress-bar-fill" style="width: ${overall.percent}%"></div>
            </div>
            <div class="progress-text">${overall.percent}%</div>
        </div>
    </div>

    <div class="section-header animate-fade delay-3">
        <h2><span class="phase-icon">🗂️</span> 学习阶段</h2>
        <a href="study.html" style="font-size:0.9rem">查看全部 →</a>
    </div>

    <div class="phase-grid animate-fade delay-4">
    `;

    COURSE_DATA.phases.forEach((phase, idx) => {
        const wp = getWeekProgress(phase);
        html += `
            <div class="phase-card p${idx + 1}" onclick="location.href='phase${idx + 1}.html'" style="animation-delay:${0.1 + idx * 0.1}s">
                <div class="phase-header">
                    <div class="phase-title">${phase.icon} ${phase.name}</div>
                    <div class="phase-badge">${phase.title}</div>
                </div>
                <div class="phase-desc">${phase.description}</div>
                <div class="phase-meta">
                    <span>📅 ${Object.keys(phase.weeks).length} 周</span>
                    <span>🎬 ${Object.values(phase.weeks).reduce((sum, w) => sum + w.days.length, 0)} 课时</span>
                </div>
                <div class="phase-progress-mini">
                    <div class="fill" style="width: ${wp.percent}%"></div>
                </div>
            </div>
        `;
    });

    html += `
    </div>

    <div class="reset-section animate-fade">
        <button class="reset-btn" onclick="resetProgress()">重置所有进度</button>
    </div>
    `;

    container.innerHTML = html;
}

// ===== Study Plan Page =====
function renderStudyPlan(container) {
    let html = `
    <div class="page-header animate-fade">
        <h1>📋 学习计划</h1>
        <p class="subtitle">26周完整学习路线 · ${COURSE_DATA.phases.length}个阶段 · 共${COURSE_DATA.phases.reduce((sum, p) => sum + Object.keys(p.weeks).length, 0)}周</p>
    </div>
    `;

    COURSE_DATA.phases.forEach((phase, idx) => {
        const wp = getWeekProgress(phase);
        html += `
        <div class="animate-fade delay-${(idx % 6) + 1}">
            <div class="section-header" style="margin-top:${idx === 0 ? '0' : '40px'}">
                <h2><span class="phase-icon">${phase.icon}</span> ${phase.name} (${phase.title})</h2>
                <span style="font-size:0.85rem;color:var(--text-muted)">${wp.percent}% 完成</span>
            </div>
            <p style="color:var(--text-secondary);margin-bottom:20px;font-size:0.9rem">${phase.description}</p>
            <div style="margin-bottom:24px">
                <a href="${phase.resource.link}" target="_blank" class="resource-tag">
                    <span class="tag-icon">📺</span>
                    ${phase.resource.name}
                </a>
            </div>
        `;

        Object.values(phase.weeks).forEach(week => {
            const weekId = Object.keys(phase.weeks).find(k => phase.weeks[k] === week);
            html += renderWeekCard(phase, week, weekId, idx + 1);
        });

        html += `</div>`;
    });

    html += `<div class="reset-section animate-fade">
        <button class="reset-btn" onclick="resetProgress()">重置所有进度</button>
    </div>`;

    container.innerHTML = html;

    // Attach click handlers
    container.querySelectorAll('.week-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('expanded');
        });
    });
}

// Precompute cumulative week numbers for accurate global W numbering
const _WEEK_OFFSETS = {};
(function() {
    let cumulative = 0;
    COURSE_DATA.phases.forEach(phase => {
        const weekKeys = Object.keys(phase.weeks);
        weekKeys.forEach((wk, i) => {
            _WEEK_OFFSETS[phase.id + '-' + wk] = cumulative + i + 1;
        });
        cumulative += weekKeys.length;
    });
})();

function renderWeekCard(phase, week, weekId, phaseIdx) {
    const progress = getProgress();
    const totalDays = week.days.length;
    const completedDays = week.days.filter((_, idx) => progress[`${phase.id}-${weekId}-${idx}`]).length;
    const percent = Math.round((completedDays / totalDays) * 100);
    const globalWeekNum = _WEEK_OFFSETS[phase.id + '-' + weekId];

    let html = `
    <div class="week-card p${phaseIdx}">
        <div class="week-header">
            <div class="week-header-left">
                <div class="week-number">W${globalWeekNum}</div>
                <div>
                    <div class="week-title">${week.title}</div>
                    <div class="week-subtitle">${week.subtitle}</div>
                </div>
            </div>
            <div class="week-header-right">
                <div class="week-progress">${completedDays}/${totalDays}</div>
                <svg class="week-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
        </div>
        <div class="week-content">
            <ul class="day-list">
    `;

    week.days.forEach((day, dayIdx) => {
        const dayKey = `${phase.id}-${weekId}-${dayIdx}`;
        const isChecked = progress[dayKey];
        const typeClass = day.type === 'video' ? 'video' : day.type === 'practice' ? 'practice' : 'review';
        const typeLabel = day.type === 'video' ? '视频' : day.type === 'practice' ? '练习' : '复习';

        html += `
            <li class="day-item ${isChecked ? 'completed' : ''}">
                <div class="day-check ${isChecked ? 'checked' : ''}" onclick="toggleDayItem('${dayKey}', this)">
                    ${isChecked ? '✓' : ''}
                </div>
                <div class="day-info">
                    <h4>${day.title} <span class="day-type ${typeClass}">${typeLabel}</span></h4>
                    <p class="day-brief">${day.brief}</p>
                    ${day.link ? `<a href="${day.link}" target="_blank" class="day-link"><span class="link-icon">🔗</span> ${day.linkText}</a>` : ''}
                </div>
            </li>
        `;
    });

    html += `</ul></div></div>`;
    return html;
}

function toggleDayItem(dayKey, el) {
    const progress = getProgress();
    progress[dayKey] = !progress[dayKey];
    saveProgress(progress);

    el.classList.toggle('checked');
    el.innerHTML = progress[dayKey] ? '✓' : '';
    el.closest('.day-item').classList.toggle('completed');

    // Update progress counts
    const weekCard = el.closest('.week-card');
    const allDays = weekCard.querySelectorAll('.day-item');
    const checkedDays = weekCard.querySelectorAll('.day-check.checked');
    const progressEl = weekCard.querySelector('.week-progress');
    progressEl.textContent = `${checkedDays.length}/${allDays.length}`;
}

// ===== Phase Page =====
function renderPhasePage(container, pageName) {
    const phaseNum = parseInt(pageName.replace('phase', '')) - 1;
    if (phaseNum < 0 || phaseNum >= COURSE_DATA.phases.length) return renderDashboard(container);

    const phase = COURSE_DATA.phases[phaseNum];
    const wp = getWeekProgress(phase);

    let html = `
    <div class="page-header animate-fade">
        <h1>${phase.icon} ${phase.name}</h1>
        <p class="subtitle">${phase.title} · ${Object.keys(phase.weeks).length}周 · ${Object.values(phase.weeks).reduce((sum, w) => sum + w.days.length, 0)}课时 · ${wp.percent}% 完成</p>
    </div>

    <div class="phase-detail-page">
        <div class="overall-progress animate-fade delay-1" style="margin-bottom:32px">
            <h2>📈 阶段进度</h2>
            <div class="progress-bar-container">
                <div class="progress-bar">
                    <div class="progress-bar-fill" style="width: ${wp.percent}%"></div>
                </div>
                <div class="progress-text">${wp.percent}%</div>
            </div>
        </div>

        <div style="margin-bottom:32px" class="animate-fade delay-1">
            <p style="color:var(--text-secondary);margin-bottom:16px;font-size:0.95rem;line-height:1.6">${phase.description}</p>
            <div class="resources">
                <a href="${phase.resource.link}" target="_blank" class="resource-tag">
                    <span class="tag-icon">📺</span>
                    ${phase.resource.name} (${phase.resource.type})
                </a>
            </div>
        </div>
    `;

    Object.entries(phase.weeks).forEach(([weekId, week], idx) => {
        html += renderWeekCard(phase, week, weekId, phaseNum + 1);
        if (idx < Object.keys(phase.weeks).length - 1) {
            html += `<div style="height:20px"></div>`;
        }
    });

    html += `
    </div>

    <div class="reset-section animate-fade delay-5">
        <button class="reset-btn" onclick="resetProgress()">重置所有进度</button>
    </div>
    </div>
    `;

    container.innerHTML = html;

    container.querySelectorAll('.week-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('expanded');
        });
    });
}

// ===== Utility Functions =====
function getPhaseName(phaseId) {
    const phase = COURSE_DATA.phases.find(p => p.id === phaseId);
    return phase ? phase.name : '';
}

function resetProgress() {
    if (confirm('⚠️ 确定要重置所有学习进度吗？此操作不可撤销。')) {
        if (isFileProtocol) {
            try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
        renderCurrentPage();
    }
}

// ===== Mobile Menu =====
document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.classList.toggle('active');
});

// Close sidebar on nav click (mobile)
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
            const overlay = document.getElementById('sidebarOverlay');
            if (overlay) overlay.classList.remove('active');
        }
    });
});

// ===== Init =====
window.addEventListener('hashchange', renderCurrentPage);
window.addEventListener('load', renderCurrentPage);

// ===== Generate Phase HTML Files =====
function generatePhaseFiles() {
    COURSE_DATA.phases.forEach((phase, idx) => {
        const pageNum = idx + 1;
        const phaseNum = idx + 1;
        let html = document.documentElement.outerHTML.replace('id="main-content"', `id="main-content"`);

        // Replace body content with phase template
        const bodyContent = `
    <main class="main-content" id="main-content">
        <!-- Phase content loaded by JS -->
    </main>
    <button class="menu-toggle" id="menuToggle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
    <script src="data.js"></script>
    <script src="app.js"></script>
        `;

        // Write the phase HTML file
        const fs = require('fs');
        const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${phase.name} - Python 学习追踪器</title>
    <link rel="stylesheet" href="styles.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
</head>
<body>
    <nav class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <div class="logo">🐍</div>
            <span class="logo-text">Python 学习</span>
        </div>
        <div class="nav-section">
            <span class="nav-label">概览</span>
            <a href="index.html" class="nav-item" data-page="dashboard">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                <span>Dashboard</span>
            </a>
            <a href="study.html" class="nav-item" data-page="study">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                <span>学习计划</span>
            </a>
        </div>
        <div class="nav-section">
            <span class="nav-label">第一阶段 · 基础语法 (W1-8)</span>
            <a href="phase1.html" class="nav-item" data-page="phase1"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W1 环境搭建</span></a>
            <a href="phase1.html#w2" class="nav-item" data-page="phase1"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W2 变量与字符串</span></a>
            <a href="phase1.html#w3" class="nav-item" data-page="phase1"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W3 条件判断</span></a>
            <a href="phase1.html#w4" class="nav-item" data-page="phase1"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W4 循环</span></a>
            <a href="phase1.html#w5" class="nav-item" data-page="phase1"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W5 数据结构</span></a>
            <a href="phase1.html#w6" class="nav-item" data-page="phase1"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W6 函数</span></a>
            <a href="phase1.html#w7" class="nav-item" data-page="phase1"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W7 异常与面向对象</span></a>
            <a href="phase1.html#w8" class="nav-item" data-page="phase1"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W8 复习与测试</span></a>
        </div>
        <div class="nav-section">
            <span class="nav-label">第二阶段 · 数据分析 (W9-12)</span>
            <a href="phase2.html" class="nav-item" data-page="phase2"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W9 NumPy</span></a>
            <a href="phase2.html#w10" class="nav-item" data-page="phase2"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W10 Pandas</span></a>
            <a href="phase2.html#w11" class="nav-item" data-page="phase2"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W11 Matplotlib</span></a>
            <a href="phase2.html#w12" class="nav-item" data-page="phase2"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W12 小项目</span></a>
        </div>
        <div class="nav-section">
            <span class="nav-label">第三阶段 · 爬虫 (W13-16)</span>
            <a href="phase3.html" class="nav-item" data-page="phase3"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W13 基础+入门</span></a>
            <a href="phase3.html#w14" class="nav-item" data-page="phase3"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W14 爬虫实战1</span></a>
            <a href="phase3.html#w15" class="nav-item" data-page="phase3"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W15 爬虫实战2</span></a>
            <a href="phase3.html#w16" class="nav-item" data-page="phase3"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W16 小项目</span></a>
        </div>
        <div class="nav-section">
            <span class="nav-label">第四阶段 · 机器学习 (W17-W20)</span>
            <a href="phase4.html" class="nav-item" data-page="phase4"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W17 基础概念</span></a>
            <a href="phase4.html#w18" class="nav-item" data-page="phase4"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W18 回归算法</span></a>
            <a href="phase4.html#w19" class="nav-item" data-page="phase4"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W19 分类算法</span></a>
            <a href="phase4.html#w20" class="nav-item" data-page="phase4"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W20 小项目</span></a>
        </div>
        <div class="nav-section">
            <span class="nav-label">第五阶段 · 办公自动化 (W21-22)</span>
            <a href="phase5.html" class="nav-item" data-page="phase5"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W21 Excel自动化</span></a>
            <a href="phase5.html#w22" class="nav-item" data-page="phase5"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W22 Word/PDF/邮件</span></a>
        </div>
        <div class="nav-section">
            <span class="nav-label">第六阶段 · 项目实战 (W23-26)</span>
            <a href="phase6.html" class="nav-item" data-page="phase6"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>W23-W26 项目实战</span></a>
        </div>
    </nav>
    <main class="main-content" id="main-content">
        <!-- Phase content loaded by JS -->
    </main>
    <button class="menu-toggle" id="menuToggle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
    <script src="data.js"></script>
    <script src="app.js"></script>
</body>
</html>`;

        require('fs').writeFileSync(`phase${pageNum}.html`, fullHtml);
    });

    console.log('Phase files generated successfully');
}

// Auto-generate phase files on load
if (typeof require !== 'undefined' && typeof window === 'undefined') {
    generatePhaseFiles();
}
