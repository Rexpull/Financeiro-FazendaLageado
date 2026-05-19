import { readFileSync } from "fs";
import { parseOFXContent } from "../frontend/src/Utils/parseOfxFile.ts";

const content = readFileSync("e2e/fixtures/extrato-caixa-marco.ofx", "utf8");
const { movimentos } = parseOFXContent(content);
console.log(
  JSON.stringify(
    movimentos.map((m) => ({ h: m.historico, v: m.valor, id: m.identificadorOfx })),
    null,
    2
  )
);
