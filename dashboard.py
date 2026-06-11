import streamlit as st
import pandas as pd
from datetime import datetime

# CONFIGURAÇÕES E MAPEAMENTO ESTRITO
# ---------------------------------------------------------
CONSULTANT_MAPPING = {
    # Time Débora (Supervisora: 6005)
    "6028": {"name": "Charlene", "team": "Time Débora"},
    "6002": {"name": "Erick", "team": "Time Débora"},
    "6007": {"name": "Everton", "team": "Time Débora"},
    "6006": {"name": "Rodrigo", "team": "Time Débora"},
    "6045": {"name": "Marcos", "team": "Time Débora"},
    "6046": {"name": "Karina", "team": "Time Débora"},
    "6029": {"name": "Rute", "team": "Time Débora"},
    
    # Time Marília (Supervisora: 6038)
    "6036": {"name": "Aila", "team": "Time Marília"},
    "6026": {"name": "Kelvyn", "team": "Time Marília"},
    "6017": {"name": "Felipe", "team": "Time Marília"},
    "6037": {"name": "Roney", "team": "Time Marília"},
    "6022": {"name": "Gabriela", "team": "Time Marília"},
    "6039": {"name": "Hillary", "team": "Time Marília"},
    "6030": {"name": "Kephini", "team": "Time Marília"},
}

def process_data(df):
    """Aplica o mapeamento estrito e filtragem de ramais."""
    if df is None or df.empty:
        return pd.DataFrame()

    # Identifica colunas de origem/ramal
    col_ramal = next((c for c in ['Origem', 'Ramal', 'Extension', 'src', 'Source'] if c in df.columns), None)
    
    if not col_ramal:
        return pd.DataFrame()

    # Convoca ramais para string/texto
    df[col_ramal] = df[col_ramal].astype(str).str.strip()

    # Cria colunas Consultor e Equipe baseadas no mapping
    def map_consultant(ramal):
        mapping = CONSULTANT_MAPPING.get(ramal)
        if mapping:
            return mapping['name'], mapping['team']
        return None, None

    res = df[col_ramal].apply(map_consultant)
    df['Consultor'] = [r[0] for r in res]
    df['Equipe'] = [r[1] for r in res]

    # Regra de Exclusão: Remove qualquer ramal que NÃO esteja no mapeamento
    df = df.dropna(subset=['Consultor'])
    
    # Processamento de Datas adicional
    col_data = next((c for c in ['Data', 'timestamp', 'date', 'startDate'] if c in df.columns), None)
    if col_data:
        df[col_data] = pd.to_datetime(df[col_data], errors='coerce')
        df = df.dropna(subset=[col_data])

    return df

# CONFIGURAÇÃO DA INTERFACE
# ---------------------------------------------------------
st.set_page_config(page_title="Adarco BI - Inside Sales", layout="wide")

st.markdown("""
<style>
    .main { background-color: #F8F9FA; }
    h1, h2, h3 { color: #004D2C; font-weight: 800; }
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, rgba(0, 77, 45, 0.95) 0%, #003B22 100%) !important;
        color: white;
    }
</style>
""", unsafe_allow_html=True)

st.title("📂 Painel de Telefonia - Adarco")
st.write("Analise o desempenho da equipe através do upload de arquivos CSV.")

# Upload de Arquivo
uploaded_file = st.file_uploader("Suba o arquivo CSV de Telefonia", type="csv")

if uploaded_file:
    try:
        raw_df = pd.read_csv(uploaded_file)
        df = process_data(raw_df)
        
        if not df.empty:
            st.sidebar.header("Filtros de Gestão")
            
            # Filtro por Equipe (Supervisora)
            equipes = ["Todos"] + sorted(df['Equipe'].unique().tolist())
            equipe_sel = st.sidebar.selectbox("Selecionar Equipe", equipes)
            
            df_filtered = df if equipe_sel == "Todos" else df[df['Equipe'] == equipe_sel]
            
            # Filtro por Consultor
            consultores = ["Todos"] + sorted(df_filtered['Consultor'].unique().tolist())
            consultor_sel = st.sidebar.selectbox("Selecionar Consultor", consultores)
            
            if consultor_sel != "Todos":
                df_filtered = df_filtered[df_filtered['Consultor'] == consultor_sel]

            # Visualizações Principais
            col_m1, col_m2 = st.columns(2)
            with col_m1:
                st.metric("Total de Ligações Válidas", len(df_filtered))
            
            st.write("---")
            col1, col2 = st.columns(2)

            with col1:
                st.subheader("📊 Volume por Consultor")
                active_counts = df_filtered['Consultor'].value_counts()
                st.bar_chart(active_counts)

            with col2:
                st.subheader("✅ Distribuição por Equipe")
                team_counts = df_filtered['Equipe'].value_counts()
                st.bar_chart(team_counts)

            # Tabela de Performance
            st.subheader("📈 Performance Detalhada")
            summary = df_filtered.groupby(['Consultor', 'Equipe']).size().reset_index(name='Total')
            st.dataframe(summary.style.highlight_max(axis=0, subset=['Total']), use_container_width=True)

        else:
            st.error("Nenhum ramal mapeado foi encontrado no arquivo enviado. Verifique se o formato está correto.")
    except Exception as e:
        st.error(f"Erro ao processar o arquivo: {e}")
else:
    st.info("Por favor, carregue um arquivo CSV para começar a análise.")

