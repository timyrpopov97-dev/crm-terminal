'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import {
GripVertical, Zap, FileText, Copy, MessageCircle, Send, Bot, Phone, MessageSquare,
} from "lucide-react";

const COLUMNS = ["lead", "negotiations", "closed", "rejected"];
const COLUMN_LABELS_DEFAULTS = {
lead: "ЛИД",
negotiations: "ПЕРЕГОВОРЫ",
closed: "ЗАКРЫТО",
rejected: "ОТКАЗ",
};

const CURRENCIES = {
UAH: { symbol: "₴", rate: 1 },
USD: { symbol: "$", rate: 0 },
EUR: { symbol: "€", rate: 0 },
BTC: { symbol: "₿", rate: 0 },
ETH: { symbol: "Ξ", rate: 0 },
USDT: { symbol: "₮", rate: 0 },
};

const RATES_TTL_MS = 5 * 60 * 1000;
let cachedRates = null;
let ratesFetchTime = 0;

async function fetchRates() {
if (cachedRates && Date.now() - ratesFetchTime < RATES_TTL_MS) {
return cachedRates;
}

const rates = {};
try {
const fiatRes = await fetch("https://open.er-api.com/v6/latest/USD");
const fiatData = await fiatRes.json();
rates.UAH = fiatData.rates.UAH || 1;

const cryptoRes = await fetch(
"https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd"
);
const cryptoData = await cryptoRes.json();
rates.BTC = cryptoData.bitcoin.usd || 0;
rates.ETH = cryptoData.ethereum.usd || 0;
rates.USDT = cryptoData.tether.usd || 1;
} catch (e) {
console.error("Rate fetch error:", e);
}

rates.USD = 1;
rates.EUR = fiatRes ? rates.USD / (fiatData?.rates?.EUR || 1) : 1;

cachedRates = rates;
ratesFetchTime = Date.now();
return rates;
}

function convert(amount, from, to, rates) {
if (!rates[from] || !rates[to]) return amount;
return (amount / rates[from]) * rates[to];
}

export default function Board() {
const router = useRouter();
const [deals, setDeals] = useState([]);
const [loading, setLoading] = useState(true);
const [draggedDeal, setDraggedDeal] = useState(null);
const [columnLabels, setColumnLabels] = useState(COLUMN_LABELS_DEFAULTS);
const [editingColumn, setEditingColumn] = useState(null);
const [currency, setCurrency] = useState("UAH");
const [rates, setRates] = useState({});
const [search, setSearch] = useState("");
const [selectedDeal, setSelectedDeal] = useState(null);
const [messageModal, setMessageModal] = useState(null);

const user = useRef(null);

useEffect(() => {
const checkAuth = async () => {
const { data } = await supabase.auth.getSession();
if (!data.session) {
router.push("/login");
return;
}
user.current = data.session.user;
loadDeals();
loadSettings();
const r = await fetchRates();
setRates(r);
};
checkAuth();
}, [router]);

const loadDeals = async () => {
if (!user.current) return;
const { data, error } = await supabase
.from("deals")
.select("*")
.eq("user_id", user.current.id);
if (error) {
console.error("Error loading deals:", error);
} else {
setDeals(data || []);
}
setLoading(false);
};

const loadSettings = async () => {
if (!user.current) return;
const { data } = await supabase
.from("board_settings")
.select("column_labels, currency")
.eq("user_id", user.current.id)
.single();

if (data) {
setColumnLabels(data.column_labels || COLUMN_LABELS_DEFAULTS);
setCurrency(data.currency || "UAH");
}
};

const saveSettings = async (newLabels, newCurrency) => {
if (!user.current) return;
await supabase.from("board_settings").upsert({
user_id: user.current.id,
column_labels: newLabels,
currency: newCurrency,
});
};

const updateDeal = async (id, updates) => {
if (!user.current) return;
const { error } = await supabase
.from("deals")
.update(updates)
.eq("id", id)
.eq("user_id", user.current.id);
if (!error) {
setDeals((prev) =>
prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
);
}
};

const deleteDeal = async (id) => {
if (!user.current) return;
await supabase
.from("deals")
.delete()
.eq("id", id)
.eq("user_id", user.current.id);
setDeals((prev) => prev.filter((d) => d.id !== id));
};

const openMessageModal = (deal) => {
try {
const msgData = JSON.parse(deal.description.split("---").pop().trim());
setMessageModal({
name: deal.name,
...msgData,
});
} catch (e) {
setMessageModal({
name: deal.name,
text: deal.description,
timestamp: "неизвестно",
telegramLink: "",
});
}
};

const filteredDeals = deals.filter((d) =>
d.name.toLowerCase().includes(search.toLowerCase()) ||
d.company.toLowerCase().includes(search.toLowerCase()) ||
d.email.toLowerCase().includes(search.toLowerCase())
);

const handleDragStart = (e, deal) => {
setDraggedDeal(deal);
e.dataTransfer.effectAllowed = "move";
};

const handleDragOver = (e) => {
e.preventDefault();
e.dataTransfer.dropEffect = "move";
};

const handleDrop = (e, newStage) => {
e.preventDefault();
if (draggedDeal) {
updateDeal(draggedDeal.id, { stage: newStage });
setDraggedDeal(null);
}
};

const logout = async () => {
await supabase.auth.signOut();
router.push("/login");
};

if (loading) return <div className="text-center text-term-text py-8">Загрузка...</div>;

return (
<div className="min-h-screen bg-term-bg text-term-text p-4 font-mono">
<div className="max-w-7xl mx-auto">
<div className="flex justify-between items-center mb-6">
<h1 className="text-2xl font-bold text-term-accent">CRM Terminal</h1>
<button
onClick={logout}
className="px-4 py-2 bg-term-accent text-term-bg rounded hover:bg-term-accentSoft transition"
>
Logout
</button>
</div>

<div className="mb-6 flex gap-4">
<input
type="text"
placeholder="Поиск..."
value={search}
onChange={(e) => setSearch(e.target.value)}
className="flex-1 px-3 py-2 bg-term-panel border border-term-border rounded text-term-text placeholder-term-muted"
/>
<select
value={currency}
onChange={(e) => {
setCurrency(e.target.value);
saveSettings(columnLabels, e.target.value);
}}
className="px-3 py-2 bg-term-panel border border-term-border rounded text-term-text"
>
{Object.keys(CURRENCIES).map((c) => (
<option key={c} value={c}>
{CURRENCIES[c].symbol} {c}
</option>
))}
</select>
<button
onClick={async () => {
const r = await fetchRates();
setRates(r);
}}
className="px-3 py-2 bg-term-accent text-term-bg rounded hover:bg-term-accentSoft transition"
>
Обновить курс
</button>
</div>

<div className="grid grid-cols-4 gap-4">
{COLUMNS.map((col) => (
<div
key={col}
className="bg-term-panel border border-term-border rounded p-4 min-h-96"
onDragOver={handleDragOver}
onDrop={(e) => handleDrop(e, col)}
>
<div className="flex justify-between items-center mb-4">
{editingColumn === col ? (
<input
autoFocus
defaultValue={columnLabels[col]}
onBlur={(e) => {
const newLabels = { ...columnLabels, [col]: e.target.value };
setColumnLabels(newLabels);
saveSettings(newLabels, currency);
setEditingColumn(null);
}}
onKeyDown={(e) => {
if (e.key === "Enter") {
const newLabels = { ...columnLabels, [col]: e.target.value };
setColumnLabels(newLabels);
saveSettings(newLabels, currency);
setEditingColumn(null);
}
}}
className="px-2 py-1 bg-term-bg border border-term-accent rounded text-term-accent"
/>
) : (
<h2
onClick={() => setEditingColumn(col)}
className="font-bold text-term-accent cursor-pointer hover:text-term-cyan"
>
{columnLabels[col]} ({filteredDeals.filter((d) => d.stage === col).length})
</h2>
)}
</div>

<div className="space-y-2">
{filteredDeals
.filter((d) => d.stage === col)
.map((d) => (
<div
key={d.id}
draggable
onDragStart={(e) => handleDragStart(e, d)}
onClick={() => setSelectedDeal(d)}
className="p-3 bg-term-bg border border-term-border rounded cursor-move hover:border-term-accent transition"
>
<div className="flex items-center gap-2 mb-2">
<GripVertical size={13} className="text-term-muted" />
<span className="font-bold text-sm truncate">{d.name}</span>
{d.source === "telegram" && (
<span title="Авто-лид из Telegram" className="text-term-cyan shrink-0">
<Bot size={12} />
</span>
)}
</div>
<div className="text-xs text-term-muted space-y-1">
{d.company && <div>🏢 {d.company}</div>}
{d.phone && <div>📱 {d.phone}</div>}
{d.email && <div>✉️ {d.email}</div>}
{d.amount > 0 && (
<div>
💰{" "}
{convert(d.amount, d.currency, currency, rates).toFixed(2)}{" "}
{CURRENCIES[currency].symbol}
</div>
)}
</div>
</div>
))}
</div>
</div>
))}
</div>
</div>

{selectedDeal && (
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
<div className="bg-term-panel border border-term-border rounded p-6 max-w-md w-full max-h-96 overflow-y-auto">
<div className="flex justify-between items-start mb-4">
<h2 className="text-xl font-bold text-term-accent">{selectedDeal.name}</h2>
<button
onClick={() => setSelectedDeal(null)}
className="text-term-muted hover:text-term-accent"
>
✕
</button>
</div>

<div className="space-y-2 text-sm mb-4">
{selectedDeal.company && <p>🏢 <strong>Компания:</strong> {selectedDeal.company}</p>}
{selectedDeal.phone && <p>📱 <strong>Телефон:</strong> {selectedDeal.phone}</p>}
{selectedDeal.email && <p>✉️ <strong>Email:</strong> {selectedDeal.email}</p>}
{selectedDeal.amount > 0 && (
<p>
💰 <strong>Сумма:</strong>{" "}
{convert(selectedDeal.amount, selectedDeal.currency, currency, rates).toFixed(2)}{" "}
{CURRENCIES[currency].symbol}
</p>
)}
<p className="text-term-muted">{selectedDeal.description.slice(0, 200)}...</p>
</div>

<div className="flex flex-wrap gap-2 mb-4">
{selectedDeal.source === "telegram" && (
<button
onClick={() => openMessageModal(selectedDeal)}
className="flex items-center gap-1 px-2 py-1 bg-term-cyan text-term-bg rounded text-xs hover:opacity-80 transition"
>
<MessageSquare size={12} />
Текст сообщения
</button>
)}
<button
onClick={() => window.open(`tel:${selectedDeal.phone}`)}
className="flex items-center gap-1 px-2 py-1 bg-term-accent text-term-bg rounded text-xs hover:opacity-80 transition"
>
<Phone size={12} />
Звонок
</button>
<button
onClick={() =>
window.open(`mailto:${selectedDeal.email}`, "_blank")
}
className="flex items-center gap-1 px-2 py-1 bg-term-accent text-term-bg rounded text-xs hover:opacity-80 transition"
>
<Send size={12} />
Email
</button>
</div>

<div className="flex gap-2">
<select
defaultValue={selectedDeal.stage}
onChange={(e) => updateDeal(selectedDeal.id, { stage: e.target.value })}
className="flex-1 px-2 py-1 bg-term-bg border border-term-border rounded text-term-text text-xs"
>
{COLUMNS.map((col) => (
<option key={col} value={col}>
{columnLabels[col]}
</option>
))}
</select>
<button
onClick={() => deleteDeal(selectedDeal.id)}
className="px-2 py-1 bg-term-danger text-term-bg rounded text-xs hover:opacity-80 transition"
>
Удалить
</button>
<button
onClick={() => setSelectedDeal(null)}
className="px-2 py-1 bg-term-muted text-term-bg rounded text-xs hover:opacity-80 transition"
>
Закрыть
</button>
</div>
</div>
</div>
)}

{messageModal && (
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
<div className="bg-term-panel border border-term-border rounded p-6 max-w-2xl w-full max-h-96 overflow-y-auto">
<div className="flex justify-between items-start mb-4">
<div>
<h2 className="text-xl font-bold text-term-accent">{messageModal.name}</h2>
<p className="text-xs text-term-muted">Поступило: {messageModal.timestamp}</p>
</div>
<button
onClick={() => setMessageModal(null)}
className="text-term-muted hover:text-term-accent"
>
✕
</button>
</div>

<div className="bg-term-bg border border-term-border rounded p-4 mb-4">
<p className="text-sm text-term-text whitespace-pre-wrap">{messageModal.text}</p>
</div>

{messageModal.telegramLink && (
<a
href={messageModal.telegramLink}
target="_blank"
rel="noopener noreferrer"
className="flex items-center gap-2 px-4 py-2 bg-term-cyan text-term-bg rounded font-semibold hover:opacity-80 transition w-full justify-center"
>
<MessageCircle size={18} />
Написать в Telegram
</a>
)}

<button
onClick={() => setMessageModal(null)}
className="w-full mt-4 px-4 py-2 bg-term-muted text-term-bg rounded hover:opacity-80 transition"
>
Закрыть
</button>
</div>
</div>
)}
</div>
);
}
