let objects = [];
let filteredObjects = [];
let authMode = 'login';
let favorites = [];
let searchQuery = '';
let advancedFilters = {};

// Authentication functions
function showAuthModal(mode) {
    authMode = mode;
    const modal = document.getElementById('authModal');
    const title = document.getElementById('authTitle');
    const submitBtn = document.getElementById('authSubmit');
    const nameGroup = document.getElementById('nameGroup');
    const loginTypeGroup = document.getElementById('loginTypeGroup');
    const switchText = document.getElementById('authSwitchText');
    const switchLink = document.getElementById('authSwitchLink');
    
    if (mode === 'login') {
        title.textContent = 'Вход';
        submitBtn.textContent = 'Войти';
        nameGroup.style.display = 'none';
        loginTypeGroup.style.display = 'block';
        switchText.textContent = 'Нет аккаунта?';
        switchLink.textContent = 'Зарегистрироваться';
    } else {
        title.textContent = 'Регистрация';
        submitBtn.textContent = 'Зарегистрироваться';
        nameGroup.style.display = 'block';
        loginTypeGroup.style.display = 'none';
        switchText.textContent = 'Уже есть аккаунт?';
        switchLink.textContent = 'Войти';
        
        // Show both email and phone fields for registration
        document.getElementById('emailGroup').style.display = 'block';
        document.getElementById('phoneGroup').style.display = 'block';
        document.getElementById('authPhone').required = true;
    }
    
    modal.style.display = 'block';
}

// Login type switching functions
function setLoginType(type) {
    const emailBtn = document.querySelector('[data-type="email"]');
    const phoneBtn = document.querySelector('[data-type="phone"]');
    const emailGroup = document.getElementById('emailGroup');
    const phoneGroup = document.getElementById('phoneGroup');
    const emailInput = document.getElementById('authEmail');
    const phoneInput = document.getElementById('authPhone');
    
    if (type === 'email') {
        emailBtn.classList.add('active');
        phoneBtn.classList.remove('active');
        emailGroup.style.display = 'block';
        phoneGroup.style.display = 'none';
        emailInput.required = true;
        phoneInput.required = false;
    } else {
        phoneBtn.classList.add('active');
        emailBtn.classList.remove('active');
        emailGroup.style.display = 'none';
        phoneGroup.style.display = 'block';
        emailInput.required = false;
        phoneInput.required = true;
    }
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('authForm').reset();
}

function switchAuthMode() {
    showAuthModal(authMode === 'login' ? 'register' : 'login');
}

// Check authentication status
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        const userData = JSON.parse(user);
        showUserMenu(userData);
    } else {
        showAuthButtons();
    }
}

function showUserMenu(user) {
    // Hide auth menu and show authenticated user menu
    const authMenu = document.getElementById('authMenu');
    const userAuthenticatedMenu = document.getElementById('userAuthenticatedMenu');
    
    if (authMenu) {
        authMenu.style.display = 'none';
    }
    
    if (userAuthenticatedMenu) {
        userAuthenticatedMenu.style.display = 'block';
    }
    
    // Update user info in header
    updateUserInfoInHeader(user);
    
    // Show user name next to avatar
    const userNameDisplay = document.getElementById('userNameDisplay');
    if (userNameDisplay) {
        userNameDisplay.style.display = 'block';
    }
    
    // Show admin menu item if user is admin
    const adminItems = document.querySelectorAll('.admin-only');
    adminItems.forEach(item => {
        item.style.display = user.role === 'admin' ? 'block' : 'none';
    });
    
    // Load favorites
    loadFavorites();
}

function showAuthButtons() {
    // Show auth menu and hide authenticated user menu
    const authMenu = document.getElementById('authMenu');
    const userAuthenticatedMenu = document.getElementById('userAuthenticatedMenu');
    
    if (authMenu) {
        authMenu.style.display = 'block';
    }
    
    if (userAuthenticatedMenu) {
        userAuthenticatedMenu.style.display = 'none';
    }
    
    // Hide user name next to avatar
    const userNameDisplay = document.getElementById('userNameDisplay');
    if (userNameDisplay) {
        userNameDisplay.style.display = 'none';
    }
}

// Global function to update user info in header
window.updateUserInfoInHeader = function(user) {
    // Update user name in header
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = user.name || 'Пользователь';
    }
    
    // Update user avatar with first letter of name
    const userAvatarElement = document.getElementById('userAvatar');
    if (userAvatarElement && user.name) {
        userAvatarElement.textContent = user.name.charAt(0).toUpperCase();
    }
    
    // Update user name next to avatar if exists
    const userNameText = document.getElementById('userNameText');
    if (userNameText) {
        userNameText.textContent = user.name || 'Пользователь';
    }
}

function logout() {
    // Clear auth data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Close dropdown if exists
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
    
    // Update UI to show auth buttons instead of user menu
    showAuthButtons();
    
    // Show success message
    showModal({
        title: 'Выход выполнен',
        message: 'Вы успешно вышли из системы. До свидания!',
        type: 'info',
        confirmText: 'Понятно'
    });
    
    // Redirect to main page if on protected pages
    if (window.location.pathname.includes('admin.html') || 
        window.location.pathname.includes('cabinet.html') ||
        window.location.pathname.includes('requests.html')) {
        window.location.href = 'index.html';
    } else {
        // Reload current page to update state
        window.location.reload();
    }
}

// Object functions
function showObjectDetail(objectId) {
    // Redirect to object detail page
    window.location.href = `object.html?id=${objectId}`;
}

// Auto-refresh system
let lastDataUpdate = null;
let autoRefreshInterval = null;
let isDataDirty = false; // Флаг для отслеживания изменений

// Функция для проверки и обновления данных
async function checkForUpdates() {
    try {
        // Проверяем последнее время обновления
        const response = await fetch('/api/objects/last-update', {
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const serverLastUpdate = new Date(data.lastUpdate);
            
            // Если данные изменились (но не при первой загрузке)
            if (lastDataUpdate && serverLastUpdate > lastDataUpdate) {
                console.log('🔄 Обнаружены изменения, обновляем объекты...');
                
                // Загружаем объекты без запуска повторного автообновления
                await loadObjectsQuiet();
                lastDataUpdate = serverLastUpdate;
                
                // Показываем уведомление пользователю о обновлении
                showUpdateNotification();
            } else if (!lastDataUpdate) {
                // Первая проверка - просто запоминаем время
                lastDataUpdate = serverLastUpdate;
            }
        }
    } catch (error) {
        console.error('❌ Ошибка проверки обновлений:', error);
    }
}

// Показать уведомление об обновлении данных
function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
        <div class="update-notification-content">
            <i class="fas fa-sync-alt"></i>
            <span>Данные обновлены</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Удаляем уведомление через 3 секунды
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// Запуск автоматического обновления
function startAutoRefresh() {
    // Очищаем предыдущий интервал если есть
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // Проверяем обновления каждые 30 секунд
    autoRefreshInterval = setInterval(checkForUpdates, 30000);
    console.log('🔄 Автообновление запущено (каждые 30 секунд)');
}

// Остановка автоматического обновления
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log('⏹️ Автообновление остановлено');
    }
}

// Тихая загрузка объектов без запуска автообновления
async function loadObjectsQuiet() {
    try {
        const response = await fetch('/api/objects', {
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        objects = await response.json();
        filteredObjects = [...objects];
        
        console.log('🔄 Объекты обновлены (тихо):', objects.length);
        
        renderObjects();
        
    } catch (error) {
        console.error('❌ Error quietly loading objects:', error);
    }
}

// Обновленная функция loadObjects с поддержкой автообновления
async function loadObjects() {
    // Show loading indicator
    const container = document.getElementById('objectsContainer');
    if (container) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                <div style="display: inline-block; width: 50px; height: 50px; border: 4px solid rgba(37, 99, 235, 0.2); border-left-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
                <h3 style="color: var(--text-primary); margin-bottom: 10px;">Загрузка объектов...</h3>
                <p style="color: var(--text-secondary);">Пожалуйста, подождите</p>
            </div>
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;
    }
    
    try {
        const response = await fetch('/api/objects', {
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        objects = await response.json();
        filteredObjects = [...objects];
        
        // Обновляем время последнего обновления
        lastDataUpdate = new Date();
        
        // Debug: show object types
        console.log('✅ Loaded objects:', objects.length);
        
        // Add a global function for debugging in console
        window.debugObjects = function() {
            console.log('All objects:');
            objects.forEach(obj => {
                console.log(`ID: ${obj.id}, Title: "${obj.title}", Type: "${obj.type}"`);
            });
            
            console.log('\nType distribution:');
            const typeCounts = {};
            objects.forEach(obj => {
                typeCounts[obj.type] = (typeCounts[obj.type] || 0) + 1;
            });
            Object.entries(typeCounts).forEach(([type, count]) => {
                console.log(`Type: "${type}" - Count: ${count}`);
            });
        };
        
        renderObjects();
        
        // Запускаем автообновление после первой загрузки
        if (!autoRefreshInterval) {
            startAutoRefresh();
        }
        
    } catch (error) {
        console.error('❌ Error loading objects:', error);
        
        if (container) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 4rem; color: #ef4444; margin-bottom: 20px;"></i>
                    <h3 style="color: var(--text-primary); margin-bottom: 10px;">Ошибка загрузки</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 20px;">Не удалось загрузить объекты недвижимости</p>
                    <button onclick="loadObjects()" style="padding: 12px 24px; background: var(--primary-gradient); color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 500;">
                        <i class="fas fa-redo"></i> Попробовать снова
                    </button>
                </div>
            `;
        }
    }
}

function renderObjects() {
    const container = document.getElementById('objectsContainer');
    if (!container) return;
    
    if (filteredObjects.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                <i class="fas fa-search" style="font-size: 4rem; color: var(--text-secondary); margin-bottom: 20px;"></i>
                <h3 style="color: var(--text-secondary); margin-bottom: 10px;">Объекты не найдены</h3>
                <p style="color: var(--text-secondary);">Попробуйте изменить параметры поиска</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredObjects.map((object, index) => {
        const images = object.images || [];
        const hasMultipleImages = images.length > 1;
        
        return `
        <div class="object-card" data-object-id="${object.id}" style="animation-delay: ${index * 0.1}s">
            <div class="object-image-container" style="position: relative;">
                <img src="${images.length > 0 ? images[0] : '/placeholder.svg'}" alt="${object.title}" class="object-image" id="card-image-${object.id}">
                <button class="favorite-btn" data-object-id="${object.id}" onclick="toggleFavorite(${object.id}, event)">
                    <i class="fas fa-heart"></i>
                </button>
                ${hasMultipleImages ? `
                    <div class="image-nav-buttons">
                        <button class="nav-btn prev-btn" data-object-id="${object.id}" data-direction="-1" title="Предыдущее фото">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <button class="nav-btn next-btn" data-object-id="${object.id}" data-direction="1" title="Следующее фото">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>

                ` : ''}
                <div class="object-overlay">
                </div>
            </div>
            <div class="object-info">
                <h3 class="object-title">${object.title}</h3>
                <div class="object-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${object.location}</span>
                </div>
                <div class="object-price">${formatPrice(object.price)} ₽</div>
                <div class="object-details">
                    <div class="detail-item">
                        <i class="fas fa-ruler-combined"></i>
                        <span>${object.area ? object.area + ' м²' : 'Не указана'}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-bed"></i>
                        <span>${object.rooms || 'Студия'}</span>
                    </div>
                    ${object.floor && object.max_floor ? `
                        <div class="detail-item">
                            <i class="fas fa-building"></i>
                            <span>${object.floor}/${object.max_floor} эт</span>
                        </div>
                    ` : ''}
                    ${object.nearest_metro ? `
                        <div class="detail-item">
                            <i class="fas fa-subway"></i>
                            <span>${object.metro_distance_minutes}мин</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
        `
    }).join('');
    
    // Log navigation buttons for debugging
    setTimeout(() => {
        const navButtons = document.querySelectorAll('.nav-btn');
        console.log('Found navigation buttons:', navButtons.length);
        
        navButtons.forEach((button, index) => {
            console.log(`Button ${index}:`, button.dataset.objectId, button.dataset.direction);
        });
    }, 100);
}

// Карусель изображений в карточках
const cardImageIndices = {};

function changeCardImage(objectId, direction) {
    console.log('changeCardImage called:', objectId, direction); // Debug
    
    const currentObject = objects.find(obj => obj.id === objectId);
    if (!currentObject || !currentObject.images || currentObject.images.length <= 1) {
        console.log('Object not found or no multiple images'); // Debug
        return;
    }
    
    const imageElement = document.getElementById(`card-image-${objectId}`);
    if (!imageElement) {
        console.log('Image element not found'); // Debug
        return;
    }
    
    // Initialize current index if not exists
    if (!(objectId in cardImageIndices)) {
        cardImageIndices[objectId] = 0;
    }
    
    // Calculate new index
    let newIndex = cardImageIndices[objectId] + direction;
    if (newIndex < 0) newIndex = currentObject.images.length - 1;
    if (newIndex >= currentObject.images.length) newIndex = 0;
    
    cardImageIndices[objectId] = newIndex;
    
    // Добавляем плавную анимацию при смене изображения
    imageElement.style.transition = 'opacity 0.3s ease';
    imageElement.style.opacity = '0.3';
    
    setTimeout(() => {
        // Update image
        imageElement.src = currentObject.images[newIndex];
        imageElement.style.opacity = '1';
    }, 150);
}

function filterObjects() {
    const typeFilter = document.getElementById('typeFilter')?.value || '';
    const minPrice = parseFloat(document.getElementById('minPriceFilter')?.value) || 0;
    const maxPriceValue = document.getElementById('maxPriceFilter')?.value;
    const maxPrice = maxPriceValue ? parseFloat(maxPriceValue) : Infinity;
    const locationFilter = document.getElementById('locationFilter')?.value || '';
    const sortBy = document.getElementById('sortBy')?.value || 'price_asc';
    
    // Debug info
    console.log('Applying filters:', {
        typeFilter, minPrice, maxPrice, locationFilter, sortBy, searchQuery, advancedFilters
    });
    console.log('Available objects:', objects.length);
    
    filteredObjects = objects.filter(object => {
        // Basic filters
        const typeMatch = !typeFilter || object.type === typeFilter;
        const priceMatch = object.price >= minPrice && (maxPrice === Infinity || object.price <= maxPrice);
        const locationMatch = !locationFilter || object.location.toLowerCase().includes(locationFilter.toLowerCase());
        
        // Search filter
        const searchMatch = !searchQuery || 
            object.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
            object.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            object.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            getObjectTypeText(object.type).toLowerCase().includes(searchQuery.toLowerCase());
        
        // Advanced filters
        const buildingTypeMatch = !advancedFilters.buildingType || object.building_type === advancedFilters.buildingType;
        const bathroomTypeMatch = !advancedFilters.bathroomType || object.bathroom_type === advancedFilters.bathroomType;
        const balconyTypeMatch = !advancedFilters.balconyType || object.balcony_type === advancedFilters.balconyType;
        const repairTypeMatch = !advancedFilters.repairType || object.repair_type === advancedFilters.repairType;
        const windowViewMatch = !advancedFilters.windowView || object.window_view === advancedFilters.windowView;
        const parkingTypeMatch = !advancedFilters.parkingType || object.parking_type === advancedFilters.parkingType;
        const heatingTypeMatch = !advancedFilters.heatingType || object.heating_type === advancedFilters.heatingType;
        const gasSupplyMatch = !advancedFilters.gasSupply || object.gas_supply === advancedFilters.gasSupply;
        
        return typeMatch && priceMatch && locationMatch && searchMatch &&
               buildingTypeMatch && bathroomTypeMatch && balconyTypeMatch &&
               repairTypeMatch && windowViewMatch && parkingTypeMatch &&
               heatingTypeMatch && gasSupplyMatch;
    });
    
    console.log('Filtered objects:', filteredObjects.length);
    
    // Sort objects
    switch (sortBy) {
        case 'price_asc':
            filteredObjects.sort((a, b) => a.price - b.price);
            break;
        case 'price_desc':
            filteredObjects.sort((a, b) => b.price - a.price);
            break;
        case 'date_desc':
            filteredObjects.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
    }
    
    renderObjects();
    updateFavoriteButtons(); // Update favorite buttons after re-rendering
}

// Request functions
function showRequestModal() {
    if (!localStorage.getItem('token')) {
        showNotification('Войдите в систему для подачи заявки', 'info');
        return;
    }
    
    document.getElementById('requestModal').style.display = 'block';
}

function closeRequestModal() {
    document.getElementById('requestModal').style.display = 'none';
    document.getElementById('requestForm').reset();
}

// Utility functions
function formatPrice(price) {
    return new Intl.NumberFormat('ru-RU').format(price);
}

function getObjectTypeText(type) {
    const types = {
        'apartment': 'Квартира',
        'house': 'Дом',
        'commercial': 'Коммерческая',
        'land': 'Земельный участок'
    };
    return types[type] || type;
}

function formatPhoneNumber(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.startsWith('8')) value = '7' + value.slice(1);
    if (!value.startsWith('7')) value = '7' + value;
    
    if (value.length > 1) {
        value = value.slice(0, 11);
        const formatted = value.replace(/^7(\d{3})(\d{3})(\d{2})(\d{2})$/, '+7 ($1) $2-$3-$4');
        if (formatted.includes('(')) {
            input.value = formatted;
        } else {
            input.value = '+7 ' + value.slice(1);
        }
    }
}

// Notification system
window.showNotification = function(message, type = 'success', duration = 3000) {
    // Remove existing notifications
    const existingNotification = document.querySelector('.custom-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `custom-notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    // Add styles if not already added
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .custom-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                min-width: 320px;
                max-width: 400px;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(20px);
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                animation: notificationSlideIn 0.4s ease-out;
                overflow: hidden;
            }
            
            .custom-notification.success {
                border-left: 4px solid #10b981;
            }
            
            .custom-notification.error {
                border-left: 4px solid #ef4444;
            }
            
            .custom-notification.info {
                border-left: 4px solid #3b82f6;
            }
            
            .notification-content {
                padding: 20px;
                display: flex;
                align-items: center;
                gap: 12px;
                color: #1f2937;
            }
            
            .notification-content i:first-child {
                font-size: 1.2rem;
                flex-shrink: 0;
            }
            
            .custom-notification.success .notification-content i:first-child {
                color: #10b981;
            }
            
            .custom-notification.error .notification-content i:first-child {
                color: #ef4444;
            }
            
            .custom-notification.info .notification-content i:first-child {
                color: #3b82f6;
            }
            
            .notification-content span {
                flex: 1;
                font-weight: 500;
                line-height: 1.4;
            }
            
            .notification-close {
                background: none;
                border: none;
                cursor: pointer;
                padding: 4px;
                border-radius: 6px;
                color: #6b7280;
                transition: all 0.2s ease;
                flex-shrink: 0;
            }
            
            .notification-close:hover {
                background: rgba(0, 0, 0, 0.1);
                color: #374151;
            }
            
            @keyframes notificationSlideIn {
                from {
                    opacity: 0;
                    transform: translateX(100%) scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: translateX(0) scale(1);
                }
            }
            
            @keyframes notificationSlideOut {
                from {
                    opacity: 1;
                    transform: translateX(0) scale(1);
                }
                to {
                    opacity: 0;
                    transform: translateX(100%) scale(0.9);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'notificationSlideOut 0.3s ease-in';
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            }
        }, duration);
    }
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'info': return 'fa-info-circle';
        default: return 'fa-check-circle';
    }
}

// Custom Modal System
window.showModal = function(options) {
    const {
        title = '',
        message = '',
        type = 'info', // info, success, error, warning, confirm
        confirmText = 'Понятно',
        cancelText = 'Отмена',
        showCancel = false,
        onConfirm = null,
        onCancel = null,
        autoClose = false,
        duration = 0
    } = options;
    
    // Remove existing modal
    const existingModal = document.querySelector('.custom-modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'custom-modal-overlay';
    modalOverlay.innerHTML = `
        <div class="custom-modal ${type}">
            <div class="modal-header">
                ${title ? `<h3 class="modal-title">${title}</h3>` : ''}
                <button class="modal-close" onclick="this.closest('.custom-modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="modal-icon">
                    <i class="fas ${getModalIcon(type)}"></i>
                </div>
                <div class="modal-message">${message}</div>
            </div>
            <div class="modal-footer">
                <button class="modal-btn modal-btn-primary" onclick="handleModalConfirm(this)">
                    ${confirmText}
                </button>
                ${showCancel ? `
                    <button class="modal-btn modal-btn-secondary" onclick="handleModalCancel(this)">
                        ${cancelText}
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    // Add styles if not already added
    if (!document.querySelector('#modal-styles')) {
        const style = document.createElement('style');
        style.id = 'modal-styles';
        style.textContent = `
            .custom-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(10px);
                z-index: 20000;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: modalFadeIn 0.3s ease-out;
                padding: 20px;
            }
            
            .custom-modal {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(20px);
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.3);
                max-width: 500px;
                width: 100%;
                animation: modalSlideIn 0.3s ease-out;
                overflow: hidden;
            }
            
            .modal-header {
                padding: 25px 30px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(0, 0, 0, 0.1);
            }
            
            .modal-title {
                margin: 0;
                font-family: 'Manrope', sans-serif;
                font-size: 1.4rem;
                font-weight: 700;
                color: #1f2937;
            }
            
            .modal-close {
                background: none;
                border: none;
                cursor: pointer;
                padding: 8px;
                border-radius: 8px;
                color: #6b7280;
                transition: all 0.2s ease;
                font-size: 1.1rem;
            }
            
            .modal-close:hover {
                background: rgba(0, 0, 0, 0.1);
                color: #374151;
            }
            
            .modal-body {
                padding: 30px;
                display: flex;
                align-items: center;
                gap: 20px;
            }
            
            .modal-icon {
                flex-shrink: 0;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.8rem;
            }
            
            .custom-modal.success .modal-icon {
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
            }
            
            .custom-modal.error .modal-icon {
                background: linear-gradient(135deg, #ef4444, #dc2626);
                color: white;
            }
            
            .custom-modal.warning .modal-icon {
                background: linear-gradient(135deg, #f59e0b, #d97706);
                color: white;
            }
            
            .custom-modal.info .modal-icon,
            .custom-modal.confirm .modal-icon {
                background: linear-gradient(135deg, #3b82f6, #2563eb);
                color: white;
            }
            
            .modal-message {
                flex: 1;
                color: #374151;
                font-size: 1.1rem;
                line-height: 1.6;
                font-weight: 500;
            }
            
            .modal-footer {
                padding: 20px 30px 30px;
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }
            
            .modal-btn {
                padding: 12px 24px;
                border: none;
                border-radius: 10px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                min-width: 100px;
            }
            
            .modal-btn-primary {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
            }
            
            .modal-btn-primary:hover {
                background: linear-gradient(135deg, #5a67d8, #6b46c1);
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
            }
            
            .modal-btn-secondary {
                background: rgba(107, 114, 128, 0.1);
                color: #6b7280;
                border: 2px solid rgba(107, 114, 128, 0.2);
            }
            
            .modal-btn-secondary:hover {
                background: rgba(107, 114, 128, 0.2);
                color: #374151;
                border-color: rgba(107, 114, 128, 0.3);
            }
            
            @keyframes modalFadeIn {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
            }
            
            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: scale(0.9) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Store callbacks
    modalOverlay.onConfirm = onConfirm;
    modalOverlay.onCancel = onCancel;
    
    // Add to page
    document.body.appendChild(modalOverlay);
    
    // Handle escape key
    const escapeHandler = (e) => {
        if (e.key === 'Escape' && modalOverlay.parentElement) {
            modalOverlay.remove();
            document.removeEventListener('keydown', escapeHandler);
            if (modalOverlay.onResolve) {
                modalOverlay.onResolve(false);
            }
        }
    };
    document.addEventListener('keydown', escapeHandler);
    
    // Auto close if specified
    if (autoClose && duration > 0) {
        setTimeout(() => {
            if (modalOverlay.parentElement) {
                modalOverlay.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        }, duration);
    }
    
    // Return promise for easier handling
    return new Promise((resolve) => {
        modalOverlay.onResolve = resolve;
    });
}

function getModalIcon(type) {
    switch (type) {
        case 'success': return 'fa-check';
        case 'error': return 'fa-exclamation-triangle';
        case 'warning': return 'fa-exclamation-triangle';
        case 'info': return 'fa-info';
        case 'confirm': return 'fa-question';
        default: return 'fa-info';
    }
}

// Global handlers for modal buttons
window.handleModalConfirm = function(button) {
    const modal = button.closest('.custom-modal-overlay');
    if (modal.onConfirm) {
        modal.onConfirm();
    }
    if (modal.onResolve) {
        modal.onResolve(true);
    }
    modal.remove();
}

window.handleModalCancel = function(button) {
    const modal = button.closest('.custom-modal-overlay');
    if (modal.onCancel) {
        modal.onCancel();
    }
    if (modal.onResolve) {
        modal.onResolve(false);
    }
    modal.remove();
}

// Convenient wrapper functions
window.showAlert = function(message, title = '', type = 'info') {
    return showModal({
        title,
        message,
        type,
        confirmText: 'Понятно'
    });
}

window.showConfirm = function(message, title = 'Подтверждение') {
    return showModal({
        title,
        message,
        type: 'confirm',
        confirmText: 'Да',
        cancelText: 'Отмена',
        showCancel: true
    });
}

window.showPrompt = function(message, title = 'Введите данные', defaultValue = '') {
    return new Promise((resolve) => {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'custom-modal-overlay';
        modalOverlay.innerHTML = `
            <div class="custom-modal info">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close" onclick="this.closest('.custom-modal-overlay').remove(); resolve(null);">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="modal-icon">
                        <i class="fas fa-edit"></i>
                    </div>
                    <div class="modal-content">
                        <div class="modal-message">${message}</div>
                        <input type="text" class="modal-input" value="${defaultValue}" placeholder="Введите значение...">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn modal-btn-primary" onclick="handlePromptConfirm(this)">
                        Подтвердить
                    </button>
                    <button class="modal-btn modal-btn-secondary" onclick="this.closest('.custom-modal-overlay').remove(); resolve(null);">
                        Отмена
                    </button>
                </div>
            </div>
        `;
        
        modalOverlay.resolve = resolve;
        
        // Add prompt-specific styles
        if (!document.querySelector('#prompt-styles')) {
            const style = document.createElement('style');
            style.id = 'prompt-styles';
            style.textContent = `
                .modal-content {
                    flex: 1;
                }
                
                .modal-input {
                    width: 100%;
                    padding: 12px 16px;
                    border: 2px solid rgba(107, 114, 128, 0.2);
                    border-radius: 10px;
                    background: rgba(255, 255, 255, 0.8);
                    font-size: 1rem;
                    margin-top: 15px;
                    transition: all 0.3s ease;
                    color: #374151;
                }
                
                .modal-input:focus {
                    outline: none;
                    border-color: #667eea;
                    background: white;
                    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(modalOverlay);
        
        // Focus on input
        setTimeout(() => {
            const input = modalOverlay.querySelector('.modal-input');
            input.focus();
            input.select();
        }, 100);
    });
}

window.handlePromptConfirm = function(button) {
    const modal = button.closest('.custom-modal-overlay');
    const input = modal.querySelector('.modal-input');
    const value = input.value.trim();
    modal.resolve(value || null);
    modal.remove();
}

// Universal request form handler
window.initializeRequestForm = function() {
    const requestForm = document.getElementById('requestForm');
    if (requestForm) {
        // Remove existing listeners to prevent duplicates
        const newForm = requestForm.cloneNode(true);
        requestForm.parentNode.replaceChild(newForm, requestForm);
        
        newForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const message = document.getElementById('requestMessage').value;
            const phone = document.getElementById('requestPhone').value;
            const email = document.getElementById('requestEmail').value;
            
            if (!message.trim()) {
                showNotification('Введите сообщение', 'error');
                return;
            }
            
            try {
                const response = await fetch('/api/requests', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('token')
                    },
                    body: JSON.stringify({
                        message,
                        phone,
                        email
                    })
                });
                
                if (response.ok) {
                    showModal({
                        title: 'Заявка отправлена',
                        message: 'Ваша заявка успешно отправлена! Мы свяжемся с вами в ближайшее время.',
                        type: 'success',
                        confirmText: 'Отлично'
                    });
                    if (typeof closeRequestModal === 'function') {
                        closeRequestModal();
                    }
                    // Clear form
                    newForm.reset();
                } else {
                    const error = await response.json();
                    showNotification('Ошибка: ' + error.error, 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showNotification('Произошла ошибка при отправке заявки', 'error');
            }
        });
    }
}

// Override native alert and confirm
window.alert = function(message) {
    return showAlert(message, 'Уведомление', 'info');
}

window.confirm = function(message) {
    // For sync usage, show custom confirm and return promise
    return showConfirm(message, 'Подтверждение');
}

/*
Custom Modal System Usage Examples:

// Simple alert
showAlert('Сообщение сохранено!');

// Alert with custom title and type
showAlert('Операция завершена', 'Успех', 'success');

// Confirmation dialog
showConfirm('Вы уверены, что хотите удалить этот элемент?').then(result => {
    if (result) {
        console.log('Пользователь подтвердил');
    }
});

// Custom modal with callbacks
showModal({
    title: 'Внимание',
    message: 'Данные будут безвозвратно удалены',
    type: 'warning',
    confirmText: 'Удалить',
    cancelText: 'Отмена',
    showCancel: true,
    onConfirm: () => console.log('Confirmed'),
    onCancel: () => console.log('Cancelled')
});

// Prompt for user input
showPrompt('Введите новое имя файла:', 'Переименование').then(name => {
    if (name) {
        console.log('Новое имя:', name);
    }
});

// Auto-closing notification
showNotification('Данные сохранены', 'success', 2000);
*/

// Favorites functions
function loadFavorites() {
    const savedFavorites = localStorage.getItem('favorites');
    if (savedFavorites) {
        favorites = JSON.parse(savedFavorites);
    }
    updateFavoriteButtons();
}

function saveFavorites() {
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

function toggleFavorite(objectId, event) {
    event.preventDefault();
    event.stopPropagation();
    
    if (!localStorage.getItem('token')) {
        showNotification('Войдите в систему для добавления в избранное', 'info');
        return;
    }
    
    const index = favorites.indexOf(objectId);
    if (index > -1) {
        favorites.splice(index, 1);
        showNotification('Удалено из избранного', 'info', 1500);
    } else {
        favorites.push(objectId);
        showNotification('Добавлено в избранное', 'success', 1500);
    }
    
    saveFavorites();
    updateFavoriteButtons();
}

function updateFavoriteButtons() {
    const favoriteButtons = document.querySelectorAll('.favorite-btn');
    favoriteButtons.forEach(button => {
        const objectId = parseInt(button.dataset.objectId);
        if (favorites.includes(objectId)) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

function showFavorites() {
    if (!localStorage.getItem('token')) {
        showNotification('Войдите в систему для просмотра избранного', 'info');
        return;
    }
    
    if (favorites.length === 0) {
        showModal({
            title: 'Избранное пусто',
            message: 'Вы еще не добавили ни одного объекта в избранное. Нажмите на сердечко на любой карточке объекта, чтобы добавить его в избранное.',
            type: 'info',
            confirmText: 'Понятно'
        });
        return;
    }
    
    const favoriteObjects = objects.filter(obj => favorites.includes(obj.id));
    
    // Create favorites modal
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'favorites-modal-overlay';
    modalOverlay.innerHTML = `
        <div class="favorites-modal">
            <div class="favorites-modal-header">
                <h3>Избранное (${favoriteObjects.length})</h3>
                <button class="favorites-modal-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="favorites-modal-body">
                <div class="favorites-grid">
                    ${favoriteObjects.map(object => `
                        <div class="favorite-item" onclick="showObjectDetail(${object.id})">
                            <img src="${object.images && object.images.length > 0 ? object.images[0] : '/placeholder.svg'}" alt="${object.title}">
                            <div class="favorite-item-info">
                                <h4>${object.title}</h4>
                                <p class="favorite-location">
                                    <i class="fas fa-map-marker-alt"></i>
                                    ${object.location}
                                </p>
                                <p class="favorite-price">${formatPrice(object.price)} ₽</p>
                            </div>
                            <button class="favorite-remove-btn" onclick="removeFavorite(${object.id}, event)">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    // Add styles
    if (!document.querySelector('#favorites-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'favorites-modal-styles';
        style.textContent = `
            .favorites-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(10px);
                z-index: 20000;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: modalFadeIn 0.3s ease-out;
                padding: 20px;
            }
            
            .favorites-modal {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(20px);
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.3);
                max-width: 900px;
                width: 100%;
                max-height: 80vh;
                overflow: hidden;
            }
            
            .favorites-modal-header {
                padding: 25px 30px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(0, 0, 0, 0.1);
            }
            
            .favorites-modal-header h3 {
                margin: 0;
                font-family: 'Manrope', sans-serif;
                font-size: 1.4rem;
                font-weight: 700;
                color: #1f2937;
            }
            
            .favorites-modal-close {
                background: none;
                border: none;
                cursor: pointer;
                padding: 8px;
                border-radius: 8px;
                color: #6b7280;
                transition: all 0.2s ease;
                font-size: 1.1rem;
            }
            
            .favorites-modal-close:hover {
                background: rgba(0, 0, 0, 0.1);
                color: #374151;
            }
            
            .favorites-modal-body {
                padding: 30px;
                max-height: 60vh;
                overflow-y: auto;
            }
            
            .favorites-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                gap: 20px;
            }
            
            .favorite-item {
                background: rgba(255, 255, 255, 0.8);
                border-radius: 16px;
                overflow: hidden;
                cursor: pointer;
                transition: all 0.3s ease;
                position: relative;
                border: 1px solid rgba(0, 0, 0, 0.1);
            }
            
            .favorite-item:hover {
                transform: translateY(-4px);
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
            }
            
            .favorite-item img {
                width: 100%;
                height: 180px;
                object-fit: cover;
            }
            
            .favorite-item-info {
                padding: 20px;
            }
            
            .favorite-item h4 {
                font-family: 'Manrope', sans-serif;
                font-size: 1.1rem;
                font-weight: 600;
                margin-bottom: 8px;
                color: #1f2937;
            }
            
            .favorite-location {
                color: #6b7280;
                font-size: 0.9rem;
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .favorite-price {
                font-family: 'Manrope', sans-serif;
                font-size: 1.2rem;
                font-weight: 700;
                color: #2563eb;
                margin: 0;
            }
            
            .favorite-remove-btn {
                position: absolute;
                top: 10px;
                right: 10px;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                background: rgba(239, 68, 68, 0.9);
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                transition: all 0.3s ease;
                opacity: 0;
            }
            
            .favorite-item:hover .favorite-remove-btn {
                opacity: 1;
            }
            
            .favorite-remove-btn:hover {
                background: rgba(239, 68, 68, 1);
                transform: scale(1.1);
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(modalOverlay);
    
    // Event listeners
    modalOverlay.querySelector('.favorites-modal-close').addEventListener('click', () => {
        modalOverlay.remove();
    });
    
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    });
}

function removeFavorite(objectId, event) {
    event.preventDefault();
    event.stopPropagation();
    
    const index = favorites.indexOf(objectId);
    if (index > -1) {
        favorites.splice(index, 1);
        saveFavorites();
        updateFavoriteButtons();
        showNotification('Удалено из избранного', 'info', 1500);
        
        // Refresh favorites modal if open
        const favoritesModal = document.querySelector('.favorites-modal-overlay');
        if (favoritesModal) {
            favoritesModal.remove();
            setTimeout(() => showFavorites(), 100);
        }
    }
}

// Advanced filters functions
function toggleAdvancedFilters() {
    const dropdown = document.getElementById('advancedFiltersDropdown');
    const button = document.querySelector('.advanced-filter-btn');
    
    if (dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
        button.classList.remove('active');
    } else {
        dropdown.style.display = 'block';
        button.classList.add('active');
        
        // Position dropdown relative to button
        const buttonRect = button.getBoundingClientRect();
        dropdown.style.position = 'absolute';
        dropdown.style.top = (buttonRect.bottom + window.scrollY + 10) + 'px';
        dropdown.style.left = (buttonRect.left + window.scrollX) + 'px';
    }
}

function closeAdvancedFilters() {
    const dropdown = document.getElementById('advancedFiltersDropdown');
    const button = document.querySelector('.advanced-filter-btn');
    dropdown.style.display = 'none';
    button.classList.remove('active');
}

function resetAdvancedFilters() {
    document.getElementById('buildingTypeFilter').value = '';
    document.getElementById('bathroomTypeFilter').value = '';
    document.getElementById('balconyTypeFilter').value = '';
    document.getElementById('repairTypeFilter').value = '';
    document.getElementById('windowViewFilter').value = '';
    document.getElementById('parkingTypeFilter').value = '';
    document.getElementById('heatingTypeFilter').value = '';
    document.getElementById('gasSupplyFilter').value = '';
    
    advancedFilters = {};
    filterObjects();
    closeAdvancedFilters();
}

function applyAdvancedFilters() {
    advancedFilters = {
        buildingType: document.getElementById('buildingTypeFilter').value,
        bathroomType: document.getElementById('bathroomTypeFilter').value,
        balconyType: document.getElementById('balconyTypeFilter').value,
        repairType: document.getElementById('repairTypeFilter').value,
        windowView: document.getElementById('windowViewFilter').value,
        parkingType: document.getElementById('parkingTypeFilter').value,
        heatingType: document.getElementById('heatingTypeFilter').value,
        gasSupply: document.getElementById('gasSupplyFilter').value
    };
    
    closeAdvancedFilters();
    filterObjects();
    
    // Show notification about applied filters
    const appliedCount = Object.values(advancedFilters).filter(value => value).length;
    if (appliedCount > 0) {
        showNotification(`Применено ${appliedCount} дополнительных фильтров`, 'success', 2000);
    }
}

// Search functions - REMOVED since search was moved out of filters

// Delete account function
function deleteAccount() {
    if (!localStorage.getItem('token')) {
        showNotification('Войдите в систему', 'error');
        return;
    }
    
    showModal({
        title: 'Удаление аккаунта',
        message: 'Вы уверены, что хотите удалить свой аккаунт? Это действие нельзя отменить. Все ваши данные и заявки будут удалены навсегда.',
        type: 'warning',
        confirmText: 'Да, удалить',
        cancelText: 'Отмена',
        showCancel: true
    }).then(async (confirmed) => {
        if (confirmed) {
            // Ask for password confirmation
            const password = await showPrompt('Введите ваш пароль для подтверждения удаления:', 'Подтверждение пароля');
            
            if (!password) {
                showNotification('Удаление отменено', 'info');
                return;
            }
            
            try {
                const response = await fetch('/api/user/account', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('token')
                    },
                    body: JSON.stringify({ password })
                });
                
                if (response.ok) {
                    // Clear all user data
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    localStorage.removeItem('favorites');
                    
                    showModal({
                        title: 'Аккаунт удален',
                        message: 'Ваш аккаунт успешно удален. Мы сожалеем, что вы покидаете нас.',
                        type: 'success',
                        confirmText: 'Понятно'
                    }).then(() => {
                        window.location.reload();
                    });
                } else {
                    const error = await response.json();
                    showNotification('Ошибка: ' + error.error, 'error');
                }
            } catch (error) {
                console.error('Error deleting account:', error);
                showNotification('Произошла ошибка при удалении аккаунта', 'error');
            }
        }
    });
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadFavorites();
    
    // Load objects if on main page
    if (document.getElementById('objectsContainer')) {
        loadObjects();
        
        // Остановка автообновления при покидании страницы
        window.addEventListener('beforeunload', stopAutoRefresh);
        window.addEventListener('pagehide', stopAutoRefresh);
        
        // Add click handlers for object cards and navigation buttons
        document.addEventListener('click', function(e) {
            console.log('Click detected on:', e.target);
            
            // Handle navigation buttons first (highest priority)
            const navButton = e.target.closest('.nav-btn');
            if (navButton) {
                e.preventDefault();
                e.stopPropagation();
                
                const objectId = parseInt(navButton.dataset.objectId);
                const direction = parseInt(navButton.dataset.direction);
                
                console.log('Navigation button clicked:', objectId, direction);
                changeCardImage(objectId, direction);
                return false;
            }
            
            // Handle favorite button clicks
            const favoriteBtn = e.target.closest('.favorite-btn');
            if (favoriteBtn) {
                console.log('Favorite button clicked, preventing card navigation');
                return; // Let the onclick handler deal with it
            }
            
            // Handle object card clicks (but not if clicked on navigation or favorites)
            const objectCard = e.target.closest('.object-card');
            if (objectCard && !e.target.closest('.image-nav-buttons') && !e.target.closest('.favorite-btn')) {
                const objectId = parseInt(objectCard.dataset.objectId);
                console.log('Card clicked, navigating to object:', objectId);
                if (objectId && !isNaN(objectId)) {
                    showObjectDetail(objectId);
                } else {
                    console.error('Invalid object ID:', objectCard.dataset.objectId);
                }
            }
        });
    }
    
    // Handle auth form submission
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('authEmail').value;
            const phone = document.getElementById('authPhone').value;
            const password = document.getElementById('authPassword').value;
            const name = document.getElementById('authName').value;
            
            const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
            
            let data;
            if (authMode === 'login') {
                // For login, check which field is active and not empty
                const emailGroup = document.getElementById('emailGroup');
                const phoneGroup = document.getElementById('phoneGroup');
                
                if (emailGroup.style.display !== 'none' && email) {
                    data = { email, password };
                } else if (phoneGroup.style.display !== 'none' && phone) {
                    data = { phone, password };
                } else {
                    showNotification('Введите email или телефон для входа', 'error');
                    return;
                }
            } else {
                // For registration, include both email and phone
                data = { email, phone, password, name };
            }
            
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    localStorage.setItem('token', result.token);
                    localStorage.setItem('user', JSON.stringify(result.user));
                    
                    showUserMenu(result.user);
                    closeAuthModal();
                    
                    showModal({
                        title: authMode === 'login' ? 'Успешный вход' : 'Успешная регистрация',
                        message: authMode === 'login' ? 'Добро пожаловать!' : 'Аккаунт успешно создан!',
                        type: 'success',
                        confirmText: 'Продолжить'
                    });
                } else {
                    showNotification('Ошибка: ' + result.error, 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showNotification('Произошла ошибка при ' + (authMode === 'login' ? 'входе' : 'регистрации'), 'error');
            }
        });
    }
    
    // Handle request form submission
    initializeRequestForm();
    
    // Phone formatting
    const phoneInputs = document.querySelectorAll('input[type="tel"]');
    phoneInputs.forEach(input => {
        input.addEventListener('input', function() {
            formatPhoneNumber(this);
        });
    });
    
    // Special handling for auth phone input
    const authPhoneInput = document.getElementById('authPhone');
    if (authPhoneInput) {
        authPhoneInput.addEventListener('input', function() {
            formatPhoneNumber(this);
        });
    }
    
    // Close modals on click outside
    window.addEventListener('click', function(event) {
        const authModal = document.getElementById('authModal');
        const requestModal = document.getElementById('requestModal');
        const advancedFiltersDropdown = document.getElementById('advancedFiltersDropdown');
        
        if (event.target === authModal) {
            closeAuthModal();
        }
        if (event.target === requestModal) {
            closeRequestModal();
        }
        // Close advanced filters if clicked outside
        if (advancedFiltersDropdown && !event.target.closest('.advanced-filters-dropdown') && !event.target.closest('.advanced-filter-btn')) {
            closeAdvancedFilters();
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAuthModal();
            closeRequestModal();
            closeAdvancedFilters();
        }
    });
});

// Enhanced Modal with Form Support
window.showFormModal = function(options) {
    const {
        title = '',
        type = 'form',
        formFields = [],
        confirmText = 'Отправить',
        cancelText = 'Отмена'
    } = options;
    
    return new Promise((resolve) => {
        // Remove existing modal
        const existingModal = document.querySelector('.form-modal-overlay');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create form fields HTML
        const fieldsHTML = formFields.map(field => {
            switch(field.type) {
                case 'textarea':
                    return `
                        <div class="form-field">
                            <label for="${field.name}">${field.label}${field.required ? ' *' : ''}</label>
                            <textarea 
                                id="${field.name}" 
                                name="${field.name}" 
                                placeholder="${field.placeholder || ''}" 
                                ${field.required ? 'required' : ''}
                                rows="${field.rows || 3}"
                            >${field.value || ''}</textarea>
                        </div>
                    `;
                case 'tel':
                    return `
                        <div class="form-field">
                            <label for="${field.name}">${field.label}${field.required ? ' *' : ''}</label>
                            <input 
                                type="tel" 
                                id="${field.name}" 
                                name="${field.name}" 
                                value="${field.value || ''}"
                                placeholder="${field.placeholder || ''}" 
                                ${field.required ? 'required' : ''}
                            />
                        </div>
                    `;
                case 'email':
                    return `
                        <div class="form-field">
                            <label for="${field.name}">${field.label}${field.required ? ' *' : ''}</label>
                            <input 
                                type="email" 
                                id="${field.name}" 
                                name="${field.name}" 
                                value="${field.value || ''}"
                                placeholder="${field.placeholder || ''}" 
                                ${field.required ? 'required' : ''}
                            />
                        </div>
                    `;
                default:
                    return `
                        <div class="form-field">
                            <label for="${field.name}">${field.label}${field.required ? ' *' : ''}</label>
                            <input 
                                type="${field.type}" 
                                id="${field.name}" 
                                name="${field.name}" 
                                value="${field.value || ''}"
                                placeholder="${field.placeholder || ''}" 
                                ${field.required ? 'required' : ''}
                            />
                        </div>
                    `;
            }
        }).join('');
        
        // Create modal
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'form-modal-overlay';
        modalOverlay.innerHTML = `
            <div class="form-modal">
                <div class="form-modal-header">
                    <h3 class="form-modal-title">${title}</h3>
                    <button class="form-modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="form-modal-body">
                    <form class="modal-form" id="modalForm">
                        ${fieldsHTML}
                        <div class="form-error" style="display: none;"></div>
                    </form>
                </div>
                <div class="form-modal-footer">
                    <button type="button" class="form-btn form-btn-secondary">${cancelText}</button>
                    <button type="button" class="form-btn form-btn-primary">${confirmText}</button>
                </div>
            </div>
        `;
        
        // Add styles if not already added
        if (!document.querySelector('#form-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'form-modal-styles';
            style.textContent = `
                .form-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(10px);
                    z-index: 20000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: modalFadeIn 0.3s ease-out;
                    padding: 20px;
                }
                
                .form-modal {
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(20px);
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    max-width: 600px;
                    width: 100%;
                    max-height: 90vh;
                    overflow: hidden;
                    animation: modalSlideIn 0.3s ease-out;
                    transform: scale(1);
                }
                
                .form-modal-header {
                    padding: 25px 30px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                }
                
                .form-modal-title {
                    margin: 0;
                    font-family: 'Manrope', sans-serif;
                    font-size: 1.4rem;
                    font-weight: 700;
                    color: #1f2937;
                }
                
                .form-modal-close {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 8px;
                    color: #6b7280;
                    transition: all 0.2s ease;
                    font-size: 1.1rem;
                }
                
                .form-modal-close:hover {
                    background: rgba(0, 0, 0, 0.1);
                    color: #374151;
                }
                
                .form-modal-body {
                    padding: 30px;
                    max-height: 60vh;
                    overflow-y: auto;
                }
                
                .form-field {
                    margin-bottom: 20px;
                }
                
                .form-field label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: #374151;
                    font-size: 0.95rem;
                }
                
                .form-field input,
                .form-field textarea {
                    width: 100%;
                    padding: 12px 16px;
                    border: 2px solid rgba(0, 0, 0, 0.1);
                    border-radius: 10px;
                    font-size: 1rem;
                    transition: all 0.3s ease;
                    background: rgba(255, 255, 255, 0.8);
                    backdrop-filter: blur(10px);
                }
                
                .form-field input:focus,
                .form-field textarea:focus {
                    outline: none;
                    border-color: #667eea;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                }
                
                .form-field textarea {
                    resize: vertical;
                    min-height: 100px;
                }
                
                .form-error {
                    background: #fee2e2;
                    border: 1px solid #fecaca;
                    color: #dc2626;
                    padding: 12px 16px;
                    border-radius: 8px;
                    margin-top: 15px;
                    font-size: 0.9rem;
                }
                
                .form-modal-footer {
                    padding: 20px 30px 30px;
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    border-top: 1px solid rgba(0, 0, 0, 0.1);
                }
                
                .form-btn {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 10px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    min-width: 120px;
                }
                
                .form-btn-primary {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                }
                
                .form-btn-primary:hover {
                    background: linear-gradient(135deg, #5a67d8, #6b46c1);
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
                }
                
                .form-btn-secondary {
                    background: rgba(107, 114, 128, 0.1);
                    color: #6b7280;
                    border: 2px solid rgba(107, 114, 128, 0.2);
                }
                
                .form-btn-secondary:hover {
                    background: rgba(107, 114, 128, 0.2);
                    border-color: rgba(107, 114, 128, 0.3);
                }
                
                @keyframes modalFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes modalSlideIn {
                    from { 
                        opacity: 0;
                        transform: translateY(-30px) scale(0.95);
                    }
                    to { 
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(modalOverlay);
        
        // Get elements
        const closeBtn = modalOverlay.querySelector('.form-modal-close');
        const cancelBtn = modalOverlay.querySelector('.form-btn-secondary');
        const confirmBtn = modalOverlay.querySelector('.form-btn-primary');
        const form = modalOverlay.querySelector('#modalForm');
        const errorDiv = modalOverlay.querySelector('.form-error');
        
        // Close modal function
        const closeModal = (result = null) => {
            modalOverlay.classList.add('closing');
            setTimeout(() => {
                if (modalOverlay.parentNode) {
                    modalOverlay.remove();
                }
                resolve(result);
            }, 200);
        };
        
        // Event listeners
        closeBtn.addEventListener('click', () => closeModal());
        cancelBtn.addEventListener('click', () => closeModal());
        
        confirmBtn.addEventListener('click', () => {
            // Validate and get form data
            const formData = new FormData(form);
            const data = {};
            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }
            
            // Simple validation
            const requiredFields = formFields.filter(f => f.required);
            let valid = true;
            let errorMessage = '';
            
            for (let field of requiredFields) {
                if (!data[field.name] || !data[field.name].trim()) {
                    valid = false;
                    errorMessage = `Поле "${field.label}" обязательно для заполнения`;
                    break;
                }
            }
            
            if (valid) {
                closeModal(data);
            } else {
                errorDiv.textContent = errorMessage;
                errorDiv.style.display = 'block';
            }
        });
        
        // Click outside to close
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
        
        // ESC key
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handleKeydown);
                closeModal();
            }
        };
        document.addEventListener('keydown', handleKeydown);
        
        // Phone formatting for tel inputs
        const phoneInputs = modalOverlay.querySelectorAll('input[type="tel"]');
        phoneInputs.forEach(input => {
            input.addEventListener('input', function(e) {
                formatPhoneNumber(e.target);
            });
        });
        
        // Auto-focus first input
        setTimeout(() => {
            const firstInput = modalOverlay.querySelector('input, textarea');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);
    });
};