/**
 * ARANDU Dashboard - Pesca Extrativa
 * Dados de Mapa de Bordo
 */

// Chart.js Global Configuration
Chart.defaults.font.family = "'Source Sans 3', sans-serif";
Chart.defaults.color = '#4a5568';
Chart.defaults.plugins.tooltip.backgroundColor = '#003366';
Chart.defaults.plugins.tooltip.titleFont = { size: 14, weight: 'bold' };
Chart.defaults.plugins.tooltip.bodyFont = { size: 13 };
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.cornerRadius = 8;

// Color Palette
const COLORS = {
    primary: ['#003366', '#0066cc', '#3498db', '#1abc9c', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6', '#34495e', '#95a5a6'],
    gradient: {
        blue: ['rgba(0, 51, 102, 0.8)', 'rgba(0, 102, 204, 0.6)'],
        green: ['rgba(39, 174, 96, 0.8)', 'rgba(46, 204, 113, 0.6)']
    },
    regions: {
        'Norte': '#2ecc71',
        'Nordeste': '#e74c3c',
        'Sudeste': '#3498db',
        'Sul': '#9b59b6',
        'Centro-Oeste': '#f39c12'
    }
};

// UF to Region mapping
const UF_TO_REGION = {
    'Acre': 'Norte', 'Amapá': 'Norte', 'Amazonas': 'Norte', 'Pará': 'Norte', 'Rondônia': 'Norte', 'Roraima': 'Norte', 'Tocantins': 'Norte',
    'Alagoas': 'Nordeste', 'Bahia': 'Nordeste', 'Ceará': 'Nordeste', 'Maranhão': 'Nordeste', 'Paraíba': 'Nordeste', 'Pernambuco': 'Nordeste', 'Piauí': 'Nordeste', 'Rio Grande do Norte': 'Nordeste', 'Sergipe': 'Nordeste',
    'Espírito Santo': 'Sudeste', 'Minas Gerais': 'Sudeste', 'Rio de Janeiro': 'Sudeste', 'São Paulo': 'Sudeste',
    'Paraná': 'Sul', 'Rio Grande do Sul': 'Sul', 'Santa Catarina': 'Sul',
    'Distrito Federal': 'Centro-Oeste', 'Goiás': 'Centro-Oeste', 'Mato Grosso': 'Centro-Oeste', 'Mato Grosso do Sul': 'Centro-Oeste'
};

const UF_SIGLAS = {
    'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM', 'Bahia': 'BA', 'Ceará': 'CE',
    'Distrito Federal': 'DF', 'Espírito Santo': 'ES', 'Goiás': 'GO', 'Maranhão': 'MA', 'Mato Grosso': 'MT',
    'Mato Grosso do Sul': 'MS', 'Minas Gerais': 'MG', 'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR',
    'Pernambuco': 'PE', 'Piauí': 'PI', 'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN',
    'Rio Grande do Sul': 'RS', 'Rondônia': 'RO', 'Roraima': 'RR', 'Santa Catarina': 'SC',
    'São Paulo': 'SP', 'Sergipe': 'SE', 'Tocantins': 'TO'
};

const DASHBOARD_SCOPE = {
    BRAZIL: 'brazil',
    LEGAL_AMAZON: 'legal-amazon'
};

const LEGAL_AMAZON_FILTER_VALUE = 'amazonia-legal';
const LEGAL_AMAZON_STATES = ['Acre', 'Amapá', 'Amazonas', 'Maranhão', 'Mato Grosso', 'Pará', 'Rondônia', 'Roraima', 'Tocantins'];
const LEGAL_AMAZON_SIGLAS = ['AC', 'AP', 'AM', 'MA', 'MT', 'PA', 'RO', 'RR', 'TO'];

// Global State
let dashboardData = {
    allRaw: [],
    raw: [],
    byEspecie: {},
    byEstado: {},
    byRegiao: {},
    byAno: {},
    byArtePesca: {},
    filteredData: [],
    charts: {},
    map: null,
    geojsonLayer: null,
    geojsonData: null
};

let tableState = {
    currentPage: 1,
    pageSize: 15,
    sortColumn: 'producao',
    sortDirection: 'desc',
    filters: {
        search: '',
        especie: '',
        estado: '',
        ano: ''
    }
};

let scopeState = {
    current: DASHBOARD_SCOPE.BRAZIL
};

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', async () => {
    try {
        showLoading();
        await loadData();
        processData();
        updateScopeUI();
        updateKPIs();
        initCharts();
        initMap();
        initTable();
        initEventListeners();
        hideLoading();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        hideLoading();
        alert('Erro ao carregar os dados. Por favor, recarregue a página.');
    }
});

// Load Data from CSV
async function loadData() {
    const response = await fetch('Base_Consolidada_Pesca_extrativa.csv');
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    let text = decoder.decode(buffer);
    
    // Try Latin-1 if UTF-8 produces garbled text
    if (text.includes('�')) {
        const decoder2 = new TextDecoder('windows-1252');
        text = decoder2.decode(buffer);
    }
    
    parseCSV(text);
    
    // Load GeoJSON for states
    try {
        const geoResponse = await fetch('BR_UF_2024.json');
        dashboardData.geojsonData = await geoResponse.json();
    } catch (error) {
        console.warn('Could not load GeoJSON:', error);
    }
}

function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const records = [];
    
    // Skip header
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const fields = parseCSVLine(line);
        if (fields.length >= 18) {
            const producao = parseFloat(fields[7].replace(',', '.')) || 0;
            
            records.push({
                idMapaDeBordo: fields[0],
                nomeEmbarcacao: fields[1],
                dataSaida: fields[2],
                dataChegada: fields[3],
                ano: fields[4],
                codigoIN: fields[5],
                especie: fields[6],
                producao: producao,
                artePesca: fields[8],
                portoSaida: fields[9],
                portoChegada: fields[10],
                estado: fields[16],
                comprimento: fields[17],
                numeroTie: fields[18] || ''
            });
        }
    }
    
    dashboardData.allRaw = records;
    dashboardData.raw = getScopedRawData();
    dashboardData.filteredData = [...dashboardData.raw];
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ';' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    
    return result;
}

function isLegalAmazonState(estado) {
    return LEGAL_AMAZON_STATES.includes(estado);
}

function getScopedRawData() {
    if (scopeState.current === DASHBOARD_SCOPE.LEGAL_AMAZON) {
        return dashboardData.allRaw.filter(item => isLegalAmazonState(item.estado));
    }
    return [...dashboardData.allRaw];
}

function isCurrentScopeLegalAmazon() {
    return scopeState.current === DASHBOARD_SCOPE.LEGAL_AMAZON;
}

function getCurrentScopeTitle() {
    return isCurrentScopeLegalAmazon()
        ? 'Pesca Extrativa na Amazônia Legal'
        : 'Pesca Extrativa no Brasil';
}

function updateScopeUI() {
    const heroTitle = document.getElementById('heroTitle');
    const scopeToggleButton = document.getElementById('scopeToggleButton');
    const scopeToggleLabel = document.getElementById('scopeToggleLabel');

    if (heroTitle) {
        heroTitle.textContent = getCurrentScopeTitle();
    }

    if (scopeToggleButton) {
        const isActive = isCurrentScopeLegalAmazon();
        scopeToggleButton.classList.toggle('active', isActive);
        scopeToggleButton.setAttribute('aria-pressed', String(isActive));
    }

    if (scopeToggleLabel) {
        scopeToggleLabel.textContent = isCurrentScopeLegalAmazon() ? 'Brasil' : 'Amazônia Legal';
    }
}

function resetScopedControls() {
    tableState.currentPage = 1;
    tableState.filters.search = '';
    tableState.filters.especie = '';
    tableState.filters.estado = '';
    tableState.filters.ano = '';

    const controls = [
        'searchInput',
        'filterEspecie',
        'filterEstado',
        'filterAno',
        'filterRegionalEspecie',
        'mapFilterEspecie',
        'mapFilterAno'
    ];

    controls.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });

    const infoEstado = document.getElementById('infoEstado');
    const infoDetails = document.getElementById('infoDetails');
    if (infoEstado) infoEstado.textContent = 'Passe o mouse sobre um estado';
    if (infoDetails) infoDetails.innerHTML = '';
}

function refreshCharts() {
    const activeChartType = document.querySelector('.btn-chart.active')?.dataset.chart || 'bar';
    initCharts();
    if (activeChartType !== 'bar') {
        updateChartType(activeChartType);
    }
}

function getScopedGeojsonData() {
    if (!dashboardData.geojsonData?.features) return dashboardData.geojsonData;

    return {
        ...dashboardData.geojsonData,
        features: dashboardData.geojsonData.features.filter(feature => {
            if (!isCurrentScopeLegalAmazon()) return true;
            const sigla = feature.properties.SIGLA_UF || feature.properties.sigla;
            return LEGAL_AMAZON_SIGLAS.includes(sigla);
        })
    };
}

function fitMapToLayer(layer) {
    if (!dashboardData.map || !layer || typeof layer.getBounds !== 'function') return;

    const bounds = layer.getBounds();
    if (bounds && typeof bounds.isValid === 'function' && bounds.isValid()) {
        dashboardData.map.fitBounds(bounds);
    }
}

function applyDashboardScope(scope) {
    scopeState.current = scope;
    dashboardData.raw = getScopedRawData();
    dashboardData.filteredData = [...dashboardData.raw];

    resetScopedControls();
    processData();
    populateRegionalFilter();
    updateScopeUI();
    updateKPIs();
    refreshCharts();
    updateMap({ fitBounds: true });
    renderTable();
}

function toggleDashboardScope() {
    const nextScope = isCurrentScopeLegalAmazon()
        ? DASHBOARD_SCOPE.BRAZIL
        : DASHBOARD_SCOPE.LEGAL_AMAZON;
    applyDashboardScope(nextScope);
}

// Process Data
function processData() {
    const data = dashboardData.raw;
    
    // Group by Espécie
    dashboardData.byEspecie = {};
    data.forEach(item => {
        if (!dashboardData.byEspecie[item.especie]) {
            dashboardData.byEspecie[item.especie] = 0;
        }
        dashboardData.byEspecie[item.especie] += item.producao;
    });
    
    // Group by Estado
    dashboardData.byEstado = {};
    data.forEach(item => {
        if (item.estado) {
            if (!dashboardData.byEstado[item.estado]) {
                dashboardData.byEstado[item.estado] = 0;
            }
            dashboardData.byEstado[item.estado] += item.producao;
        }
    });
    
    // Group by Região
    dashboardData.byRegiao = {};
    data.forEach(item => {
        if (item.estado) {
            const regiao = UF_TO_REGION[item.estado] || 'Outros';
            if (!dashboardData.byRegiao[regiao]) {
                dashboardData.byRegiao[regiao] = 0;
            }
            dashboardData.byRegiao[regiao] += item.producao;
        }
    });
    
    // Group by Ano
    dashboardData.byAno = {};
    data.forEach(item => {
        if (item.ano) {
            if (!dashboardData.byAno[item.ano]) {
                dashboardData.byAno[item.ano] = 0;
            }
            dashboardData.byAno[item.ano] += item.producao;
        }
    });
    
    // Group by Arte de Pesca
    dashboardData.byArtePesca = {};
    data.forEach(item => {
        if (item.artePesca) {
            if (!dashboardData.byArtePesca[item.artePesca]) {
                dashboardData.byArtePesca[item.artePesca] = 0;
            }
            dashboardData.byArtePesca[item.artePesca] += item.producao;
        }
    });
    
    // Populate filters
    populateFilters();
}

function populateFilters() {
    const data = dashboardData.raw;
    
    // Espécies
    const especies = [...new Set(data.map(d => d.especie))].filter(Boolean).sort();
    const filterEspecie = document.getElementById('filterEspecie');
    const mapFilterEspecie = document.getElementById('mapFilterEspecie');
    
    filterEspecie.innerHTML = '<option value="">Todas as Espécies</option>';
    mapFilterEspecie.innerHTML = '<option value="">Todas as Espécies</option>';
    
    especies.forEach(especie => {
        const opt1 = document.createElement('option');
        opt1.value = especie;
        opt1.textContent = especie;
        filterEspecie.appendChild(opt1);
        
        const opt2 = document.createElement('option');
        opt2.value = especie;
        opt2.textContent = especie;
        mapFilterEspecie.appendChild(opt2);
    });
    
    // Estados
    const estados = [...new Set(data.map(d => d.estado))].filter(Boolean).sort();
    const filterEstado = document.getElementById('filterEstado');
    filterEstado.innerHTML = `
        <option value="">Todos os Estados</option>
        <option value="${LEGAL_AMAZON_FILTER_VALUE}">Amazônia Legal</option>
    `;
    estados.forEach(estado => {
        const opt = document.createElement('option');
        opt.value = estado;
        opt.textContent = estado;
        filterEstado.appendChild(opt);
    });
    
    // Anos
    const anos = [...new Set(data.map(d => d.ano))].filter(Boolean).sort();
    const filterAno = document.getElementById('filterAno');
    const mapFilterAno = document.getElementById('mapFilterAno');
    
    filterAno.innerHTML = '<option value="">Todos os Anos</option>';
    mapFilterAno.innerHTML = '<option value="">Todos os Anos</option>';
    
    anos.forEach(ano => {
        const opt1 = document.createElement('option');
        opt1.value = ano;
        opt1.textContent = ano;
        filterAno.appendChild(opt1);
        
        const opt2 = document.createElement('option');
        opt2.value = ano;
        opt2.textContent = ano;
        mapFilterAno.appendChild(opt2);
    });
}

// Update KPIs
function updateKPIs() {
    const data = dashboardData.filteredData;
    
    // Total Produção
    const totalProducao = data.reduce((sum, item) => sum + item.producao, 0);
    
    // Total Embarcações
    const embarcacoes = new Set(data.map(d => d.nomeEmbarcacao)).size;
    
    // Total Espécies
    const especies = new Set(data.map(d => d.especie)).size;
    
    // Espécie Principal
    const byEspecie = {};
    data.forEach(item => {
        if (!byEspecie[item.especie]) byEspecie[item.especie] = 0;
        byEspecie[item.especie] += item.producao;
    });
    const sorted = Object.entries(byEspecie).sort((a, b) => b[1] - a[1]);
    const especiePrincipal = sorted[0] ? sorted[0][0].split(' ')[0] : '--';
    
    // Animate KPIs
    animateValue('totalProducao', 0, totalProducao, 1500, formatNumber);
    animateValue('totalEmbarcacoes', 0, embarcacoes, 1200, formatInteger);
    animateValue('totalEspecies', 0, especies, 1000, formatInteger);
    document.getElementById('especiePrincipal').textContent = especiePrincipal;
}

function animateValue(elementId, start, end, duration, formatter) {
    const element = document.getElementById(elementId);
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
        const current = start + (end - start) * easeProgress;
        
        element.textContent = formatter(current);
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

function formatInteger(num) {
    return Math.round(num).toLocaleString('pt-BR');
}

function formatNumber(num) {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(num);
}

function formatDecimal(num) {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

// Initialize Charts
function initCharts() {
    createChartEspecies();
    createChartTop10();
    createChartArtePesca();
    createChartEstados();
    createChartAnual();
    createChartDistribuicao();
}

function createChartEspecies() {
    const sorted = Object.entries(dashboardData.byEspecie)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);
    
    const labels = sorted.map(([especie]) => especie.split(' ')[0]);
    const values = sorted.map(([, prod]) => prod);
    
    const ctx = document.getElementById('chartEspecies').getContext('2d');
    
    if (dashboardData.charts.especies) {
        dashboardData.charts.especies.destroy();
    }
    
    dashboardData.charts.especies = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Produção (ton)',
                data: values,
                backgroundColor: COLORS.primary[0],
                borderColor: COLORS.primary[0],
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatNumber(value)
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

function createChartTop10() {
    const sorted = Object.entries(dashboardData.byEspecie)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const labels = sorted.map(([especie]) => {
        const name = especie.split('(')[0].trim();
        return name.length > 20 ? name.substring(0, 20) + '...' : name;
    });
    const values = sorted.map(([, prod]) => prod);
    
    const ctx = document.getElementById('chartTop10').getContext('2d');
    
    if (dashboardData.charts.top10) {
        dashboardData.charts.top10.destroy();
    }
    
    dashboardData.charts.top10 = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Produção (ton)',
                data: values,
                backgroundColor: COLORS.primary.slice(0, 10),
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatNumber(value)
                    }
                }
            }
        }
    });
}

function createChartArtePesca() {
    const sorted = Object.entries(dashboardData.byArtePesca)
        .sort((a, b) => b[1] - a[1]);
    
    const labels = sorted.map(([arte]) => arte);
    const values = sorted.map(([, prod]) => prod);
    
    const ctx = document.getElementById('chartArtePesca').getContext('2d');
    
    if (dashboardData.charts.artePesca) {
        dashboardData.charts.artePesca.destroy();
    }
    
    dashboardData.charts.artePesca = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: COLORS.primary.slice(0, sorted.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 8
                    }
                },
                datalabels: { display: false }
            }
        }
    });
}

function createChartEstados() {
    const sorted = Object.entries(dashboardData.byEstado)
        .sort((a, b) => b[1] - a[1]);
    
    const labels = sorted.map(([estado]) => UF_SIGLAS[estado] || estado);
    const values = sorted.map(([, prod]) => prod);
    
    const ctx = document.getElementById('chartEstados').getContext('2d');
    
    if (dashboardData.charts.estados) {
        dashboardData.charts.estados.destroy();
    }
    
    dashboardData.charts.estados = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Produção (ton)',
                data: values,
                backgroundColor: COLORS.primary[1],
                borderColor: COLORS.primary[1],
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatNumber(value)
                    }
                }
            }
        }
    });
}

function createChartAnual() {
    const sorted = Object.entries(dashboardData.byAno)
        .sort((a, b) => a[0].localeCompare(b[0]));
    
    const labels = sorted.map(([ano]) => ano);
    const values = sorted.map(([, prod]) => prod);
    
    const ctx = document.getElementById('chartAnual').getContext('2d');
    
    if (dashboardData.charts.anual) {
        dashboardData.charts.anual.destroy();
    }
    
    dashboardData.charts.anual = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Produção (ton)',
                data: values,
                borderColor: COLORS.primary[1],
                backgroundColor: 'rgba(0, 102, 204, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: COLORS.primary[1]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatNumber(value)
                    }
                }
            }
        }
    });
}

function createChartDistribuicao() {
    const sorted = Object.entries(dashboardData.byRegiao)
        .sort((a, b) => b[1] - a[1]);
    
    const labels = sorted.map(([regiao]) => regiao);
    const values = sorted.map(([, prod]) => prod);
    const colors = labels.map(regiao => COLORS.regions[regiao] || '#95a5a6');
    
    const ctx = document.getElementById('chartDistribuicao').getContext('2d');
    
    if (dashboardData.charts.distribuicao) {
        dashboardData.charts.distribuicao.destroy();
    }
    
    dashboardData.charts.distribuicao = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                datalabels: { display: false }
            }
        }
    });
}

// Initialize Map
function initMap() {
    if (!dashboardData.geojsonData) {
        document.getElementById('mapContainer').innerHTML = '<p style="text-align:center;padding:40px;">Mapa não disponível</p>';
        return;
    }
    
    // Initialize Leaflet map
    dashboardData.map = L.map('mapContainer').setView([-14.235, -51.925], 4);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(dashboardData.map);
    
    updateMap({ fitBounds: true });
}

function updateMap(options = {}) {
    if (!dashboardData.map || !dashboardData.geojsonData) return;

    const { fitBounds = false } = options;
    
    const especieFilter = document.getElementById('mapFilterEspecie').value;
    const anoFilter = document.getElementById('mapFilterAno').value;
    
    // Filter data
    let filtered = dashboardData.raw;
    if (especieFilter) {
        filtered = filtered.filter(d => d.especie === especieFilter);
    }
    if (anoFilter) {
        filtered = filtered.filter(d => d.ano === anoFilter);
    }
    
    // Aggregate by state
    const byEstado = {};
    filtered.forEach(item => {
        if (item.estado) {
            const sigla = UF_SIGLAS[item.estado];
            if (sigla) {
                byEstado[sigla] = (byEstado[sigla] || 0) + item.producao;
            }
        }
    });
    
    // Get max value for color scale
    const values = Object.values(byEstado);
    const maxValue = Math.max(...values, 1);
    
    // Remove existing layer
    if (dashboardData.geojsonLayer) {
        dashboardData.map.removeLayer(dashboardData.geojsonLayer);
    }
    
    // Create choropleth
    dashboardData.geojsonLayer = L.geoJSON(getScopedGeojsonData(), {
        style: feature => {
            const sigla = feature.properties.SIGLA_UF || feature.properties.sigla;
            const value = byEstado[sigla] || 0;
            const intensity = value / maxValue;
            
            return {
                fillColor: getColor(intensity),
                weight: 1,
                opacity: 1,
                color: '#fff',
                fillOpacity: 0.7
            };
        },
        onEachFeature: (feature, layer) => {
            const sigla = feature.properties.SIGLA_UF || feature.properties.sigla;
            const nome = feature.properties.NM_UF || feature.properties.nome;
            const value = byEstado[sigla] || 0;
            
            layer.on({
                mouseover: e => {
                    e.target.setStyle({ weight: 3, color: '#003366' });
                    document.getElementById('infoEstado').textContent = nome;
                    document.getElementById('infoDetails').innerHTML = `
                        <p><strong>Produção:</strong> ${formatNumber(value)} ton</p>
                    `;
                },
                mouseout: e => {
                    dashboardData.geojsonLayer.resetStyle(e.target);
                }
            });
            
            layer.bindTooltip(`${nome}: ${formatNumber(value)} ton`);
        }
    }).addTo(dashboardData.map);

    if (fitBounds) {
        fitMapToLayer(dashboardData.geojsonLayer);
    }
    
    // Update legend
    updateLegend(maxValue);
}

function getColor(intensity) {
    const colors = ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#003366'];
    const index = Math.min(Math.floor(intensity * colors.length), colors.length - 1);
    return colors[index];
}

function updateLegend(maxValue) {
    const scale = document.querySelector('.legend-scale');
    if (!scale) return;
    
    const steps = 5;
    let html = '<div style="display:flex;gap:4px;">';
    
    for (let i = 0; i < steps; i++) {
        const intensity = i / (steps - 1);
        const color = getColor(intensity);
        const value = (maxValue * intensity).toFixed(0);
        html += `<div style="flex:1;text-align:center;">
            <div style="height:20px;background:${color};border:1px solid #ddd;"></div>
            <small>${formatNumber(parseFloat(value))}</small>
        </div>`;
    }
    
    html += '</div>';
    scale.innerHTML = html;
}

// Initialize Table
function initTable() {
    populateRegionalFilter();
    renderTable();
}

function populateRegionalFilter() {
    const select = document.getElementById('filterRegionalEspecie');
    if (!select) return;

    select.innerHTML = '<option value="">Todas as Espécies</option>';
    
    const especies = Object.keys(dashboardData.byEspecie)
        .filter(e => dashboardData.byEspecie[e] > 0)
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    
    especies.forEach(esp => {
        const option = document.createElement('option');
        option.value = esp;
        option.textContent = esp;
        select.appendChild(option);
    });
}

function updateRegionalCharts(especie) {
    // Recalculate data by estado and regiao for the selected species
    const byEstadoFiltered = {};
    const byRegiaoFiltered = {};
    
    dashboardData.raw.forEach(item => {
        if (especie === '' || item.especie === especie) {
            const estado = item.estado;
            const regiao = UF_TO_REGION[estado] || 'Outros';
            
            if (!byEstadoFiltered[estado]) byEstadoFiltered[estado] = 0;
            byEstadoFiltered[estado] += item.producao;
            
            if (!byRegiaoFiltered[regiao]) byRegiaoFiltered[regiao] = 0;
            byRegiaoFiltered[regiao] += item.producao;
        }
    });
    
    // Update Estados Chart
    const sortedEstados = Object.entries(byEstadoFiltered)
        .filter(([_, v]) => v > 0)
        .sort((a, b) => b[1] - a[1]);
    
    dashboardData.charts.estados.data.labels = sortedEstados.map(([estado]) => UF_SIGLAS[estado] || estado);
    dashboardData.charts.estados.data.datasets[0].data = sortedEstados.map(([, prod]) => prod);
    dashboardData.charts.estados.update();
    
    // Update Distribuicao Chart
    const sortedRegioes = Object.entries(byRegiaoFiltered)
        .filter(([_, v]) => v > 0)
        .sort((a, b) => b[1] - a[1]);
    
    dashboardData.charts.distribuicao.data.labels = sortedRegioes.map(([regiao]) => regiao);
    dashboardData.charts.distribuicao.data.datasets[0].data = sortedRegioes.map(([, prod]) => prod);
    dashboardData.charts.distribuicao.data.datasets[0].backgroundColor = sortedRegioes.map(([regiao]) => COLORS.regions[regiao] || '#95a5a6');
    dashboardData.charts.distribuicao.update();
}

function renderTable() {
    const data = dashboardData.filteredData;
    let filtered = [...data];
    
    // Apply filters
    const search = tableState.filters.search.toLowerCase();
    const especie = tableState.filters.especie;
    const estado = tableState.filters.estado;
    const ano = tableState.filters.ano;
    
    if (search) {
        filtered = filtered.filter(item =>
            (item.nomeEmbarcacao || '').toLowerCase().includes(search) ||
            (item.especie || '').toLowerCase().includes(search)
        );
    }
    if (especie) {
        filtered = filtered.filter(item => item.especie === especie);
    }
    if (estado) {
        filtered = filtered.filter(item => {
            if (estado === LEGAL_AMAZON_FILTER_VALUE) {
                return isLegalAmazonState(item.estado);
            }
            return item.estado === estado;
        });
    }
    if (ano) {
        filtered = filtered.filter(item => item.ano === ano);
    }
    
    // Sort
    filtered.sort((a, b) => {
        let valA = a[tableState.sortColumn];
        let valB = b[tableState.sortColumn];
        
        if (typeof valA === 'number' && typeof valB === 'number') {
            return tableState.sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        
        valA = String(valA || '');
        valB = String(valB || '');
        return tableState.sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    
    // Paginate
    const totalPages = Math.ceil(filtered.length / tableState.pageSize);
    const start = (tableState.currentPage - 1) * tableState.pageSize;
    const end = start + tableState.pageSize;
    const paginated = filtered.slice(start, end);
    
    // Render
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    paginated.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.nomeEmbarcacao || '-'}</td>
            <td>${item.especie || '-'}</td>
            <td>${item.estado || '-'}</td>
            <td>${item.artePesca || '-'}</td>
            <td>${item.producao.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</td>
            <td>${item.ano || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
    
    // Update pagination
    document.getElementById('pageInfo').textContent = `Página ${tableState.currentPage} de ${totalPages || 1}`;
    document.getElementById('btnPrev').disabled = tableState.currentPage <= 1;
    document.getElementById('btnNext').disabled = tableState.currentPage >= totalPages;
}

// Event Listeners
function initEventListeners() {
    // Chart type toggle
    document.querySelectorAll('.btn-chart').forEach(btn => {
        btn.addEventListener('click', e => {
            document.querySelectorAll('.btn-chart').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const chartType = e.target.dataset.chart;
            updateChartType(chartType);
        });
    });
    
    // Map filters
    document.getElementById('mapFilterEspecie').addEventListener('change', updateMap);
    document.getElementById('mapFilterAno').addEventListener('change', updateMap);
    
    // Table filters
    document.getElementById('searchInput').addEventListener('input', e => {
        tableState.filters.search = e.target.value;
        tableState.currentPage = 1;
        renderTable();
    });
    
    document.getElementById('filterEspecie').addEventListener('change', e => {
        tableState.filters.especie = e.target.value;
        tableState.currentPage = 1;
        renderTable();
    });
    
    document.getElementById('filterEstado').addEventListener('change', e => {
        tableState.filters.estado = e.target.value;
        tableState.currentPage = 1;
        renderTable();
    });
    
    document.getElementById('filterAno').addEventListener('change', e => {
        tableState.filters.ano = e.target.value;
        tableState.currentPage = 1;
        renderTable();
    });

    document.getElementById('filterRegionalEspecie').addEventListener('change', e => {
        updateRegionalCharts(e.target.value);
    });

    document.getElementById('scopeToggleButton').addEventListener('click', () => {
        toggleDashboardScope();
    });
    
    // Pagination
    document.getElementById('btnPrev').addEventListener('click', () => {
        if (tableState.currentPage > 1) {
            tableState.currentPage--;
            renderTable();
        }
    });
    
    document.getElementById('btnNext').addEventListener('click', () => {
        tableState.currentPage++;
        renderTable();
    });
    
    // Table sorting
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;
            if (tableState.sortColumn === column) {
                tableState.sortDirection = tableState.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                tableState.sortColumn = column;
                tableState.sortDirection = 'asc';
            }
            renderTable();
        });
    });
    
    // Mobile menu
    document.querySelector('.menu-toggle')?.addEventListener('click', () => {
        document.querySelector('.mobile-nav')?.classList.toggle('active');
    });
}

function updateChartType(type) {
    const sorted = Object.entries(dashboardData.byEspecie)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);
    
    const labels = sorted.map(([especie]) => especie.split(' ')[0]);
    const values = sorted.map(([, prod]) => prod);
    
    if (dashboardData.charts.especies) {
        dashboardData.charts.especies.destroy();
    }
    
    const ctx = document.getElementById('chartEspecies').getContext('2d');
    
    if (type === 'pie') {
        dashboardData.charts.especies = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: COLORS.primary.concat(COLORS.primary),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { boxWidth: 12, padding: 8 }
                    },
                    datalabels: { display: false }
                }
            }
        });
    } else {
        dashboardData.charts.especies = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Produção (ton)',
                    data: values,
                    backgroundColor: COLORS.primary[0],
                    borderColor: COLORS.primary[0],
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => formatNumber(value)
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });
    }
}

// Utility functions
function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}
