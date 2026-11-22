import { useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  APP_PACKAGE_ID,
  APP_VERSION,
  APP_VERSION_CODE,
  checkGitHubReleaseUpdate,
  compareAppVersion,
  formatMegabytes,
  isSafeGitHubAssetUrl,
  isValidServerUrl,
  loadSavedGitHubRepo,
  loadSavedServerUrl,
  persistGitHubRepo,
  persistServerUrl,
  type UpdateCheckResult,
} from "../utils/appUpdate";

const KEYTOOL_CMD =
  "keytool -genkey -v -keystore oratorio-release.keystore -alias oratorio -keyalg RSA -keysize 2048 -validity 10000";

const GITHUB_SECRETS = [
  { name: "ANDROID_KEYSTORE_BASE64", desc: "Arquivo .keystore convertido em Base64" },
  { name: "ANDROID_KEYSTORE_PASSWORD", desc: "Senha principal da keystore" },
  { name: "ANDROID_KEY_ALIAS", desc: "Alias da chave (ex.: oratorio)" },
  { name: "ANDROID_KEY_PASSWORD", desc: "Senha da chave (alias)" },
];

function formatReleaseDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function UpdateView() {
  const [repoInput, setRepoInput] = useState<string>(() => loadSavedGitHubRepo());
  const [serverInput, setServerInput] = useState<string>(() => loadSavedServerUrl());
  const [serverMsg, setServerMsg] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const handleSaveServer = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = serverInput.trim();
    if (trimmed && !isValidServerUrl(trimmed)) {
      setServerError(
        "Use um endereço seguro começando com https:// (ou deixe vazio para modo offline)."
      );
      setServerMsg(null);
      return;
    }
    persistServerUrl(trimmed);
    setServerError(null);
    setServerMsg(
      trimmed
        ? "Servidor conectado salvo. As perguntas e orações usarão este endereço."
        : "Modo offline ativado no aparelho (sem servidor externo)."
    );
  };

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = repoInput.trim();
    if (!cleaned) {
      setError("Cole o link do seu repositório no GitHub para verificar atualizações.");
      return;
    }

    persistGitHubRepo(cleaned);
    setChecking(true);
    setError(null);
    setResult(null);

    try {
      const data = await checkGitHubReleaseUpdate(cleaned);
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível consultar a última versão no GitHub."
      );
    } finally {
      setChecking(false);
    }
  };

  const handleCopyKeytool = async () => {
    try {
      await navigator.clipboard.writeText(KEYTOOL_CMD);
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      // Clipboard blocked in iframe
    }
  };

  const versionStatus = result
    ? compareAppVersion(result.versionName, result.versionCode)
    : null;

  const safeApkUrl =
    result?.apkAsset && isSafeGitHubAssetUrl(result.apkAsset.downloadUrl)
      ? result.apkAsset.downloadUrl
      : null;

  const safeReleaseUrl =
    result?.releaseUrl && isSafeGitHubAssetUrl(result.releaseUrl)
      ? result.releaseUrl
      : null;

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 lg:py-12">
      <div className="pb-8 border-b border-[#E5E7EB]">
        <p className="text-xs font-bold text-[#0F3D34] mb-1.5">
          Android APK · GitHub Releases
        </p>
        <h1 className="font-display-condensed text-4xl sm:text-5xl text-[#111827] leading-none">
          Atualizar Aplicativo
        </h1>
        <p className="mt-3 text-sm sm:text-base font-light text-[#525C6B] max-w-2xl leading-relaxed">
          Informe o link do seu repositório no GitHub para verificar novas versões do
          APK e atualizar diretamente por cima do aplicativo atual, preservando seu
          Caderno de Orações sem precisar desinstalar.
        </p>

        {/* Installed app metadata strip */}
        <dl className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-[#E5E7EB]">
          <div>
            <dt className="text-xs font-light text-[#525C6B]">Versão instalada</dt>
            <dd className="mt-1 font-display-condensed text-3xl text-[#111827] tabular-nums">
              v{APP_VERSION}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-light text-[#525C6B]">
              Número do build (versionCode)
            </dt>
            <dd className="mt-1 font-display-condensed text-3xl text-[#111827] tabular-nums">
              {APP_VERSION_CODE}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-light text-[#525C6B]">
              Identificador do pacote Android
            </dt>
            <dd className="mt-1 font-mono text-sm font-medium text-[#0F3D34]">
              {APP_PACKAGE_ID}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-10 items-start">
        {/* Left: GitHub Link Input + Update Status & APK Download */}
        <section aria-labelledby="github-update-heading" className="space-y-7">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <h2
              id="github-update-heading"
              className="font-display-condensed text-3xl text-[#111827]"
            >
              Link do repositório no GitHub
            </h2>
            <p className="mt-2 text-sm font-light text-[#525C6B] leading-relaxed">
              Cole o endereço do repositório onde você subiu o projeto (o endereço fica
              salvo automaticamente neste dispositivo).
            </p>

            <form onSubmit={handleCheck} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="github-repo-input"
                  className="block text-xs font-bold text-[#111827] mb-1.5"
                >
                  Endereço do repositório (https://github.com/usuario/repositorio)
                </label>
                <input
                  id="github-repo-input"
                  type="text"
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  placeholder="https://github.com/seu-usuario/oratorio"
                  className="w-full rounded-xl bg-[#FAFAFA] border border-[#E5E7EB] px-3.5 py-2.5 text-sm font-light text-[#111827] placeholder:text-[#7B8494] focus:bg-white focus:border-[#0F3D34] min-h-[44px]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={checking}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#0F3D34] rounded-lg hover:bg-[#0A2C25] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
                >
                  {checking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verificando no GitHub...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Verificar atualização
                    </>
                  )}
                </button>
              </div>
            </form>

            {error && (
              <div
                role="alert"
                className="mt-5 p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#991B1B] flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Update check result */}
          {result && (
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 space-y-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E5E7EB]">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-light text-[#525C6B]">
                    <span>{result.repoFullName}</span>
                    {result.publishedAt && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{formatReleaseDate(result.publishedAt)}</span>
                      </>
                    )}
                    {result.versionCode !== null && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          Build {result.versionCode}
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="mt-1.5 font-display-condensed text-3xl text-[#111827]">
                    {result.releaseName}
                  </h3>
                </div>

                <div className="text-xs font-bold flex items-center gap-1.5">
                  {versionStatus === "update_available" ? (
                    <span className="inline-flex items-center gap-1.5 text-[#0F3D34]">
                      <Download className="w-4 h-4" />
                      Nova versão disponível (v{result.versionName})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[#525C6B]">
                      <CheckCircle2 className="w-4 h-4 text-[#0F3D34]" />
                      Você já está na versão mais recente
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#F2F4F7] text-sm text-[#111827] flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#0F3D34] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs sm:text-sm">
                    {result.signedRelease
                      ? "Atualização direta sem desinstalar"
                      : "Release gerada em modo debug temporário"}
                  </p>
                  <p className="mt-1 text-xs font-light text-[#525C6B] leading-relaxed">
                    {result.signedRelease
                      ? `Este APK foi compilado com assinatura permanente e pacote ${APP_PACKAGE_ID}. Ao tocar no arquivo baixado no Android, ele atualiza sobre o app existente sem perder suas orações salvas.`
                      : "Para que o Android permita atualizar sem desinstalar em todas as próximas versões, configure os 4 secrets da keystore no GitHub conforme o guia ao lado."}
                  </p>
                </div>
              </div>

              {result.apkAsset && safeApkUrl ? (
                <div className="pt-2 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#525C6B]">
                    <span className="font-mono">{result.apkAsset.name}</span>
                    <span className="font-mono tabular-nums">
                      {formatMegabytes(result.apkAsset.sizeBytes)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={safeApkUrl}
                      download={result.apkAsset.name}
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-3 text-sm font-bold text-white bg-[#0F3D34] rounded-lg hover:bg-[#0A2C25] transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
                    >
                      <Download className="w-4 h-4" />
                      Baixar e atualizar APK
                    </a>

                    {safeReleaseUrl && (
                      <a
                        href={safeReleaseUrl}
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-[#525C6B] hover:text-[#111827] border border-[#E5E7EB] rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Ver release no GitHub
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm font-light text-[#525C6B]">
                  Esta release ainda não possui um arquivo <span className="font-mono">.apk</span>{" "}
                  anexado. Aguarde a conclusão da GitHub Action e clique em verificar novamente.
                </p>
              )}

              {result.releaseNotes && (
                <div className="pt-4 border-t border-[#E5E7EB]">
                  <p className="text-xs font-bold text-[#111827] mb-2">
                    Notas desta versão
                  </p>
                  <pre className="whitespace-pre-wrap font-sans text-xs font-light text-[#525C6B] leading-relaxed">
                    {result.releaseNotes}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Optional Backend Server Connection for Android APK */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <h2 className="font-display-condensed text-3xl text-[#111827]">
              Servidor do aplicativo no Android (opcional)
            </h2>
            <p className="mt-2 text-sm font-light text-[#525C6B] leading-relaxed">
              Sem servidor configurado, o APK funciona normalmente em{" "}
              <strong className="font-bold text-[#111827]">modo offline no celular</strong>. Se quiser usar a IA online no
              APK, cole abaixo o endereço <span className="font-mono text-xs">https://</span>{" "}
              onde seu servidor do Oratório está hospedado.
            </p>

            <form onSubmit={handleSaveServer} className="mt-4 space-y-3">
              <input
                type="url"
                value={serverInput}
                onChange={(e) => {
                  setServerInput(e.target.value);
                  setServerMsg(null);
                  setServerError(null);
                }}
                placeholder="https://seu-oratorio.run.app (opcional)"
                aria-label="Endereço HTTPS do servidor do Oratório"
                className="w-full rounded-xl bg-[#FAFAFA] border border-[#E5E7EB] px-3.5 py-2.5 text-sm font-light text-[#111827] placeholder:text-[#7B8494] focus:bg-white focus:border-[#0F3D34] min-h-[44px]"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#0F3D34] rounded-lg hover:bg-[#0A2C25] transition-colors whitespace-nowrap min-h-[38px]"
                >
                  Salvar configuração
                </button>
                {serverInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setServerInput("");
                      persistServerUrl("");
                      setServerError(null);
                      setServerMsg("Modo offline restaurado no aparelho.");
                    }}
                    className="text-xs font-medium text-[#525C6B] hover:text-[#111827] whitespace-nowrap"
                  >
                    Usar apenas offline
                  </button>
                )}
              </div>
            </form>

            {serverError && (
              <p role="alert" className="mt-3 text-xs font-medium text-[#991B1B]">
                {serverError}
              </p>
            )}
            {serverMsg && (
              <p className="mt-3 text-xs text-[#0F3D34] font-bold">{serverMsg}</p>
            )}
          </div>
        </section>

        {/* Right Rail: Permanent Signing Guide for Uninstall-Free Updates */}
        <aside className="lg:border-l lg:border-[#E5E7EB] lg:pl-9 space-y-6">
          <div>
            <p className="text-xs font-bold text-[#0F3D34] mb-1.5">
              Configuração no GitHub
            </p>
            <h2 className="font-display-condensed text-3xl text-[#111827]">
              Como funciona a atualização sem desinstalar
            </h2>
            <p className="mt-2 text-sm font-light text-[#525C6B] leading-relaxed">
              O projeto já inclui a GitHub Action em{" "}
              <span className="font-mono text-xs text-[#111827]">
                .github/workflows/build-android-apk.yml
              </span>
              . Toda vez que você subir alterações para o GitHub, um novo APK com{" "}
              <span className="font-mono text-xs text-[#111827]">versionCode</span>{" "}
              crescente é gerado e publicado em Releases.
            </p>
          </div>

          <div className="pt-5 border-t border-[#E5E7EB] space-y-3">
            <h3 className="text-sm font-bold text-[#111827]">
              01. Gere sua chave permanente uma única vez
            </h3>
            <p className="text-xs font-light text-[#525C6B] leading-relaxed">
              O Android exige a mesma assinatura criptográfica para instalar uma
              atualização sobre o app original. Gere o arquivo localmente (nunca envie
              o arquivo .keystore para o Git):
            </p>
            <div className="p-3.5 bg-[#F2F4F7] rounded-xl">
              <code className="block font-mono text-[11px] text-[#111827] break-all leading-relaxed">
                {KEYTOOL_CMD}
              </code>
              <button
                type="button"
                onClick={handleCopyKeytool}
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-[#0F3D34] hover:underline underline-offset-4"
              >
                {copiedCmd ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Comando copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar comando keytool
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="pt-5 border-t border-[#E5E7EB] space-y-3">
            <h3 className="text-sm font-bold text-[#111827]">
              02. Cadastre os 4 Secrets no GitHub
            </h3>
            <p className="text-xs font-light text-[#525C6B] leading-relaxed">
              Em <strong className="font-bold text-[#111827]">Settings → Secrets and variables → Actions</strong> do seu
              repositório, adicione:
            </p>
            <dl className="divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
              {GITHUB_SECRETS.map((sec) => (
                <div key={sec.name} className="py-2.5">
                  <dt className="font-mono text-xs font-medium text-[#0F3D34]">
                    {sec.name}
                  </dt>
                  <dd className="text-xs font-light text-[#525C6B] mt-0.5">{sec.desc}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="pt-4 border-t border-[#E5E7EB]">
            <h3 className="text-sm font-bold text-[#111827]">
              03. Atualize direto pelo celular
            </h3>
            <p className="mt-1.5 text-xs font-light text-[#525C6B] leading-relaxed">
              Depois que a Action publicar a release, cole o link do repositório aqui,
              toque em <strong className="font-bold text-[#111827]">Baixar e atualizar APK</strong> e abra o arquivo
              baixado. O Android instalará a nova versão mantendo seu histórico intacto.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
