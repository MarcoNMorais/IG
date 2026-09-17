"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ArrowDownLeft, ArrowUpRight, Banknote, CalendarClock, Check, CircleDollarSign, LogOut, Menu, Plus, RefreshCw, Search, Users, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Person = { id: number; name: string; phone: string; notes: string; totalPaidCents: number; paymentCount: number; lastPaymentDate: string | null };
type Category = { id: number; name: string; type: "entry" | "expense" };
type Transaction = { id: number; type: "entry" | "expense"; description: string; category: string; amountCents: number; transactionDate: string; notes: string; personId: number | null; personName: string | null; paidByPersonId: number | null; paidByPersonName: string | null };
type Receivable = { id: number; personId: number; personName: string; description: string; amountCents: number; dueDate: string; status: "pending" | "paid"; paidAt: string | null };
type DashboardData = { people: Person[]; transactions: Transaction[]; receivables: Receivable[]; categories: Category[] };
type Modal = "person" | "entry" | "expense" | "receivable" | null;

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const today = () => new Date().toISOString().slice(0, 10);
function dateLabel(value: string | null) { return value ? shortDate.format(new Date(`${value}T12:00:00Z`)) : "—"; }
function emptyData(): DashboardData { return { people: [], transactions: [], receivables: [], categories: [] }; }

export function FinanceDashboard({ userName }: { userName: string }) {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao carregar");
      setData(result);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível carregar os dados."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const totals = useMemo(() => {
    const entries = data.transactions.filter((item) => item.type === "entry").reduce((sum, item) => sum + item.amountCents, 0);
    const expenses = data.transactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amountCents, 0);
    const pending = data.receivables.filter((item) => item.status === "pending").reduce((sum, item) => sum + item.amountCents, 0);
    return { entries, expenses, pending, balance: entries - expenses };
  }, [data]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool?: (tool: unknown, options?: unknown) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "read_financial_summary", title: "Ler resumo financeiro",
      description: "Retorna saldo, entradas, saídas e valores pendentes exibidos no painel.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async () => ({ balanceCents: totals.balance, entriesCents: totals.entries, expensesCents: totals.expenses, pendingReceivablesCents: totals.pending }),
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [totals]);

  const filteredTransactions = data.transactions.filter((item) => `${item.description} ${item.personName ?? ""} ${item.paidByPersonName ?? ""} ${item.category}`.toLowerCase().includes(search.toLowerCase()));
  const pendingReceivables = data.receivables.filter((item) => item.status === "pending");

  async function submit(endpoint: string, payload: Record<string, unknown>, successMessage: string) {
    setSaving(true);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      toast.success(successMessage); setModal(null); await loadData(); return true;
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); return false; }
    finally { setSaving(false); }
  }

  async function markPaid(id: number) {
    setSaving(true);
    try {
      const response = await fetch(`/api/receivables/${id}/pay`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível confirmar.");
      toast.success("Recebimento confirmado e lançado nas entradas."); await loadData();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível confirmar."); }
    finally { setSaving(false); }
  }

  async function addCategory(type: "entry" | "expense", name: string) {
    setSaving(true);
    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível adicionar a categoria.");
      const category = result.category as Category;
      setData((current) => ({
        ...current,
        categories: [...current.categories.filter((item) => item.id !== category.id), category]
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      }));
      toast.success("Categoria adicionada.");
      return category;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível adicionar a categoria.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  const menuItems = [
    ["overview", WalletCards, "Visão geral"], ["movement", CircleDollarSign, "Entradas e saídas"],
    ["receivables", CalendarClock, "A receber"], ["people", Users, "Quem pagou"],
  ] as const;

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand"><Image src="/logo-ig.png" alt="IG Integra Gestão" fill priority className="object-contain" /></div>
        <nav aria-label="Menu principal" className="side-nav">
          {menuItems.map(([value, Icon, label]) => <button key={value} className={activeTab === value ? "active" : ""} onClick={() => { setActiveTab(value); setMobileMenu(false); }}><Icon size={19} /> {label}</button>)}
        </nav>
        <div className="sidebar-foot"><span className="user-avatar">{userName.slice(0, 1).toUpperCase()}</span><span className="user-copy"><strong>{userName.split("@")[0]}</strong><small>Acesso autorizado</small></span><a href="/signout-with-chatgpt?return_to=%2F" target="_top" aria-label="Sair"><LogOut size={18} /></a></div>
      </aside>
      {mobileMenu && <button className="mobile-overlay" aria-label="Fechar menu" onClick={() => setMobileMenu(false)} />}

      <section className="workspace">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setMobileMenu(true)} aria-label="Abrir menu"><Menu /></button>
          <div><p className="eyebrow">IG Integra Gestão</p><h1>Controle financeiro</h1></div>
          <div className="top-actions"><Button variant="outline" onClick={() => setModal("expense")}><ArrowDownLeft /> Nova saída</Button><Button onClick={() => setModal("entry")} className="brand-button"><Plus /> Nova entrada</Button></div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="dashboard-tabs">
          <TabsList className="mobile-tabs" aria-label="Seções do financeiro"><TabsTrigger value="overview">Resumo</TabsTrigger><TabsTrigger value="movement">Movimentos</TabsTrigger><TabsTrigger value="receivables">A receber</TabsTrigger><TabsTrigger value="people">Pessoas</TabsTrigger></TabsList>

          <TabsContent value="overview" className="tab-stack">
            <section className="summary-grid"><SummaryCard label="Saldo atual" value={totals.balance} icon={WalletCards} tone="navy" /><SummaryCard label="Total de entradas" value={totals.entries} icon={ArrowUpRight} tone="teal" /><SummaryCard label="Total de saídas" value={totals.expenses} icon={ArrowDownLeft} tone="rose" /><SummaryCard label="A receber" value={totals.pending} icon={CalendarClock} tone="gold" /></section>
            <section className="content-grid">
              <div className="panel panel-wide"><PanelTitle title="Movimentações recentes" subtitle="Últimos lançamentos do caixa" action={<button onClick={() => setActiveTab("movement")}>Ver todas</button>} /><TransactionTable rows={data.transactions.slice(0, 6)} loading={loading} /></div>
              <div className="panel receivable-preview"><PanelTitle title="Próximos recebimentos" subtitle={`${pendingReceivables.length} pendente(s)`} /><div className="receivable-list">
                {pendingReceivables.slice(0, 5).map((item) => <div className="receivable-item" key={item.id}><span className="date-box"><strong>{item.dueDate.slice(8, 10)}</strong><small>{new Date(`${item.dueDate}T12:00:00Z`).toLocaleString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "")}</small></span><span><strong>{item.personName}</strong><small>{item.description}</small></span><b>{money.format(item.amountCents / 100)}</b></div>)}
                {!loading && pendingReceivables.length === 0 && <EmptyState icon={CalendarClock} text="Nenhum valor pendente." />}
              </div></div>
            </section>
          </TabsContent>

          <TabsContent value="movement" className="tab-stack">
            <div className="section-heading"><div><p className="eyebrow">Fluxo de caixa</p><h2>Entradas e saídas</h2><p>Todos os valores movimentados pela empresa.</p></div><div className="section-actions"><Button variant="outline" onClick={() => setModal("expense")}><ArrowDownLeft /> Adicionar saída</Button><Button onClick={() => setModal("entry")} className="brand-button"><ArrowUpRight /> Adicionar entrada</Button></div></div>
            <div className="panel"><div className="table-toolbar"><label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar descrição, pessoa ou categoria" /></label><button className="refresh-button" onClick={() => void loadData()} aria-label="Atualizar"><RefreshCw size={18} /></button></div><TransactionTable rows={filteredTransactions} loading={loading} /></div>
          </TabsContent>

          <TabsContent value="receivables" className="tab-stack">
            <div className="section-heading"><div><p className="eyebrow">Contas</p><h2>A receber</h2><p>Acompanhe cobranças pendentes e confirme pagamentos.</p></div><Button onClick={() => setModal("receivable")} className="brand-button"><Plus /> Adicionar a receber</Button></div>
            <div className="panel table-scroll"><Table><TableHeader><TableRow><TableHead>Pessoa</TableHead><TableHead>Descrição</TableHead><TableHead>Vencimento</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead><TableHead /></TableRow></TableHeader><TableBody>
              {data.receivables.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.personName}</TableCell><TableCell>{item.description}</TableCell><TableCell>{dateLabel(item.dueDate)}</TableCell><TableCell><span className={`status ${item.status}`}>{item.status === "paid" ? "Recebido" : item.dueDate < today() ? "Atrasado" : "Pendente"}</span></TableCell><TableCell className="text-right font-semibold">{money.format(item.amountCents / 100)}</TableCell><TableCell className="text-right">{item.status === "pending" && <Button size="sm" variant="outline" disabled={saving} onClick={() => void markPaid(item.id)}><Check /> Confirmar</Button>}</TableCell></TableRow>)}
            </TableBody></Table>{!loading && data.receivables.length === 0 && <EmptyState icon={CalendarClock} text="Nenhuma conta a receber cadastrada." />}</div>
          </TabsContent>

          <TabsContent value="people" className="tab-stack">
            <div className="section-heading"><div><p className="eyebrow">Clientes e pagadores</p><h2>Quem pagou</h2><p>Cadastre pessoas e acompanhe o histórico de pagamentos.</p></div><Button onClick={() => setModal("person")} className="brand-button"><Plus /> Adicionar pessoa</Button></div>
            <div className="panel table-scroll"><Table><TableHeader><TableRow><TableHead>Pessoa</TableHead><TableHead>Contato</TableHead><TableHead>Pagamentos</TableHead><TableHead>Último pagamento</TableHead><TableHead className="text-right">Total pago</TableHead></TableRow></TableHeader><TableBody>
              {data.people.map((person) => <TableRow key={person.id}><TableCell><div className="person-cell"><span>{person.name.slice(0, 1).toUpperCase()}</span><strong>{person.name}</strong></div></TableCell><TableCell>{person.phone || "—"}</TableCell><TableCell>{person.paymentCount}</TableCell><TableCell>{dateLabel(person.lastPaymentDate)}</TableCell><TableCell className="text-right font-semibold">{money.format(person.totalPaidCents / 100)}</TableCell></TableRow>)}
            </TableBody></Table>{!loading && data.people.length === 0 && <EmptyState icon={Users} text="Adicione a primeira pessoa para vincular pagamentos." />}</div>
          </TabsContent>
        </Tabs>
      </section>
      <FinanceModal modal={modal} people={data.people} categories={data.categories} saving={saving} onClose={() => setModal(null)} onSubmit={submit} onAddCategory={addCategory} />
    </main>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof WalletCards; tone: string }) { return <article className={`summary-card ${tone}`}><span className="summary-icon"><Icon size={21} /></span><span><small>{label}</small><strong>{money.format(value / 100)}</strong></span></article>; }
function PanelTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) { return <div className="panel-title"><div><h3>{title}</h3><p>{subtitle}</p></div>{action}</div>; }

function TransactionTable({ rows, loading }: { rows: Transaction[]; loading: boolean }) {
  if (loading) return <div className="loading-state"><RefreshCw className="animate-spin" /> Carregando dados...</div>;
  if (!rows.length) return <EmptyState icon={Banknote} text="Nenhuma movimentação lançada." />;
  return <div className="table-scroll"><Table><TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Pessoa / categoria</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader><TableBody>{rows.map((item) => <TableRow key={item.id}><TableCell><div className="transaction-cell"><span className={item.type}>{item.type === "entry" ? <ArrowUpRight /> : <ArrowDownLeft />}</span><strong>{item.description}</strong></div></TableCell><TableCell><div className="transaction-detail"><span>{item.personName || item.category}</span>{item.type === "expense" && item.paidByPersonName && <small>Pago por {item.paidByPersonName}</small>}</div></TableCell><TableCell>{dateLabel(item.transactionDate)}</TableCell><TableCell className={`text-right amount ${item.type}`}>{item.type === "entry" ? "+" : "−"} {money.format(item.amountCents / 100)}</TableCell></TableRow>)}</TableBody></Table></div>;
}
function EmptyState({ icon: Icon, text }: { icon: typeof Banknote; text: string }) { return <div className="empty-state"><Icon /><p>{text}</p></div>; }

function FinanceModal({ modal, people, categories, saving, onClose, onSubmit, onAddCategory }: { modal: Modal; people: Person[]; categories: Category[]; saving: boolean; onClose: () => void; onSubmit: (endpoint: string, payload: Record<string, unknown>, message: string) => Promise<boolean>; onAddCategory: (type: "entry" | "expense", name: string) => Promise<Category | null> }) {
  const [personId, setPersonId] = useState("");
  const [paidByPersonId, setPaidByPersonId] = useState("none");
  const [category, setCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const movementType = modal === "entry" ? "entry" : "expense";
  const availableCategories = categories.filter((item) => item.type === movementType);

  useEffect(() => {
    if (!modal) return;
    setPersonId(people[0]?.id ? String(people[0].id) : "");
    setPaidByPersonId("none");
    const type = modal === "entry" ? "entry" : "expense";
    setCategory(categories.find((item) => item.type === type)?.name ?? "");
    setAddingCategory(false);
    setNewCategoryName("");
  }, [modal]);

  useEffect(() => {
    if ((modal === "entry" || modal === "expense") && !category) {
      setCategory(availableCategories[0]?.name ?? "");
    }
  }, [availableCategories, category, modal]);

  async function saveNewCategory() {
    const saved = await onAddCategory(movementType, newCategoryName);
    if (!saved) return;
    setCategory(saved.name);
    setNewCategoryName("");
    setAddingCategory(false);
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (modal === "person") await onSubmit("/api/people", Object.fromEntries(form), "Pessoa adicionada com sucesso.");
    if (modal === "entry") await onSubmit("/api/transactions", { ...Object.fromEntries(form), type: "entry", personId: personId ? Number(personId) : null, category }, "Entrada registrada com sucesso.");
    if (modal === "expense") await onSubmit("/api/transactions", { ...Object.fromEntries(form), type: "expense", category, paidByPersonId: paidByPersonId === "none" ? null : Number(paidByPersonId) }, "Saída registrada com sucesso.");
    if (modal === "receivable") await onSubmit("/api/receivables", { ...Object.fromEntries(form), personId: Number(personId) }, "Conta a receber adicionada.");
  }
  const titles = { person: ["Adicionar pessoa", "Cadastre quem paga ou tem valores a pagar."], entry: ["Nova entrada", "Registre um valor recebido pela empresa."], expense: ["Nova saída", "Registre um pagamento ou despesa da empresa."], receivable: ["Adicionar a receber", "Cadastre um valor que ainda será recebido."] } as const;
  if (!modal) return null;
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="finance-dialog"><DialogHeader><DialogTitle>{titles[modal][0]}</DialogTitle><DialogDescription>{titles[modal][1]}</DialogDescription></DialogHeader><form onSubmit={handleSubmit} className="form-stack">
    {modal === "person" ? <><Field label="Nome completo" required><Input name="name" placeholder="Ex.: João da Silva" autoFocus required /></Field><Field label="Telefone"><Input name="phone" placeholder="(75) 99999-9999" /></Field><Field label="Observação"><Input name="notes" placeholder="Informação opcional" /></Field></> : <>
      {(modal === "entry" || modal === "receivable") && <Field label="Pessoa" required={modal === "receivable"}><select className="native-field" value={personId} onChange={(event) => setPersonId(event.target.value)} required={modal === "receivable"}>{modal === "entry" && <option value="">Sem pessoa vinculada</option>}{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>{!people.length && <button type="button" className="inline-link" onClick={() => toast.info("Feche esta tela e use ‘Adicionar pessoa’ na aba Quem pagou.")}>Cadastre uma pessoa primeiro</button>}</Field>}
      <Field label="Descrição" required><Input name="description" placeholder={modal === "expense" ? "Ex.: Hospedagem do sistema" : "Ex.: Mensalidade do sistema"} required /></Field>
      {modal !== "receivable" && <Field label="Categoria" required><div className="category-select-row"><Select value={category} onValueChange={setCategory}><SelectTrigger className="native-field"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger><SelectContent>{availableCategories.map((item) => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" onClick={() => setAddingCategory((current) => !current)}><Plus /> Adicionar</Button></div>{addingCategory && <div className="inline-create"><Input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Nome da nova categoria" autoFocus /><Button type="button" className="brand-button" disabled={saving || !newCategoryName.trim()} onClick={() => void saveNewCategory()}>Salvar categoria</Button></div>}</Field>}
      {modal === "expense" && <Field label="Quem pagou"><Select value={paidByPersonId} onValueChange={setPaidByPersonId}><SelectTrigger className="native-field"><SelectValue placeholder="Selecione quem pagou" /></SelectTrigger><SelectContent><SelectItem value="none">Não informado</SelectItem>{people.map((person) => <SelectItem key={person.id} value={String(person.id)}>{person.name}</SelectItem>)}</SelectContent></Select>{!people.length && <span className="field-hint">Cadastre a pessoa primeiro na aba “Quem pagou”.</span>}</Field>}
      <div className="form-grid"><Field label="Valor (R$)" required><Input name="amount" inputMode="decimal" placeholder="0,00" required /></Field><Field label={modal === "receivable" ? "Vencimento" : "Data"} required><Input name={modal === "receivable" ? "dueDate" : "transactionDate"} type="date" defaultValue={today()} required /></Field></div>
      {modal !== "receivable" && <Field label="Observação"><Input name="notes" placeholder="Informação opcional" /></Field>}
    </>}
    <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" className="brand-button" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <label className="field-label"><span>{label}{required && <b> *</b>}</span>{children}</label>; }
