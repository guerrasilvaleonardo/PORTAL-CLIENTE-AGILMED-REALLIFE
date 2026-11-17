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
  'Declaro que recebi gratuitamente os equipamentos de proteção individual descritos acima, em perfeito estado de conservação e funcionamento.',
  'Fui orientado sobre o uso correto, a guarda e a conservação de cada um deles, e me comprometo a usá-los apenas para a finalidade a que se destinam, durante toda a jornada em que a atividade exigir.',
  'Comprometo-me a comunicar ao meu superior qualquer dano, extravio ou alteração que torne o equipamento impróprio para uso, e a devolvê-lo quando for substituído ou ao deixar a empresa.',
  'Estou ciente de que o descumprimento dessas obrigações constitui ato faltoso, nos termos da NR-06 e do art. 158 da CLT.',
  'Estou ciente de que esta entrega é registrada com foto e com a data e hora desta assinatura, para comprovação do cumprimento da NR-06.',
]
