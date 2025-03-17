// Importando os ícones dos bancos
import bancoBrasil from "../assets/img/icon-Bancos/banco-brasil.svg";
import santander from "../assets/img/icon-Bancos/santander.svg";
import caixa from "../assets/img/icon-Bancos/caixa.svg";
import bradesco from "../assets/img/icon-Bancos/bradesco.svg";
import itau from "../assets/img/icon-Bancos/itau.svg";
import inter from "../assets/img/icon-Bancos/inter.svg";
import sicredi from "../assets/img/icon-Bancos/sicredi.svg";
import sicoob from "../assets/img/icon-Bancos/sicoob.svg";
import safra from "../assets/img/icon-Bancos/safra.svg";
import nubank from "../assets/img/icon-Bancos/nubank.svg";
import original from "../assets/img/icon-Bancos/original.svg";
import bancoBrasilia from "../assets/img/icon-Bancos/banco-brasilia.svg";
import banrisul from "../assets/img/icon-Bancos/banrisul.svg";
import citiBank from "../assets/img/icon-Bancos/citi-bank.svg";
import hsbc from "../assets/img/icon-Bancos/hsbc.svg";
import banestes from "../assets/img/icon-Bancos/banestes.svg";
import bancoAmazonia from "../assets/img/icon-Bancos/banco-amazonia.svg";
import bancoNordeste from "../assets/img/icon-Bancos/banco-nordeste.svg";
import bankBoston from "../assets/img/icon-Bancos/bank-boston.svg";
import defaultIcon from "../assets/img/icon-Bancos/default.png";

// Mapeamento dos códigos dos bancos para suas respectivas logos
export const BancoLogos: { [key: string]: string } = {
    "001": bancoBrasil,
    "033": santander,
    "104": caixa,
    "237": bradesco,
    "341": itau,
    "077": inter,
    "748": sicredi,
    "756": sicoob,
    "422": safra,
    "260": nubank,
    "212": original,
    "070": bancoBrasilia,
    "389": banrisul,
    "745": citiBank,
    "399": hsbc,
    "021": banestes,
    "085": bancoAmazonia,
    "003": bancoNordeste,
    "318": bankBoston,
};

// Função para obter a logo do banco com base no código
export const getBancoLogo = (codigo: string): string => {
    return BancoLogos[codigo] || defaultIcon;
};
