# 🎰 Lucky Casino - Sistema Completo de Cassino Online

Bem-vindo ao Lucky Casino, uma plataforma completa de cassino online com backend robusto, banco de dados MongoDB, e funcionalidades avançadas de jogos em tempo real.

## 🚀 Funcionalidades Principais

### 🎮 **Jogos Disponíveis**
- **Caça-Níqueis** - Múltiplos símbolos e jackpots
- **Roleta Europeia** - Animação realista e múltiplas apostas
- **Texas Hold'em Poker** - Jogo multiplayer contra dealer
- **Blackjack 21** - Jogo clássico com estratégia
- **Baccarat** - Em desenvolvimento
- **Craps** - Em desenvolvimento

### 👥 **Sistema de Usuários**
- Registro e login com JWT
- Perfis personalizados com avatares
- Sistema de níveis e VIP
- Bônus de boas-vindas e diários
- Programa de afiliados
- Limites de depósito e autoexclusão

### 💰 **Sistema Financeiro**
- Múltiplos métodos de pagamento
- Processamento seguro de transações
- Histórico completo de movimentações
- Limites diários e mensais
- Bônus com requisitos de aposta

### 🏆 **Torneios**
- Torneios agendados e sit & go
- Sistema de eliminación
- Premiação em tempo real
- Leaderboards globais

### 💬 **Recursos Sociais**
- Chat global em tempo real
- Sistema de espectadores
- Amigos e mensagens privadas
- Perfil público com estatísticas

### 🛡️ **Segurança**
- Criptografia de senhas com bcrypt
- Autenticação de dois fatores
- Proteção contra ataques
- Monitoramento de atividades suspeitas
- Rate limiting

## 🛠️ **Stack Tecnológico**

### **Backend**
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **Socket.IO** - Comunicação em tempo real
- **MongoDB** - Banco de dados NoSQL
- **Mongoose** - ODM para MongoDB
- **JWT** - Autenticação
- **bcrypt** - Hash de senhas

### **Frontend**
- **HTML5** - Estrutura semântica
- **CSS3** - Estilos modernos com animações
- **JavaScript ES6+** - Lógica interativa
- **Responsive Design** - Mobile-first

### **Infraestrutura**
- **Docker** - Containerização (opcional)
- **PM2** - Process manager (produção)
- **Nginx** - Reverse proxy (produção)

## 📋 **Pré-requisitos**

- Node.js 16.0 ou superior
- MongoDB 4.4 ou superior
- npm ou yarn
- Git

## 🚀 **Instalação**

### 1. Clone o repositório
```bash
git clone <repository-url>
cd lucky-casino
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure as variáveis de ambiente
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

### 4. Inicie o MongoDB
```bash
# Se estiver usando Docker
docker run -d -p 27017:27017 --name mongodb mongo

# Ou inicie o serviço localmente
mongod
```

### 5. Execute o servidor
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

O servidor estará rodando em `http://localhost:5000`

## 📁 **Estrutura do Projeto**

```
lucky-casino/
├── models/                 # Modelos de dados MongoDB
│   ├── User.js            # Modelo de usuário
│   ├── Game.js            # Modelo de jogos
│   ├── Transaction.js     # Modelo de transações
│   └── Tournament.js     # Modelo de torneios
├── routes/                # Rotas da API
│   ├── auth.js           # Autenticação
│   ├── users.js          # Gestão de usuários
│   ├── games.js          # Lógica dos jogos
│   ├── transactions.js   # Transações financeiras
│   ├── tournaments.js    # Torneios
│   └── admin.js          # Painel administrativo
├── public/               # Arquivos estáticos
├── uploads/              # Uploads de imagens
├── index.html            # Página principal
├── styles.css            # Estilos CSS
├── script.js             # Lógica frontend
├── games.js              # Lógica dos jogos
├── server.js             # Servidor backend
├── package.json          # Dependências e scripts
├── .env                 # Variáveis de ambiente
└── README.md             # Documentação
```

## 🔧 **Configuração**

### Variáveis de Ambiente (.env)
```env
# Database
MONGODB_URI=mongodb://localhost:27017/lucky-casino

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRE=7d

# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Payment
PAYMENT_API_KEY=your-payment-key
PAYMENT_WEBHOOK_SECRET=webhook-secret

# Casino Settings
HOUSE_EDGE=0.05
MIN_BET=1
MAX_BET=10000
WELCOME_BONUS=100
DAILY_BONUS=50
```

## 🎮 **Como Jogar**

### 1. Criar Conta
- Acesse o site e clique em "Registrar"
- Preencha nome de usuário, email e senha
- Receba bônus de boas-vindas automaticamente

### 2. Fazer Login
- Use suas credenciais para acessar
- Verifique seu saldo e bônus disponíveis

### 3. Escolher um Jogo
- Navegue pela seção de jogos
- Clique em "Jogar" para abrir o modal do jogo
- Faça suas apostas e divirta-se!

### 4. Gerenciar Saldo
- Deposite fundos através das opções de pagamento
- Saque seus ganhos quando desejar
- Acompanhe seu histórico de transações

## 🏆 **Sistema de Torneios**

### Tipos de Torneios
- **Sit & Go** - Começam quando preenchem
- **Agendados** - Horários definidos
- **Freeroll** - Sem taxa de entrada
- **Satélite** - Qualificação para eventos maiores

### Como Participar
1. Verifique os torneios disponíveis
2. Pague a taxa de entrada
3. Jogue para acumular fichas
4. Sobreviva até o final para ganhar prêmios

## 💳 **Métodos de Pagamento**

### Depósitos
- Cartão de Crédito/Débito
- Transferência Bancária (TED/DOC)
- PIX
- PayPal
- Skrill/Neteller

### Saques
- Mesmos métodos disponíveis
- Processamento em 24-48h
- Limites diários e mensais

## 🔒 **Segurança e Jogo Responsável**

### Medidas de Segurança
- Criptografia SSL/TLS
- Validação de dados
- Monitoramento anti-fraude
- Backup automático

### Jogo Responsável
- Limites de depósito personalizados
- Autoexclusão temporária
- Alertas de tempo de jogo
- Links para ajuda

## 📊 **API Endpoints**

### Autenticação
- `POST /api/auth/register` - Criar conta
- `POST /api/auth/login` - Fazer login
- `POST /api/auth/logout` - Sair
- `GET /api/auth/me` - Informações do usuário

### Jogos
- `GET /api/games/available` - Jogos disponíveis
- `POST /api/games/create` - Criar jogo
- `POST /api/games/join` - Entrar em jogo
- `POST /api/games/move` - Fazer jogada

### Transações
- `GET /api/transactions/user` - Histórico
- `POST /api/transactions/deposit` - Depositar
- `POST /api/transactions/withdrawal` - Sacar

### Torneios
- `GET /api/tournaments/upcoming` - Próximos torneios
- `POST /api/tournaments/join` - Participar
- `GET /api/tournaments/:id/leaderboard` - Classificação

## 🚀 **Deploy**

### Produção com Docker
```bash
# Build da imagem
docker build -t lucky-casino .

# Executar container
docker run -d -p 5000:5000 --name casino lucky-casino
```

### PM2 (Produção)
```bash
# Instalar PM2
npm install -g pm2

# Iniciar aplicação
pm2 start server.js --name "lucky-casino"

# Monitorar
pm2 monit
```

## 🧪 **Testes**

```bash
# Executar testes
npm test

# Testes de cobertura
npm run test:coverage
```

## 📈 **Monitoramento**

### Logs
- Logs de acesso: `/logs/access.log`
- Logs de erro: `/logs/error.log`
- Logs de jogos: `/logs/games.log`

### Métricas
- Tempo de resposta
- Taxa de erro
- Usuários online
- Transações por minuto

## 🤝 **Contribuição**

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📝 **Licença**

Este projeto está licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

## ⚠️ **Aviso Legal**

Este é um projeto educacional e de demonstração. Não deve ser usado para jogos de azar reais sem as devidas licenças e autorizações das autoridades competentes.

## 🆘 **Suporte**

- Email: suporte@luckycasino.com
- Chat ao vivo: 24/7
- FAQ: [Link para FAQ]
- Documentação: [Link para docs]

---

**Desenvolvido com ❤️ pela equipe Lucky Casino**
