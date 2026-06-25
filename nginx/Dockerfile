FROM nginx:alpine

# Instala openssl para gerar o certificado auto-assinado
RUN apk add --no-cache openssl

# Cria diretório de SSL
RUN mkdir -p /etc/nginx/ssl

# Gera certificado SSL auto-assinado válido por 365 dias
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nginx.key \
    -out /etc/nginx/ssl/nginx.crt \
    -subj "/C=BR/ST=SP/L=SaoPaulo/O=SecretVault/CN=localhost"

# Copia configuração
COPY nginx.conf /etc/nginx/nginx.conf
