// ==================== КОНСТАНТЫ И УТИЛИТЫ ====================
const Constants = {
    STORAGE_KEY: 'blossomNotesArticles_v3',
    ARTICLES_PER_PAGE: 6,
    SAMPLE_AUTHOR: 'Вы',
    VIEW_MODE: {
        LIST: 'list',
        ARTICLE: 'article',
        EDITOR: 'editor'
    }
};

const Utils = {
    formatDate(dateString) {
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        return new Date(dateString).toLocaleDateString('ru-RU', options);
    },

    formatDateTime(dateString) {
        const options = { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(dateString).toLocaleDateString('ru-RU', options);
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    markdownToHTML(text) {
        if (!text) return '';
        
        return text
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
    },

    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// ==================== МОДЕЛЬ ДАННЫХ ====================
class ArticleModel {
    constructor() {
        this.articles = this.loadFromStorage();
        this.subscribers = [];
    }

    loadFromStorage() {
        const data = localStorage.getItem(Constants.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    }

    saveToStorage() {
        localStorage.setItem(Constants.STORAGE_KEY, JSON.stringify(this.articles));
        this.notifySubscribers();
    }

    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    notifySubscribers() {
        this.subscribers.forEach(callback => callback(this.articles));
    }

    getAll() {
        return [...this.articles];
    }

    getById(id) {
        return this.articles.find(article => article.id === id);
    }

    create(articleData) {
        const article = {
            id: Utils.generateId(),
            ...articleData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            views: 0
        };
        
        this.articles.unshift(article);
        this.saveToStorage();
        return article;
    }

    update(id, updates) {
        const index = this.articles.findIndex(a => a.id === id);
        if (index === -1) return null;

        this.articles[index] = {
            ...this.articles[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        this.saveToStorage();
        return this.articles[index];
    }

    delete(id) {
        const index = this.articles.findIndex(a => a.id === id);
        if (index === -1) return false;

        this.articles.splice(index, 1);
        this.saveToStorage();
        return true;
    }

    incrementViews(id) {
        const article = this.getById(id);
        if (article) {
            article.views = (article.views || 0) + 1;
            this.saveToStorage();
        }
    }

    getTags() {
        const tags = new Set();
        this.articles.forEach(article => {
            if (article.tags) {
                article.tags.forEach(tag => tags.add(tag));
            }
        });
        return Array.from(tags);
    }

    getFiltered({ tag = 'all', search = '', page = 1 }) {
        let filtered = this.articles;

        if (tag !== 'all') {
            filtered = filtered.filter(article => 
                article.tags && article.tags.includes(tag)
            );
        }

        if (search) {
            const searchLower = search.toLowerCase();
            filtered = filtered.filter(article => 
                article.title.toLowerCase().includes(searchLower) ||
                (article.excerpt && article.excerpt.toLowerCase().includes(searchLower)) ||
                article.content.toLowerCase().includes(searchLower) ||
                (article.tags && article.tags.some(tag => tag.toLowerCase().includes(searchLower)))
            );
        }

        const total = filtered.length;
        const totalPages = Math.ceil(total / Constants.ARTICLES_PER_PAGE);
        const start = (page - 1) * Constants.ARTICLES_PER_PAGE;
        const end = start + Constants.ARTICLES_PER_PAGE;
        const paginated = filtered.slice(start, end);

        return {
            articles: paginated,
            pagination: {
                current: page,
                total: totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        };
    }
}

// ==================== КОМПОНЕНТЫ ====================
class Component {
    constructor(elementId) {
        this.element = document.getElementById(elementId);
    }

    show() {
        if (this.element) this.element.style.display = 'block';
    }

    hide() {
        if (this.element) this.element.style.display = 'none';
    }

    clear() {
        if (this.element) this.element.innerHTML = '';
    }
}

class ArticleCardComponent extends Component {
    constructor(elementId) {
        super(elementId);
    }

    render(article, onClick) {
        const card = document.createElement('div');
        card.className = 'article-card';
        card.innerHTML = `
            <div class="article-content">
                <h3 class="article-title">${Utils.escapeHTML(article.title)}</h3>
                <p class="article-excerpt">${Utils.escapeHTML(article.excerpt || article.title.substring(0, 100) + '...')}</p>
                <div class="article-tags">
                    ${(article.tags || []).map(tag => 
                        `<span class="article-tag">#${Utils.escapeHTML(tag)}</span>`
                    ).join('')}
                </div>
                <div class="article-meta">
                    <div class="article-date">
                        <i class="far fa-calendar"></i>
                        ${Utils.formatDate(article.createdAt)}
                    </div>
                    <div class="article-stats">
                        <i class="far fa-eye"></i> ${article.views || 0}
                    </div>
                </div>
            </div>
        `;
        
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            onClick(article.id);
        });
        return card;
    }
}

class ArticleViewComponent extends Component {
    constructor(elementId) {
        super(elementId);
    }

    render(article, onEdit, onDelete) {
        this.clear();
        
        this.element.innerHTML = `
            <div class="article-header">
                <h2 class="article-view-title">${Utils.escapeHTML(article.title)}</h2>
                <div class="article-meta-large">
                    <div class="article-author">
                        <i class="far fa-user"></i>
                        <span>${Utils.escapeHTML(article.author || Constants.SAMPLE_AUTHOR)}</span>
                    </div>
                    <div class="article-date-large">
                        <i class="far fa-calendar"></i>
                        <span>${Utils.formatDateTime(article.createdAt)}</span>
                    </div>
                    <div class="article-views">
                        <i class="far fa-eye"></i>
                        <span>${article.views || 0}</span> просмотров
                    </div>
                </div>
                <div class="article-tags">
                    ${(article.tags || []).map(tag => 
                        `<span class="article-tag">#${Utils.escapeHTML(tag)}</span>`
                    ).join('')}
                </div>
            </div>
            <div class="article-body">
                <div class="article-content-full">
                    ${Utils.markdownToHTML(article.content)}
                </div>
            </div>
            <div class="article-actions">
                <button class="btn btn-secondary" id="backToHomeBtn">
                    <i class="fas fa-arrow-left"></i> Назад к списку
                </button>
                <button class="btn btn-primary" id="editArticleBtn">
                    <i class="fas fa-edit"></i> Редактировать
                </button>
                <button class="btn btn-danger" id="deleteArticleBtn">
                    <i class="fas fa-trash"></i> Удалить
                </button>
            </div>
        `;
        
        // Назначаем обработчики
        this.element.querySelector('#backToHomeBtn').addEventListener('click', () => {
            // Обработчик будет назначен в контроллере
        });
        
        this.element.querySelector('#editArticleBtn').addEventListener('click', onEdit);
        this.element.querySelector('#deleteArticleBtn').addEventListener('click', onDelete);
    }
}

class TagsFilterComponent extends Component {
    constructor(elementId) {
        super(elementId);
    }

    render(tags, activeTag, onTagClick) {
        this.clear();
        
        const allTag = this.createTagElement('all', 'Все темы', activeTag === 'all');
        allTag.addEventListener('click', () => onTagClick('all'));
        this.element.appendChild(allTag);

        tags.forEach(tag => {
            const tagElement = this.createTagElement(tag, tag, activeTag === tag);
            tagElement.addEventListener('click', () => onTagClick(tag));
            this.element.appendChild(tagElement);
        });
    }

    createTagElement(id, text, isActive) {
        const tag = document.createElement('div');
        tag.className = `tag ${isActive ? 'active' : ''}`;
        tag.dataset.tag = id;
        tag.textContent = text;
        return tag;
    }
}

class PaginationComponent extends Component {
    constructor(elementId) {
        super(elementId);
    }

    render(currentPage, totalPages, onPageChange) {
        this.clear();
        
        if (totalPages <= 1) {
            this.hide();
            return;
        }
        
        this.show();
        
        if (currentPage > 1) {
            const prevBtn = this.createPageButton('←', 'Предыдущая', false);
            prevBtn.addEventListener('click', () => onPageChange(currentPage - 1));
            this.element.appendChild(prevBtn);
        }

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || Math.abs(currentPage - i) <= 2) {
                const pageBtn = this.createPageButton(i, `Страница ${i}`, i === currentPage);
                pageBtn.addEventListener('click', () => onPageChange(i));
                this.element.appendChild(pageBtn);
            } else if (Math.abs(currentPage - i) === 3) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.padding = '0 10px';
                this.element.appendChild(dots);
            }
        }

        if (currentPage < totalPages) {
            const nextBtn = this.createPageButton('→', 'Следующая', false);
            nextBtn.addEventListener('click', () => onPageChange(currentPage + 1));
            this.element.appendChild(nextBtn);
        }
    }

    createPageButton(text, title, isActive) {
        const button = document.createElement('button');
        button.className = `page-btn ${isActive ? 'active' : ''}`;
        button.textContent = text;
        button.title = title;
        return button;
    }
}

class NotificationComponent extends Component {
    constructor(elementId) {
        super(elementId);
        this.timeout = null;
    }

    show(type, title, message, duration = 3000) {
        this.clear();
        
        const icon = type === 'success' ? 'fa-check-circle' :
                    type === 'error' ? 'fa-exclamation-circle' :
                    'fa-info-circle';
        
        this.element.innerHTML = `
            <i class="fas ${icon} notification-icon"></i>
            <div>
                <div class="notification-title">${Utils.escapeHTML(title)}</div>
                <div class="notification-message">${Utils.escapeHTML(message)}</div>
            </div>
        `;
        
        this.element.style.borderLeftColor = 
            type === 'success' ? 'var(--success)' :
            type === 'error' ? 'var(--error)' : 'var(--accent-pink)';
        
        this.element.classList.add('show');
        
        if (this.timeout) clearTimeout(this.timeout);
        this.timeout = setTimeout(() => {
            this.element.classList.remove('show');
        }, duration);
    }
}

// ==================== СЕРВИСЫ ====================
class ThemeService {
    constructor() {
        this.isDark = localStorage.getItem('blossom-theme') === 'dark';
        this.init();
    }

    init() {
        if (this.isDark) {
            document.body.classList.add('dark-theme');
            document.getElementById('themeIcon').className = 'fas fa-sun';
        }
    }

    toggle() {
        this.isDark = !this.isDark;
        
        if (this.isDark) {
            document.body.classList.add('dark-theme');
            document.getElementById('themeIcon').className = 'fas fa-sun';
            localStorage.setItem('blossom-theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            document.getElementById('themeIcon').className = 'fas fa-moon';
            localStorage.setItem('blossom-theme', 'light');
        }
    }
}

class RouterService {
    constructor() {
        this.currentMode = Constants.VIEW_MODE.LIST;
        this.currentArticleId = null;
        this.history = [];
    }

    navigateTo(mode, articleId = null) {
        this.history.push({ mode, articleId });
        this.currentMode = mode;
        this.currentArticleId = articleId;
        this.onNavigateCallback && this.onNavigateCallback(mode, articleId);
    }

    goBack() {
        if (this.history.length > 1) {
            this.history.pop();
            const prev = this.history[this.history.length - 1];
            this.currentMode = prev.mode;
            this.currentArticleId = prev.articleId;
            this.onNavigateCallback && this.onNavigateCallback(prev.mode, prev.articleId);
        } else {
            this.navigateTo(Constants.VIEW_MODE.LIST);
        }
    }

    onNavigate(callback) {
        this.onNavigateCallback = callback;
    }
}

// ==================== КОНТРОЛЛЕР ====================
class BlogController {
    constructor() {
        this.model = new ArticleModel();
        this.themeService = new ThemeService();
        this.router = new RouterService();
        
        // Компоненты
        this.articlesGrid = new Component('articlesGrid');
        this.articleCard = new ArticleCardComponent('articlesGrid');
        this.articleView = new ArticleViewComponent('articleView');
        this.tagsFilter = new TagsFilterComponent('tagsFilter');
        this.pagination = new PaginationComponent('pagination');
        this.notification = new NotificationComponent('notification');
        
        // Состояние
        this.state = {
            currentTag: 'all',
            searchQuery: '',
            currentPage: 1,
            editingArticleId: null
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.subscribeToModel();
        this.setupRouter();
        this.renderCurrentView();
        
        if (this.model.getAll().length === 0) {
            this.addSampleArticles();
        }
    }

    subscribeToModel() {
        this.model.subscribe(() => {
            if (this.router.currentMode === Constants.VIEW_MODE.LIST) {
                this.renderListView();
            }
        });
    }

    setupRouter() {
        this.router.onNavigate((mode, articleId) => {
            this.renderView(mode, articleId);
        });
    }

    setupEventListeners() {
        // Навигация
        document.getElementById('newArticleBtn').addEventListener('click', () => {
            this.router.navigateTo(Constants.VIEW_MODE.EDITOR);
        });
        
        document.getElementById('homeBtn').addEventListener('click', () => {
            this.router.navigateTo(Constants.VIEW_MODE.LIST);
        });
        
        document.getElementById('emptyStateBtn').addEventListener('click', () => {
            this.router.navigateTo(Constants.VIEW_MODE.EDITOR);
        });
        
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.themeService.toggle();
        });
        
        // Поиск
        const searchInput = document.getElementById('searchInput');
        const debouncedSearch = Utils.debounce((e) => {
            this.state.searchQuery = e.target.value;
            this.state.currentPage = 1;
            this.renderListView();
        }, 300);
        searchInput.addEventListener('input', debouncedSearch);
        
        // Редактор
        document.getElementById('closeEditorBtn').addEventListener('click', () => {
            this.router.goBack();
        });
        
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.router.goBack();
        });
        
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveArticle();
        });
        
        // Реалтайм превью
        document.getElementById('articleTitle').addEventListener('input', () => this.updatePreview());
        document.getElementById('articleContent').addEventListener('input', () => this.updatePreview());
        
        // Модальное окно удаления
        document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
            document.getElementById('deleteModal').classList.remove('active');
        });
        
        document.getElementById('deleteModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('deleteModal')) {
                document.getElementById('deleteModal').classList.remove('active');
            }
        });
        
        // Прогресс-бар при скролле
        window.addEventListener('scroll', () => this.updateProgressBar());
    }

    renderView(mode, articleId = null) {
        // Скрыть все представления
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('articleView').style.display = 'none';
        document.getElementById('editorContainer').style.display = 'none';
        
        switch (mode) {
            case Constants.VIEW_MODE.LIST:
                this.renderListView();
                document.getElementById('mainContent').style.display = 'block';
                break;
                
            case Constants.VIEW_MODE.ARTICLE:
                if (articleId) {
                    this.renderArticleView(articleId);
                    document.getElementById('articleView').style.display = 'block';
                }
                break;
                
            case Constants.VIEW_MODE.EDITOR:
                this.renderEditorView(articleId);
                document.getElementById('editorContainer').style.display = 'block';
                break;
        }
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    renderCurrentView() {
        this.renderView(this.router.currentMode, this.router.currentArticleId);
    }

    renderListView() {
        const { articles, pagination } = this.model.getFiltered({
            tag: this.state.currentTag,
            search: this.state.searchQuery,
            page: this.state.currentPage
        });
        
        // Рендер статей
        this.articlesGrid.clear();
        articles.forEach(article => {
            const card = this.articleCard.render(article, (id) => {
                this.router.navigateTo(Constants.VIEW_MODE.ARTICLE, id);
            });
            this.articlesGrid.element.appendChild(card);
        });
        
        // Рендер тегов
        const tags = this.model.getTags();
        this.tagsFilter.render(tags, this.state.currentTag, (tag) => {
            this.state.currentTag = tag;
            this.state.currentPage = 1;
            this.renderListView();
        });
        
        // Рендер пагинации
        this.pagination.render(this.state.currentPage, pagination.total, (page) => {
            this.state.currentPage = page;
            window.scrollTo({ top: 0, behavior: 'smooth' });
            this.renderListView();
        });
        
        // Показ/скрытие пустого состояния
        document.getElementById('emptyState').style.display = 
            articles.length === 0 ? 'block' : 'none';
    }

    renderArticleView(articleId) {
        const article = this.model.getById(articleId);
        if (!article) {
            this.notification.show('error', 'Ошибка', 'Статья не найдена');
            this.router.navigateTo(Constants.VIEW_MODE.LIST);
            return;
        }
        
        this.model.incrementViews(articleId);
        
        // Рендерим статью с передачей функций для кнопок
        this.articleView.render(
            article,
            () => this.router.navigateTo(Constants.VIEW_MODE.EDITOR, articleId),
            () => this.confirmDelete(articleId)
        );
        
        // Назначаем обработчик для кнопки "Назад"
        this.articleView.element.querySelector('#backToHomeBtn').addEventListener('click', () => {
            this.router.goBack();
        });
    }

    renderEditorView(articleId = null) {
        if (articleId) {
            const article = this.model.getById(articleId);
            if (article) {
                document.getElementById('articleTitle').value = article.title;
                document.getElementById('articleExcerpt').value = article.excerpt || '';
                document.getElementById('articleContent').value = article.content;
                document.getElementById('articleTags').value = (article.tags || []).join(', ');
                document.getElementById('editorTitle').textContent = 'Редактировать статью';
                document.getElementById('saveBtn').innerHTML = '<i class="fas fa-save"></i> Сохранить изменения';
                this.state.editingArticleId = articleId;
            }
        } else {
            document.getElementById('articleForm').reset();
            document.getElementById('editorTitle').textContent = 'Новая статья';
            document.getElementById('saveBtn').innerHTML = '<i class="fas fa-save"></i> Опубликовать';
            this.state.editingArticleId = null;
        }
        
        this.updatePreview();
    }

    updatePreview() {
        const title = document.getElementById('articleTitle').value || 'Заголовок статьи';
        const content = document.getElementById('articleContent').value || 'Содержание статьи...';
        const htmlContent = Utils.markdownToHTML(content);
        
        document.getElementById('articlePreview').innerHTML = `
            <h2 class="preview-title">${Utils.escapeHTML(title)}</h2>
            <div>${htmlContent}</div>
        `;
    }

    validateForm() {
        const title = document.getElementById('articleTitle').value.trim();
        const content = document.getElementById('articleContent').value.trim();
        let isValid = true;
        
        document.getElementById('titleError').textContent = '';
        document.getElementById('contentError').textContent = '';
        
        if (title.length < 5) {
            document.getElementById('titleError').innerHTML = 
                '<i class="fas fa-exclamation-circle"></i> Заголовок должен содержать минимум 5 символов';
            isValid = false;
        }
        
        if (!content) {
            document.getElementById('contentError').innerHTML = 
                '<i class="fas fa-exclamation-circle"></i> Содержание статьи обязательно';
            isValid = false;
        }
        
        return isValid;
    }

    saveArticle() {
        if (!this.validateForm()) return;
        
        const articleData = {
            title: document.getElementById('articleTitle').value.trim(),
            excerpt: document.getElementById('articleExcerpt').value.trim() || 
                    document.getElementById('articleTitle').value.trim().substring(0, 100) + '...',
            content: document.getElementById('articleContent').value.trim(),
            tags: document.getElementById('articleTags').value
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0),
            author: Constants.SAMPLE_AUTHOR
        };
        
        if (articleData.tags.length === 0) {
            articleData.tags = ['без тега'];
        }
        
        let result;
        if (this.state.editingArticleId) {
            result = this.model.update(this.state.editingArticleId, articleData);
            this.notification.show('success', 'Статья обновлена', 'Изменения успешно сохранены');
            this.router.navigateTo(Constants.VIEW_MODE.ARTICLE, this.state.editingArticleId);
        } else {
            result = this.model.create(articleData);
            this.notification.show('success', 'Статья опубликована', 'Ваша статья теперь доступна в блоге');
            this.router.navigateTo(Constants.VIEW_MODE.ARTICLE, result.id);
        }
    }

    confirmDelete(articleId) {
        const article = this.model.getById(articleId);
        if (!article) return;
        
        document.getElementById('deleteModalText').textContent = 
            `Вы уверены, что хотите удалить статью "${article.title}"? Это действие невозможно отменить.`;
        
        document.getElementById('deleteModal').classList.add('active');
        
        document.getElementById('confirmDeleteBtn').onclick = () => {
            this.model.delete(articleId);
            document.getElementById('deleteModal').classList.remove('active');
            this.notification.show('success', 'Статья удалена', 'Статья была успешно удалена из блога');
            this.router.navigateTo(Constants.VIEW_MODE.LIST);
        };
    }

    updateProgressBar() {
        if (this.router.currentMode === Constants.VIEW_MODE.ARTICLE) {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrollPercent = (scrollTop / scrollHeight) * 100;
            document.getElementById('progressBar').style.width = `${scrollPercent}%`;
        } else {
            document.getElementById('progressBar').style.width = '0%';
        }
    }

    addSampleArticles() {
        const sampleArticles = [
            {
                title: "Утренние ритуалы для хорошего дня",
                excerpt: "Как начать день с позитивными мыслями и энергией",
                content: "# Утренние ритуалы для хорошего дня\n\nНачало дня задает тон всему, что будет дальше. Вот несколько простых практик, которые помогут вам чувствовать себя лучше:\n\n## 1. Медитация на 5 минут\nПросто сядьте удобно и сосредоточьтесь на дыхании.\n\n## 2. Благодарность\nЗапишите 3 вещи, за которые вы благодарны.\n\n## 3. Стакан теплой воды с лимоном\nЭто пробуждает организм и помогает пищеварению.\n\n> *«То, как вы начинаете день, определяет его течение»*",
                tags: ["саморазвитие", "утро", "ритуалы", "здоровье"],
                author: "Анна"
            },
            {
                title: "Цветочная терапия: как растения влияют на настроение",
                excerpt: "Сила цветов в создании гармонии и уюта",
                content: "## Цветочная терапия\n\nРастения в доме — это не просто декор. Это настоящие терапевты, которые:\n\n- **Снижают стресс** - зеленый цвет успокаивает нервную систему\n- **Очищают воздух** - многие растения фильтруют токсины\n- **Повышают продуктивность** - на 15% согласно исследованиям\n\n### Лучшие растения для дома:\n1. **Лаванда** - для спокойного сна\n2. **Жасмин** - улучшает настроение\n3. **Алоэ** - очищает воздух\n\nНе забывайте разговаривать со своими растениями — они это чувствуют!",
                tags: ["цветы", "терапия", "дом", "гармония"],
                author: "Мария"
            },
            {
                title: "Искусство минимализма в гардеробе",
                excerpt: "Создаем капсульный гардероб на все случаи жизни",
                content: "# Капсульный гардероб: простота и стиль\n\nМинимализм в одежде — это не про аскетизм, а про осознанный выбор.\n\n## Основные принципы:\n\n- **Качество вместо количества**\n- **Базовые цвета** (белый, черный, бежевый, серый)\n- **Универсальность** вещей\n\n### Моя базовая капсула:\n```\n• 5 топов\n• 3 блузы\n• 2 пары брюк\n• 1 юбка\n• 1 платье\n• 2 кардигана\n• 1 жакet\n```\n\nТакой подход экономит время, деньги и нервы!",
                tags: ["стиль", "мода", "минимализм", "гардероб"],
                author: "София"
            }
        ];
        
        sampleArticles.forEach(article => this.model.create(article));
    }
}

// Инициализация приложения
const app = new BlogController();
