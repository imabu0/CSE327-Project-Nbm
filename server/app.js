const { PDFLoader } = require("langchain/document_loaders/fs/pdf");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { HNSWLib } = require("langchain/vectorstores/hnswlib");
const { RetrievalQAChain } = require("langchain/chains");
const { OpenAI } = require("langchain/llms/openai");
const dotenv = require("dotenv");

dotenv.config();

async function main() {
  const loader = new PDFLoader("src/documents/budget_speech.pdf");

  const docs = await loader.load();

  // splitter function
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 20,
  });

  // created chunks from pdf
  const splittedDocs = await splitter.splitDocuments(docs);

  const embeddings = new OpenAIEmbeddings();

  const vectorStore = await HNSWLib.fromDocuments(
    splittedDocs,
    embeddings
  );

  const vectorStoreRetriever = vectorStore.asRetriever();
  const model = new OpenAI({
    modelName: 'gpt-3.5-turbo'
  });

  const chain = RetrievalQAChain.fromLLM(model, vectorStoreRetriever);

  const question = 'What is the theme of G20?';
  const answer = await chain.call({
    query: question
  });

  console.log({
    question,
    answer
  });

  const question1 = 'Number of progress?';
  const answer1 = await chain.call({
    query: question1
  });

  console.log({
    question: question1,
    answer: answer1
  });

  const question2 = 'Final presentation date?'
  const answer2 = await chain.call({
    query: question2
  });
  console.log({
    question: question2,
    answer: answer2
  });
}

main().catch(console.error);