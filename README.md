# CityAR - Сайт недвижимости

## 🏠 Описание проекта

CityAR - это полнофункциональный сайт для работы с недвижимостью, включающий:
- Каталог объектов недвижимости с фильтрацией и поиском
- Систему регистрации и авторизации пользователей
- Личный кабинет с избранным и заявками
- Админ-панель для управления объектами и заявками
- Интеграцию с Яндекс.Картами
- Современный адаптивный дизайн

## 🚀 Быстрый старт

### Требования
- Node.js (версия 16 или выше)
- PostgreSQL база данных (рекомендуется Supabase)
- Git

### Установка

1. **Клонируйте репозиторий:**
```bash
git clone <ваш-репозиторий>
cd web-21
```

2. **Установите зависимости:**
```bash
npm install
```

3. **Настройте базу данных:**
- Создайте аккаунт в [Supabase](https://supabase.com)
- Создайте новый проект
- Получите строку подключения к базе данных
- Обновите настройки в `server.js` (строки 12-20):

```javascript
const pool = new Pool({
    host: 'ваш-хост.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.ваш-проект',
    password: 'ваш-пароль',
    ssl: {
        rejectUnauthorized: false
    }
});
```

4. **Запустите сервер:**
```bash
node server.js
```

5. **Откройте в браузере:**
```
http://localhost:3000
```

## 📁 Структура проекта

```
web-21/
├── public/                 # Статические файлы
│   ├── index.html         # Главная страница
│   ├── object.html        # Страница объекта
│   ├── admin.html         # Админ-панель
│   ├── script.js          # Основная логика JavaScript
│   └── uploads/           # Загруженные изображения
├── server.js              # Серверная часть (Node.js + Express)
├── package.json           # Зависимости проекта
└── README.md             # Документация
```

## 👤 Пользователи по умолчанию

**Администратор:**
- Email: `aramikkhojayan@gmail.com`
- Пароль: `aram212001`

## 🔧 Основные функции

### Для пользователей:
- ✅ Просмотр каталога недвижимости
- ✅ Фильтрация по типу, цене, району
- ✅ Регистрация и авторизация
- ✅ Добавление в избранное ❤️
- ✅ Подача заявок на объекты
- ✅ Личный кабинет
- ✅ Удаление аккаунта

### Для администраторов:
- ✅ Добавление/редактирование объектов
- ✅ Загрузка изображений
- ✅ Управление статусами (активно/неактивно)
- ✅ Просмотр и обработка заявок
- ✅ Смена статусов заявок

## 🎨 Как изменить дизайн

### Цветовая схема
Основные цвета определены в CSS переменных в начале каждого HTML файла:

```css
:root {
    --primary-gradient: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    --secondary-gradient: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    /* ... другие цвета ... */
}
```

### Изменение текста
1. **Заголовки на главной странице** - в `public/index.html` найдите секцию `.hero`
2. **Контактная информация** - в футере каждой страницы
3. **Название сайта** - замените "CityAR" во всех файлах

## 📝 Как редактировать контент

### Изменить название сайта:
1. Найдите все вхождения "CityAR" в файлах
2. Замените на нужное название
3. Обновите `<title>` теги в HTML файлах

### Изменить контактную информацию:
1. В футере каждой страницы найдите секцию `.footer-contact`
2. Обновите телефон и email
3. Обновите ссылки на социальные сети

### Добавить новые поля для объектов:
1. Обновите базу данных в `server.js` (функция создания таблиц)
2. Добавьте поля в форму в `admin.html`
3. Обновите отображение в `script.js`

## 🗄️ База данных

Проект автоматически создает следующие таблицы:

### `users` - Пользователи
- `id` - Уникальный ID
- `email` - Email адрес
- `password` - Хешированный пароль
- `phone` - Номер телефона
- `full_name` - Полное имя
- `role` - Роль (user/admin)

### `objects` - Объекты недвижимости
- `id` - Уникальный ID
- `title` - Название
- `description` - Описание
- `price` - Цена
- `location` - Адрес
- `type` - Тип (apartment/house/commercial/land)
- `area` - Общая площадь
- `living_area` - Жилая площадь
- `kitchen_area` - Площадь кухни
- `rooms` - Количество комнат
- `floor` - Этаж
- `max_floor` - Этажность дома
- `building_year` - Год постройки
- `status` - Статус (active/inactive)
- `images` - Массив изображений
- И множество других характеристик...

### `requests` - Заявки
- `id` - Уникальный ID
- `user_id` - ID пользователя
- `object_id` - ID объекта
- `name` - Имя заявителя
- `phone` - Телефон
- `email` - Email
- `message` - Сообщение
- `status` - Статус (new/in_progress/completed/rejected)

## 🛠️ Деплой на хостинг

### Подготовка к деплою:

1. **Убедитесь что проект работает локально**
2. **Подготовьте продакшн базу данных**
3. **Обновите настройки подключения к БД в server.js**

### Для деплоя на Heroku:

1. Создайте `Procfile`:
```
web: node server.js
```

2. Обновите `package.json`:
```json
{
  "scripts": {
    "start": "node server.js"
  },
  "engines": {
    "node": "18.x"
  }
}
```

### Для деплоя на VPS:

1. Установите Node.js и PM2:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

2. Загрузите проект и запустите:
```bash
git clone <ваш-репозиторий>
cd web-21
npm install
pm2 start server.js --name "cityar"
pm2 startup
pm2 save
```

## 🔒 Безопасность

- Пароли хешируются с помощью bcrypt
- JWT токены для авторизации
- SQL-инъекции предотвращены через параметризованные запросы
- Валидация данных на сервере

## 📱 Мобильная адаптация

Сайт полностью адаптирован для мобильных устройств:
- Responsive дизайн
- Мобильные меню
- Оптимизированные формы
- Быстрая загрузка

## 🐛 Решение проблем

### Сервер не запускается:
1. Проверьте настройки базы данных
2. Убедитесь что порт 3000 свободен
3. Проверьте логи в консоли

### Не загружаются изображения:
1. Проверьте папку `public/uploads`
2. Убедитесь в правах доступа к папке
3. Проверьте размер загружаемых файлов (лимит 5MB)

### Ошибки авторизации:
1. Очистите localStorage в браузере
2. Проверьте JWT_SECRET в server.js
3. Пересоздайте пользователя администратора

## 📞 Поддержка

При возникновении вопросов:
1. Проверьте логи в консоли браузера (F12)
2. Проверьте логи сервера в терминале
3. Убедитесь что все зависимости установлены

## 📄 Лицензия

Проект создан для демонстрационных целей. Свободное использование.

---

**Создано с ❤️ для демонстрации возможностей современной веб-разработки** 