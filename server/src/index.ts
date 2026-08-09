import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { resolvers } from "./resolvers.js";
import { criarReposPrisma } from "./repos/prisma.js";
import { criarContexto } from "./context.js";

const typeDefs = readFileSync(new URL("../schema.graphql", import.meta.url), "utf-8");
const prisma = new PrismaClient();
const repos = criarReposPrisma(prisma);

// Adaptadores de extração ainda não ligados aqui — ver Task 5/Fase 2 (email/visão em Node).
const contexto = criarContexto(repos, {
  rasterizador: { rasterizar: async () => { throw new Error("rasterizador Node não implementado no MVP-núcleo"); } },
  visao: { extrairDeImagem: async () => { throw new Error("visão Node não implementada no MVP-núcleo"); } },
});

const app = express();
const apollo = new ApolloServer({ typeDefs, resolvers });
await apollo.start();
app.use("/graphql", cors(), express.json(), expressMiddleware(apollo, { context: async () => contexto }));

app.listen(4000, () => console.log("GraphQL em http://localhost:4000/graphql"));
