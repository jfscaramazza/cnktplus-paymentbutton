-- ============================================
-- Script para normalizar direcciones en minúsculas
-- DEFIPAGO - Normalizar owner_address y recipient_address
-- ============================================

-- 1. Normalizar recipient_address a minúsculas
UPDATE payment_buttons 
SET recipient_address = LOWER(recipient_address)
WHERE recipient_address != LOWER(recipient_address);

-- 2. Normalizar owner_address a minúsculas
UPDATE payment_buttons 
SET owner_address = LOWER(owner_address)
WHERE owner_address != LOWER(owner_address);

-- 3. Si owner_address es NULL, copiar desde recipient_address
UPDATE payment_buttons 
SET owner_address = LOWER(recipient_address)
WHERE owner_address IS NULL;

-- 4. Normalizar token_address a minúsculas
UPDATE payment_buttons 
SET token_address = LOWER(token_address)
WHERE token_address != LOWER(token_address);

-- ============================================
-- NOTAS:
-- ============================================
-- Este script normaliza todas las direcciones a minúsculas
-- para asegurar consistencia en las búsquedas
-- ============================================

