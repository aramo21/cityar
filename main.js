// --- DOM Elements ---
const catalogEl = document.getElementById('catalog');
const filtersEl = document.getElementById('filters');

// --- State ---
let filtered = [...window.PROPERTIES];
let filter = { type: 'Все', city: 'Все', min: '', max: '' };
let sort = 'date-desc';

// --- Utils ---
function formatPrice(p) {
  return p.toLocaleString('ru-RU') + ' ₽';
}
function formatDate(d) {
  return new Date(d).toLocaleDateString('ru-RU');
}

// --- Render Filters ---
function renderFilters() {
  const types = ['Все', ...new Set(window.PROPERTIES.map(o => o.type))];
  const cities = ['Все', ...new Set(window.PROPERTIES.map(o => o.city))];
  // Диапазоны цен для выпадающих списков
  const priceSteps = [0, 5000000, 10000000, 15000000, 20000000, 25000000, 30000000];
  filtersEl.innerHTML = `
    <form id="filter-form" class="filter-glass p-4 flex flex-wrap gap-4 justify-center items-end mb-8 w-full max-w-6xl mx-auto">
      <div class="flex flex-col min-w-[140px] flex-1">
        <label for="filter-type" class="text-xs text-gray-500 mb-1 font-medium">Тип</label>
        <select id="filter-type" class="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-200 transition text-sm bg-white hover:border-blue-400">
          ${types.map(t => `<option${filter.type===t?' selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="flex flex-col min-w-[140px] flex-1">
        <label for="filter-city" class="text-xs text-gray-500 mb-1 font-medium">Город</label>
        <select id="filter-city" class="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-200 transition text-sm bg-white hover:border-blue-400">
          ${cities.map(c => `<option${filter.city===c?' selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="flex flex-col min-w-[160px] flex-1">
        <label for="filter-min" class="text-xs text-gray-500 mb-1 font-medium">Цена от</label>
        <select id="filter-min" class="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-200 transition text-sm bg-white hover:border-blue-400">
          <option value="">Не выбрано</option>
          ${priceSteps.map(p => `<option value="${p}"${filter.min==p?" selected":""}>${p? p.toLocaleString('ru-RU')+' ₽':'Любая'}</option>`).join('')}
        </select>
      </div>
      <div class="flex flex-col min-w-[160px] flex-1">
        <label for="filter-max" class="text-xs text-gray-500 mb-1 font-medium">Цена до</label>
        <select id="filter-max" class="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-200 transition text-sm bg-white hover:border-blue-400">
          <option value="">Не выбрано</option>
          ${priceSteps.map(p => `<option value="${p}"${filter.max==p?" selected":""}>${p? p.toLocaleString('ru-RU')+' ₽':'Любая'}</option>`).join('')}
        </select>
      </div>
      <div class="flex flex-col min-w-[140px] flex-1">
        <label for="sort" class="text-xs text-gray-500 mb-1 font-medium">Сортировка</label>
        <select id="sort" class="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-200 transition text-sm bg-white hover:border-blue-400">
          <option value="date-desc"${sort==='date-desc'?' selected':''}>Сначала новые</option>
          <option value="date-asc"${sort==='date-asc'?' selected':''}>Сначала старые</option>
          <option value="price-asc"${sort==='price-asc'?' selected':''}>Цена ↑</option>
          <option value="price-desc"${sort==='price-desc'?' selected':''}>Цена ↓</option>
        </select>
      </div>
      <div class="flex flex-col justify-end min-w-[120px]">
        <button type="submit" class="modern-btn w-full">Применить</button>
      </div>
    </form>
  `;
  // Применение фильтров только по кнопке
  filtersEl.querySelector('#filter-form').onsubmit = function(e) {
    e.preventDefault();
    filter.type = filtersEl.querySelector('#filter-type').value;
    filter.city = filtersEl.querySelector('#filter-city').value;
    filter.min = filtersEl.querySelector('#filter-min').value;
    filter.max = filtersEl.querySelector('#filter-max').value;
    sort = filtersEl.querySelector('#sort').value;
    applyFilters();
  };
}

// --- Apply Filters & Sort ---
function applyFilters() {
  filtered = window.PROPERTIES.filter(o =>
    (filter.type === 'Все' || o.type === filter.type) &&
    (filter.city === 'Все' || o.city === filter.city) &&
    (!filter.min || o.price >= +filter.min) &&
    (!filter.max || o.price <= +filter.max)
  );
  if (sort === 'date-desc') filtered.sort((a,b)=>b.date.localeCompare(a.date));
  if (sort === 'date-asc') filtered.sort((a,b)=>a.date.localeCompare(b.date));
  if (sort === 'price-asc') filtered.sort((a,b)=>a.price-b.price);
  if (sort === 'price-desc') filtered.sort((a,b)=>b.price-a.price);
  renderCatalog();
}

// --- Render Catalog ---
function renderCatalog() {
  if (!filtered.length) {
    catalogEl.innerHTML = '<div class="col-span-full text-center text-gray-400">Нет объектов по выбранным параметрам</div>';
    return;
  }
  catalogEl.innerHTML = filtered.map(obj => `
    <div class="property-card group bg-white rounded-2xl shadow-lg overflow-hidden transition-transform duration-300 hover:scale-105 hover:shadow-2xl hover:z-10 hover:-rotate-1 cursor-pointer" style="perspective: 800px;" data-id="${obj.id}">
      <div class="relative h-48 overflow-hidden">
        <img src="${obj.image}" alt="${obj.title}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        <span class="absolute top-2 left-2 bg-white/80 text-xs px-2 py-1 rounded">${obj.type}</span>
      </div>
      <div class="p-4 flex flex-col gap-2">
        <h3 class="text-lg font-semibold">${obj.title}</h3>
        <div class="text-gray-500 text-sm">${obj.city}, ${obj.address}</div>
        <div class="text-gray-700 text-sm line-clamp-2">${obj.description}</div>
        <div class="flex justify-between items-center mt-2">
          <span class="text-xl font-bold text-blue-700">${formatPrice(obj.price)}</span>
          <button onclick="window.location='object.html?id=${obj.id}'" class="modern-btn" tabindex="-1">Подробнее</button>
        </div>
      </div>
    </div>
  `).join('');
  // Добавляем обработчик на всю карточку
  document.querySelectorAll('.property-card').forEach(card => {
    card.addEventListener('click', function(e) {
      // Не срабатывает, если клик по кнопке
      if (e.target.tagName.toLowerCase() === 'button') return;
      const id = this.getAttribute('data-id');
      window.location = `object.html?id=${id}`;
    });
  });
}

// --- Init ---
renderFilters();
applyFilters();
