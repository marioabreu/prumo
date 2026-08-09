import { ApolloProvider } from "@apollo/client/react";
import { Routes, Route } from "react-router-dom";
import { client } from "./apollo.js";
import { AppShell } from "./ui/AppShell.js";
import { FilaRevisao } from "./FilaRevisao.js";
import { ObrasScreen } from "./screens/ObrasScreen.js";

function App() {
  return (
    <ApolloProvider client={client}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<FilaRevisao />} />
          <Route path="/obras" element={<ObrasScreen />} />
        </Route>
      </Routes>
    </ApolloProvider>
  );
}

export default App;
