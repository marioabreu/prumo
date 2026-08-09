import { ApolloProvider } from "@apollo/client/react";
import { client } from "./apollo.js";
import { FilaRevisao } from "./FilaRevisao.js";

function App() {
  return (
    <ApolloProvider client={client}>
      <FilaRevisao />
    </ApolloProvider>
  );
}

export default App;
