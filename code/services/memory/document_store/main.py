from fastapi import FastAPI, HTTPException, status, Query, Depends, Body
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime
import os
import json
from pathlib import Path

# --- Constants ---
# In a production environment, this would use a proper database
# For simplicity, we'll use a file-based storage
DATA_DIR = Path("./data")

# --- FastAPI App ---
app = FastAPI(
    title="Document Store Memory Service",
    description="Storage for conversation history, task results, and structured data",
    version="0.1.0"
)

# --- Models ---
class DocumentCreate(BaseModel):
    content_type: str
    content: Any
    metadata: Dict[str, Any] = Field(default_factory=dict)
    ttl: Optional[int] = None  # Time-to-live in seconds, None means no expiration

class Document(DocumentCreate):
    id: str
    created_at: datetime

class HealthResponse(BaseModel):
    status: str
    documents_count: int

# --- Ensure data directory exists ---
def ensure_data_dir():
    if not DATA_DIR.exists():
        DATA_DIR.mkdir(parents=True)
    if not (DATA_DIR / "documents").exists():
        (DATA_DIR / "documents").mkdir()

ensure_data_dir()

# --- Document Store Functions ---
def save_document(document: Document) -> None:
    """Save a document to the file system"""
    file_path = DATA_DIR / "documents" / f"{document.id}.json"
    with open(file_path, "w") as f:
        # Convert datetime to string
        doc_dict = document.dict()
        doc_dict["created_at"] = doc_dict["created_at"].isoformat()
        json.dump(doc_dict, f)

def load_document(document_id: str) -> Optional[Document]:
    """Load a document from the file system"""
    file_path = DATA_DIR / "documents" / f"{document_id}.json"
    if not file_path.exists():
        return None
    
    with open(file_path, "r") as f:
        doc_dict = json.load(f)
        # Convert string back to datetime
        doc_dict["created_at"] = datetime.fromisoformat(doc_dict["created_at"])
        return Document(**doc_dict)

def delete_document(document_id: str) -> bool:
    """Delete a document from the file system"""
    file_path = DATA_DIR / "documents" / f"{document_id}.json"
    if not file_path.exists():
        return False
    
    file_path.unlink()
    return True

def list_documents(content_type: Optional[str] = None, metadata_filter: Optional[Dict[str, Any]] = None) -> List[Document]:
    """List documents, optionally filtered by content type and metadata"""
    documents = []
    
    for file_path in (DATA_DIR / "documents").glob("*.json"):
        with open(file_path, "r") as f:
            try:
                doc_dict = json.load(f)
                doc_dict["created_at"] = datetime.fromisoformat(doc_dict["created_at"])
                document = Document(**doc_dict)
                
                # Apply filters
                if content_type and document.content_type != content_type:
                    continue
                
                if metadata_filter:
                    match = True
                    for key, value in metadata_filter.items():
                        if key not in document.metadata or document.metadata[key] != value:
                            match = False
                            break
                    if not match:
                        continue
                
                documents.append(document)
            except Exception as e:
                # Skip invalid documents
                print(f"Error loading document from {file_path}: {e}")
    
    # Sort by creation time, newest first
    documents.sort(key=lambda d: d.created_at, reverse=True)
    return documents

# --- API Routes ---
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check the health of the service"""
    doc_count = len(list((DATA_DIR / "documents").glob("*.json")))
    return {
        "status": "operational",
        "documents_count": doc_count
    }

@app.post("/documents", response_model=Document)
async def create_document(document: DocumentCreate):
    """Create a new document"""
    # Generate a new document ID
    document_id = str(uuid.uuid4())
    
    # Create the document
    new_document = Document(
        id=document_id,
        content_type=document.content_type,
        content=document.content,
        metadata=document.metadata,
        ttl=document.ttl,
        created_at=datetime.now()
    )
    
    # Save the document
    save_document(new_document)
    
    return new_document

@app.get("/documents", response_model=List[Document])
async def get_documents(
    content_type: Optional[str] = None,
    metadata: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000)
):
    """Get a list of documents, optionally filtered by content type and metadata"""
    metadata_filter = None
    if metadata:
        try:
            metadata_filter = json.loads(metadata)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid metadata filter format. Must be a valid JSON object."
            )
    
    documents = list_documents(content_type, metadata_filter)
    
    # Apply limit
    documents = documents[:limit]
    
    return documents

@app.get("/documents/{document_id}", response_model=Document)
async def get_document(document_id: str):
    """Get a document by ID"""
    document = load_document(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID {document_id} not found"
        )
    
    return document

@app.delete("/documents/{document_id}", response_model=Dict[str, Any])
async def delete_document_route(document_id: str):
    """Delete a document by ID"""
    success = delete_document(document_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID {document_id} not found"
        )
    
    return {"success": True, "id": document_id}

@app.post("/documents/search", response_model=List[Document])
async def search_documents(
    query: Dict[str, Any] = Body(...),
    limit: int = Query(100, ge=1, le=1000)
):
    """Search for documents based on content type and metadata"""
    content_type = query.get("content_type")
    metadata_filter = query.get("metadata")
    
    documents = list_documents(content_type, metadata_filter)
    
    # Apply limit
    documents = documents[:limit]
    
    return documents

# --- Run with Uvicorn ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004) 