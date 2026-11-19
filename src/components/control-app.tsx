import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Activity, List, Plus, Settings, Trash2, X } from "lucide-react";
import {
  averageSeconds,
  formatClock,
  formatDayLabel,
  formatPct,
  localDateKey,
  maskClock,
  parseClock,
  parseStoredBase,
  projectReferral,
  validateBase,
  parsePct,
  parseCount,
  type CallRecord,
  type ReferralProjection,
} from "@/lib/metrics";

type Page = "metrics" | "history" | "settings";

type Store = {
  prevTpa: string;
  prevDer: string;
  monthCalls: string;
  goalTpa: string;
  cleanNeeded: string;
  baseDay: string;
  calls: CallRecord[];
};

type Draft = Pick<Store, "prevTpa" | "prevDer" | "monthCalls" | "goalTpa" | "cleanNeeded">;

const KEY = "control-callcenter-v3";
const LEGACY = "control-callcenter-v2";

const EMPTY: Store = {
  prevTpa: "",
  prevDer: "",
  monthCalls: "",
  goalTpa: "",
  cleanNeeded: "",
  baseDay: "",
  calls: [],
};

const INPUT =
  "w-full rounded-control border border-line bg-bg px-3 py-3 text-base text-ink tabular-nums outline-none focus:border-accent";

const PAGES: Page[] = ["metrics", "history", "settings"];

function isCall(value: unknown): value is CallRecord {
  if (!value || typeof value !== "object") return false;
  const call = value as CallRecord;
  return (
    typeof call.id === "string" &&
    typeof call.seconds === "number" &&
    Number.isFinite(call.seconds) &&
    call.seconds >= 0 &&
    typeof call.derived === "boolean" &&
    typeof call.day === "string"
  );
}

function normalize(value: unknown, today: string): Store {
  if (!value || typeof value !== "object") return EMPTY;
  const raw = value as Partial<Store> & { calls?: unknown };
  const calls = Array.isArray(raw.calls) ? raw.calls.filter(isCall) : [];
  return {
    prevTpa: typeof raw.prevTpa === "string" ? raw.prevTpa : "",
    prevDer: typeof raw.prevDer === "string" ? raw.prevDer : "",
    monthCalls: typeof raw.monthCalls === "string" ? raw.monthCalls : "",
    goalTpa: typeof raw.goalTpa === "string" ? raw.goalTpa : "",
    cleanNeeded: typeof raw.cleanNeeded === "string" ? raw.cleanNeeded : "",
    baseDay: typeof raw.baseDay === "string" ? raw.baseDay : "",
    calls: calls.map((call) => ({ ...call, day: call.day || today })),
  };
}

function loadStore(today: string): Store {
  try {
    const current = localStorage.getItem(KEY);
    if (current) return normalize(JSON.parse(current), today);
    const legacy = localStorage.getItem(LEGACY);
    if (!legacy) return EMPTY;
    const old = JSON.parse(legacy) as {
      prevTpa?: string;
      prevDer?: string;
      goalTpa?: string;
      calls?: { seconds?: number; derived?: boolean }[];
    };
    return normalize(
      {
        prevTpa: old.prevTpa ?? "",
        prevDer: old.prevDer ?? "",
        goalTpa: old.goalTpa ?? "",
        calls: Array.isArray(old.calls)
          ? old.calls
              .filter((call) => typeof call.seconds === "number" && call.seconds >= 0)
              .map((call) => ({
                id: crypto.randomUUID(),
                seconds: call.seconds,
                derived: Boolean(call.derived),
                day: today,
              }))
          : [],
      },
      today,
    );
  } catch {
    return EMPTY;
  }
}

function persist(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

function fieldTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
  );
}

function buttonTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && target.tagName === "BUTTON";
}

function baseDraftError(draft: Draft): string | null {
  const any = draft.prevDer.trim() || draft.monthCalls.trim() || draft.cleanNeeded.trim();
  if (!any) return null;
  const prevPct = parsePct(draft.prevDer);
  const monthCalls = parseCount(draft.monthCalls);
  const cleanNeeded = parseCount(draft.cleanNeeded);
  if (prevPct === null) return "El porcentaje actual tiene que estar entre 0 y 100.";
  if (monthCalls === null) return "Las llamadas del mes tienen que ser un número entero.";
  if (cleanNeeded === null) return "El faltante tiene que ser un entero. Usá 0 si ya estabas en objetivo.";
  return validateBase({ prevPct, monthCalls, cleanNeeded });
}

function summary(todayCount: number, derived: number, tpa: number | null, projection: ReferralProjection | null) {
  const calls = todayCount === 1 ? "1 llamada hoy" : `${todayCount} llamadas hoy`;
  const derivedLabel = derived === 0 ? "ninguna derivada" : derived === 1 ? "1 derivada" : `${derived} derivadas`;
  const tpaLabel = tpa === null ? null : `TPA ${formatClock(tpa)}`;
  const head = [todayCount ? calls : null, todayCount ? derivedLabel : null, tpaLabel].filter(Boolean).join(" · ");

  if (!projection) {
    if (!todayCount) return "Todavía no hay llamadas hoy. La base de derivaciones se carga en Configuración.";
    return `${head}. Falta la base del tablero para calcular el objetivo.`;
  }
  if (projection.cleanStill === null) {
    return `${head || "Sin llamadas hoy"}. Con el límite en 0% esa derivación no se puede compensar.`;
  }
  if (!todayCount && projection.cleanStill > 0) {
    return projection.cleanStill === 1
      ? "Todavía no hay llamadas hoy. Te falta 1 sin derivar para entrar en objetivo."
      : `Todavía no hay llamadas hoy. Te faltan ${projection.cleanStill} sin derivar para entrar en objetivo.`;
  }
  if (!todayCount && projection.cleanStill === 0) return "Todavía no hay llamadas hoy. Arrancás en objetivo.";
  if (projection.cleanStill > 0) {
    const gap = projection.cleanStill === 1 ? "Te falta 1 sin derivar." : `Te faltan ${projection.cleanStill} sin derivar.`;
    return `${head}. ${gap}`;
  }
  if (projection.slack > 0) {
    const room = projection.slack === 1 ? "margen de 1 derivación" : `margen de ${projection.slack} derivaciones`;
    return `${head}. En objetivo, con ${room}.`;
  }
  return `${head}. En objetivo, justo en el límite.`;
}

export function ControlApp() {
  const [page, setPage] = useState<Page>("metrics");
  const [store, setStore] = useState<Store>(EMPTY);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [modal, setModal] = useState(false);
  const [duration, setDuration] = useState("");
  const [derived, setDerived] = useState(false);
  const [toast, setToast] = useState("");
  const [saved, setSaved] = useState(false);
  const durationRef = useRef<HTMLInputElement>(null);
  const ui = useRef({
    page,
    modal,
    open: () => {},
    close: () => {},
    add: () => {},
    toggle: () => {},
    setPage,
  });

  useEffect(() => {
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
      cleanNeeded: loaded.cleanNeeded,
    });
    setReady(true);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 1700);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!modal) return;
    const timer = window.setTimeout(() => durationRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [modal]);

  const todayCalls = useMemo(
    () => (ready ? store.calls.filter((call) => call.day === today) : []),
    [ready, store.calls, today],
  );
  const base = useMemo(() => (ready ? parseStoredBase(store) : null), [ready, store]);
  const projection = useMemo(() => {
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
  const showToast = (message: string) => setToast(message);

  const commit = (next: Store) => {
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
    const call: CallRecord = { id: crypto.randomUUID(), seconds, derived, day: today || localDateKey() };
    commit({ ...store, calls: [...store.calls, call] });
    closeModal();
    showToast("Llamada agregada.");
  };

  const removeCall = (id: string) => {
    commit({ ...store, calls: store.calls.filter((call) => call.id !== id) });
    showToast("Llamada quitada.");
  };

  const toggleCall = (id: string) => {
    commit({
      ...store,
      calls: store.calls.map((call) => (call.id === id ? { ...call, derived: !call.derived } : call)),
    });
  };

  ui.current = { page, modal, open: openModal, close: closeModal, add: addCall, toggle: toggleDerived, setPage };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
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
    if ((prev && parseClock(prev) === null) || (goal && parseClock(goal) === null)) {
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
      baseDay: nextBase ? today || localDateKey() : "",
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const pastDays = [...new Set(store.calls.filter((call) => call.day !== today).map((call) => call.day))].sort().reverse();

  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-4 pt-8 pb-28 sm:px-6 sm:pt-10">
      <header className="mb-8 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-control border border-accent font-serif text-lg text-accent">
            C
          </div>
          <div className="min-w-0">
            <div className="font-serif text-sm font-semibold tracking-widest uppercase">Control</div>
            <div className="text-micro tracking-widest text-muted uppercase">Call center · personal</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-micro tracking-wide text-muted uppercase">{dateLabel}</div>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-control border border-line text-accent"
            aria-label="Registrar llamada"
            onClick={openModal}
          >
            <Plus className="size-5" strokeWidth={1.7} />
          </button>
        </div>
      </header>

      {page === "metrics" ? (
        <section className="rise" key="metrics">
          <p className="text-micro font-semibold tracking-widest text-accent uppercase">Panel de rendimiento</p>
          <h1 className="mt-2 font-serif text-3xl font-normal tracking-tight">Métricas de hoy</h1>
          <p className="mt-2 mb-6 text-sm text-muted">El TPA es de hoy. Las derivaciones siguen el acumulado del mes.</p>
          {stale ? (
            <div className="mb-5 border-l-2 border-accent px-3 py-2 text-xs leading-relaxed text-muted">
              La base del tablero no es de hoy. Actualizala en Configuración antes de fiarte del faltante.
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              label="Tiempo promedio"
              state={tpaState(tpa, goalTpa)}
              value={tpa === null ? "—:—" : formatClock(tpa)}
              tone={tpaTone(tpa, goalTpa)}
              detail={
                goalTpa === null
                  ? "Sin objetivo cargado"
                  : `Objetivo del día ${formatClock(goalTpa)}${prevTpa === null ? "" : ` · antes ${formatClock(prevTpa)}`}`
              }
            />
            <MetricCard
              label="Derivaciones"
              state={referralState(projection)}
              value={referralValue(projection)}
              tone={referralTone(projection)}
              detail={referralDetail(projection)}
              caption={referralCaption(projection)}
            />
          </div>
          <p className="mt-5 text-xs leading-relaxed text-muted">{summary(todayCalls.length, todayCalls.filter((call) => call.derived).length, tpa, projection)}</p>
          <button
            type="button"
            className="mt-5 w-full rounded-control bg-accent px-4 py-3 text-xs font-bold tracking-widest text-on-accent uppercase"
            onClick={openModal}
          >
            Registrar llamada
          </button>
          <div className="mt-4 flex items-start gap-3 rounded-control border border-line px-4 py-3">
            <span className="shrink-0 rounded border border-soft/50 border-b-2 px-2 py-1 text-micro text-soft">ESPACIO</span>
            <p className="text-xs leading-relaxed text-muted">
              Cuatro dígitos de duración, <b className="font-semibold text-soft">D</b> si fue derivada,{" "}
              <b className="font-semibold text-soft">Enter</b> guarda. Las flechas cambian de pestaña.
            </p>
          </div>
        </section>
      ) : null}

      {page === "history" ? (
        <section className="rise" key="history">
          <p className="text-micro font-semibold tracking-widest text-accent uppercase">Actividad de la jornada</p>
          <div className="mt-2 mb-5 flex items-end justify-between gap-3">
            <div>
              <h1 className="font-serif text-3xl font-normal tracking-tight">Historial</h1>
              <p className="mt-2 text-sm text-muted">Tocá el resultado para corregir una derivación.</p>
            </div>
            <div className="font-serif text-2xl text-accent tabular-nums">{String(todayCalls.length).padStart(2, "0")}</div>
          </div>
          <CallList calls={todayCalls} onToggle={toggleCall} onRemove={removeCall} empty="Todavía no hay llamadas hoy." />
          {pastDays.length ? (
            <div className="mt-8">
              <h2 className="mb-3 text-micro font-semibold tracking-widest text-muted uppercase">Días anteriores</h2>
              <p className="mb-4 text-xs text-muted">No entran en la métrica de hoy. Mañana van a quedar cubiertos por el tablero.</p>
              {pastDays.map((day) => (
                <div key={day} className="mb-4">
                  <div className="mb-2 text-xs text-soft">{formatDayLabel(day)}</div>
                  <CallList
                    calls={store.calls.filter((call) => call.day === day)}
                    onToggle={toggleCall}
                    onRemove={removeCall}
                    empty=""
                  />
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {page === "settings" ? (
        <section className="rise" key="settings">
          <p className="text-micro font-semibold tracking-widest text-accent uppercase">Preferencias</p>
          <h1 className="mt-2 font-serif text-3xl font-normal tracking-tight">Configuración</h1>
          <p className="mt-2 mb-6 text-sm text-muted">Los números del tablero, no un porcentaje objetivo escrito a mano.</p>

          <div className="mb-4 rounded-card border border-line bg-panel p-5">
            <h2 className="font-serif text-xl">Tiempo promedio</h2>
            <p className="mt-1 mb-4 text-xs text-muted">El acumulado queda de referencia. El objetivo pinta de verde o rojo el TPA de hoy.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="TPA acumulado" hint="Hasta ayer">
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="05:12"
                  maxLength={5}
                  value={draft.prevTpa}
                  className={INPUT}
                  onChange={(event) => setDraft({ ...draft, prevTpa: maskClock(event.target.value) })}
                />
              </Field>
              <Field label="TPA objetivo" hint="Tope del día">
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="05:00"
                  maxLength={5}
                  value={draft.goalTpa}
                  className={INPUT}
                  onChange={(event) => setDraft({ ...draft, goalTpa: maskClock(event.target.value) })}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-card border border-line bg-panel p-5">
            <h2 className="font-serif text-xl">Derivaciones</h2>
            <p className="mt-1 mb-4 text-xs text-muted">Lo que ves en el tablero al empezar: porcentaje, volumen y cuántas llamadas sin derivar te faltan.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Porcentaje actual" hint="Acumulado hasta ayer">
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="15,41"
                  value={draft.prevDer}
                  className={INPUT}
                  onChange={(event) => setDraft({ ...draft, prevDer: event.target.value.replace(/[^\d.,]/g, "").slice(0, 6) })}
                />
              </Field>
              <Field label="Llamadas del mes" hint="Total de ese porcentaje">
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="980"
                  value={draft.monthCalls}
                  className={INPUT}
                  onChange={(event) => setDraft({ ...draft, monthCalls: event.target.value.replace(/\D/g, "").slice(0, 7) })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Sin derivar para el objetivo" hint="«Debes hacer N llamadas sin derivar»">
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="32"
                    value={draft.cleanNeeded}
                    className={INPUT}
                    onChange={(event) => setDraft({ ...draft, cleanNeeded: event.target.value.replace(/\D/g, "").slice(0, 5) })}
                  />
                </Field>
              </div>
            </div>
            {preview ? (
              <div className="mt-4 border-l-2 border-accent px-3 py-2">
                <div className="text-micro tracking-widest text-muted uppercase">Objetivo implícito</div>
                <div className="mt-1 font-serif text-2xl text-accent">{formatPct(preview.impliedGoalPct)}</div>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {preview.startNeeded === 0
                    ? "El faltante es 0, así que el límite queda en tu porcentaje actual. La primera derivación vuelve a abrir la cuenta."
                    : `Arrancás debiendo ${preview.startNeeded} ${preview.startNeeded === 1 ? "llamada" : "llamadas"} sin derivar. Si este porcentaje no se parece al de la empresa, el total de llamadas no es el del acumulado.`}
                </p>
              </div>
            ) : draftError ? (
              <p className="mt-4 text-xs text-bad">{draftError}</p>
            ) : null}
            <div className="mt-5 flex items-center">
              <button
                type="button"
                className="rounded-control bg-accent px-4 py-3 text-xs font-bold tracking-widest text-on-accent uppercase"
                onClick={saveSettings}
              >
                Guardar configuración
              </button>
              <span className={`ml-3 text-xs text-good transition-opacity ${saved ? "opacity-100" : "opacity-0"}`}>Guardado</span>
            </div>
            <p className="mt-4 border-l-2 border-accent px-3 py-2 text-xs leading-relaxed text-muted">
              Copiá estos datos cada mañana. Una llamada sin derivar resta 1; una derivación recalcula el faltante. Mañana esas llamadas dejan de contarse acá, porque pasan al acumulado nuevo del tablero. El TPA de Métricas sigue siendo solo el de hoy.
            </p>
          </div>
        </section>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur-md">
        <div className="dock mx-auto grid w-full max-w-3xl grid-cols-3 px-3 pt-2">
          <NavButton active={page === "metrics"} label="Métricas" onClick={() => setPage("metrics")}>
            <Activity className="size-5" strokeWidth={1.7} />
          </NavButton>
          <NavButton active={page === "history"} label="Historial" onClick={() => setPage("history")}>
            <List className="size-5" strokeWidth={1.7} />
          </NavButton>
          <NavButton active={page === "settings"} label="Configuración" onClick={() => setPage("settings")}>
            <Settings className="size-5" strokeWidth={1.7} />
          </NavButton>
        </div>
      </nav>

      {modal ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-scrim/80 p-5" onClick={closeModal}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-call-title"
            className="w-full max-w-sm rounded-card border border-line bg-elevated p-6 shadow-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 id="new-call-title" className="font-serif text-2xl">
                Nueva llamada
              </h2>
              <button type="button" className="grid size-11 place-items-center text-muted" aria-label="Cerrar" onClick={closeModal}>
                <X className="size-5" />
              </button>
            </div>
            <p className="mb-4 text-xs text-muted">Minutos y segundos. Cuatro dígitos.</p>
            <input
              ref={durationRef}
              className="w-full rounded-control border border-line bg-bg px-4 py-4 text-center font-serif text-4xl tracking-widest text-ink outline-none focus:border-accent"
              inputMode="numeric"
              autoComplete="off"
              placeholder="00:00"
              maxLength={5}
              value={duration}
              aria-label="Duración"
              onChange={(event) => setDuration(maskClock(event.target.value))}
            />
            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-soft">
              <span>¿Fue derivada?</span>
              <button
                type="button"
                className={`min-h-11 rounded-control border px-4 text-micro font-semibold tracking-widest ${derived ? "border-accent bg-accent/10 text-accent" : "border-line bg-bg text-muted"}`}
                onClick={toggleDerived}
              >
                {derived ? "D · SÍ" : "D · NO"}
              </button>
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-control bg-accent px-4 py-3 text-xs font-bold tracking-widest text-on-accent uppercase"
              onClick={addCall}
            >
              Agregar al historial · Enter
            </button>
            <p className="mt-3 text-center text-micro text-muted">D alterna derivación · Enter confirma · Esc cancela</p>
          </div>
        </div>
      ) : null}

      <div
        className={`fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-control border border-line bg-elevated px-4 py-2 text-xs text-soft transition-opacity ${toast ? "opacity-100" : "pointer-events-none opacity-0"}`}
        role="status"
      >
        {toast}
      </div>
    </div>
  );
}

function tpaState(value: number | null, goal: number | null) {
  if (value === null) return "Sin datos";
  if (goal === null) return "Sin objetivo";
  return value <= goal ? "En objetivo" : "Fuera de objetivo";
}

function tpaTone(value: number | null, goal: number | null): Tone {
  if (value === null || goal === null) return "idle";
  return value <= goal ? "good" : "bad";
}

function referralState(projection: ReferralProjection | null) {
  if (!projection) return "Sin base";
  if (projection.cleanStill === null) return "Sin retorno";
  return projection.cleanStill === 0 ? "En objetivo" : "Fuera de objetivo";
}

function referralValue(projection: ReferralProjection | null) {
  if (!projection || projection.cleanStill === null) return "—";
  return String(projection.cleanStill);
}

function referralTone(projection: ReferralProjection | null): Tone {
  if (!projection || projection.cleanStill === null) return projection ? "bad" : "idle";
  return projection.cleanStill === 0 ? "good" : "bad";
}

function referralDetail(projection: ReferralProjection | null) {
  if (!projection) return "Cargá la base del tablero";
  if (projection.cleanStill === null) return "No se puede volver a 0%";
  if (projection.cleanStill === 0) return "llamadas sin derivar · ya entraste";
  return projection.cleanStill === 1 ? "llamada sin derivar todavía" : "llamadas sin derivar todavía";
}

function referralCaption(projection: ReferralProjection | null) {
  if (!projection) return "Porcentaje, volumen y faltante de ayer.";
  const live = `Acumulado ${formatPct(projection.livePct)} · objetivo ${formatPct(projection.impliedGoalPct)}`;
  if (projection.cleanStill === 0 && projection.slack > 0) {
    return `${live} · margen ${projection.slack}`;
  }
  return live;
}

type Tone = "idle" | "good" | "bad";

function MetricCard({
  label,
  state,
  value,
  tone,
  detail,
  caption,
}: {
  label: string;
  state: string;
  value: string;
  tone: Tone;
  detail: string;
  caption?: string;
}) {
  const valueColor = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-ink";
  const chip =
    tone === "good" ? "bg-good/15 text-good" : tone === "bad" ? "bg-bad/15 text-bad" : "bg-ink/8 text-muted";
  return (
    <article className="relative min-h-44 overflow-hidden rounded-card border border-line bg-panel p-5">
      <span className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full border border-ink/10" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-micro font-semibold tracking-widest text-muted uppercase">{label}</span>
        <span className={`rounded px-2 py-1 text-micro font-bold tracking-wide uppercase ${chip}`}>{state}</span>
      </div>
      <div className={`mt-6 font-serif text-hero tabular-nums ${valueColor}`}>{value}</div>
      <p className="mt-3 text-xs text-muted">{detail}</p>
      {caption ? <p className="mt-1 text-xs text-soft">{caption}</p> : null}
    </article>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-micro font-semibold tracking-widest text-muted uppercase">{label}</span>
      {children}
      <span className="mt-1 block text-micro text-muted">{hint}</span>
    </label>
  );
}

function NavButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`flex min-h-11 flex-col items-center justify-center gap-1 px-1 py-1 text-micro tracking-wide uppercase ${active ? "text-accent" : "text-muted"}`}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function CallList({
  calls,
  onToggle,
  onRemove,
  empty,
}: {
  calls: CallRecord[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  empty: string;
}) {
  if (!calls.length) {
    return empty ? <div className="rounded-card border border-line bg-panel px-5 py-10 text-center text-xs leading-relaxed text-muted">{empty}</div> : null;
  }
  return (
    <div className="overflow-hidden rounded-card border border-line bg-panel">
      <div className="flex items-center gap-2 px-3 py-3 text-micro font-semibold tracking-widest text-muted uppercase">
        <span className="w-8">#</span>
        <span className="flex-1">Duración</span>
        <span className="w-24 text-right">Resultado</span>
        <span className="size-11" />
      </div>
      <ul>
        {calls.map((call, index) => (
          <li key={call.id} className="flex items-center gap-2 border-t border-line px-3 py-1">
            <span className="w-8 text-sm text-muted tabular-nums">{String(index + 1).padStart(2, "0")}</span>
            <span className="flex-1 font-serif text-xl tabular-nums">{formatClock(call.seconds)}</span>
            <button
              type="button"
              className={`min-h-11 w-24 px-1 text-right text-micro font-semibold tracking-wide uppercase ${call.derived ? "text-accent" : "text-soft"}`}
              onClick={() => onToggle(call.id)}
            >
              {call.derived ? "Derivada" : "Normal"}
            </button>
            <button type="button" className="grid size-11 place-items-center text-muted" aria-label="Quitar llamada" onClick={() => onRemove(call.id)}>
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
