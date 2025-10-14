import express from "express";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors({ origin: ["http://localhost:3000"], credentials: true }));


app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "backend", ts: new Date().toISOString() });
});

app.post("/api/tools/shell", async (req, res) => {

  res.status(501).json({ error: "shell tool not yet enabled" });
});


app.post("/api/sandbox/write", (_req, res) => {
  res.status(501).json({ error: "sandbox write not yet enabled" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`backend listening on http://localhost:${PORT}`);
});
