import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@apollo/client/react";
import { FILA_REVISAO } from "../graphql.js";
import { KeyboardShortcutBar, type ShortcutHint } from "./KeyboardShortcutBar.js";
import { useRotulosCentroCusto } from "./useRotulosCentroCusto.js";
import styles from "./AppShell.module.css";

function navItems(rotuloPluralCentroCusto: string) {
  return [
    { to: "/", label: "Fila de Revisão", contador: true },
    { to: "/carregar-fatura", label: "Carregar Fatura" },
    { to: "/centros-custo", label: rotuloPluralCentroCusto },
    { to: "/fornecedores", label: "Fornecedores" },
    { to: "/despesas", label: "Despesas" },
    { to: "/utilizadores", label: "Utilizadores" },
    { to: "/tarefas", label: "Tarefas" },
    { to: "/definicoes", label: "Definições" },
  ];
}

const DEV_NAV_ITEMS = [
  { to: "/nova-despesa-teste", label: "+ Despesa (teste)" },
];

const ShortcutsContext = createContext<(shortcuts: ShortcutHint[]) => void>(() => {});

/** Regista os atalhos de teclado do ecrã atual na barra persistente do AppShell. */
export function useShortcutBar(shortcuts: ShortcutHint[]) {
  const setShortcuts = useContext(ShortcutsContext);
  const chave = JSON.stringify(shortcuts);
  useEffect(() => {
    setShortcuts(JSON.parse(chave));
    return () => setShortcuts([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
}

export function AppShell({ children }: { children?: ReactNode }) {
  const [shortcuts, setShortcuts] = useState<ShortcutHint[]>([]);
  const { data } = useQuery(FILA_REVISAO, { fetchPolicy: "cache-and-network" });
  const porRever = data?.filaRevisao.length;
  const rotulos = useRotulosCentroCusto();
  const NAV_ITEMS = navItems(rotulos.plural);

  return (
    <ShortcutsContext.Provider value={setShortcuts}>
      <div className={styles.shell}>
        <div className={styles.body}>
          <nav className={styles.sidebar}>
            <div className={styles.brand}>
              <img src="/icon.png" alt="" className={styles.brandIcon} />
              Prumo
            </div>
            <div className={styles.nav}>
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) => [styles.link, isActive ? styles.linkActive : ""].filter(Boolean).join(" ")}
                >
                  <span>{item.label}</span>
                  {item.contador && porRever ? <span className={styles.navCount}>{porRever}</span> : null}
                </NavLink>
              ))}
            </div>
            <div className={styles.devSection}>
              <div className={styles.devLabel}>Desenvolvimento</div>
              <div className={styles.nav}>
                {DEV_NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => [styles.link, isActive ? styles.linkActive : ""].filter(Boolean).join(" ")}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </nav>
          <main className={styles.content}>{children ?? <Outlet />}</main>
        </div>
        <KeyboardShortcutBar shortcuts={shortcuts} />
      </div>
    </ShortcutsContext.Provider>
  );
}
