/**
 * ARANDU Dashboard - Potencial Bruto de Biometano
 * Cálculo baseado em resíduos de piscicultura
 * 
 * Metodologia FGV Energia:
 * - Resíduos: 48,8% do peso do peixe
 * - Biometano: 0,1224 Nm³ por kg de resíduo
 */

// Constantes de conversão
const FATOR_RESIDUOS = 0.488;       // 48,8% de resíduos
const FATOR_BIOGAS = 0.1224;        // 0,1224 Nm³/kg de resíduo
const FATOR_BIOGAS_TOTAL = FATOR_RESIDUOS * FATOR_BIOGAS * 1000; // Por tonelada de peixe -> Nm³

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
    scopedGeojsonCache: {},
    mapRenderer: null
};

let tableState = {
    currentPage: 1,
    pageSize: 15,
    sortColumn: 'biogas',
    sortDirection: 'desc',
    filters: {
        search: '',
        especie: '',
        regiao: ''
    }
};

let mapState = {
    selectedEspecie: '',
    highlightedFeature: null
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

// Process Data - Calculate biogas potential
function processData() {
    const data = dashboardData.raw;
    
    // Group by Espécie with biogas calculation
    dashboardData.byEspecie = {};
    data.forEach(item => {
        if (!dashboardData.byEspecie[item.especie]) {
            dashboardData.byEspecie[item.especie] = {
                producao: 0,
                residuos: 0,
                biogas: 0
            };
        }
        const residuos = item.producao * FATOR_RESIDUOS;
        const biogas = residuos * FATOR_BIOGAS * 1000; // Convert ton to kg
        
        dashboardData.byEspecie[item.especie].producao += item.producao;
        dashboardData.byEspecie[item.especie].residuos += residuos;
        dashboardData.byEspecie[item.especie].biogas += biogas;
    });
    
    // Group by Município
    dashboardData.byMunicipio = {};
    data.forEach(item => {
        if (!dashboardData.byMunicipio[item.codMun]) {
            dashboardData.byMunicipio[item.codMun] = {
                producao: 0,
                residuos: 0,
                biogas: 0,
                especies: {}
            };
        }
        const residuos = item.producao * FATOR_RESIDUOS;
        const biogas = residuos * FATOR_BIOGAS * 1000;
        
        dashboardData.byMunicipio[item.codMun].producao += item.producao;
        dashboardData.byMunicipio[item.codMun].residuos += residuos;
        dashboardData.byMunicipio[item.codMun].biogas += biogas;
        
        if (!dashboardData.byMunicipio[item.codMun].especies[item.especie]) {
            dashboardData.byMunicipio[item.codMun].especies[item.especie] = { producao: 0, biogas: 0 };
        }
        dashboardData.byMunicipio[item.codMun].especies[item.especie].producao += item.producao;
        dashboardData.byMunicipio[item.codMun].especies[item.especie].biogas += biogas;
    });
    
    // Group by Estado
    dashboardData.byEstado = {};
    data.forEach(item => {
        const ufCode = item.codMun.toString().substring(0, 2);
        const uf = getUFFromCode(ufCode);
        
        if (!dashboardData.byEstado[uf]) {
            dashboardData.byEstado[uf] = {
                producao: 0,
                residuos: 0,
                biogas: 0
            };
        }
        const residuos = item.producao * FATOR_RESIDUOS;
        const biogas = residuos * FATOR_BIOGAS * 1000;
        
        dashboardData.byEstado[uf].producao += item.producao;
        dashboardData.byEstado[uf].residuos += residuos;
        dashboardData.byEstado[uf].biogas += biogas;
    });
    
    // Group by Região
    dashboardData.byRegiao = {};
    Object.entries(dashboardData.byEstado).forEach(([uf, data]) => {
        const regiao = UF_TO_REGION[uf] || 'Outros';
        if (!dashboardData.byRegiao[regiao]) {
            dashboardData.byRegiao[regiao] = {
                producao: 0,
                residuos: 0,
                biogas: 0
            };
        }
        dashboardData.byRegiao[regiao].producao += data.producao;
        dashboardData.byRegiao[regiao].residuos += data.residuos;
        dashboardData.byRegiao[regiao].biogas += data.biogas;
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
        ? 'Potencial Bruto de Biometano na Amazônia Legal'
        : 'Potencial Bruto de Biometano';
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

function renderMapLayer(shouldFit = true) {
    if (!dashboardData.map || !dashboardData.geojsonData) return;

    const biogasByMunicipio = calculateMapData(mapState.selectedEspecie);

    if (dashboardData.geojsonLayer) {
        dashboardData.map.removeLayer(dashboardData.geojsonLayer);
    }

    dashboardData.geojsonLayer = L.geoJSON(getScopedMunicipiosGeoJSONData(), {
        style: (feature) => getFeatureStyle(feature, biogasByMunicipio),
        onEachFeature: (feature, layer) => {
            layer.on({
                mouseover: (e) => highlightFeature(e, biogasByMunicipio),
                mousemove: (e) => positionInfoPanel(e.originalEvent),
                mouseout: resetHighlight,
                click: (e) => zoomToFeature(e)
            });
        }
    }).addTo(dashboardData.map);

    if (shouldFit) {
        fitMapToLayer(dashboardData.geojsonLayer);
    }
}

function refreshMapForCurrentScope() {
    renderMapLayer(true);
    createMapLegend();
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
            
            const residuos = item.producao * FATOR_RESIDUOS;
            const biogas = residuos * FATOR_BIOGAS * 1000;
            
            data.push({
                codMun: item.codMun,
                municipio: munInfo.nome,
                estado: uf,
                estadoNome: UF_NAMES[uf] || uf,
                regiao: UF_TO_REGION[uf] || 'Outros',
                especie: item.especie,
                producao: item.producao,
                residuos: residuos,
                biogas: biogas
            });
        }
    });
    return data;
}

// Update KPIs with animation
function updateKPIs() {
    const totalProducao = Object.values(dashboardData.byEspecie).reduce((a, b) => a + b.producao, 0);
    const totalResiduos = Object.values(dashboardData.byEspecie).reduce((a, b) => a + b.residuos, 0);
    const totalBiogas = Object.values(dashboardData.byEspecie).reduce((a, b) => a + b.biogas, 0);
    
    // Find top species by biogas potential
    const especiesOrdenadas = Object.entries(dashboardData.byEspecie)
        .sort((a, b) => b[1].biogas - a[1].biogas);
    const especiePrincipal = especiesOrdenadas[0] ? especiesOrdenadas[0][0] : '-';
    
    // Animate KPIs
    animateValue('totalProducao', 0, totalProducao, 1500, formatNumber);
    animateValue('totalResiduos', 0, totalResiduos, 1200, formatNumber);
    animateValue('totalBiogas', 0, totalBiogas, 1500, formatNumberLarge);
    document.getElementById('especiePrincipal').textContent = especiePrincipal.split(',')[0];
}

function animateValue(elementId, start, end, duration, formatter) {
    const element = document.getElementById(elementId);
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
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

function formatNumberLarge(num) {
    if (num >= 1000000000) {
        return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(num / 1000000000) + ' B';
    } else if (num >= 1000000) {
        return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(num / 1000000) + ' M';
    }
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
    createComparativoChart();
    createRegioesChart();
    createEstadosChart();
    createDistribuicaoChart();
}

function getSortedEspeciesData() {
    return Object.entries(dashboardData.byEspecie)
        .filter(([_, value]) => value.biogas > 0)
        .sort((a, b) => b[1].biogas - a[1].biogas);
}

function createEspeciesChart() {
    const ctx = document.getElementById('chartEspecies').getContext('2d');
    
    const sortedData = getSortedEspeciesData();
    
    const labels = sortedData.map(d => d[0].length > 25 ? d[0].substring(0, 25) + '...' : d[0]);
    const values = sortedData.map(d => d[1].biogas);
    
    const isPie = chartState.especiesType === 'pie';
    const palette = window.AranduTheme?.getPalette(Math.max(values.length, 1), 0.9) || COLORS.primary.slice(0, values.length);
    const barGradient = window.AranduTheme?.createVerticalGradient([
        window.AranduTheme.withAlpha(COLORS.primary[4], 0.92),
        window.AranduTheme.withAlpha(COLORS.primary[1], 0.72)
    ]) || COLORS.primary[1];

    if (dashboardData.charts.especies) {
        dashboardData.charts.especies.destroy();
    }

    dashboardData.charts.especies = new Chart(ctx, {
        type: isPie ? 'doughnut' : 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Potencial Biometano (Nm³)',
                data: values,
                backgroundColor: isPie ? palette : barGradient,
                hoverBackgroundColor: isPie
                    ? window.AranduTheme?.getPalette(Math.max(values.length, 1), 1) || palette
                    : undefined,
                borderColor: isPie ? '#ffffff' : COLORS.primary[1],
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
                        label: (ctx) => `Biometano: ${formatNumberLarge(ctx.raw)} Nm³`
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
                        callback: (value) => formatNumberLarge(value)
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
    const values = top5.map(d => d[1].biogas);
    
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
                            return `${formatNumberLarge(ctx.raw)} Nm³ (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '60%'
        }
    });
}

function createComparativoChart() {
    const ctx = document.getElementById('chartComparativo').getContext('2d');
    
    const totalProducao = Object.values(dashboardData.byEspecie).reduce((a, b) => a + b.producao, 0);
    const totalResiduos = Object.values(dashboardData.byEspecie).reduce((a, b) => a + b.residuos, 0);
    const totalBiogas = Object.values(dashboardData.byEspecie).reduce((a, b) => a + b.biogas, 0) / 1000; // Convert to thousands
    
    dashboardData.charts.comparativo = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Produção (ton)', 'Resíduos (ton)', 'Biometano (mil Nm³)'],
            datasets: [{
                data: [totalProducao, totalResiduos, totalBiogas],
                backgroundColor: ['#003366', '#f39c12', '#2ecc71'],
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const label = ctx.label;
                            if (label.includes('Biometano')) {
                                return `${formatDecimal(ctx.raw * 1000)} Nm³`;
                            }
                            return `${formatDecimal(ctx.raw)} ton`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false }
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

function createRegioesChart() {
    const ctx = document.getElementById('chartRegioes').getContext('2d');
    
    const regioes = ['Norte', 'Nordeste', 'Sudeste', 'Sul', 'Centro-Oeste'];
    const values = regioes.map(r => dashboardData.byRegiao[r]?.biogas || 0);
    const colors = regioes.map(r => COLORS.regions[r]);
    
    dashboardData.charts.regioes = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: regioes,
            datasets: [{
                label: 'Potencial Biometano (Nm³)',
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
                        label: (ctx) => `Biometano: ${formatNumberLarge(ctx.raw)} Nm³`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: {
                        callback: (value) => formatNumberLarge(value)
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
        .filter(([_, v]) => v.biogas > 0)
        .sort((a, b) => b[1].biogas - a[1].biogas)
        .slice(0, 10);
    
    const labels = top10.map(d => UF_NAMES[d[0]] || d[0]);
    const values = top10.map(d => d[1].biogas);
    const colors = top10.map(d => COLORS.regions[UF_TO_REGION[d[0]]] || '#95a5a6');
    
    dashboardData.charts.estados = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Potencial Biometano (Nm³)',
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
                        label: (ctx) => `Biometano: ${formatNumberLarge(ctx.raw)} Nm³`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: {
                        callback: (value) => formatNumberLarge(value)
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
    
    const total = Object.values(dashboardData.byRegiao).reduce((a, b) => a + b.biogas, 0);
    const regioes = ['Norte', 'Nordeste', 'Sudeste', 'Sul', 'Centro-Oeste'];
    
    dashboardData.charts.distribuicao = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: regioes,
            datasets: [{
                data: regioes.map(r => total > 0 ? (((dashboardData.byRegiao[r]?.biogas || 0) / total) * 100).toFixed(1) : 0),
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
    const mapSelect = document.getElementById('mapFilterEspecie');

    select.innerHTML = '<option value="">Todas as Espécies</option>';
    mapSelect.innerHTML = '<option value="">Todas as Espécies</option>';
    
    const especies = Object.keys(dashboardData.byEspecie)
        .filter(e => dashboardData.byEspecie[e].biogas > 0)
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    
    especies.forEach(esp => {
        const option = document.createElement('option');
        option.value = esp;
        option.textContent = esp;
        select.appendChild(option);
        
        const mapOption = option.cloneNode(true);
        mapSelect.appendChild(mapOption);
    });
}

function populateRegionalFilter() {
    const select = document.getElementById('filterRegionalEspecie');
    if (!select) return;

    select.innerHTML = '<option value="">Todas as Espécies</option>';
    
    const especies = Object.keys(dashboardData.byEspecie)
        .filter(e => dashboardData.byEspecie[e].biogas > 0)
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
            
            const residuos = item.producao * FATOR_RESIDUOS;
            const biogas = residuos * FATOR_BIOGAS * 1000;
            
            if (!byEstadoFiltered[uf]) byEstadoFiltered[uf] = 0;
            byEstadoFiltered[uf] += biogas;
            
            if (!byRegiaoFiltered[regiao]) byRegiaoFiltered[regiao] = 0;
            byRegiaoFiltered[regiao] += biogas;
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
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
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
                <td style="text-align: right;">${formatDecimal(item.producao)}</td>
                <td style="text-align: right;">${formatDecimal(item.residuos)}</td>
                <td style="text-align: right; font-weight: 600;">${formatDecimal(item.biogas)}</td>
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
            if (!e.target.classList.contains('nav-link-page')) {
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                e.target.classList.add('active');
            }
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
    
    // Map filter
    document.getElementById('mapFilterEspecie').addEventListener('change', (e) => {
        mapState.selectedEspecie = e.target.value;
        updateMapColors();
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

const MAP_COLORS = [
    '#f7fbff',
    '#deebf7',
    '#c6dbef',
    '#9ecae1',
    '#6baed6',
    '#4292c6',
    '#2171b5',
    '#08519c',
    '#08306b'
];

const MAP_BREAKS = [0, 1000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000];

function getColorForValue(value) {
    if (value <= 0) return MAP_COLORS[0];
    for (let i = MAP_BREAKS.length - 1; i >= 0; i--) {
        if (value >= MAP_BREAKS[i]) {
            return MAP_COLORS[Math.min(i + 1, MAP_COLORS.length - 1)];
        }
    }
    return MAP_COLORS[0];
}

function initMap() {
    if (!dashboardData.geojsonData) {
        console.warn('GeoJSON data not available');
        document.getElementById('mapContainer').innerHTML = 
            '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#718096;">' +
            '<p>Dados geográficos não disponíveis</p></div>';
        return;
    }
    
    dashboardData.map = L.map('mapContainer', {
        center: [-14.235, -51.925],
        zoom: 4,
        minZoom: 3,
        maxZoom: 12,
        zoomControl: true,
        preferCanvas: true
    });

    dashboardData.mapRenderer = L.canvas({ padding: 0.5 });
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(dashboardData.map);

    refreshMapForCurrentScope();
}

function calculateMapData(especie) {
    const biogas = {};
    
    dashboardData.raw.forEach(item => {
        if (especie === '' || item.especie === especie) {
            if (!biogas[item.codMun]) {
                biogas[item.codMun] = 0;
            }
            const residuos = item.producao * FATOR_RESIDUOS;
            biogas[item.codMun] += residuos * FATOR_BIOGAS * 1000;
        }
    });
    
    return biogas;
}

function getFeatureStyle(feature, biogasByMunicipio) {
    const codMun = feature.properties.CD_MUN;
    const biogas = biogasByMunicipio[codMun] || 0;
    
    return {
        fillColor: getColorForValue(biogas),
        weight: 0.1,
        opacity: 1,
        color: '#666',
        fillOpacity: 0.8
    };
}

function highlightFeature(e, biogasByMunicipio) {
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
    
    if (x + panelWidth > window.innerWidth) {
        x = event.clientX - panelWidth - padding;
    }
    
    if (y + panelHeight > window.innerHeight) {
        y = event.clientY - panelHeight - padding;
    }
    
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
    
    const munData = dashboardData.byMunicipio[codMun];
    
    if (munData && munData.biogas > 0) {
        const especies = Object.entries(munData.especies || {})
            .filter(([_, v]) => v.biogas > 0)
            .sort((a, b) => b[1].biogas - a[1].biogas)
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
            <div class="info-row">
                <span class="label">Produção:</span>
                <span class="value">${formatDecimal(munData.producao)} ton</span>
            </div>
            <div class="info-row">
                <span class="label">Resíduos:</span>
                <span class="value">${formatDecimal(munData.residuos)} ton</span>
            </div>
        `;
        
        if (especies.length > 0) {
            html += '<div style="margin-top: 12px;"><strong style="font-size: 0.8125rem; color: #4a5568;">Top Espécies (Biometano):</strong></div>';
            especies.forEach(([especie, data]) => {
                html += `
                    <div class="info-row">
                        <span class="label">${especie.split(',')[0]}</span>
                        <span class="value">${formatNumberLarge(data.biogas)} Nm³</span>
                    </div>
                `;
            });
        }
        
        html += `
            <div class="info-total">
                <div class="info-row">
                    <span class="label">Potencial Total:</span>
                    <span class="value">${formatNumberLarge(munData.biogas)} Nm³</span>
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

function updateMapColors() {
    renderMapLayer(false);
}

function createMapLegend() {
    const legendContainer = document.querySelector('.legend-scale');
    if (!legendContainer) return;
    
    legendContainer.innerHTML = '';
    
    const labels = ['0', '1k', '10k', '50k', '100k', '500k', '1M', '5M', '>10M'];
    
    MAP_COLORS.forEach((color, index) => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
            <div class="legend-color" style="background-color: ${color};"></div>
            <span class="legend-label">${labels[index]}</span>
        `;
        legendContainer.appendChild(item);
    });
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
