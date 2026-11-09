-- Migration: cadastro de matrículas (garantias dos financiamentos)
-- Data: 2026-11-08
-- Descrição: tabela matricula com as 30 matrículas enviadas pelo cliente e a garantia dos contratos na forma
-- única "2319, 21175" (só dígitos, ordenadas, separadas por vírgula), para o relatório filtrar por matrícula.
--   npx wrangler d1 execute financeiro_db --remote --file=migration_matriculas_garantia.sql
-- Pode rodar mais de uma vez (IF NOT EXISTS / INSERT OR IGNORE / UPDATE pelo texto antigo).

CREATE TABLE IF NOT EXISTS matricula (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	numero TEXT NOT NULL UNIQUE,
	descricao TEXT,
	criadoEm TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO matricula (numero) VALUES
	('2319'), ('3041'), ('8885'), ('9167'), ('9899'), ('14397'), ('20804'), ('21175'), ('21176'), ('21471'),
	('29980'), ('29984'), ('34911'), ('82160'), ('86220'), ('86279'), ('90274'), ('95081'), ('99598'), ('111361'),
	('112328'), ('113894'), ('113895'), ('113896'), ('113897'), ('117198'), ('117212'), ('117213'), ('117221'), ('117404');

-- Garantias digitadas fora do padrão (as demais já são uma matrícula só, sem ponto)
UPDATE Financiamento SET numeroGarantia = '20804, 29984' WHERE numeroGarantia = '29984, 20804';
UPDATE Financiamento SET numeroGarantia = '20804, 29984, 86220' WHERE numeroGarantia = '20804, 29984 e 86220';
UPDATE Financiamento SET numeroGarantia = '2319, 21175, 21176, 21471' WHERE numeroGarantia = '2.319, 21.175, 21.176 e 21.471';
UPDATE Financiamento SET numeroGarantia = NULL WHERE TRIM(numeroGarantia) = '';
