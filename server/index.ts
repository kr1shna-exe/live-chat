import express from "express";
import { router as authRouter } from "./routes/auth";
import { router as convRouter } from "./routes/conversations";
import { createServer } from "http";
import { initWebSocket } from "./ws/connection";
import { connectDB } from "./db/models";

const app = express();
app.use(express.json());

app.use("/auth", authRouter);
app.use("/", convRouter);

const server = createServer(app);
connectDB();
initWebSocket(server);

server.listen(3000, () => {
  console.log("Server is running on PORT: 3000");
})
