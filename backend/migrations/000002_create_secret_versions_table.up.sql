CREATE TABLE IF NOT EXISTS secret_versions (
    id UUID PRIMARY KEY,
    secret_id UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    encrypted_value TEXT NOT NULL,
    nonce TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_secret_version UNIQUE (secret_id, version)
);

-- Adiciona a foreign key em secrets para apontar para a versão atual, de forma deferível ou após a criação de ambas as tabelas
ALTER TABLE secrets ADD CONSTRAINT fk_current_version FOREIGN KEY (current_version_id) REFERENCES secret_versions(id) ON DELETE SET NULL;
