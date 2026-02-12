# ARANDU — Dashboards de Aquicultura e Pesca no Brasil

Aplicação web estática com painéis interativos para análise de dados de **piscicultura**, **pesca extrativa**, **potencial bruto de biometano** e **estabelecimentos** relacionados ao setor.

## Visão Geral

O projeto reúne diferentes bases públicas e setoriais para visualização em mapas, gráficos e tabelas com filtros.

Módulos principais:

- **Piscicultura** (`index.html`): produção por espécie, estado, região e município.
- **Potencial Bruto** (`potencial_bruto.html`): estimativa de potencial de biometano a partir dos resíduos da piscicultura.
- **Pesca Extrativa** (`pesca_extrativa.html`): produção por espécie/estado com base em dados consolidados.
- **Estabelecimentos** (`estabelecimentos.html`): análise de CNPJs/CNAEs relacionados à aquicultura e pesca.

## Tecnologias

- HTML5
- CSS3
- JavaScript (Vanilla)
- [Chart.js](https://www.chartjs.org/) + plugin datalabels
- [Leaflet](https://leafletjs.com/) para mapas
- Python (script auxiliar para processamento de dados)

## Estrutura do Projeto

```text
WebApp_ARANDU/
├── index.html
├── potencial_bruto.html
├── pesca_extrativa.html
├── estabelecimentos.html
├── app.js
├── potencial_bruto.js
├── pesca_extrativa.js
├── estabelecimentos.js
├── styles.css
├── data.js
├── process_data.py
├── prod_psicultura_BR_IBGE.csv
├── Base_Consolidada_Pesca_extrativa.csv
├── BR_Municipios_2024.json
├── BR_UF_2024.json
└── Estabelecimentos/
    ├── CNAE.csv
    ├── Municipios.csv
    └── estabelecimentos_filtrados_*_principal.csv
```

## Como Executar Localmente

Como os dados são carregados via `fetch`, execute com um servidor HTTP local (não abra apenas o arquivo direto no navegador).

### Opção 1 — Python

```bash
# Na raiz do projeto
python -m http.server 8000
```

Acesse: `http://localhost:8000`

### Opção 2 — VS Code Live Server

- Instale a extensão **Live Server**.
- Clique com botão direito em `index.html` > **Open with Live Server**.

## Processamento de Dados (Piscicultura)

O arquivo `data.js` é gerado a partir de:

- `prod_psicultura_BR_IBGE.csv`
- `BR_Municipios_2024.json`
- `BR_UF_2024.json`

Para regenerar:

```bash
python process_data.py
```

## Metodologia (Potencial Bruto)

No módulo de potencial bruto (`potencial_bruto.js`), os cálculos seguem os fatores:

- **Resíduos:** `48,8%` do peso do peixe
- **Biometano:** `0,1224 Nm³/kg` de resíduo

Fórmula base usada para conversão por tonelada de peixe:

```text
Biometano (Nm³) = Produção (ton) × 0,488 × 0,1224 × 1000
```

## Fontes de Dados

- IBGE (produção de piscicultura)
- Base consolidada de pesca extrativa (arquivo local do projeto)
- Receita Federal (dados de estabelecimentos filtrados por CNAE)
- Malhas geográficas de municípios e UFs (GeoJSON)

