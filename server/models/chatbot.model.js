const { google } = require('googleapis');
const { Dropbox } = require('dropbox');
const documentProcessor = require('../utils/documentProcessor.js');
const { MemoryVectorStore } = require('@langchain/community/vectorstores/memory');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { ChatOpenAI } = require('@langchain/openai');
const { RunnableSequence } = require('@langchain/core/runnables');
const { PromptTemplate } = require('@langchain/core/prompts');

class DocumentChatbot {
  constructor() {
    // Initialize Google Drive
    this.googleDrive = google.drive({
      version: "v3",
      auth: new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      ),
    });

    // Initialize Dropbox
    this.dropbox = new Dropbox({
      accessToken: process.env.DROPBOX_TOKEN,
    });

    // Initialize AI components
    this.vectorStore = null;
    this.llm = new ChatOpenAI({
      temperature: 0,
      modelName: "gpt-3.5-turbo",
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  async initialize() {
    try {
      console.log("Processing documents...");
      const documents = await this.processAllDocuments();
      console.log(`Processed ${documents.length} documents`);
      this.vectorStore = await MemoryVectorStore.fromDocuments(
        documents,
        this.embeddings
      );
      console.log("Vector store initialized");
    } catch (error) {
      console.error("Initialization error:", error);
      throw error;
    }
  }

  async processAllDocuments() {
    const [googleDocs, dropboxDocs] = await Promise.all([
      this.processGoogleDriveDocuments(),
      this.processDropboxDocuments(),
    ]);
    return [...googleDocs, ...dropboxDocs];
  }

  async processGoogleDriveDocuments() {
    try {
      const res = await this.googleDrive.files.list({
        q: "mimeType contains 'text/' or mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'",
        fields: "files(id, name, mimeType)",
        pageSize: 100,
      });

      const processedDocs = [];

      for (const file of res.data.files) {
        try {
          const content = await this.extractGoogleDriveFileContent(file);
          processedDocs.push({
            pageContent: content,
            metadata: {
              source: "Google Drive",
              fileName: file.name,
              mimeType: file.mimeType,
            },
          });
        } catch (error) {
          console.error(`Error processing ${file.name}:`, error);
        }
      }

      return processedDocs;
    } catch (error) {
      console.error("Google Drive processing error:", error);
      return [];
    }
  }

  async processDropboxDocuments() {
    try {
      const response = await this.dropbox.filesListFolder({ path: "" });
      const processedDocs = [];

      for (const entry of response.result.entries) {
        if (this.isSupportedFileType(entry.name)) {
          try {
            const content = await this.extractDropboxFileContent(entry);
            processedDocs.push({
              pageContent: content,
              metadata: {
                source: "Dropbox",
                fileName: entry.name,
                path: entry.path_display,
              },
            });
          } catch (error) {
            console.error(`Error processing ${entry.name}:`, error);
          }
        }
      }

      return processedDocs;
    } catch (error) {
      console.error("Dropbox processing error:", error);
      return [];
    }
  }

  isSupportedFileType(filename) {
    const supported = [".pdf", ".docx", ".doc", ".txt"];
    return supported.some((ext) => filename.toLowerCase().endsWith(ext));
  }

  async extractGoogleDriveFileContent(file) {
    let response;
    try {
      response = await this.googleDrive.files.get(
        {
          fileId: file.id,
          alt: "media",
        },
        { responseType: "arraybuffer" }
      );
    } catch (error) {
      console.error(`Error downloading ${file.name}:`, error);
      throw error;
    }

    try {
      if (file.mimeType === "application/pdf") {
        return await documentProcessor.extractTextFromPdf(response.data);
      } else if (
        file.mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        return await documentProcessor.extractTextFromDocx(response.data);
      } else if (file.mimeType.includes("text/")) {
        return response.data;
      }
      throw new Error(`Unsupported mimeType: ${file.mimeType}`);
    } catch (error) {
      console.error(`Error extracting text from ${file.name}:`, error);
      throw error;
    }
  }

  async extractDropboxFileContent(entry) {
    let response;
    try {
      response = await this.dropbox.filesDownload({ path: entry.path_display });
    } catch (error) {
      console.error(`Error downloading ${entry.name}:`, error);
      throw error;
    }

    try {
      const fileBinary = response.result.fileBinary;
      if (entry.name.toLowerCase().endsWith(".pdf")) {
        return await documentProcessor.extractTextFromPdf(fileBinary);
      } else if (entry.name.toLowerCase().endsWith(".docx")) {
        return await documentProcessor.extractTextFromDocx(fileBinary);
      } else if (entry.name.toLowerCase().endsWith(".txt")) {
        return await documentProcessor.extractTextFromTxt(fileBinary);
      }
      throw new Error(`Unsupported file type: ${entry.name}`);
    } catch (error) {
      console.error(`Error extracting text from ${entry.name}:`, error);
      throw error;
    }
  }

  async chat(query) {
    if (!this.vectorStore) {
      throw new Error("Chatbot not initialized");
    }

    try {
      // 1. Retrieve relevant documents
      const relevantDocs = await this.vectorStore.similaritySearch(query, 3);

      // 2. Generate answer using LLM
      const answer = await this.generateAnswer(query, relevantDocs);

      return {
        answer,
        sources: relevantDocs.map((d) => ({
          fileName: d.metadata.fileName,
          source: d.metadata.source,
        })),
      };
    } catch (error) {
      console.error("Chat error:", error);
      throw error;
    }
  }

  async generateAnswer(query, documents) {
    const prompt = PromptTemplate.fromTemplate(`
      You are a helpful document assistant. Answer the user's question based only on the following documents.
      If you don't know the answer, just say you don't know - don't make up an answer.
      
      Documents:
      {documents}
      
      Question: {query}
      Answer:`);

    const chain = RunnableSequence.from([
      {
        query: (input) => input.query,
        documents: (input) => input.documents,
      },
      prompt,
      this.llm,
    ]);

    const documentText = documents
      .map(
        (d) =>
          `=== ${d.metadata.fileName} (${d.metadata.source}) ===\n${d.pageContent}`
      )
      .join("\n\n");

    const result = await chain.invoke({
      query,
      documents: documentText,
    });

    return result.content;
  }

  async refreshDocuments() {
    console.log("Refreshing documents...");
    await this.initialize();
    console.log("Documents refreshed");
  }
}

module.exports = new DocumentChatbot();
