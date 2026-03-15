/**
 * ARANDU Dashboard - Análise de Estabelecimentos
 * Dados da Receita Federal - Aquicultura e Pesca
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
    situacao: {
        '02': '#2ecc71', // Ativa
        '03': '#f39c12', // Suspensa
        '04': '#e74c3c', // Inapta
        '08': '#95a5a6'  // Baixada
    }
};

// UF Names
const UF_NAMES = {
    'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas', 'BA': 'Bahia', 'CE': 'Ceará',
    'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás', 'MA': 'Maranhão', 'MT': 'Mato Grosso',
    'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais', 'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná',
    'PE': 'Pernambuco', 'PI': 'Piauí', 'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte',
    'RS': 'Rio Grande do Sul', 'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina',
    'SP': 'São Paulo', 'SE': 'Sergipe', 'TO': 'Tocantins'
};

const LEGAL_AMAZON_FILTER_VALUE = 'amazonia-legal';
const LEGAL_AMAZON_UFS = ['AC', 'AP', 'AM', 'MA', 'MT', 'PA', 'RO', 'RR', 'TO'];

const SITUACAO_NAMES = {
    '01': 'Nula',
    '02': 'Ativa',
    '03': 'Suspensa',
    '04': 'Inapta',
    '08': 'Baixada'
};

// Global State
let dashboardData = {
    raw: [],
    cnaeDict: {},
    municipioDict: {},
    filteredData: [],
    charts: {}
};

let tableState = {
    currentPage: 1,
    pageSize: 20,
    sortColumn: 'uf',
    sortDirection: 'asc'
};

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', async () => {
    try {
        showLoading();
        await loadDictionaries();
        await loadEstabelecimentos();
        processData();
        updateKPIs();
        initCharts();
        initTable();
        initEventListeners();
        hideLoading();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        hideLoading();
        alert('Erro ao carregar os dados. Por favor, recarregue a página.');
    }
});

// Load CNAE and Municipio dictionaries
async function loadDictionaries() {
    // Load CNAE with proper encoding (Windows-1252/Latin-1)
    const cnaeResponse = await fetch('Estabelecimentos/CNAE.csv');
    const cnaeBuffer = await cnaeResponse.arrayBuffer();
    const cnaeDecoder = new TextDecoder('windows-1252');
    const cnaeText = cnaeDecoder.decode(cnaeBuffer);
    parseCNAE(cnaeText);
    
    // Load Municipios
    const municipioResponse = await fetch('Estabelecimentos/Municipios.csv');
    const municipioBuffer = await municipioResponse.arrayBuffer();
    const municipioDecoder = new TextDecoder('windows-1252');
    const municipioText = municipioDecoder.decode(municipioBuffer);
    parseMunicipios(municipioText);
}

function parseCNAE(csvText) {
    const lines = csvText.split('\n');
    lines.forEach(line => {
        const match = line.match(/"([^"]+)";"([^"]+)"/);
        if (match) {
            dashboardData.cnaeDict[match[1]] = match[2];
        }
    });
}

function parseMunicipios(csvText) {
    const lines = csvText.split('\n');
    lines.forEach(line => {
        const match = line.match(/"([^"]+)";"([^"]+)"/);
        if (match) {
            dashboardData.municipioDict[match[1]] = match[2];
        }
    });
}

// Load all estabelecimentos files
async function loadEstabelecimentos() {
    const files = [];
    for (let i = 0; i <= 9; i++) {
        files.push(`Estabelecimentos/estabelecimentos_filtrados_${i}_principal.csv`);
    }
    
    const allData = [];
    
    for (const file of files) {
        try {
            const response = await fetch(file);
            if (response.ok) {
                const text = await response.text();
                const records = parseCSV(text);
                allData.push(...records);
            }
        } catch (error) {
            console.warn(`Could not load ${file}:`, error);
        }
    }
    
    dashboardData.raw = allData;
    dashboardData.filteredData = [...allData];
}

function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const records = [];
    
    // Skip header
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Parse CSV with semicolon separator and quoted fields
        const fields = parseCSVLine(line);
        if (fields.length >= 21) {
            records.push({
                cnpjBasico: fields[0],
                cnpjOrdem: fields[1],
                cnpjDv: fields[2],
                identificadorMatrizFilial: fields[3],
                nomeFantasia: fields[4],
                situacaoCadastral: fields[5],
                dataSituacaoCadastral: fields[6],
                motivoSituacaoCadastral: fields[7],
                nomeCidadeExterior: fields[8],
                pais: fields[9],
                dataInicioAtividade: fields[10],
                cnaeFiscalPrincipal: fields[11],
                cnaeFiscalSecundaria: fields[12],
                tipoLogradouro: fields[13],
                logradouro: fields[14],
                numero: fields[15],
                complemento: fields[16],
                bairro: fields[17],
                cep: fields[18],
                uf: fields[19],
                municipio: fields[20],
                ddd1: fields[21] || '',
                telefone1: fields[22] || '',
                email: fields[27] || ''
            });
        }
    }
    
    return records;
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

function isLegalAmazonUF(uf) {
    return LEGAL_AMAZON_UFS.includes(uf);
}

// Process Data
function processData() {
    const data = dashboardData.filteredData;
    
    // Populate UF filter
    const ufs = [...new Set(data.map(d => d.uf))].filter(Boolean).sort();
    const ufSelect = document.getElementById('filterUF');
    ufSelect.innerHTML = `
        <option value="">Todos os Estados</option>
        <option value="${LEGAL_AMAZON_FILTER_VALUE}">Amazônia Legal</option>
    `;
    ufs.forEach(uf => {
        const option = document.createElement('option');
        option.value = uf;
        option.textContent = UF_NAMES[uf] || uf;
        ufSelect.appendChild(option);
    });
    
    // Populate CNAE filters (main and temporal)
    const cnaes = [...new Set(data.map(d => d.cnaeFiscalPrincipal))].filter(Boolean).sort();
    const cnaeSelect = document.getElementById('filterCNAE');
    const cnaeTemporalSelect = document.getElementById('filterCNAETemporal');
    
    cnaeSelect.innerHTML = '<option value="">Todos os CNAEs</option>';
    cnaeTemporalSelect.innerHTML = '<option value="">Todos os CNAEs</option>';
    
    cnaes.forEach(cnae => {
        const descricao = dashboardData.cnaeDict[cnae] || cnae;
        
        const option1 = document.createElement('option');
        option1.value = cnae;
        option1.textContent = `${cnae} - ${descricao}`;
        cnaeSelect.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = cnae;
        option2.textContent = descricao;
        cnaeTemporalSelect.appendChild(option2);
    });
}

// Update KPIs
function updateKPIs() {
    const data = dashboardData.filteredData;
    
    // Total estabelecimentos
    document.getElementById('totalEstabelecimentos').textContent = 
        data.length.toLocaleString('pt-BR');
    
    // Total estados
    const estados = new Set(data.map(d => d.uf)).size;
    document.getElementById('totalEstados').textContent = 
        estados.toLocaleString('pt-BR');
    
    // Total municípios
    const municipios = new Set(data.map(d => d.municipio)).size;
    document.getElementById('totalMunicipiosEstab').textContent = 
        municipios.toLocaleString('pt-BR');
    
    // Total CNAEs
    const cnaes = new Set(data.map(d => d.cnaeFiscalPrincipal)).size;
    document.getElementById('totalCNAEs').textContent = 
        cnaes.toLocaleString('pt-BR');
}

// Initialize Charts
function initCharts() {
    createChartMunicipios();
    createChartCNAE();
    createChartTemporal();
}

function createChartMunicipios() {
    const data = dashboardData.filteredData;
    
    // Group by Municipio
    const byMunicipio = {};
    data.forEach(item => {
        if (item.municipio) {
            const municipioName = dashboardData.municipioDict[item.municipio] || item.municipio;
            const key = `${municipioName} (${item.uf})`;
            byMunicipio[key] = (byMunicipio[key] || 0) + 1;
        }
    });
    
    // Sort by count and get top 20
    const sorted = Object.entries(byMunicipio)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);
    
    const labels = sorted.map(([municipio]) => municipio);
    const values = sorted.map(([, count]) => count);
    
    const ctx = document.getElementById('chartMunicipios').getContext('2d');
    
    if (dashboardData.charts.municipios) {
        dashboardData.charts.municipios.destroy();
    }
    
    dashboardData.charts.municipios = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Estabelecimentos',
                data: values,
                backgroundColor: COLORS.primary[0],
                borderColor: COLORS.primary[0],
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
                        callback: value => value.toLocaleString('pt-BR')
                    }
                }
            }
        }
    });
}

function createChartCNAE() {
    const data = dashboardData.filteredData;
    
    // Group by CNAE
    const byCNAE = {};
    data.forEach(item => {
        if (item.cnaeFiscalPrincipal) {
            byCNAE[item.cnaeFiscalPrincipal] = (byCNAE[item.cnaeFiscalPrincipal] || 0) + 1;
        }
    });
    
    // Sort by count (all CNAEs)
    const sorted = Object.entries(byCNAE)
        .sort((a, b) => b[1] - a[1]);
    
    const labels = sorted.map(([cnae]) => {
        const descricao = dashboardData.cnaeDict[cnae] || cnae;
        return descricao;
    });
    const values = sorted.map(([, count]) => count);
    
    const ctx = document.getElementById('chartCNAE').getContext('2d');
    
    if (dashboardData.charts.cnae) {
        dashboardData.charts.cnae.destroy();
    }
    
    dashboardData.charts.cnae = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Estabelecimentos',
                data: values,
                backgroundColor: COLORS.primary.slice(0, sorted.length),
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
                        callback: value => value.toLocaleString('pt-BR')
                    }
                }
            }
        }
    });
}

function createChartTemporal(cnaeFilter = '') {
    const data = dashboardData.filteredData;
    
    // Filter by CNAE if specified
    const filteredData = cnaeFilter 
        ? data.filter(item => item.cnaeFiscalPrincipal === cnaeFilter)
        : data;
    
    // Group by year
    const byYear = {};
    filteredData.forEach(item => {
        if (item.dataInicioAtividade && item.dataInicioAtividade.length >= 4) {
            const year = item.dataInicioAtividade.substring(0, 4);
            if (year >= '1990' && year <= '2025') {
                byYear[year] = (byYear[year] || 0) + 1;
            }
        }
    });
    
    // Sort by year
    const sorted = Object.entries(byYear).sort((a, b) => a[0].localeCompare(b[0]));
    
    const labels = sorted.map(([year]) => year);
    const values = sorted.map(([, count]) => count);
    
    const ctx = document.getElementById('chartTemporal').getContext('2d');
    
    if (dashboardData.charts.temporal) {
        dashboardData.charts.temporal.destroy();
    }
    
    dashboardData.charts.temporal = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Novos Estabelecimentos',
                data: values,
                borderColor: COLORS.primary[1],
                backgroundColor: 'rgba(0, 102, 204, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
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
                        callback: value => value.toLocaleString('pt-BR')
                    }
                }
            }
        }
    });
}

// Initialize Table
function initTable() {
    renderTable();
}

function renderTable() {
    const data = dashboardData.filteredData;
    const search = document.getElementById('searchEstabelecimento').value.toLowerCase();
    
    // Filter by search
    let filtered = data;
    if (search) {
        filtered = data.filter(item => {
            const nome = (item.nomeFantasia || '').toLowerCase();
            const municipioCode = item.municipio || '';
            const municipioName = (dashboardData.municipioDict[municipioCode] || '').toLowerCase();
            const cnae = (item.cnaeFiscalPrincipal || '').toLowerCase();
            const cnaeDescricao = (dashboardData.cnaeDict[item.cnaeFiscalPrincipal] || '').toLowerCase();
            
            return nome.includes(search) || 
                   municipioName.includes(search) || 
                   cnae.includes(search) ||
                   cnaeDescricao.includes(search);
        });
    }
    
    // Sort
    filtered.sort((a, b) => {
        let valA = a[tableState.sortColumn] || '';
        let valB = b[tableState.sortColumn] || '';
        
        if (tableState.sortDirection === 'asc') {
            return valA.localeCompare(valB);
        } else {
            return valB.localeCompare(valA);
        }
    });
    
    // Paginate
    const start = (tableState.currentPage - 1) * tableState.pageSize;
    const end = start + tableState.pageSize;
    const paginated = filtered.slice(start, end);
    
    // Render
    const tbody = document.getElementById('tabelaBody');
    tbody.innerHTML = '';
    
    paginated.forEach(item => {
        const tr = document.createElement('tr');
        
        const cnpj = `${item.cnpjBasico}/${item.cnpjOrdem}-${item.cnpjDv}`;
        const cnaeDescricao = dashboardData.cnaeDict[item.cnaeFiscalPrincipal] || item.cnaeFiscalPrincipal;
        const municipioName = dashboardData.municipioDict[item.municipio] || item.municipio;
        const dataInicio = formatDate(item.dataInicioAtividade);
        
        tr.innerHTML = `
            <td>${cnpj}</td>
            <td>${item.nomeFantasia || '-'}</td>
            <td title="${cnaeDescricao}">${item.cnaeFiscalPrincipal}</td>
            <td>${municipioName}</td>
            <td>${item.uf}</td>
            <td>${dataInicio}</td>
        `;
        
        tbody.appendChild(tr);
    });
    
    // Update info
    document.getElementById('tableInfo').textContent = 
        `Mostrando ${start + 1} a ${Math.min(end, filtered.length)} de ${filtered.length.toLocaleString('pt-BR')} registros`;
    
    // Render pagination
    renderPagination(filtered.length);
}

function renderPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / tableState.pageSize);
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '←';
    prevBtn.disabled = tableState.currentPage === 1;
    prevBtn.addEventListener('click', () => {
        if (tableState.currentPage > 1) {
            tableState.currentPage--;
            renderTable();
        }
    });
    pagination.appendChild(prevBtn);
    
    // Page numbers
    const maxVisible = 5;
    let startPage = Math.max(1, tableState.currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.classList.toggle('active', i === tableState.currentPage);
        btn.addEventListener('click', () => {
            tableState.currentPage = i;
            renderTable();
        });
        pagination.appendChild(btn);
    }
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '→';
    nextBtn.disabled = tableState.currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
        if (tableState.currentPage < totalPages) {
            tableState.currentPage++;
            renderTable();
        }
    });
    pagination.appendChild(nextBtn);
}

function formatDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return '-';
    return `${dateStr.substring(6, 8)}/${dateStr.substring(4, 6)}/${dateStr.substring(0, 4)}`;
}

// Event Listeners
function initEventListeners() {
    // Search
    document.getElementById('searchEstabelecimento').addEventListener('input', debounce(() => {
        tableState.currentPage = 1;
        renderTable();
    }, 300));
    
    // Filters
    document.getElementById('btnAplicarFiltros').addEventListener('click', applyFilters);
    
    // CNAE Temporal filter
    document.getElementById('filterCNAETemporal').addEventListener('change', (e) => {
        createChartTemporal(e.target.value);
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
}

function applyFilters() {
    const uf = document.getElementById('filterUF').value;
    const cnae = document.getElementById('filterCNAE').value;
    
    dashboardData.filteredData = dashboardData.raw.filter(item => {
        if (uf) {
            if (uf === LEGAL_AMAZON_FILTER_VALUE && !isLegalAmazonUF(item.uf)) return false;
            if (uf !== LEGAL_AMAZON_FILTER_VALUE && item.uf !== uf) return false;
        }
        if (cnae && item.cnaeFiscalPrincipal !== cnae) return false;
        return true;
    });
    
    tableState.currentPage = 1;
    updateKPIs();
    initCharts();
    renderTable();
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}
