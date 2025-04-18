from typing import Dict, Any, List, Callable, Coroutine, Optional
import asyncio
import logging
from datetime import datetime
from uuid import uuid4
from enum import Enum

logger = logging.getLogger(__name__)

class MessageType(Enum):
    DIRECT = "direct"
    BROADCAST = "broadcast"
    SYSTEM = "system"
    EVENT = "event"
    TOOL_REQUEST = "tool_request"
    TOOL_RESPONSE = "tool_response"

class Message:
    """Message class for agent communication."""
    
    def __init__(
        self,
        content: Any,
        msg_type: MessageType,
        sender_id: str,
        recipient_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.id = str(uuid4())
        self.content = content
        self.type = msg_type
        self.sender_id = sender_id
        self.recipient_id = recipient_id
        self.metadata = metadata or {}
        self.timestamp = datetime.now()
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert message to dictionary."""
        return {
            "id": self.id,
            "content": self.content,
            "type": self.type.value,
            "sender_id": self.sender_id,
            "recipient_id": self.recipient_id,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat()
        }

class EventBus:
    """Event bus for agent communication."""
    
    def __init__(self):
        self._subscribers: Dict[str, List[Callable]] = {}
        self._message_queue: asyncio.Queue = asyncio.Queue()
        self._running = False
    
    async def publish(self, event: str, message: Message) -> None:
        """Publish an event with a message."""
        if event in self._subscribers:
            for callback in self._subscribers[event]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(message)
                    else:
                        callback(message)
                except Exception as e:
                    logger.error(f"Error in event callback: {str(e)}")
    
    def subscribe(self, event: str, callback: Callable) -> None:
        """Subscribe to an event."""
        if event not in self._subscribers:
            self._subscribers[event] = []
        self._subscribers[event].append(callback)
    
    def unsubscribe(self, event: str, callback: Callable) -> None:
        """Unsubscribe from an event."""
        if event in self._subscribers:
            self._subscribers[event].remove(callback)

class MessageRouter:
    """Router for handling message delivery between agents."""
    
    def __init__(self, event_bus: EventBus):
        self._event_bus = event_bus
        self._routes: Dict[str, Callable] = {}
        self._message_history: List[Message] = []
        self._history_limit = 1000
    
    async def route_message(self, message: Message) -> None:
        """Route a message to its destination."""
        try:
            # Add to history
            self._add_to_history(message)
            
            # Handle different message types
            if message.type == MessageType.BROADCAST:
                await self._handle_broadcast(message)
            elif message.type == MessageType.DIRECT:
                await self._handle_direct(message)
            elif message.type == MessageType.EVENT:
                await self._handle_event(message)
            elif message.type == MessageType.SYSTEM:
                await self._handle_system(message)
            else:
                logger.warning(f"Unknown message type: {message.type}")
                
        except Exception as e:
            logger.error(f"Error routing message: {str(e)}")
    
    def register_route(self, agent_id: str, callback: Callable) -> None:
        """Register a route for an agent."""
        self._routes[agent_id] = callback
    
    def unregister_route(self, agent_id: str) -> None:
        """Unregister a route."""
        if agent_id in self._routes:
            del self._routes[agent_id]
    
    async def _handle_broadcast(self, message: Message) -> None:
        """Handle broadcast messages."""
        for callback in self._routes.values():
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(message)
                else:
                    callback(message)
            except Exception as e:
                logger.error(f"Error in broadcast callback: {str(e)}")
    
    async def _handle_direct(self, message: Message) -> None:
        """Handle direct messages."""
        if not message.recipient_id:
            logger.error("Direct message missing recipient_id")
            return
            
        if message.recipient_id not in self._routes:
            logger.error(f"No route found for recipient: {message.recipient_id}")
            return
            
        callback = self._routes[message.recipient_id]
        try:
            if asyncio.iscoroutinefunction(callback):
                await callback(message)
            else:
                callback(message)
        except Exception as e:
            logger.error(f"Error in direct message callback: {str(e)}")
    
    async def _handle_event(self, message: Message) -> None:
        """Handle event messages."""
        event_type = message.metadata.get("event_type")
        if not event_type:
            logger.error("Event message missing event_type in metadata")
            return
            
        await self._event_bus.publish(event_type, message)
    
    async def _handle_system(self, message: Message) -> None:
        """Handle system messages."""
        # Broadcast to all agents
        await self._handle_broadcast(message)
        # Also publish as system event
        await self._event_bus.publish("system", message)
    
    def _add_to_history(self, message: Message) -> None:
        """Add message to history, maintaining size limit."""
        self._message_history.append(message)
        if len(self._message_history) > self._history_limit:
            self._message_history.pop(0)
    
    def get_history(self, limit: int = None) -> List[Message]:
        """Get message history."""
        if limit:
            return self._message_history[-limit:]
        return self._message_history 