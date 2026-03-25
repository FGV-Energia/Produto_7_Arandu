/**
 * ARANDU Dashboard - Application Logic
 * Produção Piscicultura Brasil 2024
 */

window.AranduTheme?.applyChartDefaults();

const COLORS = window.AranduTheme
    ? window.AranduTheme.COLORS
    : {
        primary: ['#003366', '#0f5ec7', '#2f80ed', '#0ea5a8', '#1fbf75', '#f59e0b', '#ef4444', '#8b5cf6', '#334155', '#94a3b8'],
        regions: {
            'Norte': '#1fbf75',
            'Nordeste': '#ef4444',
            'Sudeste': '#2f80ed',
            'Sul': '#8b5cf6',
            'Centro-Oeste': '#f59e0b'
        }
    };

// UF to Region mapping
const UF_TO_REGION = {
    'AC': 'Norte', 'AP': 'Norte', 'AM': 'Norte', 'PA': 'Norte', 'RO': 'Norte', 'RR': 'Norte', 'TO': 'Norte',
    'AL': 'Nordeste', 'BA': 'Nordeste', 'CE': 'Nordeste', 'MA': 'Nordeste', 'PB': 'Nordeste', 'PE': 'Nordeste', 'PI': 'Nordeste', 'RN': 'Nordeste', 'SE': 'Nordeste',
    'ES': 'Sudeste', 'MG': 'Sudeste', 'RJ': 'Sudeste', 'SP': 'Sudeste',
    'PR': 'Sul', 'RS': 'Sul', 'SC': 'Sul',
    'DF': 'Centro-Oeste', 'GO': 'Centro-Oeste', 'MT': 'Centro-Oeste', 'MS': 'Centro-Oeste'
};

const UF_NAMES = {
    'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas', 'BA': 'Bahia', 'CE': 'Ceará',
    'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás', 'MA': 'Maranhão', 'MT': 'Mato Grosso',
    'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais', 'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná',
    'PE': 'Pernambuco', 'PI': 'Piauí', 'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte',
    'RS': 'Rio Grande do Sul', 'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina',
    'SP': 'São Paulo', 'SE': 'Sergipe', 'TO': 'Tocantins'
};

const DASHBOARD_SCOPE = {
    BRAZIL: 'brazil',
    LEGAL_AMAZON: 'legal-amazon'
};

const LEGAL_AMAZON_FILTER_VALUE = 'amazonia-legal';
const LEGAL_AMAZON_UFS = ['AC', 'AP', 'AM', 'MA', 'MT', 'PA', 'RO', 'RR', 'TO'];

// Global State
let dashboardData = {
    allRaw: [],
    raw: [],
    byEspecie: {},
    byMunicipio: {},
    byEstado: {},
    byRegiao: {},
    municipiosInfo: {},
    geojsonData: null,
    filteredData: [],
    charts: {},
    map: null,
    geojsonLayer: null,
    estadosLayer: null,
    bubblesLayer: null,
    heatmapLayer: null,
    municipiosCentroids: {},
    scopedGeojsonCache: {},
    mapRenderer: null
};

let tableState = {
    currentPage: 1,
    pageSize: 15,
    sortColumn: 'producao',
    sortDirection: 'desc',
    filters: {
        search: '',
        especie: '',
        regiao: ''
    }
};

let mapState = {
    selectedEspecie: '',
    highlightedFeature: null,
    currentView: 'municipios', // 'municipios', 'estados', 'bolhas', 'heatmap'
    breaks: []
};

let scopeState = {
    current: DASHBOARD_SCOPE.BRAZIL
};

let chartState = {
    especiesType: 'bar'
};

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', async () => {
    try {
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

// Load Data from embedded data.js
async function loadData() {
    // Data is loaded from data.js which sets window.PISCICULTURA_DATA and window.MUNICIPIOS_DATA
    if (typeof window.PISCICULTURA_DATA === 'undefined') {
        throw new Error('Data not loaded');
    }
    
    dashboardData.allRaw = window.PISCICULTURA_DATA;
    dashboardData.raw = getScopedRawData();
    dashboardData.municipiosInfo = window.MUNICIPIOS_DATA || {};
    dashboardData.geojsonData = window.GEOJSON_DATA || null;
}

function getScopedRawData() {
    if (scopeState.current === DASHBOARD_SCOPE.LEGAL_AMAZON) {
        return dashboardData.allRaw.filter(item => {
            const ufCode = item.codMun.toString().substring(0, 2);
            return isLegalAmazonUF(getUFFromCode(ufCode));
        });
    }
    return [...dashboardData.allRaw];
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
    
    // Group by Município
    dashboardData.byMunicipio = {};
    data.forEach(item => {
        if (!dashboardData.byMunicipio[item.codMun]) {
            dashboardData.byMunicipio[item.codMun] = {
                total: 0,
                especies: {}
            };
        }
        dashboardData.byMunicipio[item.codMun].total += item.producao;
        dashboardData.byMunicipio[item.codMun].especies[item.especie] = 
            (dashboardData.byMunicipio[item.codMun].especies[item.especie] || 0) + item.producao;
    });
    
    // Group by Estado (from codMun first 2 digits)
    dashboardData.byEstado = {};
    data.forEach(item => {
        const ufCode = item.codMun.toString().substring(0, 2);
        const uf = getUFFromCode(ufCode);
        if (!dashboardData.byEstado[uf]) {
            dashboardData.byEstado[uf] = 0;
        }
        dashboardData.byEstado[uf] += item.producao;
    });
    
    // Group by Região
    dashboardData.byRegiao = {};
    Object.entries(dashboardData.byEstado).forEach(([uf, producao]) => {
        const regiao = UF_TO_REGION[uf] || 'Outros';
        if (!dashboardData.byRegiao[regiao]) {
            dashboardData.byRegiao[regiao] = 0;
        }
        dashboardData.byRegiao[regiao] += producao;
    });
    
    // Prepare filtered data for table
    dashboardData.filteredData = prepareTableData();
}

function getUFFromCode(code) {
    const codeToUF = {
        '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
        '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
        '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
        '41': 'PR', '42': 'SC', '43': 'RS',
        '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF'
    };
    return codeToUF[code] || 'XX';
}

function isLegalAmazonUF(uf) {
    return LEGAL_AMAZON_UFS.includes(uf);
}

function isCurrentScopeLegalAmazon() {
    return scopeState.current === DASHBOARD_SCOPE.LEGAL_AMAZON;
}

function getCurrentScopeTitle() {
    return isCurrentScopeLegalAmazon()
        ? 'Produção de Piscicultura na Amazônia Legal'
        : 'Produção de Piscicultura no Brasil';
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
    tableState.filters.regiao = '';
    mapState.selectedEspecie = '';

    const controls = ['searchInput', 'filterEspecie', 'filterRegiao', 'filterRegionalEspecie', 'mapFilterEspecie'];
    controls.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });

    hideInfoPanel();
}

function destroyCharts() {
    Object.values(dashboardData.charts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    dashboardData.charts = {};
}

function refreshCharts() {
    destroyCharts();
    initCharts();
}

function refreshFilterOptions() {
    populateEspeciesFilter();
    populateRegionalFilter();
    populateMapFilter();
}

function getFeatureUF(feature) {
    const props = feature.properties || {};
    if (props.SIGLA_UF) return props.SIGLA_UF;
    if (props.CD_MUN) return getUFFromCode(props.CD_MUN.toString().substring(0, 2));
    return 'XX';
}

function getScopedMunicipiosGeoJSONData() {
    if (!dashboardData.geojsonData?.features) return dashboardData.geojsonData;

    const cacheKey = scopeState.current;
    if (dashboardData.scopedGeojsonCache[cacheKey]) {
        return dashboardData.scopedGeojsonCache[cacheKey];
    }

    const scopedData = {
        ...dashboardData.geojsonData,
        features: dashboardData.geojsonData.features.filter(feature => {
            if (!isCurrentScopeLegalAmazon()) return true;
            return isLegalAmazonUF(getFeatureUF(feature));
        })
    };

    dashboardData.scopedGeojsonCache[cacheKey] = scopedData;
    return scopedData;
}

function fitMapToLayer(layer) {
    if (!dashboardData.map || !layer || typeof layer.getBounds !== 'function') return;

    const bounds = layer.getBounds();
    if (bounds && typeof bounds.isValid === 'function' && bounds.isValid()) {
        dashboardData.map.fitBounds(bounds);
    }
}

function refreshMapForCurrentScope() {
    if (!dashboardData.map) return;
    switchMapView(mapState.currentView);
}

function applyDashboardScope(scope) {
    scopeState.current = scope;
    dashboardData.raw = getScopedRawData();

    resetScopedControls();
    processData();
    updateScopeUI();
    updateKPIs();
    refreshFilterOptions();
    refreshCharts();
    refreshMapForCurrentScope();
    updateTable();
}

function toggleDashboardScope() {
    const nextScope = isCurrentScopeLegalAmazon()
        ? DASHBOARD_SCOPE.BRAZIL
        : DASHBOARD_SCOPE.LEGAL_AMAZON;
    applyDashboardScope(nextScope);
}

function prepareTableData() {
    const data = [];
    dashboardData.raw.forEach(item => {
        if (item.producao > 0) {
            const ufCode = item.codMun.toString().substring(0, 2);
            const uf = getUFFromCode(ufCode);
            const munInfo = dashboardData.municipiosInfo[item.codMun] || { nome: `Município ${item.codMun}` };
            
            data.push({
                codMun: item.codMun,
                municipio: munInfo.nome,
                estado: uf,
                estadoNome: UF_NAMES[uf] || uf,
                regiao: UF_TO_REGION[uf] || 'Outros',
                especie: item.especie,
                producao: item.producao
            });
        }
    });
    return data;
}

// Update KPIs
function updateKPIs() {
    const totalProducao = Object.values(dashboardData.byEspecie).reduce((a, b) => a + b, 0);
    const totalMunicipios = Object.keys(dashboardData.byMunicipio).filter(m => dashboardData.byMunicipio[m].total > 0).length;
    const totalEspecies = Object.keys(dashboardData.byEspecie).filter(e => dashboardData.byEspecie[e] > 0).length;
    
    // Find top species
    const especiesOrdenadas = Object.entries(dashboardData.byEspecie)
        .sort((a, b) => b[1] - a[1]);
    const especiePrincipal = especiesOrdenadas[0] ? especiesOrdenadas[0][0] : '-';
    
    // Animate KPIs
    animateValue('totalProducao', 0, totalProducao, 1500, formatNumber);
    animateValue('totalMunicipios', 0, totalMunicipios, 1200, formatInteger);
    animateValue('totalEspecies', 0, totalEspecies, 1000, formatInteger);
    document.getElementById('especiePrincipal').textContent = especiePrincipal.split(',')[0];
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

function formatNumber(num) {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(num);
}

function formatInteger(num) {
    return Math.round(num).toLocaleString('pt-BR');
}

function formatDecimal(num) {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

// Initialize Charts
function initCharts() {
    createEspeciesChart();
    createTop5Chart();
    createParticipacaoChart();
    createRegioesChart();
    createEstadosChart();
    createDistribuicaoChart();
}

function getSortedEspeciesData() {
    return Object.entries(dashboardData.byEspecie)
        .filter(([_, value]) => value > 0)
        .sort((a, b) => b[1] - a[1]);
}

function createEspeciesChart() {
    const ctx = document.getElementById('chartEspecies').getContext('2d');
    
    const sortedData = getSortedEspeciesData();
    
    const labels = sortedData.map(d => d[0].length > 25 ? d[0].substring(0, 25) + '...' : d[0]);
    const values = sortedData.map(d => d[1]);
    
    const isPie = chartState.especiesType === 'pie';
    const palette = window.AranduTheme?.getPalette(Math.max(values.length, 1), 0.9) || COLORS.primary.slice(0, values.length);
    const barGradient = window.AranduTheme?.createVerticalGradient([
        window.AranduTheme.withAlpha(COLORS.primary[1], 0.95),
        window.AranduTheme.withAlpha(COLORS.primary[0], 0.72)
    ]) || COLORS.primary[0];

    if (dashboardData.charts.especies) {
        dashboardData.charts.especies.destroy();
    }

    dashboardData.charts.especies = new Chart(ctx, {
        type: isPie ? 'doughnut' : 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Produção (ton)',
                data: values,
                backgroundColor: isPie ? palette : barGradient,
                hoverBackgroundColor: isPie
                    ? window.AranduTheme?.getPalette(Math.max(values.length, 1), 1) || palette
                    : undefined,
                borderColor: isPie ? '#ffffff' : COLORS.primary[0],
                borderWidth: isPie ? 2 : 0,
                borderRadius: isPie ? 0 : 12,
                borderSkipped: false,
                maxBarThickness: isPie ? undefined : 46
            }]
        },
        options: {
            plugins: {
                legend: {
                    display: isPie,
                    position: 'right'
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Produção: ${formatDecimal(ctx.raw)} ton`
                    }
                }
            },
            cutout: isPie ? '62%' : undefined,
            scales: isPie ? undefined : {
                x: {
                    grid: { display: false },
                    ticks: {
                        maxRotation: 35,
                        minRotation: 35
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: {
                        callback: (value) => formatNumber(value)
                    }
                }
            }
        }
    });
}

function createTop5Chart() {
    const ctx = document.getElementById('chartTop5').getContext('2d');
    
    const top5 = getSortedEspeciesData().slice(0, 5);
    
    const labels = top5.map(d => d[0].split(',')[0]);
    const values = top5.map(d => d[1]);
    
    const palette = window.AranduTheme?.getPalette(5, 0.9) || COLORS.primary.slice(0, 5);

    dashboardData.charts.top5 = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: palette,
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
                    labels: {
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((ctx.raw / total) * 100).toFixed(1);
                            return `${formatDecimal(ctx.raw)} ton (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '60%'
        }
    });
}

function createParticipacaoChart() {
    const ctx = document.getElementById('chartParticipacao').getContext('2d');
    
    const total = Object.values(dashboardData.byEspecie).reduce((a, b) => a + b, 0);
    const sorted = getSortedEspeciesData();
    
    const top5 = sorted.slice(0, 5);
    const outros = sorted.slice(5).reduce((sum, [_, v]) => sum + v, 0);
    
    const data = [...top5.map(d => ({ name: d[0].split(',')[0], value: d[1] }))];
    if (outros > 0) {
        data.push({ name: 'Outros', value: outros });
    }
    
    dashboardData.charts.participacao = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: data.map(d => d.name),
            datasets: [{
                data: data.map(d => total > 0 ? ((d.value / total) * 100).toFixed(1) : 0),
                backgroundColor: [...(window.AranduTheme?.getPalette(5, 0.88) || COLORS.primary.slice(0, 5)), '#94a3b8'],
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
                        padding: 12,
                        usePointStyle: true,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${ctx.raw}%`
                    }
                }
            }
        }
    });
}

function createRegioesChart() {
    const ctx = document.getElementById('chartRegioes').getContext('2d');
    
    const regioes = ['Norte', 'Nordeste', 'Sudeste', 'Sul', 'Centro-Oeste'];
    const values = regioes.map(r => dashboardData.byRegiao[r] || 0);
    const colors = regioes.map(r => COLORS.regions[r]);
    
    dashboardData.charts.regioes = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: regioes,
            datasets: [{
                label: 'Produção (ton)',
                data: values,
                backgroundColor: colors,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Produção: ${formatDecimal(ctx.raw)} ton`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: {
                        callback: (value) => formatNumber(value)
                    }
                },
                y: {
                    grid: { display: false }
                }
            }
        }
    });
}

function createEstadosChart() {
    const ctx = document.getElementById('chartEstados').getContext('2d');
    
    const top10 = Object.entries(dashboardData.byEstado)
        .filter(([_, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const labels = top10.map(d => UF_NAMES[d[0]] || d[0]);
    const values = top10.map(d => d[1]);
    const colors = top10.map(d => COLORS.regions[UF_TO_REGION[d[0]]] || '#95a5a6');
    
    dashboardData.charts.estados = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Produção (ton)',
                data: values,
                backgroundColor: colors,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Produção: ${formatDecimal(ctx.raw)} ton`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: {
                        callback: (value) => formatNumber(value)
                    }
                },
                y: {
                    grid: { display: false }
                }
            }
        }
    });
}

function createDistribuicaoChart() {
    const ctx = document.getElementById('chartDistribuicao').getContext('2d');
    
    const total = Object.values(dashboardData.byRegiao).reduce((a, b) => a + b, 0);
    const regioes = ['Norte', 'Nordeste', 'Sudeste', 'Sul', 'Centro-Oeste'];
    
    dashboardData.charts.distribuicao = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: regioes,
            datasets: [{
                data: regioes.map(r => total > 0 ? ((dashboardData.byRegiao[r] || 0) / total * 100).toFixed(1) : 0),
                backgroundColor: regioes.map(r => COLORS.regions[r] + 'cc'),
                borderColor: regioes.map(r => COLORS.regions[r]),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 12,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${ctx.raw}%`
                    }
                }
            },
            scales: {
                r: {
                    ticks: {
                        callback: (value) => value + '%'
                    }
                }
            }
        }
    });
}

// Initialize Table
function initTable() {
    refreshFilterOptions();
    updateTable();
}

function populateEspeciesFilter() {
    const select = document.getElementById('filterEspecie');
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
            const ufCode = item.codMun.toString().substring(0, 2);
            const uf = getUFFromCode(ufCode);
            const regiao = UF_TO_REGION[uf] || 'Outros';
            
            if (!byEstadoFiltered[uf]) byEstadoFiltered[uf] = 0;
            byEstadoFiltered[uf] += item.producao;
            
            if (!byRegiaoFiltered[regiao]) byRegiaoFiltered[regiao] = 0;
            byRegiaoFiltered[regiao] += item.producao;
        }
    });
    
    // Update Regioes Chart
    const regioes = ['Norte', 'Nordeste', 'Sudeste', 'Sul', 'Centro-Oeste'];
    const regioesValues = regioes.map(r => byRegiaoFiltered[r] || 0);
    dashboardData.charts.regioes.data.datasets[0].data = regioesValues;
    dashboardData.charts.regioes.update();
    
    // Update Estados Chart
    const top10Estados = Object.entries(byEstadoFiltered)
        .filter(([_, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    dashboardData.charts.estados.data.labels = top10Estados.map(d => UF_NAMES[d[0]] || d[0]);
    dashboardData.charts.estados.data.datasets[0].data = top10Estados.map(d => d[1]);
    dashboardData.charts.estados.data.datasets[0].backgroundColor = top10Estados.map(d => COLORS.regions[UF_TO_REGION[d[0]]] || '#95a5a6');
    dashboardData.charts.estados.update();
    
    // Update Distribuicao Chart
    const totalRegiao = Object.values(byRegiaoFiltered).reduce((a, b) => a + b, 0);
    const distribuicaoValues = regioes.map(r => totalRegiao > 0 ? (((byRegiaoFiltered[r] || 0) / totalRegiao) * 100).toFixed(1) : 0);
    dashboardData.charts.distribuicao.data.datasets[0].data = distribuicaoValues;
    dashboardData.charts.distribuicao.update();
}

function updateTable() {
    let data = [...dashboardData.filteredData];
    
    // Apply filters
    if (tableState.filters.search) {
        const search = tableState.filters.search.toLowerCase();
        data = data.filter(item => 
            item.municipio.toLowerCase().includes(search) ||
            item.especie.toLowerCase().includes(search) ||
            item.estadoNome.toLowerCase().includes(search)
        );
    }
    
    if (tableState.filters.especie) {
        data = data.filter(item => item.especie === tableState.filters.especie);
    }
    
    if (tableState.filters.regiao) {
        data = data.filter(item => {
            if (tableState.filters.regiao === LEGAL_AMAZON_FILTER_VALUE) {
                return isLegalAmazonUF(item.estado);
            }
            return item.regiao === tableState.filters.regiao;
        });
    }
    
    // Sort
    data.sort((a, b) => {
        let valA = a[tableState.sortColumn];
        let valB = b[tableState.sortColumn];
        
        if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }
        
        if (tableState.sortDirection === 'asc') {
            return valA > valB ? 1 : -1;
        } else {
            return valA < valB ? 1 : -1;
        }
    });
    
    // Pagination
    const totalPages = Math.ceil(data.length / tableState.pageSize);
    const startIndex = (tableState.currentPage - 1) * tableState.pageSize;
    const pageData = data.slice(startIndex, startIndex + tableState.pageSize);
    
    // Render table
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    if (pageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    Nenhum resultado encontrado
                </td>
            </tr>
        `;
    } else {
        pageData.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.municipio}</td>
                <td>${item.estadoNome}</td>
                <td>${item.especie}</td>
                <td style="text-align: right; font-weight: 600;">${formatDecimal(item.producao)}</td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    // Update pagination
    document.getElementById('pageInfo').textContent = `Página ${tableState.currentPage} de ${totalPages || 1}`;
    document.getElementById('btnPrev').disabled = tableState.currentPage <= 1;
    document.getElementById('btnNext').disabled = tableState.currentPage >= totalPages;
}

// Event Listeners
function initEventListeners() {
    // Mobile menu toggle
    document.querySelector('.menu-toggle').addEventListener('click', () => {
        document.querySelector('.mobile-nav').classList.toggle('active');
    });
    
    // Navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
            document.querySelector('.mobile-nav').classList.remove('active');
        });
    });
    
    // Chart type toggle
    document.querySelectorAll('.btn-chart').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const chartType = e.target.dataset.chart;
            document.querySelectorAll('.btn-chart').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            toggleChartType(chartType);
        });
    });
    
    // Search input
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            tableState.filters.search = e.target.value;
            tableState.currentPage = 1;
            updateTable();
        }, 300);
    });
    
    // Filter selects
    document.getElementById('filterEspecie').addEventListener('change', (e) => {
        tableState.filters.especie = e.target.value;
        tableState.currentPage = 1;
        updateTable();
    });
    
    document.getElementById('filterRegiao').addEventListener('change', (e) => {
        tableState.filters.regiao = e.target.value;
        tableState.currentPage = 1;
        updateTable();
    });

    document.getElementById('filterRegionalEspecie').addEventListener('change', (e) => {
        updateRegionalCharts(e.target.value);
    });

    document.getElementById('scopeToggleButton').addEventListener('click', () => {
        toggleDashboardScope();
    });
    
    // Table sorting
    document.querySelectorAll('.data-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;
            if (tableState.sortColumn === column) {
                tableState.sortDirection = tableState.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                tableState.sortColumn = column;
                tableState.sortDirection = 'desc';
            }
            tableState.currentPage = 1;
            updateTable();
        });
    });
    
    // Pagination
    document.getElementById('btnPrev').addEventListener('click', () => {
        if (tableState.currentPage > 1) {
            tableState.currentPage--;
            updateTable();
        }
    });
    
    document.getElementById('btnNext').addEventListener('click', () => {
        tableState.currentPage++;
        updateTable();
    });
}

function toggleChartType(type) {
    if (!['bar', 'pie'].includes(type)) return;
    chartState.especiesType = type;
    createEspeciesChart();
}

// =====================
// MAP FUNCTIONS
// =====================

// Color scale for map
const MAP_COLORS = [
    '#f7fbff',  // 0
    '#deebf7',  // 1-10
    '#c6dbef',  // 10-50
    '#9ecae1',  // 50-100
    '#6baed6',  // 100-500
    '#4292c6',  // 500-1000
    '#2171b5',  // 1000-5000
    '#08519c',  // 5000-10000
    '#08306b'   // >10000
];

const MAP_BREAKS = [0, 1, 10, 50, 100, 500, 1000, 5000, 10000];

function getActiveMapBreaks() {
    return Array.isArray(mapState.breaks) && mapState.breaks.length >= 2
        ? mapState.breaks
        : MAP_BREAKS;
}

function buildDynamicMapBreaks(values) {
    const positiveValues = values
        .map(value => Number(value) || 0)
        .filter(value => value > 0)
        .sort((a, b) => a - b);

    if (!positiveValues.length) {
        return [...MAP_BREAKS];
    }

    const classCount = MAP_COLORS.length - 1;
    const min = positiveValues[0];
    const max = positiveValues[positiveValues.length - 1];

    if (min === max) {
        return [0, ...Array.from({ length: classCount }, (_, index) => min * (index + 1))];
    }

    const safeMin = Math.max(min, 0.0001);
    const minLog = Math.log10(safeMin);
    const maxLog = Math.log10(max);
    const breaks = [0];

    for (let index = 0; index < classCount; index++) {
        const ratio = classCount === 1 ? 0 : index / (classCount - 1);
        breaks.push(10 ** (minLog + ((maxLog - minLog) * ratio)));
    }

    return breaks.map((value, index) => {
        if (index === 0) return 0;
        return Number(value.toPrecision(2));
    });
}

function setMapScale(values) {
    mapState.breaks = buildDynamicMapBreaks(values);
}

function formatLegendValue(value) {
    if (value >= 1000) {
        return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
    }

    return new Intl.NumberFormat('pt-BR', {
        maximumFractionDigits: value >= 100 ? 0 : value >= 10 ? 1 : 2
    }).format(value);
}

function getColorForValue(value) {
    const breaks = getActiveMapBreaks();
    if (value <= 0) return MAP_COLORS[0];

    for (let i = breaks.length - 1; i >= 1; i--) {
        if (value >= breaks[i]) {
            return MAP_COLORS[Math.min(i, MAP_COLORS.length - 1)];
        }
    }

    return MAP_COLORS[1];
}

function initMap() {
    if (!dashboardData.geojsonData) {
        console.warn('GeoJSON data not available');
        document.getElementById('mapContainer').innerHTML = 
            '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#718096;">' +
            '<p>Dados geográficos não disponíveis</p></div>';
        return;
    }
    
    // Initialize Leaflet map
    dashboardData.map = L.map('mapContainer', {
        center: [-14.235, -51.925],
        zoom: 4,
        minZoom: 3,
        maxZoom: 12,
        zoomControl: true,
        preferCanvas: true
    });

    dashboardData.mapRenderer = L.canvas({ padding: 0.5 });
    
    // Add tile layer (optional - can use a simple background)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(dashboardData.map);
    
    // Populate map filter
    populateMapFilter();
    switchMapView(mapState.currentView);
    
    // Add map filter event
    document.getElementById('mapFilterEspecie').addEventListener('change', (e) => {
        mapState.selectedEspecie = e.target.value;
        updateMapColors();
    });
    
    // Add map view toggle events
    document.querySelectorAll('.btn-map-view').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchMapView(view);
        });
    });
}

function calculateMapData(especie) {
    const producao = {};
    
    dashboardData.raw.forEach(item => {
        if (especie === '' || item.especie === especie) {
            if (!producao[item.codMun]) {
                producao[item.codMun] = 0;
            }
            producao[item.codMun] += item.producao;
        }
    });
    
    return producao;
}

function getFeatureStyle(feature, producaoByMunicipio) {
    const codMun = feature.properties.CD_MUN;
    const producao = producaoByMunicipio[codMun] || 0;
    
    return {
        fillColor: getColorForValue(producao),
        weight: 0.1,
        opacity: 1,
        color: '#666',
        fillOpacity: 0.8
    };
}

function highlightFeature(e, producaoByMunicipio) {
    const layer = e.target;
    const props = layer.feature.properties;
    const codMun = props.CD_MUN;
    
    layer.setStyle({
        weight: 2,
        color: '#003366',
        fillOpacity: 0.9
    });
    
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }
    
    // Update info panel
    updateInfoPanel(codMun, props);
    showInfoPanel(e.originalEvent);
    
    mapState.highlightedFeature = layer;
}

function resetHighlight(e) {
    if (dashboardData.geojsonLayer) {
        dashboardData.geojsonLayer.resetStyle(e.target);
    }
    hideInfoPanel();
}

// Info panel positioning functions
function showInfoPanel(event) {
    const panel = document.querySelector('.map-info-panel');
    if (panel) {
        panel.classList.add('visible');
        positionInfoPanel(event);
    }
}

function hideInfoPanel() {
    const panel = document.querySelector('.map-info-panel');
    if (panel) {
        panel.classList.remove('visible');
    }
}

function positionInfoPanel(event) {
    const panel = document.querySelector('.map-info-panel');
    if (!panel || !event) return;
    
    const padding = 15;
    const panelWidth = 280;
    const panelHeight = panel.offsetHeight || 200;
    
    let x = event.clientX + padding;
    let y = event.clientY + padding;
    
    // Adjust if panel goes off right edge
    if (x + panelWidth > window.innerWidth) {
        x = event.clientX - panelWidth - padding;
    }
    
    // Adjust if panel goes off bottom edge
    if (y + panelHeight > window.innerHeight) {
        y = event.clientY - panelHeight - padding;
    }
    
    // Ensure panel doesn't go off left or top edge
    x = Math.max(padding, x);
    y = Math.max(padding, y);
    
    panel.style.left = x + 'px';
    panel.style.top = y + 'px';
}

function zoomToFeature(e) {
    dashboardData.map.fitBounds(e.target.getBounds());
}

function updateInfoPanel(codMun, props) {
    const infoMunicipio = document.getElementById('infoMunicipio');
    const infoDetails = document.getElementById('infoDetails');
    
    infoMunicipio.textContent = props.NM_MUN || 'Município';
    
    // Get production data for this municipality
    const munData = dashboardData.byMunicipio[codMun];
    
    if (munData && munData.total > 0) {
        // Get species for this municipality
        const especies = Object.entries(munData.especies || {})
            .filter(([_, v]) => v > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        let html = `
            <div class="info-row">
                <span class="label">Estado:</span>
                <span class="value">${props.NM_UF || props.SIGLA_UF || '-'}</span>
            </div>
            <div class="info-row">
                <span class="label">Região:</span>
                <span class="value">${props.NM_REGIA || '-'}</span>
            </div>
        `;
        
        if (especies.length > 0) {
            html += '<div style="margin-top: 12px;"><strong style="font-size: 0.8125rem; color: #4a5568;">Principais Espécies:</strong></div>';
            especies.forEach(([especie, prod]) => {
                html += `
                    <div class="info-row">
                        <span class="label">${especie.split(',')[0]}</span>
                        <span class="value">${formatDecimal(prod)} ton</span>
                    </div>
                `;
            });
        }
        
        html += `
            <div class="info-total">
                <div class="info-row">
                    <span class="label">Total:</span>
                    <span class="value">${formatDecimal(munData.total)} ton</span>
                </div>
            </div>
        `;
        
        infoDetails.innerHTML = html;
    } else {
        infoDetails.innerHTML = `
            <div class="info-row">
                <span class="label">Estado:</span>
                <span class="value">${props.NM_UF || props.SIGLA_UF || '-'}</span>
            </div>
            <div class="info-row">
                <span class="label">Região:</span>
                <span class="value">${props.NM_REGIA || '-'}</span>
            </div>
            <p style="margin-top: 12px; color: #718096; font-style: italic;">
                Sem dados de produção registrados
            </p>
        `;
    }
}

function populateMapFilter() {
    const select = document.getElementById('mapFilterEspecie');
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

function updateMapColors() {
    switchMapView(mapState.currentView);
}

// Switch between map views
function switchMapView(view) {
    mapState.currentView = view;
    hideInfoPanel();
    
    // Update button states
    document.querySelectorAll('.btn-map-view').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    // Clear all layers except base
    clearMapLayers();
    
    // Create the selected view
    const producaoByMunicipio = calculateMapData(mapState.selectedEspecie);
    const producaoByEstado = Object.entries(dashboardData.byEstado).reduce((accumulator, [uf]) => {
        accumulator[uf] = 0;
        return accumulator;
    }, {});

    dashboardData.raw.forEach(item => {
        if (mapState.selectedEspecie === '' || item.especie === mapState.selectedEspecie) {
            const uf = getUFFromCode(item.codMun.toString().substring(0, 2));
            producaoByEstado[uf] = (producaoByEstado[uf] || 0) + item.producao;
        }
    });
    
    switch (view) {
        case 'municipios':
            setMapScale(Object.values(producaoByMunicipio));
            createMunicipiosLayer(producaoByMunicipio);
            createMapLegend('choropleth');
            break;
        case 'estados':
            setMapScale(Object.values(producaoByEstado));
            createEstadosLayer(producaoByEstado);
            createMapLegend('choropleth');
            break;
        case 'bolhas':
            setMapScale(Object.values(producaoByMunicipio));
            createBubblesLayer(producaoByMunicipio);
            createMapLegend('bubbles');
            break;
        case 'heatmap':
            setMapScale(Object.values(producaoByMunicipio));
            createHeatmapLayer(producaoByMunicipio);
            createMapLegend('heatmap');
            break;
    }
}

function clearMapLayers() {
    if (dashboardData.geojsonLayer) {
        dashboardData.map.removeLayer(dashboardData.geojsonLayer);
        dashboardData.geojsonLayer = null;
    }
    if (dashboardData.estadosLayer) {
        dashboardData.map.removeLayer(dashboardData.estadosLayer);
        dashboardData.estadosLayer = null;
    }
    if (dashboardData.bubblesLayer) {
        dashboardData.map.removeLayer(dashboardData.bubblesLayer);
        dashboardData.bubblesLayer = null;
    }
    if (dashboardData.heatmapLayer) {
        dashboardData.map.removeLayer(dashboardData.heatmapLayer);
        dashboardData.heatmapLayer = null;
    }
}

function createMunicipiosLayer(producaoByMunicipio) {
    dashboardData.geojsonLayer = L.geoJSON(getScopedMunicipiosGeoJSONData(), {
        style: (feature) => getFeatureStyle(feature, producaoByMunicipio),
        onEachFeature: (feature, layer) => {
            layer.on({
                mouseover: (e) => highlightFeature(e, producaoByMunicipio),
                mousemove: (e) => positionInfoPanel(e.originalEvent),
                mouseout: resetHighlight,
                click: (e) => zoomToFeature(e)
            });
        }
    }).addTo(dashboardData.map);

    fitMapToLayer(dashboardData.geojsonLayer);
}

function createEstadosLayer(producaoByEstado = {}) {
    // Use the dedicated UF GeoJSON if available
    let estadosData;
    
    if (window.GEOJSON_UF_DATA && window.GEOJSON_UF_DATA.features) {
        // Use the official UF GeoJSON
        estadosData = {
            type: 'FeatureCollection',
            features: window.GEOJSON_UF_DATA.features
                .filter(feature => !isCurrentScopeLegalAmazon() || isLegalAmazonUF(feature.properties.SIGLA_UF))
                .map(feature => ({
                    type: 'Feature',
                    properties: {
                        SIGLA_UF: feature.properties.SIGLA_UF,
                        NM_UF: feature.properties.NM_UF,
                        NM_REGIA: feature.properties.NM_REGIA,
                        AREA_KM2: feature.properties.AREA_KM2,
                        producao: producaoByEstado[feature.properties.SIGLA_UF] || 0
                    },
                    geometry: feature.geometry
                }))
        };
    } else {
        // Fallback: Create state boundaries by merging municipalities
        const featuresByUF = {};
        getScopedMunicipiosGeoJSONData().features.forEach(feature => {
            const uf = feature.properties.SIGLA_UF;
            if (!featuresByUF[uf]) {
                featuresByUF[uf] = {
                    type: 'Feature',
                    properties: {
                        SIGLA_UF: uf,
                        NM_UF: feature.properties.NM_UF,
                        NM_REGIA: feature.properties.NM_REGIA,
                        producao: producaoByEstado[uf] || 0
                    },
                    geometry: {
                        type: 'MultiPolygon',
                        coordinates: []
                    }
                };
            }
            
            // Add coordinates
            if (feature.geometry.type === 'Polygon') {
                featuresByUF[uf].geometry.coordinates.push(feature.geometry.coordinates);
            } else if (feature.geometry.type === 'MultiPolygon') {
                featuresByUF[uf].geometry.coordinates.push(...feature.geometry.coordinates);
            }
        });
        
        estadosData = {
            type: 'FeatureCollection',
            features: Object.values(featuresByUF)
        };
    }

    dashboardData.estadosLayer = L.geoJSON(estadosData, {
        style: (feature) => {
            const producao = feature.properties.producao || 0;
            return {
                fillColor: getColorForValue(producao),
                weight: 2,
                opacity: 1,
                color: '#003366',
                fillOpacity: 0.75
            };
        },
        onEachFeature: (feature, layer) => {
            const props = feature.properties;
            layer.on({
                mouseover: (e) => {
                    e.target.setStyle({
                        weight: 3,
                        color: '#000',
                        fillOpacity: 0.9
                    });
                    updateInfoPanelEstado(props);
                    showInfoPanel(e.originalEvent);
                },
                mousemove: (e) => positionInfoPanel(e.originalEvent),
                mouseout: (e) => {
                    dashboardData.estadosLayer.resetStyle(e.target);
                    hideInfoPanel();
                },
                click: (e) => {
                    dashboardData.map.fitBounds(e.target.getBounds());
                }
            });
        }
    }).addTo(dashboardData.map);

    fitMapToLayer(dashboardData.estadosLayer);
}

function updateInfoPanelEstado(props) {
    const infoMunicipio = document.getElementById('infoMunicipio');
    const infoDetails = document.getElementById('infoDetails');
    
    infoMunicipio.textContent = props.NM_UF || props.SIGLA_UF || 'Estado';
    
    const uf = props.SIGLA_UF;
    const estadoData = dashboardData.byEstado[uf] || 0;
    
    // Get top species for this state
    const especiesByEstado = {};
    dashboardData.raw.forEach(item => {
        const itemUf = getUFFromCode(item.codMun.toString().substring(0, 2));
        if (itemUf === uf && (mapState.selectedEspecie === '' || item.especie === mapState.selectedEspecie)) {
            if (!especiesByEstado[item.especie]) {
                especiesByEstado[item.especie] = 0;
            }
            especiesByEstado[item.especie] += item.producao;
        }
    });
    
    const topEspecies = Object.entries(especiesByEstado)
        .filter(([_, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    let html = `
        <div class="info-row">
            <span class="label">Região:</span>
            <span class="value">${props.NM_REGIA || '-'}</span>
        </div>
    `;
    
    if (topEspecies.length > 0) {
        html += '<div style="margin-top: 12px;"><strong style="font-size: 0.8125rem; color: #4a5568;">Principais Espécies:</strong></div>';
        topEspecies.forEach(([especie, prod]) => {
            html += `
                <div class="info-row">
                    <span class="label">${especie.split(',')[0]}</span>
                    <span class="value">${formatDecimal(prod)} ton</span>
                </div>
            `;
        });
    }
    
    const totalEstado = mapState.selectedEspecie === '' ? estadoData : (props.producao || 0);
    
    html += `
        <div class="info-total">
            <div class="info-row">
                <span class="label">Total:</span>
                <span class="value">${formatDecimal(totalEstado)} ton</span>
            </div>
        </div>
    `;
    
    infoDetails.innerHTML = html;
}

function createBubblesLayer(producaoByMunicipio) {
    // Calculate centroids from municipalities with production
    const markers = [];
    
    getScopedMunicipiosGeoJSONData().features.forEach(feature => {
        const codMun = feature.properties.CD_MUN;
        const producao = producaoByMunicipio[codMun] || 0;
        
        if (producao > 0) {
            const centroid = getFeatureCentroid(feature);
            if (centroid) {
                markers.push({
                    lat: centroid[1],
                    lng: centroid[0],
                    producao: producao,
                    properties: feature.properties
                });
            }
        }
    });
    
    // Create circle markers
    dashboardData.bubblesLayer = L.featureGroup();

    if (!markers.length) {
        dashboardData.bubblesLayer.addTo(dashboardData.map);
        return;
    }
    
    // Calculate max for scaling
    const maxProd = Math.max(...markers.map(m => m.producao));
    
    markers.forEach(marker => {
        // Scale radius: min 3, max 30
        const radius = 3 + (marker.producao / maxProd) * 27;
        
        const circle = L.circleMarker([marker.lat, marker.lng], {
            radius: radius,
            fillColor: getColorForValue(marker.producao),
            color: '#003366',
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.68,
            renderer: dashboardData.mapRenderer
        });
        
        circle.on('mouseover', (e) => {
            circle.setStyle({ fillOpacity: 0.9, weight: 2 });
            updateInfoPanel(marker.properties.CD_MUN, marker.properties);
            showInfoPanel(e.originalEvent);
        });
        
        circle.on('mousemove', (e) => {
            positionInfoPanel(e.originalEvent);
        });
        
        circle.on('mouseout', () => {
            circle.setStyle({ fillOpacity: 0.6, weight: 1 });
            hideInfoPanel();
        });
        
        circle.on('click', () => {
            dashboardData.map.setView([marker.lat, marker.lng], 8);
        });
        
        dashboardData.bubblesLayer.addLayer(circle);
    });
    
    dashboardData.bubblesLayer.addTo(dashboardData.map);
    fitMapToLayer(dashboardData.bubblesLayer);
}

function getFeatureCentroid(feature) {
    const codMun = feature?.properties?.CD_MUN;
    if (codMun && dashboardData.municipiosCentroids[codMun]) {
        return dashboardData.municipiosCentroids[codMun];
    }

    const centroid = getCentroid(feature?.geometry);
    if (codMun && centroid) {
        dashboardData.municipiosCentroids[codMun] = centroid;
    }

    return centroid;
}

function getCentroid(geometry) {
    try {
        let coords = [];
        
        if (geometry.type === 'Polygon') {
            coords = geometry.coordinates[0];
        } else if (geometry.type === 'MultiPolygon') {
            const rings = geometry.coordinates.map(polygon => polygon[0] || []);
            coords = rings.sort((a, b) => b.length - a.length)[0] || [];
        }
        
        if (coords.length === 0) return null;
        
        let sumX = 0, sumY = 0;
        coords.forEach(coord => {
            sumX += coord[0];
            sumY += coord[1];
        });
        
        return [sumX / coords.length, sumY / coords.length];
    } catch (e) {
        return null;
    }
}

function createHeatmapLayer(producaoByMunicipio) {
    // Create heat points based on production
    const heatPoints = [];
    
    getScopedMunicipiosGeoJSONData().features.forEach(feature => {
        const codMun = feature.properties.CD_MUN;
        const producao = producaoByMunicipio[codMun] || 0;
        
        if (producao > 0) {
            const centroid = getFeatureCentroid(feature);
            if (centroid) {
                // Normalize intensity
                heatPoints.push({
                    lat: centroid[1],
                    lng: centroid[0],
                    intensity: Math.log10(producao + 1),
                    producao: producao,
                    properties: feature.properties
                });
            }
        }
    });

    dashboardData.heatmapLayer = L.featureGroup();

    if (!heatPoints.length) {
        dashboardData.heatmapLayer.addTo(dashboardData.map);
        return;
    }

    const maxIntensity = Math.max(...heatPoints.map(point => point.intensity));
    const heatColors = [
        'rgba(0, 0, 255, 0.2)',
        'rgba(0, 255, 255, 0.3)',
        'rgba(0, 255, 0, 0.4)',
        'rgba(255, 255, 0, 0.5)',
        'rgba(255, 128, 0, 0.6)',
        'rgba(255, 0, 0, 0.7)'
    ];

    heatPoints.forEach(point => {
        const normalizedIntensity = maxIntensity > 0 ? point.intensity / maxIntensity : 0;
        const colorIndex = Math.min(Math.floor(normalizedIntensity * heatColors.length), heatColors.length - 1);
        const radius = 10 + (normalizedIntensity * 25);

        const circle = L.circle([point.lat, point.lng], {
            radius: radius * 1000,
            fillColor: heatColors[colorIndex].replace(/[\d.]+\)$/, '0.5)'),
            color: 'transparent',
            fillOpacity: 0.5,
            renderer: dashboardData.mapRenderer
        });

        circle.on('mouseover', (e) => {
            updateInfoPanel(point.properties.CD_MUN, point.properties);
            showInfoPanel(e.originalEvent);
        });

        circle.on('mousemove', (e) => {
            positionInfoPanel(e.originalEvent);
        });

        circle.on('mouseout', () => {
            hideInfoPanel();
        });

        dashboardData.heatmapLayer.addLayer(circle);
    });

    dashboardData.heatmapLayer.addTo(dashboardData.map);
    fitMapToLayer(dashboardData.heatmapLayer);
}

function updateEstadosView() {
    if (dashboardData.estadosLayer) {
        switchMapView('estados');
    }
}

function updateBubblesView() {
    if (dashboardData.bubblesLayer) {
        switchMapView('bolhas');
    }
}

function updateHeatmapView() {
    if (dashboardData.heatmapLayer) {
        switchMapView('heatmap');
    }
}

function createMapLegend(type = 'choropleth') {
    const legendContainer = document.querySelector('.legend-scale');
    if (!legendContainer) return;
    
    legendContainer.innerHTML = '';
    
    if (type === 'choropleth') {
        const breaks = getActiveMapBreaks();
        const labels = ['0'];

        for (let index = 1; index < breaks.length; index++) {
            const start = breaks[index];
            const next = breaks[index + 1];
            labels.push(next ? `${formatLegendValue(start)} - ${formatLegendValue(next)}` : `>= ${formatLegendValue(start)}`);
        }
        
        MAP_COLORS.forEach((color, index) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `
                <div class="legend-color" style="background-color: ${color};"></div>
                <span class="legend-label">${labels[index]}</span>
            `;
            legendContainer.appendChild(item);
        });
    } else if (type === 'bubbles') {
        const sizes = ['Baixa', 'Média', 'Alta'];
        const radii = [8, 16, 24];
        
        sizes.forEach((label, index) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `
                <div class="legend-color" style="width: ${radii[index]}px; height: ${radii[index]}px; border-radius: 50%; background-color: ${MAP_COLORS[3 + index * 2]};"></div>
                <span class="legend-label">${label}</span>
            `;
            legendContainer.appendChild(item);
        });
    } else if (type === 'heatmap') {
        const heatLabels = ['Baixa', 'Média', 'Alta'];
        const heatColors = ['rgba(0, 128, 255, 0.6)', 'rgba(255, 255, 0, 0.6)', 'rgba(255, 0, 0, 0.6)'];
        
        heatLabels.forEach((label, index) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `
                <div class="legend-color" style="background: ${heatColors[index]};"></div>
                <span class="legend-label">${label}</span>
            `;
            legendContainer.appendChild(item);
        });
    }
}

// Hide loading overlay
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('hidden');
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 350);
}

// Expose for debugging
window.dashboardData = dashboardData;
