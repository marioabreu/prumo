import express from "express";
import cors from "cors";
import multer from "multer";
import { fileURLToPath } from "node:url";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { resolvers } from "./resolvers.js";
import { criarReposPrisma } from "./repos/prisma.js";
import { criarContexto } from "./context.js";
import { criarStorageLocal } from "./storage/local.js";
import { semearFuncionalidades } from "./funcionalidades/registo.js";
import { semearRotulosCentroCusto } from "./configuracao/rotulos.js";

const typeDefs = readFileSync(new URL("../schema.graphql", import.meta.url), "utf-8");
const prisma = new PrismaClient();
const repos = criarReposPrisma(prisma);
await semearFuncionalidades(repos);
await semearRotulosCentroCusto(repos);

const uploadsDir = fileURLToPath(new URL("../uploads/", import.meta.url));
const storage = criarStorageLocal(uploadsDir, "http://localhost:4000/files");

// Adaptadores de extração ainda não ligados aqui — ver Task 5/Fase 2 (email/visão em Node).
const contexto = criarContexto(repos, {
  rasterizador: { rasterizar: async () => { throw new Error("rasterizador Node não implementado no MVP-núcleo"); } },
  visao: { extrairDeImagem: async () => { throw new Error("visão Node não implementada no MVP-núcleo"); } },
});

const app = express();
const apollo = new ApolloServer({ typeDefs, resolvers });
await apollo.start();
app.use("/graphql", cors(), express.json(), expressMiddleware(apollo, { context: async () => contexto }));

app.use("/files", cors(), express.static(uploadsDir));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
app.post("/upload", cors(), upload.single("ficheiro"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ erro: "Nenhum ficheiro enviado (campo 'ficheiro')." });
    return;
  }
  const { url } = await storage.guardar(req.file.buffer, req.file.originalname, req.file.mimetype);
  res.json({ url });
});

app.listen(4000, () => console.log("GraphQL em http://localhost:4000/graphql"));
