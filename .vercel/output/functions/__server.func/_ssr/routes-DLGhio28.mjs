import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Plus, i as Settings, o as List, r as Trash2, s as Activity, t as X } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DLGhio28.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var EPS = 1e-8;
function parsePct(raw) {
	const text = raw.trim();
	if (!text) return null;
	if (!/^\d{1,3}([.,]\d+)?$/.test(text)) return null;
	const n = Number(text.replace(",", "."));
	if (!Number.isFinite(n) || n < 0 || n > 100) return null;
	return n;
}
function parseCount(raw) {
	const text = raw.trim();
	if (!/^\d+$/.test(text)) return null;
	const n = Number(text);
	return Number.isSafeInteger(n) ? n : null;
}
/** MM:SS or M:SS. Empty is unset (null). Invalid shape is null as well — callers distinguish with trim. */
function parseClock(raw) {
	const text = raw.trim();
	if (!text) return null;
	const match = /^(\d{1,3}):([0-5]\d)$/.exec(text);
	if (!match) return null;
	return Number(match[1]) * 60 + Number(match[2]);
}
function maskClock(raw) {
	const digits = raw.replace(/\D/g, "").slice(0, 4);
	if (digits.length <= 2) return digits;
	return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}
function formatClock(seconds) {
	if (!Number.isFinite(seconds)) return "—:—";
	const total = Math.max(0, Math.round(seconds));
	const minutes = Math.floor(total / 60);
	const secs = total % 60;
	return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
function formatPct(value) {
	return `${value.toLocaleString("es-AR", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	})}%`;
}
function averageSeconds(calls) {
	if (!calls.length) return null;
	return calls.reduce((sum, call) => sum + call.seconds, 0) / calls.length;
}
function validateBase(base) {
	if (!Number.isInteger(base.monthCalls) || base.monthCalls < 1) return "Las llamadas del mes tienen que ser un entero mayor a 0.";
	if (!(base.prevPct >= 0 && base.prevPct <= 100)) return "El porcentaje tiene que estar entre 0 y 100.";
	if (!Number.isInteger(base.cleanNeeded) || base.cleanNeeded < 0) return "El faltante tiene que ser un entero de 0 o más.";
	if (base.prevPct === 0 && base.cleanNeeded > 0) return "Con 0% no hay derivaciones que compensar. Si el tablero marca un faltante, el porcentaje no es 0.";
	return null;
}
function parseStoredBase(input) {
	const prevPct = parsePct(input.prevDer);
	const monthCalls = parseCount(input.monthCalls);
	const cleanNeeded = parseCount(input.cleanNeeded);
	if (prevPct === null || monthCalls === null || cleanNeeded === null) return null;
	const base = {
		prevPct,
		monthCalls,
		cleanNeeded
	};
	if (validateBase(base)) return null;
	return base;
}
/**
* Non-referred calls still required so referrals/total <= goal.
* Null means the goal is 0% and there is already a referral — it cannot be walked back.
*/
function callsNeeded(referrals, total, goal) {
	if (!(total > 0) || !Number.isFinite(referrals) || !Number.isFinite(goal)) return null;
	if (goal <= 0) return referrals <= EPS ? 0 : null;
	if (goal >= 1) return 0;
	if (referrals / total <= goal + 1e-10) return 0;
	const exact = referrals / goal - total;
	return Math.max(0, Math.ceil(exact - EPS));
}
/** How many additional referrals still keep the rate at or under the goal. */
function referralSlack(referrals, total, goal) {
	if (!(total > 0) || goal <= 0 || goal >= 1) return 0;
	if (referrals / total > goal + 1e-10) return 0;
	const exact = (goal * total - referrals) / (1 - goal);
	return Math.max(0, Math.floor(exact + EPS));
}
/**
* Power BI gives the month-to-date rate P, the call volume T and how many
* clean calls N land exactly on target. That fixes the goal:
*   g = (P/100 * T) / (T + N)
* A clean call today reduces the gap by 1. A referral raises it by 1/g - 1.
* When N is 0 the cushion under the real company goal is unknown, so the
* current rate is treated as the line.
*/
function projectReferral(base, today) {
	const reason = validateBase(base);
	if (reason) return {
		ok: false,
		reason
	};
	const total = base.monthCalls;
	const referrals = base.prevPct / 100 * total;
	const goal = base.cleanNeeded === 0 ? base.prevPct / 100 : referrals / (total + base.cleanNeeded);
	const todayDerived = today.reduce((count, call) => count + (call.derived ? 1 : 0), 0);
	const todayCount = today.length;
	const liveReferrals = referrals + todayDerived;
	const liveTotal = total + todayCount;
	const cleanStill = callsNeeded(liveReferrals, liveTotal, goal);
	return {
		ok: true,
		impliedGoalPct: goal * 100,
		livePct: liveReferrals / liveTotal * 100,
		cleanStill,
		slack: cleanStill === 0 ? referralSlack(liveReferrals, liveTotal, goal) : 0,
		todayCount,
		todayDerived,
		todayClean: todayCount - todayDerived,
		todayPct: todayCount ? todayDerived / todayCount * 100 : null,
		startNeeded: base.cleanNeeded
	};
}
function localDateKey(date = /* @__PURE__ */ new Date()) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function formatDayLabel(iso) {
	const [year, month, day] = iso.split("-").map(Number);
	if (!year || !month || !day) return iso;
	return new Intl.DateTimeFormat("es-AR", {
		weekday: "short",
		day: "2-digit",
		month: "short"
	}).format(new Date(year, month - 1, day)).replace(".", "").toUpperCase();
}
var KEY = "control-callcenter-v3";
var LEGACY = "control-callcenter-v2";
var EMPTY = {
	prevTpa: "",
	prevDer: "",
	monthCalls: "",
	goalTpa: "",
	cleanNeeded: "",
	baseDay: "",
	calls: []
};
var INPUT = "w-full rounded-control border border-line bg-bg px-3 py-3 text-base text-ink tabular-nums outline-none focus:border-accent";
var PAGES = [
	"metrics",
	"history",
	"settings"
];
function isCall(value) {
	if (!value || typeof value !== "object") return false;
	const call = value;
	return typeof call.id === "string" && typeof call.seconds === "number" && Number.isFinite(call.seconds) && call.seconds >= 0 && typeof call.derived === "boolean" && typeof call.day === "string";
}
function normalize(value, today) {
	if (!value || typeof value !== "object") return EMPTY;
	const raw = value;
	const calls = Array.isArray(raw.calls) ? raw.calls.filter(isCall) : [];
	return {
		prevTpa: typeof raw.prevTpa === "string" ? raw.prevTpa : "",
		prevDer: typeof raw.prevDer === "string" ? raw.prevDer : "",
		monthCalls: typeof raw.monthCalls === "string" ? raw.monthCalls : "",
		goalTpa: typeof raw.goalTpa === "string" ? raw.goalTpa : "",
		cleanNeeded: typeof raw.cleanNeeded === "string" ? raw.cleanNeeded : "",
		baseDay: typeof raw.baseDay === "string" ? raw.baseDay : "",
		calls: calls.map((call) => ({
			...call,
			day: call.day || today
		}))
	};
}
function loadStore(today) {
	try {
		const current = localStorage.getItem(KEY);
		if (current) return normalize(JSON.parse(current), today);
		const legacy = localStorage.getItem(LEGACY);
		if (!legacy) return EMPTY;
		const old = JSON.parse(legacy);
		return normalize({
			prevTpa: old.prevTpa ?? "",
			prevDer: old.prevDer ?? "",
			goalTpa: old.goalTpa ?? "",
			calls: Array.isArray(old.calls) ? old.calls.filter((call) => typeof call.seconds === "number" && call.seconds >= 0).map((call) => ({
				id: crypto.randomUUID(),
				seconds: call.seconds,
				derived: Boolean(call.derived),
				day: today
			})) : []
		}, today);
	} catch {
		return EMPTY;
	}
}
function persist(store) {
	localStorage.setItem(KEY, JSON.stringify(store));
}
function fieldTarget(target) {
	return target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
}
function buttonTarget(target) {
	return target instanceof HTMLElement && target.tagName === "BUTTON";
}
function baseDraftError(draft) {
	if (!(draft.prevDer.trim() || draft.monthCalls.trim() || draft.cleanNeeded.trim())) return null;
	const prevPct = parsePct(draft.prevDer);
	const monthCalls = parseCount(draft.monthCalls);
	const cleanNeeded = parseCount(draft.cleanNeeded);
	if (prevPct === null) return "El porcentaje actual tiene que estar entre 0 y 100.";
	if (monthCalls === null) return "Las llamadas del mes tienen que ser un número entero.";
	if (cleanNeeded === null) return "El faltante tiene que ser un entero. Usá 0 si ya estabas en objetivo.";
	return validateBase({
		prevPct,
		monthCalls,
		cleanNeeded
	});
}
function summary(todayCount, derived, tpa, projection) {
	const calls = todayCount === 1 ? "1 llamada hoy" : `${todayCount} llamadas hoy`;
	const derivedLabel = derived === 0 ? "ninguna derivada" : derived === 1 ? "1 derivada" : `${derived} derivadas`;
	const tpaLabel = tpa === null ? null : `TPA ${formatClock(tpa)}`;
	const head = [
		todayCount ? calls : null,
		todayCount ? derivedLabel : null,
		tpaLabel
	].filter(Boolean).join(" · ");
	if (!projection) {
		if (!todayCount) return "Todavía no hay llamadas hoy. La base de derivaciones se carga en Configuración.";
		return `${head}. Falta la base del tablero para calcular el objetivo.`;
	}
	if (projection.cleanStill === null) return `${head || "Sin llamadas hoy"}. Con el límite en 0% esa derivación no se puede compensar.`;
	if (!todayCount && projection.cleanStill > 0) return projection.cleanStill === 1 ? "Todavía no hay llamadas hoy. Te falta 1 sin derivar para entrar en objetivo." : `Todavía no hay llamadas hoy. Te faltan ${projection.cleanStill} sin derivar para entrar en objetivo.`;
	if (!todayCount && projection.cleanStill === 0) return "Todavía no hay llamadas hoy. Arrancás en objetivo.";
	if (projection.cleanStill > 0) return `${head}. ${projection.cleanStill === 1 ? "Te falta 1 sin derivar." : `Te faltan ${projection.cleanStill} sin derivar.`}`;
	if (projection.slack > 0) return `${head}. En objetivo, con ${projection.slack === 1 ? "margen de 1 derivación" : `margen de ${projection.slack} derivaciones`}.`;
	return `${head}. En objetivo, justo en el límite.`;
}
function ControlApp() {
	const [page, setPage] = (0, import_react.useState)("metrics");
	const [store, setStore] = (0, import_react.useState)(EMPTY);
	const [draft, setDraft] = (0, import_react.useState)(EMPTY);
	const [ready, setReady] = (0, import_react.useState)(false);
	const [today, setToday] = (0, import_react.useState)("");
	const [dateLabel, setDateLabel] = (0, import_react.useState)("");
	const [modal, setModal] = (0, import_react.useState)(false);
	const [duration, setDuration] = (0, import_react.useState)("");
	const [derived, setDerived] = (0, import_react.useState)(false);
	const [toast, setToast] = (0, import_react.useState)("");
	const [saved, setSaved] = (0, import_react.useState)(false);
	const durationRef = (0, import_react.useRef)(null);
	const ui = (0, import_react.useRef)({
		page,
		modal,
		open: () => {},
		close: () => {},
		add: () => {},
		toggle: () => {},
		setPage
	});
	(0, import_react.useEffect)(() => {
		const key = localDateKey();
		const loaded = loadStore(key);
		setToday(key);
		setDateLabel(formatDayLabel(key));
		setStore(loaded);
		setDraft({
			prevTpa: loaded.prevTpa,
			prevDer: loaded.prevDer,
			monthCalls: loaded.monthCalls,
			goalTpa: loaded.goalTpa,
			cleanNeeded: loaded.cleanNeeded
		});
		setReady(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!toast) return;
		const timer = window.setTimeout(() => setToast(""), 1700);
		return () => window.clearTimeout(timer);
	}, [toast]);
	(0, import_react.useEffect)(() => {
		if (!modal) return;
		const timer = window.setTimeout(() => durationRef.current?.focus(), 30);
		return () => window.clearTimeout(timer);
	}, [modal]);
	const todayCalls = (0, import_react.useMemo)(() => ready ? store.calls.filter((call) => call.day === today) : [], [
		ready,
		store.calls,
		today
	]);
	const base = (0, import_react.useMemo)(() => ready ? parseStoredBase(store) : null, [ready, store]);
	const projection = (0, import_react.useMemo)(() => {
		if (!base) return null;
		const result = projectReferral(base, todayCalls);
		return result.ok ? result : null;
	}, [base, todayCalls]);
	const tpa = averageSeconds(todayCalls);
	const goalTpa = parseClock(store.goalTpa);
	const prevTpa = parseClock(store.prevTpa);
	const stale = Boolean(base && today && store.baseDay !== today);
	const draftBase = parseStoredBase(draft);
	const draftView = draftBase ? projectReferral(draftBase, []) : null;
	const preview = draftView?.ok ? draftView : null;
	const draftError = baseDraftError(draft);
	const showToast = (message) => setToast(message);
	const commit = (next) => {
		setStore(next);
		persist(next);
	};
	const openModal = () => {
		setDerived(false);
		setDuration("");
		setModal(true);
	};
	const closeModal = () => setModal(false);
	const toggleDerived = () => setDerived((value) => !value);
	const addCall = () => {
		const seconds = parseClock(duration);
		if (seconds === null) {
			showToast("Ingresá cuatro dígitos, por ejemplo 0432.");
			durationRef.current?.focus();
			return;
		}
		const call = {
			id: crypto.randomUUID(),
			seconds,
			derived,
			day: today || localDateKey()
		};
		commit({
			...store,
			calls: [...store.calls, call]
		});
		closeModal();
		showToast("Llamada agregada.");
	};
	const removeCall = (id) => {
		commit({
			...store,
			calls: store.calls.filter((call) => call.id !== id)
		});
		showToast("Llamada quitada.");
	};
	const toggleCall = (id) => {
		commit({
			...store,
			calls: store.calls.map((call) => call.id === id ? {
				...call,
				derived: !call.derived
			} : call)
		});
	};
	ui.current = {
		page,
		modal,
		open: openModal,
		close: closeModal,
		add: addCall,
		toggle: toggleDerived,
		setPage
	};
	(0, import_react.useEffect)(() => {
		const onKey = (event) => {
			const snap = ui.current;
			if (snap.modal) {
				if (event.key === "Escape") {
					event.preventDefault();
					snap.close();
				} else if (event.key === "Enter") {
					event.preventDefault();
					snap.add();
				} else if (event.key.toLowerCase() === "d") {
					event.preventDefault();
					snap.toggle();
				}
				return;
			}
			if (fieldTarget(event.target)) return;
			if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
				event.preventDefault();
				const index = PAGES.indexOf(snap.page);
				const next = event.key === "ArrowRight" ? (index + 1) % PAGES.length : (index + PAGES.length - 1) % PAGES.length;
				snap.setPage(PAGES[next]);
				return;
			}
			if (event.code === "Space" && !buttonTarget(event.target)) {
				event.preventDefault();
				snap.open();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, []);
	const saveSettings = () => {
		const prev = draft.prevTpa.trim();
		const goal = draft.goalTpa.trim();
		if (prev && parseClock(prev) === null || goal && parseClock(goal) === null) {
			showToast("Revisá el formato de TPA: MM:SS.");
			return;
		}
		const problem = baseDraftError(draft);
		if (problem) {
			showToast(problem);
			return;
		}
		const nextBase = parseStoredBase(draft);
		commit({
			...store,
			prevTpa: prev,
			goalTpa: goal,
			prevDer: draft.prevDer.trim(),
			monthCalls: draft.monthCalls.trim(),
			cleanNeeded: draft.cleanNeeded.trim(),
			baseDay: nextBase ? today || localDateKey() : ""
		});
		setSaved(true);
		window.setTimeout(() => setSaved(false), 1800);
	};
	const pastDays = [...new Set(store.calls.filter((call) => call.day !== today).map((call) => call.day))].sort().reverse();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto min-h-screen w-full max-w-3xl px-4 pt-8 pb-28 sm:px-6 sm:pt-10",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "mb-8 flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-w-0 items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid size-9 shrink-0 place-items-center rounded-control border border-accent font-serif text-lg text-accent",
						children: "C"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-serif text-sm font-semibold tracking-widest uppercase",
							children: "Control"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-micro tracking-widest text-muted uppercase",
							children: "Call center · personal"
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-micro tracking-wide text-muted uppercase",
						children: dateLabel
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "grid size-11 place-items-center rounded-control border border-line text-accent",
						"aria-label": "Registrar llamada",
						onClick: openModal,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {
							className: "size-5",
							strokeWidth: 1.7
						})
					})]
				})]
			}),
			page === "metrics" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rise",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-micro font-semibold tracking-widest text-accent uppercase",
						children: "Panel de rendimiento"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-2 font-serif text-3xl font-normal tracking-tight",
						children: "Métricas de hoy"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 mb-6 text-sm text-muted",
						children: "El TPA es de hoy. Las derivaciones siguen el acumulado del mes."
					}),
					stale ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mb-5 border-l-2 border-accent px-3 py-2 text-xs leading-relaxed text-muted",
						children: "La base del tablero no es de hoy. Actualizala en Configuración antes de fiarte del faltante."
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
							label: "Tiempo promedio",
							state: tpaState(tpa, goalTpa),
							value: tpa === null ? "—:—" : formatClock(tpa),
							tone: tpaTone(tpa, goalTpa),
							detail: goalTpa === null ? "Sin objetivo cargado" : `Objetivo del día ${formatClock(goalTpa)}${prevTpa === null ? "" : ` · antes ${formatClock(prevTpa)}`}`
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MetricCard, {
							label: "Derivaciones",
							state: referralState(projection),
							value: referralValue(projection),
							tone: referralTone(projection),
							detail: referralDetail(projection),
							caption: referralCaption(projection)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-5 text-xs leading-relaxed text-muted",
						children: summary(todayCalls.length, todayCalls.filter((call) => call.derived).length, tpa, projection)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "mt-5 w-full rounded-control bg-accent px-4 py-3 text-xs font-bold tracking-widest text-on-accent uppercase",
						onClick: openModal,
						children: "Registrar llamada"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex items-start gap-3 rounded-control border border-line px-4 py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "shrink-0 rounded border border-soft/50 border-b-2 px-2 py-1 text-micro text-soft",
							children: "ESPACIO"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs leading-relaxed text-muted",
							children: [
								"Cuatro dígitos de duración, ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
									className: "font-semibold text-soft",
									children: "D"
								}),
								" si fue derivada,",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
									className: "font-semibold text-soft",
									children: "Enter"
								}),
								" guarda. Las flechas cambian de pestaña."
							]
						})]
					})
				]
			}, "metrics") : null,
			page === "history" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rise",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-micro font-semibold tracking-widest text-accent uppercase",
						children: "Actividad de la jornada"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 mb-5 flex items-end justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-serif text-3xl font-normal tracking-tight",
							children: "Historial"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-sm text-muted",
							children: "Tocá el resultado para corregir una derivación."
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-serif text-2xl text-accent tabular-nums",
							children: String(todayCalls.length).padStart(2, "0")
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CallList, {
						calls: todayCalls,
						onToggle: toggleCall,
						onRemove: removeCall,
						empty: "Todavía no hay llamadas hoy."
					}),
					pastDays.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-8",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "mb-3 text-micro font-semibold tracking-widest text-muted uppercase",
								children: "Días anteriores"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-4 text-xs text-muted",
								children: "No entran en la métrica de hoy. Mañana van a quedar cubiertos por el tablero."
							}),
							pastDays.map((day) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mb-2 text-xs text-soft",
									children: formatDayLabel(day)
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CallList, {
									calls: store.calls.filter((call) => call.day === day),
									onToggle: toggleCall,
									onRemove: removeCall,
									empty: ""
								})]
							}, day))
						]
					}) : null
				]
			}, "history") : null,
			page === "settings" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rise",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-micro font-semibold tracking-widest text-accent uppercase",
						children: "Preferencias"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-2 font-serif text-3xl font-normal tracking-tight",
						children: "Configuración"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 mb-6 text-sm text-muted",
						children: "Los números del tablero, no un porcentaje objetivo escrito a mano."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-4 rounded-card border border-line bg-panel p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-serif text-xl",
								children: "Tiempo promedio"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 mb-4 text-xs text-muted",
								children: "El acumulado queda de referencia. El objetivo pinta de verde o rojo el TPA de hoy."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-4 sm:grid-cols-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "TPA acumulado",
									hint: "Hasta ayer",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										inputMode: "numeric",
										autoComplete: "off",
										placeholder: "05:12",
										maxLength: 5,
										value: draft.prevTpa,
										className: INPUT,
										onChange: (event) => setDraft({
											...draft,
											prevTpa: maskClock(event.target.value)
										})
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "TPA objetivo",
									hint: "Tope del día",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										inputMode: "numeric",
										autoComplete: "off",
										placeholder: "05:00",
										maxLength: 5,
										value: draft.goalTpa,
										className: INPUT,
										onChange: (event) => setDraft({
											...draft,
											goalTpa: maskClock(event.target.value)
										})
									})
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-card border border-line bg-panel p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-serif text-xl",
								children: "Derivaciones"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 mb-4 text-xs text-muted",
								children: "Lo que ves en el tablero al empezar: porcentaje, volumen y cuántas llamadas sin derivar te faltan."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-4 sm:grid-cols-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Porcentaje actual",
										hint: "Acumulado hasta ayer",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											inputMode: "decimal",
											autoComplete: "off",
											placeholder: "15,41",
											value: draft.prevDer,
											className: INPUT,
											onChange: (event) => setDraft({
												...draft,
												prevDer: event.target.value.replace(/[^\d.,]/g, "").slice(0, 6)
											})
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Llamadas del mes",
										hint: "Total de ese porcentaje",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											inputMode: "numeric",
											autoComplete: "off",
											placeholder: "980",
											value: draft.monthCalls,
											className: INPUT,
											onChange: (event) => setDraft({
												...draft,
												monthCalls: event.target.value.replace(/\D/g, "").slice(0, 7)
											})
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "sm:col-span-2",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
											label: "Sin derivar para el objetivo",
											hint: "«Debes hacer N llamadas sin derivar»",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												inputMode: "numeric",
												autoComplete: "off",
												placeholder: "32",
												value: draft.cleanNeeded,
												className: INPUT,
												onChange: (event) => setDraft({
													...draft,
													cleanNeeded: event.target.value.replace(/\D/g, "").slice(0, 5)
												})
											})
										})
									})
								]
							}),
							preview ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 border-l-2 border-accent px-3 py-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-micro tracking-widest text-muted uppercase",
										children: "Objetivo implícito"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-1 font-serif text-2xl text-accent",
										children: formatPct(preview.impliedGoalPct)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 text-xs leading-relaxed text-muted",
										children: preview.startNeeded === 0 ? "El faltante es 0, así que el límite queda en tu porcentaje actual. La primera derivación vuelve a abrir la cuenta." : `Arrancás debiendo ${preview.startNeeded} ${preview.startNeeded === 1 ? "llamada" : "llamadas"} sin derivar. Si este porcentaje no se parece al de la empresa, el total de llamadas no es el del acumulado.`
									})
								]
							}) : draftError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-4 text-xs text-bad",
								children: draftError
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-5 flex items-center",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "rounded-control bg-accent px-4 py-3 text-xs font-bold tracking-widest text-on-accent uppercase",
									onClick: saveSettings,
									children: "Guardar configuración"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `ml-3 text-xs text-good transition-opacity ${saved ? "opacity-100" : "opacity-0"}`,
									children: "Guardado"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-4 border-l-2 border-accent px-3 py-2 text-xs leading-relaxed text-muted",
								children: "Copiá estos datos cada mañana. Una llamada sin derivar resta 1; una derivación recalcula el faltante. Mañana esas llamadas dejan de contarse acá, porque pasan al acumulado nuevo del tablero. El TPA de Métricas sigue siendo solo el de hoy."
							})
						]
					})
				]
			}, "settings") : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur-md",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "dock mx-auto grid w-full max-w-3xl grid-cols-3 px-3 pt-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavButton, {
							active: page === "metrics",
							label: "Métricas",
							onClick: () => setPage("metrics"),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, {
								className: "size-5",
								strokeWidth: 1.7
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavButton, {
							active: page === "history",
							label: "Historial",
							onClick: () => setPage("history"),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, {
								className: "size-5",
								strokeWidth: 1.7
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavButton, {
							active: page === "settings",
							label: "Configuración",
							onClick: () => setPage("settings"),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, {
								className: "size-5",
								strokeWidth: 1.7
							})
						})
					]
				})
			}),
			modal ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-30 flex items-center justify-center bg-scrim/80 p-5",
				onClick: closeModal,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					role: "dialog",
					"aria-modal": "true",
					"aria-labelledby": "new-call-title",
					className: "w-full max-w-sm rounded-card border border-line bg-elevated p-6 shadow-modal",
					onClick: (event) => event.stopPropagation(),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-2 flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								id: "new-call-title",
								className: "font-serif text-2xl",
								children: "Nueva llamada"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "grid size-11 place-items-center text-muted",
								"aria-label": "Cerrar",
								onClick: closeModal,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mb-4 text-xs text-muted",
							children: "Minutos y segundos. Cuatro dígitos."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							ref: durationRef,
							className: "w-full rounded-control border border-line bg-bg px-4 py-4 text-center font-serif text-4xl tracking-widest text-ink outline-none focus:border-accent",
							inputMode: "numeric",
							autoComplete: "off",
							placeholder: "00:00",
							maxLength: 5,
							value: duration,
							"aria-label": "Duración",
							onChange: (event) => setDuration(maskClock(event.target.value))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex items-center justify-between gap-3 text-sm text-soft",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "¿Fue derivada?" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: `min-h-11 rounded-control border px-4 text-micro font-semibold tracking-widest ${derived ? "border-accent bg-accent/10 text-accent" : "border-line bg-bg text-muted"}`,
								onClick: toggleDerived,
								children: derived ? "D · SÍ" : "D · NO"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "mt-4 w-full rounded-control bg-accent px-4 py-3 text-xs font-bold tracking-widest text-on-accent uppercase",
							onClick: addCall,
							children: "Agregar al historial · Enter"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-center text-micro text-muted",
							children: "D alterna derivación · Enter confirma · Esc cancela"
						})
					]
				})
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-control border border-line bg-elevated px-4 py-2 text-xs text-soft transition-opacity ${toast ? "opacity-100" : "pointer-events-none opacity-0"}`,
				role: "status",
				children: toast
			})
		]
	});
}
function tpaState(value, goal) {
	if (value === null) return "Sin datos";
	if (goal === null) return "Sin objetivo";
	return value <= goal ? "En objetivo" : "Fuera de objetivo";
}
function tpaTone(value, goal) {
	if (value === null || goal === null) return "idle";
	return value <= goal ? "good" : "bad";
}
function referralState(projection) {
	if (!projection) return "Sin base";
	if (projection.cleanStill === null) return "Sin retorno";
	return projection.cleanStill === 0 ? "En objetivo" : "Fuera de objetivo";
}
function referralValue(projection) {
	if (!projection || projection.cleanStill === null) return "—";
	return String(projection.cleanStill);
}
function referralTone(projection) {
	if (!projection || projection.cleanStill === null) return projection ? "bad" : "idle";
	return projection.cleanStill === 0 ? "good" : "bad";
}
function referralDetail(projection) {
	if (!projection) return "Cargá la base del tablero";
	if (projection.cleanStill === null) return "No se puede volver a 0%";
	if (projection.cleanStill === 0) return "llamadas sin derivar · ya entraste";
	return projection.cleanStill === 1 ? "llamada sin derivar todavía" : "llamadas sin derivar todavía";
}
function referralCaption(projection) {
	if (!projection) return "Porcentaje, volumen y faltante de ayer.";
	const live = `Acumulado ${formatPct(projection.livePct)} · objetivo ${formatPct(projection.impliedGoalPct)}`;
	if (projection.cleanStill === 0 && projection.slack > 0) return `${live} · margen ${projection.slack}`;
	return live;
}
function MetricCard({ label, state, value, tone, detail, caption }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "relative min-h-44 overflow-hidden rounded-card border border-line bg-panel p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pointer-events-none absolute -top-10 -right-10 size-28 rounded-full border border-ink/10" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-micro font-semibold tracking-widest text-muted uppercase",
					children: label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: `rounded px-2 py-1 text-micro font-bold tracking-wide uppercase ${tone === "good" ? "bg-good/15 text-good" : tone === "bad" ? "bg-bad/15 text-bad" : "bg-ink/8 text-muted"}`,
					children: state
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `mt-6 font-serif text-hero tabular-nums ${tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-ink"}`,
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-xs text-muted",
				children: detail
			}),
			caption ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-soft",
				children: caption
			}) : null
		]
	});
}
function Field({ label, hint, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mb-2 block text-micro font-semibold tracking-widest text-muted uppercase",
				children: label
			}),
			children,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-1 block text-micro text-muted",
				children: hint
			})
		]
	});
}
function NavButton({ active, label, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		className: `flex min-h-11 flex-col items-center justify-center gap-1 px-1 py-1 text-micro tracking-wide uppercase ${active ? "text-accent" : "text-muted"}`,
		"aria-current": active ? "page" : void 0,
		onClick,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label })]
	});
}
function CallList({ calls, onToggle, onRemove, empty }) {
	if (!calls.length) return empty ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "rounded-card border border-line bg-panel px-5 py-10 text-center text-xs leading-relaxed text-muted",
		children: empty
	}) : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "overflow-hidden rounded-card border border-line bg-panel",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2 px-3 py-3 text-micro font-semibold tracking-widest text-muted uppercase",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "w-8",
					children: "#"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "flex-1",
					children: "Duración"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "w-24 text-right",
					children: "Resultado"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-11" })
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: calls.map((call, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "flex items-center gap-2 border-t border-line px-3 py-1",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "w-8 text-sm text-muted tabular-nums",
					children: String(index + 1).padStart(2, "0")
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "flex-1 font-serif text-xl tabular-nums",
					children: formatClock(call.seconds)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: `min-h-11 w-24 px-1 text-right text-micro font-semibold tracking-wide uppercase ${call.derived ? "text-accent" : "text-soft"}`,
					onClick: () => onToggle(call.id),
					children: call.derived ? "Derivada" : "Normal"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "grid size-11 place-items-center text-muted",
					"aria-label": "Quitar llamada",
					onClick: () => onRemove(call.id),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
				})
			]
		}, call.id)) })]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ControlApp, {});
}
//#endregion
export { Home as component };
