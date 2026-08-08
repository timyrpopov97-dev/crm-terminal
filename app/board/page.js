"use client";
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import {
  Phone, Mail, Plus, X, Trash2, Search, Building2, Banknote,
  GripVertical, Zap, FileText, Copy, MessageCircle, Send,
  CalendarClock, LogOut, Terminal,
} from "lucide-react";

const STAGES = [
  { id: "lead", label: "ЛИД", note: "первый контакт" },
  { id: "negotiation", label: "ПЕРЕГОВОРЫ", note: "обсуждение" },
  { id: "won", label: "ЗАКРЫТО", note: "сделка заключена" },
  { id: "lost", label: "ОТКАЗ", note: "не сложилось" },
];

const CURRENCIES = {
  UAH: { symbol: "₴" },
  USD: { symbol: "$" },
  EUR: { symbol: "€" },
};

const MOVE_THRESHOLD = 9;
const FLY_MS = 220;
const EMPTY_FORM = { name: "", company: "", phone: "", email: "", amount: "", description: "" };

function formatMoney(n, currency) {
  const num = Number(n) || 0;
  return num.toLocaleString("ru-RU") + " " + (CURRENCIES[currency]?.symbol || "");
}

function digitsOnly(phone) {
  return (phone || "").replace(/[^\d]/g, "");
}
function waLink(phone) {
  return `https://wa.me/${digitsOnly(phone)}`;
}
function tgLink(phone) {
  return `https://t.me/+${digitsOnly(phone)}`;
}
function mailtoLink(email, dealName) {
  return `mailto:${email}?subject=${encodeURIComponent("Re: " + dealName)}`;
}
function openGmail(email, dealName) {
  if (!email) return;
  const appUrl = `googlegmail://co?to=${encodeURIComponent(email)}&subject=${encodeURIComponent("Re: " + dealName)}`;
  let left = false;
  const markLeft = () => { if (document.hidden) left = true; };
  document.addEventListener("visibilitychange", markLeft);
  window.location.href = appUrl;
  setTimeout(() => {
    document.removeEventListener("visibilitychange", markLeft);
    if (!left) window.location.href = mailtoLink(email, dealName);
  }, 700);
}
async function copyText(text, msg, showToast) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast(`> ${msg}`);
  } catch {
    showToast("> не удалось скопировать");
  }
}

export default function BoardPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [deals, setDeals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState("");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [activeId, setActiveId] = useState(null);
  const [currency, setCurrency] = useState("UAH");
  const [toast, setToast] = useState(null);
  const [flyingId, setFlyingId] = useState(null);
  const toastTimer = useRef(null);

  const [draggingId, setDraggingId] = useState(null);
  const [ghostRect, setGhostRect] = useState(null);
  const [hoverStage, setHoverStage] = useState(null);
  const dragInfo = useRef({ id: null, startX: 0, startY: 0, offsetX: 0, offsetY: 0, moved: false, originStage: null, width: 0, height: 0 });
  const columnRefs = useRef({});

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  // ---- auth guard + initial load ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      if (mounted) setUserEmail(data.session.user.email || "");
      const savedCurrency = window.localStorage.getItem("crm:currency");
      if (savedCurrency && CURRENCIES[savedCurrency]) setCurrency(savedCurrency);
      await loadDeals();
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDeals = async () => {
    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setSaveError(error.message);
      return;
    }
    setDeals(data || []);
  };

  const changeCurrency = (c) => {
    setCurrency(c);
    window.localStorage.setItem("crm:currency", c);
  };

  const addDeal = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    const { data, error } = await supabase
      .from("deals")
      .insert({
        user_id: uid,
        name: form.name.trim(),
        company: form.company.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        amount: form.amount || 0,
        description: form.description.trim(),
        currency,
        stage: "lead",
      })
      .select()
      .single();
    if (error) {
      setSaveError(error.message);
      return;
    }
    setDeals((prev) => [data, ...(prev || [])]);
    setForm(EMPTY_FORM);
    setShowForm(false);
    showToast("> сделка добавлена");
  };

  const setStage = async (id, stage) => {
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, stage } : d)));
    const { error } = await supabase.from("deals").update({ stage }).eq("id", id);
    if (error) setSaveError(error.message);
  };

  const quickMove = (d, targetStage) => {
    if (d.stage === targetStage || flyingId) return;
    setFlyingId(d.id);
    const label = STAGES.find((s) => s.id === targetStage)?.label;
    setTimeout(() => {
      setStage(d.id, targetStage);
      setFlyingId(null);
      showToast(`> лид улетел в «${label}»`);
    }, FLY_MS);
  };

  const removeDeal = async (id) => {
    setDeals((prev) => prev.filter((d) => d.id !== id));
    const { error } = await supabase.from("deals").delete().eq("id", id);
    if (error) setSaveError(error.message);
    else showToast("> сделка удалена");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const filtered = (deals || []).filter((d) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      d.name.toLowerCase().includes(q) ||
      (d.company || "").toLowerCase().includes(q) ||
      (d.phone || "").toLowerCase().includes(q) ||
      (d.description || "").toLowerCase().includes(q)
    );
  });

  const totals = STAGES.reduce((acc, s) => {
    acc[s.id] = filtered.filter((d) => d.stage === s.id).reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    return acc;
  }, {});

  // ---- pointer drag & drop ----
  const stageAtPoint = (x, y) => {
    for (const stage of STAGES) {
      const node = columnRefs.current[stage.id];
      if (!node) continue;
      const r = node.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return stage.id;
    }
    return null;
  };

  const onCardPointerDown = (e, deal) => {
    if (e.button !== undefined && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    dragInfo.current = {
      id: deal.id, startX: e.clientX, startY: e.clientY,
      offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top,
      moved: false, originStage: deal.stage, width: rect.width, height: rect.height,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onCardPointerMove = (e) => {
    const info = dragInfo.current;
    if (!info.id) return;
    const dx = e.clientX - info.startX;
    const dy = e.clientY - info.startY;
    if (!info.moved) {
      if (Math.hypot(dx, dy) < MOVE_THRESHOLD) return;
      info.moved = true;
      setDraggingId(info.id);
      setActiveId(null);
    }
    setGhostRect({ x: e.clientX - info.offsetX, y: e.clientY - info.offsetY, width: info.width, height: info.height });
    setHoverStage(stageAtPoint(e.clientX, e.clientY));
  };

  const endDrag = (e) => {
    const info = dragInfo.current;
    if (!info.id) return;
    if (info.moved) {
      const target = stageAtPoint(e.clientX, e.clientY);
      if (target && target !== info.originStage) {
        setStage(info.id, target);
        showToast(`> перемещено в «${STAGES.find((s) => s.id === target)?.label}»`);
      }
    } else {
      setActiveId((cur) => (cur === info.id ? null : info.id));
    }
    dragInfo.current = { id: null, startX: 0, startY: 0, offsetX: 0, offsetY: 0, moved: false, originStage: null, width: 0, height: 0 };
    setDraggingId(null);
    setGhostRect(null);
    setHoverStage(null);
  };

  const draggedDeal = draggingId ? (deals || []).find((d) => d.id === draggingId) : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10">
        <div className="text-term-accent text-sm">booting terminal…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-16 relative z-10 touch-pan-y">
      <header className="flex justify-between items-start flex-wrap gap-3 mb-4">
        <div>
          <div className="text-[10px] text-term-muted tracking-wider">root@crm-terminal:~$</div>
          <h1 className="font-bold text-2xl flex items-center gap-2" style={{ textShadow: "0 0 12px rgba(0,255,106,0.45)" }}>
            <span className="text-term-accent">&gt;</span> БАЗА_СДЕЛОК
            <span className="text-term-accent blink-cursor">▌</span>
          </h1>
          <div className="text-[11px] text-term-muted mt-1">{userEmail}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex border border-term-border rounded-lg overflow-hidden">
            {Object.entries(CURRENCIES).map(([code, c]) => (
              <button
                key={code}
                onClick={() => changeCurrency(code)}
                className={`px-3 py-2 text-sm font-bold ${currency === code ? "bg-term-accentSoft text-term-accent" : "bg-term-panel text-term-muted"}`}
              >
                {c.symbol}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 border border-term-accent text-term-accent rounded-lg px-3.5 py-2 text-xs font-bold"
          >
            <Plus size={15} /> НОВЫЙ_ЛИД
          </button>
          <button onClick={logout} title="Выйти" className="border border-term-border text-term-muted rounded-lg px-2.5 py-2">
            <LogOut size={15} />
          </button>
        </div>
      </header>

      <div className="flex items-center gap-2 bg-term-panel border border-term-border rounded-lg px-3 py-2 mb-4 max-w-md">
        <Search size={14} className="text-term-muted" />
        <input
          className="bg-transparent outline-none text-sm flex-1"
          placeholder="grep --client, компания, телефон, описание"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {saveError && (
        <div className="text-xs text-term-danger border border-term-danger bg-red-950/30 rounded-md px-3 py-2 mb-4">
          [!] {saveError}
        </div>
      )}

      <div className="grid gap-3.5 overflow-x-auto pb-2" style={{ gridTemplateColumns: "repeat(4, minmax(240px, 1fr))" }}>
        {STAGES.map((stage) => {
          const stageDeals = filtered.filter((d) => d.stage === stage.id);
          const isOver = hoverStage === stage.id && draggingId;
          return (
            <div
              key={stage.id}
              ref={(node) => (columnRefs.current[stage.id] = node)}
              className="border rounded-xl p-3.5 flex flex-col min-h-[200px] bg-term-panel transition-shadow"
              style={{ borderColor: isOver ? "#00ff6a" : "#1d3226", boxShadow: isOver ? "0 0 0 1px #00ff6a, 0 0 24px -4px rgba(0,255,106,0.45)" : "0 1px 0 rgba(0,255,106,0.03)" }}
            >
              <div className="flex justify-between items-start mb-1">
                <div>
                  <div className="font-bold text-sm tracking-wide">{stage.label}</div>
                  <div className="text-[11px] text-term-muted mt-0.5">// {stage.note}</div>
                </div>
                <div className="text-xs text-term-accent border border-term-border rounded-full px-2 py-0.5">{stageDeals.length}</div>
              </div>
              <div className="text-xs text-term-cyan mb-2.5 mt-1.5">{formatMoney(totals[stage.id], currency)}</div>

              <div className="flex flex-col gap-2 flex-1">
                {stageDeals.length === 0 && (
                  <div className="text-[11px] text-term-muted border border-dashed border-term-border rounded-lg px-2.5 py-4 text-center">
                    {draggingId ? "drop_here" : "пусто — перетащите карточку"}
                  </div>
                )}
                {stageDeals.map((d) => {
                  const isBeingDragged = draggingId === d.id;
                  const isFlying = flyingId === d.id;
                  return (
                    <div
                      key={d.id}
                      className="card-in bg-[#081109] border border-term-border rounded-lg px-3 py-2.5 transition-all"
                      style={{
                        opacity: isBeingDragged || isFlying ? 0.15 : 1,
                        transform: isFlying ? "scale(0.7) translateY(-14px)" : "scale(1)",
                        borderLeft: `3px solid ${activeId === d.id ? "#00ff6a" : "transparent"}`,
                      }}
                    >
                      <div className="flex justify-between items-center gap-1.5">
                        <div
                          className="flex items-center gap-1.5 flex-1 cursor-grab"
                          style={{ touchAction: "none" }}
                          onPointerDown={(e) => onCardPointerDown(e, d)}
                          onPointerMove={onCardPointerMove}
                          onPointerUp={endDrag}
                          onPointerCancel={endDrag}
                        >
                          <GripVertical size={13} className="text-term-muted" />
                          <span className="font-bold text-sm">{d.name}</span>
                        </div>
                        <button className="text-term-muted p-1" onClick={(e) => { e.stopPropagation(); removeDeal(d.id); }}>
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="cursor-pointer" onClick={() => setActiveId(activeId === d.id ? null : d.id)}>
                        {d.company && (
                          <div className="flex items-center gap-1.5 text-[11px] text-term-muted mt-1">
                            <Building2 size={12} /> {d.company}
                          </div>
                        )}
                        {Number(d.amount) > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-term-accent font-bold mt-1">
                            <Banknote size={12} /> {formatMoney(d.amount, currency)}
                          </div>
                        )}
                        {d.description && (
                          <div className="flex items-start gap-1.5 text-[11px] text-term-muted mt-1.5 leading-snug">
                            <FileText size={11} className="mt-0.5 shrink-0" />
                            <span>{d.description.length > 60 ? d.description.slice(0, 60) + "…" : d.description}</span>
                          </div>
                        )}
                      </div>

                      {activeId === d.id && (
                        <div className="mt-2.5 pt-2.5 border-t border-term-border flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {d.phone && (
                            <>
                              <div className="text-[9.5px] text-term-muted uppercase tracking-wider">телефон</div>
                              <div className="flex gap-1.5">
                                <a href={`tel:${d.phone}`} className="flex-1 flex items-center justify-center bg-term-accentSoft text-term-accent border border-term-border rounded-md py-2" title="Позвонить">
                                  <Phone size={14} />
                                </a>
                                <a href={waLink(d.phone)} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center bg-term-accentSoft text-term-accent border border-term-border rounded-md py-2" title="WhatsApp">
                                  <MessageCircle size={14} />
                                </a>
                                <a href={tgLink(d.phone)} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center bg-term-accentSoft text-term-accent border border-term-border rounded-md py-2" title="Telegram">
                                  <Send size={14} />
                                </a>
                                <button onClick={() => copyText(d.phone, "Номер скопирован", showToast)} className="flex-1 flex items-center justify-center bg-term-accentSoft text-term-accent border border-term-border rounded-md py-2" title="Копировать">
                                  <Copy size={13} />
                                </button>
                              </div>
                            </>
                          )}
                          {d.email && (
                            <>
                              <div className="text-[9.5px] text-term-muted uppercase tracking-wider mt-1">почта</div>
                              <div className="flex gap-1.5">
                                <button onClick={() => openGmail(d.email, d.name)} className="flex-[2] flex items-center justify-center gap-1.5 bg-term-accentSoft text-term-accent border border-term-border rounded-md py-2 text-[11px] font-bold">
                                  <Mail size={14} /> GMAIL
                                </button>
                                <button onClick={() => copyText(d.email, "Email скопирован", showToast)} className="flex-1 flex items-center justify-center bg-term-accentSoft text-term-accent border border-term-border rounded-md py-2" title="Копировать">
                                  <Copy size={13} />
                                </button>
                              </div>
                            </>
                          )}

                          <button
                            onClick={() => showToast(`> встреча с ${d.name} назначена`)}
                            className="w-full flex items-center justify-center gap-1.5 bg-term-accentSoft text-term-accent border border-term-border rounded-md py-2 text-[11px] font-bold mt-1"
                          >
                            <CalendarClock size={13} /> ВСТРЕЧА
                          </button>

                          <div className="flex items-center gap-1.5 text-[10px] text-term-muted mt-1">
                            <Zap size={11} /> отправить в колонку
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {STAGES.map((s) => (
                              <button
                                key={s.id}
                                disabled={s.id === d.stage}
                                onClick={() => quickMove(d, s.id)}
                                className="border border-term-border rounded-md py-1.5 text-[9.5px] font-bold text-term-cyan disabled:opacity-40 disabled:text-term-muted"
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {draggedDeal && ghostRect && (
        <div
          className="fixed bg-[#081109] border border-term-border rounded-lg px-3 py-2.5 pointer-events-none z-50"
          style={{
            left: ghostRect.x, top: ghostRect.y, width: ghostRect.width,
            boxShadow: "0 0 30px -4px rgba(0,255,106,0.45)",
            transform: "rotate(-1.5deg) scale(1.03)",
            borderLeft: "3px solid #00ff6a",
          }}
        >
          <div className="font-bold text-sm">{draggedDeal.name}</div>
          {draggedDeal.company && (
            <div className="flex items-center gap-1.5 text-[11px] text-term-muted mt-1">
              <Building2 size={12} /> {draggedDeal.company}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-30" onClick={() => setShowForm(false)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={addDeal}
            className="bg-term-panel border border-term-borderBright rounded-xl p-5 w-full max-w-sm flex flex-col gap-3"
            style={{ boxShadow: "0 0 40px -6px rgba(0,255,106,0.45)" }}
          >
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-term-accent font-bold text-sm">
                <Terminal size={15} /> ./new_lead.sh
              </span>
              <button type="button" onClick={() => setShowForm(false)} className="text-term-muted">
                <X size={16} />
              </button>
            </div>

            <label className="text-[11px] text-term-muted font-semibold flex flex-col gap-1">
              имя_клиента
              <input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-black/40 border border-term-border rounded-md px-2.5 py-2 text-sm text-term-text" placeholder="Анна Смирнова" />
            </label>
            <label className="text-[11px] text-term-muted font-semibold flex flex-col gap-1">
              компания
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="bg-black/40 border border-term-border rounded-md px-2.5 py-2 text-sm text-term-text" placeholder="ООО «Ромашка»" />
            </label>
            <div className="flex gap-2.5">
              <label className="text-[11px] text-term-muted font-semibold flex flex-col gap-1 flex-1">
                телефон
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="bg-black/40 border border-term-border rounded-md px-2.5 py-2 text-sm text-term-text" placeholder="+380 00 000 00 00" />
              </label>
              <label className="text-[11px] text-term-muted font-semibold flex flex-col gap-1 flex-1">
                сумма ({CURRENCIES[currency].symbol})
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="bg-black/40 border border-term-border rounded-md px-2.5 py-2 text-sm text-term-text" placeholder="150000" />
              </label>
            </div>
            <label className="text-[11px] text-term-muted font-semibold flex flex-col gap-1">
              email
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="bg-black/40 border border-term-border rounded-md px-2.5 py-2 text-sm text-term-text" placeholder="anna@example.com" />
            </label>
            <label className="text-[11px] text-term-muted font-semibold flex flex-col gap-1">
              описание
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="bg-black/40 border border-term-border rounded-md px-2.5 py-2 text-sm text-term-text min-h-[60px] resize-y"
                placeholder="контекст сделки, договорённости, следующий шаг…" />
            </label>

            <button type="submit" className="bg-term-accent text-black font-bold rounded-md py-2.5 text-sm mt-1">
              $ ./add_deal --confirm
            </button>
          </form>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-[#08150d] text-term-accent border border-term-accent rounded-lg px-4 py-2.5 text-xs z-40"
          style={{ boxShadow: "0 0 20px -4px rgba(0,255,106,0.45)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
