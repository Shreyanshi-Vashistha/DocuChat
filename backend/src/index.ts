import express from "express";
import cors from "cors";
import { DocumentService } from "./services/documentService";
import { VectorService } from "./services/vectorService";
import { LLMService } from "./services/llmService";
import chatRoutes from "./routes/chat";
import dotenv from "dotenv";

const app = express();
const PORT = process.env.PORT || 5001;
dotenv.config();

app.use(cors());
app.use(express.json());

let documentService: DocumentService;
let vectorService: VectorService;
let llmService: LLMService;

// Initialize services
async function initializeServices() {
  try {
    console.log("Initializing services...");

    documentService = new DocumentService();
    vectorService = new VectorService();
    llmService = new LLMService();

    // Load and process documents
    await documentService.loadDocument("./src/documents/sample.txt");
    const chunks = documentService.getChunks();

    // Create embeddings and store in vector database
    await vectorService.indexChunks(chunks);

    console.log("Services initialized successfully");
  } catch (error) {
    console.error("Failed to initialize services:", error);
    process.exit(1);
  }
}

// Make services available to routes
app.use("/api", (req, res, next) => {
  req.documentService = documentService;
  req.vectorService = vectorService;
  req.llmService = llmService;
  next();
});

// Routes
app.use("/api/chat", chatRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

async function startServer() {
  await initializeServices();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

declare global {
  namespace Express {
    interface Request {
      documentService: DocumentService;
      vectorService: VectorService;
      llmService: LLMService;
    }
  }
}
