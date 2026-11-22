# Build Automático de APK e Atualização Sem Desinstalar (GitHub Actions)

Este projeto já está preparado com **Capacitor** (`com.oratorio.app`) e uma **GitHub Action** (`.github/workflows/build-android-apk.yml`) que compila e publica o APK automaticamente nas **Releases do GitHub** sempre que você fizer `push` para `main` ou `master`.

## Como atualizar o APK sem precisar desinstalar o app original

Para que o Android aceite instalar a nova versão **por cima do aplicativo já instalado** (mantendo seu Caderno de Orações e dados intactos), três regras precisam ser cumpridas:

1. **Mesmo `applicationId`**: já fixado como `com.oratorio.app` em `capacitor.config.json`.
2. **`versionCode` sempre crescente**: a GitHub Action já incrementa automaticamente (`100 + github.run_number`) a cada compilação.
3. **Mesma chave de assinatura (`keystore`)**: todas as versões precisam ser assinadas com o mesmo certificado.

### Passo único: criar sua keystore e cadastrar nos Secrets do GitHub

1. Gere o arquivo `.keystore` no seu computador (guarde-o em local seguro e nunca envie para o Git):

```bash
keytool -genkey -v -keystore oratorio-release.keystore -alias oratorio -keyalg RSA -keysize 2048 -validity 10000
```

2. Converta o arquivo para Base64:
   - **Linux / macOS:**
     ```bash
     base64 -w 0 oratorio-release.keystore
     ```
   - **Windows (PowerShell):**
     ```powershell
     [Convert]::ToBase64String([IO.File]::ReadAllBytes("oratorio-release.keystore")) | Set-Clipboard
     ```

3. No seu repositório do GitHub, acesse **Settings → Secrets and variables → Actions → Secrets** e adicione:
   - `ANDROID_KEYSTORE_BASE64`: conteúdo Base64 gerado no passo 2
   - `ANDROID_KEYSTORE_PASSWORD`: senha do keystore
   - `ANDROID_KEY_ALIAS`: `oratorio` (ou o alias escolhido)
   - `ANDROID_KEY_PASSWORD`: senha da chave

4. *(Opcional — para os recursos de IA no APK)*: em **Settings → Secrets and variables → Actions → Variables**, crie a variável `APP_API_URL` com a URL pública onde seu servidor está hospedado (ex.: `https://seu-app.run.app`).

## Atualizando direto pelo aplicativo

1. Abra o **Oratório** e acesse a aba **Atualizar**.
2. Cole o link do seu repositório do GitHub (ex.: `https://github.com/seu-usuario/oratorio`).
3. Toque em **Verificar atualização** e depois em **Baixar e atualizar APK**.
4. Ao abrir o arquivo baixado no Android, o sistema exibirá *"Deseja instalar uma atualização para este aplicativo existente?"* — mantendo seus dados salvos sem precisar desinstalar.
