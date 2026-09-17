import Image from "next/image";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { chatGPTSignInPath, getChatGPTUser } from "@/app/chatgpt-auth";
import { FinanceDashboard } from "@/components/finance-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();

  if (!user) {
    return (
      <main className="login-shell">
        <section className="login-brand-panel">
          <div className="login-logo-frame">
            <Image src="/logo-ig.png" alt="IG Integra Gestão — Sistemas e Consultoria" fill priority className="object-contain" />
          </div>
          <div className="login-copy">
            <span className="eyebrow">Financeiro IG</span>
            <h1>Seu capital organizado, sem complicação.</h1>
            <p>Registre entradas, saídas, contas a receber e acompanhe quem já pagou.</p>
          </div>
        </section>

        <section className="login-form-panel">
          <div className="login-card">
            <span className="login-icon"><LockKeyhole size={22} /></span>
            <p className="eyebrow">Acesso seguro</p>
            <h2>Entrar no financeiro</h2>
            <p className="login-helper">Use sua conta do ChatGPT para acessar os dados da empresa.</p>
            <a href={chatGPTSignInPath("/")} target="_top" className="login-button">
              Entrar com ChatGPT <ArrowRight size={18} />
            </a>
            <p className="login-footnote">Acesso restrito à equipe autorizada.</p>
          </div>
        </section>
      </main>
    );
  }

  return <FinanceDashboard userName={user.displayName} />;
}
