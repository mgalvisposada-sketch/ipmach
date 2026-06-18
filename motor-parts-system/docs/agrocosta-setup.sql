-- SQL script to insert AgroCosta endpoint configuration
-- Run this after the database migration

INSERT INTO "DeepWebEndpoint" (
  "originCode",
  "name",
  "url",
  "method",
  "isActive",
  "requiresLogin",
  "loginUrl",
  "loginUsername",
  "loginPassword",
  "loginFormSelector",
  "usernameField",
  "passwordField",
  "timeoutMs",
  "retryAttempts",
  "parserConfig"
) VALUES (
  'AGROCOSTA',
  'AgroCosta',
  'https://agro-costa.com/consulta/consulta_inventario.php?tipo_busqueda=referencia&referencia={{reference}}&descripcion=&buscar=',
  'POST',
  true,
  true,
  'https://agro-costa.com/consulta/login.php',
  'ciparc',
  'COL25',
  'form',
  'input[name="usuario"]',
  'input[name="contraseña"]',
  30000,
  1,
  NULL
);

