import { ApolloProvider } from "@apollo/client/react";
import { Routes, Route } from "react-router-dom";
import { client } from "./apollo.js";
import { AppShell } from "./ui/AppShell.js";
import { FilaRevisao } from "./FilaRevisao.js";
import { CarregarFaturaScreen } from "./screens/CarregarFaturaScreen.js";
import { ObrasScreen } from "./screens/ObrasScreen.js";
import { FornecedoresScreen } from "./screens/FornecedoresScreen.js";
import { UtilizadoresScreen } from "./screens/UtilizadoresScreen.js";
import { DespesasScreen } from "./screens/DespesasScreen.js";
import { NovaDespesaTesteScreen } from "./screens/NovaDespesaTesteScreen.js";

function App() {
  return (
    <ApolloProvider client={client}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<FilaRevisao />} />
          <Route path="/carregar-fatura" element={<CarregarFaturaScreen />} />
          <Route path="/obras" element={<ObrasScreen />} />
          <Route path="/fornecedores" element={<FornecedoresScreen />} />
          <Route path="/despesas" element={<DespesasScreen />} />
          <Route path="/utilizadores" element={<UtilizadoresScreen />} />
          <Route path="/nova-despesa-teste" element={<NovaDespesaTesteScreen />} />
        </Route>
      </Routes>
    </ApolloProvider>
  );
}

export default App;
