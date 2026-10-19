-- =============================================================================
-- Recria o Resultado de movimentos que têm plano de contas único (mb.idPlanoContas)
-- mas perderam a linha em Resultado (bug da correção de valor na reimportação OFX,
-- corrigido em 026f997). Mesma regra de MovimentoBancarioRepository.create():
-- um Resultado com valor absoluto e tipo C/D. Movimentos com rateio de planos
-- (mb.idPlanoContas NULL) não são tocados.
-- Rollback: DELETE FROM Resultado WHERE id > 2753 (MAX(id) conferido em 19/10/2026; reconfira antes de rodar).
-- =============================================================================

INSERT INTO Resultado (dtMovimento, idPlanoContas, idContaCorrente, idMovimentoBancario, idParcelaFinanciamento, valor, tipo)
SELECT
  mb.dtMovimento,
  mb.idPlanoContas,
  mb.idContaCorrente,
  mb.id,
  NULL,
  ABS(mb.valor),
  COALESCE(mb.tipoMovimento, CASE WHEN mb.valor >= 0 THEN 'C' ELSE 'D' END)
FROM MovimentoBancario mb
WHERE mb.idPlanoContas IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM Resultado r WHERE r.idMovimentoBancario = mb.id);
