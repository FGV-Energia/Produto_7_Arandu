# -*- coding: utf-8 -*-
"""
Script para processar os dados de piscicultura do IBGE
e gerar o arquivo data.js para o dashboard ARANDU
"""

import csv
import json
import re
import os

def parse_brazilian_number(value):
    """Converte número no formato brasileiro para float"""
    if not value or value.strip() == '':
        return 0.0
    # Remove espaços e substitui vírgula por ponto
    value = value.strip().replace('.', '').replace(',', '.')
    try:
        return float(value)
    except ValueError:
        return 0.0

def load_municipios_info(geojson_path):
    """Carrega informações dos municípios do GeoJSON"""
    municipios = {}
    
    try:
        with open(geojson_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        for feature in data.get('features', []):
            props = feature.get('properties', {})
            cd_mun = props.get('CD_MUN', '')
            if cd_mun:
                municipios[cd_mun] = {
                    'nome': props.get('NM_MUN', ''),
                    'uf': props.get('SIGLA_UF', ''),
                    'regiao': props.get('NM_REGIA', '')
                }
    except Exception as e:
        print(f"Erro ao carregar GeoJSON: {e}")
    
    return municipios

def load_piscicultura_data(csv_path):
    """Carrega dados de piscicultura do CSV"""
    data = []
    
    # Detectar encoding
    encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
    
    for encoding in encodings:
        try:
            with open(csv_path, 'r', encoding=encoding) as f:
                # Ler primeira linha para verificar
                first_line = f.readline()
                if 'Ano' in first_line or 'ano' in first_line.lower():
                    break
        except (UnicodeDecodeError, Exception):
            continue
    else:
        encoding = 'latin-1'  # Fallback
    
    print(f"Usando encoding: {encoding}")
    
    with open(csv_path, 'r', encoding=encoding) as f:
        # Detectar delimitador
        first_line = f.readline()
        f.seek(0)
        
        delimiter = ';' if ';' in first_line else ','
        
        reader = csv.DictReader(f, delimiter=delimiter)
        
        # Normalizar nomes das colunas
        for row in reader:
            # Encontrar colunas corretas
            ano = None
            cod_mun = None
            especie = None
            producao = None
            
            for key, value in row.items():
                key_lower = key.lower().strip()
                if 'ano' in key_lower:
                    ano = value
                elif 'cod' in key_lower and 'mun' in key_lower:
                    cod_mun = value
                elif 'esp' in key_lower or 'specie' in key_lower:
                    especie = value
                elif 'prod' in key_lower:
                    producao = value
            
            if cod_mun and especie:
                prod_value = parse_brazilian_number(producao)
                data.append({
                    'ano': int(ano) if ano else 2024,
                    'codMun': cod_mun.strip(),
                    'especie': especie.strip(),
                    'producao': prod_value
                })
    
    print(f"Total de registros carregados: {len(data)}")
    return data

def generate_data_js(piscicultura_data, municipios_info, geojson_data, geojson_uf_data, output_path):
    """Gera o arquivo data.js"""
    
    js_content = f"""/**
 * ARANDU Dashboard - Data File
 * Dados de Produção de Piscicultura Brasil 2024
 * Fonte: IBGE
 * Gerado automaticamente
 */

// Dados de Produção
window.PISCICULTURA_DATA = {json.dumps(piscicultura_data, ensure_ascii=False)};

// Informações dos Municípios
window.MUNICIPIOS_DATA = {json.dumps(municipios_info, ensure_ascii=False)};

// Dados GeoJSON dos Municípios
window.GEOJSON_DATA = {json.dumps(geojson_data, ensure_ascii=False)};

// Dados GeoJSON dos Estados (UF)
window.GEOJSON_UF_DATA = {json.dumps(geojson_uf_data, ensure_ascii=False)};
"""
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    print(f"Arquivo gerado: {output_path}")
    print(f"Tamanho: {os.path.getsize(output_path) / 1024:.2f} KB")

def simplify_geojson(geojson_path):
    """Carrega e simplifica o GeoJSON para reduzir tamanho"""
    try:
        with open(geojson_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Manter apenas propriedades essenciais
        essential_props = ['CD_MUN', 'NM_MUN', 'SIGLA_UF', 'NM_UF', 'NM_REGIA', 'SIGLA_RG']
        
        for feature in data.get('features', []):
            props = feature.get('properties', {})
            new_props = {k: props.get(k, '') for k in essential_props}
            feature['properties'] = new_props
            
            # Simplificar coordenadas (reduzir precisão)
            if 'geometry' in feature and feature['geometry']:
                feature['geometry'] = simplify_geometry(feature['geometry'])
        
        print(f"Features no GeoJSON: {len(data.get('features', []))}")
        return data
        
    except Exception as e:
        print(f"Erro ao processar GeoJSON: {e}")
        return None

def load_geojson_uf(geojson_path):
    """Carrega o GeoJSON dos estados (UF)"""
    try:
        with open(geojson_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Manter apenas propriedades essenciais
        essential_props = ['CD_UF', 'NM_UF', 'SIGLA_UF', 'NM_REGIA', 'SIGLA_RG', 'AREA_KM2']
        
        for feature in data.get('features', []):
            props = feature.get('properties', {})
            new_props = {k: props.get(k, '') for k in essential_props}
            feature['properties'] = new_props
            
            # Simplificar coordenadas (reduzir precisão)
            if 'geometry' in feature and feature['geometry']:
                feature['geometry'] = simplify_geometry(feature['geometry'])
        
        print(f"Estados no GeoJSON: {len(data.get('features', []))}")
        return data
        
    except Exception as e:
        print(f"Erro ao processar GeoJSON UF: {e}")
        return None

def simplify_geometry(geometry):
    """Reduz precisão das coordenadas para diminuir tamanho do arquivo"""
    def round_coord(coord):
        if isinstance(coord, (int, float)):
            return round(coord, 4)  # 4 casas decimais (~11m de precisão)
        elif isinstance(coord, list):
            return [round_coord(c) for c in coord]
        return coord
    
    if 'coordinates' in geometry:
        geometry['coordinates'] = round_coord(geometry['coordinates'])
    
    return geometry

def main():
    # Paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(base_dir, 'prod_psicultura_BR_IBGE.csv')
    geojson_path = os.path.join(base_dir, 'BR_Municipios_2024.json')
    geojson_uf_path = os.path.join(base_dir, 'BR_UF_2024.json')
    output_path = os.path.join(base_dir, 'data.js')
    
    print("=" * 50)
    print("ARANDU - Processamento de Dados")
    print("=" * 50)
    
    # Carregar dados
    print("\n1. Carregando informações dos municípios...")
    municipios_info = load_municipios_info(geojson_path)
    print(f"   Municípios carregados: {len(municipios_info)}")
    
    print("\n2. Carregando dados de piscicultura...")
    piscicultura_data = load_piscicultura_data(csv_path)
    
    print("\n3. Processando GeoJSON de municípios para o mapa...")
    geojson_data = simplify_geojson(geojson_path)
    
    print("\n4. Processando GeoJSON de estados (UF) para o mapa...")
    geojson_uf_data = load_geojson_uf(geojson_uf_path)
    
    print("\n5. Gerando arquivo data.js...")
    generate_data_js(piscicultura_data, municipios_info, geojson_data, geojson_uf_data, output_path)
    
    # Estatísticas
    especies = set(d['especie'] for d in piscicultura_data)
    municipios = set(d['codMun'] for d in piscicultura_data)
    total_producao = sum(d['producao'] for d in piscicultura_data)
    
    print("\n" + "=" * 50)
    print("ESTATÍSTICAS")
    print("=" * 50)
    print(f"Total de Espécies: {len(especies)}")
    print(f"Total de Municípios: {len(municipios)}")
    print(f"Produção Total: {total_producao:,.2f} toneladas")
    print("\nEspécies encontradas:")
    for esp in sorted(especies):
        total = sum(d['producao'] for d in piscicultura_data if d['especie'] == esp)
        if total > 0:
            print(f"  - {esp}: {total:,.2f} ton")
    
    print("\n✅ Processamento concluído!")

if __name__ == '__main__':
    main()
