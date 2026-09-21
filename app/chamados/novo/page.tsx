'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { obterMarcaDaEmpresa } from '@/lib/empresa';
import { avisar } from '@/lib/avisar';
import { normalizarUrl } from '@/lib/links';
import type { Marca } from '@/lib/marca';

const categorias = [
  'Saúde Ocupacional',
  'Segurança do Trabalho',
  'Exames',
  'Treinamentos',
  'Documentos',
  'eSocial',
  'Atendimento administrativo',
  'Financeiro',
  'Outros',
];

const prioridades = [
  {
    value: 'baixa',
    label: 'Baixa',
    description: 'Solicitação sem urgência.',
  },
  {
    value: 'normal',
    label: 'Normal',
    description: 'Atendimento dentro do prazo padrão.',
  },
  {
    value: 'alta',
    label: 'Alta',
    description: 'Necessita atenção prioritária.',
  },
  {
    value: 'urgente',
    label: 'Urgente',
    description: 'Situação que exige atendimento imediato.',
  },
];

const identidade = {
  agilmed: {
    nome: 'ÁgilMed Ocupacional',
    curto: 'ÁgilMed',
    inicial: 'A',
    principal: '#2563eb',
    principalEscura: '#1d4ed8',
    fundo: '#eff6ff',
    fundoForte: '#dbeafe',
    borda: '#dbeafe',
  },

  reallife: {
    nome: 'Real Life SSMA',
    curto: 'Real Life',
    inicial: 'R',
    principal: '#0f766e',
    principalEscura: '#115e59',
    fundo: '#f0fdfa',
    fundoForte: '#ccfbf1',
    borda: '#ccfbf1',
  },
} as const;

export default function NovoChamadoPage() {
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [marca, setMarca] = useState<Marca | null>(null);

  const [categoria, setCategoria] = useState('');
  const [assunto, setAssunto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState('normal');
  const [linkTitulo, setLinkTitulo] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  useEffect(() => {
    async function carregarUsuario() {
      try {
        setCarregando(true);
        setErro('');

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.push('/login');
          return;
        }

        const { data: perfil, error: perfilError } = await supabase
          .from('profiles')
          .select('id, empresa_id')
          .eq('id', user.id)
          .single();

        if (perfilError || !perfil) {
          setErro(
            'Não foi possível identificar o perfil da sua empresa. Entre em contato com o atendimento.'
          );
          return;
        }

        const marcaEmpresa = await obterMarcaDaEmpresa();

        setMarca(marcaEmpresa);
        setUsuarioId(perfil.id);
        setEmpresaId(perfil.empresa_id);
      } catch {
        setErro(
          'Ocorreu um erro ao carregar seus dados. Tente novamente.'
        );
      } finally {
        setCarregando(false);
      }
    }

    carregarUsuario();
  }, [router]);

  async function criarChamado(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro('');

    if (!categoria) {
      setErro('Selecione uma categoria para o chamado.');
      return;
    }

    if (!assunto.trim()) {
      setErro('Informe o assunto do chamado.');
      return;
    }

    if (!descricao.trim()) {
      setErro('Descreva o que você precisa.');
      return;
    }

    if (!empresaId || !usuarioId) {
      setErro(
        'Não foi possível identificar sua empresa ou seu usuário.'
      );
      return;
    }

    const linkNormalizado = normalizarUrl(linkUrl);

    if (linkUrl.trim() && !linkNormalizado) {
      setErro(
        'O link de acesso informado não é válido. Exemplo: https://exemplo.com.br/documento'
      );
      return;
    }

    try {
      setEnviando(true);

      /*
       * SLA AUTOMÁTICO
       *
       * Baixa   = 48 horas
       * Normal  = 24 horas
       * Alta    = 8 horas
       * Urgente = 4 horas
       */
      const horasSla: Record<string, number> = {
        baixa: 48,
        normal: 24,
        alta: 8,
        urgente: 4,
      };

      const horas = horasSla[prioridade] ?? 24;

      const prazoSla = new Date(
        Date.now() + horas * 60 * 60 * 1000
      ).toISOString();

      const { data, error } = await supabase
        .from('chamados')
        .insert({
          empresa_id: empresaId,
          criado_por: usuarioId,
          categoria,
          assunto: assunto.trim(),
          descricao: descricao.trim(),
          prioridade,
          status: 'aberto',
          prazo_sla: prazoSla,
        })
        .select('id, numero, prazo_sla')
        .single();

      if (error) {
        console.error(error);

        setErro(
          'Não foi possível abrir o chamado. Tente novamente.'
        );

        return;
      }

      if (linkNormalizado) {
        const { error: linkError } = await supabase
          .from('chamado_links')
          .insert({
            chamado_id: data.id,
            criado_por: usuarioId,
            titulo: linkTitulo.trim() || null,
            url: linkNormalizado,
          });

        if (linkError) {
          console.error(linkError);
        }
      }

      await avisar('chamado_criado', data.id);

      router.push(`/chamados/${data.id}`);
    } catch (error) {
      console.error(error);

      setErro(
        'Ocorreu um erro ao abrir o chamado. Tente novamente.'
      );
    } finally {
      setEnviando(false);
    }
  }

  if (!marca) {
    return (
      <main style={styles.page}>
        <section style={styles.loadingContainer}>
          <div style={styles.spinner} />

          <p style={styles.loadingText}>
            Carregando seus dados...
          </p>
        </section>
      </main>
    );
  }

  const tema = identidade[marca];

  if (carregando) {
    return (
      <main style={styles.page}>
        <div
          style={{
            ...styles.backgroundGlow,
            background: `radial-gradient(circle, ${tema.fundoForte} 0%, rgba(255,255,255,0) 70%)`,
          }}
        />

        <header style={styles.header}>
          <div style={styles.headerInner}>
            <div style={styles.brandArea}>
              <div
                style={{
                  ...styles.logo,
                  background: `linear-gradient(135deg, ${tema.principal} 0%, ${tema.principalEscura} 100%)`,
                  boxShadow: `0 8px 20px ${tema.principal}35`,
                }}
              >
                {tema.inicial}
              </div>

              <div>
                <div style={styles.brandName}>
                  Portal do Cliente
                </div>

                <div style={styles.brandSubtitle}>
                  {tema.nome}
                </div>
              </div>
            </div>
          </div>
        </header>

        <section style={styles.loadingContainer}>
          <div
            style={{
              ...styles.spinner,
              borderColor: tema.borda,
              borderTopColor: tema.principal,
            }}
          />

          <p style={styles.loadingText}>
            Carregando seus dados...
          </p>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div
        style={{
          ...styles.backgroundGlow,
          background: `radial-gradient(circle, ${tema.fundoForte} 0%, rgba(255,255,255,0) 70%)`,
        }}
      />

      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.brandArea}>
            <div
              style={{
                ...styles.logo,
                background: `linear-gradient(135deg, ${tema.principal} 0%, ${tema.principalEscura} 100%)`,
                boxShadow: `0 8px 20px ${tema.principal}35`,
              }}
            >
              {tema.inicial}
            </div>

            <div>
              <div style={styles.brandName}>
                Portal do Cliente
              </div>

              <div style={styles.brandSubtitle}>
                {tema.nome}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push('/')}
            style={styles.headerButton}
          >
            ← Voltar ao início
          </button>
        </div>
      </header>

      <div style={styles.content}>
        <div style={styles.breadcrumb}>
          <button
            type="button"
            onClick={() => router.push('/')}
            style={{
              ...styles.breadcrumbButton,
              color: tema.principal,
            }}
          >
            Início
          </button>

          <span style={styles.breadcrumbSeparator}>/</span>

          <button
            type="button"
            onClick={() => router.push('/chamados')}
            style={{
              ...styles.breadcrumbButton,
              color: tema.principal,
            }}
          >
            Chamados
          </button>

          <span style={styles.breadcrumbSeparator}>/</span>

          <span style={styles.breadcrumbCurrent}>
            Novo chamado
          </span>
        </div>

        <section style={styles.hero}>
          <div>
            <div
              style={{
                ...styles.eyebrow,
                color: tema.principal,
              }}
            >
              CENTRAL DE ATENDIMENTO
            </div>

            <h1 style={styles.title}>
              Abrir novo chamado
            </h1>

            <p style={styles.subtitle}>
              Envie sua solicitação para nossa equipe. Quanto mais
              detalhes você informar, mais rápido poderemos ajudar.
            </p>
          </div>

          <div
            style={{
              ...styles.heroIcon,
              background: tema.fundoForte,
              color: tema.principal,
            }}
          >
            +
          </div>
        </section>

        {erro && (
          <div style={styles.errorBox}>
            <div style={styles.errorIcon}>!</div>

            <div>
              <strong style={styles.errorTitle}>
                Não foi possível continuar
              </strong>

              <p style={styles.errorText}>{erro}</p>
            </div>
          </div>
        )}

        <form onSubmit={criarChamado}>
          <div style={styles.layout}>
            <section style={styles.mainCard}>
              <div style={styles.cardHeader}>
                <div>
                  <h2 style={styles.cardTitle}>
                    Informações do chamado
                  </h2>

                  <p style={styles.cardDescription}>
                    Preencha os dados abaixo para registrar sua
                    solicitação.
                  </p>
                </div>

                <span style={styles.requiredLabel}>
                  * Obrigatório
                </span>
              </div>

              <div style={styles.formContent}>
                <div style={styles.field}>
                  <label style={styles.label}>
                    Categoria{' '}
                    <span style={styles.required}>*</span>
                  </label>

                  <select
                    value={categoria}
                    onChange={(event) =>
                      setCategoria(event.target.value)
                    }
                    style={styles.input}
                    required
                  >
                    <option value="">
                      Selecione uma categoria
                    </option>

                    {categorias.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>
                    Assunto{' '}
                    <span style={styles.required}>*</span>
                  </label>

                  <input
                    type="text"
                    value={assunto}
                    onChange={(event) =>
                      setAssunto(event.target.value)
                    }
                    placeholder="Ex.: Preciso atualizar um documento"
                    style={styles.input}
                    maxLength={150}
                    required
                  />

                  <span style={styles.helper}>
                    Resuma em poucas palavras o motivo do contato.
                  </span>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>
                    Descrição{' '}
                    <span style={styles.required}>*</span>
                  </label>

                  <textarea
                    value={descricao}
                    onChange={(event) =>
                      setDescricao(event.target.value)
                    }
                    placeholder="Descreva sua necessidade, dúvida ou problema com o máximo de detalhes possível..."
                    style={styles.textarea}
                    rows={7}
                    required
                  />

                  <span style={styles.helper}>
                    Informe informações que possam ajudar nossa
                    equipe a entender e resolver sua solicitação.
                  </span>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>
                    Prioridade{' '}
                    <span style={styles.required}>*</span>
                  </label>

                  <div style={styles.priorityGrid}>
                    {prioridades.map((item) => {
                      const selecionada =
                        prioridade === item.value;

                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() =>
                            setPrioridade(item.value)
                          }
                          style={{
                            ...styles.priorityOption,
                            ...(selecionada
                              ? {
                                  ...styles.priorityOptionSelected,
                                  borderColor: tema.principal,
                                  background: tema.fundo,
                                  boxShadow: `0 0 0 3px ${tema.principal}14`,
                                }
                              : {}),
                          }}
                        >
                          <div style={styles.priorityTop}>
                            <span
                              style={{
                                ...styles.radio,
                                ...(selecionada
                                  ? {
                                      ...styles.radioSelected,
                                      borderColor:
                                        tema.principal,
                                    }
                                  : {}),
                              }}
                            >
                              {selecionada && (
                                <span
                                  style={{
                                    ...styles.radioDot,
                                    background:
                                      tema.principal,
                                  }}
                                />
                              )}
                            </span>

                            <span
                              style={{
                                ...styles.priorityLabel,
                                ...(selecionada
                                  ? {
                                      ...styles.priorityLabelSelected,
                                      color:
                                        tema.principalEscura,
                                    }
                                  : {}),
                              }}
                            >
                              {item.label}
                            </span>
                          </div>

                          <span
                            style={styles.priorityDescription}
                          >
                            {item.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>
                    Link de acesso{' '}
                    <span style={styles.optional}>
                      (opcional)
                    </span>
                  </label>

                  <div style={styles.linkRow}>
                    <input
                      type="text"
                      value={linkTitulo}
                      onChange={(event) =>
                        setLinkTitulo(event.target.value)
                      }
                      placeholder="Nome do link (ex.: Planilha de exames)"
                      style={styles.input}
                      maxLength={120}
                    />

                    <input
                      type="text"
                      value={linkUrl}
                      onChange={(event) =>
                        setLinkUrl(event.target.value)
                      }
                      placeholder="https://..."
                      style={styles.input}
                      maxLength={500}
                      inputMode="url"
                    />
                  </div>

                  <span style={styles.helper}>
                    Use quando o material estiver em uma pasta
                    compartilhada, sistema externo ou site.
                    Você poderá acrescentar outros links depois
                    de abrir o chamado.
                  </span>
                </div>

                <div style={styles.attachmentBox}>
                  <div style={styles.attachmentIcon}>↥</div>

                  <div>
                    <strong style={styles.attachmentTitle}>
                      Anexos
                    </strong>

                    <p style={styles.attachmentText}>
                      Após abrir o chamado, você poderá enviar
                      documentos, imagens e outros arquivos
                      relacionados à solicitação.
                    </p>
                  </div>
                </div>
              </div>

              <div style={styles.formFooter}>
                <button
                  type="button"
                  onClick={() => router.push('/chamados')}
                  style={styles.cancelButton}
                  disabled={enviando}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  style={{
                    ...styles.submitButton,
                    background: `linear-gradient(135deg, ${tema.principal} 0%, ${tema.principalEscura} 100%)`,
                    boxShadow: `0 7px 18px ${tema.principal}38`,
                    ...(enviando
                      ? styles.submitButtonDisabled
                      : {}),
                  }}
                  disabled={enviando}
                >
                  {enviando ? (
                    <>
                      <span style={styles.buttonSpinner} />
                      Abrindo chamado...
                    </>
                  ) : (
                    <>
                      Abrir chamado
                      <span style={styles.submitArrow}>
                        →
                      </span>
                    </>
                  )}
                </button>
              </div>
            </section>

            <aside style={styles.sidebar}>
              <div style={styles.infoCard}>
                <div
                  style={{
                    ...styles.infoIcon,
                    background: tema.fundoForte,
                    color: tema.principal,
                  }}
                >
                  i
                </div>

                <h3 style={styles.infoTitle}>
                  Como funciona?
                </h3>

                <div style={styles.steps}>
                  <div style={styles.step}>
                    <div
                      style={{
                        ...styles.stepNumber,
                        background: tema.fundo,
                        color: tema.principal,
                      }}
                    >
                      1
                    </div>

                    <div>
                      <strong style={styles.stepTitle}>
                        Você abre o chamado
                      </strong>

                      <p style={styles.stepText}>
                        Explique sua necessidade e envie as
                        informações necessárias.
                      </p>
                    </div>
                  </div>

                  <div style={styles.stepLine} />

                  <div style={styles.step}>
                    <div
                      style={{
                        ...styles.stepNumber,
                        background: tema.fundo,
                        color: tema.principal,
                      }}
                    >
                      2
                    </div>

                    <div>
                      <strong style={styles.stepTitle}>
                        Nossa equipe analisa
                      </strong>

                      <p style={styles.stepText}>
                        O chamado será direcionado para o
                        responsável adequado.
                      </p>
                    </div>
                  </div>

                  <div style={styles.stepLine} />

                  <div style={styles.step}>
                    <div
                      style={{
                        ...styles.stepNumber,
                        background: tema.fundo,
                        color: tema.principal,
                      }}
                    >
                      3
                    </div>

                    <div>
                      <strong style={styles.stepTitle}>
                        Você acompanha
                      </strong>

                      <p style={styles.stepText}>
                        Acompanhe mensagens, atualizações e o
                        andamento diretamente pelo portal.
                      </p>
                    </div>
                  </div>

                  <div style={styles.stepLine} />

                  <div style={styles.step}>
                    <div
                      style={{
                        ...styles.stepNumber,
                        background: tema.fundo,
                        color: tema.principal,
                      }}
                    >
                      4
                    </div>

                    <div>
                      <strong style={styles.stepTitle}>
                        Chamado resolvido
                      </strong>

                      <p style={styles.stepText}>
                        Após a solução, você poderá avaliar o
                        atendimento.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  ...styles.helpCard,
                  background: `linear-gradient(135deg, ${tema.principalEscura} 0%, #0f172a 100%)`,
                }}
              >
                <div style={styles.helpIcon}>?</div>

                <div>
                  <strong style={styles.helpTitle}>
                    Precisa de ajuda?
                  </strong>

                  <p style={styles.helpText}>
                    Nossa equipe está pronta para atender sua
                    solicitação.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </form>
      </div>

      <footer style={styles.footer}>
        <span>Portal do Cliente</span>

        <span style={styles.footerDot}>•</span>

        <span>{tema.nome}</span>
      </footer>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background:
      'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
    color: '#0f172a',
    position: 'relative',
    overflow: 'hidden',
  },

  backgroundGlow: {
    position: 'absolute',
    top: '-180px',
    right: '-180px',
    width: '480px',
    height: '480px',
    borderRadius: '50%',
    pointerEvents: 'none',
  },

  header: {
    position: 'relative',
    zIndex: 2,
    background: 'rgba(255,255,255,0.94)',
    borderBottom: '1px solid #e2e8f0',
    backdropFilter: 'blur(10px)',
  },

  headerInner: {
    width: '100%',
    maxWidth: '1180px',
    margin: '0 auto',
    padding: '18px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '20px',
  },

  brandArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  logo: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '19px',
    fontWeight: 800,
  },

  brandName: {
    fontSize: '16px',
    fontWeight: 800,
    color: '#0f172a',
    lineHeight: 1.2,
  },

  brandSubtitle: {
    marginTop: '3px',
    fontSize: '11px',
    color: '#64748b',
    fontWeight: 600,
  },

  headerButton: {
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    color: '#334155',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
  },

  content: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '1180px',
    margin: '0 auto',
    padding: '28px 24px 60px',
  },

  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    fontSize: '13px',
    marginBottom: '28px',
  },

  breadcrumbButton: {
    border: 0,
    padding: 0,
    background: 'transparent',
    fontWeight: 700,
    cursor: 'pointer',
  },

  breadcrumbSeparator: {
    color: '#94a3b8',
  },

  breadcrumbCurrent: {
    color: '#64748b',
    fontWeight: 600,
  },

  hero: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '30px',
    marginBottom: '28px',
  },

  eyebrow: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.12em',
    marginBottom: '8px',
  },

  title: {
    margin: 0,
    fontSize: 'clamp(30px, 4vw, 42px)',
    lineHeight: 1.1,
    letterSpacing: '-0.035em',
    fontWeight: 850,
    color: '#0f172a',
  },

  subtitle: {
    margin: '12px 0 0',
    maxWidth: '680px',
    color: '#64748b',
    fontSize: '15px',
    lineHeight: 1.65,
  },

  heroIcon: {
    flexShrink: 0,
    width: '68px',
    height: '68px',
    borderRadius: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '34px',
    fontWeight: 300,
  },

  errorBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '15px 17px',
    marginBottom: '20px',
    border: '1px solid #fecaca',
    background: '#fef2f2',
    borderRadius: '14px',
    color: '#991b1b',
  },

  errorIcon: {
    width: '25px',
    height: '25px',
    flexShrink: 0,
    borderRadius: '50%',
    background: '#dc2626',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '14px',
  },

  errorTitle: {
    fontSize: '13px',
  },

  errorText: {
    margin: '4px 0 0',
    fontSize: '13px',
    lineHeight: 1.5,
  },

  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 320px',
    gap: '22px',
    alignItems: 'start',
  },

  mainCard: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '18px',
    boxShadow: '0 12px 35px rgba(15,23,42,0.06)',
    overflow: 'hidden',
  },

  cardHeader: {
    padding: '24px 26px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '20px',
  },

  cardTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 800,
    color: '#0f172a',
  },

  cardDescription: {
    margin: '6px 0 0',
    fontSize: '13px',
    lineHeight: 1.5,
    color: '#64748b',
  },

  requiredLabel: {
    flexShrink: 0,
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 600,
  },

  formContent: {
    padding: '26px',
  },

  field: {
    marginBottom: '23px',
  },

  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '13px',
    fontWeight: 800,
    color: '#334155',
  },

  required: {
    color: '#dc2626',
  },

  input: {
    width: '100%',
    boxSizing: 'border-box',
    minHeight: '48px',
    padding: '0 14px',
    border: '1px solid #cbd5e1',
    borderRadius: '11px',
    background: '#ffffff',
    color: '#0f172a',
    fontSize: '14px',
    outline: 'none',
  },

  optional: {
    color: '#94a3b8',
    fontWeight: 500,
  },

  linkRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)',
    gap: '10px',
  },

  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '13px 14px',
    border: '1px solid #cbd5e1',
    borderRadius: '11px',
    background: '#ffffff',
    color: '#0f172a',
    fontSize: '14px',
    lineHeight: 1.6,
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit',
  },

  helper: {
    display: 'block',
    marginTop: '7px',
    color: '#94a3b8',
    fontSize: '11px',
    lineHeight: 1.5,
  },

  priorityGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(2, minmax(0, 1fr))',
    gap: '10px',
  },

  priorityOption: {
    textAlign: 'left',
    padding: '14px',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    background: '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },

  priorityOptionSelected: {
    boxShadow:
      '0 0 0 3px rgba(37,99,235,0.08)',
  },

  priorityTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
  },

  radio: {
    width: '17px',
    height: '17px',
    borderRadius: '50%',
    border: '2px solid #cbd5e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  radioSelected: {},

  radioDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
  },

  priorityLabel: {
    fontSize: '13px',
    fontWeight: 800,
    color: '#334155',
  },

  priorityLabelSelected: {},

  priorityDescription: {
    display: 'block',
    marginTop: '7px',
    marginLeft: '26px',
    color: '#64748b',
    fontSize: '11px',
    lineHeight: 1.45,
  },

  attachmentBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '13px',
    padding: '16px',
    borderRadius: '12px',
    background: '#f8fafc',
    border: '1px dashed #cbd5e1',
  },

  attachmentIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '9px',
    background: '#e2e8f0',
    color: '#475569',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    flexShrink: 0,
  },

  attachmentTitle: {
    display: 'block',
    fontSize: '13px',
    color: '#334155',
  },

  attachmentText: {
    margin: '4px 0 0',
    fontSize: '11px',
    lineHeight: 1.5,
    color: '#64748b',
  },

  formFooter: {
    padding: '18px 26px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
  },

  cancelButton: {
    minHeight: '44px',
    padding: '0 18px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#475569',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer',
  },

  submitButton: {
    minHeight: '44px',
    padding: '0 19px',
    borderRadius: '10px',
    border: 0,
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '9px',
  },

  submitButtonDisabled: {
    opacity: 0.7,
    cursor: 'wait',
  },

  submitArrow: {
    fontSize: '17px',
    lineHeight: 1,
  },

  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },

  infoCard: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '18px',
    padding: '22px',
    boxShadow: '0 12px 35px rgba(15,23,42,0.05)',
  },

  infoIcon: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    marginBottom: '13px',
  },

  infoTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 800,
    color: '#0f172a',
  },

  steps: {
    marginTop: '19px',
  },

  step: {
    display: 'flex',
    gap: '11px',
    alignItems: 'flex-start',
  },

  stepNumber: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 900,
  },

  stepTitle: {
    display: 'block',
    fontSize: '12px',
    color: '#334155',
  },

  stepText: {
    margin: '4px 0 0',
    fontSize: '11px',
    lineHeight: 1.5,
    color: '#64748b',
  },

  stepLine: {
    width: '1px',
    height: '18px',
    background: '#e2e8f0',
    marginLeft: '14px',
  },

  helpCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '18px',
    borderRadius: '16px',
    color: '#ffffff',
  },

  helpIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '9px',
    background: 'rgba(255,255,255,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    flexShrink: 0,
  },

  helpTitle: {
    display: 'block',
    fontSize: '13px',
  },

  helpText: {
    margin: '4px 0 0',
    color: '#cbd5e1',
    fontSize: '11px',
    lineHeight: 1.5,
  },

  footer: {
    position: 'relative',
    zIndex: 1,
    padding: '22px 24px 30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '7px',
    color: '#94a3b8',
    fontSize: '11px',
  },

  footerDot: {
    color: '#cbd5e1',
  },

  loadingContainer: {
    minHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    position: 'relative',
    zIndex: 1,
  },

  spinner: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    border: '3px solid',
    borderTopColor: '#2563eb',
  },

  loadingText: {
    margin: 0,
    color: '#64748b',
    fontSize: '13px',
  },

  buttonSpinner: {
    width: '15px',
    height: '15px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.4)',
    borderTopColor: '#ffffff',
  },
};
