from typing import Dict, Any, List, Optional, Union
import logging
from datetime import datetime
import json
from pathlib import Path
import asyncio
from dataclasses import dataclass
import aiohttp
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

@dataclass
class KnowledgeEntry:
    """Knowledge entry with metadata."""
    id: str
    content: str
    embedding: np.ndarray
    domain: str
    source_urls: List[str]
    confidence: float
    timestamp: datetime
    metadata: Dict[str, Any]

class KnowledgeBase:
    """Knowledge base for managing external knowledge."""
    
    def __init__(
        self,
        storage_path: Union[str, Path],
        embedding_dimension: int = 768,
        similarity_threshold: float = 0.7,
        max_entries: int = 10000
    ):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        self._embedding_dimension = embedding_dimension
        self._similarity_threshold = similarity_threshold
        self._max_entries = max_entries
        
        self._entries: Dict[str, KnowledgeEntry] = {}
        self._embeddings: Dict[str, np.ndarray] = {}
        self._domain_index: Dict[str, List[str]] = {}
        
        self._load_knowledge()
    
    def _load_knowledge(self) -> None:
        """Load knowledge from storage."""
        index_path = self.storage_path / "knowledge_index.json"
        if not index_path.exists():
            return
            
        with open(index_path, "r") as f:
            index_data = json.load(f)
            
        for entry_id, metadata in index_data.items():
            entry_path = self.storage_path / f"{entry_id}.json"
            if entry_path.exists():
                with open(entry_path, "r") as f:
                    entry_data = json.load(f)
                    
                entry = KnowledgeEntry(
                    id=entry_id,
                    content=entry_data["content"],
                    embedding=np.array(entry_data["embedding"]),
                    domain=entry_data["domain"],
                    source_urls=entry_data["source_urls"],
                    confidence=entry_data["confidence"],
                    timestamp=datetime.fromisoformat(entry_data["timestamp"]),
                    metadata=entry_data["metadata"]
                )
                
                self._entries[entry_id] = entry
                self._embeddings[entry_id] = entry.embedding
                
                if entry.domain not in self._domain_index:
                    self._domain_index[entry.domain] = []
                self._domain_index[entry.domain].append(entry_id)
    
    def _save_knowledge(self) -> None:
        """Save knowledge to storage."""
        # Save index
        index_data = {
            entry_id: {
                "domain": entry.domain,
                "confidence": entry.confidence,
                "timestamp": entry.timestamp.isoformat()
            }
            for entry_id, entry in self._entries.items()
        }
        
        with open(self.storage_path / "knowledge_index.json", "w") as f:
            json.dump(index_data, f, indent=2)
        
        # Save entries
        for entry_id, entry in self._entries.items():
            entry_data = {
                "content": entry.content,
                "embedding": entry.embedding.tolist(),
                "domain": entry.domain,
                "source_urls": entry.source_urls,
                "confidence": entry.confidence,
                "timestamp": entry.timestamp.isoformat(),
                "metadata": entry.metadata
            }
            
            with open(self.storage_path / f"{entry_id}.json", "w") as f:
                json.dump(entry_data, f, indent=2)
    
    async def query(
        self,
        query: str,
        domain: Optional[str] = None,
        limit: int = 5
    ) -> Dict[str, Any]:
        """Query knowledge base for relevant information."""
        try:
            # Get query embedding
            query_embedding = await self._get_embedding(query)
            
            # Filter by domain if specified
            candidate_ids = (
                self._domain_index.get(domain, [])
                if domain
                else list(self._entries.keys())
            )
            
            if not candidate_ids:
                return {
                    "results": [],
                    "references": []
                }
            
            # Calculate similarities
            similarities = []
            for entry_id in candidate_ids:
                entry_embedding = self._embeddings[entry_id]
                similarity = cosine_similarity(
                    query_embedding.reshape(1, -1),
                    entry_embedding.reshape(1, -1)
                )[0][0]
                similarities.append((entry_id, similarity))
            
            # Sort by similarity
            similarities.sort(key=lambda x: x[1], reverse=True)
            
            # Get top results
            results = []
            references = []
            for entry_id, similarity in similarities[:limit]:
                if similarity >= self._similarity_threshold:
                    entry = self._entries[entry_id]
                    results.append({
                        "content": entry.content,
                        "confidence": entry.confidence * similarity,
                        "domain": entry.domain
                    })
                    references.extend(entry.source_urls)
            
            return {
                "results": results,
                "references": list(set(references))  # Deduplicate
            }
            
        except Exception as e:
            logger.error(f"Error querying knowledge base: {str(e)}")
            return {
                "error": "Failed to query knowledge base",
                "details": str(e)
            }
    
    async def add_entry(
        self,
        content: str,
        domain: str,
        source_urls: List[str],
        confidence: float,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Add new entry to knowledge base."""
        try:
            # Get embedding
            embedding = await self._get_embedding(content)
            
            # Create entry
            entry = KnowledgeEntry(
                id=f"k_{len(self._entries)}",
                content=content,
                embedding=embedding,
                domain=domain,
                source_urls=source_urls,
                confidence=confidence,
                timestamp=datetime.now(),
                metadata=metadata or {}
            )
            
            # Add to indices
            self._entries[entry.id] = entry
            self._embeddings[entry.id] = embedding
            
            if domain not in self._domain_index:
                self._domain_index[domain] = []
            self._domain_index[domain].append(entry.id)
            
            # Maintain size limit
            if len(self._entries) > self._max_entries:
                self._remove_oldest_entries()
            
            # Save to storage
            self._save_knowledge()
            
            return {
                "success": True,
                "entry_id": entry.id
            }
            
        except Exception as e:
            logger.error(f"Error adding knowledge entry: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _remove_oldest_entries(self) -> None:
        """Remove oldest entries to maintain size limit."""
        entries_to_remove = len(self._entries) - self._max_entries
        if entries_to_remove <= 0:
            return
            
        # Sort by timestamp
        sorted_entries = sorted(
            self._entries.items(),
            key=lambda x: x[1].timestamp
        )
        
        # Remove oldest
        for entry_id, entry in sorted_entries[:entries_to_remove]:
            del self._entries[entry_id]
            del self._embeddings[entry_id]
            self._domain_index[entry.domain].remove(entry_id)
            
            # Remove from storage
            entry_path = self.storage_path / f"{entry_id}.json"
            if entry_path.exists():
                entry_path.unlink()
    
    async def _get_embedding(self, text: str) -> np.ndarray:
        """Get embedding for text using external service."""
        # This would typically call an embedding service
        # For now, return random embedding
        return np.random.randn(self._embedding_dimension)
    
    def get_entry(self, entry_id: str) -> Optional[KnowledgeEntry]:
        """Get entry by ID."""
        return self._entries.get(entry_id)
    
    def get_domain_entries(self, domain: str) -> List[KnowledgeEntry]:
        """Get all entries for a domain."""
        entry_ids = self._domain_index.get(domain, [])
        return [self._entries[entry_id] for entry_id in entry_ids] 