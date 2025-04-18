from typing import Dict, Any, List, Optional, Type
import logging
import asyncio
from datetime import datetime
import json
from pathlib import Path

from agents.base import Agent
from agents.specialized import CodeAgent, ResearchAgent, TaskAgent
from communication.protocol import MessageRouter, EventBus, Message, MessageType
from tools.handlers import ToolRegistry
from safety.guardrails import SafetyGuardrails
from knowledge.base import KnowledgeBase

logger = logging.getLogger(__name__)

class AgentOrchestrator:
    """Orchestrator for managing agent interactions and task distribution."""
    
    def __init__(
        self,
        config_path: Path,
        tool_registry: ToolRegistry,
        guardrails: SafetyGuardrails,
        knowledge_base: KnowledgeBase
    ):
        self._config = self._load_config(config_path)
        self._tool_registry = tool_registry
        self._guardrails = guardrails
        self._knowledge_base = knowledge_base
        
        # Communication
        self._event_bus = EventBus()
        self._message_router = MessageRouter(self._event_bus)
        
        # Agent management
        self._agents: Dict[str, Agent] = {}
        self._agent_types: Dict[str, Type[Agent]] = {
            "code": CodeAgent,
            "research": ResearchAgent,
            "task": TaskAgent
        }
        
        # Task management
        self._active_tasks: Dict[str, Dict[str, Any]] = {}
        self._task_agent: Optional[TaskAgent] = None
        
        # Monitoring
        self._resource_usage: Dict[str, Dict[str, float]] = {}
        self._last_health_check = datetime.now()
        
        # Initialize agents from config
        self._initialize_agents()
        
        # Setup event handlers
        self._setup_event_handlers()
    
    def _load_config(self, config_path: Path) -> Dict[str, Any]:
        """Load orchestrator configuration."""
        with open(config_path, "r") as f:
            return json.load(f)
    
    def _initialize_agents(self) -> None:
        """Initialize agents from configuration."""
        for agent_config in self._config["agents"]:
            agent_type = self._agent_types[agent_config["type"]]
            agent = agent_type(
                agent_id=agent_config["id"],
                name=agent_config["name"],
                tool_registry=self._tool_registry,
                guardrails=self._guardrails,
                knowledge_base=self._knowledge_base,
                capabilities=agent_config.get("capabilities")
            )
            self._agents[agent.id] = agent
            
            # Register message route
            self._message_router.register_route(
                agent.id,
                lambda msg, agent=agent: agent.process_message(msg.content)
            )
            
            # Store task agent reference
            if isinstance(agent, TaskAgent):
                self._task_agent = agent
    
    def _setup_event_handlers(self) -> None:
        """Setup event handlers for system events."""
        self._event_bus.subscribe(
            "task_update",
            self._handle_task_update
        )
        self._event_bus.subscribe(
            "resource_alert",
            self._handle_resource_alert
        )
        self._event_bus.subscribe(
            "agent_error",
            self._handle_agent_error
        )
    
    async def process_user_message(self, message: str) -> Dict[str, Any]:
        """Process incoming user message."""
        try:
            # Check message safety
            safety_check = self._guardrails.check_content_safety(message)
            if not safety_check["safe"]:
                return {
                    "success": False,
                    "reason": "Safety check failed",
                    "issues": safety_check["issues"]
                }
            
            # Route message to appropriate agent
            routing = await self._route_message(message)
            if routing["confidence"] < 0.7:
                # Request human intervention for low confidence
                intervention = await self._request_intervention(
                    "message_routing",
                    routing
                )
                if not intervention["approved"]:
                    return {
                        "success": False,
                        "reason": "Routing rejected by human"
                    }
                routing.update(intervention["updates"])
            
            # Process with selected agent
            agent = self._agents[routing["agent_id"]]
            response = await self.process_with_agent(agent, message)
            
            return {
                "success": True,
                "agent_id": agent.id,
                "response": response
            }
            
        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def process_with_agent(
        self,
        agent: Agent,
        message: str
    ) -> Dict[str, Any]:
        """Process message with specific agent."""
        try:
            # Monitor resource usage
            resource_usage = self._get_resource_usage()
            if self._check_resource_limits(resource_usage):
                return {
                    "success": False,
                    "reason": "Resource limits exceeded"
                }
            
            # Create message object
            msg = Message(
                content={"content": message},
                msg_type=MessageType.DIRECT,
                sender_id="user",
                recipient_id=agent.id
            )
            
            # Route message
            await self._message_router.route_message(msg)
            
            # Update resource usage
            self._update_resource_usage(agent.id, resource_usage)
            
            return {
                "success": True,
                "response": msg.content
            }
            
        except Exception as e:
            logger.error(f"Error processing with agent: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def handle_tool_request(
        self,
        tool_name: str,
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle tool usage request."""
        try:
            # Validate tool request
            validation = self._tool_registry.validate_tool_request({
                "name": tool_name,
                "args": params
            })
            
            if not validation["valid"]:
                return {
                    "success": False,
                    "reason": f"Tool validation failed: {validation['error']}"
                }
            
            # Check if tool requires human oversight
            if tool_name in self._config["high_risk_tools"]:
                intervention = await self._request_intervention(
                    "tool_usage",
                    {
                        "tool": tool_name,
                        "params": params
                    }
                )
                if not intervention["approved"]:
                    return {
                        "success": False,
                        "reason": "Tool usage rejected by human"
                    }
            
            # Execute tool
            result = await self.execute_tool_safely(tool_name, params)
            return result
            
        except Exception as e:
            logger.error(f"Error handling tool request: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def handle_agent_handoff(
        self,
        from_agent_id: str,
        to_agent_id: str,
        message: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle task handoff between agents."""
        try:
            # Validate agents
            if from_agent_id not in self._agents or to_agent_id not in self._agents:
                return {
                    "success": False,
                    "reason": "Invalid agent ID"
                }
            
            # Create handoff message
            handoff_msg = Message(
                content=message,
                msg_type=MessageType.DIRECT,
                sender_id=from_agent_id,
                recipient_id=to_agent_id,
                metadata={"handoff": True}
            )
            
            # Route message
            await self._message_router.route_message(handoff_msg)
            
            return {
                "success": True,
                "handoff_id": handoff_msg.id
            }
            
        except Exception as e:
            logger.error(f"Error handling agent handoff: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def execute_tool_safely(
        self,
        tool_name: str,
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute tool with safety checks and resource monitoring."""
        try:
            start_time = datetime.now()
            
            # Monitor resources during execution
            resource_usage = self._get_resource_usage()
            
            # Execute with timeout
            timeout = self._config["tool_timeouts"].get(tool_name, 30)
            result = await asyncio.wait_for(
                self._tool_registry.execute(tool_name, **params),
                timeout=timeout
            )
            
            # Update resource usage
            end_time = datetime.now()
            execution_time = (end_time - start_time).total_seconds()
            
            return {
                "success": True,
                "result": result,
                "metadata": {
                    "execution_time": execution_time,
                    "resource_usage": self._get_resource_usage()
                }
            }
            
        except asyncio.TimeoutError:
            return {
                "success": False,
                "error": "Tool execution timed out"
            }
        except Exception as e:
            logger.error(f"Error executing tool: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _route_message(self, message: str) -> Dict[str, Any]:
        """Route message to appropriate agent."""
        # This would typically use an ML model for routing
        # For now, use simple keyword matching
        keywords = {
            "code": ["code", "function", "bug", "error", "programming"],
            "research": ["research", "information", "find", "search"],
            "task": ["task", "plan", "coordinate", "manage"]
        }
        
        scores = {}
        for agent_type, words in keywords.items():
            score = sum(word.lower() in message.lower() for word in words)
            scores[agent_type] = score / len(words)
        
        best_type = max(scores.items(), key=lambda x: x[1])
        
        # Find agent of best type
        for agent in self._agents.values():
            if isinstance(agent, self._agent_types[best_type[0]]):
                return {
                    "agent_id": agent.id,
                    "confidence": best_type[1],
                    "reason": f"Matched keywords for {best_type[0]} agent"
                }
        
        # Default to task agent
        return {
            "agent_id": self._task_agent.id,
            "confidence": 0.5,
            "reason": "No clear match, defaulting to task agent"
        }
    
    async def _request_intervention(
        self,
        intervention_type: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Request human intervention."""
        # This would typically call a human intervention service
        # For now, auto-approve with warning
        logger.warning(f"Auto-approving {intervention_type} intervention: {context}")
        return {
            "approved": True,
            "updates": {}
        }
    
    def _get_resource_usage(self) -> Dict[str, float]:
        """Get current resource usage."""
        # This would typically use system metrics
        # For now, return dummy values
        return {
            "memory": 50.0,  # Percentage
            "cpu": 30.0,     # Percentage
            "network": 20.0  # MB/s
        }
    
    def _check_resource_limits(self, usage: Dict[str, float]) -> bool:
        """Check if resource usage exceeds limits."""
        limits = self._config["resource_limits"]
        return any(
            usage[resource] > limit
            for resource, limit in limits.items()
        )
    
    def _update_resource_usage(
        self,
        agent_id: str,
        usage: Dict[str, float]
    ) -> None:
        """Update resource usage tracking."""
        self._resource_usage[agent_id] = {
            "usage": usage,
            "timestamp": datetime.now().isoformat()
        }
    
    async def _handle_task_update(self, message: Message) -> None:
        """Handle task update events."""
        task_id = message.content.get("task_id")
        if task_id in self._active_tasks:
            self._active_tasks[task_id].update(message.content)
    
    async def _handle_resource_alert(self, message: Message) -> None:
        """Handle resource alert events."""
        logger.warning(f"Resource alert: {message.content}")
        # Implement resource management actions here
    
    async def _handle_agent_error(self, message: Message) -> None:
        """Handle agent error events."""
        logger.error(f"Agent error: {message.content}")
        # Implement error recovery actions here 