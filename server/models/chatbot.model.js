const axios = require('axios');
const { QdrantClient } = require("@qdrant/js-client-rest");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const pdf = require('pdf-parse');
const docx = require('docx');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db.js');
const GoogleBucket = require('./google.model.js');
const DropboxBucket = require('./dropbox.model.js');

// Singleton pattern for transformers
let transformers;
let pipeline;

async function getTransformers() {
  if (!transformers) {
    // Dynamic import of ESM module
    transformers = await import('@xenova/transformers');
    pipeline = transformers.pipeline;
    // Warm up the model
    await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return { pipeline, transformers };
}

class Chatbot {
  constructor() {
    this.lmStudioUrl = 'http://127.0.0.1:1234/v1';
    this.qdrant = new QdrantClient({ 
      url: 'https://a0a6bd9d-7ce7-4dc7-b419-50fa3b219edf.us-east4-0.gcp.cloud.qdrant.io',
      apiKey: process.env.QDRANT_API_KEY
    });
    this.embedder = null;
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200
    });
    this.googleDrive = new GoogleBucket();
    this.dropbox = new DropboxBucket();
    
    this.axiosInstance = axios.create({
      baseURL: this.lmStudioUrl,
      timeout: 30000
    });

    // Initialize embeddings model in background
    this.initializeEmbedder().catch(err => {
      console.error('Failed to initialize embedder:', err);
    });
  }

  async initializeEmbedder() {
    if (!this.embedder) {
      const { pipeline } = await getTransformers();
      this.embedder = await pipeline(
        'feature-extraction', 
        'Xenova/all-MiniLM-L6-v2'
      );
    }
    return this.embedder;
  }

  async createEmbeddings(text) {
    try {
      const embedder = await this.initializeEmbedder();
      const output = await embedder(text, {
        pooling: 'mean',
        normalize: true
      });
      return Array.from(output.data);
    } catch (error) {
      console.error('Embedding error:', error);
      throw new Error('Failed to create embeddings');
    }
  }

  async downloadFileFromCloud(fileId, fileType, userId) {
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const tempFilePath = path.join(tempDir, `${fileId}.${fileType}`);
    
    try {
      const fileInfo = await this.getFileStorageInfo(fileId, userId);
      
      if (fileInfo.storage_type === 'google') {
        await this.googleDrive.downloadFile(fileInfo.cloud_id, tempFilePath, userId);
      } else {
        await this.dropbox.downloadFile(fileInfo.cloud_id, tempFilePath, userId);
      }
      
      return tempFilePath;
    } catch (error) {
      // Clean up if error occurs
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      throw error;
    }
  }

  async getFileStorageInfo(fileId, userId) {
    const client = await pool.connect();
    try {
      const res = await client.query(
        'SELECT storage_type, cloud_id FROM user_files WHERE id = $1 AND user_id = $2',
        [fileId, userId]
      );
      if (res.rows.length === 0) throw new Error('File not found');
      return res.rows[0];
    } finally {
      client.release();
    }
  }

  async initializeUserCollection(userId) {
    const collectionName = `user_${userId}_docs`;
    try {
      await this.qdrant.getCollection(collectionName);
    } catch (error) {
      if (error.status === 404) {
        await this.qdrant.createCollection(collectionName, {
          vectors: {
            size: 384, // MiniLM-L6-v2 embedding size
            distance: "Cosine",
            on_disk: true
          }
        });
      } else {
        throw error;
      }
    }
    return collectionName;
  }

  async storeDocumentChunks(collectionName, fileId, fileName, chunks) {
    const points = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await this.createEmbeddings(chunk);
      
      points.push({
        id: `${fileId}_${i}`,
        vector: embedding,
        payload: {
          fileId,
          fileName,
          text: chunk,
          chunkIndex: i
        }
      });
    }
    
    await this.qdrant.upsert(collectionName, {
      wait: true,
      points
    });
  }

  async extractTextFromFile(filePath, fileExtension) {
    try {
      const data = fs.readFileSync(filePath);
      
      switch(fileExtension.toLowerCase()) {
        case 'pdf':
          const pdfData = await pdf(data);
          return pdfData.text;
        case 'docx':
          const doc = await docx.Document.load(data);
          return doc.paragraphs.map(p => p.text).join('\n');
        case 'txt':
          return data.toString();
        default:
          throw new Error(`Unsupported file type: ${fileExtension}`);
      }
    } catch (error) {
      console.error('Error extracting text:', error);
      throw error;
    }
  }

  async processUserFiles(userId) {
    const client = await pool.connect();
    const collectionName = await this.initializeUserCollection(userId);
    
    try {
      const filesQuery = `
        SELECT id, title, file_extension, storage_type, cloud_id 
        FROM user_files 
        WHERE user_id = $1`;
      const filesRes = await client.query(filesQuery, [userId]);
      
      for (const file of filesRes.rows) {
        let tempFilePath;
        try {
          tempFilePath = await this.downloadFileFromCloud(
            file.id, 
            file.file_extension, 
            userId
          );
          
          const text = await this.extractTextFromFile(tempFilePath, file.file_extension);
          const chunks = await this.textSplitter.splitText(text);
          
          await this.storeDocumentChunks(collectionName, file.id, file.title, chunks);
        } finally {
          if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        }
      }
      
      return { success: true, processedFiles: filesRes.rows.length };
    } catch (error) {
      console.error('Error processing files:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async searchChunks(collectionName, query, fileFilter = null) {
    const queryEmbedding = await this.createEmbeddings(query);
    
    const searchParams = {
      vector: queryEmbedding,
      limit: 5,
      with_payload: true,
      with_vectors: false
    };
    
    if (fileFilter) {
      searchParams.filter = {
        must: [
          {
            key: "fileId",
            match: {
              value: fileFilter
            }
          }
        ]
      };
    }
    
    const results = await this.qdrant.search(collectionName, searchParams);
    
    return results.map(result => ({
      fileId: result.payload.fileId,
      fileName: result.payload.fileName,
      text: result.payload.text,
      score: result.score
    }));
  }

  async generateResponse(query, contextChunks) {
    const context = contextChunks.map(c => c.text).join('\n\n---\n\n');

    const prompt = `
      Answer the user's question STRICTLY based on these documents.
      If the answer isn't here, say "I couldn't find an answer."

      DOCUMENTS:
      ${context}

      QUESTION: 
      ${query}

      ANSWER:
    `;

    try {
      const response = await this.axiosInstance.post('/chat/completions', {
        model: 'mistral-7b',
        messages: [
          { 
            role: 'system', 
            content: 'You answer questions using ONLY the provided documents.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      });

      return {
        answer: response.data.choices[0].message.content,
        sources: contextChunks.map(c => ({
          fileId: c.fileId,
          fileName: c.fileName,
          score: c.score
        }))
      };
    } catch (error) {
      console.error('LM Studio error:', error.response?.data || error.message);
      return {
        answer: "Sorry, I encountered an error processing your request.",
        sources: []
      };
    }
  }

  async chatWithDocuments(userId, query, fileIdFilter = null) {
    try {
      const collectionName = `user_${userId}_docs`;
      
      const relevantChunks = await this.searchChunks(collectionName, query, fileIdFilter);
      
      if (relevantChunks.length === 0) {
        return {
          answer: "I couldn't find any relevant information in your documents.",
          sources: []
        };
      }
      
      return await this.generateResponse(query, relevantChunks);
    } catch (error) {
      console.error('Chat error:', error);
      throw error;
    }
  }
}

module.exports = Chatbot;