# 🚀 Guia de Instalação - Lucky Casino

Este guia irá ajudá-lo a configurar o sistema completo do Lucky Casino com backend Node.js, banco de dados MongoDB e frontend.

## 📋 Pré-requisitos

### Software Necessário
- **Node.js** 16.0 ou superior
- **npm** 8.0 ou superior (ou yarn)
- **MongoDB** 4.4 ou superior
- **Git** (para clonar o repositório)

### Sistema Operacional
- Windows 10/11
- macOS 10.15+
- Ubuntu 18.04+ (ou distribuições Linux similares)

## 🔧 Passo 1 - Instalação do MongoDB

### Windows
1. Baixe o MongoDB Community Server: https://www.mongodb.com/try/download/community
2. Execute o instalador e siga as instruções
3. Instale o MongoDB Compass (opcional, para visualização)
4. Configure como serviço Windows

### macOS
```bash
# Usando Homebrew
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb/brew/mongodb-community
```

### Linux (Ubuntu/Debian)
```bash
# Importar chave pública
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Adicionar repositório
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Atualizar e instalar
sudo apt-get update
sudo apt-get install -y mongodb-org

# Iniciar serviço
sudo systemctl start mongod
sudo systemctl enable mongod
```

## 📦 Passo 2 - Clonar e Configurar o Projeto

### 2.1 Clonar o Repositório
```bash
git clone <URL-DO-REPOSITORIO>
cd lucky-casino
```

### 2.2 Instalar Dependências
```bash
# Usando npm
npm install

# Ou usando yarn
yarn install
```

### 2.3 Configurar Variáveis de Ambiente
```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar com seu editor preferido
nano .env
# ou
code .env
```

### 2.4 Configurar o .env
```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/lucky-casino

# JWT Configuration
JWT_SECRET=sua-chave-secreta-super-forte-aqui
JWT_EXPIRE=7d

# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Email Configuration (opcional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=seu-email@gmail.com
EMAIL_PASS=sua-senha-de-app

# Casino Configuration
HOUSE_EDGE=0.05
MIN_BET=1
MAX_BET=10000
WELCOME_BONUS=100
DAILY_BONUS=50
```

## 🚀 Passo 3 - Iniciar o Servidor

### 3.1 Verificar Conexão com MongoDB
```bash
# Testar conexão
mongosh

# No shell do MongoDB
use lucky-casino
db.test.insertOne({test: true})
db.test.find()
```

### 3.2 Iniciar o Servidor Backend
```bash
# Modo desenvolvimento (com auto-reload)
npm run dev

# Ou modo produção
npm start
```

### 3.3 Verificar se está Funcionando
Abra seu navegador e acesse:
- API: http://localhost:5000
- Health Check: http://localhost:5000/api/health

## 🌐 Passo 4 - Configurar o Frontend

### 4.1 Servir Arquivos Estáticos
O servidor já está configurado para servir os arquivos estáticos da pasta `public`.

### 4.2 Acessar a Aplicação
Abra seu navegador e acesse:
- Frontend: http://localhost:5000
- API Documentation: http://localhost:5000/api/health

## 🐳 Passo 5 - Opcional: Docker

### 5.1 Criar Dockerfile
```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

### 5.2 Criar docker-compose.yml
```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    container_name: lucky-casino-mongo
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password

  app:
    build: .
    container_name: lucky-casino-app
    restart: unless-stopped
    ports:
      - "5000:5000"
    depends_on:
      - mongodb
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://admin:password@mongodb:27017/lucky-casino?authSource=admin
      - JWT_SECRET=seu-segredo-jogar-aqui
    volumes:
      - ./uploads:/app/uploads

volumes:
  mongodb_data:
```

### 5.3 Executar com Docker
```bash
# Construir e iniciar
docker-compose up -d

# Verificar logs
docker-compose logs -f

# Parar
docker-compose down
```

## 🔧 Passo 6 - Configuração de Produção

### 6.1 Usar PM2 (Process Manager)
```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar aplicação com PM2
pm2 start server.js --name "lucky-casino"

# Salvar configuração
pm2 save

# Configurar para iniciar com sistema
pm2 startup
```

### 6.2 Configurar Nginx (Reverse Proxy)
```nginx
# /etc/nginx/sites-available/lucky-casino
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Para arquivos estáticos
    location /static/ {
        alias /caminho/para/lucky-casino/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 6.3 Configurar SSL com Let's Encrypt
```bash
# Instalar Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obter certificado
sudo certbot --nginx -d seu-dominio.com

# Renovação automática
sudo crontab -e
# Adicionar linha:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🧪 Passo 7 - Testes

### 7.1 Executar Testes
```bash
# Todos os testes
npm test

# Testes com cobertura
npm run test:coverage

# Testes específicos
npm test -- --grep "authentication"
```

### 7.2 Testar API Manualmente
```bash
# Testar health check
curl http://localhost:5000/api/health

# Testar registro
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"123456"}'

# Testar login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"123456"}'
```

## 🔍 Passo 8 - Verificação e Debug

### 8.1 Verificar Logs
```bash
# Logs do PM2
pm2 logs lucky-casino

# Logs do MongoDB
sudo tail -f /var/log/mongodb/mongod.log

# Logs do Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 8.2 Monitorar Recursos
```bash
# Monitorar PM2
pm2 monit

# Monitorar sistema
htop
df -h
free -h
```

## 🚨 Solução de Problemas Comuns

### MongoDB não inicia
```bash
# Verificar status
sudo systemctl status mongod

# Verificar logs
sudo tail -f /var/log/mongodb/mongod.log

# Reiniciar
sudo systemctl restart mongod
```

### Porta já em uso
```bash
# Verificar qual processo está usando a porta
netstat -tulpn | grep :5000
# ou
lsof -i :5000

# Matar processo
sudo kill -9 <PID>
```

### Erro de conexão MongoDB
```bash
# Verificar se MongoDB está rodando
mongosh --eval "db.adminCommand('ismaster')"

# Testar conexão
mongosh mongodb://localhost:27017/lucky-casino
```

### Permissões negadas
```bash
# Linux/macOS
sudo chown -R $USER:$USER /caminho/para/lucky-casino
chmod -R 755 /caminho/para/lucky-casino

# Windows (executar como administrador)
```

## 📚 Recursos Adicionais

### Documentação da API
- Swagger UI: http://localhost:5000/api-docs
- Postman Collection: incluída em `/docs/postman.json`

### Scripts Úteis
```bash
# Backup do banco de dados
mongodump --db lucky-casino --out ./backup

# Restaurar banco de dados
mongorestore --db lucky-casino ./backup/lucky-casino

# Limpar logs
pm2 flush lucky-casino
```

## 🎉 Parabéns!

Seu Lucky Casino está agora instalado e configurado! Você pode:

1. Acessar o frontend em http://localhost:5000
2. Criar uma conta de usuário
3. Fazer login e começar a jogar
4. Acessar o painel admin (usuários VIP Diamond)
5. Monitorar através dos logs e métricas

Para suporte adicional, consulte o arquivo README.md ou abra uma issue no repositório.
