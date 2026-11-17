/*
 * Termo que o trabalhador aceita ao assinar o recebimento do EPI.
 *
 * Fica num arquivo só para que o texto do portal, o da ficha impressa e
 * o da página de assinatura sejam sempre o mesmo — e para que mudá-lo
 * seja uma alteração visível no PR, não uma string perdida numa tela.
 *
 * O que ele precisa cobrir, pela NR-06 (item 6.7.1), é a obrigação do
 * trabalhador: usar só para a finalidade a que se destina, cuidar da
 * guarda e conservação, comunicar alteração que torne o EPI impróprio e
 * cumprir o que a empresa determinar sobre o uso. A menção à foto está
 * aqui porque a entrega é registrada com imagem, e a pessoa precisa
 * saber disso na hora de assinar (LGPD, art. 9º).
 *
 * ATENÇÃO: texto de partida, escrito a partir do que a norma exige. Não
 * passou por revisão jurídica — vale uma leitura do advogado da empresa
 * antes de virar rotina.
 */
export const TERMO_ENTREGA_EPI = [
  'DECLARO ter recebido gratuitamente os Equipamentos de Proteção Individual — EPI descritos nesta ficha, em perfeito estado de conservação e funcionamento, nos termos dos artigos 166 e 167 da CLT, com a redação dada pela Lei Federal nº 6.514/77, destinados à proteção da minha integridade física e à neutralização de agentes insalubres, conforme o art. 191, inciso II, da mesma norma, e ter recebido treinamento sobre o uso correto de cada um deles.',
  'COMPROMETO-ME a utilizá-los sempre para os fins a que se destinam, durante toda a jornada em que a atividade exigir, ciente de que o não uso constitui ato faltoso, nos termos do art. 158, parágrafo único, da CLT e do item 6.7.1 da NR-06, sujeitando-me às penalidades legais.',
  'RESPONSABILIZO-ME pela guarda e conservação dos equipamentos e por devolvê-los no estado em que se encontrarem quando substituídos ou ao deixar a empresa, indenizando-a em caso de perda, extravio ou dano por uso incorreto, conforme o art. 462, § 1º, da CLT.',
  'COMPROMETO-ME a comunicar ao meu superior hierárquico ou ao responsável pela segurança do trabalho qualquer alteração que torne o equipamento impróprio para uso, podendo solicitar a troca sempre que necessário.',
  'ESTOU CIENTE de que esta entrega é registrada com fotografia e com a data e a hora desta assinatura, para comprovação do cumprimento da NR-06.',
]
