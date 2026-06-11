# Documentação do Dashboard Inside Sales ADARCO

## Visão Geral
O **Dashboard Inside Sales ADARCO** é uma aplicação web moderna construída para visualizar e analisar a performance das equipes de vendas internas. A ferramenta processa logs de telefonia em formato CSV e extrai métricas cruciais de desempenho.

## Tecnologias Utilizadas
- **React 18**: Framework base para a interface do usuário.
- **TypeScript**: Garantia de tipagem e segurança no desenvolvimento.
- **Tailwind CSS**: Estilização baseada em utilitários para um design responsivo e moderno.
- **Lucide React**: Biblioteca de ícones.
- **Motion (Framer Motion)**: Animações e transições suaves.
- **Recharts**: Visualização de dados através de gráficos de barras e ferramentas de BI.
- **PapaParse**: Biblioteca robusta para processamento de arquivos CSV no lado do cliente.

## Funcionalidades Principais
1. **Importação de Dados**: Suporte para upload de logs de telefonia. O sistema identifica automaticamente ramais, nomes de consultores e times (Débora/Marília).
2. **Dashboard de Performance**:
   - KPIs em tempo real (Total de Ligações, Ligações Ativas, Sucesso, Taxa de Efetividade).
   - Gráficos comparativos de volume por consultor.
   - Comparação direta de eficiência entre os times.
3. **Filtros Avançados**:
   - Filtragem por Supervisão (Times).
   - Filtragem por Consultor individual.
   - Filtro por tipo de ligação (Ativa vs Receptiva).
   - Busca textual por nome ou ramal.
   - Selecionador de período temporal.
4. **Responsividade Total**: Interface otimizada para desktops, tablets e dispositivos móveis, incluindo menu lateral retrátil.
5. **Efeitos Visuais Premium**:
   - Design com degradês neon e efeito de vidro (glassmorphism).
   - Efeito de brilho laminado no menu lateral.
   - Transições de estado animadas.

## Estrutura de Dados e Lógica de Negócio
O sistema espera um CSV com colunas comuns de logs de PABX, tais como:
- `Data`: Timestamp da chamada.
- `Origem` / `Destino`: Números ou ramais envolvidos.
- `Status`: Indica se a chamada foi atendida ou perdida.
- `Duração`: Tempo da chamada em segundos.
- `Tipo`: Coluna essencial para a classificação das chamadas.

### Filtragem de Tipos de Chamada
Para garantir a precisão da análise de Inside Sales, o sistema aplica as seguintes regras estritas:
- **Ativa**: Identificada quando o tipo é "Sainte".
- **Receptiva**: Identificada quando o tipo é "Entrante".
- **Excluídas**: Chamadas do tipo "Internal" ou qualquer outro tipo que não seja "Sainte" ou "Entrante" são automaticamente ignoradas pelo sistema.

## Otimizações de Código
- **Memoização Estratégica**: Uso intensivo de `useMemo` para garantir que cálculos pesados e filtragens de grandes volumes de dados só ocorram quando necessário.
- **Processamento em Passagem Única**: As estatísticas do dashboard (KPIs, resumos e listas de gráficos) são calculadas em uma única iteração sobre os dados filtrados, minimizando o custo computacional.
- **Debounce e Manuseio de Eventos**: Gerenciamento eficiente de resize de janela e input de busca para evitar re-renderizações desnecessárias.

## Como Usar
1. Acesse o portal.
2. Clique em "Carregar Relatório CSV" ou use o botão de upload no cabeçalho.
3. Selecione o arquivo de log exportado do sistema de telefonia.
4. Use os filtros no painel lateral para explorar os dados específicos de cada time ou consultor.
5. Clique no logotipo "ADARCO" para limpar todos os dados e reiniciar o portal.
