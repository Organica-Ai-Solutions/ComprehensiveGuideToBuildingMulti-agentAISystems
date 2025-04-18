from typing import Dict, Any, List, Optional, Union
import logging
from datetime import datetime
import json
from pathlib import Path
import asyncio
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)

@dataclass
class MemoryEntry:
    """Base class for memory entries."""
    id: str
    content: Any
    timestamp: datetime
    metadata: Dict[str, Any]
    memory_type: str
    importance: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert entry to dictionary."""
        return {
            **asdict(self),
            "timestamp": self.timestamp.isoformat()
        }

class WorkingMemory:
    """Short-term working memory for active processing."""
    
    def __init__(self, capacity: int = 100):
        self._memory: List[MemoryEntry] = []
        self._capacity = capacity
    
    def add(self, entry: MemoryEntry) -> None:
        """Add entry to working memory."""
        self._memory.append(entry)
        if len(self._memory) > self._capacity:
            # Remove least important entries when over capacity
            self._memory.sort(key=lambda x: x.importance)
            self._memory = self._memory[-self._capacity:]
    
    def get_recent(self, limit: int = None) -> List[MemoryEntry]:
        """Get recent memory entries."""
        entries = sorted(self._memory, key=lambda x: x.timestamp, reverse=True)
        if limit:
            return entries[:limit]
        return entries
    
    def search(self, query: Dict[str, Any]) -> List[MemoryEntry]:
        """Search memory entries by attributes."""
        results = []
        for entry in self._memory:
            match = True
            for key, value in query.items():
                if not hasattr(entry, key) or getattr(entry, key) != value:
                    match = False
                    break
            if match:
                results.append(entry)
        return results
    
    def clear(self) -> None:
        """Clear working memory."""
        self._memory.clear()

class LongTermMemory:
    """Persistent long-term memory storage."""
    
    def __init__(self, storage_path: Union[str, Path]):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self._memory_index: Dict[str, Dict[str, Any]] = {}
        self._load_index()
    
    def _load_index(self) -> None:
        """Load memory index from storage."""
        index_path = self.storage_path / "index.json"
        if index_path.exists():
            with open(index_path, "r") as f:
                self._memory_index = json.load(f)
    
    def _save_index(self) -> None:
        """Save memory index to storage."""
        index_path = self.storage_path / "index.json"
        with open(index_path, "w") as f:
            json.dump(self._memory_index, f, indent=2)
    
    def add(self, entry: MemoryEntry) -> None:
        """Add entry to long-term memory."""
        # Save entry to file
        entry_path = self.storage_path / f"{entry.id}.json"
        with open(entry_path, "w") as f:
            json.dump(entry.to_dict(), f, indent=2)
        
        # Update index
        self._memory_index[entry.id] = {
            "id": entry.id,
            "memory_type": entry.memory_type,
            "timestamp": entry.timestamp.isoformat(),
            "importance": entry.importance,
            "metadata": entry.metadata
        }
        self._save_index()
    
    def get(self, entry_id: str) -> Optional[Dict[str, Any]]:
        """Get entry by ID."""
        if entry_id not in self._memory_index:
            return None
            
        entry_path = self.storage_path / f"{entry_id}.json"
        if not entry_path.exists():
            return None
            
        with open(entry_path, "r") as f:
            return json.load(f)
    
    def search(self, query: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Search memory entries by attributes."""
        results = []
        for entry_id, index_entry in self._memory_index.items():
            match = True
            for key, value in query.items():
                if key not in index_entry or index_entry[key] != value:
                    match = False
                    break
            if match:
                entry_data = self.get(entry_id)
                if entry_data:
                    results.append(entry_data)
        return results
    
    def delete(self, entry_id: str) -> bool:
        """Delete entry by ID."""
        if entry_id not in self._memory_index:
            return False
            
        # Remove from index
        del self._memory_index[entry_id]
        self._save_index()
        
        # Delete file
        entry_path = self.storage_path / f"{entry_id}.json"
        if entry_path.exists():
            entry_path.unlink()
        
        return True

class MemoryManager:
    """Manager for coordinating working and long-term memory."""
    
    def __init__(
        self,
        working_memory: WorkingMemory,
        long_term_memory: LongTermMemory,
        consolidation_threshold: float = 0.7,
        consolidation_interval: int = 300  # 5 minutes
    ):
        self.working_memory = working_memory
        self.long_term_memory = long_term_memory
        self._consolidation_threshold = consolidation_threshold
        self._consolidation_interval = consolidation_interval
        self._consolidation_task: Optional[asyncio.Task] = None
    
    async def start_consolidation(self) -> None:
        """Start periodic memory consolidation."""
        self._consolidation_task = asyncio.create_task(self._consolidation_loop())
    
    async def stop_consolidation(self) -> None:
        """Stop memory consolidation."""
        if self._consolidation_task:
            self._consolidation_task.cancel()
            try:
                await self._consolidation_task
            except asyncio.CancelledError:
                pass
    
    async def _consolidation_loop(self) -> None:
        """Periodic consolidation of working memory to long-term memory."""
        while True:
            try:
                await asyncio.sleep(self._consolidation_interval)
                await self._consolidate_memory()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in memory consolidation: {str(e)}")
    
    async def _consolidate_memory(self) -> None:
        """Move important memories from working to long-term memory."""
        for entry in self.working_memory.get_recent():
            if entry.importance >= self._consolidation_threshold:
                self.long_term_memory.add(entry)
        
        # Clear consolidated memories from working memory
        self.working_memory.clear()
    
    def add_memory(self, entry: MemoryEntry) -> None:
        """Add memory entry to appropriate storage."""
        if entry.importance >= self._consolidation_threshold:
            # Important memories go directly to long-term storage
            self.long_term_memory.add(entry)
        else:
            # Less important memories stay in working memory
            self.working_memory.add(entry)
    
    def search_all(self, query: Dict[str, Any]) -> Dict[str, List[Any]]:
        """Search both working and long-term memory."""
        working_results = self.working_memory.search(query)
        long_term_results = self.long_term_memory.search(query)
        
        return {
            "working_memory": working_results,
            "long_term_memory": long_term_results
        } 