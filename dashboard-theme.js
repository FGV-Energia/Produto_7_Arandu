(function () {
    const BASE_COLORS = [
        '#003366',
        '#0f5ec7',
        '#2f80ed',
        '#0ea5a8',
        '#1fbf75',
        '#f59e0b',
        '#ef4444',
        '#8b5cf6',
        '#334155',
        '#94a3b8'
    ];

    const REGION_COLORS = {
        Norte: '#1fbf75',
        Nordeste: '#ef4444',
        Sudeste: '#2f80ed',
        Sul: '#8b5cf6',
        'Centro-Oeste': '#f59e0b'
    };

    function hexToRgb(hex) {
        const normalized = hex.replace('#', '');
        const safeHex = normalized.length === 3
            ? normalized.split('').map(char => char + char).join('')
            : normalized;

        const value = Number.parseInt(safeHex, 16);

        return {
            r: (value >> 16) & 255,
            g: (value >> 8) & 255,
            b: value & 255
        };
    }

    function withAlpha(color, alpha) {
        if (!color) return `rgba(0, 51, 102, ${alpha})`;
        if (color.startsWith('rgba')) {
            return color.replace(/rgba\(([^)]+),[^,]+\)$/, `rgba($1, ${alpha})`);
        }
        if (color.startsWith('rgb(')) {
            const channels = color.slice(4, -1);
            return `rgba(${channels}, ${alpha})`;
        }
        if (color.startsWith('#')) {
            const { r, g, b } = hexToRgb(color);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return color;
    }

    function getPalette(count, alpha = 0.92) {
        return Array.from({ length: count }, (_, index) => withAlpha(BASE_COLORS[index % BASE_COLORS.length], alpha));
    }

    function createLinearGradient(direction, stops) {
        return (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;

            if (!chartArea) {
                return stops[0];
            }

            const gradient = direction === 'horizontal'
                ? ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0)
                : ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);

            gradient.addColorStop(0, stops[0]);
            gradient.addColorStop(1, stops[1] || stops[0]);

            return gradient;
        };
    }

    const noDataPlugin = {
        id: 'aranduNoData',
        afterDraw(chart, _args, options) {
            const datasets = chart.data?.datasets || [];
            const hasData = datasets.some(dataset =>
                Array.isArray(dataset.data) &&
                dataset.data.some(value => Number.isFinite(Number(value)) && Number(value) > 0)
            );

            if (hasData) return;

            const { ctx, chartArea } = chart;
            if (!chartArea) return;

            ctx.save();
            ctx.fillStyle = options?.color || '#718096';
            ctx.font = options?.font || "600 14px 'Source Sans 3', sans-serif";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                options?.label || 'Sem dados para exibir',
                (chartArea.left + chartArea.right) / 2,
                (chartArea.top + chartArea.bottom) / 2
            );
            ctx.restore();
        }
    };

    function applyChartDefaults() {
        if (!window.Chart || applyChartDefaults.applied) return;

        Chart.register(noDataPlugin);

        Chart.defaults.font.family = "'Source Sans 3', sans-serif";
        Chart.defaults.color = '#4a5568';
        Chart.defaults.animation.duration = 700;
        Chart.defaults.responsive = true;
        Chart.defaults.maintainAspectRatio = false;

        Chart.defaults.plugins.legend.labels.usePointStyle = true;
        Chart.defaults.plugins.legend.labels.boxWidth = 10;
        Chart.defaults.plugins.legend.labels.boxHeight = 10;
        Chart.defaults.plugins.legend.labels.padding = 16;

        Chart.defaults.plugins.tooltip.backgroundColor = '#06284d';
        Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.16)';
        Chart.defaults.plugins.tooltip.borderWidth = 1;
        Chart.defaults.plugins.tooltip.titleFont = { size: 14, weight: 'bold' };
        Chart.defaults.plugins.tooltip.bodyFont = { size: 13 };
        Chart.defaults.plugins.tooltip.padding = 14;
        Chart.defaults.plugins.tooltip.cornerRadius = 12;

        Chart.defaults.plugins.aranduNoData = {
            label: 'Sem dados para exibir',
            color: '#718096'
        };

        Chart.defaults.elements.bar.borderRadius = 10;
        Chart.defaults.elements.bar.borderSkipped = false;
        Chart.defaults.elements.line.borderWidth = 3;
        Chart.defaults.elements.point.radius = 3;
        Chart.defaults.elements.point.hoverRadius = 6;

        applyChartDefaults.applied = true;
    }

    window.AranduTheme = {
        COLORS: {
            primary: BASE_COLORS,
            regions: REGION_COLORS
        },
        applyChartDefaults,
        createHorizontalGradient(stops) {
            return createLinearGradient('horizontal', stops);
        },
        createVerticalGradient(stops) {
            return createLinearGradient('vertical', stops);
        },
        getPalette,
        withAlpha
    };

    applyChartDefaults();
})();
