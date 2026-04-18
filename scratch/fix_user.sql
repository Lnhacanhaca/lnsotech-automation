UPDATE usuarios 
SET senha = '$2a$10$uujCRYGtaYz584sWFIIrnuV9RChQQQtpnysdxC2aWDawb4p3for.a', 
    tentativas_falhas = 0, 
    bloqueado_ate = NULL 
WHERE email = 'admin@lnsotech.com';
