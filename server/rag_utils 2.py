"""
RAG utilities for document processing and vector database management.
"""

import os
import chromadb
from chromadb.config import Settings
from langchain_openai import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain.schema import Document
import PyPDF2
import docx
from typing import List, Dict, Any, Optional
import uuid
import tempfile


class VectorDatabase:
    """Manages ChromaDB vector database for document storage and retrieval."""

    def __init__(self, persist_directory: str = "./chroma_db"):
        """Initialize ChromaDB client."""
        self.persist_directory = persist_directory
        self.embeddings = OpenAIEmbeddings()

        # Create directory if it doesn't exist
        os.makedirs(persist_directory, exist_ok=True)

        # Initialize ChromaDB client with persistence
        self.client = chromadb.PersistentClient(path=persist_directory)

        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name="documents",
            metadata={"hnsw:space": "cosine"}
        )

    def add_document(self, content: str, metadata: Dict[str, Any]) -> str:
        """Add a document to the vector database."""
        # Generate embedding
        embedding = self.embeddings.embed_query(content)

        # Generate unique ID
        doc_id = str(uuid.uuid4())

        # Add to ChromaDB
        self.collection.add(
            embeddings=[embedding],
            documents=[content],
            metadatas=[metadata],
            ids=[doc_id]
        )

        return doc_id

    def search_documents(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """Search for relevant documents."""
        # Generate query embedding
        query_embedding = self.embeddings.embed_query(query)

        # Search in ChromaDB
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"]
        )

        # Format results
        documents = []
        if results['documents'][0]:  # Check if results exist
            for i in range(len(results['documents'][0])):
                documents.append({
                    'content': results['documents'][0][i],
                    'metadata': results['metadatas'][0][i],
                    'score': 1 - results['distances'][0][i]  # Convert distance to similarity
                })

        return documents

    def delete_document(self, doc_id: str) -> bool:
        """Delete a document from the vector database."""
        try:
            self.collection.delete(ids=[doc_id])
            return True
        except Exception as e:
            print(f"Error deleting document {doc_id}: {e}")
            return False

    def list_documents(self) -> List[Dict[str, Any]]:
        """List all documents in the database."""
        try:
            results = self.collection.get(include=["metadatas"])
            return [
                {
                    'id': results['ids'][i],
                    'metadata': results['metadatas'][i]
                }
                for i in range(len(results['ids']))
            ]
        except Exception as e:
            print(f"Error listing documents: {e}")
            return []


class DocumentProcessor:
    """Handles document processing and text extraction."""

    def __init__(self):
        """Initialize document processor."""
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )

    def extract_text_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF file."""
        text = ""
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
        return text

    def extract_text_from_docx(self, file_path: str) -> str:
        """Extract text from DOCX file."""
        doc = docx.Document(file_path)
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text

    def extract_text_from_txt(self, file_path: str) -> str:
        """Extract text from TXT file."""
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read()

    def process_file(self, file_path: str, filename: str) -> List[Dict[str, Any]]:
        """Process a file and return chunks with metadata."""
        # Determine file type and extract text
        file_extension = filename.lower().split('.')[-1]

        if file_extension == 'pdf':
            text = self.extract_text_from_pdf(file_path)
        elif file_extension == 'docx':
            text = self.extract_text_from_docx(file_path)
        elif file_extension == 'txt':
            text = self.extract_text_from_txt(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_extension}")

        # Split text into chunks
        chunks = self.text_splitter.split_text(text)

        # Create documents with metadata
        documents = []
        for i, chunk in enumerate(chunks):
            documents.append({
                'content': chunk,
                'metadata': {
                    'filename': filename,
                    'file_type': file_extension,
                    'chunk_index': i,
                    'total_chunks': len(chunks)
                }
            })

        return documents


# Global instances - initialize lazily to avoid environment issues
_vector_db = None
_document_processor = None

def get_vector_db():
    """Get or create vector database instance."""
    global _vector_db
    if _vector_db is None:
        _vector_db = VectorDatabase()
    return _vector_db

def get_document_processor():
    """Get or create document processor instance."""
    global _document_processor
    if _document_processor is None:
        _document_processor = DocumentProcessor()
    return _document_processor


def process_uploaded_file(file_content: bytes, filename: str) -> Dict[str, Any]:
    """Process an uploaded file and add to vector database."""
    try:
        # Save file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{filename.split('.')[-1]}") as temp_file:
            temp_file.write(file_content)
            temp_file_path = temp_file.name

        try:
            # Process the file
            documents = get_document_processor().process_file(temp_file_path, filename)

            # Add each chunk to vector database
            document_ids = []
            for doc in documents:
                doc_id = get_vector_db().add_document(doc['content'], doc['metadata'])
                document_ids.append(doc_id)

            return {
                'success': True,
                'filename': filename,
                'chunks_created': len(document_ids),
                'document_ids': document_ids
            }

        finally:
            # Clean up temporary file
            os.unlink(temp_file_path)

    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def search_documents(query: str, top_k: int = 3) -> List[Dict[str, Any]]:
    """Search for relevant documents in the vector database."""
    return get_vector_db().search_documents(query, top_k)


def delete_document_by_filename(filename: str) -> Dict[str, Any]:
    """Delete all chunks of a document by filename."""
    try:
        # Get all documents
        all_docs = get_vector_db().list_documents()

        # Find documents with matching filename
        docs_to_delete = [
            doc['id'] for doc in all_docs
            if doc['metadata'].get('filename') == filename
        ]

        # Delete each document
        deleted_count = 0
        for doc_id in docs_to_delete:
            if get_vector_db().delete_document(doc_id):
                deleted_count += 1

        return {
            'success': True,
            'deleted_chunks': deleted_count
        }

    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def list_all_documents() -> List[Dict[str, Any]]:
    """List all documents grouped by filename."""
    try:
        all_docs = get_vector_db().list_documents()

        # Group by filename
        grouped_docs = {}
        for doc in all_docs:
            filename = doc['metadata'].get('filename', 'Unknown')
            if filename not in grouped_docs:
                grouped_docs[filename] = {
                    'filename': filename,
                    'file_type': doc['metadata'].get('file_type', 'unknown'),
                    'total_chunks': 0,
                    'document_ids': []
                }
            grouped_docs[filename]['total_chunks'] += 1
            grouped_docs[filename]['document_ids'].append(doc['id'])

        return list(grouped_docs.values())

    except Exception as e:
        print(f"Error listing documents: {e}")
        return []