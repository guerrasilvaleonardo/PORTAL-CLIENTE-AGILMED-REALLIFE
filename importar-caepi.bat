@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ==================================================
echo  Importar a base de CAs do Ministerio do Trabalho
echo ==================================================
echo.
echo Antes de rodar, baixe a base atual:
echo   1. abra https://caepi.trabalho.gov.br/internet/ConsultaCAinternet.aspx
echo   2. clique em "Base de dados do sistema CAEPI (Download)"
echo   3. deixe o arquivo na pasta Downloads (ou arraste-o sobre este programa)
echo.
echo O que este programa faz:
echo   - pega o tgg_export_caepi mais recente da pasta Downloads
echo   - descompacta com o WinRAR que ja existe nesta maquina
echo   - confere a data: base com mais de 45 dias NAO entra
echo   - grava os CAs no portal, para o botao "Buscar no CAEPI"
echo.
echo Demora alguns minutos. Pode rodar quantas vezes quiser:
echo os CAs que ja estao la sao apenas atualizados.
echo.

set "CHAVE=%~dp0chave-do-portal.txt"

rem ---------- 1. o Node precisa existir ----------
where node >nul 2>&1
if errorlevel 1 goto sem_node

rem ---------- 2. o arquivo da chave ----------
if not exist "%CHAVE%" goto criar_chave

for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%CHAVE%") do set "%%a=%%b"

if not defined SUPABASE_SERVICE_ROLE_KEY goto chave_vazia
if "%SUPABASE_SERVICE_ROLE_KEY%"=="cole-a-chave-aqui" goto chave_vazia
if not defined NEXT_PUBLIC_SUPABASE_URL goto chave_vazia

rem ---------- 3. o arquivo da base ----------
rem O arquivo publicado em gov.br esta parado desde 2020 e nao serve.
rem A base atual sai do link de download da pagina do CAEPI, que so
rem funciona no navegador. Vale o arquivo arrastado sobre este programa
rem ou, sem isso, o tgg_export_caepi mais recente da pasta Downloads.
set "ARQ=%~1"
if defined ARQ goto importar
for /f "delims=" %%f in ('dir /b /o-d "%USERPROFILE%\Downloads\tgg_export_caepi*" 2^>nul') do (
  set "ARQ=%USERPROFILE%\Downloads\%%f"
  goto importar
)
goto sem_arquivo

:importar
echo Arquivo: %ARQ%
echo --------------------------------------------------
node supabase\caepi-importar.mjs "%ARQ%"
if errorlevel 2 goto base_velha
if errorlevel 1 goto erro
echo --------------------------------------------------
echo.
echo PRONTO. A busca do CA ja funciona no portal.
echo.
pause
exit /b 0


:criar_chave
rem O portal escreve na base com a chave de servico. Ela nao fica no
rem repositorio: este arquivo e criado aqui, na sua maquina, e o
rem .gitignore impede que ele seja enviado para o GitHub.
> "%CHAVE%" echo # Chave do portal. Este arquivo fica SO na sua maquina.
>> "%CHAVE%" echo # Nao mande para ninguem e nao cole no chat.
>> "%CHAVE%" echo #
>> "%CHAVE%" echo # A chave esta no painel do Supabase, NAO na Vercel: la ela e
>> "%CHAVE%" echo # "sensitive" e nao pode mais ser revelada depois de salva.
>> "%CHAVE%" echo #
>> "%CHAVE%" echo # supabase.com/dashboard/project/emhtpemdulddsghzklta/settings/api-keys
>> "%CHAVE%" echo #   secao "Secret keys", no botao de copiar ao lado do olhinho.
>> "%CHAVE%" echo #
>> "%CHAVE%" echo # Cole abaixo no lugar de cole-a-chave-aqui, salve e feche.
>> "%CHAVE%" echo.
>> "%CHAVE%" echo NEXT_PUBLIC_SUPABASE_URL=https://emhtpemdulddsghzklta.supabase.co
>> "%CHAVE%" echo SUPABASE_SERVICE_ROLE_KEY=cole-a-chave-aqui
echo.
echo Falta a chave do portal. Criei o arquivo para voce preencher:
echo.
echo     chave-do-portal.txt
echo.
echo Ele vai abrir agora no Bloco de Notas. Siga as instrucoes de
echo dentro dele, salve, feche, e rode este programa de novo.
echo.
start "" notepad "%CHAVE%"
pause
exit /b 1

:chave_vazia
echo.
echo O arquivo chave-do-portal.txt ainda esta sem a chave.
echo Vou abri-lo de novo. Troque cole-a-chave-aqui pela chave do Supabase,
echo salve, feche, e rode este programa outra vez.
echo.
start "" notepad "%CHAVE%"
pause
exit /b 1

:sem_arquivo
echo.
echo Nao achei a base do CAEPI na pasta Downloads.
echo Vou abrir a pagina do CAEPI: clique em
echo "Base de dados do sistema CAEPI (Download)", espere baixar
echo e rode este programa de novo.
echo.
start "" "https://caepi.trabalho.gov.br/internet/ConsultaCAinternet.aspx"
pause
exit /b 1

:base_velha
echo --------------------------------------------------
echo.
echo O arquivo e antigo e NAO foi importado (veja a data acima).
echo O portal continua como estava. Baixe a base de novo pelo
echo link da pagina do CAEPI e rode outra vez.
echo.
start "" "https://caepi.trabalho.gov.br/internet/ConsultaCAinternet.aspx"
pause
exit /b 1

:sem_node
echo.
echo Nao encontrei o Node nesta maquina.
echo Instale em https://nodejs.org (a opcao LTS) e rode de novo.
echo.
pause
exit /b 1

:erro
echo.
echo --------------------------------------------------
echo A importacao parou. Nada foi quebrado: o portal
echo continua funcionando com os CAs que ja tinha.
echo Tire um print desta janela e mande no chat.
echo.
pause
exit /b 1
