const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your_jwt_secret_here';

// Настройки базы данных Supabase
const pool = new Pool({
    host: 'aws-0-eu-north-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.swdwzmxokabfddfxdrfj',
    password: 'aram212001',
    ssl: {
        rejectUnauthorized: false
    }
});

// Создаем папку uploads если её нет
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname))
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB лимит
    },
    fileFilter: function (req, file, cb) {
        // Проверяем что файл - изображение
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Только изображения разрешены!'), false);
        }
    }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware для проверки токена
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        req.user = user;
        next();
    });
};

// Регистрация пользователя
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, phone, name } = req.body;

        // Проверяем обязательные поля
        if (!email || !password || !phone || !name) {
            return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
        }

        // Проверяем, существует ли пользователь с таким email
        const existingUserByEmail = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUserByEmail.rows.length > 0) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }

        // Проверяем, существует ли пользователь с таким телефоном
        const existingUserByPhone = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
        if (existingUserByPhone.rows.length > 0) {
            return res.status(400).json({ error: 'Пользователь с таким телефоном уже существует' });
        }

        // Хешируем пароль
        const hashedPassword = await bcrypt.hash(password, 10);

        // Создаем пользователя
        const result = await pool.query(
            'INSERT INTO users (email, password, phone, full_name) VALUES ($1, $2, $3, $4) RETURNING id, email, phone, full_name, role',
            [email, hashedPassword, phone, name]
        );

        const user = result.rows[0];
        const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET);

        res.json({
            message: 'Пользователь успешно зарегистрирован',
            token,
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
                name: user.full_name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ error: 'Ошибка сервера при регистрации' });
    }
});

// Вход пользователя
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Проверяем что данные переданы
        if (!email || !password) {
            return res.status(400).json({ error: 'Email/телефон и пароль обязательны' });
        }

        // Ищем пользователя по email или телефону
        let result;
        if (email.includes('@')) {
            // Если содержит @, ищем по email
            result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        } else {
            // Иначе ищем по телефону - пробуем несколько форматов
            let phoneFormats = [email];
            
            // Нормализуем номер
            let cleanPhone = email.replace(/\D/g, '');
            if (cleanPhone.startsWith('8') && cleanPhone.length === 11) {
                cleanPhone = '7' + cleanPhone.substring(1);
            } else if (cleanPhone.startsWith('9') && cleanPhone.length === 10) {
                cleanPhone = '7' + cleanPhone;
            }
            
            // Добавляем разные варианты формата
            phoneFormats.push('+' + cleanPhone);
            phoneFormats.push(cleanPhone);
            if (cleanPhone.startsWith('7')) {
                phoneFormats.push('8' + cleanPhone.substring(1));
                phoneFormats.push('+7' + cleanPhone.substring(1));
            }
            
            // Убираем дубликаты
            phoneFormats = [...new Set(phoneFormats)];
            console.log('Searching for phone formats:', phoneFormats);
            
            // Ищем по всем форматам
            for (let format of phoneFormats) {
                result = await pool.query('SELECT * FROM users WHERE phone = $1', [format]);
                if (result.rows.length > 0) {
                    console.log('Found user with phone format:', format);
                    break;
                }
            }
        }
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Неверный email/телефон или пароль' });
        }

        const user = result.rows[0];

        // Проверяем пароль
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Неверный email/телефон или пароль' });
        }

        const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET);

        res.json({
            message: 'Успешный вход',
            token,
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
                name: user.full_name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({ error: 'Ошибка сервера при входе' });
    }
});

// Получить время последнего обновления объектов
app.get('/api/objects/last-update', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT MAX(updated_at) as last_update FROM objects WHERE is_active = true'
        );
        
        const lastUpdate = result.rows[0].last_update || new Date();
        
        res.json({
            lastUpdate: lastUpdate,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Ошибка получения времени обновления:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение всех объектов
app.get('/api/objects', async (req, res) => {
    try {
        const { type, minPrice, maxPrice, location, sort } = req.query;
        
        let query = 'SELECT * FROM objects WHERE status = \'active\'';
        let params = [];
        let paramIndex = 1;

        // Фильтры
        if (type) {
            query += ` AND type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }

        if (minPrice) {
            query += ` AND price >= $${paramIndex}`;
            params.push(minPrice);
            paramIndex++;
        }

        if (maxPrice) {
            query += ` AND price <= $${paramIndex}`;
            params.push(maxPrice);
            paramIndex++;
        }

        if (location) {
            query += ` AND location ILIKE $${paramIndex}`;
            params.push(`%${location}%`);
            paramIndex++;
        }

        // Сортировка
        if (sort === 'price_asc') {
            query += ' ORDER BY price ASC';
        } else if (sort === 'price_desc') {
            query += ' ORDER BY price DESC';
        } else if (sort === 'date_desc') {
            query += ' ORDER BY created_at DESC';
        } else {
            query += ' ORDER BY created_at DESC';
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Ошибка получения объектов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение объекта по ID
app.get('/api/objects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM objects WHERE id = $1 AND status = \'active\'', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Объект не найден' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка получения объекта:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создание заявки
app.post('/api/requests', authenticateToken, async (req, res) => {
    try {
        const { object_id, message, phone, email, name } = req.body;
        const userId = req.user.userId;

        // Получаем данные пользователя если имя не передано
        let userName = name;
        if (!userName) {
            try {
                const userResult = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
                userName = userResult.rows[0]?.name || 'Пользователь';
            } catch (error) {
                userName = 'Пользователь';
            }
        }

        const result = await pool.query(
            'INSERT INTO requests (user_id, object_id, name, phone, email, message) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [userId, object_id, userName, phone, email, message]
        );

        res.json({
            message: 'Заявка успешно отправлена',
            request: result.rows[0]
        });
    } catch (error) {
        console.error('Ошибка создания заявки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение заявок пользователя
app.get('/api/requests/my', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const result = await pool.query(
            'SELECT * FROM requests WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Ошибка получения заявок:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление профиля пользователя
app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name, email, phone } = req.body;
        
        if (!name || !email) {
            return res.status(400).json({ error: 'Имя и email обязательны' });
        }
        
        // Проверяем, не занят ли email другим пользователем
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1 AND id != $2',
            [email, userId]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }
        
        const result = await pool.query(
            'UPDATE users SET full_name = $1, email = $2, phone = $3 WHERE id = $4 RETURNING id, full_name as name, email, phone, role, created_at',
            [name, email, phone, userId]
        );
        
        res.json({
            message: 'Профиль успешно обновлен',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Ошибка обновления профиля:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удаление своей заявки (пользователь)
app.delete('/api/requests/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        const result = await pool.query('DELETE FROM requests WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Заявка не найдена или не принадлежит вам' });
        }

        res.json({ message: 'Заявка успешно удалена' });
    } catch (error) {
        console.error('Ошибка удаления заявки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удаление аккаунта пользователя
app.delete('/api/user/account', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Для удаления аккаунта необходимо ввести пароль' });
        }

        // Получаем пользователя и проверяем пароль
        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const user = userResult.rows[0];
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Неверный пароль' });
        }

        // Удаляем связанные данные пользователя (заявки)
        await pool.query('DELETE FROM requests WHERE user_id = $1', [userId]);
        
        // Удаляем пользователя
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);

        res.json({ message: 'Аккаунт успешно удален' });
    } catch (error) {
        console.error('Ошибка удаления аккаунта:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение заявок пользователя
app.get('/api/user/requests', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const result = await pool.query(
            `SELECT r.*, o.title as object_title, o.price as object_price, o.location as object_location 
             FROM requests r 
             JOIN objects o ON r.object_id = o.id 
             WHERE r.user_id = $1 
             ORDER BY r.created_at DESC`,
            [userId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Ошибка получения заявок:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ADMIN ROUTES

// Получение всех объектов (админ)
app.get('/api/admin/objects', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const result = await pool.query('SELECT * FROM objects ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Ошибка получения объектов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создание объекта (админ)
app.post('/api/admin/objects', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const {
            title, description, price, location, type, area, rooms,
            floor, totalFloors, yearBuilt, images, features, contactPhone, contactEmail
        } = req.body;

        const result = await pool.query(
            `INSERT INTO objects (title, description, price, location, type, area, rooms, floor, 
             total_floors, year_built, images, features, contact_phone, contact_email) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
            [title, description, price, location, type, area, rooms, floor, totalFloors, 
             yearBuilt, images, features, contactPhone, contactEmail]
        );

        res.json({
            message: 'Объект успешно создан',
            object: result.rows[0]
        });
    } catch (error) {
        console.error('Ошибка создания объекта:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление объекта (админ)
app.put('/api/admin/objects/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const { id } = req.params;
        const {
            title, description, price, location, type, area, rooms,
            floor, totalFloors, yearBuilt, images, features, contactPhone, contactEmail, isActive
        } = req.body;

        const result = await pool.query(
            `UPDATE objects SET title = $1, description = $2, price = $3, location = $4, type = $5, 
             area = $6, rooms = $7, floor = $8, total_floors = $9, year_built = $10, images = $11, 
             features = $12, contact_phone = $13, contact_email = $14, is_active = $15, updated_at = CURRENT_TIMESTAMP
             WHERE id = $16 RETURNING *`,
            [title, description, price, location, type, area, rooms, floor, totalFloors, 
             yearBuilt, images, features, contactPhone, contactEmail, isActive, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Объект не найден' });
        }

        res.json({
            message: 'Объект успешно обновлен',
            object: result.rows[0]
        });
    } catch (error) {
        console.error('Ошибка обновления объекта:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удаление объекта (админ)
app.delete('/api/admin/objects/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const { id } = req.params;
        const result = await pool.query('DELETE FROM objects WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Объект не найден' });
        }

        res.json({ message: 'Объект успешно удален' });
    } catch (error) {
        console.error('Ошибка удаления объекта:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение всех заявок (админ)
app.get('/api/admin/requests', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const result = await pool.query(
            `SELECT r.*, u.email as user_email, u.full_name as user_name, 
             o.title as object_title, o.price as object_price, o.location as object_location
             FROM requests r 
             LEFT JOIN users u ON r.user_id = u.id 
             LEFT JOIN objects o ON r.object_id = o.id 
             ORDER BY r.created_at DESC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Ошибка получения заявок:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление статуса заявки (админ)
app.put('/api/admin/requests/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const { id } = req.params;
        const { status } = req.body;

        const result = await pool.query(
            'UPDATE requests SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }

        res.json({
            message: 'Статус заявки обновлен',
            request: result.rows[0]
        });
    } catch (error) {
        console.error('Ошибка обновления заявки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удаление заявки (админ)
app.delete('/api/admin/requests/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const { id } = req.params;
        const result = await pool.query('DELETE FROM requests WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }

        res.json({ message: 'Заявка успешно удалена' });
    } catch (error) {
        console.error('Ошибка удаления заявки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление статуса заявки (админ)
app.patch('/api/admin/requests/:id/status', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const { id } = req.params;
        const { status } = req.body;

        const result = await pool.query(
            'UPDATE requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }

        res.json({
            message: 'Статус заявки обновлен',
            request: result.rows[0]
        });
    } catch (error) {
        console.error('Ошибка обновления статуса заявки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Статистика для админ панели
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const [objectsCount, requestsCount, usersCount] = await Promise.all([
            pool.query('SELECT COUNT(*) as count FROM objects WHERE is_active = true'),
            pool.query('SELECT COUNT(*) as count FROM requests'),
            pool.query('SELECT COUNT(*) as count FROM users WHERE role = $1', ['user'])
        ]);

        const recentRequests = await pool.query(
            `SELECT r.*, u.email as user_email, o.title as object_title 
             FROM requests r 
             LEFT JOIN users u ON r.user_id = u.id 
             LEFT JOIN objects o ON r.object_id = o.id 
             ORDER BY r.created_at DESC LIMIT 5`
        );

        res.json({
            totalObjects: parseInt(objectsCount.rows[0].count),
            totalRequests: parseInt(requestsCount.rows[0].count),
            totalUsers: parseInt(usersCount.rows[0].count),
            recentRequests: recentRequests.rows
        });
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============ ADMIN OBJECTS MANAGEMENT ============

// Загрузка изображений
app.post('/api/admin/upload', authenticateToken, upload.array('images', 10), async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'Файлы не выбраны' });
        }

        const fileUrls = files.map(file => `/uploads/${file.filename}`);
        res.json({ urls: fileUrls });
    } catch (error) {
        console.error('Ошибка загрузки файлов:', error);
        res.status(500).json({ error: 'Ошибка загрузки файлов' });
    }
});

// Получение всех объектов для админа
app.get('/api/admin/objects', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const result = await pool.query('SELECT * FROM objects ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Ошибка получения объектов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создание нового объекта
app.post('/api/admin/objects', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const {
            title, description, price, location, type, area, rooms, floor, max_floor,
            images, nearest_metro, metro_distance_minutes,
            metro_distance_km, city_center_car_minutes, city_center_walk_minutes,
            city_center_distance_km, status = 'active',
            // Новые характеристики
            living_area, kitchen_area, building_year, building_type, apartment_type,
            bathroom_count, bathroom_type, balcony_count, balcony_type, repair_type,
            window_view, parking_type, heating_type, gas_supply
        } = req.body;

        if (!title || !price || !location || !type) {
            return res.status(400).json({ error: 'Заполните обязательные поля: название, цена, адрес, тип' });
        }

        const result = await pool.query(`
            INSERT INTO objects (
                title, description, price, location, type, area, rooms, floor, max_floor,
                images, nearest_metro, metro_distance_minutes,
                metro_distance_km, city_center_car_minutes, city_center_walk_minutes,
                city_center_distance_km, status,
                living_area, kitchen_area, building_year, building_type, apartment_type,
                bathroom_count, bathroom_type, balcony_count, balcony_type, repair_type,
                window_view, parking_type, heating_type, gas_supply
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
            RETURNING *
        `, [
            title, description, price, location, type, area, rooms, floor, max_floor,
            images || [], nearest_metro, metro_distance_minutes,
            metro_distance_km, city_center_car_minutes, city_center_walk_minutes,
            city_center_distance_km, status,
            living_area, kitchen_area, building_year, building_type, apartment_type,
            bathroom_count, bathroom_type, balcony_count, balcony_type, repair_type,
            window_view, parking_type, heating_type, gas_supply
        ]);

        res.json({
            message: 'Объект успешно создан',
            object: result.rows[0]
        });
    } catch (error) {
        console.error('Ошибка создания объекта:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление объекта
app.put('/api/admin/objects/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const { id } = req.params;
        const {
            title, description, price, location, type, area, rooms, floor, max_floor,
            images, nearest_metro, metro_distance_minutes,
            metro_distance_km, city_center_car_minutes, city_center_walk_minutes,
            city_center_distance_km, status,
            // Новые характеристики
            living_area, kitchen_area, building_year, building_type, apartment_type,
            bathroom_count, bathroom_type, balcony_count, balcony_type, repair_type,
            window_view, parking_type, heating_type, gas_supply
        } = req.body;

        const result = await pool.query(`
            UPDATE objects SET
                title = $1, description = $2, price = $3, location = $4, type = $5,
                area = $6, rooms = $7, floor = $8, max_floor = $9, images = $10,
                nearest_metro = $11, metro_distance_minutes = $12,
                metro_distance_km = $13, city_center_car_minutes = $14, city_center_walk_minutes = $15,
                city_center_distance_km = $16, status = $17,
                living_area = $18, kitchen_area = $19, building_year = $20, building_type = $21,
                apartment_type = $22, bathroom_count = $23, bathroom_type = $24, balcony_count = $25,
                balcony_type = $26, repair_type = $27, window_view = $28, parking_type = $29,
                heating_type = $30, gas_supply = $31, updated_at = CURRENT_TIMESTAMP
            WHERE id = $32
            RETURNING *
        `, [
            title, description, price, location, type, area, rooms, floor, max_floor,
            images || [], nearest_metro, metro_distance_minutes,
            metro_distance_km, city_center_car_minutes, city_center_walk_minutes,
            city_center_distance_km, status,
            living_area, kitchen_area, building_year, building_type, apartment_type,
            bathroom_count, bathroom_type, balcony_count, balcony_type, repair_type,
            window_view, parking_type, heating_type, gas_supply, id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Объект не найден' });
        }

        res.json({
            message: 'Объект успешно обновлен',
            object: result.rows[0]
        });
    } catch (error) {
        console.error('Ошибка обновления объекта:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Изменение статуса объекта
app.patch('/api/admin/objects/:id/status', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const { id } = req.params;
        const { status } = req.body;

        const result = await pool.query(
            'UPDATE objects SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Объект не найден' });
        }

        res.json({
            message: 'Статус объекта обновлен',
            object: result.rows[0]
        });
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удаление объекта
app.delete('/api/admin/objects/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const { id } = req.params;
        
        // Получаем объект для удаления файлов изображений
        const objectResult = await pool.query('SELECT images FROM objects WHERE id = $1', [id]);
        
        if (objectResult.rows.length > 0) {
            const images = objectResult.rows[0].images;
            
            // Удаляем файлы изображений
            if (images && Array.isArray(images)) {
                images.forEach(imagePath => {
                    if (imagePath.startsWith('/uploads/')) {
                        const fullPath = path.join(uploadsDir, path.basename(imagePath));
                        if (fs.existsSync(fullPath)) {
                            fs.unlinkSync(fullPath);
                        }
                    }
                });
            }
        }

        const result = await pool.query('DELETE FROM objects WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Объект не найден' });
        }

        res.json({ message: 'Объект успешно удален' });
    } catch (error) {
        console.error('Ошибка удаления объекта:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Создание таблиц если их нет
async function createTablesIfNotExists() {
    try {
        // Создаем таблицу пользователей
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                phone VARCHAR(20) UNIQUE,
                full_name VARCHAR(255),
                role VARCHAR(50) DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('📋 Таблица users проверена/создана');
        
        // Создаем таблицу объектов недвижимости
        await pool.query(`
            CREATE TABLE IF NOT EXISTS objects (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(12, 2) NOT NULL,
                location VARCHAR(255) NOT NULL,
                type VARCHAR(100) NOT NULL,
                area DECIMAL(8, 2),
                rooms INTEGER,
                floor INTEGER,
                max_floor INTEGER,
                images TEXT[],
                nearest_metro VARCHAR(255),
                metro_distance_minutes INTEGER,
                metro_distance_km DECIMAL(5, 2),
                city_center_car_minutes INTEGER,
                city_center_walk_minutes INTEGER,
                city_center_distance_km DECIMAL(5, 2),
                status VARCHAR(50) DEFAULT 'active',
                -- Новые характеристики объекта
                living_area DECIMAL(8, 2),
                kitchen_area DECIMAL(8, 2),
                building_year INTEGER,
                building_type VARCHAR(100),
                apartment_type VARCHAR(100),
                bathroom_count INTEGER,
                bathroom_type VARCHAR(100),
                balcony_count INTEGER,
                balcony_type VARCHAR(100),
                repair_type VARCHAR(100),
                window_view VARCHAR(100),
                parking_type VARCHAR(100),
                heating_type VARCHAR(100),
                gas_supply VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // Добавляем новые столбцы к существующей таблице (если они еще не существуют)
        const alterColumns = [
            'ALTER TABLE objects ADD COLUMN IF NOT EXISTS living_area DECIMAL(8, 2)',
            'ALTER TABLE objects ADD COLUMN IF NOT EXISTS kitchen_area DECIMAL(8, 2)',
            'ALTER TABLE objects ADD COLUMN IF NOT EXISTS building_year INTEGER',
            'ALTER TABLE objects ADD COLUMN IF NOT EXISTS building_type VARCHAR(100)',
            'ALTER TABLE objects ADD COLUMN IF NOT EXISTS apartment_type VARCHAR(100)',
            'ALTER TABLE objects ADD COLUMN IF NOT EXISTS bathroom_count INTEGER',
            'ALTER TABLE objects ADD COLUMN IF NOT EXISTS bathroom_type VARCHAR(100)',
            'ALTER TABLE objects ADD COLUMN IF NOT EXISTS balcony_count INTEGER',
            'ALTER TABLE objects ADD COLUMN IF NOT EXISTS balcony_type VARCHAR(100)',
            'ALTER TABLE objects ADD COLUMN IF NOT EXISTS repair_type VARCHAR(100)',
            'ALTER TABLE objects ADD COLUMN IF NOT EXISTS window_view VARCHAR(100)',
            'ALTER TABLE objects ADD COLUMN IF NOT EXISTS parking_type VARCHAR(100)',
            'ALTER TABLE objects ADD COLUMN IF NOT EXISTS heating_type VARCHAR(100)',
            'ALTER TABLE objects ADD COLUMN IF NOT EXISTS gas_supply VARCHAR(100)'
        ];
        
        for (const query of alterColumns) {
            try {
                await pool.query(query);
            } catch (error) {
                // Игнорируем ошибки если столбец уже существует
            }
        }
        
        // Удаляем столбцы координат
        try {
            await pool.query('ALTER TABLE objects DROP COLUMN IF EXISTS latitude');
            await pool.query('ALTER TABLE objects DROP COLUMN IF EXISTS longitude');
        } catch (error) {
            // Игнорируем ошибки если столбцы уже удалены
        }
        
        // Добавляем столбец status если его нет
        try {
            await pool.query('ALTER TABLE objects ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'active\'');
            // Обновляем существующие записи без статуса
            await pool.query('UPDATE objects SET status = \'active\' WHERE status IS NULL');
            console.log('✅ Столбец status добавлен/обновлен в objects');
        } catch (error) {
            console.log('ℹ️ Столбец status уже существует в objects');
        }
        
        // Миграция данных с is_active на status
        try {
            // Проверяем существование столбца is_active
            const isActiveExists = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='objects' AND column_name='is_active'
            `);
            
            if (isActiveExists.rows.length > 0) {
                // Конвертируем is_active в status
                await pool.query(`
                    UPDATE objects 
                    SET status = CASE 
                        WHEN is_active = true THEN 'active' 
                        ELSE 'inactive' 
                    END 
                    WHERE status IS NULL
                `);
                
                // Удаляем старый столбец
                await pool.query('ALTER TABLE objects DROP COLUMN IF EXISTS is_active');
            }
        } catch (error) {
            // Игнорируем ошибки миграции
        }
        console.log('🏠 Таблица objects проверена/создана');
        
        // Создаем тестовые объекты с конкретными адресами если их нет
        const existingObjects = await pool.query('SELECT COUNT(*) FROM objects');
        if (parseInt(existingObjects.rows[0].count) === 0) {
            console.log('📋 Создание тестовых объектов...');
            
            const testObjects = [
                {
                    title: 'Уютная 2-комнатная квартира в центре',
                    description: 'Отличная квартира в историческом центре города. Высокие потолки, большие окна, рядом с парком. Идеально подходит для молодой семьи.',
                    price: 8500000,
                    location: 'ул. Тверская, д. 15, кв. 42',
                    type: 'Квартира',
                    area: 65.5,
                    living_area: 45.8,
                    kitchen_area: 9.5,
                    rooms: 2,
                    floor: 3,
                    max_floor: 5,
                    building_year: 1985,
                    building_type: 'Кирпичный',
                    apartment_type: 'Вторичка',
                    bathroom_count: 1,
                    bathroom_type: 'Совмещенный',
                    balcony_count: 1,
                    balcony_type: 'Балкон',
                    repair_type: 'Косметический',
                    window_view: 'На улицу',
                    parking_type: 'Во дворе',
                    heating_type: 'Центральное',
                    gas_supply: 'Центральное',
                    nearest_metro: 'Тверская',
                    metro_distance_minutes: 3,
                    images: ['/api/placeholder/600/400']
                },
                {
                    title: 'Студия в современном доме',
                    description: 'Современная студия в новом жилом комплексе. Панорамные окна, качественная отделка, закрытая территория.',
                    price: 4200000,
                    location: 'Residential Park "Сады", корп. 2, кв. 156',
                    type: 'Студия',
                    area: 28.3,
                    living_area: 19.8,
                    kitchen_area: 6.0,
                    rooms: 1,
                    floor: 12,
                    max_floor: 25,
                    building_year: 2020,
                    building_type: 'Монолитный',
                    apartment_type: 'Новостройка',
                    bathroom_count: 1,
                    bathroom_type: 'Совмещенный',
                    balcony_count: 1,
                    balcony_type: 'Лоджия',
                    repair_type: 'Евроремонт',
                    window_view: 'На парк',
                    parking_type: 'Подземная',
                    heating_type: 'Автономное',
                    gas_supply: 'Центральное',
                    nearest_metro: 'Парк культуры',
                    metro_distance_minutes: 8,
                    images: ['/api/placeholder/600/400']
                },
                {
                    title: 'Просторная 3-комнатная с видом на реку',
                    description: 'Элитная квартира с потрясающим видом на Москву-реку. Дизайнерский ремонт, премиальная отделка, охраняемый комплекс.',
                    price: 15700000,
                    location: 'Котельническая наб., д. 1/15, стр. 1, кв. 89',
                    type: 'Квартира',
                    area: 95.2,
                    living_area: 66.6,
                    kitchen_area: 12.5,
                    rooms: 3,
                    floor: 8,
                    max_floor: 12,
                    building_year: 2010,
                    building_type: 'Монолитный',
                    apartment_type: 'Вторичка',
                    bathroom_count: 2,
                    bathroom_type: 'Раздельный',
                    balcony_count: 2,
                    balcony_type: 'Балкон и лоджия',
                    repair_type: 'Дизайнерский',
                    window_view: 'На водоем',
                    parking_type: 'Подземная',
                    heating_type: 'Центральное',
                    gas_supply: 'Центральное',
                    nearest_metro: 'Таганская',
                    metro_distance_minutes: 5,
                    images: ['/api/placeholder/600/400']
                },
                {
                    title: 'Компактная 1-комнатная в спальном районе',
                    description: 'Уютная однокомнатная квартира в тихом спальном районе. Хорошая транспортная доступность, развитая инфраструктура.',
                    price: 5800000,
                    location: 'Варшавское ш., д. 42, корп. 3, кв. 127',
                    type: 'Квартира',
                    area: 38.7,
                    living_area: 18.2,
                    kitchen_area: 7.8,
                    rooms: 1,
                    floor: 6,
                    max_floor: 9,
                    building_year: 1975,
                    building_type: 'Панельный',
                    apartment_type: 'Вторичка',
                    bathroom_count: 1,
                    bathroom_type: 'Совмещенный',
                    balcony_count: 1,
                    balcony_type: 'Балкон',
                    repair_type: 'Без ремонта',
                    window_view: 'Во двор',
                    parking_type: 'Наземная',
                    heating_type: 'Центральное',
                    gas_supply: 'Центральное',
                    nearest_metro: 'Тульская',
                    metro_distance_minutes: 12,
                    images: ['/api/placeholder/600/400']
                }
            ];
            
            for (const obj of testObjects) {
                try {
                    await pool.query(`
                        INSERT INTO objects (
                            title, description, price, location, type, area, living_area, kitchen_area,
                            rooms, floor, max_floor, building_year, building_type, apartment_type,
                            bathroom_count, bathroom_type, balcony_count, balcony_type, repair_type,
                            window_view, parking_type, heating_type, gas_supply, nearest_metro,
                            metro_distance_minutes, images, status
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, 'active')
                    `, [
                        obj.title, obj.description, obj.price, obj.location, obj.type, obj.area,
                        obj.living_area, obj.kitchen_area, obj.rooms, obj.floor, obj.max_floor,
                        obj.building_year, obj.building_type, obj.apartment_type, obj.bathroom_count,
                        obj.bathroom_type, obj.balcony_count, obj.balcony_type, obj.repair_type,
                        obj.window_view, obj.parking_type, obj.heating_type, obj.gas_supply,
                        obj.nearest_metro, obj.metro_distance_minutes, obj.images
                    ]);
                } catch (error) {
                    console.error('Ошибка создания тестового объекта:', error);
                }
            }
            
            console.log('✅ Создано тестовых объектов: ' + testObjects.length);
        }
        
        // Создаем таблицу заявок
        await pool.query(`
            CREATE TABLE IF NOT EXISTS requests (
                id SERIAL PRIMARY KEY,
                object_id INTEGER REFERENCES objects(id),
                user_id INTEGER REFERENCES users(id),
                name VARCHAR(255),
                phone VARCHAR(20) NOT NULL,
                email VARCHAR(255),
                message TEXT,
                status VARCHAR(50) DEFAULT 'new',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // Добавляем столбцы которых может не быть (для существующих таблиц)
        const addRequestColumns = [
            'ALTER TABLE requests ADD COLUMN IF NOT EXISTS name VARCHAR(255)',
            'ALTER TABLE requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
        ];
        
        for (const query of addRequestColumns) {
            try {
                await pool.query(query);
            } catch (error) {
                // Игнорируем ошибки если столбцы уже существуют
            }
        }
        console.log('📝 Таблица requests проверена/создана');
        
        // Удаляем старого админа если есть
        await pool.query("DELETE FROM users WHERE email = 'admin@cityar.ru'");
        
        // Проверяем/создаем основного администратора
        const adminCheck = await pool.query("SELECT id FROM users WHERE email = 'aramikkhojayan@gmail.com'");
        if (adminCheck.rows.length === 0) {
            const hashedPassword = await bcrypt.hash('aram212001', 10);
            await pool.query(
                "INSERT INTO users (email, password, full_name, role) VALUES ($1, $2, $3, $4)",
                ['aramikkhojayan@gmail.com', hashedPassword, 'Арам Хожаян', 'admin']
            );
            console.log('👤 Главный администратор создан: aramikkhojayan@gmail.com');
        } else {
            // Обновляем роль и пароль существующего пользователя
            const hashedPassword = await bcrypt.hash('aram212001', 10);
            await pool.query("UPDATE users SET role = 'admin', password = $1 WHERE email = 'aramikkhojayan@gmail.com'", [hashedPassword]);
            console.log('👤 Пользователь aramikkhojayan@gmail.com назначен администратором с новым паролем');
        }
        
        // Добавляем тестовые данные объектов если таблица пустая
        const objectsCount = await pool.query('SELECT COUNT(*) FROM objects');
        if (parseInt(objectsCount.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO objects (title, description, price, location, type, area, rooms, floor, max_floor, images, latitude, longitude, nearest_metro, metro_distance_minutes, metro_distance_km, city_center_car_minutes, city_center_walk_minutes, city_center_distance_km) VALUES
                ('Современная квартира в центре', 'Уютная двухкомнатная квартира с современным ремонтом и прекрасным видом на город. Расположена в тихом районе с развитой инфраструктурой.', 12500000, 'ул. Таганская, 15', 'Квартира', 65.5, 2, 5, 12, ARRAY['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800', 'https://images.unsplash.com/photo-1560449752-96285b737e83?w=800', 'https://images.unsplash.com/photo-1561501900-3701fa6a0864?w=800'], 55.758570, 37.644895, 'Таганская', 5, 0.4, 15, 45, 3.2),
                ('Стильная студия', 'Современная студия в новостройке с панорамными окнами и качественной отделкой. Идеальный вариант для молодых специалистов.', 8500000, 'Павелецкая набережная, 7к1', 'Студия', 42.0, 1, 15, 25, ARRAY['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800', 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800'], 55.742020, 37.653105, 'Павелецкая', 8, 0.6, 12, 35, 2.8),
                ('Элитная квартира с видом', 'Роскошная трехкомнатная квартира в историческом центре с видом на парк. Высокие потолки, антикварная мебель.', 35000000, 'ул. Остоженка, 24', 'Квартира', 120.0, 3, 3, 5, ARRAY['https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800', 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=800'], 55.755826, 37.617298, 'Кропоткинская', 3, 0.2, 8, 20, 1.5),
                ('Просторная квартира для семьи', 'Комфортная четырехкомнатная квартира в спокойном районе. Рядом школы, детские сады и парки для прогулок.', 18500000, 'ул. Сокольническая, 45', 'Квартира', 95.0, 4, 8, 16, ARRAY['https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800', 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800'], 55.764200, 37.565050, 'Сокольники', 12, 0.9, 25, 65, 5.2),
                ('Загородный дом', 'Уютный дом с участком в экологически чистом районе. Идеально для семей, ценящих природу и спокойствие.', 28000000, 'пос. Митино, 15', 'Дом', 180.0, 5, 2, 2, ARRAY['https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800'], 55.831903, 37.411850, 'Митино', 15, 1.2, 45, 120, 18.5),
                ('Уютная однокомнатная квартира', 'Компактная квартира в историческом районе с аутентичной атмосферой. Недавно отремонтирована с сохранением стиля.', 9800000, 'Лаврушинский переулок, 12', 'Квартира', 38.0, 1, 4, 6, ARRAY['https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800', 'https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=800'], 55.744093, 37.626200, 'Третьяковская', 7, 0.5, 10, 25, 2.0);
            `);
            console.log('🏠 Тестовые объекты добавлены');
        }
        
    } catch (error) {
        console.error('❌ Ошибка создания таблиц:', error);
        throw error;
    }
}

// Проверка подключения к базе данных и создание таблиц
async function checkDatabaseConnection() {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Подключение к Supabase PostgreSQL успешно:', result.rows[0].now);
        
        // Создаем таблицы если их нет
        await createTablesIfNotExists();
        
        // Добавляем столбцы для карт если их нет
        try {
            await pool.query(`
                DO $$ 
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='latitude') THEN
                        ALTER TABLE objects ADD COLUMN latitude DECIMAL(10, 8);
                        ALTER TABLE objects ADD COLUMN longitude DECIMAL(11, 8);
                        ALTER TABLE objects ADD COLUMN nearest_metro VARCHAR(255);
                        ALTER TABLE objects ADD COLUMN metro_distance_minutes INTEGER;
                        ALTER TABLE objects ADD COLUMN metro_distance_km DECIMAL(5, 2);
                        ALTER TABLE objects ADD COLUMN city_center_car_minutes INTEGER;
                        ALTER TABLE objects ADD COLUMN city_center_walk_minutes INTEGER;
                        ALTER TABLE objects ADD COLUMN city_center_distance_km DECIMAL(5, 2);
                        
                        -- Заполняем данными
                        UPDATE objects SET latitude = 55.758570, longitude = 37.644895, nearest_metro = 'Таганская', metro_distance_minutes = 5, metro_distance_km = 0.4, city_center_car_minutes = 15, city_center_walk_minutes = 45, city_center_distance_km = 3.2 WHERE id = 1;
                        UPDATE objects SET latitude = 55.742020, longitude = 37.653105, nearest_metro = 'Павелецкая', metro_distance_minutes = 8, metro_distance_km = 0.6, city_center_car_minutes = 12, city_center_walk_minutes = 35, city_center_distance_km = 2.8 WHERE id = 2;
                        UPDATE objects SET latitude = 55.755826, longitude = 37.617298, nearest_metro = 'Кропоткинская', metro_distance_minutes = 3, metro_distance_km = 0.2, city_center_car_minutes = 8, city_center_walk_minutes = 20, city_center_distance_km = 1.5 WHERE id = 3;
                        UPDATE objects SET latitude = 55.764200, longitude = 37.565050, nearest_metro = 'Сокольники', metro_distance_minutes = 12, metro_distance_km = 0.9, city_center_car_minutes = 25, city_center_walk_minutes = 65, city_center_distance_km = 5.2 WHERE id = 4;
                        UPDATE objects SET latitude = 55.831903, longitude = 37.411850, nearest_metro = 'Митино', metro_distance_minutes = 15, metro_distance_km = 1.2, city_center_car_minutes = 45, city_center_walk_minutes = 120, city_center_distance_km = 18.5 WHERE id = 5;
                        UPDATE objects SET latitude = 55.744093, longitude = 37.626200, nearest_metro = 'Третьяковская', metro_distance_minutes = 7, metro_distance_km = 0.5, city_center_car_minutes = 10, city_center_walk_minutes = 25, city_center_distance_km = 2.0 WHERE id = 6;
                        
                        RAISE NOTICE 'Столбцы карт добавлены и заполнены данными';
                    END IF;
                END $$;
            `);
            console.log('🗺️ Столбцы карт проверены/добавлены');
        } catch (err) {
            console.log('ℹ️ Столбцы карт уже существуют');
        }
    } catch (error) {
        console.error('❌ Ошибка подключения к базе данных:', error.message);
        process.exit(1);
    }
}

// Запуск сервера
app.listen(PORT, async () => {
    await checkDatabaseConnection();
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`🐘 Используется Supabase PostgreSQL база данных`);
});

module.exports = app; 